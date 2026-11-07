import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_NAME, APP_TAGLINE } from './core/branding';
import { FlowTraceApiService } from './core/api.service';
import {
  ActiveToken,
  AnimationEngine,
  GhostEdge,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  NodeVisualEffect,
} from './core/animation-engine';
import {
  ApiKey,
  DiagramEdge,
  DiagramGraph,
  DiagramNode,
  DiagramVersion,
  NodeType,
  Project,
  TraceDetail,
  TraceSummary,
  UiStreamEvent,
} from './core/models';

type ScreenTab = 'live' | 'traces' | 'projects' | 'settings' | 'login';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(FlowTraceApiService);

  public readonly appName = APP_NAME;
  public readonly appTagline = APP_TAGLINE;
  public readonly nodeWidth = NODE_CARD_WIDTH;
  public readonly nodeHeight = NODE_CARD_HEIGHT;
  public readonly Math = Math;

  // Navigation & Theme
  public readonly activeScreen = signal<ScreenTab>('live');
  public readonly theme = signal<'dark' | 'light'>('dark');
  public readonly editorMode = signal<boolean>(false);

  // Projects & Current Project
  public readonly projects = signal<Project[]>([]);
  public readonly currentProject = signal<Project | null>(null);
  public readonly diagramVersion = signal<number>(1);
  public readonly diagramVersions = signal<DiagramVersion[]>([]);
  public readonly graph = signal<DiagramGraph>({
    schema: 1,
    direction: 'TB',
    nodes: [],
    edges: [],
  });

  // Live Stream & Animation State
  public readonly engine = new AnimationEngine();
  public readonly wsConnected = signal<boolean>(false);
  public readonly livePaused = signal<boolean>(false);
  public readonly speedMultiplier = signal<number>(1.0);
  public readonly scheduleMode = signal<'realtime' | 'smooth'>('realtime');
  public readonly showLabels = signal<boolean>(true);
  public readonly showCounters = signal<boolean>(true);
  public readonly demoRunning = signal<boolean>(true);
  public readonly demoRate = signal<number>(2.5);
  public readonly droppedWsCount = signal<number>(0);
  public readonly samplingActive = signal<boolean>(false);

  // Render frame state
  public readonly visibleTokens = signal<ActiveToken[]>([]);
  public readonly ghostEdges = signal<GhostEdge[]>([]);
  public readonly nodeRates = signal<Record<string, number>>({});
  public readonly nodeTotals = signal<Record<string, number>>({});
  public readonly edgeHeat = signal<Record<string, number>>({});

  // Canvas Pan/Zoom & Interaction
  public readonly panX = signal<number>(520);
  public readonly panY = signal<number>(70);
  public readonly zoom = signal<number>(0.92);
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private draggingNodeKey: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  public readonly connectingFromNode = signal<string | null>(null);
  public readonly pointerCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inspector & Selection
  public readonly selectedNodeKey = signal<string | null>(null);
  public readonly selectedEdgeId = signal<string | null>(null);
  public readonly selectedTraceDetail = signal<TraceDetail | null>(null);
  public readonly traceSearchFilter = signal<string>('');
  public readonly recentTraces = signal<TraceSummary[]>([]);
  public readonly highlightedTraceNodes = signal<Set<string>>(new Set());

  // Editor Undo/Redo & Autosave
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  public readonly saveStatus = signal<'saved' | 'saving' | 'unsaved'>('saved');
  public readonly paletteTypes: Array<{ type: NodeType; label: string; icon: string }> = [
    { type: 'source', label: 'Source / Entry', icon: 'globe' },
    { type: 'service', label: 'Microservice', icon: 'cpu' },
    { type: 'decision', label: 'Branch / If', icon: 'git-branch' },
    { type: 'datastore', label: 'Database', icon: 'database' },
    { type: 'queue', label: 'Queue / Topic', icon: 'layers' },
    { type: 'external', label: 'External API', icon: 'cloud' },
    { type: 'end', label: 'End / Sink', icon: 'check-circle' },
  ];

  // Replay State (M5)
  public readonly replayActive = signal<boolean>(false);
  public readonly replayProgress = signal<number>(0);
  private replayTimers: Array<ReturnType<typeof setTimeout>> = [];

  // Settings & API Keys (M3)
  public readonly apiKeys = signal<ApiKey[]>([]);
  public readonly newlyCreatedKey = signal<string>('ft_live_demo0000000000000000000000000000');
  public readonly newKeyName = signal<string>('Production Service Key');
  public readonly newProjectName = signal<string>('');
  public readonly copiedHint = signal<string>('');

  // Login / Auth state
  public readonly loginEmail = signal<string>('dev@flowtrace.local');

  // Computed helpers
  public readonly selectedNode = computed(() => {
    const key = this.selectedNodeKey();
    if (!key) return null;
    return this.graph().nodes.find((n) => n.key === key) ?? null;
  });

  public readonly selectedEdge = computed(() => {
    const id = this.selectedEdgeId();
    if (!id) return null;
    return this.graph().edges.find((e) => e.id === id) ?? null;
  });

  public readonly filteredTokens = computed(() => {
    const prefix = this.traceSearchFilter().trim().toLowerCase();
    const all = this.visibleTokens();
    if (!prefix) return all;
    return all.filter((t) => t.traceId.toLowerCase().startsWith(prefix));
  });

  public readonly discoveredEdges = computed(() =>
    this.graph().edges.filter((e) => e.discovered)
  );

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private rafId: number | null = null;
  private visibilityListener = () => this.onVisibilityChange();

  public async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (mq?.matches) {
        this.engine.prefersReducedMotion = true;
      }
      document.addEventListener('visibilitychange', this.visibilityListener);
      this.startAnimationLoop();
    }
    await this.loadInitialData();
  }

  public ngOnDestroy(): void {
    this.closeWebSocket();
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
      }
    }
    this.clearReplayTimers();
  }

  private async loadInitialData(): Promise<void> {
    try {
      const list = await this.api.listProjects();
      this.projects.set(list);
      if (list.length > 0) {
        await this.selectProject(list[0]);
      }
    } catch {
      // Fallback sample diagram if backend is still starting
      const fallback: DiagramGraph = {
        schema: 1,
        direction: 'TB',
        nodes: [
          { key: 'website', label: 'Website', type: 'source', x: 0, y: 0, icon: 'globe' },
          { key: 'lb', label: 'Load Balancer', type: 'service', x: 0, y: 150, icon: 'server' },
          { key: 'if-premium', label: 'Premium?', type: 'decision', x: 0, y: 300, icon: 'git-branch' },
          { key: 'service-a', label: 'Service A', type: 'service', x: -200, y: 450, icon: 'cpu' },
          { key: 'service-b', label: 'Service B', type: 'service', x: 200, y: 450, icon: 'cpu' },
          { key: 'db', label: 'Database', type: 'datastore', x: 0, y: 600, icon: 'database' },
        ],
        edges: [
          { id: 'e1', from: 'website', to: 'lb' },
          { id: 'e2', from: 'lb', to: 'if-premium' },
          { id: 'e3', from: 'if-premium', to: 'service-a', label: 'yes' },
          { id: 'e4', from: 'if-premium', to: 'service-b', label: 'no' },
          { id: 'e5', from: 'service-a', to: 'db' },
          { id: 'e6', from: 'service-b', to: 'db' },
        ],
      };
      this.setDiagramGraph(fallback, false);
    }
  }

  public async selectProject(project: Project): Promise<void> {
    this.currentProject.set(project);
    this.engine.clearAll();
    this.nodeTotals.set({});
    this.nodeRates.set({});
    this.edgeHeat.set({});
    this.selectedNodeKey.set(null);
    this.selectedEdgeId.set(null);
    this.selectedTraceDetail.set(null);

    try {
      const [diag, keys, demo, traces, versions] = await Promise.all([
        this.api.getDiagram(project.id),
        this.api.listKeys(project.id),
        this.api.getDemoStatus(project.id),
        this.api.searchTraces(project.id, { limit: 25 }),
        this.api.listDiagramVersions(project.id),
      ]);
      this.diagramVersion.set(diag.version);
      this.diagramVersions.set(versions);
      this.setDiagramGraph(diag.graph, false);
      this.apiKeys.set(keys);
      this.demoRunning.set(demo.running);
      if (demo.rate) this.demoRate.set(demo.rate);
      this.recentTraces.set(traces);
    } catch {
      // ignore
    }

    await this.connectWebSocket(project.id);
  }

  private async connectWebSocket(projectId: string): Promise<void> {
    this.closeWebSocket();
    if (typeof window === 'undefined') return;

    const ticket = await this.api.issueWsTicket(projectId);
    const url = this.api.getWsUrl(projectId, ticket);

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.wsConnected.set(true);
        this.reconnectAttempt = 0;
      };

      socket.onmessage = (msgEvent) => {
        try {
          const payload = JSON.parse(msgEvent.data) as UiStreamEvent;
          this.handleStreamEvent(payload);
        } catch {
          // ignore malformed
        }
      };

      socket.onclose = () => {
        this.wsConnected.set(false);
        const cur = this.currentProject();
        if (cur && cur.id === projectId) {
          const delay = Math.min(8000, 500 * Math.pow(1.6, this.reconnectAttempt++));
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(projectId), delay);
        }
      };
    } catch {
      this.wsConnected.set(false);
    }
  }

  private closeWebSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected.set(false);
  }

  private handleStreamEvent(ev: UiStreamEvent): void {
    if (this.replayActive()) {
      return;
    }
    const now = performance.now();

    switch (ev.t) {
      case 'snapshot': {
        this.setDiagramGraph(ev.diagram, false);
        break;
      }
      case 'spawn': {
        this.engine.enqueueSpawn(ev, now);
        this.incrementNodeTotal(ev.node);
        break;
      }
      case 'hop': {
        this.engine.enqueueHop(ev, now);
        this.incrementNodeTotal(ev.to);
        break;
      }
      case 'end': {
        this.engine.enqueueEnd(ev, now);
        break;
      }
      case 'diagram_patch': {
        let updated = structuredClone(this.graph());
        for (const op of ev.ops) {
          if (op.op === 'addNode' && op.node) {
            if (!updated.nodes.some((n) => n.key === op.node!.key)) {
              updated.nodes.push(op.node);
            }
          } else if (op.op === 'addEdge' && op.edge) {
            if (!updated.edges.some((e) => e.from === op.edge!.from && e.to === op.edge!.to)) {
              updated.edges.push(op.edge);
            }
          }
        }
        this.setDiagramGraph(updated, false);
        break;
      }
      case 'stats': {
        const rates: Record<string, number> = {};
        for (const [nodeKey, metric] of Object.entries(ev.nodes || {})) {
          rates[nodeKey] = metric.in;
        }
        this.nodeRates.set(rates);

        const heat: Record<string, number> = {};
        for (const [edgeId, metric] of Object.entries(ev.edges || {})) {
          heat[edgeId] = metric.hops;
        }
        this.edgeHeat.set(heat);
        break;
      }
      case 'dropped': {
        this.droppedWsCount.update((c) => c + ev.count);
        break;
      }
    }
  }

  private incrementNodeTotal(nodeKey: string): void {
    this.nodeTotals.update((prev) => ({
      ...prev,
      [nodeKey]: (prev[nodeKey] ?? 0) + 1,
    }));
  }

  private startAnimationLoop(): void {
    const tick = (now: number) => {
      this.engine.step(now);
      this.visibleTokens.set(this.engine.getTokens());
      this.ghostEdges.set(this.engine.getGhostEdges());
      this.samplingActive.set(this.engine.isSampling());
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.engine.paused = true;
    } else {
      this.engine.dropStaleQueuedEvents(performance.now(), 5000);
      this.engine.paused = this.livePaused();
    }
  }

  // Toolbar controls
  public togglePause(): void {
    const next = !this.livePaused();
    this.livePaused.set(next);
    this.engine.paused = next;
  }

  public setSpeed(mult: number): void {
    this.speedMultiplier.set(mult);
    this.engine.speedMultiplier = mult;
  }

  public toggleScheduleMode(): void {
    const next = this.scheduleMode() === 'realtime' ? 'smooth' : 'realtime';
    this.scheduleMode.set(next);
    this.engine.mode = next;
  }

  public toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  public toggleEditorMode(): void {
    this.editorMode.update((v) => !v);
    this.connectingFromNode.set(null);
  }

  public async toggleDemoSimulator(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    if (this.demoRunning()) {
      await this.api.stopDemo(proj.id);
      this.demoRunning.set(false);
    } else {
      await this.api.startDemo(proj.id, this.demoRate(), 0.04);
      this.demoRunning.set(true);
    }
  }

  public fitToScreen(): void {
    this.panX.set(520);
    this.panY.set(70);
    this.zoom.set(0.92);
  }

  // Canvas Pointer Events (Pan, Zoom, Node Drag, Port Connection)
  public onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.max(0.35, Math.min(2.2, this.zoom() * factor));
    this.zoom.set(Number(nextZoom.toFixed(3)));
  }

  public onCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.node-group') || target.closest('.edge-group')) {
      return;
    }
    this.isPanning = true;
    this.panStartX = event.clientX - this.panX();
    this.panStartY = event.clientY - this.panY();
    this.selectedNodeKey.set(null);
    this.selectedEdgeId.set(null);
    this.connectingFromNode.set(null);
  }

  public onCanvasMouseMove(event: MouseEvent): void {
    const svgRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const worldX = (event.clientX - svgRect.left - this.panX()) / this.zoom();
    const worldY = (event.clientY - svgRect.top - this.panY()) / this.zoom();
    this.pointerCanvasPos.set({ x: worldX, y: worldY });

    if (this.isPanning) {
      this.panX.set(event.clientX - this.panStartX);
      this.panY.set(event.clientY - this.panStartY);
      return;
    }

    if (this.draggingNodeKey && this.editorMode()) {
      const newX = Math.round((worldX - this.dragOffsetX) / 10) * 10;
      const newY = Math.round((worldY - this.dragOffsetY) / 10) * 10;
      const updated = structuredClone(this.graph());
      const node = updated.nodes.find((n) => n.key === this.draggingNodeKey);
      if (node) {
        node.x = newX;
        node.y = newY;
        this.graph.set(updated);
        this.engine.setGraph(updated);
      }
    }
  }

  public onCanvasMouseUp(): void {
    if (this.draggingNodeKey) {
      this.draggingNodeKey = null;
      this.scheduleAutosave();
    }
    this.isPanning = false;
  }

  public onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    event.stopPropagation();
    this.selectedNodeKey.set(node.key);
    this.selectedEdgeId.set(null);
    this.refreshInspectorTraces(node.key);

    if (this.editorMode()) {
      this.pushUndoSnapshot();
      this.draggingNodeKey = node.key;
      const pos = this.pointerCanvasPos();
      this.dragOffsetX = pos.x - node.x;
      this.dragOffsetY = pos.y - node.y;
    }
  }

  public onStartConnectPort(event: MouseEvent, fromNodeKey: string): void {
    event.stopPropagation();
    if (!this.editorMode()) return;
    this.connectingFromNode.set(fromNodeKey);
  }

  public onCompleteConnectPort(event: MouseEvent, toNodeKey: string): void {
    event.stopPropagation();
    const fromKey = this.connectingFromNode();
    this.connectingFromNode.set(null);
    if (!fromKey || fromKey === toNodeKey) return;

    const current = this.graph();
    if (current.edges.some((e) => e.from === fromKey && e.to === toNodeKey)) {
      return;
    }

    this.pushUndoSnapshot();
    const updated = structuredClone(current);
    updated.edges.push({
      id: `e_${Date.now()}`,
      from: fromKey,
      to: toNodeKey,
      discovered: false,
    });
    this.setDiagramGraph(updated, true);
  }

  public onSelectEdge(event: MouseEvent, edge: DiagramEdge): void {
    event.stopPropagation();
    this.selectedEdgeId.set(edge.id);
    this.selectedNodeKey.set(null);
  }

  public onSelectToken(event: MouseEvent, token: ActiveToken): void {
    event.stopPropagation();
    this.openTraceDetail(token.traceId);
  }

  // Editor Operations (M4)
  public addNodeFromPalette(type: NodeType, labelPrefix: string, icon: string): void {
    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    const idx = updated.nodes.length + 1;
    const rawLabel = `${labelPrefix} ${idx}`;
    const key = this.slugifyKey(rawLabel, updated.nodes);
    const maxY = updated.nodes.reduce((m, n) => Math.max(m, n.y), 0);
    updated.nodes.push({
      key,
      label: rawLabel,
      type,
      x: 0,
      y: updated.nodes.length === 0 ? 0 : maxY + 150,
      icon,
      discovered: false,
    });
    this.setDiagramGraph(updated, true);
    this.selectedNodeKey.set(key);
  }

  public updateSelectedNodeLabel(newLabel: string): void {
    const key = this.selectedNodeKey();
    if (!key) return;
    const updated = structuredClone(this.graph());
    const node = updated.nodes.find((n) => n.key === key);
    if (!node) return;
    node.label = newLabel;
    this.setDiagramGraph(updated, true);
  }

  public updateSelectedNodeKey(newKeyRaw: string): void {
    const oldKey = this.selectedNodeKey();
    if (!oldKey) return;
    const clean = newKeyRaw
      .toLowerCase()
      .replace(/[^a-z0-9-_.]/g, '-')
      .slice(0, 64);
    if (!clean || clean === oldKey) return;
    const updated = structuredClone(this.graph());
    if (updated.nodes.some((n) => n.key === clean)) return;

    const node = updated.nodes.find((n) => n.key === oldKey);
    if (!node) return;
    this.pushUndoSnapshot();
    node.key = clean;
    for (const edge of updated.edges) {
      if (edge.from === oldKey) edge.from = clean;
      if (edge.to === oldKey) edge.to = clean;
    }
    this.selectedNodeKey.set(clean);
    this.setDiagramGraph(updated, true);
  }

  public deleteSelectedElement(): void {
    const nodeKey = this.selectedNodeKey();
    const edgeId = this.selectedEdgeId();
    if (!nodeKey && !edgeId) return;

    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    if (nodeKey) {
      updated.nodes = updated.nodes.filter((n) => n.key !== nodeKey);
      updated.edges = updated.edges.filter((e) => e.from !== nodeKey && e.to !== nodeKey);
      this.selectedNodeKey.set(null);
    } else if (edgeId) {
      updated.edges = updated.edges.filter((e) => e.id !== edgeId);
      this.selectedEdgeId.set(null);
    }
    this.setDiagramGraph(updated, true);
  }

  public acceptDiscoveredEdge(edgeId: string): void {
    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    const edge = updated.edges.find((e) => e.id === edgeId);
    if (edge) {
      edge.discovered = false;
      const fromNode = updated.nodes.find((n) => n.key === edge.from);
      const toNode = updated.nodes.find((n) => n.key === edge.to);
      if (fromNode) fromNode.discovered = false;
      if (toNode) toNode.discovered = false;
      this.setDiagramGraph(updated, true);
    }
  }

  public rejectDiscoveredEdge(edgeId: string): void {
    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    updated.edges = updated.edges.filter((e) => e.id !== edgeId);
    this.setDiagramGraph(updated, true);
  }

  public autoLayoutDiagram(): void {
    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    // Topological / BFS layered layout (Top-to-Bottom)
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of updated.nodes) {
      inDegree.set(n.key, 0);
      adj.set(n.key, []);
    }
    for (const e of updated.edges) {
      if (adj.has(e.from) && inDegree.has(e.to)) {
        adj.get(e.from)!.push(e.to);
        inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
      }
    }

    const layerByNode = new Map<string, number>();
    const queue: string[] = [];
    for (const [k, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(k);
        layerByNode.set(k, 0);
      }
    }
    if (queue.length === 0 && updated.nodes.length > 0) {
      queue.push(updated.nodes[0].key);
      layerByNode.set(updated.nodes[0].key, 0);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      const uLayer = layerByNode.get(u) ?? 0;
      for (const v of adj.get(u) ?? []) {
        if (!layerByNode.has(v) || (layerByNode.get(v) ?? 0) < uLayer + 1) {
          layerByNode.set(v, uLayer + 1);
          if (!queue.includes(v)) queue.push(v);
        }
      }
    }

    const groups = new Map<number, DiagramNode[]>();
    for (const n of updated.nodes) {
      const l = layerByNode.get(n.key) ?? 0;
      const arr = groups.get(l) ?? [];
      arr.push(n);
      groups.set(l, arr);
    }

    for (const [layer, nodes] of groups.entries()) {
      const totalWidth = (nodes.length - 1) * 240;
      nodes.forEach((n, idx) => {
        n.x = -totalWidth / 2 + idx * 240;
        n.y = layer * 160;
      });
    }

    this.setDiagramGraph(updated, true);
    this.fitToScreen();
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    const prevJson = this.undoStack.pop()!;
    this.redoStack.push(JSON.stringify(this.graph()));
    this.setDiagramGraph(JSON.parse(prevJson), true);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const nextJson = this.redoStack.pop()!;
    this.undoStack.push(JSON.stringify(this.graph()));
    this.setDiagramGraph(JSON.parse(nextJson), true);
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private pushUndoSnapshot(): void {
    this.undoStack.push(JSON.stringify(this.graph()));
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private setDiagramGraph(graph: DiagramGraph, shouldSave: boolean): void {
    this.graph.set(graph);
    this.engine.setGraph(graph);
    if (shouldSave) {
      this.scheduleAutosave();
    }
  }

  private scheduleAutosave(): void {
    this.saveStatus.set('unsaved');
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      this.saveDiagramNow();
    }, 1500);
  }

  public async saveDiagramNow(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    this.saveStatus.set('saving');
    try {
      const saved = await this.api.saveDiagram(proj.id, this.graph());
      this.diagramVersion.set(saved.version);
      this.saveStatus.set('saved');
    } catch {
      this.saveStatus.set('unsaved');
    }
  }

  public exportDiagramJson(): void {
    const data = JSON.stringify(this.graph(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowtrace-diagram-v${this.diagramVersion()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Traces & Replay (M5)
  public async refreshInspectorTraces(nodeKey?: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      const list = await this.api.searchTraces(proj.id, {
        node: nodeKey,
        cursor: this.traceSearchFilter() || undefined,
        limit: 30,
      });
      this.recentTraces.set(list);
    } catch {
      // ignore
    }
  }

  public async openTraceDetail(traceId: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      const detail = await this.api.getTraceDetail(proj.id, traceId);
      this.selectedTraceDetail.set(detail);
      const visited = new Set<string>();
      for (const ev of detail.events) {
        visited.add(ev.node);
        if (ev.fromNode) visited.add(ev.fromNode);
      }
      this.highlightedTraceNodes.set(visited);
    } catch {
      // ignore
    }
  }

  public replayTraceOnCanvas(detail: TraceDetail): void {
    this.clearReplayTimers();
    this.activeScreen.set('live');
    this.replayActive.set(true);
    this.replayProgress.set(0);
    this.engine.clearAll();

    const events = detail.events;
    if (events.length === 0) {
      this.replayActive.set(false);
      return;
    }

    const baseTs = new Date(events[0].serverTs).getTime();
    const lastTs = new Date(events[events.length - 1].serverTs).getTime();
    const totalSpanMs = Math.max(800, lastTs - baseTs);

    events.forEach((ev, index) => {
      const evTs = new Date(ev.serverTs).getTime();
      const relativeDelay = Math.max(index * 280, (evTs - baseTs) / this.speedMultiplier());

      const timer = setTimeout(() => {
        const now = performance.now();
        this.replayProgress.set(Math.round(((index + 1) / events.length) * 100));
        if (!ev.fromNode) {
          this.engine.enqueueSpawn(
            {
              t: 'spawn',
              traceId: ev.traceId,
              branch: ev.branch,
              node: ev.node,
              status: ev.type === 'error' ? 'error' : 'ok',
              label: ev.label,
              attrs: ev.attrs,
              ts: now,
            },
            now
          );
        } else {
          const edge = this.graph().edges.find(
            (e) => e.from === ev.fromNode && e.to === ev.node
          );
          this.engine.enqueueHop(
            {
              t: 'hop',
              traceId: ev.traceId,
              branch: ev.branch,
              from: ev.fromNode,
              to: ev.node,
              edgeId: edge?.id ?? null,
              unmapped: !edge,
              status: ev.type === 'error' ? 'error' : 'ok',
              label: ev.label,
              attrs: ev.attrs,
              ts: now,
              seq: ev.seq,
            },
            now
          );
        }
        if (ev.type === 'end' || index === events.length - 1) {
          const endTimer = setTimeout(() => {
            this.engine.enqueueEnd(
              {
                t: 'end',
                traceId: ev.traceId,
                branch: ev.branch,
                node: ev.node,
                ts: performance.now(),
              },
              performance.now()
            );
            this.replayActive.set(false);
          }, 650);
          this.replayTimers.push(endTimer);
        }
      }, relativeDelay);
      this.replayTimers.push(timer);
    });
  }

  public stopReplay(): void {
    this.clearReplayTimers();
    this.replayActive.set(false);
  }

  private clearReplayTimers(): void {
    for (const t of this.replayTimers) {
      clearTimeout(t);
    }
    this.replayTimers = [];
  }

  // Projects & Settings (M3)
  public async createNewProject(): Promise<void> {
    const name = this.newProjectName().trim() || `Service Flow ${this.projects().length + 1}`;
    const created = await this.api.createProject(name, true, 7);
    this.newProjectName.set('');
    const list = await this.api.listProjects();
    this.projects.set(list);
    await this.selectProject(created);
    this.activeScreen.set('live');
  }

  public async generateApiKey(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    const res = await this.api.createKey(proj.id, this.newKeyName(), 1000);
    this.newlyCreatedKey.set(res.fullKey);
    const keys = await this.api.listKeys(proj.id);
    this.apiKeys.set(keys);
  }

  public async revokeKey(keyId: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    await this.api.revokeKey(proj.id, keyId);
    const keys = await this.api.listKeys(proj.id);
    this.apiKeys.set(keys);
  }

  public async toggleProjectAutoDiscover(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    const updated = await this.api.updateProject(proj.id, {
      autoDiscover: !proj.autoDiscover,
    });
    this.currentProject.set(updated);
  }

  public copyText(text: string, label: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    this.copiedHint.set(`Copied ${label}!`);
    setTimeout(() => this.copiedHint.set(''), 2000);
  }

  public signInWithMockCognito(): void {
    const email = this.loginEmail().trim() || 'dev@flowtrace.local';
    this.api.authUserEmail.set(email);
    this.api.authToken.set(email.split('@')[0] || 'local-dev-user');
    this.activeScreen.set('live');
    this.loadInitialData();
  }

  // SVG & Geometry Helpers for Template
  public edgePath(edge: DiagramEdge): string {
    return this.engine.buildEdgeSvgPath(edge.from, edge.to);
  }

  public edgeMidpoint(edge: DiagramEdge): { x: number; y: number } {
    return this.engine.interpolateEdgePosition(edge.from, edge.to, 0.5, 0);
  }

  public edgeStrokeWidth(edge: DiagramEdge): number {
    const hops = this.edgeHeat()[edge.id] ?? 0;
    return Math.min(4.5, 1.8 + hops * 0.35);
  }

  public isEdgeHot(edge: DiagramEdge): boolean {
    return (this.edgeHeat()[edge.id] ?? 0) > 0;
  }

  public getNodeEffect(nodeKey: string): NodeVisualEffect | undefined {
    return this.engine.getNodeEffect(nodeKey);
  }

  public nodeTransform(node: DiagramNode): string {
    const eff = this.engine.getNodeEffect(node.key);
    const shake = eff?.shakeOffsetPx ?? 0;
    const scale = eff?.pulseScale ?? 1;
    const cx = this.nodeWidth / 2;
    const cy = this.nodeHeight / 2;
    if (scale !== 1) {
      return `translate(${node.x + shake}, ${node.y}) translate(${cx}, ${cy}) scale(${scale.toFixed(3)}) translate(${-cx}, ${-cy})`;
    }
    return `translate(${node.x + shake}, ${node.y})`;
  }

  private slugifyKey(label: string, existingNodes: DiagramNode[]): string {
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'node';
    let candidate = base;
    let counter = 2;
    while (existingNodes.some((n) => n.key === candidate)) {
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }
}
