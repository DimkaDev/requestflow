# WORKLOG.md — Журнал работы и синхронизации агентов (Cloud ↔ Local)

> **Назначение:** Этот файл служит единым журналом передачи контекста (Handoff & Traceability Log) между **облачным агентом** (Cloud VM) и **локальным агентом** (на машине разработчика).
>
> **Правило для любого агента (Cloud или Local):**
> 1. **Перед началом работы:** выполни `git pull --rebase`, прочитай этот файл (`docs/WORKLOG.md`) и `docs/PROGRESS.md`, чтобы понять последнее состояние проекта, сделанные шаги и следующие задачи.
> 2. **После завершения задачи / сессии:** обязательно добавь новую запись в раздел **«История сессий (Trace Log)»** сверху (от новых к старым), закоммить код вместе с обновлённым `docs/WORKLOG.md` и сделай `git push`.

---

## Быстрый чек-лист переключения (Cloud ↔ Local)

### Если вы переходите из Облака → на Локальный компьютер:
```bash
git pull origin main
# Проверить статус и запустить локальный стек:
./scripts/dev-sync.sh status
docker compose up --build
```

### Если вы поработали Локально → и переходите к Облачному агенту:
```bash
git add .
git commit -m "feat/fix: описание изменений"
git push origin main
```
*(После этого просто напишите облачному агенту: «Сделай git pull и прочитай docs/WORKLOG.md»).*

---

## Текущее состояние проекта (Snapshot)

- **Активная ветка:** `main`
- **Последний завершённый этап:** `M0` – `M8` (Базовая реализация MVP по `spec.md` завершена, покрыта тестами).
- **Статус сборки и тестов:**
  - `mvn test` (`client-java`, `simulator`, `backend`, `infra`): **PASS** (14/14 тестов зеленые).
  - `cd frontend && npm test && npm run build`: **PASS** (4/4 теста `AnimationEngine` зеленые, production bundle собирается без ошибок).
- **Сидированные данные по умолчанию (при старте бэкенда):**
  - Проект: `E-Commerce Checkout Flow` (`0194f1c0-0000-7000-8000-000000000001`)
  - Инжест API-ключ: `ft_live_demo0000000000000000000000000000`
  - Авто-запуск `DemoSimulator`: включён (`flowtrace.demo.auto-start=true`).

---

## Открытые задачи / Бэклог для следующих сессий (Next Up)

- [ ] Проверить запуск `docker compose up --build` на локальной машине разработчика.
- [ ] При необходимости настроить реальный AWS профиль и выполнить `npx cdk deploy FlowTrace-dev` из папки `infra/`.
- [ ] Добавить E2E-тесты Playwright поверх локального контейнера (`frontend` + `backend`).

---

## История сессий (Trace Log)

### Сессия #002 — 2026-11-08 (Environment: `cloud-vm`)
- **Автор / Агент:** Antigravity (Cloud)
- **Цель:** Организация непрерывной работы и трассировки действий между облачным и локальным агентами.
- **Что сделано:**
  - Создан единый журнал трассировки работ [`docs/WORKLOG.md`](./WORKLOG.md).
  - Обновлён [`AGENTS.md`](../AGENTS.md) — добавлен обязательный протокол **Cloud ↔ Local Handoff Protocol** (чтение и запись в `docs/WORKLOG.md` при каждой сессии).
  - Добавлен скрипт синхронизации и проверки окружения [`scripts/dev-sync.sh`](../scripts/dev-sync.sh).
- **Затронутые файлы:**
  - `docs/WORKLOG.md`
  - `AGENTS.md`
  - `scripts/dev-sync.sh`
- **Как проверить локально:**
  - Выполнить `git pull && ./scripts/dev-sync.sh status`

---

### Сессия #001 — 2026-11-07 / 2026-11-08 (Environment: `cloud-vm`)
- **Автор / Агент:** Antigravity (Cloud)
- **Коммит:** `f0c01c9` (`feat: implement FlowTrace live request flow visualizer (M0-M8)`)
- **Цель:** Полная реализация спецификации `spec.md` (этапы M0 — M8).
- **Что сделано:**
  1. **M0 (Skeleton & ADRs):**
     - Созданы `AGENTS.md`, `docs/PROGRESS.md`, `docs/PROTOCOL.md`, `docs/BRANDING.md`, `docs/event.schema.json` и архитектурные решения `docs/adr/0001..0004`.
     - Настроен корневой `pom.xml`, `docker-compose.yml` и GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`).
  2. **M1 (Ingest HTTP/UDP/TCP + HopResolver + WebSocket Stream):**
     - Чистая доменная модель в `dev.flowtrace.domain`: `HopResolver` (все 9 правил секции 6.1, кэш состояния трейсов 30с, идемпотентность по `seq` 10с, auto-discovery), `CheckpointEvent`, `TokenBucketRateLimiter`, `ApiKeyCrypto`, `UuidV7`.
     - Входящие адаптеры: `IngestHttpResource` (`/api/v1/events`, `/api/v1/traces`), `UdpIngestServer` (`9001/udp`), `TcpIngestServer` (`9000/tcp` с `hello` handshake и `ack`/`nack`).
     - WebSocket-стрим `ProjectStreamWebSocket` (`/ws/v1/projects/{projectId}/stream`) с отправкой `snapshot`, секундных `stats` и защитой от медленных клиентов.
  3. **M2 (Angular Canvas + AnimationEngine + DemoSimulator):**
     - Реализован `AnimationEngine` (`frontend/src/app/core/animation-engine.ts`) с расчётом кривых Безье, шлейфами (`trail`), режимом `realtime` catch-up, лимитом 300 токенов и поддержкой `prefers-reduced-motion`.
     - Реализован серверный `DemoSimulator` для автоматической генерации живого трафика по графу проекта.
  4. **M3–M5 (Persistence, Projects, Editor, Trace Replay):**
     - Flyway-схема `V1__init_schema.sql`, `JdbcProjectRepository`, асинхронный батч-райтер `JdbcTraceRepository` и REST-контроллер `ProjectManagementResource`.
     - В Angular UI добавлены: режим визуального редактора (Drag & Drop, соединение портов, Undo/Redo, Auto-Layout, подтверждение/отклонение `discovered` рёбер), экран поиска и воспроизведения трейсов (`Traces & Replay`) и экран настроек с генерацией API-ключей и готовыми сниппетами кода.
  5. **M6–M8 (Java SDK, CLI Simulator, AWS CDK, Perf & Runbook):**
     - Модуль `client-java` (`FlowTrace`, `HttpTransport`, `UdpTransport`, `TcpTransport`, `FlowTraceContext`).
     - Модуль `simulator` (`SimulatorCli`) и пример `examples/CheckoutServiceExample.java`.
     - Модуль `infra` на AWS CDK (`FlowTraceCdkApp`, `FlowTraceStacks`: VPC, RDS Postgres 16, Cognito, ECS Fargate + ALB + NLB, S3).
- **Проверка / Тесты:**
  - `HopResolverTest` (9 unit-тестов), `FlowTraceIntegrationTest` (3 интеграционных теста: health, HTTP+UDP+TCP→WS+DB, multi-tenant isolation), `FlowTraceClientTest`, `FlowTraceCdkTest`, `animation-engine.spec.ts` (4 теста).
