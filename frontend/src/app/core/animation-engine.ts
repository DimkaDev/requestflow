import type {
  DiagramEdge,
  DiagramGraph,
  DiagramNode,
  EndEvent,
  HopEvent,
  SpawnEvent,
} from './models';

export interface Point2D {
  x: number;
  y: number;
}

export interface ActiveToken {
  id: string;
  traceId: string;
  branch: string;
  phase: 'spawning' | 'traveling' | 'fading';
  fromNode?: string;
  toNode: string;
  edgeId?: string | null;
  unmapped: boolean;
  status: 'ok' | 'error' | 'warn';
  label?: string | null;
  attrs?: Record<string, unknown>;
  x: number;
  y: number;
  trail: Point2D[];
  progress: number;
  scale: number;
  opacity: number;
  startedAtMs: number;
  durationMs: number;
  staggerOffsetPx: number;
}

export interface NodeVisualEffect {
  nodeKey: string;
  pulseScale: number;
  errorFlash: boolean;
  shakeOffsetPx: number;
  completedTick: boolean;
  expiresAtMs: number;
}

export interface GhostEdge {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  expiresAtMs: number;
}

interface QueuedCommand {
  kind: 'spawn' | 'hop' | 'end';
  receivedAtMs: number;
  spawn?: SpawnEvent;
  hop?: HopEvent;
  end?: EndEvent;
}

export const NODE_CARD_WIDTH = 176;
export const NODE_CARD_HEIGHT = 64;

/**
 * Pure TypeScript Animation & Catch-Up Scheduler (spec section 10.2 & 10.3).
 * Framework-light so it can be unit-tested deterministically and driven by a single requestAnimationFrame loop.
 */
export class AnimationEngine {
  public maxConcurrentTokens = 300;
  public speedMultiplier = 1.0;
  public mode: 'realtime' | 'smooth' = 'realtime';
  public prefersReducedMotion = false;
  public paused = false;

  private graph: DiagramGraph = { schema: 1, direction: 'TB', nodes: [], edges: [] };
  private readonly queues = new Map<string, QueuedCommand[]>();
  private readonly activeTokens = new Map<string, ActiveToken>();
  private readonly nodeEffects = new Map<string, NodeVisualEffect>();
  private readonly ghostEdges = new Map<string, GhostEdge>();
  private edgeOccupancyCounter = 0;
  private samplingActive = false;

  public setGraph(graph: DiagramGraph): void {
    this.graph = graph;
  }

  public getGraph(): DiagramGraph {
    return this.graph;
  }

  public isSampling(): boolean {
    return this.samplingActive;
  }

  public clearAll(): void {
    this.queues.clear();
    this.activeTokens.clear();
    this.nodeEffects.clear();
    this.ghostEdges.clear();
    this.samplingActive = false;
  }

  /**
   * Called when tab returns from hidden state: drops queued hops older than 5s (spec section 10.3).
   */
  public dropStaleQueuedEvents(nowMs: number, maxAgeMs = 5000): void {
    for (const [key, q] of this.queues.entries()) {
      const filtered = q.filter((item) => nowMs - item.receivedAtMs <= maxAgeMs);
      if (filtered.length === 0) {
        this.queues.delete(key);
      } else {
        this.queues.set(key, filtered);
      }
    }
  }

  public enqueueSpawn(ev: SpawnEvent, nowMs: number): void {
    const key = `${ev.traceId}:${ev.branch || 'main'}`;
    const q = this.queues.get(key) ?? [];
    q.push({ kind: 'spawn', receivedAtMs: nowMs, spawn: ev });
    this.queues.set(key, q);
    this.tryAdvanceTrace(key, nowMs);
  }

  public enqueueHop(ev: HopEvent, nowMs: number): void {
    const key = `${ev.traceId}:${ev.branch || 'main'}`;
    const q = this.queues.get(key) ?? [];
    q.push({ kind: 'hop', receivedAtMs: nowMs, hop: ev });
    this.queues.set(key, q);
    this.tryAdvanceTrace(key, nowMs);
  }

