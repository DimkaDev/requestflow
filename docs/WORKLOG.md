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

- **Активная ветка:** `feat/stitch-design`
- **Последний завершённый этап:** `M0` – `M8` + `G1-UI / Stitch` + **E26 Advanced Diagram Editor (Phases P1–P5)** + **Epic E3 Commercial Billing, Declarative Entitlements & EU B2B VAT**.
- **Статус сборки и тестов:**
  - `mvn test` (`parent`, `client-java`, `simulator`, `backend`, `infra`): **BUILD SUCCESS (43/43 PASS)** (включая E26 end-to-end интеграционный тест и E3 end-to-end тест биллинга, идемпотентности вебхуков, 7-дневного грейс-периода и валидации EU VAT ID).
  - `cd frontend && npm test && npm run build`: **PASS** (14/14 юнит-тестов в `animation-engine.spec.ts` и `editor-engine.spec.ts`, production bundle собирается без ошибок).
- **Сидированные данные по умолчанию (при старте бэкенда):**
  - Проект: `E-Commerce Checkout Flow` (`0194f1c0-0000-7000-8000-000000000001`)
  - Инжест API-ключ: `ft_live_demo0000000000000000000000000000`
  - Авто-запуск `DemoSimulator`: включён (`flowtrace.demo.auto-start=true`).
- **Готовность к передаче в Cloud VM / Local:**
  - Все миграции Flyway (`V1..V8`) проверены и совместимы как с PostgreSQL 16, так и с in-memory H2.
  - Добавлено свойство `quarkus.flyway.repair-at-start=true` для автоматического устранения расхождений контрольных сумм при переносе между окружениями.

---

## Открытые задачи / Бэклог для следующих сессий (Next Up)

- [ ] **Epic 3 (S1):** Distributed Cluster & Redis Pub/Sub Fanout (`TASK-3.1` – `TASK-3.4`).
- [ ] Добавить E2E-тесты Playwright поверх контейнеризованного окружения (включая сценарий Blank Canvas -> Publish в `/projects/:projectId/editor` и `/billing`).

---

## История сессий (Trace Log)

### Сессия #018 — 2026-11-14 (Environment: `cloud-vm`, Branch: `feat/stitch-design`)
- **Автор / Агент:** Antigravity (Cloud VM)
- **Цель:** Полная реализация **Epic E3 / TASK-2.1..2.4 - Commercial Billing, Declarative Entitlements Engine, Subscriptions, 7-Day Dunning Grace Period, EU B2B VAT & Invoices** после согласования архитектурного плана в `/grill-me`.
- **Что сделано:**
  - **ADR и Миграция (`docs/adr/0011-billing-provider-stripe-and-entitlements.md`, `V8__billing_subscriptions_and_invoices.sql`):**
    - Зафиксированы архитектурные решения `DEC-02` (дуальный адаптер `StripeAndSandboxBillingAdapter` с проверкой `Stripe-Signature` `HMAC-SHA256`), единый 4-уровневый каталог тарифов (`FREE` \$0, `PRO` \$29/\$23, `BUSINESS` \$99/\$79, `ENTERPRISE` \$299/\$239), 120% soft-cap буфер для платных планов и 7-дневный грейс-период при ошибке оплаты (`PAST_DUE`).
    - Добавлена миграция `V8__billing_subscriptions_and_invoices.sql` (`organization_subscriptions`, `billing_invoices`, `billing_webhook_events`).
  - **Backend (Domain, Application, Outbound Billing Adapter, REST API):**
    - Чистые доменные модели в `dev.flowtrace.domain`: `SubscriptionStatus`, `BillingInterval`, `PlanCatalogEntry`, `Subscription` (с проверкой EU VAT ID `^[A-Z]{2}[0-9A-Z]{8,12}$` и промокодами `LAUNCH20` / `FLOW50`), `BillingInvoice`, обновлённый `PlanTier` (`effectiveHardStopQuota()`, `toCatalogEntry()`).
    - Реализованы `EntitlementsService`, `BillingProviderPort`, `StripeAndSandboxBillingAdapter` и `BillingService` (Checkout, Customer Portal, синхронизация подписки, идемпотентная обработка вебхуков через `billing_webhook_events`, планировщик `expirePastDueSubscriptions` для понижения до `FREE` по истечении 7 дней грейс-периода без удаления проектов и диаграмм).
    - В `BillingResource` и `OrganizationResource` добавлены эндпоинты `GET /api/v1/billing/plans`, `GET/POST/PUT /api/v1/organizations/{orgId}/billing/**` и `POST /api/v1/webhooks/billing`.
  - **Frontend (`/billing` UI, API Client & Models):**
    - Обновлены `models.ts`, `api.service.ts` и компонент `BillingPageComponent` (`billing.page.ts`): бейдж статуса подписки (`ACTIVE`, `PAST_DUE`, `CANCELED`), баннер 7-дневного грейс-периода, шкала квоты с отметками 80% / 100% / 120% soft-cap, ввод промокода, переключение Monthly / Annual (`-20%`), форма EU B2B VAT профиля, таблица инвойсов и симулятор подписанных вебхуков.
- **Изменённые и созданные файлы:**
  - `docs/adr/0011-billing-provider-stripe-and-entitlements.md`
  - `backend/src/main/resources/db/migration/V8__billing_subscriptions_and_invoices.sql`
  - `backend/src/main/java/dev/flowtrace/domain/{SubscriptionStatus,BillingInterval,PlanCatalogEntry,Subscription,BillingInvoice,PlanTier}.java`
  - `backend/src/main/java/dev/flowtrace/application/{EntitlementsService,BillingService,UsageMeterService}.java`
  - `backend/src/main/java/dev/flowtrace/application/port/out/{BillingProviderPort,OrganizationRepository}.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/billing/StripeAndSandboxBillingAdapter.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcOrganizationRepository.java`
  - `backend/src/main/java/dev/flowtrace/adapter/in/http/{BillingResource,OrganizationResource}.java`
  - `backend/src/test/java/dev/flowtrace/domain/BillingAndEntitlementsTest.java`
  - `backend/src/test/java/dev/flowtrace/application/UsageMeterServiceTest.java`
  - `backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java`
  - `frontend/src/app/core/{models.ts,api.service.ts}`
  - `frontend/src/app/features/billing/billing.page.ts`
- **Тесты и проверки:**
  - `mvn -B test` (в `backend`): `43/43` тестов зелёные (`BillingAndEntitlementsTest`, `UsageMeterServiceTest`, `TenantIsolationGuardTest`, `FlowTraceIntegrationTest`).
  - `npm test && npm run build` (в `frontend`): `14/14` тестов зелёные, production-сборка успешна.
- **Следующие шаги:**
  - Реализовать Epic 3 (Redis Pub/Sub `EventFanout` для горизонтального масштабирования).

### Сессия #017 — 2026-11-14 (Environment: `cloud-vm`, Branch: `feat/stitch-design`)
- **Автор / Агент:** Antigravity (Cloud VM)
- **Цель:** Полная реализация **E26 - Advanced Diagram Editor (blank-canvas projects)** по фазам P1–P5.
- **Что сделано:**
  - **ADR и Документация (`docs/adr/0010-advanced-diagram-editor.md`, `docs/PROTOCOL.md`, `docs/editor.md`, `ATTRIBUTIONS.md`):**
    - Зафиксированы архитектурные решения `DEC-16` (движок авто-лейаута), `DEC-17` (хранение черновиков в `project_diagram_drafts`), `DEC-18` (JSON-каталог паков и API кастомных блоков организации) и `DEC-19` (7-дневные алиасы переименованных ключей в `node.props.aliases`).
    - Документирована схема диаграмм `Schema v2` с автоматической миграцией `Schema v1 -> v2`, руководство по редактору и атрибуция нейтральных иконок.
  - **Backend (Flyway V7, Domain, Application, Ports & REST API):**
    - Миграция `V7__diagram_drafts_and_custom_blocks.sql` (`project_diagram_drafts`, `org_custom_blocks`, колонки `author_email` и `change_summary` в `diagram_versions`).
    - Расширены доменные модели `DiagramGraph` (Schema v2: `props`, `style`, `flow`, `groups`, `resolveAliasMap()`), `DiagramDraft`, `CustomBlockDefinition`, `DiagramVersion`, `PlanTier` (лимиты блоков и паков по тарифу).
    - В `HopResolver` добавлено разрешение алиасов (`resolveNodeKey`) с фоллбэком на авто-дискавери.
    - В `ProjectManagementResource` и `TemplateResource` добавлены эндпоинты `GET/PUT /api/v1/projects/{id}/diagram/draft` (с проверкой `expectedDraftVersion` и ответом `409 Conflict`), `POST /api/v1/projects/{id}/diagram/publish`, `GET /api/v1/projects/{id}/diagram/versions`, `POST /api/v1/projects/{id}/diagram/versions/{ver}/restore`, `GET /api/v1/projects/{id}/key-usage/{nodeKey}`, `GET/POST/DELETE /api/v1/projects/{id}/custom-blocks` и `POST /api/v1/templates/custom`.
  - **Frontend (`/projects/:projectId/editor`, Block Library, Engine, Inspector, Preview Flow):**
    - Создан JSON-каталог из 7 паков (`standard`, `shop`, `aws`, `gcp`, `tech`, `ai-agent`, `business`) со строгой валидацией `catalog.schema.json` и `validateCatalogPack()`.
    - Реализован `editor-engine.ts`: генерация и валидация ключей (`slugifyKey`, `ensureUniqueKey`), миграция `v1 -> v2`, Command-pattern `EditorCommandHistory` (120 шагов Undo/Redo с сохранением в `sessionStorage`), иерархический авто-лейаут (`LR` / `TB` / `Tidy`), правила валидации (Error / Warning / Plan Limit), симулятор `generatePreviewRun` с весами ветвлений и Shop-корзиной, поиск пути между двумя блоками (`findPathsBetweenNodes`) и виртуализация viewport для графов 300+ узлов (`< 16ms`).
    - Создан полноэкранный компонент `DiagramEditorPageComponent` (`/projects/:projectId/editor`) и подключены точки входа из `OnboardingWizardPageComponent` (`Blank canvas`), `ProjectsHomePageComponent` и `LiveToolbarComponent` (`Edit diagram`).
