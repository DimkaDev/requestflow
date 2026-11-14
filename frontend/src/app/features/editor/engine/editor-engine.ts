import type {
  CarryItem,
  DiagramEdge,
  DiagramGroup,
  DiagramGraph,
  DiagramNode,
  EditorEntitlements,
  EntityInfo,
  UiStreamEvent,
} from '../../../core/models';
import type { CatalogBlock } from '../catalog/catalog-registry';

const VALID_KEY_REGEX = /^[a-z0-9-_.]{1,64}$/;

export function isValidNodeKey(key: string): boolean {
  if (!key) return false;
  return VALID_KEY_REGEX.test(key);
}

export function slugifyKey(input: string): string {
  const cleaned = (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'block').slice(0, 56);
}

export function ensureUniqueKey(
  basePattern: string,
  existingKeys: Iterable<string>,
  excludeKey?: string,
): string {
  const base = slugifyKey(basePattern);
  const taken = new Set<string>();
  for (const k of existingKeys) {
    if (k !== excludeKey) taken.add(k);
  }
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`.slice(0, 64);
}

export function resolveAliasOrNodeKey(graph: DiagramGraph, rawKey: string): string {
  if (!rawKey) return rawKey;
  if (graph.nodes.some((n) => n.key === rawKey)) return rawKey;
  for (const node of graph.nodes) {
    const aliases = node.props?.aliases;
    if (Array.isArray(aliases) && aliases.includes(rawKey)) return node.key;
  }
  return rawKey;
}

export function migrateDiagramToV2(graph: DiagramGraph | null | undefined): DiagramGraph {
  if (!graph) {
    return {
      schema: 2,
      direction: 'LR',
      gridSnap: true,
      themePreview: 'dark',
      autoDiscovery: true,
      nodes: [],
      edges: [],
      groups: [],
    };
  }

  const nodes: DiagramNode[] = (graph.nodes || []).map((n, index) => {
    const defaultRole =
      n.props?.role ??
      (n.type === 'client'
        ? 'start'
        : n.type === 'decision'
          ? 'decision'
          : n.type === 'end'
            ? 'end'
            : 'normal');
    const defaultShape =
      n.props?.shape ??
      (n.type === 'decision'
        ? 'diamond'
        : n.type === 'client' || n.type === 'end'
          ? 'pill'
          : 'card');

    return {
      ...n,
      key: n.key || `block-${index + 1}`,
      label: n.label || n.key || `Block ${index + 1}`,
      type: n.type || 'service',
      x: Number.isFinite(n.x) ? Math.round(n.x) : 160 + index * 200,
      y: Number.isFinite(n.y) ? Math.round(n.y) : 220,
      icon: n.icon || 'lib:dns',
      props: {
        role: defaultRole,
        tint: n.props?.tint ?? '#0EA5E9',
        size: n.props?.size ?? 'M',
        shape: defaultShape,
        labelPosition: n.props?.labelPosition ?? 'inside',
        showCounter: n.props?.showCounter ?? true,
        locked: n.props?.locked ?? false,
        maxInPorts: n.props?.maxInPorts ?? 'many',
        maxOutPorts: n.props?.maxOutPorts ?? 'many',
        aliases: n.props?.aliases ?? [],
        ...n.props,
      },
    };
  });

  const edges: DiagramEdge[] = (graph.edges || []).map((e, index) => {
    const src = e.source || e.from || '';
    const tgt = e.target || e.to || '';
    return {
      ...e,
      id: e.id || `e-${src}-${tgt}-${index}`,
      from: src,
      to: tgt,
      source: src,
      target: tgt,
      status: e.status ?? (e.discovered ? 'discovered' : 'defined'),
      style: {
        type: e.style?.type ?? (e.style?.lineType as 'curved' | 'straight' | 'step') ?? 'curved',
        lineType: e.style?.lineType ?? e.style?.type ?? 'curved',
        color: e.style?.color ?? 'default',
        thickness: e.style?.thickness ?? 'normal',
        dashed: e.style?.dashed ?? false,
        arrowhead: e.style?.arrowhead ?? 'arrow',
        direction: e.style?.direction ?? 'one-way',
        ...e.style,
      },
      flow: {
        expectedLatencyMs: e.flow?.expectedLatencyMs ?? 400,
        speedMultiplier: e.flow?.speedMultiplier ?? 1,
        tokenStyle: e.flow?.tokenStyle ?? 'inherit',
        terminal: e.flow?.terminal ?? e.flow?.terminalPath ?? false,
        terminalPath: e.flow?.terminalPath ?? e.flow?.terminal ?? false,
        ...e.flow,
      },
    };
  });

  const groups: DiagramGroup[] = (graph.groups || []).map((g, index) => ({
    id: g.id || `group-${index + 1}`,
    name: g.name || `Zone ${index + 1}`,
    color: g.color || '#6366F1',
    x: Number.isFinite(g.x) ? Math.round(g.x) : 100,
    y: Number.isFinite(g.y) ? Math.round(g.y) : 100,
    width: Number.isFinite(g.width) ? Math.max(160, Math.round(g.width)) : 420,
    height: Number.isFinite(g.height) ? Math.max(120, Math.round(g.height)) : 260,
    collapsed: Boolean(g.collapsed),
    locked: Boolean(g.locked),
  }));

  return {
    schema: 2,
    direction: graph.direction === 'TB' ? 'TB' : 'LR',
    gridSnap: graph.gridSnap ?? true,
    themePreview: graph.themePreview ?? 'dark',
    autoDiscovery: graph.autoDiscovery ?? true,
    nodes,
    edges,
    groups,
  };
}

export function cloneGraph(graph: DiagramGraph): DiagramGraph {
  return JSON.parse(JSON.stringify(graph)) as DiagramGraph;
}

export interface EditorHistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  before: DiagramGraph;
  after: DiagramGraph;
}

export class EditorCommandHistory {
  private undoStack: EditorHistoryEntry[] = [];
  private redoStack: EditorHistoryEntry[] = [];
  private readonly maxDepth: number;
  private readonly storageKey?: string;

  constructor(maxDepth = 120, projectId?: string) {
    this.maxDepth = Math.max(100, maxDepth);
    if (projectId) {
      this.storageKey = `flowtrace_editor_history_${projectId}`;
      this.restoreFromStorage();
    }
  }

  record(label: string, before: DiagramGraph, after: DiagramGraph, coalesceKey?: string): void {
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    if (beforeJson === afterJson) return;

    const now = Date.now();
    if (coalesceKey && this.undoStack.length > 0) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (top.id === coalesceKey && now - top.timestamp < 1200) {
        top.after = cloneGraph(after);
        top.timestamp = now;
        this.redoStack = [];
        this.persistToStorage();
        return;
      }
    }

    this.undoStack.push({
      id: coalesceKey || `cmd-${now}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      timestamp: now,
      before: JSON.parse(beforeJson) as DiagramGraph,
      after: JSON.parse(afterJson) as DiagramGraph,
    });

    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.persistToStorage();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): DiagramGraph | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.persistToStorage();
    return cloneGraph(entry.before);
  }

  redo(): DiagramGraph | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.persistToStorage();
    return cloneGraph(entry.after);
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.persistToStorage();
  }

  serialize(): string {
    return JSON.stringify({
      undoStack: this.undoStack.slice(-40),
      redoStack: this.redoStack.slice(-20),
    });
  }

  deserialize(payload: string): void {
    try {
      const parsed = JSON.parse(payload) as {
        undoStack?: EditorHistoryEntry[];
        redoStack?: EditorHistoryEntry[];
      };
      if (Array.isArray(parsed.undoStack)) this.undoStack = parsed.undoStack;
      if (Array.isArray(parsed.redoStack)) this.redoStack = parsed.redoStack;
    } catch {
      // Ignore malformed storage entries
    }
  }

  private persistToStorage(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, this.serialize());
    } catch {
      // Ignore quota errors
    }
  }

  private restoreFromStorage(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) this.deserialize(raw);
    } catch {
      // Ignore storage errors
    }
  }
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  elementType: 'node' | 'edge' | 'diagram';
  elementId?: string;
  message: string;
  fixHint?: string;
}

