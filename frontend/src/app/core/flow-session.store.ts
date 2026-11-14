import { Injectable, computed, inject, signal } from '@angular/core';
import { FlowTraceApiService } from './api.service';
import {
  ActiveToken,
  AnimationEngine,
  GhostEdge,
  NodeVisualEffect,
} from './animation-engine';
import {
  DiagramGraph,
  DiagramNode,
  Project,
  StatsEvent,
  TemplateDefinition,
  TraceDetail,
  TraceSummary,
  UiStreamEvent,
} from './models';
import {
  FlowTemplateId,
  LIVE_VIEW_VARIANTS,
  LiveViewVariant,
  resolveTemplateProfile,
} from './template-visuals';

const BUILTIN_FALLBACK_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'online-shop',
    name: 'Online Shop (B2C Live Commerce)',
    category: 'commerce',
    description: 'Storefront funnel: Visit -> Browse -> Product -> Cart -> Checkout -> Payment -> Paid / Abandoned',
    theme: 'cozy-light',
    defaultPersonas: ['browser', 'buyer', 'hesitant', 'abandoner'],
    terminalNodes: ['paid', 'payment-failed', 'abandoned'],
    diagram: {
      schema: 1,
      direction: 'LR',
      nodes: [
        { key: 'visit', label: 'Storefront', type: 'source', x: -340, y: 0, icon: 'store' },
        { key: 'browse', label: 'Browse Catalog', type: 'service', x: -120, y: 0, icon: 'compass' },
        { key: 'product', label: 'Product Detail', type: 'service', x: 120, y: 0, icon: 'tag' },
        { key: 'cart', label: 'Cart & Bag', type: 'service', x: 340, y: 0, icon: 'shopping-cart' },
        { key: 'checkout', label: 'Checkout', type: 'service', x: 340, y: 180, icon: 'user-check' },
        { key: 'payment', label: 'Payment Gateway', type: 'decision', x: 120, y: 180, icon: 'credit-card' },
        { key: 'paid', label: 'Order Paid', type: 'end', x: -120, y: 180, icon: 'check-circle' },
        { key: 'payment-failed', label: 'Payment Failed', type: 'end', x: 120, y: 320, icon: 'alert-circle' },
        { key: 'abandoned', label: 'Abandoned', type: 'end', x: -120, y: -140, icon: 'x-circle' },
      ],
      edges: [
        { id: 'e_shop_1', from: 'visit', to: 'browse', label: 'visit' },
        { id: 'e_shop_2', from: 'browse', to: 'product', label: 'view' },
        { id: 'e_shop_3', from: 'browse', to: 'abandoned', label: 'bounce' },
        { id: 'e_shop_4', from: 'product', to: 'cart', label: 'add to cart' },
        { id: 'e_shop_6', from: 'cart', to: 'checkout', label: 'proceed' },
        { id: 'e_shop_8', from: 'checkout', to: 'payment', label: 'pay' },
        { id: 'e_shop_10', from: 'payment', to: 'paid', label: 'success' },
        { id: 'e_shop_11', from: 'payment', to: 'payment-failed', label: 'declined' },
      ],
    },
  },
  {
    id: 'microservices',
    name: 'Cloud & Microservices (Technical)',
    category: 'engineering',
    description: 'Technical architecture: Website -> Load Balancer -> Decision -> Services -> DB',
    theme: 'dark-neon',
    defaultPersonas: ['standard-request', 'pro-request', 'batch-job'],
    terminalNodes: ['db'],
    diagram: {
      schema: 1,
      direction: 'TB',
      nodes: [
        { key: 'website', label: 'Website', type: 'source', x: 0, y: 0, icon: 'globe' },
        { key: 'lb', label: 'Load Balancer', type: 'service', x: 0, y: 160, icon: 'server' },
        { key: 'if-premium', label: 'Premium?', type: 'decision', x: 0, y: 320, icon: 'git-branch' },
        { key: 'service-a', label: 'Service A', type: 'service', x: -200, y: 480, icon: 'cpu' },
        { key: 'service-b', label: 'Service B', type: 'service', x: 200, y: 480, icon: 'cpu' },
        { key: 'db', label: 'Database', type: 'datastore', x: 0, y: 640, icon: 'database' },
      ],
      edges: [
        { id: 'e1', from: 'website', to: 'lb' },
        { id: 'e2', from: 'lb', to: 'if-premium' },
        { id: 'e3', from: 'if-premium', to: 'service-a', label: 'yes' },
        { id: 'e4', from: 'if-premium', to: 'service-b', label: 'no' },
        { id: 'e5', from: 'service-a', to: 'db' },
        { id: 'e6', from: 'service-b', to: 'db' },
      ],
    },
  },
  {
    id: 'queue-worker',
    name: 'Async Queue & Event Bus',
    category: 'backend',
    description: 'Asynchronous pipeline: Webhooks -> Ingest API -> Kafka Queue -> Worker Pool -> Postgres / DLQ',
    theme: 'dark-neon',
    defaultPersonas: ['webhook-event', 'batch-task', 'retry-task'],
    terminalNodes: ['db', 'dlq'],
    diagram: {
      schema: 1,
      direction: 'LR',
      nodes: [
        { key: 'client', label: 'Webhooks / Clients', type: 'source', x: -320, y: 0, icon: 'globe' },
        { key: 'ingest-api', label: 'Ingest API', type: 'service', x: -100, y: 0, icon: 'server' },
        { key: 'queue', label: 'Kafka / SQS Buffer', type: 'queue', x: 120, y: 0, icon: 'layers' },
        { key: 'worker', label: 'Worker Pool', type: 'service', x: 340, y: 0, icon: 'cpu' },
        { key: 'db', label: 'Postgres Primary', type: 'datastore', x: 340, y: 180, icon: 'database' },
        { key: 'dlq', label: 'Dead Letter Queue', type: 'end', x: 120, y: 180, icon: 'alert-triangle' },
      ],
      edges: [
        { id: 'e_qw_1', from: 'client', to: 'ingest-api', label: 'submit' },
        { id: 'e_qw_2', from: 'ingest-api', to: 'queue', label: 'publish' },
        { id: 'e_qw_3', from: 'queue', to: 'worker', label: 'poll' },
        { id: 'e_qw_4', from: 'worker', to: 'db', label: 'commit' },
        { id: 'e_qw_5', from: 'worker', to: 'dlq', label: 'exhausted' },
      ],
    },
  },
  {
    id: 'ai-rag',
    name: 'AI Agent & RAG Pipeline',
    category: 'ai',
    description: 'LLM pipeline: User Prompt -> Embedding -> Vector Search -> LLM Orchestrator -> Tools -> Response',
    theme: 'dark-neon',
    defaultPersonas: ['search-prompt', 'agent-task', 'tool-call'],
    terminalNodes: ['response'],
    diagram: {
      schema: 1,
      direction: 'LR',
      nodes: [
        { key: 'user-prompt', label: 'User Prompt', type: 'source', x: -340, y: 0, icon: 'terminal' },
        { key: 'embedding', label: 'Embedding Gen', type: 'service', x: -120, y: 0, icon: 'sparkles' },
        { key: 'vector-db', label: 'Vector Database', type: 'datastore', x: -120, y: 180, icon: 'database' },
        { key: 'llm-agent', label: 'LLM Orchestrator', type: 'service', x: 120, y: 0, icon: 'cpu' },
        { key: 'tool-exec', label: 'Tool Execution', type: 'service', x: 120, y: 180, icon: 'tool' },
        { key: 'response', label: 'Final Response', type: 'end', x: 340, y: 0, icon: 'check-circle' },
      ],
      edges: [
        { id: 'e_ai_1', from: 'user-prompt', to: 'embedding', label: 'query' },
        { id: 'e_ai_2', from: 'embedding', to: 'vector-db', label: 'similarity' },
        { id: 'e_ai_3', from: 'vector-db', to: 'llm-agent', label: 'context' },
        { id: 'e_ai_4', from: 'llm-agent', to: 'tool-exec', label: 'tool_call' },
        { id: 'e_ai_5', from: 'tool-exec', to: 'llm-agent', label: 'tool_result' },
        { id: 'e_ai_6', from: 'llm-agent', to: 'response', label: 'stream' },
      ],
    },
  },
];