- **Изменённые и созданные файлы:**
  - `docs/adr/0010-advanced-diagram-editor.md`, `ATTRIBUTIONS.md`, `docs/editor.md`, `docs/PROTOCOL.md`
  - `backend/src/main/resources/db/migration/V7__diagram_drafts_and_custom_blocks.sql`
  - `backend/src/main/java/dev/flowtrace/domain/{DiagramGraph,DiagramVersion,DiagramDraft,CustomBlockDefinition,PlanTier,HopResolver}.java`
  - `backend/src/main/java/dev/flowtrace/application/{ProjectRepository,TraceRepository,ProjectService}.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/{JdbcProjectRepository,JdbcTraceRepository}.java`
  - `backend/src/main/java/dev/flowtrace/adapter/in/http/{ProjectManagementResource,TemplateResource}.java`
  - `backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java`
  - `frontend/src/app/features/editor/catalog/{catalog.schema.json,catalog-registry.ts,standard.json,shop.json,aws.json,gcp.json,tech.json,ai-agent.json,business.json}`
  - `frontend/src/app/features/editor/engine/{editor-engine.ts,editor-engine.spec.ts}`
  - `frontend/src/app/features/editor/{diagram-editor.page.ts,diagram-editor.template.ts}`
  - `frontend/src/app/{app.routes.ts,core/models.ts,core/api.service.ts,core/template-visuals.ts}`
  - `frontend/src/app/features/{onboarding/onboarding-wizard.page.ts,projects/projects-home.page.ts,live-view/components/live-toolbar.component.ts}`
- **Запущенные тесты:**
  - `cd frontend && npm test && npm run build` -> 14/14 unit tests PASS, `ng build` PASS.
  - `cd backend && mvn -B test` -> 39/39 unit & integration tests PASS.
- **Следующие шаги:**
  - Перейти к реализации Эпика 2 (Stripe Billing & Subscriptions) либо E2E-тестам Playwright.

### Сессия #016 — 2026-11-14 (Environment: `local`, Branch: `feat/stitch-design`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация и доводка Stitch-экранов (`Live View`, `Traces & Replay Studio`, `Architecture Template Gallery`, `Projects Home`, `Onboarding Steps 1–3`, `Shop Live Demo`), а также исправление критических проблем загрузки `/traces`, `/templates` и `/shop`.
- **Что сделано:**
  - **Live Topology (`flow-canvas.component.ts`, `template-visuals.ts`, `flow-session.store.ts`, `node-inspector-drawer.component.ts`):**
    - Исправлен маппинг иконок (`MATERIAL_ICON_MAP`, включая `git-branch` -> `alt_route`) в `template-visuals.ts`.
    - Исправлена видимость связей (`gradientUnits="userSpaceOnUse"` на `#edge-active-gradient`), уменьшены наконечники стрелок (`markerUnits="userSpaceOnUse"`), добавлена процентовка переходов после `decision`-узлов (`getEdgePercentage`), реализован drag-and-drop отдельных узлов с пересчётом связей и сохранением координат, а также более плавная скорость передачи по умолчанию (`speedMultiplier = 0.5`, `streamMode = 'smooth'`).
  - **Traces & Replay Studio (`traces-replay.page.ts`):**
    - Полная загрузка истории трейсов (`limit: 200`), фильтры по ноде, статусу и поиску, кнопка обновления, пошаговый replay с Hop 1, бейдж `REPLAYING` и `gradientUnits="userSpaceOnUse"` для `#replayConduitGrad`.
  - **Architecture Template Gallery (`template-gallery.page.ts`):**
    - Реализована левая панель Workspace, hero-баннер `Online shop — watch customers fill their carts, live` с анимированной SVG-схемой и переходами `/` и `/shop`, вкладки категорий со счётчиками, поиск, сортировка и 3-колоночная сетка карточек с Безье мини-топологиями.
  - **Projects Home & Onboarding Steps 1–3 (`projects-home.page.ts`, `onboarding-wizard.page.ts`):**
    - Обновлён экран `Projects Home` (левая панель Workspace, фильтрация/сортировка, мини-топологии, правая панель Ingestion Budget и Quickstart SDKs); создание нового проекта перенаправляет на `/onboarding`.
    - Реализован 3-шаговый мастер онбординга по Stitch-макетам: Step 1 (выбор шаблона + `Blank canvas`), Step 2 (SDK-сниппеты, тест из браузера и Topology Live Preview), Step 3 (Waiting State -> Zen Celebration & Activation Hub).
  - **Shop Live Demo (`shop-live.page.ts`, `flow-canvas.component.ts`):**
    - Вёрстка `Cozy Light Edition` (5 KPI-карточек, зоны Store / Checkout, Live Sale Ticker, переключатель 4 режимов: `Cozy Light`, `Dark Neon`, `CRO Funnel`, `TV Showroom`), фиксированная высота контейнера `h-[560px]` для `app-flow-canvas`, автоцентрирование графа `online-shop` (`centerShopCanvas`) и круглые бейджи запросов в виде животных только для `online-shop`.
  - **Исправление загрузки данных (`flow-session.store.ts`, `traces-replay.page.ts`):**
    - Устранена гонка инициализации `FlowSessionStore.init()` (общий `initPromise` вместо синхронного флага `initialized`), добавлен `BUILTIN_FALLBACK_TEMPLATES` для `/templates` и `effect()` по `selectedProjectId()` для автозагрузки `/traces`.
- **Изменённые файлы:**
  - `frontend/src/app/core/flow-session.store.ts`
  - `frontend/src/app/core/template-visuals.ts`
  - `frontend/src/app/features/live-view/components/flow-canvas.component.ts`
  - `frontend/src/app/features/live-view/components/node-inspector-drawer.component.ts`
  - `frontend/src/app/features/traces/traces-replay.page.ts`
  - `frontend/src/app/features/templates/template-gallery.page.ts`
  - `frontend/src/app/features/projects/projects-home.page.ts`
  - `frontend/src/app/features/onboarding/onboarding-wizard.page.ts`
  - `frontend/src/app/features/shop/shop-live.page.ts`
  - `docs/WORKLOG.md`
- **Проверки:**
  - `CI=true HOME=/tmp npm --prefix frontend test`: **7/7** тестов пройдено (`AnimationEngine (spec section 10.3)`).
  - `cd frontend && CI=true HOME=/tmp npx ng build --configuration development`: **PASS** (0 ошибок, `main.js` 2.36 MB, `styles.css` 65.32 kB).
- **Следующие шаги:**
  - Доверстать остальные 3 варианта отображения `/shop` (`Dark Neon Ops Hub`, `High-Density CRO Funnel`, `TV Showroom Mode`) и подключить экран `Settings / API Keys / Connectors` по Stitch-макетам.