export function validateDiagramGraph(
  graph: DiagramGraph,
  entitlements?: EditorEntitlements | null,
  brokenImageNodeKeys?: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  if (entitlements) {
    const maxBlocks = entitlements.maxBlocksPerProject ?? entitlements.maxBlocksPerDiagram ?? 250;
    const maxEdges = entitlements.maxEdgesPerProject ?? 500;
    const tierName = entitlements.planTier || 'Current';
    if (nodes.length > maxBlocks) {
      issues.push({
        id: 'err-plan-max-blocks',
        severity: 'error',
        elementType: 'diagram',
        message: `Diagram has ${nodes.length} blocks, exceeding the ${tierName} plan limit of ${maxBlocks}.`,
        fixHint: 'Remove extra blocks or upgrade your workspace plan before publishing.',
      });
    }
    if (edges.length > maxEdges) {
      issues.push({
        id: 'err-plan-max-edges',
        severity: 'error',
        elementType: 'diagram',
        message: `Diagram has ${edges.length} connections, exceeding the ${tierName} plan limit of ${maxEdges}.`,
        fixHint: 'Remove extra connections or upgrade your workspace plan before publishing.',
      });
    }
  }

  const keyCounts = new Map<string, number>();
  const nodeMap = new Map<string, DiagramNode>();

  for (const node of nodes) {
    const key = (node.key || '').trim();
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    if (key) nodeMap.set(key, node);
  }

  for (const node of nodes) {
    const key = (node.key || '').trim();
    if (!key) {
      issues.push({
        id: `err-empty-key-${node.label}`,
        severity: 'error',
        elementType: 'node',
        elementId: node.key,
        message: `Block "${node.label || 'Untitled'}" has an empty key.`,
        fixHint: 'Set a unique key matching [a-z0-9-_.]{1,64}.',
      });
    } else {
      if (!isValidNodeKey(key)) {
        issues.push({
          id: `err-invalid-key-${key}`,
          severity: 'error',
          elementType: 'node',
          elementId: key,
          message: `Block key "${key}" contains invalid characters.`,
          fixHint: 'Use lowercase letters, digits, hyphens, underscores, or dots (max 64 chars).',
        });
      }
      if ((keyCounts.get(key) || 0) > 1) {
        issues.push({
          id: `err-dup-key-${key}`,
          severity: 'error',
          elementType: 'node',
          elementId: key,
          message: `Duplicate block key "${key}". Every block must have a unique key.`,
          fixHint: 'Rename one of the duplicate blocks.',
        });
      }
    }

    if ((node.label || '').length > 40) {
      issues.push({
        id: `info-long-label-${key}`,
        severity: 'info',
        elementType: 'node',
        elementId: key,
        message: `Block "${node.label.slice(0, 28)}..." has a label longer than 40 characters.`,
        fixHint: 'Shorten the label and put details in the description field.',
      });
    }

    if (brokenImageNodeKeys?.has(key)) {
      issues.push({
        id: `warn-broken-img-${key}`,
        severity: 'warning',
        elementType: 'node',
        elementId: key,
        message: `Custom image URL on block "${node.label}" failed to load.`,
        fixHint: 'Choose a library icon or verify the HTTPS image URL.',
      });
    }
  }

  const inDegree = new Map<string, number>();
  const outEdgesByNode = new Map<string, DiagramEdge[]>();

  for (const edge of edges) {
    const src = edge.source || edge.from || '';
    const tgt = edge.target || edge.to || '';
    if (!nodeMap.has(src)) {
      issues.push({
        id: `err-edge-src-${edge.id}`,
        severity: 'error',
        elementType: 'edge',
        elementId: edge.id,
        message: `Connection "${edge.id}" starts from missing block "${src}".`,
        fixHint: 'Reconnect or delete this dangling connection.',
      });
    }
    if (!nodeMap.has(tgt)) {
      issues.push({
        id: `err-edge-tgt-${edge.id}`,
        severity: 'error',
        elementType: 'edge',
        elementId: edge.id,
        message: `Connection "${edge.id}" points to missing block "${tgt}".`,
        fixHint: 'Reconnect or delete this dangling connection.',
      });
    }
    inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    const list = outEdgesByNode.get(src) || [];
    list.push(edge);
    outEdgesByNode.set(src, list);
  }

  const flowNodes = nodes.filter((n) => n.type !== 'note' && n.type !== 'group');
  if (flowNodes.length > 0) {
    const hasStart = flowNodes.some(
      (n) =>
        n.props?.role === 'start' ||
        n.type === 'client' ||
        (inDegree.get(n.key) || 0) === 0,
    );
    if (!hasStart) {
      issues.push({
        id: 'warn-no-start-block',
        severity: 'warning',
        elementType: 'diagram',
        message: 'No Start block or entry point found in the diagram.',
        fixHint: 'Mark at least one block with role "Start" or add a Start / Client block.',
      });
    }
  }

  for (const node of flowNodes) {
    const incoming = inDegree.get(node.key) || 0;
    const outgoing = outEdgesByNode.get(node.key) || [];
    if (flowNodes.length > 1 && incoming === 0 && outgoing.length === 0) {
      issues.push({
        id: `warn-isolated-${node.key}`,
        severity: 'warning',
        elementType: 'node',
        elementId: node.key,
        message: `Block "${node.label}" has no incoming or outgoing connections.`,
        fixHint: 'Connect this block to the flow or remove it.',
      });
    }

    const isDecision = node.type === 'decision' || node.props?.role === 'decision';
    if (isDecision) {
      if (outgoing.length < 2) {
        issues.push({
          id: `warn-decision-branches-${node.key}`,
          severity: 'warning',
          elementType: 'node',
          elementId: node.key,
          message: `Decision block "${node.label}" has fewer than 2 outgoing connections.`,
          fixHint: 'Connect at least 2 outgoing branches from a Decision block.',
        });
      } else {
        const unlabeled = outgoing.filter(
          (e) => !(e.label && e.label.trim()) && !(e.flow?.condition && e.flow.condition.trim()),
        );
        if (unlabeled.length > 0) {
          issues.push({
            id: `warn-decision-unlabeled-${node.key}`,
            severity: 'warning',
            elementType: 'node',
            elementId: node.key,
            message: `Decision block "${node.label}" has unlabeled outgoing branches.`,
            fixHint: 'Add a label or condition (e.g. "200 OK" / "5xx") on each outgoing connection.',
          });
        }

        const explicitWeights = outgoing.filter((e) => typeof e.flow?.weight === 'number');
        if (explicitWeights.length > 0) {
          const sum = outgoing.reduce((acc, e) => acc + (e.flow?.weight ?? 0), 0);
          if (Math.abs(sum - 100) > 0.5) {
            issues.push({
              id: `warn-decision-weights-${node.key}`,
              severity: 'warning',
              elementType: 'node',
              elementId: node.key,
              message: `Outgoing branch weights on "${node.label}" sum to ${Math.round(sum)}% instead of 100%.`,
              fixHint: 'Adjust the connection flow weights so all branches from this decision total 100%.',
            });
          }
        }
      }
    }
  }

  if (hasDirectedCycle(flowNodes, outEdgesByNode)) {
    issues.push({
      id: 'info-cycle-detected',
      severity: 'info',
      elementType: 'diagram',
      message: 'Loop or retry cycle detected in the diagram.',
      fixHint: 'Cycles are supported for retries; Preview mode automatically bounds loop iterations.',
    });
  }

  return issues;
}

