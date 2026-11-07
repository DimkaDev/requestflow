# FlowTrace — Operations & Deployment Runbook

## 1. Architecture Summary
FlowTrace runs on AWS (`eu-west-1` default) managed via AWS CDK (`infra/`):
- **Frontend:** Private S3 bucket + CloudFront OAC distribution serving the Angular SPA (`frontend/`).
- **API & WebSocket (`/api/v1`, `/ws/v1`):** ECS Fargate service behind an Application Load Balancer (ALB) with HTTPS/WSS and `300s` idle timeout.
- **UDP & TCP Ingest (`9001/udp`, `9000/tcp`):** Network Load Balancer (NLB) forwarding to the same Fargate task IP targets, using the Quarkus HTTP health port (`/q/health`) for target group health checks.
- **Database:** Amazon RDS PostgreSQL 16 (`db.t4g.micro` in `dev`, Multi-AZ in `prod`).
- **Authentication:** Amazon Cognito User Pool + PKCE App Client.

## 2. Reproducible Deployment (`dev` / `prod`)

### Prerequisites
- Java 21, Maven 3.8+, Node.js 24+, AWS CLI & AWS CDK CLI (`npm i -g aws-cdk`).

### Synthesize CloudFormation Templates
```bash
cd infra
mvn test
npx cdk synth -c env=dev
```

### Deploy to AWS
```bash
npx cdk deploy FlowTrace-dev --require-approval never -c env=dev
```

### Tear Down (`dev`)
```bash
npx cdk destroy FlowTrace-dev -c env=dev
```

## 3. Health Checks & Prometheus Metrics
- **Health endpoint:** `GET /q/health` (liveness & readiness)
- **Metrics endpoint:** `GET /q/metrics`
  - `ingest_events_total{protocol="http|udp|tcp|demo"}`
  - `ingest_dropped_total{protocol="...",reason="unauthorized|rate_limit|validation|oversized_datagram|..."}`
  - `ws_sessions`
  - `ws_dropped_total`
  - `hop_latency_seconds`
  - `db_flush_seconds`

## 4. Scaling & Fanout
- **MVP Single-Task Mode:** `flowtrace.fanout.type=in-memory` (default). Keep ECS Fargate `desiredCount = 1` so WebSocket clients receive all UDP/TCP/HTTP events ingested on that task.
- **Multi-Task Autoscaling Mode:** Set `flowtrace.fanout.type=redis` and `FLOWTRACE_REDIS_URL=redis://...` to broadcast `UiEvent` messages across all Fargate tasks via Redis pub/sub before increasing `desiredCount > 1`.