  public enqueueEnd(ev: EndEvent, nowMs: number): void {
    const key = `${ev.traceId}:${ev.branch || 'main'}`;
    const q = this.queues.get(key) ?? [];
    q.push({ kind: 'end', receivedAtMs: nowMs, end: ev });
    this.queues.set(key, q);
    this.tryAdvanceTrace(key, nowMs);
  }

  /**
   * Computes the base and catch-up adjusted hop duration per spec section 10.3:
   * Base duration = clamp(600ms / speed, 250ms, 1500ms).
   * In `realtime` mode, if queued events accumulate, duration scales down toward 150ms
   * so a token never lags real time by more than ~2s.
   */
  public computeHopDurationMs(queueDepth: number): number {
    const speed = Math.max(0.25, Math.min(4.0, this.speedMultiplier));
    const base = Math.max(250, Math.min(1500, Math.round(600 / speed)));
    if (this.prefersReducedMotion) {
      return 150;
    }
    if (this.mode === 'realtime' && queueDepth > 0) {
      const catchUpFactor = Math.max(0.25, 1 / (1 + queueDepth * 0.45));
      return Math.max(150, Math.round(base * catchUpFactor));
    }
    return base;
  }

  public step(nowMs: number): void {
    if (this.paused) {
      return;
    }

    // Update active tokens
    for (const [key, token] of this.activeTokens.entries()) {
      const elapsed = Math.max(0, nowMs - token.startedAtMs);
      const rawProgress = token.durationMs > 0 ? Math.min(1, elapsed / token.durationMs) : 1;
      token.progress = rawProgress;

      if (token.phase === 'spawning') {
        token.scale = 0.4 + 0.6 * this.easeOutBack(rawProgress);
        token.opacity = rawProgress;
        if (rawProgress >= 1) {
          this.activeTokens.delete(key);
          this.tryAdvanceTrace(key, nowMs);
        }
      } else if (token.phase === 'traveling') {
        const eased = this.prefersReducedMotion ? 1 : this.easeInOutCubic(rawProgress);
        const pos = this.interpolateEdgePosition(
          token.fromNode!,
          token.toNode,
          eased,
          token.staggerOffsetPx
        );
        token.x = pos.x;
        token.y = pos.y;

        // Build fading trail points along the recently traversed segment
        if (!this.prefersReducedMotion) {
          const trailPoints: Point2D[] = [];
          const steps = 6;
          for (let i = 1; i <= steps; i++) {
            const trailT = Math.max(0, eased - i * 0.045);
            trailPoints.push(
              this.interpolateEdgePosition(
                token.fromNode!,
                token.toNode,
                trailT,
                token.staggerOffsetPx
              )
            );
          }
          token.trail = trailPoints;
        } else {
          token.trail = [];
        }

        if (rawProgress >= 1) {
          // Arrival at target node: trigger pulse or error flash/shake
          this.triggerNodeArrivalEffect(token.toNode, token.status === 'error', false, nowMs);
          this.activeTokens.delete(key);
          this.tryAdvanceTrace(key, nowMs);
        }
      } else if (token.phase === 'fading') {
        token.scale = Math.max(0.1, 1 - rawProgress * 0.8);
        token.opacity = Math.max(0, 1 - rawProgress);
        if (rawProgress >= 1) {
          this.activeTokens.delete(key);
          this.tryAdvanceTrace(key, nowMs);
        }
      }
    }

    // Advance any idle queues
    for (const key of Array.from(this.queues.keys())) {
      if (!this.activeTokens.has(key)) {
        this.tryAdvanceTrace(key, nowMs);
      }
    }

    // Update node effects
    for (const [nodeKey, eff] of this.nodeEffects.entries()) {
      if (nowMs >= eff.expiresAtMs) {
        this.nodeEffects.delete(nodeKey);
      } else {
        const remaining = eff.expiresAtMs - nowMs;
        const progress = 1 - remaining / 300;
        eff.pulseScale = 1 + 0.05 * Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
        if (eff.errorFlash && remaining > 100) {
          eff.shakeOffsetPx = Math.sin(nowMs * 0.09) * 4;
        } else {
          eff.shakeOffsetPx = 0;
        }
      }
    }

    // Expire ghost edges
    for (const [id, ghost] of this.ghostEdges.entries()) {
      if (nowMs >= ghost.expiresAtMs) {
        this.ghostEdges.delete(id);
      }
    }

    this.samplingActive = this.activeTokens.size >= this.maxConcurrentTokens;
  }