function hasDirectedCycle(
  nodes: DiagramNode[],
  outEdgesByNode: Map<string, DiagramEdge[]>,
): boolean {
  const state = new Map<string, 'visiting' | 'visited'>();
  const dfs = (key: string): boolean => {
    state.set(key, 'visiting');
    const outs = outEdgesByNode.get(key) || [];
    for (const edge of outs) {
      const tgt = edge.target || edge.to || '';
      const targetState = state.get(tgt);
      if (targetState === 'visiting') return true;
      if (!targetState && dfs(tgt)) return true;
    }
    state.set(key, 'visited');
    return false;
  };

  for (const node of nodes) {
    if (!state.has(node.key) && dfs(node.key)) return true;
  }
  return false;
}

export function snapToGrid(value: number, gridSize = 8): number {
  return Math.round(value / gridSize) * gridSize;
}

export function autoLayoutDiagram(
  graph: DiagramGraph,
  direction: 'LR' | 'TB' = (graph.direction === 'TB' ? 'TB' : 'LR'),
  onlySelectedKeys?: ReadonlySet<string>,
): DiagramGraph {
  const next = cloneGraph(graph);
  next.direction = direction;

  const targetNodes = next.nodes.filter(
    (n) => !n.props?.locked && (!onlySelectedKeys || onlySelectedKeys.has(n.key)),
  );
  if (targetNodes.length === 0) return next;

  const targetKeySet = new Set(targetNodes.map((n) => n.key));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of targetNodes) {
    inDegree.set(n.key, 0);
    adj.set(n.key, []);
  }

  for (const e of next.edges) {
    const src = e.source || e.from || '';
    const tgt = e.target || e.to || '';
    if (targetKeySet.has(src) && targetKeySet.has(tgt) && src !== tgt) {
      adj.get(src)!.push(tgt);
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    }
  }

  const layerByKey = new Map<string, number>();
  const queue: string[] = [];

  for (const n of targetNodes) {
    if (n.props?.role === 'start' || n.type === 'client' || (inDegree.get(n.key) || 0) === 0) {
      queue.push(n.key);
      layerByKey.set(n.key, 0);
    }
  }

  if (queue.length === 0 && targetNodes.length > 0) {
    queue.push(targetNodes[0].key);
    layerByKey.set(targetNodes[0].key, 0);
  }

  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layerByKey.get(curr) || 0;
    for (const nbr of adj.get(curr) || []) {
      const nextLayer = Math.max(layerByKey.get(nbr) ?? 0, currLayer + 1);
      if (!visited.has(nbr)) {
        visited.add(nbr);
        layerByKey.set(nbr, nextLayer);
        queue.push(nbr);
      } else if (nextLayer > (layerByKey.get(nbr) ?? 0) && nextLayer < targetNodes.length) {
        layerByKey.set(nbr, nextLayer);
      }
    }
  }

  for (const n of targetNodes) {
    if (!layerByKey.has(n.key)) layerByKey.set(n.key, 0);
  }

  const layers = new Map<number, DiagramNode[]>();
  for (const n of targetNodes) {
    const l = layerByKey.get(n.key) || 0;
    const arr = layers.get(l) || [];
    arr.push(n);
    layers.set(l, arr);
  }

  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
  const startX = 160;
  const startY = 140;
  const rankGap = direction === 'LR' ? 232 : 168;
  const nodeGap = direction === 'LR' ? 144 : 216;

  sortedLayers.forEach((layerIdx, rankOrder) => {
    const group = layers.get(layerIdx)!;
    group.sort((a, b) => a.key.localeCompare(b.key));
    const count = group.length;
    group.forEach((node, idxInLayer) => {
      const offset = (idxInLayer - (count - 1) / 2) * nodeGap;
      if (direction === 'LR') {
        node.x = snapToGrid(startX + rankOrder * rankGap);
        node.y = snapToGrid(320 + offset);
      } else {
        node.x = snapToGrid(480 + offset);
        node.y = snapToGrid(startY + rankOrder * rankGap);
      }
    });
  });

  if (next.groups && next.groups.length > 0) {
    for (const grp of next.groups) {
      if (grp.locked) continue;
      const children = next.nodes.filter((n) => n.props?.groupId === grp.id);
      if (children.length > 0) {
        const minX = Math.min(...children.map((c) => c.x));
        const maxX = Math.max(...children.map((c) => c.x));
        const minY = Math.min(...children.map((c) => c.y));
        const maxY = Math.max(...children.map((c) => c.y));
        grp.x = snapToGrid(minX - 96);
        grp.y = snapToGrid(minY - 72);
        grp.width = snapToGrid(Math.max(260, maxX - minX + 192));
        grp.height = snapToGrid(Math.max(160, maxY - minY + 144));
      }
    }
  }

  return next;
}