### Сессия #015 — 2026-11-13 (Environment: `cloud-vm`, Branch: `feat/stitch-design`)
- **Автор / Агент:** Antigravity (Cloud)
- **Цель:** Реализация полного набора экранов нового дизайна Stitch из `docs/design/stitch_requestflowproject` с модульным разделением, привязкой к бэкенду и созданием недостающих бэкенд-сущностей (Alert Rules & Webhooks).
- **Что сделано:**
  - **Бэкенд (Hexagonal Architecture, 100% clean domain):**
    - Доменная сущность `dev.flowtrace.domain.AlertRule` (чистый Java 21 record).
    - Порт `dev.flowtrace.application.port.out.AlertRuleRepository`.
    - Адаптер `dev.flowtrace.adapter.out.pg.JdbcAlertRuleRepository` (поддержка tenant isolation и scoped queries).
    - Flyway миграция `backend/src/main/resources/db/migration/V6__alert_rules.sql` (таблица `alert_rules`, индексы, совместимость с PostgreSQL 16 и H2).
    - REST-контроллер `dev.flowtrace.adapter.in.http.AlertResource` (`/api/v1/projects/{projectId}/alerts` — list, create, patch, test fire, delete).
    - Обновлён тест `TenantIsolationGuardTest` (проверка 7 JDBC-репозиториев с обязательными `WHERE`-клаузами).
  - **Фронтенд (Модульная архитектура экранов Angular 22 standalone):**
    - `features/traces/traces-replay.page.ts` — Traces & Replay Studio с фильтрами, списком трасс, инспектором спанов и анимированным пошаговым воспроизведением токена по графу (`AnimationEngine`).
    - `features/projects/projects-home.page.ts` — Projects Home со списком проектов, анимированными SVG-миниатюрами топологии, созданием/удалением и виджетом бюджета инжеста.
    - `features/templates/template-gallery.page.ts` — Архитектурная галерея шаблонов с категориями, поиском, живыми мини-превью и применением к бэкенду.
    - `features/onboarding/onboarding-wizard.page.ts` — 3-шаговый Onboarding Wizard (выбор шаблона, генерация SDK-сниппетов на 5 языках, тестовая отправка события в `/api/v1/events` и слушание WebSocket).
    - `features/alerts/alerts.page.ts` — Alert Rules & Webhook stream со статусами, конструктором правил, Mute и тестовой отправкой.
    - `features/shop/shop-live.page.ts` — Live Shop со всеми 4 вариациями Stitch (`cozy-light`, `dark-neon`, `cro-funnel`, `tv-showroom`), кнопкой смены темплейта и CRO-воронкой.
    - `features/connectors/connectors.page.ts` — 2-шаговый визард подключения вебхуков (Shopify, Stripe, WooCommerce, Generic JSON) с маппингом полей.
    - `features/settings/settings.page.ts` — Настройки проекта и управление API-ключами (создание, ротация 24h, отзыв).
    - `features/team/team.page.ts` — Управление участниками организации и приглашениями.
    - `features/billing/billing.page.ts` — Управление тарифами, квотами и биллингом.
    - `features/auth/login.page.ts` — Sign in / Sign up экран.
    - `features/docs/docs.page.ts` — Документация и Quickstart Guide.
    - `features/wallboard/wallboard.page.ts` — 1080p TV Showroom режим в теме Cozy Light.
    - `features/mobile/mobile-view.page.ts` — Owner Mobile View PWA с мобильной навигацией.
    - `shared/components/share-embed-modal.component.ts` — модальное окно шеринга и iframe-встраивания.
    - `shared/components/quota-upgrade-modal.component.ts` — модальное окно превышения лимита квоты.
    - Обновлён `TopHeaderComponent` (навигационные ссылки + выпадающее меню пользователя со всеми страницами).
    - Обновлён `app.routes.ts` (зарегистрированы все 15 маршрутов).
- **Тесты и сборка:**
  - `npm --prefix frontend test`: **7/7 PASS**.
  - `npm --prefix frontend run build`: **PASS** (production bundle собран успешно).
  - `JAVA_HOME=/home/antigravity/.local/jdk21 mvn -B test`: **BUILD SUCCESS (38/38 tests PASS)** (включая миграцию V6 и TenantIsolationGuardTest).
- **Следующий шаг:** Проверка UI на локальном сервере / dev-окружении, подключение E2E тестов.

### Сессия #014 — 2026-11-13 (Environment: `cloud-vm`, Branch: `feat/stitch-design`)
- **Автор / Агент:** Antigravity (Cloud)
- **Цель:** Переход на новый дизайн из `docs/design/stitch_requestflowproject`, удаление старого монолитного UI, модульное разделение фронтенда и реализация Шага 1 (Live View + все вариации + шаблоно-зависимая визуализация блоков + привязка к бэкенду).
- **Что сделано:**
  - Создана ветка `feat/stitch-design`.
  - Удалены старые `app.component.html` и `app.component.css`, монолитный `app.component.ts` заменён на тонкую оболочку (`TopHeaderComponent` + `RouterOutlet`).
  - Настроен Tailwind CSS (`tailwind.config.js`, `styles.css`, `index.html` со шрифтами `Inter`, `JetBrains Mono`, `Material Symbols Outlined` и токенами из `design.md`).
  - Создана модульная структура:
    - `core/template-visuals.ts` — профили визуализации блоков для шаблонов (`microservices`, `online-shop`, `queue-worker`, `ai-rag`) и метаданные 4 вариаций экрана Live View (`v1`, `v2`, `v3`, `minimalist`).
    - `core/flow-session.store.ts` — центральный Signal-store с привязкой к Quarkus REST API (`/api/v1/projects`, `/diagram`, `/templates`, `/traces`, `/demo`) и WebSocket (`/ws/v1/projects/{id}/stream`).
    - `shared/components/top-header.component.ts` — адаптивная верхняя панель с переключателем проектов, тем, демо-симулятора и **кнопкой смены темплейта/вариации**.
    - `features/live-view/` (`live-view.page.ts`, `flow-canvas.component.ts`, `node-inspector-drawer.component.ts`, `live-toolbar.component.ts`, `canvas-minimap.component.ts`).
- **Тесты и сборка:**
  - `npm --prefix frontend test` — **7/7 PASS**.
  - `npm --prefix frontend run build` — **PASS** (3.815s).
- **Следующий шаг:** Шаг 2 — экран `Node Details Deep Dive` / `Traces Replay Studio` или следующий выбранный экран из плана.

### Сессия #013 — 2026-11-11 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация **Варианта 3: E-Commerce коннекторы для Live Shop (Gate G1-E / Эпик E20 — No-Code Webhooks & Storefront JS Tracker)**.
- **Что сделано:**
  - **Архитектурный регламент (ADR-0009):**
    - Создан `docs/adr/0009-ecommerce-connectors-and-storefront-tracking.md`: описана архитектура универсального входящего вебхука с динамическим извлечением полей (Shopify, WooCommerce, Stripe, Custom JSON), встроенного легковесного JS-трекера `flowtrace.js` (< 3KB, zero-cookie, anonymous session-scoped ID по DEC-11 / DEC-13), и реестра коннекторов с мониторингом здоровья.
  - **База данных & Flyway Migration (V5):**
    - Создана миграция `backend/src/main/resources/db/migration/V5__connectors.sql`.
    - Добавлена таблица `project_connectors` (`id`, `project_id`, `name`, `connector_type`, `token_prefix`, `token_hash`, `mapping_json`, `status`, `last_event_at`, `total_events`, `last_error`, `created_at`, `updated_at`).
  - **Чистый доменный слой (`dev.flowtrace.domain`):**
    - Чистые Java 21 структуры (0 зависимостей):
      - `ConnectorType.java`: `STOREFRONT_JS`, `GENERIC_WEBHOOK`, `SHOPIFY_WEBHOOK`, `WOOCOMMERCE_WEBHOOK`, `STRIPE_WEBHOOK`.
      - `ConnectorStatus.java`: `WAITING`, `CONNECTED`, `ERROR`.
      - `WebhookMapping.java`: правила сопоставления полей (`traceIdPath`, `nodePath`, `entityRefPath`, `entityNamePath`, `avatarPath`, `itemsPath`, `amountPath`, `currencyPath`) с фабричными пресетами для Shopify, WooCommerce, Stripe и Generic JSON.
      - `ConnectorConfig.java`: конфигурация и статус коннектора.
      - `WebhookPayloadParser.java`: парсер вебхуков, извлекающий покупателей (`EntityInfo`), товары корзины (`CarryItem`), сумму и валюту (`CarryPayload`) и формирующий валидный `CheckpointEvent`.
  - **Порты и JDBC-адаптеры:**
    - Создан порт `ConnectorRepository.java` и адаптер `JdbcConnectorRepository.java` со строгой изоляцией по `project_id` и `token_hash`.
  - **Inbound HTTP REST API (`ConnectorResource.java`):**
    - `GET /api/v1/projects/{projectId}/connectors`: получение списка коннекторов проекта.
    - `POST /api/v1/projects/{projectId}/connectors`: создание коннектора с генерацией одноразового секретного токена `ft_hook_...`.
    - `DELETE /api/v1/projects/{projectId}/connectors/{connectorId}`: удаление коннектора.
    - `POST /api/v1/projects/{projectId}/connectors/{connectorId}/test`: тестирование маппинга на тестовом JSON без сохранения.
    - `POST /api/v1/connectors/webhook/{secretToken}`: публичный шлюз для приёма входящих вебхуков магазинов, преобразующий тело в `CheckpointEvent` и отправляющий в `IngestEventUseCase.ingestForProject(...)`.
    - `GET /flowtrace.js`: отдача сверхлегкого клиентского скрипта отслеживания (отправка через `navigator.sendBeacon` или `fetch keepalive`).
  - **Пользовательский интерфейс Angular (`frontend`):**
    - `models.ts` и `api.service.ts`: модели и API-методы коннекторов.
    - `app.component.html` и `app.component.css`:
      - В разделе **Settings** добавлена полноширинная карточка **E-Commerce Connectors & Storefront Tracking**.
      - Колонка 1: Копирование тега `<script src=".../flowtrace.js" data-api-key="...">` и сниппетов вызова `FlowTrace.track('browse')`, `FlowTrace.track('cart')`, `FlowTrace.track('paid')`.
      - Колонка 2: Форма создания вебхука с пресетами, таблица активных коннекторов со статусом, счетчиком событий, копированием Webhook URL и кнопками тестирования/удаления.
      - Интерактивный тестовый стенд (Test Bench): текстовое поле для вставки примера JSON и моментального предпросмотра сформированного события FlowTrace.
