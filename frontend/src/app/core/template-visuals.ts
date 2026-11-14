import type { NodeType } from './models';

export type LiveViewVariant = 'v1' | 'v2' | 'v3' | 'minimalist';

export interface LiveViewVariantMeta {
  id: LiveViewVariant;
  name: string;
  shortLabel: string;
  description: string;
}

export const LIVE_VIEW_VARIANTS: LiveViewVariantMeta[] = [
  {
    id: 'v1',
    name: 'Live View 1 · Classic Ops',
    shortLabel: 'V1 Classic',
    description: 'Left tool rail, 224×72 topology cards, minimap, floating pill dock & 360px inspector drawer',
  },
  {
    id: 'v2',
    name: 'Live View 2 · Incident Split',
    shortLabel: 'V2 Incident',
    description: '55/45 split canvas + Trace Diagnostic Studio with Span Waterfall & root-cause callout',
  },
  {
    id: 'v3',
    name: 'Live View 3 · Kinetic Grid',
    shortLabel: 'V3 Kinetic',
    description: 'Top command status bar, tier filter pills, floating telemetry HUD & time-travel dock',
  },
  {
    id: 'minimalist',
    name: 'Minimalist Studio',
    shortLabel: 'Minimalist',
    description: 'Floating glass pill header, micro-sparkline node cards & floating inspector card',
  },
];

export type FlowTemplateId = 'microservices' | 'online-shop' | 'queue-worker' | 'ai-rag';

export interface TemplateBlockVisual {
  badgeLabel: string;
  accentHex: string;
  accentBgClass: string;
  accentTextClass: string;
  borderAccentClass: string;
  cardShapeClass: string;
  defaultIcon: string;
  metricUnit: string;
  subtitleFallback: string;
}

export interface FlowTemplateVisualProfile {
  id: FlowTemplateId;
  displayName: string;
  tagline: string;
  recommendedTheme: 'dark' | 'light' | 'cozy-light';
  cardWidth: number;
  cardHeight: number;
  nodeTypeVisuals: Record<NodeType, TemplateBlockVisual>;
}

const DEFAULT_TYPE_ICONS: Record<NodeType, string> = {
  source: 'language',
  service: 'memory',
  decision: 'alt_route',
  datastore: 'database',
  queue: 'hub',
  external: 'cloud',
  end: 'flag',
};

const MATERIAL_ICON_MAP: Record<string, string> = {
  'git-branch': 'alt_route',
  'git-merge': 'call_merge',
  'git-commit': 'commit',
  globe: 'language',
  server: 'dns',
  cpu: 'memory',
  database: 'database',
  layers: 'layers',
  shield: 'security',
  lock: 'lock',
  zap: 'bolt',
  activity: 'monitoring',
  box: 'inventory_2',
  users: 'group',
  user: 'person',
  'shopping-cart': 'shopping_cart',
  'credit-card': 'credit_card',
  'check-circle': 'check_circle',
  'x-circle': 'cancel',
  'alert-triangle': 'warning',
  'alert-circle': 'error',
  'message-square': 'chat',
  mail: 'mail',
  cloud: 'cloud',
  webhook: 'webhook',
  flag: 'flag',
  play: 'play_arrow',
  'arrow-right': 'arrow_forward',
};

export function resolveTemplateProfile(templateId: string | null | undefined): FlowTemplateVisualProfile {
  switch (templateId) {
    case 'online-shop':
      return ONLINE_SHOP_PROFILE;
    case 'queue-worker':
      return QUEUE_WORKER_PROFILE;
    case 'ai-rag':
      return AI_RAG_PROFILE;
    case 'microservices':
    default:
      return MICROSERVICES_PROFILE;
  }
}