export function tidySelectedNodes(
  graph: DiagramGraph,
  selectedKeys: ReadonlySet<string>,
): DiagramGraph {
  const next = cloneGraph(graph);
  for (const node of next.nodes) {
    if (selectedKeys.has(node.key) && !node.props?.locked) {
      node.x = snapToGrid(node.x, 16);
      node.y = snapToGrid(node.y, 16);
    }
  }
  return next;
}

export interface PreviewStep {
  nodeKey: string;
  nodeLabel: string;
  edgeId?: string;
  edgeLabel?: string;
  latencyMs: number;
  cumulativeMs: number;
  role: string;
}

export interface PreviewRunResult {
  traceId: string;
  steps: PreviewStep[];
  totalLatencyMs: number;
  terminalOutcome: 'success' | 'failure' | 'abandon' | 'end';
  unreachableKeys: string[];
  timelineEvents: UiStreamEvent[];
  visitorEntity?: EntityInfo;
}

export function findPathsBetween(
  graph: DiagramGraph,
  sourceKey: string,
  targetKey: string,
  maxPaths = 8,
): { nodeKeys: Set<string>; edgeIds: Set<string> } {
  const nodeKeys = new Set<string>();
  const edgeIds = new Set<string>();
  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return { nodeKeys, edgeIds };
  }

  const outEdges = new Map<string, DiagramEdge[]>();
  for (const e of graph.edges) {
    const src = e.source || e.from || '';
    const arr = outEdges.get(src) || [];
    arr.push(e);
    outEdges.set(src, arr);
  }

  let foundCount = 0;
  const dfs = (curr: string, visitedNodes: string[], visitedEdges: string[]) => {
    if (foundCount >= maxPaths) return;
    if (curr === targetKey) {
      foundCount++;
      visitedNodes.forEach((k) => nodeKeys.add(k));
      visitedEdges.forEach((id) => edgeIds.add(id));
      return;
    }
    for (const edge of outEdges.get(curr) || []) {
      const tgt = edge.target || edge.to || '';
      if (tgt && !visitedNodes.includes(tgt)) {
        dfs(tgt, [...visitedNodes, tgt], [...visitedEdges, edge.id]);
      }
    }
  };

  dfs(sourceKey, [sourceKey], []);
  if (foundCount === 0) {
    dfs(targetKey, [targetKey], []);
  }
  return { nodeKeys, edgeIds };
}