@Injectable({ providedIn: 'root' })
export class FlowSessionStore {
  private readonly api = inject(FlowTraceApiService);

  // Core UI & Theme state
  public readonly theme = signal<'dark' | 'light' | 'cozy-light'>('dark');
  public readonly liveVariant = signal<LiveViewVariant>('v1');
  public readonly variantMenuOpen = signal<boolean>(false);
  public readonly templateMenuOpen = signal<boolean>(false);
  public readonly projectMenuOpen = signal<boolean>(false);
  public readonly shareModalOpen = signal<boolean>(false);
  public readonly quotaModalOpen = signal<boolean>(false);

  // Backend data state
  public readonly projects = signal<Project[]>([]);
  public readonly selectedProjectId = signal<string>('');
  public readonly templates = signal<TemplateDefinition[]>([]);
  public readonly activeTemplateId = signal<FlowTemplateId>('microservices');
  public readonly diagram = signal<DiagramGraph>({ schema: 1, direction: 'TB', nodes: [], edges: [] });
  public readonly stats = signal<StatsEvent>({ t: 'stats', windowMs: 1000, nodes: {}, edges: {} });
  public readonly recentTraces = signal<TraceSummary[]>([]);
  public readonly selectedTraceDetail = signal<TraceDetail | null>(null);
  public readonly demoRunning = signal<boolean>(false);
  public readonly wsConnected = signal<boolean>(false);
  public readonly backendOnline = signal<boolean>(true);
  public readonly searchQuery = signal<string>('');
  public readonly errorMessage = signal<string | null>(null);

