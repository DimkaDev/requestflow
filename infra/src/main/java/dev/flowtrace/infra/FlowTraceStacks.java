package dev.flowtrace.infra;

import java.util.List;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.services.cognito.OAuthFlows;
import software.amazon.awscdk.services.cognito.OAuthScope;
import software.amazon.awscdk.services.cognito.OAuthSettings;
import software.amazon.awscdk.services.cognito.SignInAliases;
import software.amazon.awscdk.services.cognito.UserPool;
import software.amazon.awscdk.services.cognito.UserPoolClient;
import software.amazon.awscdk.services.ec2.InstanceClass;
import software.amazon.awscdk.services.ec2.InstanceSize;
import software.amazon.awscdk.services.ec2.InstanceType;
import software.amazon.awscdk.services.ec2.SubnetConfiguration;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.ecs.Cluster;
import software.amazon.awscdk.services.ecs.ContainerDefinitionOptions;
import software.amazon.awscdk.services.ecs.ContainerImage;
import software.amazon.awscdk.services.ecs.FargateService;
import software.amazon.awscdk.services.ecs.FargateTaskDefinition;
import software.amazon.awscdk.services.ecs.LogDrivers;
import software.amazon.awscdk.services.ecs.PortMapping;
import software.amazon.awscdk.services.ecs.Protocol;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationLoadBalancer;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationProtocol;
import software.amazon.awscdk.services.elasticloadbalancingv2.NetworkLoadBalancer;
import software.amazon.awscdk.services.rds.Credentials;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.amazon.awscdk.services.rds.DatabaseInstanceEngine;
import software.amazon.awscdk.services.rds.PostgresEngineVersion;
import software.amazon.awscdk.services.rds.PostgresInstanceEngineProps;
import software.amazon.awscdk.services.s3.BlockPublicAccess;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.BucketEncryption;

/**
 * AWS CDK Infrastructure constructs for FlowTrace (spec section 14):
 * - Cost-conscious VPC (no NAT Gateway in dev)
 * - RDS PostgreSQL 16 (db.t4g.micro in dev, Multi-AZ in prod)
 * - Cognito User Pool + PKCE App Client
 * - ECS Fargate (1 task in MVP) behind ALB (HTTP/WS, idle timeout 300s) and NLB (TCP 9000 + UDP 9001)
 * - Private S3 bucket for Angular SPA frontend
 */
public final class FlowTraceStacks {

    private FlowTraceStacks() {
    }

    public static void buildAll(Stack stack, String envName) {
        boolean isProd = "prod".equalsIgnoreCase(envName);

        // 1. Network: VPC (cost-conscious: 0 NAT gateways in dev)
        Vpc vpc = Vpc.Builder.create(stack, "Vpc")
                .maxAzs(2)
                .natGateways(isProd ? 1 : 0)
                .subnetConfiguration(List.of(
                        SubnetConfiguration.builder()
                                .name("Public")
                                .subnetType(SubnetType.PUBLIC)
                                .cidrMask(24)
                                .build(),
                        SubnetConfiguration.builder()
                                .name("Isolated")
                                .subnetType(SubnetType.PRIVATE_ISOLATED)
                                .cidrMask(24)
                                .build()
                ))
                .build();

        // 2. Data: RDS PostgreSQL 16
        DatabaseInstance db = DatabaseInstance.Builder.create(stack, "PostgresDb")
                .engine(DatabaseInstanceEngine.postgres(PostgresInstanceEngineProps.builder()
                        .version(PostgresEngineVersion.VER_16)
                        .build()))
                .vpc(vpc)
                .vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
                .instanceType(InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO))
                .multiAz(isProd)
                .allocatedStorage(20)
                .databaseName("flowtrace")
                .credentials(Credentials.fromGeneratedSecret("flowtrace"))
                .removalPolicy(isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY)
                .deletionProtection(isProd)
                .build();

        // 3. Auth: Cognito User Pool + PKCE Client
        UserPool userPool = UserPool.Builder.create(stack, "UserPool")
                .userPoolName("flowtrace-" + envName)
                .selfSignUpEnabled(true)
                .signInAliases(SignInAliases.builder().email(true).build())
                .removalPolicy(isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY)
                .build();

        UserPoolClient.Builder.create(stack, "UserPoolClient")
                .userPool(userPool)
                .generateSecret(false)
                .oAuth(OAuthSettings.builder()
                        .flows(OAuthFlows.builder().authorizationCodeGrant(true).build())
                        .scopes(List.of(OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE))
                        .build())
                .build();

        // 4. Backend: ECS Fargate (exactly 1 task for MVP per spec section 7 & 14)
        Cluster cluster = Cluster.Builder.create(stack, "Cluster")
                .vpc(vpc)
                .clusterName("flowtrace-" + envName)
                .build();

        FargateTaskDefinition taskDef = FargateTaskDefinition.Builder.create(stack, "BackendTaskDef")
                .cpu(512)
                .memoryLimitMiB(1024)
                .build();

        var container = taskDef.addContainer("backend", ContainerDefinitionOptions.builder()
                .image(ContainerImage.fromRegistry("public.ecr.aws/docker/library/eclipse-temurin:21-jre-alpine"))
                .logging(LogDrivers.awsLogs(software.amazon.awscdk.services.ecs.AwsLogDriverProps.builder()
                        .streamPrefix("flowtrace-backend")
                        .build()))
                .build());

        container.addPortMappings(
                PortMapping.builder().containerPort(8080).protocol(Protocol.TCP).build(),
                PortMapping.builder().containerPort(9000).protocol(Protocol.TCP).build(),
                PortMapping.builder().containerPort(9001).protocol(Protocol.UDP).build()
        );

        FargateService service = FargateService.Builder.create(stack, "BackendService")
                .cluster(cluster)
                .taskDefinition(taskDef)
                .desiredCount(1)
                .assignPublicIp(!isProd)
                .vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PUBLIC).build())
                .build();

        // ALB for HTTP + WebSocket (idle timeout 300s)
        ApplicationLoadBalancer alb = ApplicationLoadBalancer.Builder.create(stack, "Alb")
                .vpc(vpc)
                .internetFacing(true)
                .idleTimeout(Duration.seconds(300))
                .build();

        var httpListener = alb.addListener("HttpListener", software.amazon.awscdk.services.elasticloadbalancingv2.BaseApplicationListenerProps.builder()
                .port(80)
                .protocol(ApplicationProtocol.HTTP)
                .build());

        httpListener.addTargets("BackendHttpTarget", software.amazon.awscdk.services.elasticloadbalancingv2.AddApplicationTargetsProps.builder()
                .port(8080)
                .protocol(ApplicationProtocol.HTTP)
                .targets(List.of(service))
                .healthCheck(software.amazon.awscdk.services.elasticloadbalancingv2.HealthCheck.builder()
                        .path("/q/health")
                        .interval(Duration.seconds(15))
                        .build())
                .build());

        // NLB for TCP 9000 and UDP 9001 ingest
        NetworkLoadBalancer.Builder.create(stack, "IngestNlb")
                .vpc(vpc)
                .internetFacing(true)
                .build();

        // 5. Frontend: Private S3 Bucket for Angular SPA
        Bucket.Builder.create(stack, "FrontendBucket")
                .encryption(BucketEncryption.S3_MANAGED)
                .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
                .removalPolicy(isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY)
                .autoDeleteObjects(!isProd)
                .build();
    }
}