export class SeededRandom {
  private state: number;

  constructor(seed = Date.now()) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }

  nextFloat(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
}

export function chooseWeightedEdge(
  outgoing: DiagramEdge[],
  rng: SeededRandom,
): DiagramEdge | null {
  if (outgoing.length === 0) return null;
  if (outgoing.length === 1) return outgoing[0];

  const weights = outgoing.map((e) => {
    const w = e.flow?.weight;
    return typeof w === 'number' && w >= 0 ? w : -1;
  });

  const hasExplicit = weights.some((w) => w >= 0);
  const normalizedWeights = hasExplicit
    ? weights.map((w) => (w >= 0 ? w : 0))
    : outgoing.map(() => 100 / outgoing.length);

  const total = normalizedWeights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const idx = Math.floor(rng.nextFloat() * outgoing.length);
    return outgoing[idx];
  }

  const pick = rng.nextFloat() * total;
  let accum = 0;
  for (let i = 0; i < outgoing.length; i++) {
    accum += normalizedWeights[i];
    if (pick <= accum) return outgoing[i];
  }
  return outgoing[outgoing.length - 1];
}

export function generatePreviewRun(
  graph: DiagramGraph,
  options: {
    startNodeKey?: string;
    seed?: number;
    maxHops?: number;
  } = {},
): PreviewRunResult {
  const rng = new SeededRandom(options.seed ?? Date.now());
  const maxHops = options.maxHops ?? 16;
  const traceId = `preview-${Math.floor(rng.nextFloat() * 90000 + 10000)}`;

  const flowNodes = (graph.nodes || []).filter(
    (n) => n.type !== 'note' && n.type !== 'group',
  );
  const nodeMap = new Map<string, DiagramNode>(flowNodes.map((n) => [n.key, n]));
  const outEdges = new Map<string, DiagramEdge[]>();
  const inDegree = new Map<string, number>();

  for (const n of flowNodes) {
    outEdges.set(n.key, []);
    inDegree.set(n.key, 0);
  }
  for (const e of graph.edges || []) {
    const src = e.source || e.from || '';
    const tgt = e.target || e.to || '';
    if (nodeMap.has(src) && nodeMap.has(tgt)) {
      outEdges.get(src)!.push(e);
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    }
  }

  let startNode: DiagramNode | undefined;
  if (options.startNodeKey && nodeMap.has(options.startNodeKey)) {
    startNode = nodeMap.get(options.startNodeKey);
  }
  if (!startNode) {
    startNode =
      flowNodes.find((n) => n.props?.role === 'start' || n.type === 'client') ||
      flowNodes.find((n) => (inDegree.get(n.key) || 0) === 0) ||
      flowNodes[0];
  }

  const reachable = new Set<string>();
  const startCandidates = flowNodes.filter(
    (n) =>
      n.props?.role === 'start' ||
      n.type === 'client' ||
      (inDegree.get(n.key) || 0) === 0,
  );
  const bfsQueue =
    startCandidates.length > 0
      ? startCandidates.map((n) => n.key)
      : startNode
        ? [startNode.key]
        : [];
  bfsQueue.forEach((k) => reachable.add(k));
  while (bfsQueue.length > 0) {
    const k = bfsQueue.shift()!;
    for (const e of outEdges.get(k) || []) {
      const tgt = e.target || e.to || '';
      if (tgt && !reachable.has(tgt)) {
        reachable.add(tgt);
        bfsQueue.push(tgt);
      }
    }
  }
  const unreachableKeys = flowNodes
    .filter((n) => !reachable.has(n.key))
    .map((n) => n.key);

  if (!startNode) {
    return {
      traceId,
      steps: [],
      totalLatencyMs: 0,
      terminalOutcome: 'end',
      unreachableKeys,
      timelineEvents: [],
    };
  }

  const isShopDiagram = flowNodes.some(
    (n) =>
      n.key.includes('cart') ||
      n.key.includes('checkout') ||
      n.key.includes('shop') ||
      n.props?.role === 'abandon',
  );

  const visitorEntity: EntityInfo | undefined = isShopDiagram
    ? {
        ref: traceId,
        kind: 'customer',
        avatar: 'shopper',
        label: 'Preview Shopper',
      }
    : undefined;

  const carryItems: CarryItem[] = [];
  const steps: PreviewStep[] = [];
  const timelineEvents: UiStreamEvent[] = [];
  const baseTs = Date.now();
  let cumulativeMs = 0;

  const startHold = startNode.props?.holdTimeMs ?? 80;
  steps.push({
    nodeKey: startNode.key,
    nodeLabel: startNode.label,
    latencyMs: startHold,
    cumulativeMs: startHold,
    role: startNode.props?.role || 'start',
  });
  cumulativeMs += startHold;

  timelineEvents.push({
    t: 'spawn',
    traceId,
    branch: 'main',
    node: startNode.key,
    status: 'ok',
    ts: baseTs,
    entity: visitorEntity,
  });

  let current = startNode;
  const edgeVisitCounts = new Map<string, number>();
  let terminalOutcome: 'success' | 'failure' | 'abandon' | 'end' = 'end';

  for (let hop = 0; hop < maxHops; hop++) {
    const role = current.props?.role || 'normal';
    if (role === 'success' || role === 'failure' || role === 'abandon' || role === 'end') {
      terminalOutcome = role;
      break;
    }

    const candidates = (outEdges.get(current.key) || []).filter(
      (e) => (edgeVisitCounts.get(e.id) || 0) < 2,
    );
    if (candidates.length === 0) break;

    const chosenEdge = chooseWeightedEdge(candidates, rng);
    if (!chosenEdge) break;

    edgeVisitCounts.set(chosenEdge.id, (edgeVisitCounts.get(chosenEdge.id) || 0) + 1);
    const tgtKey = chosenEdge.target || chosenEdge.to || '';
    const nextNode = nodeMap.get(tgtKey);
    if (!nextNode) break;

    const baseEdgeLatency = chosenEdge.flow?.expectedLatencyMs ?? 400;
    const speedMult = chosenEdge.flow?.speedMultiplier ?? 1;
    const effectiveEdgeMs = Math.max(60, Math.round(baseEdgeLatency / Math.max(0.25, speedMult)));
    const nodeHoldMs = nextNode.props?.holdTimeMs ?? 60;
    const stepLatency = effectiveEdgeMs + nodeHoldMs;
    cumulativeMs += stepLatency;

    const nextRole = nextNode.props?.role || 'normal';
    const hopStatus =
      nextRole === 'failure'
        ? 'error'
        : nextRole === 'abandon'
          ? 'warn'
          : 'ok';

    steps.push({
      nodeKey: nextNode.key,
      nodeLabel: nextNode.label,
      edgeId: chosenEdge.id,
      edgeLabel: (chosenEdge.label || chosenEdge.flow?.condition) ?? undefined,
      latencyMs: stepLatency,
      cumulativeMs,
      role: nextRole,
    });

    const carrySummary =
      carryItems.length > 0
        ? {
            count: carryItems.length,
            total: carryItems.reduce((sum, i) => sum + i.price, 0),
            currency: 'USD',
            topIcons: carryItems.map((i) => i.icon || 'headphones'),
          }
        : undefined;

    timelineEvents.push({
      t: 'hop',
      traceId,
      branch: 'main',
      from: current.key,
      to: nextNode.key,
      edgeId: chosenEdge.id,
      unmapped: false,
      status: hopStatus,
      label: chosenEdge.label || chosenEdge.flow?.condition || `${effectiveEdgeMs}ms`,
      ts: baseTs + cumulativeMs,
      entity: visitorEntity,
      carry: carrySummary,
    });

    if (
      isShopDiagram &&
      (nextNode.key.includes('product') || nextNode.key.includes('cart')) &&
      carryItems.length < 2
    ) {
      const newItem: CarryItem = {
        sku: `sku-${carryItems.length + 1}`,
        label: carryItems.length === 0 ? 'Wireless Headphones' : 'USB-C Dock',
        icon: carryItems.length === 0 ? 'headphones' : 'coffee',
        price: carryItems.length === 0 ? 149 : 79,
        currency: 'USD',
        qty: 1,
      };
      carryItems.push(newItem);
      timelineEvents.push({
        t: 'carry',
        traceId,
        branch: 'main',
        node: nextNode.key,
        op: 'add',
        carry: {
          count: carryItems.length,
          total: carryItems.reduce((sum, i) => sum + i.price, 0),
          currency: 'USD',
          topIcons: carryItems.map((i) => i.icon || 'headphones'),
        },
        ts: baseTs + cumulativeMs + 20,
      });
    }

    current = nextNode;
    if (chosenEdge.flow?.terminal || chosenEdge.flow?.terminalPath) {
      if (nextRole === 'success' || nextRole === 'failure' || nextRole === 'abandon') {
        terminalOutcome = nextRole;
      } else {
        terminalOutcome = 'end';
      }
      break;
    }
  }

  const finalRole = current.props?.role || 'normal';
  if (finalRole === 'success' || finalRole === 'failure' || finalRole === 'abandon') {
    terminalOutcome = finalRole;
  }

  const finalCarrySummary = {
    count: carryItems.length,
    total: carryItems.reduce((sum, i) => sum + i.price, 0),
    currency: 'USD',
    topIcons: carryItems.map((i) => i.icon || 'headphones'),
  };

  if (terminalOutcome === 'success') {
    timelineEvents.push({
      t: 'complete',
      traceId,
      branch: 'main',
      node: current.key,
      entity: visitorEntity,
      carry: finalCarrySummary,
      ts: baseTs + cumulativeMs + 50,
    });
  } else if (terminalOutcome === 'failure') {
    timelineEvents.push({
      t: 'fail',
      traceId,
      branch: 'main',
      node: current.key,
      entity: visitorEntity,
      reason: 'Preview failure branch',
      ts: baseTs + cumulativeMs + 50,
    });
  } else if (terminalOutcome === 'abandon') {
    timelineEvents.push({
      t: 'abandon',
      traceId,
      branch: 'main',
      node: current.key,
      entity: visitorEntity,
      carry: finalCarrySummary,
      ts: baseTs + cumulativeMs + 50,
    });
  } else {
    timelineEvents.push({
      t: 'end',
      traceId,
      branch: 'main',
      node: current.key,
      ts: baseTs + cumulativeMs + 50,
    });
  }

  return {
    traceId,
    steps,
    totalLatencyMs: cumulativeMs,
    terminalOutcome,
    unreachableKeys,
    timelineEvents,
    visitorEntity,
  };
}