- **Проверенные тесты и сборка:**
  - `dev.flowtrace.domain.WebhookPayloadParserTest`: **PASS (3/3 теста)** — парсинг Shopify order, Stripe charge и fallback при пустом теле.
  - `dev.flowtrace.domain.TenantIsolationGuardTest`: **PASS (3/3 теста)** — 6 JDBC-репозиториев проверены на строгие SQL WHERE-фильтры.
  - `dev.flowtrace.FlowTraceIntegrationTest`: **PASS (4/4 теста)** — HTTP/UDP/TCP инжест, WebSocket live стриминг, изоляция арендаторов и матрица RBAC с мягким удалением организаций.
  - Все тесты проекта (`mvn test`): **BUILD SUCCESS (38/38 тестов зеленые во всех 5 Maven-модулях)**.
  - Сборка фронтенда `npm --prefix frontend run build`: **PASS (0 ошибок, 4.2с)**.
  - Тесты фронтенда `npm --prefix frontend test`: **PASS (7/7 тестов зеленые)**.
- **Следующие шаги:**
  - Запуск стека в Docker (`docker compose up --build`) для сквозного E2E-тестирования или переход к интеграции со Stripe Billing (Gate G1).

### Сессия #012 — 2026-11-11 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация **Варианта 2 (Продуктовый онбординг / Активация пользователей / Gate G1 — Эпик E5)**.
- **Что сделано:**
  - **Архитектурный регламент (ADR-0008):**
    - Создан `docs/adr/0008-onboarding-activation-and-interactive-templates.md`, описывающий интерактивный мастер первого запуска, радар живого обнаружения первого пакета (Time-to-First-Event), интерактивный чек-лист активации и четыре стандартных архитектурных архетипа.
  - **Чистый доменный слой (`dev.flowtrace.domain`):**
    - Расширен `DiagramGraph.java`: добавлены фабричные методы для двух новых архитектурных архетипов:
      - `queueWorkerDiagram()`: асинхронный пайплайн с очередью (`client -> ingest-api -> queue (Kafka/SQS) -> worker -> db / dead-letter-queue`).
      - `aiRagDiagram()`: пайплайн LLM и векторного поиска (`user-prompt -> embedding -> vector-db -> llm-agent -> tool-exec -> response`).
    - Расширен `TemplateDefinition.java`: зарегистрированы 4 встроенных шаблона (`online-shop`, `microservices`, `queue-worker`, `ai-rag`).
  - **Интерактивный мастер онбординга (Onboarding Wizard) в Angular:**
    - Пошаговый модальный визард (`.wizard-modal`):
      - **Шаг 1 (Архитектурный архетип):** Ввод названия проекта и визуальный выбор одного из 4 архетипов с автоматической настройкой узлов, ребер и направленности графа.
      - **Шаг 2 (Сниппеты с активным ключом):** Вкладки языков программирования (`cURL`, `Java SDK`, `Node.js / TS`, `Python`, `Go`) с динамической подстановкой активного Ingest API-ключа, адреса хоста и ключа стартового узла. Кнопка «Copy Snippet» и кнопка моментального pre-flight теста «Send Test Ping».
      - **Шаг 3 (Радар ожидания и празднование):** Анимированный сонар-радар, слушающий WebSocket проекта. При поступлении события фиксируется метрика `Time to First Event (TTFE)` в секундах, запускается анимация победы и переход на живой холст.
    - Кнопка вызова визарда `⚡ Quick Start` в шапке (Topbar), в списке проектов и при пустом состоянии.
  - **Интерактивный виджет чек-листа активации (Activation Checklist Dock):**
    - Компактная плавающая панель в правом нижнем углу (`.activation-checklist-dock`) с прогресс-баром и пятью реактивными вехами:
      1. Выбор архитектурного шаблона (готово при наличии узлов).
      2. Создание Ingest API-ключа (готово при наличии ключей проекта).
      3. Отправка первого события (готово при детекте первого события или ненулевых счетчиках).
      4. Приглашение коллеги (готово при членах команды > 1 или активных инвайтах).
      5. Запуск режима Kiosk / TV mode (готово при активации полноэкранного режима).
    - Сохранение состояния свертывания/скрытия в `localStorage` (`flowtrace_checklist_collapsed`, `flowtrace_checklist_dismissed`).
  - **Стили и UX:**
    - Полная адаптивная верстка модального окна и дока чек-листа в `app.component.css` с соблюдением стандартов контрастности WCAG AA $\ge 4.5:1$ и antislop (0 запрещенных тире).
- **Проверенные тесты и сборка:**
  - `dev.flowtrace.domain.TenantIsolationGuardTest`: **PASS** (3/3 проверки чистой доменной архитектуры и SQL isolation).
  - Все юнит-тесты бэкенда (`mvn test -Dtest=...`): **PASS (19/19 тестов зеленые)**.
  - `npm --prefix frontend test`: **PASS (7/7 тестов AnimationEngine зеленые)**.
  - `npm --prefix frontend run build`: **PASS (0 ошибок, сборка за 4.6с)**.
  - Знания графа обновлены через `graphify update .`.
- **Следующие шаги:**
  - Интеграция со Stripe Billing (Gate G1 / S1: Checkout Sessions, Webhooks, Customer Portal) или масштабирование Fanout через Redis Streams.

### Сессия #011 — 2026-11-11 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация **SaaS Core Milestone (Gate G1): Эпик E4 (Usage Metering & Quotas) + Эпик E2-Step-3 (Advanced API Keys: Scopes, Rotation с Grace-периодом, SHA-256 хэширование IP)**.
- **Что сделано:**
  - **Архитектурное решение (ADR-0007):**
    - Подготовлен `docs/adr/0007-usage-metering-quotas-and-api-keys.md`, фиксирующий бесконкурентный учет потребления трафика на базе Java `LongAdder`, пакетный сброс в PostgreSQL каждые 10 секунд и $O(1)$ проверку квот в оперативной памяти (`monthlyUsageCache`).
  - **База данных & Миграция Flyway (V4):**
    - Создана миграция `backend/src/main/resources/db/migration/V4__usage_counters_and_api_keys.sql`.
    - Добавлена таблица `usage_counters` (`organization_id`, `project_id`, `bucket_date`, `events_count`, `bytes_count`) с составным первичным ключом.
    - В таблицу `api_keys` добавлены колонки `scopes` (default `'ingest'`), `last_ip_hash` (CHAR(64) SHA-256 для соответствия GDPR без хранения сырых IP) и `expires_at` (TIMESTAMPTZ для ротации с grace-периодом).
  - **Чистый доменный слой (`dev.flowtrace.domain`):**
    - Чистые Java 21 структуры (0 зависимостей от Quarkus/Jakarta/Jackson):
      - `UsageBucket.java`: снимок потребления за сутки (date, events, bytes).
      - `ProjectUsage.java`: агрегат потребления проекта за месяц с историей.
      - `OrganizationUsage.java`: агрегат организации с вычислением `percentUsed` и `isQuotaExceeded`.
      - `PlanTier.java`: расширен методом `isSoftQuota()` (Free - жесткий лимит 100k, Pro/Business/Enterprise - мягкий лимит).
      - `ApiKey.java`: добавлены поля `scopes`, `lastIpHash`, `expiresAt`, методы `isActive()`, `hasScope(String)` и обратная совместимость конструкторов.
  - **Порты и адаптеры сохранения (`dev.flowtrace.application.port.out`, `dev.flowtrace.adapter.out.pg`):**
    - Порт `UsageRepository.java` и JDBC-реализация `JdbcUsageRepository.java` (upsert счетчиков пачками, выборка истории за календарный месяц).
    - Расширен `ProjectRepository.java` и `JdbcProjectRepository.java` методами `rotateApiKey(UUID keyId, Duration gracePeriod, ...)` и `updateApiKeyUsage(UUID keyId, String ipHash)`.
  - **Сервисы приложения и Live Path Ingest:**
    - `UsageMeterService.java`: учет в `ConcurrentHashMap<ProjectBucketKey, LongAdderPair>`, фоновый `@Scheduled(every = "10s")` сброс в БД, кеш `monthlyUsageCache` и метод `isIngestAllowed(UUID orgId, PlanTier tier)`.
    - `IngestEventUseCase.java`: проверка скоупов ключа (`hasScope("ingest")`), проверка квот через `UsageMeterService`, фиксация дельт объема данных и учет причин отбрасывания (`insufficient_scope`, `quota_exceeded`).
    - `ProjectService.java`: создание ключей со скоупами и метод `rotateApiKey(...)`.
  - **REST API:**
    - `ProjectManagementResource.java`: поддержка `scopes` в `CreateKeyRequest` и эндпоинт `POST /api/v1/projects/{id}/keys/{keyId}/rotate`.
    - `OrganizationResource.java`: эндпоинт `GET /api/v1/organizations/{id}/usage` для получения статистики потребления за текущий или выбранный месяц.
  - **Пользовательский интерфейс Angular (`frontend`):**
    - `models.ts`: обновлены `ApiKey`, `UsageBucket`, `ProjectUsage`, `OrganizationUsage`, `RotatedApiKeyResult`.
    - `api.service.ts`: добавлены методы `rotateKey(projectId, keyId, gracePeriodHours)` и `getOrganizationUsage(orgId, month)`.
    - `app.component.ts`: сигналы `currentOrgUsage`, `newKeyScopes`, методы `loadOrganizationUsage` и `rotateApiKey`.
    - `app.component.html`:
      - В панели **Org & Team** добавлена карточка **Usage Metering & Monthly Quota** с прогресс-баром потребления, статусом квоты (Ok, Near Limit, Quota Exceeded), типом лимита (Hard vs Soft) и разбивкой по активным проектам.
      - В разделе **Ingest API Keys** добавлен селектор скоупов (`ingest`, `read:traces,ingest`, `*`), бейджи скоупов в таблице ключей, отображение статуса Grace-периода и кнопка `Rotate (24h)`.
    - `app.component.css`: стили `.usage-metering-card`, `.quota-bar-track`, `.quota-bar-fill`, `.quota-status-badge`, `.key-scope-chip` с поддержкой WCAG AA.
