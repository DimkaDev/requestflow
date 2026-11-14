import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { AnimationEngine } from '../../core/animation-engine';
import {
  CustomBlockDefinition,
  DiagramDraft,
  DiagramEdge,
  DiagramGraph,
  DiagramGroup,
  DiagramNode,
  DiagramVersion,
  EditorEntitlements,
  NodeRole,
  Project,
} from '../../core/models';
import {
  CatalogBlock,
  CatalogPack,
  customBlocksToCatalogPack,
  getBuiltInCatalogPacks,
  stripIconPrefix,
} from './catalog/catalog-registry';
import {
  EditorCommandHistory,
  EditorTelemetry,
  PreviewRunResult,
  SnippetLang,
  ValidationIssue,
  autoLayoutDiagram,
  buildCheckpointSnippet,
  cloneGraph,
  createNodeFromCatalogBlock,
  ensureUniqueKey,
  findPathsBetween,
  generatePreviewRun,
  getVisibleDiagramSlice,
  isValidNodeKey,
  migrateDiagramToV2,
  slugifyKey,
  snapToGrid,
  tidySelectedNodes,
  validateDiagramGraph,
} from './engine/editor-engine';
import { diagramEditorTemplate } from './diagram-editor.template';

export const TINT_PALETTE: { name: string; hex: string }[] = [
  { name: 'Sky', hex: '#0EA5E9' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Rose', hex: '#EF4444' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Slate', hex: '#64748B' },
];

export const LIBRARY_ICONS: string[] = [
  'dns',
  'bolt',
  'database',
  'layers',
  'call_split',
  'merge',
  'public',
  'shopping_cart',
  'credit_card',
  'check_circle',
  'error',
  'remove_shopping_cart',
  'local_shipping',
  'smart_toy',
  'psychology',
  'build',
  'memory',
  'verified_user',
  'cloud',
  'storage',
  'router',
  'hub',
  'webhook',
  'table_restaurant',
  'receipt_long',
  'two_wheeler',
  'calendar_month',
  'person_add',
  'confirmation_number',
  'sticky_note_2',
];

@Component({
  selector: 'app-diagram-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: diagramEditorTemplate,
})
export class DiagramEditorPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FlowTraceApiService);

  @ViewChild('canvasSvg', { static: false }) canvasSvgRef?: ElementRef<SVGSVGElement>;

  readonly tintPalette = TINT_PALETTE;
  readonly libraryIcons = LIBRARY_ICONS;
  readonly stripIconPrefix = stripIconPrefix;

  readonly projects = signal<Project[]>([]);
  readonly projectId = signal<string>('');
  readonly currentProject = computed(() =>
    this.projects().find((p) => p.id === this.projectId()) ?? null,
  );

  readonly diagram = signal<DiagramGraph>(migrateDiagramToV2(null));
  readonly baseVersion = signal<number>(1);
  readonly saveStatus = signal<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  readonly conflictState = signal<{
    updatedBy: string;
    updatedAt: string;
    serverDraft: DiagramDraft;
  } | null>(null);

  readonly entitlements = signal<EditorEntitlements | null>(null);
  readonly customBlocks = signal<CustomBlockDefinition[]>([]);
  readonly versions = signal<DiagramVersion[]>([]);

  // Viewport & Responsive state
  readonly isPhoneView = signal<boolean>(false);
  readonly leftLibraryOpen = signal<boolean>(true);
  readonly zoom = signal<number>(1);
  readonly panX = signal<number>(60);
  readonly panY = signal<number>(40);
  readonly showGrid = signal<boolean>(true);
  readonly snapEnabled = signal<boolean>(true);
  readonly showMinimap = signal<boolean>(true);
  readonly spacePressed = signal<boolean>(false);

  // Selection state
  readonly selectedNodeKeys = signal<Set<string>>(new Set());
  readonly selectedEdgeId = signal<string | null>(null);
  readonly selectedGroupId = signal<string | null>(null);
  readonly inspectorClosedExplicitly = signal<boolean>(false);

  // Active tabs & modals
  readonly nodeInspectorTab = signal<
    'general' | 'appearance' | 'behaviour' | 'integration' | 'advanced'
  >('general');
  readonly edgeInspectorTab = signal<'general' | 'style' | 'flow'>('general');
  readonly snippetLang = signal<SnippetLang>('curl');
  readonly showValidationDrawer = signal<boolean>(false);
  readonly showLayoutMenu = signal<boolean>(false);
  readonly showPublishModal = signal<boolean>(false);
  readonly showVersionsModal = signal<boolean>(false);
  readonly showShortcutsModal = signal<boolean>(false);
  readonly showCommandPalette = signal<boolean>(false);
  readonly showConnectModal = signal<boolean>(false);
  readonly showSaveTemplateModal = signal<boolean>(false);
  readonly showImportModal = signal<boolean>(false);

  // Publish & Template modal inputs
  readonly publishSummary = signal<string>('');
  readonly publishing = signal<boolean>(false);
  readonly lastPublishAffectedCount = signal<number | null>(null);
  readonly templateTitle = signal<string>('');
  readonly templateCategory = signal<string>('Architecture');
  readonly templateSummary = signal<string>('');
  readonly importJsonText = signal<string>('');
  readonly importError = signal<string>('');

  // Block Library state
  readonly librarySearch = signal<string>('');
  readonly collapsedPacks = signal<Set<string>>(new Set(['aws', 'gcp', 'business']));
  readonly disabledPacks = signal<Set<string>>(new Set());
  readonly favoriteBlockIds = signal<Set<string>>(new Set(['std.start', 'std.service', 'std.decision', 'shop.cart']));
  readonly recentBlockIds = signal<string[]>(['std.start', 'std.service', 'std.db']);
  readonly hoveredCatalogBlock = signal<CatalogBlock | null>(null);

  // Key rename & usage tracking
  readonly editingKeyDraft = signal<string>('');
  readonly keepOldKeyAlias = signal<boolean>(true);
  readonly keyUsageCount24h = signal<number>(0);
  readonly keyRecentEvents = signal<
    { traceId: string; eventType: string; status: string; timestampMs: number }[]
  >([]);
  readonly brokenImageNodeKeys = signal<Set<string>>(new Set());

  // Canvas interaction state (drag / connect / marquee / quick-add / context menu)
  readonly alignmentGuides = signal<{ x?: number; y?: number }>({});
  readonly connectingFrom = signal<{
    sourceKey: string;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);
  readonly quickAddPopup = signal<{
    worldX: number;
    worldY: number;
    screenX: number;
    screenY: number;
    fromSourceKey?: string;
  } | null>(null);
  readonly marqueeRect = signal<{
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);
  readonly contextMenu = signal<{
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    targetNodeKey?: string;
    targetEdgeId?: string;
  } | null>(null);

  // Preview Flow & Live Animation state
  readonly previewResult = signal<PreviewRunResult | null>(null);
  readonly previewRunning = signal<boolean>(false);
  readonly activeTokens = signal<
    {
      traceId: string;
      x: number;
      y: number;
      status: string;
      label?: string;
      carryCount: number;
    }[]
  >([]);
  readonly activeNodeCounters = signal<Map<string, number>>(new Map());
  readonly liveAnnouncement = signal<string>('');
  readonly toastMessage = signal<string | null>(null);

  readonly telemetry = new EditorTelemetry();
  history = new EditorCommandHistory(120);
  readonly animationEngine = new AnimationEngine();

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTimers: ReturnType<typeof setTimeout>[] = [];
  private rafId: number | null = null;
  private clipboardNodes: DiagramNode[] = [];

  private dragState: {
    mode: 'pan' | 'node' | 'group';
    startScreenX: number;
    startScreenY: number;
    startPanX: number;
    startPanY: number;
    beforeGraph: DiagramGraph;
    initialNodePositions: Map<string, { x: number; y: number }>;
    groupId?: string;
    initialGroupPos?: { x: number; y: number };
    moved: boolean;
  } | null = null;

  // Computed Catalog Packs
  readonly allCatalogPacks = computed<CatalogPack[]>(() => {
    const builtIn = getBuiltInCatalogPacks();
    const myPack = customBlocksToCatalogPack(this.customBlocks());
    return [...builtIn, myPack];
  });

  readonly filteredCatalogPacks = computed<CatalogPack[]>(() => {
    const q = this.librarySearch().trim().toLowerCase();
    const disabled = this.disabledPacks();
    return this.allCatalogPacks()
      .filter((p) => !disabled.has(p.pack))
      .map((pack) => {
        if (!q) return pack;
        const matched = pack.blocks.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q) ||
            b.keyPattern.toLowerCase().includes(q) ||
            b.tags.some((t) => t.toLowerCase().includes(q)),
        );
        return { ...pack, blocks: matched };
      })
      .filter((p) => p.blocks.length > 0 || p.pack === 'my-blocks');
  });

  readonly favoriteBlocks = computed<CatalogBlock[]>(() => {
    const favs = this.favoriteBlockIds();
    const result: CatalogBlock[] = [];
    for (const pack of this.allCatalogPacks()) {
      for (const blk of pack.blocks) {
        if (favs.has(blk.id)) result.push(blk);
      }
    }
    return result;
  });

  readonly recentBlocks = computed<CatalogBlock[]>(() => {
    const recents = this.recentBlockIds();
    const map = new Map<string, CatalogBlock>();
    for (const pack of this.allCatalogPacks()) {
      for (const blk of pack.blocks) map.set(blk.id, blk);
    }
    return recents.map((id) => map.get(id)).filter((b): b is CatalogBlock => !!b);
  });

  // Computed Selection helpers
  readonly selectedSingleNode = computed<DiagramNode | null>(() => {
    const keys = Array.from(this.selectedNodeKeys());
    if (keys.length !== 1) return null;
    return this.diagram().nodes.find((n) => n.key === keys[0]) ?? null;
  });

  readonly selectedSingleEdge = computed<DiagramEdge | null>(() => {
    const id = this.selectedEdgeId();
    if (!id) return null;
    return this.diagram().edges.find((e) => e.id === id) ?? null;
  });

  readonly selectedSingleGroup = computed<DiagramGroup | null>(() => {
    const id = this.selectedGroupId();
    if (!id) return null;
    return (this.diagram().groups || []).find((g) => g.id === id) ?? null;
  });

  // Path highlighting when exactly 2 nodes are selected
  readonly highlightedPath = computed(() => {
    const keys = Array.from(this.selectedNodeKeys());
    if (keys.length === 2) {
      return findPathsBetween(this.diagram(), keys[0], keys[1]);
    }
    return { nodeKeys: new Set<string>(), edgeIds: new Set<string>() };
  });

  // Validation
  readonly validationIssues = computed<ValidationIssue[]>(() =>
    validateDiagramGraph(
      this.diagram(),
      this.entitlements(),
      this.brokenImageNodeKeys(),
    ),
  );

  readonly errorIssues = computed(() =>
    this.validationIssues().filter((i) => i.severity === 'error'),
  );
  readonly warningIssues = computed(() =>
    this.validationIssues().filter((i) => i.severity === 'warning'),
  );
  readonly infoIssues = computed(() =>
    this.validationIssues().filter((i) => i.severity === 'info'),
  );

  readonly nodeIssuesMap = computed(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of this.validationIssues()) {
      if (issue.elementType === 'node' && issue.elementId) {
        const arr = map.get(issue.elementId) || [];
        arr.push(issue);
        map.set(issue.elementId, arr);
      }
    }
    return map;
  });

  // Viewport culling
  readonly visibleSlice = computed(() =>
    getVisibleDiagramSlice(this.diagram(), {
      panX: this.panX(),
      panY: this.panY(),
      zoom: this.zoom(),
      width: 1400,
      height: 900,
    }),
  );

  readonly visibleNodes = computed(() => {
    const slice = this.visibleSlice().visibleNodeKeys;
    const collapsedGroupIds = new Set(
      (this.diagram().groups || []).filter((g) => g.collapsed).map((g) => g.id),
    );
    return this.diagram().nodes.filter(
      (n) =>
        slice.has(n.key) &&
        (!n.props?.groupId || !collapsedGroupIds.has(n.props.groupId)),
    );
  });

  readonly visibleEdges = computed(() => {
    const slice = this.visibleSlice().visibleEdgeIds;
    const visibleNodeKeys = new Set(this.visibleNodes().map((n) => n.key));
    return this.diagram().edges.filter(
      (e) =>
        slice.has(e.id) &&
        visibleNodeKeys.has(e.source || e.from || '') &&
        visibleNodeKeys.has(e.target || e.to || ''),
    );
  });

  readonly currentSnippet = computed(() => {
    const node = this.selectedSingleNode();
    if (!node) return '';
    return buildCheckpointSnippet(
      this.snippetLang(),
      node.key,
      node.props?.role || 'normal',
    );
  });

  async ngOnInit(): Promise<void> {
    this.animationEngine.cardWidth = 0;
    this.animationEngine.cardHeight = 0;
    this.checkViewportWidth();
    try {
      const list = await this.api.listProjects();
      this.projects.set(list);
      const paramId = this.route.snapshot.paramMap.get('projectId');
      const initialId = paramId || list[0]?.id || 'default';
      await this.loadProjectEditor(initialId);
    } catch {
      const paramId = this.route.snapshot.paramMap.get('projectId') || 'default';
      await this.loadProjectEditor(paramId);
    }
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.clearPreviewTimers();
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
  }

  @HostListener('window:resize')
  checkViewportWidth(): void {
    if (typeof window !== 'undefined') {
      this.isPhoneView.set(window.innerWidth < 768);
      if (window.innerWidth < 1024) {
        this.leftLibraryOpen.set(false);
      }
    }
  }

  async loadProjectEditor(projectId: string): Promise<void> {
    this.projectId.set(projectId);
    this.history = new EditorCommandHistory(120, projectId);
    this.selectedNodeKeys.set(new Set());
    this.selectedEdgeId.set(null);
    this.selectedGroupId.set(null);
    this.conflictState.set(null);

    try {
      const res = await this.api.getDiagramDraft(projectId);
      const rawGraph = res.draft?.graph || res.draft?.diagram || null;
      const v2 = migrateDiagramToV2(rawGraph);
      this.diagram.set(v2);
      this.baseVersion.set(res.draft?.draftVersion ?? res.draft?.baseVersion ?? 1);
      this.snapEnabled.set(v2.gridSnap ?? true);
      this.entitlements.set(res.entitlements);
      this.saveStatus.set('saved');
      this.animationEngine.setGraph(v2);
      this.telemetry.track('editor_opened', {
        nodeCount: v2.nodes.length,
        edgeCount: v2.edges.length,
      });
    } catch {
      try {
        const ver = await this.api.getDiagram(projectId);
        const v2 = migrateDiagramToV2(ver.graph);
        this.diagram.set(v2);
        this.animationEngine.setGraph(v2);
      } catch {
        // Leave blank v2 diagram initialized
      }
    }

    try {
      const blocks = await this.api.listCustomBlocks(projectId);
      this.customBlocks.set(blocks);
    } catch {
      this.customBlocks.set([]);
    }

    try {
      const vers = await this.api.listDiagramVersions(projectId);
      this.versions.set(vers);
    } catch {
      this.versions.set([]);
    }
  }

  onProjectSwitch(newProjectId: string): void {
    if (!newProjectId || newProjectId === this.projectId()) return;
    this.router.navigate(['/projects', newProjectId, 'editor']);
    void this.loadProjectEditor(newProjectId);
  }

  // ==========================================================================
  // Graph Mutation & Debounced Autosave
  // ==========================================================================

  applyMutation(
    label: string,
    mutator: (draft: DiagramGraph) => void,
    coalesceKey?: string,
  ): void {
    if (this.isPhoneView()) return;
    const before = cloneGraph(this.diagram());
    const after = cloneGraph(before);
    mutator(after);
    this.history.record(label, before, after, coalesceKey);
    this.diagram.set(after);
    this.animationEngine.setGraph(after);
    this.scheduleAutosave();
  }

  scheduleAutosave(): void {
    this.saveStatus.set('dirty');
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => void this.saveDraftNow(), 1500);
  }

  async saveDraftNow(forceOverwrite = false): Promise<void> {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    const pid = this.projectId();
    if (!pid) return;

    this.saveStatus.set('saving');
    try {
      const res = await this.api.saveDiagramDraft(
        pid,
        this.diagram(),
        this.baseVersion(),
        forceOverwrite,
      );
      if (res.conflict && res.serverDraft) {
        this.conflictState.set({
          updatedBy: res.serverDraft.updatedBy || 'another user',
          updatedAt: res.serverDraft.updatedAt || 'just now',
          serverDraft: res.serverDraft,
        });
        this.saveStatus.set('error');
        return;
      }
      if (res.draft) {
        this.baseVersion.set(res.draft.draftVersion ?? res.draft.baseVersion ?? this.baseVersion() + 1);
      }
      this.saveStatus.set('saved');
      this.conflictState.set(null);
    } catch {
      this.saveStatus.set('error');
    }
  }

  reloadServerDraft(): void {
    const conflict = this.conflictState();
    if (!conflict) return;
    const v2 = migrateDiagramToV2(conflict.serverDraft.graph || conflict.serverDraft.diagram || null);
    this.diagram.set(v2);
    this.baseVersion.set(conflict.serverDraft.draftVersion ?? conflict.serverDraft.baseVersion ?? 1);
    this.conflictState.set(null);
    this.saveStatus.set('saved');
    this.showToast('Loaded latest server draft.');
  }

  keepMyDraftOverwrite(): void {
    void this.saveDraftNow(true);
  }

  undo(): void {
    const prev = this.history.undo();
    if (prev) {
      this.diagram.set(prev);
      this.animationEngine.setGraph(prev);
      this.scheduleAutosave();
      this.announce('Undid last change');
    }
  }

  redo(): void {
    const next = this.history.redo();
    if (next) {
      this.diagram.set(next);
      this.animationEngine.setGraph(next);
      this.scheduleAutosave();
      this.announce('Redid change');
    }
  }

  // ==========================================================================
  // Block Library & Adding Blocks
  // ==========================================================================

  togglePackCollapse(packId: string): void {
    const next = new Set(this.collapsedPacks());
    if (next.has(packId)) next.delete(packId);
    else next.add(packId);
    this.collapsedPacks.set(next);
  }

  toggleFavoriteBlock(blockId: string, event: MouseEvent): void {
    event.stopPropagation();
    const next = new Set(this.favoriteBlockIds());
    if (next.has(blockId)) next.delete(blockId);
    else next.add(blockId);
    this.favoriteBlockIds.set(next);
  }

  addBlockFromCatalog(
    block: CatalogBlock,
    worldX?: number,
    worldY?: number,
    connectFromSourceKey?: string,
  ): void {
    if (this.isPhoneView()) return;

    const cx =
      worldX ?? Math.round((520 - this.panX()) / Math.max(0.25, this.zoom()));
    const cy =
      worldY ?? Math.round((340 - this.panY()) / Math.max(0.25, this.zoom()));

    if (block.nodeType === 'group') {
      const grpId = `zone-${Date.now().toString(36)}`;
      this.applyMutation(`Add zone ${block.defaultLabel}`, (d) => {
        d.groups = d.groups || [];
        d.groups.push({
          id: grpId,
          name: block.defaultLabel,
          color: block.tint || '#6366F1',
          x: snapToGrid(cx - 180),
          y: snapToGrid(cy - 110),
          width: 380,
          height: 240,
          collapsed: false,
          locked: false,
        });
      });
      this.selectGroup(grpId);
      return;
    }

    let createdKey = '';
    this.applyMutation(`Add block ${block.defaultLabel}`, (d) => {
      const existingKeys = d.nodes.map((n) => n.key);
      const newNode = createNodeFromCatalogBlock(
        block,
        existingKeys,
        cx,
        cy,
        this.snapEnabled(),
      );
      createdKey = newNode.key;
      d.nodes.push(newNode);

      if (connectFromSourceKey && d.nodes.some((n) => n.key === connectFromSourceKey)) {
        const edgeId = `e-${connectFromSourceKey}-${createdKey}-${Date.now().toString(36).slice(-4)}`;
        d.edges.push({
          id: edgeId,
          from: connectFromSourceKey,
          to: createdKey,
          source: connectFromSourceKey,
          target: createdKey,
          discovered: false,
          status: 'defined',
          style: {
            type: 'curved',
            color: 'default',
            thickness: 'normal',
            dashed: false,
            arrowhead: 'arrow',
            direction: 'one-way',
          },
          flow: {
            expectedLatencyMs: 400,
            speedMultiplier: 1,
            tokenStyle: 'inherit',
            terminal: false,
          },
        });
      }
    });

    const recents = [
      block.id,
      ...this.recentBlockIds().filter((id) => id !== block.id),
    ].slice(0, 6);
    this.recentBlockIds.set(recents);

    if (createdKey) {
      this.selectSingleNode(createdKey);
      this.announce(`Added block ${block.defaultLabel} with key ${createdKey}`);
      this.telemetry.track('block_added', {
        pack: block.packId || 'standard',
        nodeType: block.nodeType,
        role: block.role,
      });
    }
    this.quickAddPopup.set(null);
    this.showCommandPalette.set(false);
  }

  onCatalogDragStart(event: DragEvent, block: CatalogBlock): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/x-flowtrace-block', JSON.stringify(block));
    event.dataTransfer.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const raw = event.dataTransfer?.getData('application/x-flowtrace-block');
    if (!raw) return;
    try {
      const block = JSON.parse(raw) as CatalogBlock;
      const coords = this.screenToWorld(event.clientX, event.clientY);
      this.addBlockFromCatalog(block, coords.x, coords.y);
    } catch {
      // Ignore invalid payload
    }
  }

  // ==========================================================================
  // Selection & Inspector Binding
  // ==========================================================================

  selectSingleNode(key: string, additive = false): void {
    this.inspectorClosedExplicitly.set(false);
    this.selectedEdgeId.set(null);
    this.selectedGroupId.set(null);

    const next = additive ? new Set(this.selectedNodeKeys()) : new Set<string>();
    if (additive && next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedNodeKeys.set(next);

    if (next.size === 1) {
      const selectedKey = Array.from(next)[0];
      this.editingKeyDraft.set(selectedKey);
      void this.loadKeyUsage(selectedKey);
    }
  }

  selectEdge(edgeId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.inspectorClosedExplicitly.set(false);
    this.selectedNodeKeys.set(new Set());
    this.selectedGroupId.set(null);
    this.selectedEdgeId.set(edgeId);
  }

  selectGroup(groupId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.inspectorClosedExplicitly.set(false);
    this.selectedNodeKeys.set(new Set());
    this.selectedEdgeId.set(null);
    this.selectedGroupId.set(groupId);
  }

  clearSelection(): void {
    this.selectedNodeKeys.set(new Set());
    this.selectedEdgeId.set(null);
    this.selectedGroupId.set(null);
    this.contextMenu.set(null);
    this.quickAddPopup.set(null);
  }

  async loadKeyUsage(nodeKey: string): Promise<void> {
    const pid = this.projectId();
    if (!pid || !nodeKey) return;
    try {
      const usage = await this.api.getKeyUsage(pid, nodeKey);
      this.keyUsageCount24h.set(usage.eventsLast24h || 0);
      this.keyRecentEvents.set(
        (usage.recentEvents || []).map((ev) => ({
          traceId: ev.traceId,
          eventType: ev.type || 'hop',
          status: (ev.attrs?.['status'] as string) || 'ok',
          timestampMs: Number(ev.serverTs) || Date.now(),
        })),
      );
    } catch {
      this.keyUsageCount24h.set(0);
      this.keyRecentEvents.set([]);
    }
  }

  // ==========================================================================
  // Canvas Navigation, Dragging, Port Connect & Marquee
  // ==========================================================================

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.canvasSvgRef?.nativeElement;
    if (!svg) {
      return { x: clientX, y: clientY };
    }
    const rect = svg.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const z = Math.max(0.25, this.zoom());
    return {
      x: Math.round((sx - this.panX()) / z),
      y: Math.round((sy - this.panY()) / z),
    };
  }

  onCanvasMouseDown(event: MouseEvent): void {
    this.contextMenu.set(null);
    this.quickAddPopup.set(null);
    this.showLayoutMenu.set(false);

    if (event.button === 1 || this.spacePressed() || this.isPhoneView()) {
      this.dragState = {
        mode: 'pan',
        startScreenX: event.clientX,
        startScreenY: event.clientY,
        startPanX: this.panX(),
        startPanY: this.panY(),
        beforeGraph: cloneGraph(this.diagram()),
        initialNodePositions: new Map(),
        moved: false,
      };
      return;
    }

    if (event.button === 0 && event.shiftKey) {
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.marqueeRect.set({
        startX: world.x,
        startY: world.y,
        currX: world.x,
        currY: world.y,
      });
      return;
    }

    if (event.button === 0) {
      this.clearSelection();
      this.dragState = {
        mode: 'pan',
        startScreenX: event.clientX,
        startScreenY: event.clientY,
        startPanX: this.panX(),
        startPanY: this.panY(),
        beforeGraph: cloneGraph(this.diagram()),
        initialNodePositions: new Map(),
        moved: false,
      };
    }
  }

  onCanvasDoubleClick(event: MouseEvent): void {
    if (this.isPhoneView()) return;
    const world = this.screenToWorld(event.clientX, event.clientY);
    this.quickAddPopup.set({
      worldX: world.x,
      worldY: world.y,
      screenX: event.clientX,
      screenY: event.clientY,
    });
  }

  onNodeMouseDown(event: MouseEvent, node: DiagramNode): void {
    event.stopPropagation();
    this.contextMenu.set(null);
    this.quickAddPopup.set(null);

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (!this.selectedNodeKeys().has(node.key) || additive) {
      this.selectSingleNode(node.key, additive);
    }

    if (this.isPhoneView() || node.props?.locked) return;

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const n of this.diagram().nodes) {
      if (this.selectedNodeKeys().has(n.key) && !n.props?.locked) {
        initialPositions.set(n.key, { x: n.x, y: n.y });
      }
    }

    this.dragState = {
      mode: 'node',
      startScreenX: event.clientX,
      startScreenY: event.clientY,
      startPanX: this.panX(),
      startPanY: this.panY(),
      beforeGraph: cloneGraph(this.diagram()),
      initialNodePositions: initialPositions,
      moved: false,
    };
  }

  onGroupMouseDown(event: MouseEvent, group: DiagramGroup): void {
    event.stopPropagation();
    this.selectGroup(group.id);
    if (this.isPhoneView() || group.locked) return;

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const n of this.diagram().nodes) {
      if (n.props?.groupId === group.id) {
        initialPositions.set(n.key, { x: n.x, y: n.y });
      }
    }

    this.dragState = {
      mode: 'group',
      startScreenX: event.clientX,
      startScreenY: event.clientY,
      startPanX: this.panX(),
      startPanY: this.panY(),
      beforeGraph: cloneGraph(this.diagram()),
      initialNodePositions: initialPositions,
      groupId: group.id,
      initialGroupPos: { x: group.x, y: group.y },
      moved: false,
    };
  }

  onOutputPortMouseDown(event: MouseEvent, node: DiagramNode): void {
    event.stopPropagation();
    if (this.isPhoneView()) return;
    const outCoord = this.getOutputPortCoords(node);
    this.connectingFrom.set({
      sourceKey: node.key,
      startX: outCoord.x,
      startY: outCoord.y,
      currX: outCoord.x,
      currY: outCoord.y,
    });
  }

  onNodeMouseUpForConnect(event: MouseEvent, targetNode: DiagramNode): void {
    const conn = this.connectingFrom();
    if (!conn) return;
    event.stopPropagation();
    this.createConnection(conn.sourceKey, targetNode.key);
    this.connectingFrom.set(null);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    const conn = this.connectingFrom();
    if (conn) {
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.connectingFrom.set({ ...conn, currX: world.x, currY: world.y });
      return;
    }

    const mq = this.marqueeRect();
    if (mq) {
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.marqueeRect.set({ ...mq, currX: world.x, currY: world.y });
      const minX = Math.min(mq.startX, world.x);
      const maxX = Math.max(mq.startX, world.x);
      const minY = Math.min(mq.startY, world.y);
      const maxY = Math.max(mq.startY, world.y);
      const hits = new Set<string>();
      for (const n of this.diagram().nodes) {
        if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
          hits.add(n.key);
        }
      }
      this.selectedNodeKeys.set(hits);
      return;
    }

    if (!this.dragState) return;
    const dxScreen = event.clientX - this.dragState.startScreenX;
    const dyScreen = event.clientY - this.dragState.startScreenY;
    if (Math.abs(dxScreen) > 2 || Math.abs(dyScreen) > 2) {
      this.dragState.moved = true;
    }

    if (this.dragState.mode === 'pan') {
      this.panX.set(this.dragState.startPanX + dxScreen);
      this.panY.set(this.dragState.startPanY + dyScreen);
      return;
    }

    const z = Math.max(0.25, this.zoom());
    const dxWorld = dxScreen / z;
    const dyWorld = dyScreen / z;
    const snap = this.snapEnabled();

    if (this.dragState.mode === 'node') {
      const updated = cloneGraph(this.diagram());
      const guides: { x?: number; y?: number } = {};

      for (const node of updated.nodes) {
        const init = this.dragState.initialNodePositions.get(node.key);
        if (!init) continue;
        let nx = init.x + dxWorld;
        let ny = init.y + dyWorld;
        if (snap) {
          nx = snapToGrid(nx, 8);
          ny = snapToGrid(ny, 8);
        }

        // Check alignment guides against unselected nodes
        for (const other of updated.nodes) {
          if (this.dragState.initialNodePositions.has(other.key)) continue;
          if (Math.abs(nx - other.x) <= 6) {
            nx = other.x;
            guides.x = other.x;
          }
          if (Math.abs(ny - other.y) <= 6) {
            ny = other.y;
            guides.y = other.y;
          }
        }
        node.x = Math.round(nx);
        node.y = Math.round(ny);
      }

      this.alignmentGuides.set(guides);
      this.diagram.set(updated);
      this.animationEngine.setGraph(updated);
    } else if (this.dragState.mode === 'group' && this.dragState.groupId && this.dragState.initialGroupPos) {
      const updated = cloneGraph(this.diagram());
      const grp = (updated.groups || []).find((g) => g.id === this.dragState!.groupId);
      if (grp) {
        const gx = snap
          ? snapToGrid(this.dragState.initialGroupPos.x + dxWorld, 8)
          : Math.round(this.dragState.initialGroupPos.x + dxWorld);
        const gy = snap
          ? snapToGrid(this.dragState.initialGroupPos.y + dyWorld, 8)
          : Math.round(this.dragState.initialGroupPos.y + dyWorld);
        const deltaX = gx - this.dragState.initialGroupPos.x;
        const deltaY = gy - this.dragState.initialGroupPos.y;
        grp.x = gx;
        grp.y = gy;
        for (const node of updated.nodes) {
          const init = this.dragState.initialNodePositions.get(node.key);
          if (init) {
            node.x = init.x + deltaX;
            node.y = init.y + deltaY;
          }
        }
        this.diagram.set(updated);
        this.animationEngine.setGraph(updated);
      }
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(event: MouseEvent): void {
    const conn = this.connectingFrom();
    if (conn) {
      // Dropped in empty canvas space -> open Quick-Add menu to create & auto-connect
      const world = this.screenToWorld(event.clientX, event.clientY);
      const dist = Math.hypot(world.x - conn.startX, world.y - conn.startY);
      this.connectingFrom.set(null);
      if (dist > 36) {
        this.quickAddPopup.set({
          worldX: world.x,
          worldY: world.y,
          screenX: event.clientX,
          screenY: event.clientY,
          fromSourceKey: conn.sourceKey,
        });
      }
      return;
    }

    if (this.marqueeRect()) {
      this.marqueeRect.set(null);
      return;
    }

    if (this.dragState) {
      if (
        (this.dragState.mode === 'node' || this.dragState.mode === 'group') &&
        this.dragState.moved
      ) {
        this.history.record('Move elements', this.dragState.beforeGraph, this.diagram());
        this.scheduleAutosave();
      }
      this.alignmentGuides.set({});
      this.dragState = null;
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.setZoom(this.zoom() + delta);
  }

  setZoom(nextZoom: number): void {
    const clamped = Math.min(2.0, Math.max(0.25, Number(nextZoom.toFixed(2))));
    this.zoom.set(clamped);
  }

  fitToScreen(onlySelection = false): void {
    const nodes = onlySelection
      ? this.diagram().nodes.filter((n) => this.selectedNodeKeys().has(n.key))
      : this.diagram().nodes;
    if (nodes.length === 0) {
      this.zoom.set(1);
      this.panX.set(80);
      this.panY.set(60);
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x)) - 140;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 140;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 100;

    const spanW = Math.max(300, maxX - minX);
    const spanH = Math.max(240, maxY - minY);
    const viewW = 920;
    const viewH = 620;
    const z = Math.min(1.5, Math.max(0.35, Math.min(viewW / spanW, viewH / spanH)));
    this.zoom.set(Number(z.toFixed(2)));
    this.panX.set(Math.round(viewW / 2 - ((minX + maxX) / 2) * z + 60));
    this.panY.set(Math.round(viewH / 2 - ((minY + maxY) / 2) * z + 40));
  }

  centerOnElement(elementType: 'node' | 'edge' | 'diagram', elementId?: string): void {
    if (!elementId) return;
    if (elementType === 'node') {
      const node = this.diagram().nodes.find((n) => n.key === elementId);
      if (node) {
        this.selectSingleNode(node.key);
        this.panX.set(Math.round(520 - node.x * this.zoom()));
        this.panY.set(Math.round(340 - node.y * this.zoom()));
      }
    } else if (elementType === 'edge') {
      const edge = this.diagram().edges.find((e) => e.id === elementId);
      if (edge) {
        this.selectEdge(edge.id);
        const mid = this.getEdgeMidpoint(edge);
        this.panX.set(Math.round(520 - mid.x * this.zoom()));
        this.panY.set(Math.round(340 - mid.y * this.zoom()));
      }
    }
  }

  // ==========================================================================
  // Connection Creation & Geometry
  // ==========================================================================

  createConnection(sourceKey: string, targetKey: string): void {
    if (!sourceKey || !targetKey) return;
    const graph = this.diagram();
    const srcNode = graph.nodes.find((n) => n.key === sourceKey);
    const tgtNode = graph.nodes.find((n) => n.key === targetKey);
    if (!srcNode || !tgtNode) return;

    if (srcNode.props?.maxOutPorts === 0 || tgtNode.props?.maxInPorts === 0) {
      this.showToast('Cannot connect: port capacity is 0 on one of the blocks.');
      return;
    }

    const duplicate = graph.edges.find(
      (e) => e.source === sourceKey && e.target === targetKey,
    );
    if (duplicate) {
      this.selectEdge(duplicate.id);
      return;
    }

    const edgeId = `e-${sourceKey}-${targetKey}-${Date.now().toString(36).slice(-4)}`;
    this.applyMutation(`Connect ${sourceKey} to ${targetKey}`, (d) => {
      d.edges.push({
        id: edgeId,
        from: sourceKey,
        to: targetKey,
        source: sourceKey,
        target: targetKey,
        label: sourceKey === targetKey ? 'retry' : undefined,
        discovered: false,
        status: 'defined',
        style: {
          type: 'curved',
          color: 'default',
          thickness: 'normal',
          dashed: sourceKey === targetKey,
          arrowhead: 'arrow',
          direction: 'one-way',
        },
        flow: {
          expectedLatencyMs: 400,
          speedMultiplier: 1,
          tokenStyle: 'inherit',
          terminal: false,
        },
      });
    });

    this.selectEdge(edgeId);
    this.announce(`Connected ${srcNode.label} to ${tgtNode.label}`);
    this.telemetry.track('edge_created', { selfLoop: sourceKey === targetKey });
  }

  getNodeHalfSize(node: DiagramNode): { hw: number; hh: number } {
    const size = node.props?.size || 'M';
    if (node.props?.shape === 'diamond') {
      return size === 'L'
        ? { hw: 64, hh: 46 }
        : size === 'S'
          ? { hw: 44, hh: 32 }
          : { hw: 54, hh: 38 };
    }
    return size === 'L'
      ? { hw: 92, hh: 36 }
      : size === 'S'
        ? { hw: 64, hh: 24 }
        : { hw: 76, hh: 28 };
  }

  getInputPortCoords(node: DiagramNode): { x: number; y: number } {
    const { hw, hh } = this.getNodeHalfSize(node);
    if (this.diagram().direction === 'TB') {
      return { x: node.x, y: node.y - hh };
    }
    return { x: node.x - hw, y: node.y };
  }

  getOutputPortCoords(node: DiagramNode): { x: number; y: number } {
    const { hw, hh } = this.getNodeHalfSize(node);
    if (this.diagram().direction === 'TB') {
      return { x: node.x, y: node.y + hh };
    }
    return { x: node.x + hw, y: node.y };
  }

  getEdgePath(edge: DiagramEdge): string {
    const nodes = this.diagram().nodes;
    const s = nodes.find((n) => n.key === edge.source);
    const t = nodes.find((n) => n.key === edge.target);
    if (!s || !t) return '';

    // Self-loop retry arc
    if (s.key === t.key) {
      const x = s.x;
      const y = s.y - 28;
      return `M ${x - 24} ${y} C ${x - 56} ${y - 64}, ${x + 56} ${y - 64}, ${x + 24} ${y}`;
    }

    const start = this.getOutputPortCoords(s);
    const end = this.getInputPortCoords(t);
    const styleType = edge.style?.type || 'curved';

    if (styleType === 'straight') {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    if (styleType === 'step') {
      if (this.diagram().direction === 'TB') {
        const midY = Math.round((start.y + end.y) / 2);
        return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
      }
      const midX = Math.round((start.x + end.x) / 2);
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    }

    if (this.diagram().direction === 'TB') {
      const dy = Math.max(40, Math.abs(end.y - start.y) * 0.45);
      return `M ${start.x} ${start.y} C ${start.x} ${start.y + dy}, ${end.x} ${end.y - dy}, ${end.x} ${end.y}`;
    }
    const dx = Math.max(48, Math.abs(end.x - start.x) * 0.45);
    return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
  }

  getEdgeMidpoint(edge: DiagramEdge): { x: number; y: number } {
    const nodes = this.diagram().nodes;
    const s = nodes.find((n) => n.key === edge.source);
    const t = nodes.find((n) => n.key === edge.target);
    if (!s || !t) return { x: 0, y: 0 };
    if (s.key === t.key) {
      return { x: s.x, y: s.y - 76 };
    }
    const start = this.getOutputPortCoords(s);
    const end = this.getInputPortCoords(t);
    return {
      x: Math.round((start.x + end.x) / 2),
      y: Math.round((start.y + end.y) / 2),
    };
  }

  getEdgeStrokeColor(edge: DiagramEdge): string {
    if (this.selectedEdgeId() === edge.id) return '#0EA5E9';
    if (this.highlightedPath().edgeIds.has(edge.id)) return '#10B981';
    if (edge.status === 'discovered') return '#F59E0B';
    const c = edge.style?.color;
    if (c === 'success') return '#10B981';
    if (c === 'warn') return '#F59E0B';
    if (c === 'error') return '#EF4444';
    if (c && c.startsWith('#')) return c;
    return '#475569';
  }

  getEdgeStrokeWidth(edge: DiagramEdge): number {
    const t = edge.style?.thickness || 'normal';
    const base = t === 'thin' ? 1.5 : t === 'thick' ? 3.5 : t === 'volume' ? 4 : 2.2;
    return this.selectedEdgeId() === edge.id ? base + 0.8 : base;
  }

  // ==========================================================================
  // Inspector Property Mutations
  // ==========================================================================

  updateSelectedNodeField(
    field: 'label' | 'type' | 'icon',
    value: string,
  ): void {
    const node = this.selectedSingleNode();
    if (!node) return;
    this.applyMutation(
      `Update block ${field}`,
      (d) => {
        const target = d.nodes.find((n) => n.key === node.key);
        if (target) {
          (target as unknown as Record<string, unknown>)[field] = value;
        }
      },
      `node-${node.key}-${field}`,
    );
    this.telemetry.track('inspector_used', { tab: this.nodeInspectorTab(), field });
  }

  updateSelectedNodeProp(propKey: string, value: unknown): void {
    const node = this.selectedSingleNode();
    if (!node) return;
    this.applyMutation(
      `Update block ${propKey}`,
      (d) => {
        const target = d.nodes.find((n) => n.key === node.key);
        if (target) {
          target.props = { ...(target.props || {}), [propKey]: value };
        }
      },
      `node-${node.key}-prop-${propKey}`,
    );
    this.telemetry.track('inspector_used', { tab: this.nodeInspectorTab(), propKey });
  }

  commitNodeKeyRename(): void {
    const node = this.selectedSingleNode();
    if (!node) return;
    const rawNewKey = this.editingKeyDraft().trim();
    if (!rawNewKey || rawNewKey === node.key) return;
    if (!isValidNodeKey(rawNewKey)) {
      this.showToast('Invalid key format: use [a-z0-9-_.]{1,64}');
      return;
    }
    if (this.diagram().nodes.some((n) => n.key === rawNewKey)) {
      this.showToast(`Key "${rawNewKey}" is already used by another block.`);
      return;
    }

    const oldKey = node.key;
    const keepAlias = this.keepOldKeyAlias();

    this.applyMutation(`Rename key ${oldKey} to ${rawNewKey}`, (d) => {
      const target = d.nodes.find((n) => n.key === oldKey);
      if (!target) return;
      target.key = rawNewKey;
      if (keepAlias) {
        const aliases = new Set(target.props?.aliases || []);
        aliases.add(oldKey);
        target.props = { ...(target.props || {}), aliases: Array.from(aliases) };
      }
      for (const edge of d.edges) {
        if (edge.source === oldKey || edge.from === oldKey) {
          edge.source = rawNewKey;
          edge.from = rawNewKey;
        }
        if (edge.target === oldKey || edge.to === oldKey) {
          edge.target = rawNewKey;
          edge.to = rawNewKey;
        }
      }
    });

    this.selectedNodeKeys.set(new Set([rawNewKey]));
    this.showToast(
      keepAlias
        ? `Key renamed to "${rawNewKey}" (kept "${oldKey}" as 7-day alias).`
        : `Key renamed to "${rawNewKey}".`,
    );
  }

  async saveNodeAsCustomBlock(): Promise<void> {
    const node = this.selectedSingleNode();
    const pid = this.projectId();
    if (!node || !pid) return;

    try {
      const created = await this.api.createCustomBlock(pid, {
        name: node.label,
        category: 'My Blocks',
        nodeType: node.type,
        icon: node.icon || 'lib:widgets',
        tint: node.props?.tint || '#0EA5E9',
        role: node.props?.role || 'normal',
        defaultProps: (node.props || {}) as Record<string, unknown>,
      });
      this.customBlocks.set([created, ...this.customBlocks()]);
      this.showToast(`Saved "${created.name}" to My Blocks.`);
    } catch {
      this.showToast('Could not save block to My Blocks.');
    }
  }

  async deleteCustomBlock(blockId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const pid = this.projectId();
    if (!pid) return;
    try {
      await this.api.deleteCustomBlock(pid, blockId);
      this.customBlocks.set(this.customBlocks().filter((b) => b.id !== blockId));
      this.showToast('Removed block from My Blocks.');
    } catch {
      this.showToast('Could not remove block from My Blocks.');
    }
  }

  updateSelectedEdgeLabel(label: string): void {
    const edge = this.selectedSingleEdge();
    if (!edge) return;
    this.applyMutation(
      'Update connection label',
      (d) => {
        const target = d.edges.find((e) => e.id === edge.id);
        if (target) target.label = label;
      },
      `edge-${edge.id}-label`,
    );
  }

  updateSelectedEdgeStyle(key: string, value: unknown): void {
    const edge = this.selectedSingleEdge();
    if (!edge) return;
    this.applyMutation(
      `Update connection style ${key}`,
      (d) => {
        const target = d.edges.find((e) => e.id === edge.id);
        if (target) {
          target.style = { ...(target.style || {}), [key]: value };
        }
      },
      `edge-${edge.id}-style-${key}`,
    );
  }

  updateSelectedEdgeFlow(key: string, value: unknown): void {
    const edge = this.selectedSingleEdge();
    if (!edge) return;
    this.applyMutation(
      `Update connection flow ${key}`,
      (d) => {
        const target = d.edges.find((e) => e.id === edge.id);
        if (target) {
          target.flow = { ...(target.flow || {}), [key]: value };
        }
      },
      `edge-${edge.id}-flow-${key}`,
    );
  }

  resolveDiscoveredEdge(accept: boolean): void {
    const edge = this.selectedSingleEdge();
    if (!edge) return;
    if (accept) {
      this.applyMutation('Accept discovered connection', (d) => {
        const target = d.edges.find((e) => e.id === edge.id);
        if (target) {
          target.status = 'defined';
          target.discovered = false;
        }
      });
      this.showToast('Connection accepted into diagram.');
    } else {
      this.deleteSelectedElements();
      this.showToast('Discovered connection rejected.');
    }
  }

  // ==========================================================================
  // Multi-select Align, Distribute, Group, Duplicate & Delete
  // ==========================================================================

  alignSelectedNodes(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    const keys = this.selectedNodeKeys();
    if (keys.size < 2) return;
    this.applyMutation(`Align ${mode}`, (d) => {
      const sel = d.nodes.filter((n) => keys.has(n.key) && !n.props?.locked);
      if (sel.length < 2) return;
      const xs = sel.map((n) => n.x);
      const ys = sel.map((n) => n.y);
      const targetVal =
        mode === 'left'
          ? Math.min(...xs)
          : mode === 'right'
            ? Math.max(...xs)
            : mode === 'center'
              ? Math.round((Math.min(...xs) + Math.max(...xs)) / 2)
              : mode === 'top'
                ? Math.min(...ys)
                : mode === 'bottom'
                  ? Math.max(...ys)
                  : Math.round((Math.min(...ys) + Math.max(...ys)) / 2);

      for (const n of sel) {
        if (mode === 'left' || mode === 'center' || mode === 'right') n.x = targetVal;
        else n.y = targetVal;
      }
    });
  }

  distributeSelectedNodes(axis: 'horizontal' | 'vertical'): void {
    const keys = this.selectedNodeKeys();
    if (keys.size < 3) return;
    this.applyMutation(`Distribute ${axis}`, (d) => {
      const sel = d.nodes.filter((n) => keys.has(n.key) && !n.props?.locked);
      if (sel.length < 3) return;
      if (axis === 'horizontal') {
        sel.sort((a, b) => a.x - b.x);
        const min = sel[0].x;
        const max = sel[sel.length - 1].x;
        const step = (max - min) / (sel.length - 1);
        sel.forEach((n, i) => (n.x = snapToGrid(min + i * step)));
      } else {
        sel.sort((a, b) => a.y - b.y);
        const min = sel[0].y;
        const max = sel[sel.length - 1].y;
        const step = (max - min) / (sel.length - 1);
        sel.forEach((n, i) => (n.y = snapToGrid(min + i * step)));
      }
    });
  }

  groupSelectedNodes(): void {
    const keys = this.selectedNodeKeys();
    if (keys.size === 0) return;
    const grpId = `zone-${Date.now().toString(36)}`;
    this.applyMutation('Group selected blocks into zone', (d) => {
      const sel = d.nodes.filter((n) => keys.has(n.key));
      if (sel.length === 0) return;
      const minX = Math.min(...sel.map((n) => n.x));
      const maxX = Math.max(...sel.map((n) => n.x));
      const minY = Math.min(...sel.map((n) => n.y));
      const maxY = Math.max(...sel.map((n) => n.y));
      d.groups = d.groups || [];
      d.groups.push({
        id: grpId,
        name: `Zone ${(d.groups.length || 0) + 1}`,
        color: '#6366F1',
        x: snapToGrid(minX - 96),
        y: snapToGrid(minY - 72),
        width: snapToGrid(Math.max(260, maxX - minX + 192)),
        height: snapToGrid(Math.max(160, maxY - minY + 144)),
        collapsed: false,
        locked: false,
      });
      for (const n of sel) {
        n.props = { ...(n.props || {}), groupId: grpId };
      }
    });
    this.selectGroup(grpId);
  }

  renameSelectedGroup(name: string): void {
    const grp = this.selectedSingleGroup();
    if (!grp) return;
    this.applyMutation(
      'Rename zone',
      (d) => {
        const g = (d.groups || []).find((x) => x.id === grp.id);
        if (g) g.name = name;
      },
      `group-${grp.id}-name`,
    );
  }

  toggleSelectedGroupCollapse(collapsed: boolean): void {
    const grp = this.selectedSingleGroup();
    if (!grp) return;
    this.applyMutation('Toggle zone collapse', (d) => {
      const g = (d.groups || []).find((x) => x.id === grp.id);
      if (g) g.collapsed = collapsed;
    });
  }

  setThemePreview(theme: 'dark' | 'light'): void {
    this.applyMutation('Switch theme preview', (d) => {
      d.themePreview = theme;
    });
  }

  setAutoDiscovery(enabled: boolean): void {
    this.applyMutation('Toggle auto-discovery', (d) => {
      d.autoDiscovery = enabled;
    });
  }

  ungroupSelectedZone(): void {
    const grp = this.selectedSingleGroup();
    if (!grp) return;
    this.applyMutation(`Ungroup ${grp.name}`, (d) => {
      d.groups = (d.groups || []).filter((g) => g.id !== grp.id);
      for (const n of d.nodes) {
        if (n.props?.groupId === grp.id) {
          n.props = { ...n.props, groupId: undefined };
        }
      }
    });
    this.clearSelection();
  }

  duplicateSelectedNodes(): void {
    const keys = this.selectedNodeKeys();
    if (keys.size === 0) return;
    const newKeys = new Set<string>();
    this.applyMutation('Duplicate selection', (d) => {
      const existing = new Set(d.nodes.map((n) => n.key));
      const keyMap = new Map<string, string>();
      for (const n of d.nodes.filter((node) => keys.has(node.key))) {
        const dupKey = ensureUniqueKey(n.key, existing);
        existing.add(dupKey);
        keyMap.set(n.key, dupKey);
        newKeys.add(dupKey);
        const clone: DiagramNode = JSON.parse(JSON.stringify(n));
        clone.key = dupKey;
        clone.label = `${n.label} Copy`;
        clone.x = snapToGrid(n.x + 40);
        clone.y = snapToGrid(n.y + 40);
        d.nodes.push(clone);
      }
      for (const e of d.edges.filter(
        (edge) =>
          keys.has(edge.source || edge.from || '') &&
          keys.has(edge.target || edge.to || ''),
      )) {
        const ns = keyMap.get(e.source || e.from || '')!;
        const nt = keyMap.get(e.target || e.to || '')!;
        d.edges.push({
          ...JSON.parse(JSON.stringify(e)),
          id: `e-${ns}-${nt}-${Date.now().toString(36).slice(-4)}`,
          from: ns,
          to: nt,
          source: ns,
          target: nt,
        });
      }
    });
    this.selectedNodeKeys.set(newKeys);
  }

  deleteSelectedElements(): void {
    if (this.isPhoneView()) return;
    const nodeKeys = this.selectedNodeKeys();
    const edgeId = this.selectedEdgeId();
    const groupId = this.selectedGroupId();

    if (nodeKeys.size === 0 && !edgeId && !groupId) return;

    this.applyMutation('Delete selected elements', (d) => {
      if (nodeKeys.size > 0) {
        const unlockedToDelete = new Set(
          d.nodes
            .filter((n) => nodeKeys.has(n.key) && !n.props?.locked)
            .map((n) => n.key),
        );
        d.nodes = d.nodes.filter((n) => !unlockedToDelete.has(n.key));
        d.edges = d.edges.filter(
          (e) =>
            !unlockedToDelete.has(e.source || e.from || '') &&
            !unlockedToDelete.has(e.target || e.to || ''),
        );
      }
      if (edgeId) {
        d.edges = d.edges.filter((e) => e.id !== edgeId);
      }
      if (groupId) {
        d.groups = (d.groups || []).filter((g) => g.id !== groupId);
        for (const n of d.nodes) {
          if (n.props?.groupId === groupId) {
            n.props = { ...n.props, groupId: undefined };
          }
        }
      }
    });
    this.clearSelection();
    this.announce('Deleted selected elements');
  }

  runAutoLayout(direction: 'LR' | 'TB'): void {
    this.showLayoutMenu.set(false);
    const before = cloneGraph(this.diagram());
    const after = autoLayoutDiagram(before, direction);
    this.history.record(`Auto-layout ${direction}`, before, after);
    this.diagram.set(after);
    this.animationEngine.setGraph(after);
    this.scheduleAutosave();
    this.fitToScreen(false);
    this.showToast(`Applied ${direction === 'LR' ? 'Left-to-Right' : 'Top-to-Bottom'} layout.`);
  }

  runTidySelection(): void {
    this.showLayoutMenu.set(false);
    const keys =
      this.selectedNodeKeys().size > 0
        ? this.selectedNodeKeys()
        : new Set(this.diagram().nodes.map((n) => n.key));
    const before = cloneGraph(this.diagram());
    const after = tidySelectedNodes(before, keys);
    this.history.record('Tidy blocks', before, after);
    this.diagram.set(after);
    this.animationEngine.setGraph(after);
    this.scheduleAutosave();
  }

  // ==========================================================================
  // Preview Flow Mode & Real Test Event (Section 8 & 7.1)
  // ==========================================================================

  private dispatchTimelineEvent(ev: Record<string, unknown>): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const type = (ev['type'] || ev['t']) as string;
    const traceId = (ev['traceId'] as string) || 'preview';
    if (type === 'spawn') {
      this.animationEngine.enqueueSpawn(
        {
          t: 'spawn',
          traceId,
          branch: 'main',
          node: ev['node'] as string,
          status: 'ok',
          entity: ev['entity'] as never,
          ts: now,
        },
        now,
      );
    } else if (type === 'hop') {
      this.animationEngine.enqueueHop(
        {
          t: 'hop',
          traceId,
          branch: 'main',
          from: ev['from'] as string,
          to: ev['to'] as string,
          edgeId: (ev['edgeId'] as string) || `${ev['from']}->${ev['to']}`,
          unmapped: false,
          status: ((ev['status'] as string) || 'ok') as 'ok' | 'warn' | 'error',
          ts: now,
        },
        now,
      );
    } else if (type === 'carry') {
      this.animationEngine.enqueueCarry(
        {
          t: 'carry',
          traceId,
          branch: 'main',
          node: ev['node'] as string,
          op: ((ev['op'] as string) || 'add') as 'add' | 'remove' | 'clear',
          carry: ev['carry'] as never,
          ts: now,
        },
        now,
      );
    } else if (type === 'complete') {
      this.animationEngine.enqueueComplete(
        {
          t: 'complete',
          traceId,
          branch: 'main',
          node: (ev['node'] as string) || '',
          carry: (ev['carry'] as never) || { count: 1, total: 50, currency: 'USD', topIcons: [] },
          ts: now,
        },
        now,
      );
    } else if (type === 'fail') {
      this.animationEngine.enqueueFail(
        {
          t: 'fail',
          traceId,
          branch: 'main',
          node: (ev['node'] as string) || '',
          reason: (ev['reason'] as string) || 'failed',
          ts: now,
        },
        now,
      );
    } else if (type === 'abandon') {
      this.animationEngine.enqueueAbandon(
        {
          t: 'abandon',
          traceId,
          branch: 'main',
          node: (ev['node'] as string) || '',
          carry: (ev['carry'] as never) || { count: 1, total: 50, currency: 'USD', topIcons: [] },
          ts: now,
        },
        now,
      );
    } else if (type === 'end') {
      this.animationEngine.enqueueEnd(
        {
          t: 'end',
          traceId,
          branch: 'main',
          node: (ev['node'] as string) || '',
          outcome: (ev['outcome'] as string) || 'ok',
          ts: now,
        },
        now,
      );
    }
  }

  runPreviewFlow(startNodeKey?: string): void {
    this.clearPreviewTimers();
    const graph = this.diagram();
    if (graph.nodes.length === 0) {
      this.showToast('Add at least one block to preview the request flow.');
      return;
    }

    const selectedNode = this.selectedSingleNode();
    const chosenStart =
      startNodeKey ||
      (selectedNode &&
      (selectedNode.props?.role === 'start' || selectedNode.type === 'client')
        ? selectedNode.key
        : undefined);

    const result = generatePreviewRun(graph, { startNodeKey: chosenStart });
    this.previewResult.set(result);
    this.previewRunning.set(true);
    this.animationEngine.setGraph(graph);

    let delayAcc = 0;
    for (const ev of result.timelineEvents) {
      const stepDelay = ev.t === 'hop' ? 380 : 120;
      const timer = setTimeout(() => {
        this.dispatchTimelineEvent(ev as unknown as Record<string, unknown>);
      }, delayAcc);
      this.previewTimers.push(timer);
      delayAcc += stepDelay;
    }

    const doneTimer = setTimeout(() => {
      this.previewRunning.set(false);
    }, delayAcc + 800);
    this.previewTimers.push(doneTimer);

    this.telemetry.track('preview_run', {
      steps: result.steps.length,
      outcome: result.terminalOutcome,
    });
  }

  stopPreviewFlow(): void {
    this.clearPreviewTimers();
    this.previewRunning.set(false);
    this.previewResult.set(null);
  }

  private clearPreviewTimers(): void {
    for (const t of this.previewTimers) clearTimeout(t);
    this.previewTimers = [];
  }

  sendTestEventForSelectedBlock(): void {
    const node = this.selectedSingleNode();
    const pid = this.projectId();
    if (!node || !pid) return;

    const traceId = `test-${Date.now().toString(36)}`;
    this.animationEngine.setGraph(this.diagram());
    this.dispatchTimelineEvent({
      type: 'spawn',
      traceId,
      node: node.key,
    });

    const outEdge = this.diagram().edges.find(
      (e) => (e.source || e.from) === node.key,
    );
    if (outEdge) {
      setTimeout(() => {
        this.dispatchTimelineEvent({
          type: 'hop',
          traceId,
          from: node.key,
          to: outEdge.target || outEdge.to,
          edgeId: outEdge.id,
          latencyMs: outEdge.flow?.expectedLatencyMs ?? 320,
          status: 'ok',
        });
      }, 150);
    }

    this.showToast(`Animated test checkpoint on "${node.key}".`);
    this.telemetry.track('test_event_sent', { role: node.props?.role || 'normal' });
  }

  copySnippetToClipboard(): void {
    const code = this.currentSnippet();
    if (!code || typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(code);
    this.showToast('Copied integration snippet to clipboard.');
    this.telemetry.track('snippet_copied', { lang: this.snippetLang() });
  }

  copyKeyToClipboard(key: string): void {
    if (!key || typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(key);
    this.showToast(`Copied key "${key}" to clipboard.`);
  }

  // ==========================================================================
  // Publish, Version History, Save as Template & Import/Export JSON
  // ==========================================================================

  openPublishModal(): void {
    if (this.errorIssues().length > 0) {
      this.showValidationDrawer.set(true);
      this.telemetry.track('validation_error_shown', {
        errorCount: this.errorIssues().length,
      });
      this.showToast('Resolve validation errors before publishing.');
      return;
    }
    this.publishSummary.set('');
    this.lastPublishAffectedCount.set(null);
    this.showPublishModal.set(true);
  }

  async confirmPublish(): Promise<void> {
    const pid = this.projectId();
    if (!pid || this.publishing()) return;
    this.publishing.set(true);

    try {
      const res = await this.api.publishDiagram(
        pid,
        this.diagram(),
        this.publishSummary() || 'Published from diagram editor',
      );
      this.publishing.set(false);
      this.baseVersion.set(res.syncedDraft?.draftVersion ?? res.published.version);
      this.lastPublishAffectedCount.set(res.affectedEventsLast24h ?? 0);
      this.saveStatus.set('saved');
      this.showPublishModal.set(false);
      try {
        const v = await this.api.listDiagramVersions(pid);
        this.versions.set(v);
      } catch {
        // Ignore version list refresh error
      }
      this.showToast(
        `Published v${res.published.version} (${res.affectedEventsLast24h ?? 0} events in 24h affected).`,
      );
      this.telemetry.track('draft_published', {
        version: res.published.version,
        nodeCount: this.diagram().nodes.length,
      });
    } catch (err: unknown) {
      this.publishing.set(false);
      const msg = err instanceof Error ? err.message : 'Failed to publish diagram. Check validation issues.';
      this.showToast(msg);
    }
  }

  async restoreVersionToDraft(version: number): Promise<void> {
    const pid = this.projectId();
    if (!pid) return;
    try {
      const restored = await this.api.restoreDiagramVersion(pid, version);
      const v2 = migrateDiagramToV2(restored.graph || restored.diagram || null);
      this.diagram.set(v2);
      this.animationEngine.setGraph(v2);
      this.scheduleAutosave();
      this.showVersionsModal.set(false);
      this.showToast(`Restored version v${version} into current draft.`);
    } catch {
      this.showToast(`Could not restore version v${version}.`);
    }
  }

  exportDiagramJson(): void {
    const data = JSON.stringify(this.diagram(), null, 2);
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.projectId() || 'flowtrace'}-diagram-v2.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported diagram JSON.');
  }

  confirmImportJson(): void {
    const raw = this.importJsonText().trim();
    if (!raw) return;
    if (raw.length > 2 * 1024 * 1024) {
      this.importError.set('JSON payload exceeds the 2 MB size limit.');
      return;
    }
    try {
      const parsed = JSON.parse(raw) as DiagramGraph;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        this.importError.set('JSON must contain "nodes" and "edges" arrays.');
        return;
      }
      const v2 = migrateDiagramToV2(parsed);
      this.applyMutation('Import diagram JSON', (d) => {
        d.schema = 2;
        d.direction = v2.direction;
        d.nodes = v2.nodes;
        d.edges = v2.edges;
        d.groups = v2.groups;
      });
      this.showImportModal.set(false);
      this.importJsonText.set('');
      this.importError.set('');
      this.fitToScreen(false);
      this.showToast(`Imported ${v2.nodes.length} blocks and ${v2.edges.length} connections.`);
    } catch {
      this.importError.set('Invalid JSON syntax.');
    }
  }

  async saveDiagramAsTemplate(): Promise<void> {
    const title = this.templateTitle().trim();
    if (!title) return;
    try {
      await this.api.saveCustomTemplate({
        name: title,
        category: this.templateCategory(),
        description: this.templateSummary() || 'Saved from Advanced Diagram Editor',
        diagram: this.diagram(),
      });
      this.showSaveTemplateModal.set(false);
      this.showToast(`Saved "${title}" to template gallery.`);
    } catch {
      this.showToast('Could not save template.');
    }
  }

  // ==========================================================================
  // Keyboard Shortcuts (Section 6)
  // ==========================================================================

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (event.code === 'Space' && !isInput) {
      this.spacePressed.set(true);
    }

    const cmdOrCtrl = event.metaKey || event.ctrlKey;

    if (cmdOrCtrl && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.showCommandPalette.set(!this.showCommandPalette());
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.saveDraftNow();
      this.showToast('Draft saved.');
      return;
    }
    if (cmdOrCtrl && event.key === 'Enter') {
      event.preventDefault();
      this.runPreviewFlow();
      return;
    }

    if (isInput) return;

    if (cmdOrCtrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.duplicateSelectedNodes();
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this.groupSelectedNodes();
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.selectedNodeKeys.set(new Set(this.diagram().nodes.map((n) => n.key)));
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 'c') {
      const keys = this.selectedNodeKeys();
      this.clipboardNodes = this.diagram()
        .nodes.filter((n) => keys.has(n.key))
        .map((n) => JSON.parse(JSON.stringify(n)));
      return;
    }
    if (cmdOrCtrl && event.key.toLowerCase() === 'v') {
      if (this.clipboardNodes.length > 0) {
        event.preventDefault();
        this.applyMutation('Paste blocks', (d) => {
          const existing = new Set(d.nodes.map((n) => n.key));
          for (const clip of this.clipboardNodes) {
            const k = ensureUniqueKey(clip.key, existing);
            existing.add(k);
            d.nodes.push({
              ...JSON.parse(JSON.stringify(clip)),
              key: k,
              x: snapToGrid(clip.x + 32),
              y: snapToGrid(clip.y + 32),
            });
          }
        });
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.deleteSelectedElements();
      return;
    }
    if (event.key === 'Escape') {
      this.clearSelection();
      this.inspectorClosedExplicitly.set(true);
      this.showCommandPalette.set(false);
      this.showShortcutsModal.set(false);
      this.showPublishModal.set(false);
      return;
    }
    if (event.key === '0') {
      this.fitToScreen(false);
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      this.fitToScreen(this.selectedNodeKeys().size > 0);
      return;
    }
    if (event.key === '?') {
      this.showShortcutsModal.set(!this.showShortcutsModal());
      return;
    }

    // Arrow key nudge (1px or 10px with Shift)
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) &&
      this.selectedNodeKeys().size > 0
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx =
        event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
      const dy =
        event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
      const keys = this.selectedNodeKeys();
      this.applyMutation(
        'Nudge blocks',
        (d) => {
          for (const n of d.nodes) {
            if (keys.has(n.key) && !n.props?.locked) {
              n.x += dx;
              n.y += dy;
            }
          }
        },
        'nudge-keys',
      );
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spacePressed.set(false);
    }
  }

  // ==========================================================================
  // Animation Loop & UI Feedback Helpers
  // ==========================================================================

  private startAnimationLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = (now: number) => {
      this.animationEngine.step(now);
      const tokens = this.animationEngine.getTokens();

      const renderedTokens: {
        traceId: string;
        x: number;
        y: number;
        status: string;
        label?: string;
        carryCount: number;
      }[] = [];

      const counters = new Map<string, number>();

      for (const token of tokens) {
        renderedTokens.push({
          traceId: token.traceId,
          x: Math.round(token.x),
          y: Math.round(token.y),
          status: token.status,
          label: token.entity?.label,
          carryCount: token.carry?.count || 0,
        });
        const activeKey = token.toNode || token.fromNode;
        if (activeKey) {
          counters.set(activeKey, (counters.get(activeKey) || 0) + 1);
        }
      }

      this.activeTokens.set(renderedTokens);
      this.activeNodeCounters.set(counters);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  announce(msg: string): void {
    this.liveAnnouncement.set(msg);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 3200);
  }

  onCustomIconError(nodeKey: string): void {
    const next = new Set(this.brokenImageNodeKeys());
    next.add(nodeKey);
    this.brokenImageNodeKeys.set(next);
  }
}