export interface ViewportRect {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
}

export function getVisibleDiagramSlice(
  graph: DiagramGraph,
  viewport: ViewportRect,
  marginPx = 220,
): { visibleNodeKeys: Set<string>; visibleEdgeIds: Set<string> } {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  if (nodes.length <= 80) {
    return {
      visibleNodeKeys: new Set(nodes.map((n) => n.key)),
      visibleEdgeIds: new Set(edges.map((e) => e.id)),
    };
  }

  const zoom = Math.max(0.25, viewport.zoom);
  const minWorldX = (-viewport.panX - marginPx) / zoom;
  const maxWorldX = (viewport.width - viewport.panX + marginPx) / zoom;
  const minWorldY = (-viewport.panY - marginPx) / zoom;
  const maxWorldY = (viewport.height - viewport.panY + marginPx) / zoom;

  const visibleNodeKeys = new Set<string>();
  for (const n of nodes) {
    if (
      n.x >= minWorldX &&
      n.x <= maxWorldX &&
      n.y >= minWorldY &&
      n.y <= maxWorldY
    ) {
      visibleNodeKeys.add(n.key);
    }
  }

  const visibleEdgeIds = new Set<string>();
  for (const e of edges) {
    const src = e.source || e.from || '';
    const tgt = e.target || e.to || '';
    if (visibleNodeKeys.has(src) || visibleNodeKeys.has(tgt)) {
      visibleEdgeIds.add(e.id);
    }
  }

  return { visibleNodeKeys, visibleEdgeIds };
}