- **Проверенные тесты и сборка:**
  - `dev.flowtrace.domain.ApiKeyTest`: **PASS** (проверка скоупов, активности, ротации и истечения срока).
  - `dev.flowtrace.application.UsageMeterServiceTest`: **PASS** (проверка атомарного накопления, сброса в БД и блокировки Free-плана при превышении 100k событий).
  - `dev.flowtrace.domain.TenantIsolationGuardTest`: **PASS** (проверка 5 JDBC-репозиториев на обязательные tenant WHERE-фильтры и SHA-256 токены).
  - `dev.flowtrace.domain.CarryStateTest`: **PASS** (6/6 тестов).
  - `dev.flowtrace.domain.OrgRoleTest`: **PASS** (6/6 тестов).
  - Все юнит-тесты бэкенда (`mvn test -Dtest=...`): **PASS (19/19 тестов зеленые)**.
  - Сборка фронтенда `npm --prefix frontend run build`: **PASS (0 ошибок)**.
  - Тесты фронтенда `npm --prefix frontend test`: **PASS (7/7 тестов зеленые)**.
- **Следующие шаги:**
  - Переход к **Gate G1: Stripe Billing & Subscriptions (Epic E2-Step-1..E2-Step-4)** или масштабированию фанаута через **Redis Streams (Epic E3)**.

### Сессия #010 — 2026-11-10 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Завершение работ по **Gate G1-S: Витрина «Live Shop» (Business Flows)**. Реализация **Эпиков E19 / E17-05 (Рендерер токенов-покупателей с корзинами + тема Cozy Light)** и **Эпиков E21 / E22 / E25 (Live Counters Strip, TV / Kiosk Mode, страница `/demo/shop`)**.
- **Что сделано:**
  - **Рендерер токенов и корзин (E17-05 & E19):**
    - В [`frontend/src/app/core/animation-engine.ts`](../frontend/src/app/core/animation-engine.ts) расширена модель `ActiveToken` (`entity`, `carry`, `avatarIcon`, `carriedIcons`).
    - Реализованы методы `resolveAvatarIcon` (маппинг эмодзи и аватаров: cat, fox, bear, dog, rabbit, shopper, developer, artist) и `extractCarriedIcons` (преобразование идентификаторов товаров в пиктограммы).
    - Добавлены обработчики `enqueueCarry`, `enqueueComplete`, `enqueueFail`, `enqueueAbandon`, `onCrowd` с плавной анимацией терминальных состояний (золотая вспышка прибытия, вибрация ошибки, затухание отказа).
    - В SVG-холсте ([`app.component.html`](../frontend/src/app/app.component.html)) добавлены бейджи `.entity-avatar-badge` и `.entity-carry-badge` с отображением счетчика товаров корзины и шлейфом миниатюрных иконок товаров (`.carried-item-tag`), следующих по кривой Безье.
    - В [`styles.css`](../frontend/src/styles.css) добавлена теплая бутик-палитра `[data-theme="cozy-light"]` с контрастом WCAG AA $\ge 4.5:1$ на всех парах цветов.
  - **Полоса живых счетчиков Live Counters Strip (E21-01 / E21-02):**
    - В [`app.component.ts`](../frontend/src/app/app.component.ts) добавлены сигналы и вычисляемые метрики: `liveVisitorsCount`, `activeCartsCount`, `ordersCompletedCount`, `revenueToday` (€), `conversionRate` (%).
    - Добавлена микро-анимация золотого импульса (`pulse-flash`) при оплате каждого заказа в реальном времени.
    - В интерфейсе ([`app.component.html`](../frontend/src/app/app.component.html) и [`app.component.css`](../frontend/src/app/app.component.css)) реализована закрепленная панель `.live-counters-strip` со стеклянным фоном и четкой типографикой.
  - **Режим Kiosk / TV Mode (E22-01):**
    - Реализован полноэкранный режим Kiosk: скрываются шапка, боковые панели, палитра и второстепенные контролы; холст разворачивается на весь экран (`100vw x 100vh`).
    - Полоса счетчиков переходит в режим `.tv-counters` с крупным шрифтом (26–28px), читаемым с расстояния 3+ метров.
    - Интегрирован Screen WakeLock API (`navigator.wakeLock.request('screen')`) для предотвращения засыпания экранов и телевизоров в витринах.
    - Добавлена плавающая кнопка выхода и обработка клавиши Escape / события `fullscreenchange`.
  - **Публичная витрина демо-магазина `/demo/shop` и клиентский симулятор (E25-01):**
    - Автоматическое определение маршрута `/demo/shop` и query-параметра `?demo=shop` при инициализации.
    - При включении демо-режима автоматически выставляется шаблон `online-shop`, включается тема `Cozy Light` и активируется генерация живого потока.
    - В клиентский fallback-симулятор (`emitSyntheticCommerceTrace`) добавлена генерация реалистичных покупателей четырех типов (`buyer`, `abandoner`, `browser`, `hesitant`) со случайными именами, аватарами, товарами и ценами из каталога, позволяющая запускать витрину даже в автономном офлайн-режиме без бэкенда.
    - В тулбар добавлен выпадающий переключатель шаблонов диаграмм (`Online Shop` и `Microservices Mesh`).
- **Проверенные тесты:**
  - `cd frontend && npm test`: **PASS (7/7 тестов зеленые)**, включая новые юнит-тесты на рендеринг аватаров, обновление корзины и бизнес-исходы.
  - Исправлены пропущенные импорты в [`app.component.ts`](../frontend/src/app/app.component.ts) (`TemplateDefinition`, `EntityInfo`, `CarrySummary`) для сборки Angular (`ng build` в Docker).
  - В [`ProjectService.java`](../backend/src/main/java/dev/flowtrace/application/ProjectService.java) добавлен метод `saveDiagramVersion(UUID projectId, DiagramGraph graph, String userIdHeader, String userEmailHeader)` для обслуживания эндпоинта `TemplateResource` при применении шаблонов.
  - Компиляция чистых Java 21 доменных классов `dev.flowtrace.domain`: **PASS (0 ошибок)**.
  - Компиляция всех Java-классов бэкенда и тестов: **PASS (0 ошибок)**.
  - `CarryStateTest`: **PASS (0 ошибок компиляции с junit-jupiter-api)**.
  - Проверка antislop: 0 запрещенных тире (`—`) в UI-копирайтинге и коде, соблюдение контраста WCAG AA.
- **Следующие шаги:**
  - Переход к следующему блоку дорожной карты SaaS: **Scale & Ecosystem (S2)** или **Gate G1-E: Интеграция с реальным интернет-магазином через Webhook (Shopify/WooCommerce)**.