  // Selection & Canvas state
  public readonly selectedNodeKey = signal<string | null>(null);
  public readonly inspectorOpen = signal<boolean>(true);
  public readonly showLabels = signal<boolean>(true);
  public readonly paused = signal<boolean>(false);
  public readonly speedMultiplier = signal<number>(0.5);
  public readonly streamMode = signal<'realtime' | 'smooth'>('smooth');
  public readonly activeFilterTier = signal<'all' | 'degraded' | 'edge' | 'data'>('all');
  public readonly zoom = signal<number>(1);
  public readonly panX = signal<number>(0);
  public readonly panY = signal<number>(0);

  // Animation engine signals
  public readonly engine = new AnimationEngine();
  public readonly activeTokens = signal<ActiveToken[]>([]);
  public readonly ghostEdges = signal<GhostEdge[]>([]);
  public readonly tickNowMs = signal<number>(Date.now());
  public readonly throughputHistory = signal<number[]>([35, 28, 42, 30, 18, 24, 15, 10, 22, 18, 12, 28, 16, 8, 14, 10]);

  public readonly variants = LIVE_VIEW_VARIANTS;

  public readonly activeProject = computed(
    () => this.projects().find((p) => p.id === this.selectedProjectId()) ?? null
  );

  public readonly templateProfile = computed(() =>
    resolveTemplateProfile(this.activeTemplateId())
  );

  public readonly selectedNode = computed<DiagramNode | null>(() => {
    const key = this.selectedNodeKey();
    const nodes = this.diagram().nodes;
    if (!nodes.length) return null;
    if (key) {
      return nodes.find((n) => n.key === key) ?? nodes[0];
    }
    return nodes.find((n) => n.type === 'service') ?? nodes[0];
  });

  public readonly totalRps = computed(() => {
    const nodeStats = Object.values(this.stats().nodes);
    const totalIn = nodeStats.reduce((sum, m) => sum + (m?.in ?? 0), 0);
    return Math.round(totalIn);
  });

  public readonly totalErrors = computed(() => {
    const nodeStats = Object.values(this.stats().nodes);
    return nodeStats.reduce((sum, m) => sum + (m?.errors ?? 0), 0);
  });