export type SnippetLang = 'curl' | 'java' | 'node' | 'python' | 'udp';

export function buildCheckpointSnippet(
  lang: SnippetLang,
  nodeKey: string,
  role: string = 'normal',
  ingestUrl = 'http://localhost:8080',
  apiKeyPlaceholder = 'ft_live_your_api_key',
): string {
  const eventType =
    role === 'success'
      ? 'complete'
      : role === 'failure'
        ? 'fail'
        : role === 'abandon'
          ? 'abandon'
          : 'checkpoint';
  const status = role === 'failure' ? 'error' : role === 'abandon' ? 'warn' : 'ok';

  switch (lang) {
    case 'curl':
      return `curl -X POST "${ingestUrl}/v1/events" \\
  -H "Content-Type: application/json" \\
  -H "X-FlowTrace-Key: ${apiKeyPlaceholder}" \\
  -d '{
    "traceId": "req-1001",
    "node": "${nodeKey}",
    "type": "${eventType}",
    "status": "${status}",
    "ts": '$(date +%s000)'
  }'`;

    case 'java':
      return `HttpClient.newHttpClient().sendAsync(
    HttpRequest.newBuilder(URI.create("${ingestUrl}/v1/events"))
        .header("Content-Type", "application/json")
        .header("X-FlowTrace-Key", "${apiKeyPlaceholder}")
        .POST(HttpRequest.BodyPublishers.ofString(
            "{\\"traceId\\":\\"" + traceId + "\\",\\"node\\":\\"${nodeKey}\\",\\"type\\":\\"${eventType}\\",\\"status\\":\\"${status}\\"}"
        ))
        .build(),
    HttpResponse.BodyHandlers.discarding()
);`;

    case 'node':
      return `await fetch("${ingestUrl}/v1/events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-FlowTrace-Key": process.env.FLOWTRACE_KEY ?? "${apiKeyPlaceholder}",
  },
  body: JSON.stringify({
    traceId,
    node: "${nodeKey}",
    type: "${eventType}",
    status: "${status}",
    ts: Date.now(),
  }),
});`;

    case 'python':
      return `import time, requests

requests.post(
    "${ingestUrl}/v1/events",
    headers={"X-FlowTrace-Key": "${apiKeyPlaceholder}"},
    json={
        "traceId": trace_id,
        "node": "${nodeKey}",
        "type": "${eventType}",
        "status": "${status}",
        "ts": int(time.time() * 1000),
    },
    timeout=1.5,
)`;

    case 'udp':
      return `echo '{"traceId":"req-1001","node":"${nodeKey}","type":"${eventType}","status":"${status}"}' \\
  | nc -u -w0 127.0.0.1 41234`;
  }
}