  public getTokens(): ActiveToken[] {
    return Array.from(this.activeTokens.values());
  }

  public getNodeEffect(nodeKey: string): NodeVisualEffect | undefined {
    return this.nodeEffects.get(nodeKey);
  }

  public getGhostEdges(): GhostEdge[] {
    return Array.from(this.ghostEdges.values());
  }

  private tryAdvanceTrace(key: string, nowMs: number): void {
    if (this.activeTokens.has(key)) {
      return;
    }
    const q = this.queues.get(key);
    if (!q || q.length === 0) {
      this.queues.delete(key);
      return;
    }

    const next = q.shift()!;
    if (q.length === 0) {
      this.queues.delete(key);
    }

    if (this.activeTokens.size >= this.maxConcurrentTokens) {
      this.samplingActive = true;
      return;
    }

    if (next.kind === 'spawn' && next.spawn) {
      const ev = next.spawn;
      const center = this.getNodeCenter(ev.node);
      const duration = this.prefersReducedMotion ? 80 : 200;
      this.activeTokens.set(key, {
        id: `tok_${ev.traceId}_${ev.branch}`,
        traceId: ev.traceId,
        branch: ev.branch || 'main',
        phase: 'spawning',
        toNode: ev.node,
        unmapped: false,
        status: ev.status === 'error' ? 'error' : 'ok',
        label: ev.label,
        attrs: ev.attrs,
        x: center.x,
        y: center.y,
        trail: [],
        progress: 0,
        scale: 0.4,
        opacity: 0,
        startedAtMs: nowMs,
        durationMs: duration,
        staggerOffsetPx: 0,
      });
      this.triggerNodeArrivalEffect(ev.node, ev.status === 'error', false, nowMs);
    } else if (next.kind === 'hop' && next.hop) {
      const ev = next.hop;
      const duration = this.computeHopDurationMs(q.length);
      const startPos = this.getNodeOutputPort(ev.from);
      const stagger = ((this.edgeOccupancyCounter++ % 5) - 2) * 3.5;

      const edgeObj = this.findEdge(ev.from, ev.to);
      const isDiscovered = Boolean(edgeObj?.discovered);
      const isUnmapped = Boolean(ev.unmapped || !edgeObj);

      let tokenStatus: 'ok' | 'error' | 'warn' = 'ok';
      if (ev.status === 'error') {
        tokenStatus = 'error';
      } else if (isUnmapped || isDiscovered) {
        tokenStatus = 'warn';
      }

      if (isUnmapped) {
        const endPos = this.getNodeInputPort(ev.to);
        const ghostId = `ghost_${ev.from}_${ev.to}`;
        this.ghostEdges.set(ghostId, {
          id: ghostId,
          from: ev.from,
          to: ev.to,
          x1: startPos.x,
          y1: startPos.y,
          x2: endPos.x,
          y2: endPos.y,
          expiresAtMs: nowMs + duration + 150,
        });
      }

      this.activeTokens.set(key, {
        id: `tok_${ev.traceId}_${ev.branch}`,
        traceId: ev.traceId,
        branch: ev.branch || 'main',
        phase: 'traveling',
        fromNode: ev.from,
        toNode: ev.to,
        edgeId: ev.edgeId ?? edgeObj?.id ?? null,
        unmapped: isUnmapped,
        status: tokenStatus,
        label: ev.label,
        attrs: ev.attrs,
        x: startPos.x,
        y: startPos.y,
        trail: [],
        progress: 0,
        scale: 1,
        opacity: 1,
        startedAtMs: nowMs,
        durationMs: duration,
        staggerOffsetPx: stagger,
      });
    } else if (next.kind === 'end' && next.end) {
      const ev = next.end;
      const center = this.getNodeCenter(ev.node);
      const duration = this.prefersReducedMotion ? 80 : 300;
      this.activeTokens.set(key, {
        id: `tok_${ev.traceId}_${ev.branch}`,
        traceId: ev.traceId,
        branch: ev.branch || 'main',
        phase: 'fading',
        toNode: ev.node,
        unmapped: false,
        status: 'ok',
        x: center.x,
        y: center.y,
        trail: [],
        progress: 0,
        scale: 1,
        opacity: 1,
        startedAtMs: nowMs,
        durationMs: duration,
        staggerOffsetPx: 0,
      });
      this.triggerNodeArrivalEffect(ev.node, false, true, nowMs);
    }
  }

