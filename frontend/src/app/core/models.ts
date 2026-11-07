export type NodeType =
  | 'source'
  | 'service'
  | 'decision'
  | 'datastore'
  | 'queue'
  | 'external'
  | 'end';

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

export interface Project {
  id: string;
  ownerId: string;
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
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface CreatedApiKeyResult {
  apiKey: ApiKey;
  fullKey: string;
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

export interface SnapshotEvent {
  t: 'snapshot';
  diagram: DiagramGraph;
  active: Array<{ traceId: string; branch: string; node: string }>;
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
}

export interface EndEvent {
  t: 'end';
  traceId: string;
  branch: string;
  node: string;
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
  | DroppedEvent;