### Сессия #009 — 2026-11-10 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Старт работ над **Gate G1-S: Витрина «Live Shop» (Business Flows)**. Реализация **Эпика E17 (Core Engine): `E17-Step-1` .. `E17-Step-3`** — архитектурное решение ADR-0006, расширение протокола до v1.1 (`entity` и `carry`), создание чистых доменных моделей в `dev.flowtrace.domain`, поддержка операций с корзиной (`set`, `add`, `remove`, `clear`) в `HopResolver`, новые типы UI-событий (`CarryEvent`, `CompleteEvent`, `FailEvent`, `AbandonEvent`, `CrowdEvent`) и unit-тестирование.
- **Что сделано:**
  - Создан [`docs/adr/0006-business-flows-and-live-shop.md`](./adr/0006-business-flows-and-live-shop.md) (архитектурное решение по Live Shop, сущностям покупателей, серверному хранению корзины и сохранению 100% обратной совместимости с клиентами v1.0).
  - Обновлены [`docs/PROTOCOL.md`](./PROTOCOL.md) и [`docs/event.schema.json`](./event.schema.json) с описанием полей `"entity"`, `"carry"`, а также новых терминальных статусов `complete`, `fail`, `abandon`.
  - В чистом доменном слое `dev.flowtrace.domain` (Java 21, 0 фреймворк-зависимостей) созданы:
    - [`EntityInfo.java`](../backend/src/main/java/dev/flowtrace/domain/EntityInfo.java): персона клиента/покупателя (`kind`, `ref`, `label`, `avatar`).
    - [`CarryOp.java`](../backend/src/main/java/dev/flowtrace/domain/CarryOp.java): перечисление операций `set`, `add`, `remove`, `clear`.
    - [`CarryItem.java`](../backend/src/main/java/dev/flowtrace/domain/CarryItem.java): единичный переносимый товар (`sku`, `label`, `icon`, `image`, `qty`, `price`, `currency`).
    - [`CarryPayload.java`](../backend/src/main/java/dev/flowtrace/domain/CarryPayload.java): полезная нагрузка с валидацией лимита $\le 20$ товаров за событие.
    - [`CarrySummary.java`](../backend/src/main/java/dev/flowtrace/domain/CarrySummary.java): сводка активной корзины для UI (`count`, `total`, `currency`, `topIcons`).
    - Обновлён [`EventType.java`](../backend/src/main/java/dev/flowtrace/domain/EventType.java): добавлены `complete`, `fail`, `abandon` и метод `isTerminal()`.
    - Обновлён [`CheckpointEvent.java`](../backend/src/main/java/dev/flowtrace/domain/CheckpointEvent.java): валидация и парсинг `entity` и `carry`.
    - Обновлён [`HopResolver.java`](../backend/src/main/java/dev/flowtrace/domain/HopResolver.java): хранение состояния корзины внутри `TraceStateEntry`, применение операций `set/add/remove/clear`, лимит $\le 50$ товаров на трейс, автоматическое сохранение сущности покупателя на всех хопах трейса, эмиссия `UiEvent.CarryEvent`, `UiEvent.CompleteEvent`, `UiEvent.FailEvent`, `UiEvent.AbandonEvent`.
    - Обновлён [`UiEvent.java`](../backend/src/main/java/dev/flowtrace/domain/UiEvent.java): передача `EntityInfo` и `CarrySummary` в `SpawnEvent` и `HopEvent`, включение активных сущностей в `SnapshotEvent`, новые типы событий `CarryEvent`, `CompleteEvent`, `FailEvent`, `AbandonEvent`, `CrowdEvent`.
  - Обновлены парсеры инжеста во всех адаптерах:
    - [`IngestEventUseCase.java`](../backend/src/main/java/dev/flowtrace/application/IngestEventUseCase.java) (`RawEventInput` дополнен `entity` и `carry`).
    - [`IngestHttpResource.java`](../backend/src/main/java/dev/flowtrace/adapter/in/http/IngestHttpResource.java) (HTTP парсер).
    - [`UdpIngestServer.java`](../backend/src/main/java/dev/flowtrace/adapter/in/udp/UdpIngestServer.java) (UDP парсер).
    - [`TcpIngestServer.java`](../backend/src/main/java/dev/flowtrace/adapter/in/tcp/TcpIngestServer.java) (TCP парсер).
    - [`JdbcTraceRepository.java`](../backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcTraceRepository.java) (корректная фиксация статуса трейсов при бизнес-завершении `complete`, `fail`, `abandon`).
  - Во фронтенде ([`frontend/src/app/core/models.ts`](../frontend/src/app/core/models.ts)) добавлены интерфейсы `EntityInfo`, `CarryItem`, `CarryOp`, `CarrySummary`, `CarryEvent`, `CompleteEvent`, `FailEvent`, `AbandonEvent`, `CrowdEvent` и расширен union `UiStreamEvent`.
  - Создан тестовый класс [`CarryStateTest.java`](../backend/src/test/java/dev/flowtrace/domain/CarryStateTest.java):
    - Валидация длин полей `EntityInfo`.
    - Валидация цен, количеств и обязательного `sku` в `CarryItem`.
    - Проверка лимита $\le 20$ товаров в `CarryPayload`.
    - Проверка семантики `EventType` (`complete`, `fail`, `abandon`, `isTerminal`).
    - Полный жизненный цикл корзины в `HopResolver` (`spawn` -> `carry.add` -> `in-place carry.add` -> `carry.remove` -> `complete` с итоговой суммой и иконками).
    - Проверка лимита 50 уникальных товаров на трейс.
  - **E18 (Шаблон Online Shop и симулятор бизнес-сценариев):**
    - В доменном слое создан [`TemplateDefinition.java`](../backend/src/main/java/dev/flowtrace/domain/TemplateDefinition.java) с реестром встроенных шаблонов (`online-shop` и `microservices`).
    - В [`DiagramGraph.java`](../backend/src/main/java/dev/flowtrace/domain/DiagramGraph.java) добавлен эталонный граф `onlineShopDiagram()` (9 узлов `visit`, `browse`, `product`, `cart`, `checkout`, `payment`, `paid`, `payment-failed`, `abandoned` и 11 связей, направление `LR`).
    - [`DemoSimulator.java`](../backend/src/main/java/dev/flowtrace/application/DemoSimulator.java) расширен коммерческим движком сценариев: автоматическое распознавание `isCommerceGraph`, генерация персон покупателей (`buyer`, `abandoner`, `browser`, `hesitant`) с реалистичным каталогом товаров (`DEMO_CATALOG`), случайными аватарами (`DEMO_AVATARS`), добавлением/удалением товаров в корзину и терминальными исходами (`complete`, `fail`, `abandon`).
    - В [`DataSeeder.java`](../backend/src/main/java/dev/flowtrace/app/DataSeeder.java) дефолтный проект `E-Commerce Checkout Flow` переведён на `onlineShopDiagram()`.
    - Добавлен REST-адаптер [`TemplateResource.java`](../backend/src/main/java/dev/flowtrace/adapter/in/http/TemplateResource.java) с эндпоинтами `GET /api/v1/templates` и `POST /api/v1/projects/{projectId}/template/{templateId}`.
    - Во фронтенде (`models.ts` и `api.service.ts`) добавлены интерфейс `TemplateDefinition` и методы `listTemplates` / `applyTemplate`.
    - Создан тестовый класс [`DemoSimulatorCommerceTest.java`](../backend/src/test/java/dev/flowtrace/application/DemoSimulatorCommerceTest.java) с проверкой генерации всех персон, шагов и наличия цен/валют в корзине.
- **Проверенные тесты:**
  - `javac --release 21` (все классы `dev.flowtrace.domain`): **PASS (0 ошибок)**.
  - `TenantIsolationGuardTest` (0 фреймворк-импортов в `domain`): **PASS**.
  - `CarryStateTest` (все 6 тестов жизненного цикла корзины): **PASS**.
  - `DemoSimulatorCommerceTest` (все тесты симуляции коммерческих персон и шаблонов): **PASS**.
  - `cd frontend && npm test`: **PASS (5/5 тестов зеленые)**.
- **Следующие шаги:**
  - `E17-Step-5` & `E19`: рендерер токенов-покупателей с корзинами на Angular Canvas и тема *Cozy Light*.
  - `E21 & E22 & E25`: полоса живых бизнес-метрик (выручка/конверсия) + TV-режим + `/demo/shop`.

---

### Сессия #008 — 2026-11-10 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Доведение до конца оставшихся атомарных шагов **Epic E1 (`E1-Step-5` .. `E1-Step-8`)**: хранение SHA-256 `token_hash` для приглашений и кнопка `Resend`, 30-дневный soft-delete организации (`deleted_at`) с блокировкой инжеста и восстановлением, автоматический предохранитель изоляции тенантов (`TenantIsolationGuardTest`), а также таблица, сервис, REST API и UI журнала аудита (`audit_log`).
- **Что сделано:**
  - Обновлён [`docs/adr/0005-organizations-workspaces-and-rbac.md`](./adr/0005-organizations-workspaces-and-rbac.md) разделами по `E1-Step-5`..`E1-Step-8`.
  - **E1-Step-5 (Хеширование токенов приглашений и Resend):**
    - Добавлена миграция [`V3__audit_log.sql`](../backend/src/main/resources/db/migration/V3__audit_log.sql) с колонками `invitations.token_prefix` и `invitations.token_hash` (SHA-256). В БД больше не сохраняется открытый токен приглашения; полный токен `ft_inv_<32 chars>` возвращается вызывающему только один раз при создании или повторной отправке (`Invitation.withOneTimeToken`).
    - Реализован метод `OrganizationService.resendInvitation` и эндпоинт `POST /api/v1/organizations/{orgId}/invitations/{invitationId}/resend` + кнопка `Resend` в Angular-таблице приглашений.
  - **E1-Step-6 (Soft Delete организации на 30 дней):**
    - Добавлена колонка `organizations.deleted_at` (`TIMESTAMPTZ`).
    - В `OrganizationService` реализованы `deleteOrganization` (мягкое удаление для `OWNER`), `restoreOrganization` (`POST /api/v1/organizations/{orgId}/restore`) и планировщик `purgeExpiredSoftDeletedOrganizations` (`@Scheduled(every = "6h")`).
    - В `IngestEventUseCase` добавлена неблокирующая проверка `isProjectOrganizationDeleted` с кэшем `orgDeletedCache`: при мягком удалении организации входящие пакеты HTTP/UDP/TCP немедленно отклоняются с причиной `org_deleted`.
    - В UI `Org & Team` добавлен блок `Soft-Delete Organization (30-Day Recovery)` и баннер восстановления для удалённых организаций.
  - **E1-Step-7 (Автоматический тест-предохранитель изоляции тенантов):**
    - Добавлен [`TenantIsolationGuardTest.java`](../backend/src/test/java/dev/flowtrace/domain/TenantIsolationGuardTest.java), проверяющий чистоту пакета `dev.flowtrace.domain` и наличие явного `WHERE`-скоупинга во всех 47 SQL-запросах репозиториев (`JdbcAuditLogRepository`, `JdbcOrganizationRepository`, `JdbcProjectRepository`, `JdbcTraceRepository`).
    - Расширен [`FlowTraceIntegrationTest.java`](../backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java) проверками `E1-Step-5`..`E1-Step-8` и кросс-тенантной защитой (HTTP 403).
  - **E1-Step-8 (Таблица, сервис, REST API и UI `audit_log`):**
    - Созданы доменная запись [`AuditLogEntry.java`](../backend/src/main/java/dev/flowtrace/domain/AuditLogEntry.java), порт [`AuditLogRepository.java`](../backend/src/main/java/dev/flowtrace/application/port/out/AuditLogRepository.java) и JDBC-адаптер [`JdbcAuditLogRepository.java`](../backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcAuditLogRepository.java).
    - Запись событий аудита интегрирована во все мутации `OrganizationService` и `ProjectService` (`org.*`, `workspace.*`, `member.*`, `invitation.*`, `project.*`, `apikey.*`, `diagram.*`).
    - Добавлен эндпоинт `GET /api/v1/organizations/{orgId}/audit-logs` и карточка `Organization Audit Log` на экране `Org & Team` с фильтром по категориям, поиском и состояниями Loading/Empty/Error.