export function resolveNodeIcon(
  templateId: string | null | undefined,
  nodeKey: string,
  nodeType: NodeType,
  explicitIcon?: string | null
): string {
  const key = nodeKey.toLowerCase();
  if (templateId === 'online-shop') {
    if (key.includes('visit') || key.includes('home')) return 'storefront';
    if (key.includes('browse') || key.includes('catalog')) return 'grid_view';
    if (key.includes('product')) return 'inventory_2';
    if (key.includes('cart')) return 'shopping_cart';
    if (key.includes('checkout')) return 'point_of_sale';
    if (key.includes('pay')) return 'credit_card';
    if (key.includes('paid') || key.includes('order')) return 'check_circle';
    if (key.includes('abandon') || key.includes('fail')) return 'cancel';
  }
  if (templateId === 'queue-worker') {
    if (key.includes('webhook')) return 'webhook';
    if (key.includes('ingest') || key.includes('api')) return 'api';
    if (key.includes('kafka') || key.includes('queue')) return 'stream';
    if (key.includes('worker')) return 'engineering';
    if (key.includes('dlq')) return 'error_outline';
    if (key.includes('db')) return 'database';
  }
  if (templateId === 'ai-rag') {
    if (key.includes('prompt') || key.includes('user')) return 'chat';
    if (key.includes('embed')) return 'data_array';
    if (key.includes('vector')) return 'manage_search';
    if (key.includes('llm') || key.includes('orch')) return 'psychology';
    if (key.includes('tool')) return 'build';
    if (key.includes('resp')) return 'auto_awesome';
  }
  if (explicitIcon && !/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(explicitIcon)) {
    const normalized = explicitIcon.trim().toLowerCase();
    if (MATERIAL_ICON_MAP[normalized]) {
      return MATERIAL_ICON_MAP[normalized];
    }
    if (/^[a-z0-9_]+$/.test(normalized)) {
      return normalized;
    }
  }
  const profile = resolveTemplateProfile(templateId);
  return profile.nodeTypeVisuals[nodeType]?.defaultIcon ?? DEFAULT_TYPE_ICONS[nodeType] ?? 'memory';
}

const MICROSERVICES_PROFILE: FlowTemplateVisualProfile = {
  id: 'microservices',
  displayName: 'Cloud & Microservices',
  tagline: 'Technical Service Mesh',
  recommendedTheme: 'dark',
  cardWidth: 224,
  cardHeight: 72,
  nodeTypeVisuals: {
    source: {
      badgeLabel: 'Ingress',
      accentHex: '#60A5FA',
      accentBgClass: 'bg-node-source/15',
      accentTextClass: 'text-node-source',
      borderAccentClass: 'border-node-source/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'language',
      metricUnit: 'req/s',
      subtitleFallback: 'edge_ingress',
    },
    queue: {
      badgeLabel: 'Router / LB',
      accentHex: '#22D3EE',
      accentBgClass: 'bg-node-queue/15',
      accentTextClass: 'text-node-queue',
      borderAccentClass: 'border-node-queue/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'hub',
      metricUnit: 'req/s',
      subtitleFallback: 'lb_edge_traff',
    },
    decision: {
      badgeLabel: 'Decision',
      accentHex: '#F59E0B',
      accentBgClass: 'bg-node-decision/15',
      accentTextClass: 'text-node-decision',
      borderAccentClass: 'border-node-decision/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'alt_route',
      metricUnit: 'eval/s',
      subtitleFallback: 'policy_router',
    },
    service: {
      badgeLabel: 'Service',
      accentHex: '#8B5CF6',
      accentBgClass: 'bg-node-service/20',
      accentTextClass: 'text-node-service',
      borderAccentClass: 'border-node-service/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'memory',
      metricUnit: 'req/s',
      subtitleFallback: 'svc_worker',
    },
    datastore: {
      badgeLabel: 'Datastore',
      accentHex: '#34D399',
      accentBgClass: 'bg-node-datastore/15',
      accentTextClass: 'text-node-datastore',
      borderAccentClass: 'border-node-datastore/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'database',
      metricUnit: 'qps',
      subtitleFallback: 'db_aurora_core',
    },
    external: {
      badgeLabel: 'External',
      accentHex: '#94A3B8',
      accentBgClass: 'bg-node-external/15',
      accentTextClass: 'text-node-external',
      borderAccentClass: 'border-node-external/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'cloud',
      metricUnit: 'req/s',
      subtitleFallback: 'ext_api',
    },
    end: {
      badgeLabel: 'Terminal',
      accentHex: '#F472B6',
      accentBgClass: 'bg-node-end/15',
      accentTextClass: 'text-node-end',
      borderAccentClass: 'border-node-end/40',
      cardShapeClass: 'rounded-[14px]',
      defaultIcon: 'flag',
      metricUnit: 'done',
      subtitleFallback: 'sink_end',
    },
  },
};