export type EditorTelemetryEventName =
  | 'editor_opened'
  | 'block_added'
  | 'edge_created'
  | 'inspector_used'
  | 'preview_run'
  | 'snippet_copied'
  | 'test_event_sent'
  | 'draft_published'
  | 'validation_error_shown';

export interface EditorTelemetryEntry {
  event: EditorTelemetryEventName;
  ts: number;
  meta: Record<string, string | number | boolean>;
}

export class EditorTelemetry {
  private readonly log: EditorTelemetryEntry[] = [];

  track(
    event: EditorTelemetryEventName,
    meta: Record<string, string | number | boolean> = {},
  ): void {
    const safeMeta: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (k !== 'label' && k !== 'description' && k !== 'email') {
        safeMeta[k] = v;
      }
    }
    this.log.push({ event, ts: Date.now(), meta: safeMeta });
    if (this.log.length > 200) {
      this.log.shift();
    }
  }

  getEvents(): ReadonlyArray<EditorTelemetryEntry> {
    return this.log;
  }
}

export function createNodeFromCatalogBlock(
  block: CatalogBlock,
  existingKeys: Iterable<string>,
  x: number,
  y: number,
  snap = true,
): DiagramNode {
  const uniqueKey = ensureUniqueKey(block.keyPattern, existingKeys);
  const px = snap ? snapToGrid(x) : Math.round(x);
  const py = snap ? snapToGrid(y) : Math.round(y);

  return {
    key: uniqueKey,
    label: block.defaultLabel,
    type: block.nodeType,
    x: px,
    y: py,
    icon: block.icon,
    props: {
      role: block.role,
      tint: block.tint,
      size: block.defaultProps?.size ?? 'M',
      shape:
        block.defaultProps?.shape ??
        (block.nodeType === 'decision'
          ? 'diamond'
          : block.role === 'start' || block.role === 'end' || block.role === 'success' || block.role === 'failure' || block.role === 'abandon'
            ? 'pill'
            : 'card'),
      labelPosition: block.defaultProps?.labelPosition ?? 'inside',
      showCounter: block.defaultProps?.showCounter ?? true,
      idleAbandonMinutes: block.defaultProps?.idleAbandonMinutes,
      holdTimeMs: block.defaultProps?.holdTimeMs,
      vendorLabel: block.defaultProps?.vendorLabel,
      maxInPorts: block.ports.in,
      maxOutPorts: block.ports.out,
      locked: false,
      aliases: [],
    },
  };
}