  public readonly filteredTraces = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.recentTraces();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        (t.lastNode ?? '').toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
    );
  });

  private ws: WebSocket | null = null;
  private rafId: number | null = null;
  private tracePollId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private initPromise: Promise<void> | null = null;

  public init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runInit().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async runInit(): Promise<void> {
    this.engine.speedMultiplier = this.speedMultiplier();
    this.engine.mode = this.streamMode();
    this.applyThemeToDom(this.theme());
    this.startAnimationLoop();
    await Promise.all([this.loadTemplates(), this.loadProjectsAndConnect()]);
    this.startTracePolling();
  }

  public destroy(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.tracePollId) {
      clearInterval(this.tracePollId);
      this.tracePollId = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeWs();
  }

  public setTheme(next: 'dark' | 'light' | 'cozy-light'): void {
    this.theme.set(next);
    this.applyThemeToDom(next);
  }

  public toggleTheme(): void {
    const cur = this.theme();
    this.setTheme(cur === 'dark' ? 'light' : 'dark');
  }

  public setLiveVariant(variant: LiveViewVariant): void {
    this.liveVariant.set(variant);
    this.variantMenuOpen.set(false);
    if (variant === 'v1' || variant === 'v2') {
      this.inspectorOpen.set(true);
    }
  }

  public cycleLiveVariant(): void {
    const order: LiveViewVariant[] = ['v1', 'v2', 'v3', 'minimalist'];
    const idx = order.indexOf(this.liveVariant());
    this.setLiveVariant(order[(idx + 1) % order.length]);
  }

  public selectNode(nodeKey: string | null): void {
    this.selectedNodeKey.set(nodeKey);
    if (nodeKey) {
      this.inspectorOpen.set(true);
    }
  }

  public updateNodePosition(nodeKey: string, x: number, y: number): void {
    const current = this.diagram();
    const updated: DiagramGraph = {
      ...current,
      nodes: current.nodes.map((n) => (n.key === nodeKey ? { ...n, x, y } : n)),
    };
    this.engine.setGraph(updated);
    this.diagram.set(updated);
  }

  public async persistDiagramPositions(): Promise<void> {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.backendOnline()) return;
    try {
      await this.api.saveDiagram(projectId, this.diagram());
    } catch {
      // Non-fatal: keep local dragged layout even if save fails
    }
  }

  public togglePause(): void {
    const next = !this.paused();
    this.paused.set(next);
    this.engine.paused = next;
  }

  public setSpeed(speed: number): void {
    this.speedMultiplier.set(speed);
    this.engine.speedMultiplier = speed;
  }

  public setStreamMode(mode: 'realtime' | 'smooth'): void {
    this.streamMode.set(mode);
    this.engine.mode = mode;
  }

  public toggleLabels(): void {
    this.showLabels.set(!this.showLabels());
  }

  public zoomIn(): void {
    this.zoom.set(Math.min(2, Number((this.zoom() + 0.15).toFixed(2))));
  }

  public zoomOut(): void {
    this.zoom.set(Math.max(0.45, Number((this.zoom() - 0.15).toFixed(2))));
  }

  public resetViewport(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  public async selectProject(projectId: string): Promise<void> {
    if (!projectId || projectId === this.selectedProjectId()) return;
    this.selectedProjectId.set(projectId);
    this.projectMenuOpen.set(false);
    this.engine.clearAll();
    this.selectedNodeKey.set(null);
    await this.loadProjectData(projectId);
    await this.connectWebSocket(projectId);
  }

  public async applyTemplate(templateId: FlowTemplateId): Promise<void> {
    const projectId = this.selectedProjectId();
    this.activeTemplateId.set(templateId);
    this.templateMenuOpen.set(false);
    const profile = resolveTemplateProfile(templateId);
    this.engine.cardWidth = profile.cardWidth;
    this.engine.cardHeight = profile.cardHeight;

    if (!projectId) return;
    try {
      await this.api.applyTemplate(projectId, templateId);
      const version = await this.api.getDiagram(projectId);
      this.applyDiagramGraph(version.graph);
      await this.refreshTraces();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to apply template');
    }
  }

  public async toggleDemo(): Promise<void> {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    try {
      if (this.demoRunning()) {
        await this.api.stopDemo(projectId);
        this.demoRunning.set(false);
      } else {
        await this.api.startDemo(projectId, 1.2, 0.06);
        this.demoRunning.set(true);
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to toggle demo');
    }
  }

  public async inspectTrace(traceId: string): Promise<void> {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    try {
      const detail = await this.api.getTraceDetail(projectId, traceId);
      this.selectedTraceDetail.set(detail);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load trace detail');
    }
  }

  public async createProject(name: string, autoDiscover = true, retentionDays = 7): Promise<Project | null> {
    try {
      const created = await this.api.createProject(name, autoDiscover, retentionDays);
      this.projects.update((list) => [...list, created]);
      await this.selectProject(created.id);
      return created;
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  }

  public async deleteProject(projectId: string): Promise<void> {
    try {
      await this.api.deleteProject(projectId);
      const remaining = this.projects().filter((p) => p.id !== projectId);
      this.projects.set(remaining);
      if (this.selectedProjectId() === projectId && remaining.length > 0) {
        await this.selectProject(remaining[0].id);
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to delete project');
    }
  }

  public getNodeEffect(nodeKey: string): NodeVisualEffect | undefined {
    return this.engine.getNodeEffect(nodeKey);
  }

  public getNodeMetric(nodeKey: string): { in: number; errors: number } {
    return this.stats().nodes[nodeKey] ?? { in: 0, errors: 0 };
  }

  public getEdgeMetric(edgeId: string): { hops: number; errors: number } {
    return this.stats().edges[edgeId] ?? { hops: 0, errors: 0 };
  }

  private async loadTemplates(): Promise<void> {
    try {
      const list = await this.api.listTemplates();
      this.templates.set(list.length > 0 ? list : BUILTIN_FALLBACK_TEMPLATES);
    } catch {
      if (this.templates().length === 0) {
        this.templates.set(BUILTIN_FALLBACK_TEMPLATES);
      }
    }
  }

  private async loadProjectsAndConnect(): Promise<void> {
    try {
      const list = await this.api.listProjects();
      this.projects.set(list);
      this.backendOnline.set(true);
      if (list.length > 0) {
        const firstId = list[0].id;
        this.selectedProjectId.set(firstId);
        await this.loadProjectData(firstId);
        await this.connectWebSocket(firstId);
      }
    } catch (err) {
      this.backendOnline.set(false);
      this.errorMessage.set('Backend unavailable — start Quarkus on :8080 to stream live telemetry.');
    }
  }

  private async loadProjectData(projectId: string): Promise<void> {
    try {
      const [diagramVer, demoStatus] = await Promise.all([
        this.api.getDiagram(projectId),
        this.api.getDemoStatus(projectId),
      ]);
      this.demoRunning.set(demoStatus.running);
      this.applyDiagramGraph(diagramVer.graph);
      await this.refreshTraces();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load project');
    }
  }

  private applyDiagramGraph(graph: DiagramGraph): void {
    this.inferTemplateFromGraph(graph);
    const profile = resolveTemplateProfile(this.activeTemplateId());
    this.engine.cardWidth = profile.cardWidth;
    this.engine.cardHeight = profile.cardHeight;
    this.engine.setGraph(graph);
    this.diagram.set(graph);
    if (!this.selectedNodeKey() && graph.nodes.length > 0) {
      const preferred = graph.nodes.find((n) => n.type === 'service') ?? graph.nodes[0];
      this.selectedNodeKey.set(preferred.key);
    }
  }

  private inferTemplateFromGraph(graph: DiagramGraph): void {
    const keys = new Set(graph.nodes.map((n) => n.key.toLowerCase()));
    if (keys.has('cart') || keys.has('checkout') || keys.has('paid')) {
      this.activeTemplateId.set('online-shop');
    } else if (keys.has('kafka') || keys.has('dlq')) {
      this.activeTemplateId.set('queue-worker');
    } else if (keys.has('embedding') || keys.has('vector-db') || keys.has('llm')) {
      this.activeTemplateId.set('ai-rag');
    } else {
      this.activeTemplateId.set('microservices');
    }
  }

  private async refreshTraces(): Promise<void> {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    try {
      const traces = await this.api.searchTraces(projectId, { limit: 20 });
      this.recentTraces.set(traces);
      if (traces.length > 0 && !this.selectedTraceDetail()) {
        const detail = await this.api.getTraceDetail(projectId, traces[0].id);
        this.selectedTraceDetail.set(detail);
      }
    } catch {
      // Ignore transient poll errors
    }
  }

  private startTracePolling(): void {
    if (this.tracePollId) clearInterval(this.tracePollId);
    this.tracePollId = setInterval(() => {
      if (this.selectedProjectId() && this.backendOnline()) {
        void this.refreshTraces();
      }
    }, 3500);
  }

  private async connectWebSocket(projectId: string): Promise<void> {
    this.closeWs();
    if (typeof WebSocket === 'undefined') return;
    const ticket = await this.api.issueWsTicket(projectId);
    const url = this.api.getWsUrl(projectId, ticket);
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.wsConnected.set(true);
      this.backendOnline.set(true);
    };

    socket.onclose = () => {
      this.wsConnected.set(false);
      if (this.selectedProjectId() === projectId) {
        this.reconnectTimer = setTimeout(() => {
          void this.connectWebSocket(projectId);
        }, 2500);
      }
    };

    socket.onerror = () => {
      this.wsConnected.set(false);
    };

    socket.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as UiStreamEvent;
        this.handleStreamEvent(ev);
      } catch {
        // Ignore malformed frame
      }
    };
  }

  private closeWs(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected.set(false);
  }

  private handleStreamEvent(ev: UiStreamEvent): void {
    const now = Date.now();
    switch (ev.t) {
      case 'snapshot':
        this.applyDiagramGraph(ev.diagram);
        this.stats.set(ev.stats);
        break;
      case 'spawn':
        this.engine.enqueueSpawn(ev, now);
        break;
      case 'hop':
        this.engine.enqueueHop(ev, now);
        break;
      case 'end':
        this.engine.enqueueEnd(ev, now);
        break;
      case 'carry':
        this.engine.enqueueCarry(ev, now);
        break;
      case 'complete':
        this.engine.enqueueComplete(ev, now);
        break;
      case 'fail':
        this.engine.enqueueFail(ev, now);
        break;
      case 'abandon':
        this.engine.enqueueAbandon(ev, now);
        break;
      case 'crowd':
        this.engine.onCrowd(ev);
        break;
      case 'stats': {
        this.stats.set(ev);
        const total = Object.values(ev.nodes).reduce((s, n) => s + (n?.in ?? 0), 0);
        const prev = this.throughputHistory();
        const nextVal = Math.max(4, Math.min(48, Math.round(total * 2.5)));
        this.throughputHistory.set([...prev.slice(1), nextVal]);
        break;
      }
      case 'diagram_patch': {
        const current = this.diagram();
        const nodes = [...current.nodes];
        const edges = [...current.edges];
        for (const op of ev.ops) {
          if (op.op === 'addNode' && op.node && !nodes.some((n) => n.key === op.node!.key)) {
            nodes.push(op.node);
          }
          if (op.op === 'addEdge' && op.edge && !edges.some((e) => e.id === op.edge!.id)) {
            edges.push(op.edge);
          }
        }
        const updated = { ...current, nodes, edges };
        this.engine.setGraph(updated);
        this.diagram.set(updated);
        break;
      }
    }
  }

  private startAnimationLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = () => {
      const now = Date.now();
      this.engine.step(now);
      this.activeTokens.set(this.engine.getTokens());
      this.ghostEdges.set(this.engine.getGhostEdges());
      this.tickNowMs.set(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private applyThemeToDom(theme: 'dark' | 'light' | 'cozy-light'): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }
}