const ONLINE_SHOP_PROFILE: FlowTemplateVisualProfile = {
  id: 'online-shop',
  displayName: 'Online Shop (Live Commerce)',
  tagline: 'Customer Journey Funnel',
  recommendedTheme: 'cozy-light',
  cardWidth: 232,
  cardHeight: 76,
  nodeTypeVisuals: {
    source: {
      badgeLabel: 'Storefront',
      accentHex: '#60A5FA',
      accentBgClass: 'bg-node-source/15',
      accentTextClass: 'text-node-source',
      borderAccentClass: 'border-node-source/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'storefront',
      metricUnit: 'shoppers',
      subtitleFallback: 'landing_page',
    },
    queue: {
      badgeLabel: 'Cart / Bag',
      accentHex: '#22D3EE',
      accentBgClass: 'bg-node-queue/15',
      accentTextClass: 'text-node-queue',
      borderAccentClass: 'border-node-queue/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'shopping_cart',
      metricUnit: 'carts',
      subtitleFallback: 'active_bag',
    },
    decision: {
      badgeLabel: 'Funnel Step',
      accentHex: '#F59E0B',
      accentBgClass: 'bg-node-decision/15',
      accentTextClass: 'text-node-decision',
      borderAccentClass: 'border-node-decision/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'point_of_sale',
      metricUnit: 'checkouts',
      subtitleFallback: 'checkout_gate',
    },
    service: {
      badgeLabel: 'Catalog / Step',
      accentHex: '#8B5CF6',
      accentBgClass: 'bg-node-service/15',
      accentTextClass: 'text-node-service',
      borderAccentClass: 'border-node-service/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'inventory_2',
      metricUnit: 'views',
      subtitleFallback: 'product_step',
    },
    datastore: {
      badgeLabel: 'Order Vault',
      accentHex: '#34D399',
      accentBgClass: 'bg-node-datastore/15',
      accentTextClass: 'text-node-datastore',
      borderAccentClass: 'border-node-datastore/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'receipt_long',
      metricUnit: 'orders',
      subtitleFallback: 'orders_ledger',
    },
    external: {
      badgeLabel: 'Payment PSP',
      accentHex: '#94A3B8',
      accentBgClass: 'bg-node-external/15',
      accentTextClass: 'text-node-external',
      borderAccentClass: 'border-node-external/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'credit_card',
      metricUnit: 'tx/s',
      subtitleFallback: 'stripe_gateway',
    },
    end: {
      badgeLabel: 'Outcome',
      accentHex: '#34D399',
      accentBgClass: 'bg-status-ok/15',
      accentTextClass: 'text-status-ok',
      borderAccentClass: 'border-status-ok/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'check_circle',
      metricUnit: 'completed',
      subtitleFallback: 'order_outcome',
    },
  },
};

