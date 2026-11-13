export type NodeType =
  | 'source'
  | 'service'
  | 'decision'
  | 'datastore'
  | 'queue'
  | 'external'
  | 'end';

export type HopVisualStyle =
  | 'comet'
  | 'laser-conduit'
  | 'packet-capsule'
  | 'sonar-wave'
  | 'circuit-frame';

export type NodeVisualStyle = 'classic' | 'blueprint';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'BILLING_ADMIN';

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  planTier: PlanTier;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationView {
  organization: Organization;
  myRole: OrgRole;
  permissions: string[];
  workspaces: Workspace[];
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  email: string;
  externalId: string;
  role: OrgRole;
  createdAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  token?: string | null;
  tokenPrefix?: string | null;
  tokenHash?: string | null;
  status: 'PENDING' | 'ACCEPTED' | string;
  invitedBy?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorUserId?: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface DiagramNode {
  key: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  icon?: string | null;
  discovered?: boolean | null;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string | null;
  discovered?: boolean | null;
}

export interface DiagramGraph {
  schema: number;
  direction: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  theme: string;
  diagram: DiagramGraph;
  defaultPersonas: string[];
  terminalNodes: string[];
}

export interface Project {
  id: string;
  ownerId: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  name: string;
  autoDiscover: boolean;
  retentionDays: number;
  createdAt: string;
}

export interface DiagramVersion {
  id: string;
  projectId: string;
  version: number;
  graph: DiagramGraph;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerS: number;
  scopes?: string;
  lastIpHash?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
}

export interface CreatedApiKeyResult {
  apiKey: ApiKey;
  fullKey: string;
}

export interface RotatedApiKeyResult {
  newKey: ApiKey;
  fullKey: string;
  oldKeyExpiresAt: string;
}

export interface UsageBucket {
  date: string;
  eventsCount: number;
  bytesCount: number;
}

export interface ProjectUsage {
  projectId: string;
  projectName: string;
  eventsThisMonth: number;
  bytesThisMonth: number;
  dailyHistory: UsageBucket[];
}

export interface OrganizationUsage {
  organizationId: string;
  planTier: PlanTier;
  monthlyQuota: number;
  totalEventsThisMonth: number;
  totalBytesThisMonth: number;
  percentUsed: number;
  isQuotaExceeded: boolean;
  projectBreakdown: ProjectUsage[];
}

export interface TraceSummary {
  id: string;
  projectId: string;
  startedAt: string;
  lastEventAt: string;
  ended: boolean;
  status: 'ok' | 'error' | string;
  eventCount: number;
  lastNode?: string | null;
}

export interface TraceEventRecord {
  id: number;
  projectId: string;
  traceId: string;
  branch: string;
  fromNode?: string | null;
  node: string;
  type: 'enter' | 'error' | 'end';
  label?: string | null;
  attrs: Record<string, unknown>;
  clientTs?: number | null;
  serverTs: string;
  seq?: number | null;
}

export interface TraceDetail {
  summary: TraceSummary;
  events: TraceEventRecord[];
}

export interface NodeMetric {
  in: number;
  errors: number;
}

export interface EdgeMetric {
  hops: number;
  errors: number;
}

export interface StatsEvent {
  t: 'stats';
  windowMs: number;
  nodes: Record<string, NodeMetric>;
  edges: Record<string, EdgeMetric>;
}

export interface EntityInfo {
  kind?: string;
  ref?: string;
  label?: string;
  avatar?: string;
}

export interface CarryItem {
  sku: string;
  label?: string;
  icon?: string;
  image?: string;
  qty: number;
  price: number;
  currency?: string;
}

export type CarryOp = 'set' | 'add' | 'remove' | 'clear';

export interface CarrySummary {
  count: number;
  total: number;
  currency: string;
  topIcons: string[];
}

export interface SnapshotEvent {
  t: 'snapshot';
  diagram: DiagramGraph;
  active: Array<{
    traceId: string;
    branch: string;
    node: string;
    entity?: EntityInfo | null;
    carry?: CarrySummary | null;
  }>;
  stats: StatsEvent;
  serverTime: number;
}

export interface SpawnEvent {
  t: 'spawn';
  traceId: string;
  branch: string;
  node: string;
  status: 'ok' | 'error' | string;
  label?: string | null;
  attrs?: Record<string, unknown>;
  ts: number;
  entity?: EntityInfo | null;
  carry?: CarrySummary | null;
}

export interface HopEvent {
  t: 'hop';
  traceId: string;
  branch: string;
  from: string;
  to: string;
  edgeId?: string | null;
  unmapped: boolean;
  status: 'ok' | 'error' | string;
  label?: string | null;
  attrs?: Record<string, unknown>;
  ts: number;
  seq?: number | null;
  entity?: EntityInfo | null;
  carry?: CarrySummary | null;
}

export interface EndEvent {
  t: 'end';
  traceId: string;
  branch: string;
  node: string;
  ts: number;
  outcome?: string;
}

export interface CarryEvent {
  t: 'carry';
  traceId: string;
  branch: string;
  node: string;
  op: CarryOp;
  carry: CarrySummary;
  ts: number;
}

export interface CompleteEvent {
  t: 'complete';
  traceId: string;
  branch: string;
  node: string;
  entity?: EntityInfo | null;
  carry: CarrySummary;
  ts: number;
}

export interface FailEvent {
  t: 'fail';
  traceId: string;
  branch: string;
  node: string;
  entity?: EntityInfo | null;
  reason?: string;
  ts: number;
}

export interface AbandonEvent {
  t: 'abandon';
  traceId: string;
  branch: string;
  node: string;
  entity?: EntityInfo | null;
  carry: CarrySummary;
  ts: number;
}

export interface CrowdEvent {
  t: 'crowd';
  node: string;
  count: number;
  ts: number;
}

export interface DiagramPatchEvent {
  t: 'diagram_patch';
  ops: Array<{
    op: 'addNode' | 'addEdge';
    node?: DiagramNode | null;
    edge?: DiagramEdge | null;
  }>;
}

export interface DroppedEvent {
  t: 'dropped';
  count: number;
}

export type UiStreamEvent =
  | SnapshotEvent
  | SpawnEvent
  | HopEvent
  | EndEvent
  | DiagramPatchEvent
  | StatsEvent
  | DroppedEvent
  | CarryEvent
  | CompleteEvent
  | FailEvent
  | AbandonEvent
  | CrowdEvent;

// E-Commerce Connectors (Gate G1-E / E20)
export type ConnectorType =
  | 'STOREFRONT_JS'
  | 'GENERIC_WEBHOOK'
  | 'SHOPIFY_WEBHOOK'
  | 'WOOCOMMERCE_WEBHOOK'
  | 'STRIPE_WEBHOOK';

export type ConnectorStatus = 'WAITING' | 'CONNECTED' | 'ERROR';

export interface WebhookMapping {
  traceIdPath?: string | null;
  nodePath?: string | null;
  defaultNode?: string | null;
  entityRefPath?: string | null;
  entityNamePath?: string | null;
  avatarPath?: string | null;
  itemsPath?: string | null;
  amountPath?: string | null;
  currencyPath?: string | null;
}

export interface ConnectorConfig {
  id: string;
  projectId: string;
  name: string;
  type: ConnectorType;
  tokenPrefix: string;
  mapping: WebhookMapping;
  status: ConnectorStatus;
  lastEventAt?: string | null;
  totalEvents: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedConnectorResponse {
  id: string;
  projectId: string;
  name: string;
  type: ConnectorType;
  tokenPrefix: string;
  secretToken: string;
  mapping: WebhookMapping;
  status: ConnectorStatus;
}

export interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | string;
  metric: 'error_rate' | 'latency_p95' | 'rps_drop' | string;
  threshold: number;
  windowSeconds: number;
  targetNode?: string | null;
  channelType: 'SLACK' | 'PAGERDUTY' | 'WEBHOOK' | string;
  channelTarget: string;
  enabled: boolean;
  mutedUntil?: string | null;
  lastFiredAt?: string | null;
  fireCount: number;
  createdAt: string;
}