  private triggerNodeArrivalEffect(
    nodeKey: string,
    isError: boolean,
    completed: boolean,
    nowMs: number
  ): void {
    this.nodeEffects.set(nodeKey, {
      nodeKey,
      pulseScale: 1.05,
      errorFlash: isError,
      shakeOffsetPx: isError ? 4 : 0,
      completedTick: completed,
      expiresAtMs: nowMs + 300,
    });
  }

  public getNodeCenter(nodeKey: string): Point2D {
    const node = this.graph.nodes.find((n) => n.key === nodeKey);
    if (!node) {
      return { x: 0, y: 0 };
    }
    return {
      x: node.x + NODE_CARD_WIDTH / 2,
      y: node.y + NODE_CARD_HEIGHT / 2,
    };
  }

  public getNodeOutputPort(nodeKey: string): Point2D {
    const node = this.graph.nodes.find((n) => n.key === nodeKey);
    if (!node) {
      return { x: 0, y: 0 };
    }
    return {
      x: node.x + NODE_CARD_WIDTH / 2,
      y: node.y + NODE_CARD_HEIGHT,
    };
  }

  public getNodeInputPort(nodeKey: string): Point2D {
    const node = this.graph.nodes.find((n) => n.key === nodeKey);
    if (!node) {
      return { x: 0, y: 0 };
    }
    return {
      x: node.x + NODE_CARD_WIDTH / 2,
      y: node.y,
    };
  }

  /**
   * Builds a smooth cubic Bezier SVG path string between two nodes.
   */
  public buildEdgeSvgPath(fromKey: string, toKey: string): string {
    const p0 = this.getNodeOutputPort(fromKey);
    const p3 = this.getNodeInputPort(toKey);
    const dy = Math.max(48, Math.abs(p3.y - p0.y) * 0.5);
    const c1x = p0.x;
    const c1y = p0.y + dy;
    const c2x = p3.x;
    const c2y = p3.y - dy;
    return `M ${p0.x} ${p0.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p3.x} ${p3.y}`;
  }

  public interpolateEdgePosition(
    fromKey: string,
    toKey: string,
    t: number,
    staggerOffsetPx = 0
  ): Point2D {
    const p0 = this.getNodeOutputPort(fromKey);
    const p3 = this.getNodeInputPort(toKey);
    const dy = Math.max(48, Math.abs(p3.y - p0.y) * 0.5);
    const p1 = { x: p0.x, y: p0.y + dy };
    const p2 = { x: p3.x, y: p3.y - dy };

    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x =
      uuu * p0.x +
      3 * uu * t * p1.x +
      3 * u * tt * p2.x +
      ttt * p3.x +
      staggerOffsetPx;
    const y =
      uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

    return { x, y };
  }

  private findEdge(from: string, to: string): DiagramEdge | undefined {
    return this.graph.edges.find((e) => e.from === from && e.to === to);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}