const QUEUE_WORKER_PROFILE: FlowTemplateVisualProfile = {
  id: 'queue-worker',
  displayName: 'Async Queue & Event Bus',
  tagline: 'Streaming & Worker Pipeline',
  recommendedTheme: 'dark',
  cardWidth: 228,
  cardHeight: 72,
  nodeTypeVisuals: {
    source: {
      badgeLabel: 'Producer',
      accentHex: '#60A5FA',
      accentBgClass: 'bg-node-source/15',
      accentTextClass: 'text-node-source',
      borderAccentClass: 'border-node-source/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'webhook',
      metricUnit: 'evt/s',
      subtitleFallback: 'webhook_source',
    },
    queue: {
      badgeLabel: 'Topic / Bus',
      accentHex: '#22D3EE',
      accentBgClass: 'bg-node-queue/15',
      accentTextClass: 'text-node-queue',
      borderAccentClass: 'border-node-queue/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'stream',
      metricUnit: 'msg/s',
      subtitleFallback: 'kafka_topic',
    },
    decision: {
      badgeLabel: 'Partitioner',
      accentHex: '#F59E0B',
      accentBgClass: 'bg-node-decision/15',
      accentTextClass: 'text-node-decision',
      borderAccentClass: 'border-node-decision/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'alt_route',
      metricUnit: 'msg/s',
      subtitleFallback: 'router_key',
    },
    service: {
      badgeLabel: 'Consumer',
      accentHex: '#8B5CF6',
      accentBgClass: 'bg-node-service/15',
      accentTextClass: 'text-node-service',
      borderAccentClass: 'border-node-service/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'engineering',
      metricUnit: 'jobs/s',
      subtitleFallback: 'worker_pool',
    },
    datastore: {
      badgeLabel: 'Sink Store',
      accentHex: '#34D399',
      accentBgClass: 'bg-node-datastore/15',
      accentTextClass: 'text-node-datastore',
      borderAccentClass: 'border-node-datastore/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'database',
      metricUnit: 'writes/s',
      subtitleFallback: 'pg_sink',
    },
    external: {
      badgeLabel: 'Webhook Out',
      accentHex: '#94A3B8',
      accentBgClass: 'bg-node-external/15',
      accentTextClass: 'text-node-external',
      borderAccentClass: 'border-node-external/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'send',
      metricUnit: 'calls/s',
      subtitleFallback: 'webhook_out',
    },
    end: {
      badgeLabel: 'DLQ / Ack',
      accentHex: '#F472B6',
      accentBgClass: 'bg-node-end/15',
      accentTextClass: 'text-node-end',
      borderAccentClass: 'border-node-end/40',
      cardShapeClass: 'rounded-xl',
      defaultIcon: 'done_all',
      metricUnit: 'ack',
      subtitleFallback: 'stream_end',
    },
  },
};

const AI_RAG_PROFILE: FlowTemplateVisualProfile = {
  id: 'ai-rag',
  displayName: 'AI Agent & RAG Pipeline',
  tagline: 'LLM Orchestration Mesh',
  recommendedTheme: 'dark',
  cardWidth: 230,
  cardHeight: 74,
  nodeTypeVisuals: {
    source: {
      badgeLabel: 'Prompt',
      accentHex: '#60A5FA',
      accentBgClass: 'bg-node-source/15',
      accentTextClass: 'text-node-source',
      borderAccentClass: 'border-node-source/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'chat',
      metricUnit: 'prompts/s',
      subtitleFallback: 'user_prompt',
    },
    queue: {
      badgeLabel: 'Embeddings',
      accentHex: '#22D3EE',
      accentBgClass: 'bg-node-queue/15',
      accentTextClass: 'text-node-queue',
      borderAccentClass: 'border-node-queue/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'data_array',
      metricUnit: 'vec/s',
      subtitleFallback: 'embed_model',
    },
    decision: {
      badgeLabel: 'Agent Router',
      accentHex: '#F59E0B',
      accentBgClass: 'bg-node-decision/15',
      accentTextClass: 'text-node-decision',
      borderAccentClass: 'border-node-decision/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'psychology',
      metricUnit: 'steps/s',
      subtitleFallback: 'llm_orchestrator',
    },
    service: {
      badgeLabel: 'Tool / Chain',
      accentHex: '#8B5CF6',
      accentBgClass: 'bg-node-service/20',
      accentTextClass: 'text-node-service',
      borderAccentClass: 'border-node-service/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'build',
      metricUnit: 'calls/s',
      subtitleFallback: 'agent_tool',
    },
    datastore: {
      badgeLabel: 'Vector DB',
      accentHex: '#34D399',
      accentBgClass: 'bg-node-datastore/15',
      accentTextClass: 'text-node-datastore',
      borderAccentClass: 'border-node-datastore/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'manage_search',
      metricUnit: 'queries/s',
      subtitleFallback: 'pgvector_idx',
    },
    external: {
      badgeLabel: 'Model API',
      accentHex: '#94A3B8',
      accentBgClass: 'bg-node-external/15',
      accentTextClass: 'text-node-external',
      borderAccentClass: 'border-node-external/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'neurology',
      metricUnit: 'tok/s',
      subtitleFallback: 'llm_provider',
    },
    end: {
      badgeLabel: 'Response',
      accentHex: '#F472B6',
      accentBgClass: 'bg-node-end/15',
      accentTextClass: 'text-node-end',
      borderAccentClass: 'border-node-end/40',
      cardShapeClass: 'rounded-2xl',
      defaultIcon: 'auto_awesome',
      metricUnit: 'resp/s',
      subtitleFallback: 'final_answer',
    },
  },
};
