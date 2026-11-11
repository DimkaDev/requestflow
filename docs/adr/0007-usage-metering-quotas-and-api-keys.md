# ADR-0007: Неблокирующий учёт потребления, квоты тарифных планов и ротация API-ключей

## Статус
Принято (Accepted)

## Контекст
Платформа FlowTrace переходит на мульти-тенантную модель SaaS (Gate G1). Каждая организация относится к определенному тарифному плану (`FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`), имеющему ежемесячный лимит событий (`PlanTier.monthlyEventQuota()`):
- `FREE`: 100 000 событий/мес, жесткий лимит (`hard cap`), хранение 3 дня.
- `PRO`: 5 000 000 событий/мес, мягкий лимит (`soft cap`), хранение 14 дней.
- `BUSINESS`: 25 000 000 событий/мес, мягкий лимит (`soft cap`), хранение 30 дней.
- `ENTERPRISE`: 100 000 000 событий/мес, индивидуальный лимит, хранение 90 дней.

### Требования к архитектуре:
1. **Неблокирующий живой поток (Non-blocking Live Ingest):**
   Инжест событий (HTTP, UDP, TCP) не может выполнять синхронную запись в PostgreSQL на каждое входящее событие. Обработка должна оставаться суб-миллисекундной ($< 1$ мс).
2. **Проверка квоты в реальном времени (QuotaGuard):**
   Решение о пропуске события или отклонении (HTTP `429 Too Many Requests`) должно приниматься мгновенно на основе in-memory кэша потребления текущего месяца.
3. **Безопасность и соответствие GDPR (API Keys):**
   API-ключи должны поддерживать разграничение скоупов (`ingest` для отправки метрик, `read` для телеметрии), регистрацию хеша последнего IP (`last_ip_hash` через SHA-256 без сохранения персонального IP) и бесшовную ротацию с льготным периодом (`grace period`).

## Решение

### 1. Архитектура учёта: in-memory `LongAdder` + 10-секундный батч-сброс
Внутри `UsageMeterService`:
- Счётчики событий и байтов накапливаются в памяти через `java.util.concurrent.atomic.LongAdder` в структуре `ConcurrentHashMap<UsageBucketKey, LongAdder>` (ключ: `orgId`, `projectId`, `bucketDate`).
- Фоновая периодическая задача `@Scheduled(every = "10s")` атомарно извлекает дельты (`sumThenReset()`) и сбрасывает их в PostgreSQL батчем:
  ```sql
  INSERT INTO usage_counters (organization_id, project_id, bucket_date, events_count, bytes_count)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (project_id, bucket_date)
  DO UPDATE SET
      events_count = usage_counters.events_count + EXCLUDED.events_count,
      bytes_count = usage_counters.bytes_count + EXCLUDED.bytes_count;
  ```
- Месячный объем потребления организации кэшируется в `ConcurrentHashMap<UUID, AtomicLong>`. При сбросе дельта прибавляется к месячному кэшу.

### 2. QuotaGuard (Применение квот)
- На тарифе `FREE` при превышении месячной квоты входящие события отклоняются с HTTP `429 Too Many Requests` (код `QUOTA_EXCEEDED`, заголовок `Retry-After: 3600`). Инкрементируется Micrometer счетчик `ingest_dropped_quota_total`.
- На платных тарифах (`PRO`, `BUSINESS`, `ENTERPRISE`) действует мягкий потолок (`soft cap`): события не блокируются, фиксируется перерасход для последующего оверэдж-биллинга.

### 3. Продвинутые API-ключи и ротация
- В таблицу `api_keys` добавляются поля `scopes VARCHAR(64) DEFAULT 'ingest'`, `last_ip_hash VARCHAR(64)` и `expires_at TIMESTAMPTZ`.
- Эндпоинт `POST /api/v1/projects/{projectId}/keys/{keyId}/rotate`:
  Генерирует новый ключ с тем же именем и скоупами, а старому ключу выставляет `expires_at = now + gracePeriod` (по умолчанию 24 часа). В `audit_log` записывается действие `apikey.rotated`.

## Последствия
- Потоки инжеста работают без блокировок и блокирующих транзакций в БД.
- В случае аварийного рестарта ноды максимальная потеря статистики составляет события за последние 10 секунд, что допустимо для биллинга телеметрии.
- Организации получают прозрачную статистику потребления и возможность безопасно ротировать ключи в CI/CD без простоя продакшна.