- **Затронутые файлы:**
  - `docs/adr/0005-organizations-workspaces-and-rbac.md`
  - `backend/src/main/resources/db/migration/V2__organizations_workspaces_rbac.sql`
  - `backend/src/main/resources/db/migration/V3__audit_log.sql`
  - `backend/src/main/java/dev/flowtrace/domain/ApiKeyCrypto.java`
  - `backend/src/main/java/dev/flowtrace/domain/AuditLogEntry.java`
  - `backend/src/main/java/dev/flowtrace/domain/Invitation.java`
  - `backend/src/main/java/dev/flowtrace/domain/Organization.java`
  - `backend/src/main/java/dev/flowtrace/application/port/out/AuditLogRepository.java`
  - `backend/src/main/java/dev/flowtrace/application/port/out/OrganizationRepository.java`
  - `backend/src/main/java/dev/flowtrace/application/IngestEventUseCase.java`
  - `backend/src/main/java/dev/flowtrace/application/OrganizationService.java`
  - `backend/src/main/java/dev/flowtrace/application/ProjectService.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcAuditLogRepository.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcOrganizationRepository.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/JdbcProjectRepository.java`
  - `backend/src/main/java/dev/flowtrace/adapter/in/http/OrganizationResource.java`
  - `backend/src/test/java/dev/flowtrace/domain/TenantIsolationGuardTest.java`
  - `backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java`
  - `frontend/src/app/core/models.ts`
  - `frontend/src/app/core/api.service.ts`
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/app.component.html`
  - `frontend/src/app/app.component.css`
  - `docs/SAAS_ROADMAP.md`
  - `docs/PROGRESS.md`
  - `docs/WORKLOG.md`
  - **E18 (Шаблон Online Shop и симулятор бизнес-сценариев):**
    - В доменном слое создан [`TemplateDefinition.java`](../backend/src/main/java/dev/flowtrace/domain/TemplateDefinition.java) с реестром встроенных шаблонов (`online-shop` и `microservices`).
    - В [`DiagramGraph.java`](../backend/src/main/java/dev/flowtrace/domain/DiagramGraph.java) добавлен эталонный граф `onlineShopDiagram()` (9 узлов `visit`, `browse`, `product`, `cart`, `checkout`, `payment`, `paid`, `payment-failed`, `abandoned` и 11 связей, направление `LR`).
    - [`DemoSimulator.java`](../backend/src/main/java/dev/flowtrace/application/DemoSimulator.java) расширен коммерческим движком сценариев: автоматическое распознавание `isCommerceGraph`, генерация персон покупателей (`buyer`, `abandoner`, `browser`, `hesitant`) с реалистичным каталогом товаров (`DEMO_CATALOG`), случайными аватарами (`DEMO_AVATARS`), добавлением/удалением товаров в корзину и терминальными исходами (`complete`, `fail`, `abandon`).
    - В [`DataSeeder.java`](../backend/src/main/java/dev/flowtrace/app/DataSeeder.java) дефолтный проект `E-Commerce Checkout Flow` переведён на `onlineShopDiagram()`.
    - Добавлен REST-адаптер [`TemplateResource.java`](../backend/src/main/java/dev/flowtrace/adapter/in/http/TemplateResource.java) с эндпоинтами `GET /api/v1/templates` и `POST /api/v1/projects/{projectId}/template/{templateId}`.
    - Во фронтенде (`models.ts` и `api.service.ts`) добавлены интерфейс `TemplateDefinition` и методы `listTemplates` / `applyTemplate`.
    - Создан тестовый класс [`DemoSimulatorCommerceTest.java`](../backend/src/test/java/dev/flowtrace/application/DemoSimulatorCommerceTest.java) с проверкой генерации всех персон, шагов и наличия цен/валют в корзине.
- **Проверенные тесты:**
  - `javac --release 21` (все 43 класса `backend/src/main/java`): **PASS (0 ошибок)**.
  - `TenantIsolationGuardTest` (проверка 0 фреймворк-импортов в `domain` + проверка всех 47 SQL-запросов в 4 JDBC-репозиториях): **PASS**.
  - `cd frontend && npm test && npm run build`: **PASS** (4/4 теста `AnimationEngine`, production bundle собран без ошибок).
  - `contrast-check.py` (WCAG AA на всех текстовых/фоновых парах): **PASS**.
- **Следующие шаги:**
  - Завершить оставшиеся шаги **Эпика E0 (`E0-Step-2` .. `E0-Step-6`)** или перейти к **Эпику E2 (`E2-Step-1` .. `E2-Step-7`)**.

---

### Сессия #007 — 2026-11-10 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Исправление ошибки компиляции `ProjectService.java` (effectively final переменная в лямбде) и консолидация трёх документов планирования (`docs/SAAS_ROADMAP.md`, `docs/TASKS.md`, `docs/TASKS_v2.md`) в единый дедуплицированный пошаговый роадмап с разбивкой каждого эпика на небольшие атомарные задачи.
- **Что сделано:**
  - В [`ProjectService.java`](../backend/src/main/java/dev/flowtrace/application/ProjectService.java) переменные `targetOrgId` и `targetWsId` сделаны `final UUID` с однократной инициализацией.
  - Проведён полный сравнительный анализ `SAAS_ROADMAP.md`, `TASKS.md` (v1) и `TASKS_v2.md` (v2 Business Flows / Live Shop).
  - Сформирован обновлённый [`docs/SAAS_ROADMAP.md`](./SAAS_ROADMAP.md) с:
    1. Таблицей полной и частичной дедупликации задач.
    2. Перечнем уникальных задач из `TASKS.md` (E0, E2, E5, E8, E10, E11, E13, E14, E15), `TASKS_v2.md` (E17–E25: `entity` + `carry`, шаблоны бизнеса, `/demo/shop`, `TV Mode`, `flowtrace.js`, JSONPath Webhook UI, `PII Guard v2`) и `SAAS_ROADMAP.md` (`Workspaces`, `BILLING_ADMIN`, `Trace Diff`, `Incident View`).
    3. Декомпозицией каждого эпика на небольшие атомарные шаги (`E0-Step-1` .. `E25-Step-1`) по 1–3 часа работы.
- **Затронутые файлы:**
  - `backend/src/main/java/dev/flowtrace/application/ProjectService.java`
  - `docs/SAAS_ROADMAP.md`
  - `docs/WORKLOG.md`

---

### Сессия #006 — 2026-11-09 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация **Epic 1 (Организации, воркспейсы и ролевая модель RBAC, `TASK-1.1` – `TASK-1.4`)** из [`docs/SAAS_ROADMAP.md`](./SAAS_ROADMAP.md).
- **Что сделано:**
  - Зафиксирован [`docs/adr/0005-organizations-workspaces-and-rbac.md`](./adr/0005-organizations-workspaces-and-rbac.md).
  - **TASK-1.1 (Схема БД и миграция):**
    - Добавлена миграция [`backend/src/main/resources/db/migration/V2__organizations_workspaces_rbac.sql`](../backend/src/main/resources/db/migration/V2__organizations_workspaces_rbac.sql) (`organizations`, `organization_members`, `workspaces`, `invitations`, привязка `projects.organization_id` и `projects.workspace_id`).
    - Реализовано автоматическое создание персональной организации и дефолтного воркспейса `Production` при первом входе пользователя (`ensurePersonalOrganization`) с автоматической привязкой существующих проектов.
  - **TASK-1.2 (RBAC Engine):**
    - Созданы чистые доменные классы Java 21 (`OrgRole`, `OrgPermission`, `PlanTier`, `Organization`, `OrganizationMember`, `Workspace`, `Invitation`) в `dev.flowtrace.domain`.
    - Матрица прав (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`, `BILLING_ADMIN`) интегрирована в `OrganizationService` и `ProjectService` (включая запрет редактирования диаграмм и создания ключей для `VIEWER`, а также запрет чтения трейсов/графов для `BILLING_ADMIN`).
  - **TASK-1.3 (Сервис приглашений и онбординга):**
    - Генерация токенов приглашения `ft_inv_<uuid>` с TTL 7 дней, порт `InvitationNotifier` и адаптер `LoggingInvitationNotifier`, эндпоинт принятия приглашения `POST /api/v1/organizations/invitations/accept`.
  - **TASK-1.4 (UI управления организацией и командой в Angular):**
    - В хедере (`topbar`) добавлен переключатель контекста `Organization / Workspace` и бейдж текущей роли пользователя.
    - Добавлен экран **`Org & Team`**: таблица участников с переключением ролей, форма отправки приглашений с 7-дневным токеном, принятие приглашения по токену, управление воркспейсами (создание, переименование, удаление), настройки тарифа организации и передача владения (`Transfer Ownership`).
  - Добавлены unit-тесты [`OrgRoleTest.java`](../backend/src/test/java/dev/flowtrace/domain/OrgRoleTest.java) и интеграционный сценарий `epic1OrganizationsWorkspacesInvitationsAndRbacMatrixWorkEndToEnd` в [`FlowTraceIntegrationTest.java`](../backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java).
- **Затронутые файлы:**
  - `docs/adr/0005-organizations-workspaces-and-rbac.md`
  - `backend/src/main/resources/db/migration/V2__organizations_workspaces_rbac.sql`
  - `backend/src/main/java/dev/flowtrace/domain/{Organization,OrganizationMember,Workspace,Invitation,OrgRole,OrgPermission,PlanTier,Project}.java`
  - `backend/src/main/java/dev/flowtrace/application/port/out/{OrganizationRepository,InvitationNotifier,ProjectRepository}.java`
  - `backend/src/main/java/dev/flowtrace/application/{OrganizationService,ProjectService}.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/pg/{JdbcOrganizationRepository,JdbcProjectRepository}.java`
  - `backend/src/main/java/dev/flowtrace/adapter/out/mail/LoggingInvitationNotifier.java`
  - `backend/src/main/java/dev/flowtrace/adapter/in/http/{OrganizationResource,ProjectManagementResource}.java`
  - `backend/src/main/java/dev/flowtrace/app/DataSeeder.java`
  - `backend/src/test/java/dev/flowtrace/domain/OrgRoleTest.java`
  - `backend/src/test/java/dev/flowtrace/FlowTraceIntegrationTest.java`
  - `frontend/src/app/core/{models.ts,api.service.ts}`
  - `frontend/src/app/{app.component.ts,app.component.html,app.component.css}`
  - `docs/SAAS_ROADMAP.md`, `docs/PROGRESS.md`, `docs/WORKLOG.md`

---

### Сессия #005 — 2026-11-09 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Реализация 5 вариантов визуального перехода запросов от ноды к ноде на Live Canvas и нового дизайна создания нод и архитектурных блоков (`Blueprint Studio` + `Blueprint Module` карточки) без удаления текущей реализации.
- **Что сделано:**
  - В [`frontend/src/app/core/models.ts`](../frontend/src/app/core/models.ts) добавлены типы `HopVisualStyle` (`comet | laser-conduit | packet-capsule | sonar-wave | circuit-frame`) и `NodeVisualStyle` (`classic | blueprint`).
  - В [`frontend/src/app/core/animation-engine.ts`](../frontend/src/app/core/animation-engine.ts) добавлен расчёт касательного угла кривой Безье (`angleDeg`), `shortTag`, точек входа/выхода (`sourcePoint`, `targetPoint`) и динамических габаритов карточек (`176×64` Classic vs `204×86` Blueprint Module).
  - В [`frontend/src/app/app.component.ts`](../frontend/src/app/app.component.ts) и [`frontend/src/app/app.component.html`](../frontend/src/app/app.component.html) реализованы:
    1. **5 вариантов визуального перехода запросов (`Hop Transition`):**
       - `Classic Comet` (сохранённая оригинальная реализация)
       - `Laser Conduit` (сфокусированный световой импульс по ребру с векторным наконечником)
       - `Packet Capsule` (ориентированная по касательной капсула запроса с `traceId` и индикатором статуса)
       - `Sonar Wave` (расширяющиеся концентрические кольца телеметрии с волновым фронтом)
       - `Circuit Frame` (ромбовидный аппаратный фрейм с прицельными рисками и контуром на приёмной ноде)
    2. **Новый дизайн создания нод и блоков (`Blueprint Studio`):**
       - Вкладка `1. Node Composer`: выбор архетипа, авто-генерация `nodeKey`, предпросмотр карточки и мгновенная привязка входящих/исходящих связей (`Upstream` / `Downstream`).
       - Вкладка `2. Block Blueprints`: вставка готовых многоузловых архитектурных блоков в 1 клик (`Cache-Aside Read Block`, `Async Queue + Worker + DLQ`, `Canary Traffic Router`, `External API Egress Guard`).
       - Вкладка `3. Quick & Discovered`: быстрые пресеты и авто-обнаруженные ноды.
       - Кнопка `+` прямо на выбранной ноде на холсте для мгновенного создания дочернего связанного узла.
    3. **Сохранение обратной совместимости:** оригинальная палитра (`Classic Palette`), карточка (`Classic Card`) и анимация (`Classic Comet`) полностью сохранены и переключаются в реальном времени на панели `Hop Transition` / `Node Block` / `Block Builder`.
- **Затронутые файлы:**
  - `frontend/src/app/core/models.ts`
  - `frontend/src/app/core/animation-engine.ts`
  - `frontend/src/app/core/animation-engine.spec.ts`
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/app.component.html`
  - `frontend/src/app/app.component.css`
  - `frontend/src/styles.css`
  - `frontend/src/index.html`
  - `docs/WORKLOG.md`
- **Проверка и тесты:**
  - `node --test frontend/src/app/core/animation-engine.spec.ts` — **PASS (5/5)**.
  - Проверка контрастности `contrast-check.py` — **PASS** (все текстовые пары >= 4.5:1 WCAG AA).

---

### Сессия #004 — 2026-11-09 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Формирование комплексного плана и детального бэклога задач для трансформации FlowTrace MVP в полноценный B2B SaaS-продукт.
- **Что сделано:**
  - Разработан и зафиксирован детальный документ [`docs/SAAS_ROADMAP.md`](./SAAS_ROADMAP.md), охватывающий 9 эпиков:
    1. Организации, воркспейсы и ролевая модель доступа (RBAC).
    2. Биллинг, тарифы (Stripe Checkout / Customer Portal / Metered Billing) и Quota Guard.
    3. Распределённый кластер (Redis Fanout, распределённый кэш `TraceState`, distributed rate limiting, AWS multi-task ECS).
    4. Нативный приём OpenTelemetry (OTLP HTTP/gRPC), мультиязычные SDK (Node.js, Python, Go), встраиваемые `<iframe>` виджеты.
    5. Алертинг, выявление аномалий и интеграции (Slack, PagerDuty, Webhooks).
    6. Партиционирование PostgreSQL (`pg_partman`) и холодный архив в S3 (Parquet).
    7. Корпоративная безопасность (SAML SSO, SCIM, PII-маскирование, Audit Trail).
    8. Продвинутый Canvas (мульти-диаграммы, группы сервисов, Trace Diff сравнение, темы, экспорт).
    9. Production DevOps (Blue/Green деплойменты, Status Page, расширенный мониторинг).
  - Сформированы фазы реализации: **S1 (Commercial Foundations)**, **S2 (Ecosystem & Observability)**, **S3 (Enterprise Ready)** с критериями Definition of Done (DoD).
  - Обновлён [`docs/PROGRESS.md`](./PROGRESS.md) со ссылкой на следующий цикл разработки.
- **Затронутые файлы:**
  - `docs/SAAS_ROADMAP.md`
  - `docs/PROGRESS.md`
  - `docs/WORKLOG.md`
- **Следующие шаги:**
  - Согласовать приоритеты первой фазы (S1) и приступить к реализации `TASK-1.1` (схема организаций и воркспейсов в PostgreSQL).

---

### Сессия #003 — 2026-11-08 (Environment: `local`)
- **Автор / Агент:** Antigravity (Local)
- **Цель:** Устранение ошибки запуска бэкенда в Docker Compose (`Driver does not support the provided URL: jdbc:postgresql://postgres:5432/flowtrace`).
- **Причина проблемы:** В `application.properties` параметр `quarkus.datasource.db-kind` был зафиксирован как `h2`. В Quarkus тип драйвера datasource фиксируется во время сборки (build-time). При старте в Docker передавался URL `jdbc:postgresql://...`, но Agroal пытался подключиться через драйвер H2, что приводило к `java.sql.SQLException` и завершению работы контейнера `flowtrace-backend` с кодом 1.
- **Что сделано:**
  - В [`backend/src/main/resources/application.properties`](../backend/src/main/resources/application.properties) изменён базовый `db-kind` на `postgresql`, добавлен `quarkus.http.host=0.0.0.0`, а `h2` вынесен в профиль `%test`.
  - В [`docker-compose.yml`](../docker-compose.yml) явно прописана переменная `QUARKUS_DATASOURCE_DB_KIND: postgresql`.
  - В [`backend/Dockerfile`](../backend/Dockerfile) обновлён `ENTRYPOINT`, чтобы корректно применялись параметры из `JAVA_OPTS`.
- **Затронутые файлы:**
  - `backend/src/main/resources/application.properties`
  - `docker-compose.yml`
  - `backend/Dockerfile`
  - `docs/WORKLOG.md`
- **Как проверить локально:**
  - Выполнить `docker compose up --build` и проверить доступность `http://localhost:8080/q/health` и `http://localhost:8080/q/openapi`.

---

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
