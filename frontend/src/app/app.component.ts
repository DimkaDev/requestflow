import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_NAME, APP_TAGLINE } from './core/branding';
import { FlowTraceApiService } from './core/api.service';
import {
  ActiveToken,
  AnimationEngine,
  BLUEPRINT_CARD_HEIGHT,
  BLUEPRINT_CARD_WIDTH,
  GhostEdge,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  NodeVisualEffect,
} from './core/animation-engine';
import {
  ApiKey,
  AuditLogEntry,
  CarrySummary,
  ConnectorConfig,
  ConnectorStatus,
  ConnectorType,
  CreatedConnectorResponse,
  DiagramEdge,
  DiagramGraph,
  DiagramNode,
  DiagramVersion,
  EntityInfo,
  HopVisualStyle,
  Invitation,
  NodeType,
  NodeVisualStyle,
  OrgRole,
  OrganizationMember,
  OrganizationUsage,
  OrganizationView,
  PlanTier,
  Project,
  RotatedApiKeyResult,
  TemplateDefinition,
  TraceDetail,
  TraceSummary,
  UiStreamEvent,
  WebhookMapping,
  Workspace,
} from './core/models';

type ScreenTab = 'live' | 'traces' | 'projects' | 'team' | 'settings' | 'login';
type EditorDesignMode = 'classic-palette' | 'blueprint-studio';
type StudioTab = 'composer' | 'blueprints' | 'quick';

export interface HopStyleOption {
  id: HopVisualStyle;
  label: string;
  shortLabel: string;
  purpose: string;
}

export interface BlueprintTemplate {
  id: string;
  name: string;
  summary: string;
  badge: string;
  nodes: Array<{ suffix: string; label: string; type: NodeType; dx: number; dy: number; icon: string }>;
  edges: Array<{ fromIdx: number; toIdx: number; label?: string }>;
}

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
  public readonly Math = Math;

  // Navigation & Theme
  public readonly activeScreen = signal<ScreenTab>('live');
  public readonly theme = signal<'dark' | 'cozy-light' | 'light'>('dark');
  public readonly editorMode = signal<boolean>(false);

  // Visual Transition & Node Design Variants (preserving classic implementations)
  public readonly hopStyle = signal<HopVisualStyle>('comet');
  public readonly nodeVisualStyle = signal<NodeVisualStyle>('classic');
  public readonly editorDesignMode = signal<EditorDesignMode>('blueprint-studio');
  public readonly studioTab = signal<StudioTab>('composer');

  public readonly hopStyleOptions: HopStyleOption[] = [
    {
      id: 'comet',
      label: '1. Classic Comet (Current)',
      shortLabel: '1. Comet',
      purpose: 'Baseline particle with a 6-step fading tail for general request tracking.',
    },
    {
      id: 'laser-conduit',
      label: '2. Laser Conduit Beam',
      shortLabel: '2. Laser Beam',
      purpose: 'Illuminates the Bezier wire segment directly to eliminate floating dot clutter.',
    },
    {
      id: 'packet-capsule',
      label: '3. Telemetry Packet Capsule',
      shortLabel: '3. Capsule',
      purpose: 'Steers a tangent-aligned pill carrying trace or route metadata on the wire.',
    },
    {
      id: 'sonar-wave',
      label: '4. Sonar Wavefront',
      shortLabel: '4. Sonar Wave',
      purpose: 'Marks departure and arrival latency boundaries with expanding phase rings.',
    },
    {
      id: 'circuit-frame',
      label: '5. Stepped Circuit Frame',
      shortLabel: '5. Circuit Frame',
      purpose: 'Renders a 3-cell network frame [HDR|PAY|CRC] with channel progress fill.',
    },
  ];

  // Dynamic card dimensions based on active node visual style
  public readonly currentCardWidth = computed(() =>
    this.nodeVisualStyle() === 'blueprint' ? BLUEPRINT_CARD_WIDTH : NODE_CARD_WIDTH
  );
  public readonly currentCardHeight = computed(() =>
    this.nodeVisualStyle() === 'blueprint' ? BLUEPRINT_CARD_HEIGHT : NODE_CARD_HEIGHT
  );

  // Studio Composer Form State (New Node & Block Creation Design)
  public readonly studioNodeType = signal<NodeType>('service');
  public readonly studioNodeLabel = signal<string>('Payment Worker');
  public readonly studioNodeKeyCustom = signal<string>('');
  public readonly studioConnectFrom = signal<string>('');
  public readonly studioConnectTo = signal<string>('');
  public readonly studioEdgeLabel = signal<string>('');

  public readonly computedStudioKey = computed(() => {
    const custom = this.studioNodeKeyCustom().trim();
    if (custom) {
      return custom
        .toLowerCase()
        .replace(/[^a-z0-9-_.]/g, '-')
        .slice(0, 48);
    }
    const raw = this.studioNodeLabel().trim() || 'service-node';
    return (
      raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'node'
    );
  });

  public readonly isStudioKeyDuplicate = computed(() => {
    const key = this.computedStudioKey();
    return this.graph().nodes.some((n) => n.key === key);
  });

  public readonly blueprintTemplates: BlueprintTemplate[] = [
    {
      id: 'cache-aside',
      name: 'Cache-Aside Read Block',
      summary: 'Adds a cache lookup decision node wired to Redis Cache and Primary DB.',
      badge: '3 nodes · 2 edges',
      nodes: [
        { suffix: 'cache-check', label: 'Cache Hit?', type: 'decision', dx: 0, dy: 0, icon: 'git-branch' },
        { suffix: 'redis-cache', label: 'Redis Cache', type: 'datastore', dx: -190, dy: 150, icon: 'database' },
        { suffix: 'primary-db', label: 'Primary Postgres', type: 'datastore', dx: 190, dy: 150, icon: 'database' },
      ],
      edges: [
        { fromIdx: 0, toIdx: 1, label: 'hit' },
        { fromIdx: 0, toIdx: 2, label: 'miss' },
      ],
    },
    {
      id: 'async-dlq',
      name: 'Async Queue + Worker + DLQ',
      summary: 'Decouples writes via a topic queue, worker microservice, and dead-letter sink.',
      badge: '3 nodes · 2 edges',
      nodes: [
        { suffix: 'events-topic', label: 'Events Queue', type: 'queue', dx: 0, dy: 0, icon: 'layers' },
        { suffix: 'async-worker', label: 'Async Processor', type: 'service', dx: -140, dy: 150, icon: 'cpu' },
        { suffix: 'dlq-sink', label: 'Dead-Letter Sink', type: 'end', dx: 160, dy: 150, icon: 'check-circle' },
      ],
      edges: [
        { fromIdx: 0, toIdx: 1, label: 'consume' },
        { fromIdx: 0, toIdx: 2, label: 'retry-exhausted' },
      ],
    },
    {
      id: 'canary-split',
      name: 'Canary Traffic Router',
      summary: 'Splits incoming requests between Stable v1 and Canary v2 service instances.',
      badge: '3 nodes · 2 edges',
      nodes: [
        { suffix: 'canary-router', label: 'Canary Gate', type: 'decision', dx: 0, dy: 0, icon: 'git-branch' },
        { suffix: 'service-v1', label: 'Service v1 (90%)', type: 'service', dx: -190, dy: 150, icon: 'cpu' },
        { suffix: 'service-v2', label: 'Canary v2 (10%)', type: 'service', dx: 190, dy: 150, icon: 'cpu' },
      ],
      edges: [
        { fromIdx: 0, toIdx: 1, label: '90%' },
        { fromIdx: 0, toIdx: 2, label: '10%' },
      ],
    },
    {
      id: 'external-webhook',
      name: 'External API Egress Guard',
      summary: 'Pairs an egress rate-limiter service with a third-party external API endpoint.',
      badge: '2 nodes · 1 edge',
      nodes: [
        { suffix: 'egress-proxy', label: 'Egress Guard', type: 'service', dx: 0, dy: 0, icon: 'cpu' },
        { suffix: 'external-api', label: 'External Provider', type: 'external', dx: 0, dy: 150, icon: 'cloud' },
      ],
      edges: [{ fromIdx: 0, toIdx: 1, label: 'https' }],
    },
  ];

  // Epic 1: Organizations, Workspaces, Team Members & RBAC
  public readonly organizations = signal<OrganizationView[]>([]);
  public readonly currentOrgView = signal<OrganizationView | null>(null);
  public readonly currentWorkspace = signal<Workspace | null>(null);
  public readonly orgMembers = signal<OrganizationMember[]>([]);
  public readonly orgInvitations = signal<Invitation[]>([]);
  public readonly availableRoles: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'BILLING_ADMIN'];
  public readonly availablePlans: PlanTier[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];

  public readonly newOrgName = signal<string>('');
  public readonly newOrgBillingEmail = signal<string>('');
  public readonly editOrgName = signal<string>('');
  public readonly editOrgBillingEmail = signal<string>('');
  public readonly editOrgPlanTier = signal<PlanTier>('FREE');
  public readonly newWorkspaceName = signal<string>('');
  public readonly editWorkspaceName = signal<string>('');
  public readonly inviteEmail = signal<string>('');
  public readonly inviteRole = signal<OrgRole>('MEMBER');
  public readonly lastCreatedInviteToken = signal<string>('');
  public readonly acceptInviteTokenInput = signal<string>('');
  public readonly transferTargetUserId = signal<string>('');

  // E1-Step-6 & E1-Step-8: Soft-Delete Lifecycle & Audit Log State
  public readonly softDeletedOrgInfo = signal<{
    id: string;
    name: string;
    deletedAt: string;
  } | null>(null);
  public readonly orgAuditLogs = signal<AuditLogEntry[]>([]);
  public readonly auditActionFilter = signal<string>('');
  public readonly auditSearchQuery = signal<string>('');
  public readonly auditLoading = signal<boolean>(false);
  public readonly auditError = signal<string>('');
  public readonly auditActionCategories: Array<{ value: string; label: string }> = [
    { value: '', label: 'All Actions' },
    { value: 'org.', label: 'Organization (org.*)' },
    { value: 'workspace.', label: 'Workspaces (workspace.*)' },
    { value: 'member.', label: 'Members & Invites (member.*)' },
    { value: 'project.', label: 'Projects (project.*)' },
    { value: 'apikey.', label: 'API Keys (apikey.*)' },
    { value: 'diagram.', label: 'Diagrams (diagram.*)' },
  ];

  public readonly filteredAuditLogs = computed(() => {
    const prefix = this.auditActionFilter().trim().toLowerCase();
    const query = this.auditSearchQuery().trim().toLowerCase();
    return this.orgAuditLogs().filter((entry) => {
      if (prefix && !entry.action.toLowerCase().startsWith(prefix)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const metaText = JSON.stringify(entry.meta || {}).toLowerCase();
      return (
        entry.action.toLowerCase().includes(query) ||
        entry.actorEmail.toLowerCase().includes(query) ||
        entry.targetType.toLowerCase().includes(query) ||
        entry.targetId.toLowerCase().includes(query) ||
        metaText.includes(query)
      );
    });
  });

  // Projects & Current Project
  public readonly isLoadingInitial = signal<boolean>(true);
  public readonly apiErrorBanner = signal<string>('');
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

  // Live Counters Strip & Commerce Telemetry (Gate G1-S / E21-01 / E21-02)
  public readonly ordersCompletedCount = signal<number>(0);
  public readonly revenueToday = signal<number>(0);
  public readonly revenueCurrency = signal<string>('EUR');
  public readonly abandonedCount = signal<number>(0);
  public readonly failedCount = signal<number>(0);
  public readonly showRevenuePulse = signal<boolean>(false);

  public readonly liveVisitorsCount = computed(() => this.visibleTokens().length);
  public readonly activeCartsCount = computed(
    () => this.visibleTokens().filter((t) => (t.carry?.count ?? 0) > 0).length
  );
  public readonly conversionRate = computed(() => {
    const paid = this.ordersCompletedCount();
    const totalExited = paid + this.abandonedCount() + this.failedCount();
    if (totalExited === 0) return 0;
    return Math.round((paid / totalExited) * 1000) / 10;
  });

  // TV / Kiosk Mode (E22-01)
  public readonly tvMode = signal<boolean>(false);
  private wakeLock: any = null;

  // Public Demo View & Templates (E25-01 & E18-01)
  public readonly isPublicDemoMode = signal<boolean>(false);
  public readonly availableTemplates = signal<TemplateDefinition[]>([]);

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
  public readonly paletteTypes: Array<{
    type: NodeType;
    label: string;
    shortRole: string;
    icon: string;
  }> = [
    { type: 'source', label: 'Source / Entry', shortRole: 'Ingress HTTP, Web, Mobile', icon: 'globe' },
    { type: 'service', label: 'Microservice', shortRole: 'Stateless compute or API', icon: 'cpu' },
    { type: 'decision', label: 'Branch / Router', shortRole: 'Conditional split or guard', icon: 'git-branch' },
    { type: 'datastore', label: 'Datastore / DB', shortRole: 'Postgres, Redis, S3 storage', icon: 'database' },
    { type: 'queue', label: 'Queue / Topic', shortRole: 'Kafka, SQS, async buffer', icon: 'layers' },
    { type: 'external', label: 'External API', shortRole: 'Stripe, Cognito, 3rd-party', icon: 'cloud' },
    { type: 'end', label: 'End / Sink', shortRole: 'Terminal response or webhook', icon: 'check-circle' },
  ];

  // Replay State (M5)
  public readonly replayActive = signal<boolean>(false);
  public readonly replayProgress = signal<number>(0);
  private replayTimers: Array<ReturnType<typeof setTimeout>> = [];
  private localDemoTimer: ReturnType<typeof setInterval> | null = null;
  private syntheticCounter = 100;

  // Settings & API Keys (M3 & E4)
  public readonly apiKeys = signal<ApiKey[]>([]);
  public readonly newlyCreatedKey = signal<string>('ft_live_demo0000000000000000000000000000');
  public readonly newKeyName = signal<string>('Production Service Key');
  public readonly newKeyScopes = signal<string>('ingest');
  public readonly newProjectName = signal<string>('');
  public readonly copiedHint = signal<string>('');
  public readonly currentOrgUsage = signal<OrganizationUsage | null>(null);

  // E-Commerce Connectors & Webhooks (Gate G1-E / E20)
  public readonly projectConnectors = signal<ConnectorConfig[]>([]);
  public readonly newConnectorName = signal<string>('Shopify Orders Webhook');
  public readonly newConnectorType = signal<ConnectorType>('SHOPIFY_WEBHOOK');
  public readonly newlyCreatedConnectorToken = signal<string>('');
  public readonly webhookTestJson = signal<string>(
    '{\n  "id": 82098291194,\n  "total_price": "89.00",\n  "currency": "EUR",\n  "customer": {\n    "id": 771122,\n    "first_name": "Elena"\n  },\n  "line_items": [\n    {\n      "id": 101,\n      "title": "Wool Sweater",\n      "price": "89.00"\n    }\n  ]\n}'
  );
  public readonly webhookTestResult = signal<string>('');
  public readonly isTestingConnector = signal<boolean>(false);

  // Onboarding Wizard & Activation Checklist (E5 / Gate G1)
  public readonly showOnboardingWizard = signal<boolean>(false);
  public readonly wizardStep = signal<1 | 2 | 3>(1);
  public readonly wizardProjectName = signal<string>('My Production Mesh');
  public readonly wizardSelectedTemplate = signal<string>('microservices');
  public readonly wizardSnippetLang = signal<'curl' | 'java' | 'node' | 'python' | 'go'>('curl');
  public readonly wizardWaitingForEvent = signal<boolean>(false);
  public readonly wizardEventDetected = signal<boolean>(false);
  public readonly wizardStartTime = signal<number>(0);
  public readonly wizardTimeToFirstEvent = signal<number | null>(null);
  public readonly wizardSimulatingPing = signal<boolean>(false);

  // Activation Checklist
  public readonly showActivationChecklist = signal<boolean>(true);
  public readonly checklistCollapsed = signal<boolean>(false);
  public readonly hasSentFirstEvent = signal<boolean>(false);
  public readonly hasToggledTvMode = signal<boolean>(false);

  public readonly firstNodeKey = computed(() => this.graph().nodes[0]?.key || 'website');

  public readonly checklistItems = computed(() => [
    {
      id: 'template',
      label: 'Choose architecture template',
      actionLabel: 'Select',
      completed: this.graph().nodes.length > 0,
    },
    {
      id: 'key',
      label: 'Issue an Ingest API key',
      actionLabel: 'Create',
      completed: this.apiKeys().length > 0,
    },
    {
      id: 'event',
      label: 'Send first checkpoint event',
      actionLabel: 'Send',
      completed:
        this.hasSentFirstEvent() ||
        Object.keys(this.nodeTotals()).length > 0 ||
        this.recentTraces().length > 0,
    },
    {
      id: 'invite',
      label: 'Invite a team engineer',
      actionLabel: 'Invite',
      completed: this.orgMembers().length > 1 || this.orgInvitations().length > 0,
    },
    {
      id: 'kiosk',
      label: 'Launch Kiosk / TV mode',
      actionLabel: 'Try',
      completed: this.hasToggledTvMode() || this.tvMode(),
    },
  ]);

  public readonly checklistCompletedCount = computed(
    () => this.checklistItems().filter((item) => item.completed).length
  );

  public readonly checklistPercent = computed(() =>
    Math.round((this.checklistCompletedCount() / 5) * 100)
  );

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

  public readonly currentHopStyleInfo = computed(
    () => this.hopStyleOptions.find((o) => o.id === this.hopStyle()) ?? this.hopStyleOptions[0]
  );

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private rafId: number | null = null;
  private visibilityListener = () => this.onVisibilityChange();

  @HostListener('document:keydown.escape')
  public onEscapePressed(): void {
    if (this.tvMode()) {
      this.toggleTvMode();
      return;
    }
    if (this.connectingFromNode()) {
      this.connectingFromNode.set(null);
      return;
    }
    if (this.selectedNodeKey() || this.selectedEdgeId()) {
      this.selectedNodeKey.set(null);
      this.selectedEdgeId.set(null);
    }
  }

  @HostListener('document:fullscreenchange')
  public onFullscreenChange(): void {
    if (typeof document !== 'undefined' && !document.fullscreenElement && this.tvMode()) {
      this.tvMode.set(false);
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }
    }
  }

  public async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (mq?.matches) {
        this.engine.prefersReducedMotion = true;
      }

      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (path.includes('/demo/shop') || search.includes('demo=shop')) {
        this.isPublicDemoMode.set(true);
        this.theme.set('cozy-light');
        document.documentElement.setAttribute('data-theme', 'cozy-light');
      }

      document.addEventListener('visibilitychange', this.visibilityListener);
      this.startAnimationLoop();
      this.startLocalDemoFallbackLoop();
    }
    await this.loadInitialData();

    if (this.isPublicDemoMode()) {
      await this.applySelectedTemplate('online-shop');
    }
  }

  public ngOnDestroy(): void {
    this.closeWebSocket();
    if (this.localDemoTimer) {
      clearInterval(this.localDemoTimer);
      this.localDemoTimer = null;
    }
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
      }
    }
    this.clearReplayTimers();
  }

  private async loadInitialData(): Promise<void> {
    this.isLoadingInitial.set(true);
    this.apiErrorBanner.set('');

    if (typeof window !== 'undefined' && window.localStorage) {
      if (window.localStorage.getItem('flowtrace_checklist_collapsed') === 'true') {
        this.checklistCollapsed.set(true);
      }
      if (window.localStorage.getItem('flowtrace_checklist_dismissed') === 'true') {
        this.showActivationChecklist.set(false);
      }
    }

    try {
      const [orgList, tpls] = await Promise.all([
        this.api.listOrganizations(),
        this.api.listTemplates().catch(() => this.getBuiltInTemplates()),
      ]);
      this.availableTemplates.set(tpls && tpls.length > 0 ? tpls : this.getBuiltInTemplates());
      this.organizations.set(orgList);
      if (orgList.length > 0) {
        await this.selectOrganizationView(orgList[0]);
      } else {
        const list = await this.api.listProjects();
        this.projects.set(list);
        if (list.length > 0) {
          await this.selectProject(list[0]);
        }
      }
    } catch {
      this.availableTemplates.set(this.getBuiltInTemplates());
      this.apiErrorBanner.set(
        'Backend API unreachable on port 8080. Running with local interactive topology and client-side simulator.'
      );
      const nowIso = new Date().toISOString();
      const localOrg: OrganizationView = {
        organization: {
          id: '0194f1c0-0000-7000-8000-000000000100',
          name: 'Dev Organization',
          slug: 'dev-organization',
          billingEmail: this.loginEmail(),
          planTier: 'BUSINESS',
          createdAt: nowIso,
        },
        myRole: 'OWNER',
        permissions: [
          'ORG_VIEW',
          'ORG_MANAGE',
          'ORG_DELETE',
          'ORG_TRANSFER',
          'BILLING_MANAGE',
          'MEMBER_MANAGE',
          'WORKSPACE_MANAGE',
          'PROJECT_VIEW',
          'PROJECT_MANAGE',
          'DIAGRAM_EDIT',
          'API_KEY_MANAGE',
          'TRACE_VIEW',
        ],
        workspaces: [
          {
            id: '0194f1c0-0000-7000-8000-000000000201',
            organizationId: '0194f1c0-0000-7000-8000-000000000100',
            name: 'Production',
            slug: 'production',
            createdAt: nowIso,
          },
          {
            id: '0194f1c0-0000-7000-8000-000000000202',
            organizationId: '0194f1c0-0000-7000-8000-000000000100',
            name: 'Staging',
            slug: 'staging',
            createdAt: nowIso,
          },
        ],
      };
      this.organizations.set([localOrg]);
      this.currentOrgView.set(localOrg);
      this.currentWorkspace.set(localOrg.workspaces[0]);
      this.editOrgName.set(localOrg.organization.name);
      this.editOrgBillingEmail.set(localOrg.organization.billingEmail);
      this.editOrgPlanTier.set(localOrg.organization.planTier);
      this.editWorkspaceName.set(localOrg.workspaces[0].name);
      this.orgMembers.set([
        {
          organizationId: localOrg.organization.id,
          userId: '0194f1c0-0000-7000-8000-000000000010',
          email: this.loginEmail(),
          externalId: 'local-dev-user',
          role: 'OWNER',
          createdAt: nowIso,
        },
        {
          organizationId: localOrg.organization.id,
          userId: '0194f1c0-0000-7000-8000-000000000011',
          email: 'sre-lead@flowtrace.local',
          externalId: 'sre-lead',
          role: 'ADMIN',
          createdAt: nowIso,
        },
        {
          organizationId: localOrg.organization.id,
          userId: '0194f1c0-0000-7000-8000-000000000012',
          email: 'observer@flowtrace.local',
          externalId: 'observer',
          role: 'VIEWER',
          createdAt: nowIso,
        },
      ]);
      this.orgAuditLogs.set([
        {
          id: '0194f1c0-0000-7000-8000-000000000901',
          organizationId: localOrg.organization.id,
          actorUserId: '0194f1c0-0000-7000-8000-000000000010',
          actorEmail: this.loginEmail(),
          action: 'org.created',
          targetType: 'organization',
          targetId: localOrg.organization.id,
          meta: { name: localOrg.organization.name, slug: localOrg.organization.slug, planTier: 'BUSINESS' },
          createdAt: nowIso,
        },
        {
          id: '0194f1c0-0000-7000-8000-000000000902',
          organizationId: localOrg.organization.id,
          actorUserId: '0194f1c0-0000-7000-8000-000000000010',
          actorEmail: this.loginEmail(),
          action: 'workspace.created',
          targetType: 'workspace',
          targetId: localOrg.workspaces[0].id,
          meta: { name: 'Production', slug: 'production' },
          createdAt: nowIso,
        },
      ]);

      const fallback = this.isPublicDemoMode()
        ? this.getOnlineShopFallbackDiagram()
        : this.getMicroservicesFallbackDiagram();
      this.setDiagramGraph(fallback, false);

      this.currentOrgUsage.set({
        organizationId: localOrg.organization.id,
        planTier: 'BUSINESS',
        monthlyQuota: 1_000_000,
        totalEventsThisMonth: 12450,
        totalBytesThisMonth: 8940000,
        percentUsed: 1.25,
        isQuotaExceeded: false,
        projectBreakdown: [
          {
            projectId: '0194f1c0-0000-7000-8000-000000000001',
            projectName: 'Production Services',
            eventsThisMonth: 12450,
            bytesThisMonth: 8940000,
            dailyHistory: [],
          },
        ],
      });
    } finally {
      this.isLoadingInitial.set(false);
    }
  }

  public async selectOrganizationView(orgView: OrganizationView): Promise<void> {
    this.currentOrgView.set(orgView);
    this.editOrgName.set(orgView.organization.name);
    this.editOrgBillingEmail.set(orgView.organization.billingEmail);
    this.editOrgPlanTier.set(orgView.organization.planTier);
    const firstWs = orgView.workspaces[0] ?? null;
    this.currentWorkspace.set(firstWs);
    this.editWorkspaceName.set(firstWs?.name ?? '');

    try {
      const [members, invites, projects, auditLogs] = await Promise.all([
        this.api.listOrgMembers(orgView.organization.id),
        this.api.listInvitations(orgView.organization.id),
        this.api.listProjects(orgView.organization.id, firstWs?.id),
        this.api.listAuditLogs(orgView.organization.id, undefined, 60),
      ]);
      this.orgMembers.set(members);
      this.orgInvitations.set(invites);
      this.orgAuditLogs.set(auditLogs);
      this.auditError.set('');
      this.projects.set(projects);
      if (projects.length > 0) {
        await this.selectProject(projects[0]);
      } else {
        const allOrgProjects = await this.api.listProjects(orgView.organization.id);
        this.projects.set(allOrgProjects);
        if (allOrgProjects.length > 0) {
          await this.selectProject(allOrgProjects[0]);
        }
      }
      await this.loadOrganizationUsage(orgView.organization.id);
    } catch {
      // Offline mode keeps current in-memory state
    }
  }

  public async selectOrganizationById(orgId: string): Promise<void> {
    const found = this.organizations().find((o) => o.organization.id === orgId);
    if (found) {
      await this.selectOrganizationView(found);
    }
  }

  public async selectWorkspaceById(wsId: string): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    const ws = orgView.workspaces.find((w) => w.id === wsId) ?? null;
    this.currentWorkspace.set(ws);
    this.editWorkspaceName.set(ws?.name ?? '');
    try {
      const list = await this.api.listProjects(orgView.organization.id, ws?.id);
      this.projects.set(list);
      if (list.length > 0) {
        await this.selectProject(list[0]);
      }
    } catch {
      // Offline fallback
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
      await this.loadProjectConnectors(project.id);
    } catch {
      // Keep current graph if project endpoints fail
    }

    await this.connectWebSocket(project.id);
  }

  private async connectWebSocket(projectId: string): Promise<void> {
    this.closeWebSocket();
    if (typeof window === 'undefined') return;

    try {
      const ticket = await this.api.issueWsTicket(projectId);
      const url = this.api.getWsUrl(projectId, ticket);
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.wsConnected.set(true);
        this.apiErrorBanner.set('');
        this.reconnectAttempt = 0;
      };

      socket.onmessage = (msgEvent) => {
        try {
          const payload = JSON.parse(msgEvent.data) as UiStreamEvent;
          this.handleStreamEvent(payload);
        } catch {
          // Ignore malformed WS frame
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

    if (this.wizardWaitingForEvent() && (ev.t === 'spawn' || ev.t === 'hop')) {
      this.onFirstEventDetected();
    }

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
      case 'carry': {
        this.engine.enqueueCarry(ev, now);
        break;
      }
      case 'complete': {
        this.engine.enqueueComplete(ev, now);
        this.incrementNodeTotal(ev.node);
        this.ordersCompletedCount.update((c) => c + 1);
        if (ev.carry?.total) {
          this.revenueToday.update((r) => Math.round((r + ev.carry!.total) * 100) / 100);
          if (ev.carry.currency) {
            this.revenueCurrency.set(ev.carry.currency);
          }
        }
        this.showRevenuePulse.set(true);
        setTimeout(() => this.showRevenuePulse.set(false), 800);
        break;
      }
      case 'fail': {
        this.engine.enqueueFail(ev, now);
        this.incrementNodeTotal(ev.node);
        this.failedCount.update((c) => c + 1);
        break;
      }
      case 'abandon': {
        this.engine.enqueueAbandon(ev, now);
        this.incrementNodeTotal(ev.node);
        this.abandonedCount.update((c) => c + 1);
        break;
      }
      case 'crowd': {
        this.engine.onCrowd(ev);
        break;
      }
      case 'diagram_patch': {
        const updated = structuredClone(this.graph());
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

  // Runs synthetic hops locally when backend WebSocket is offline so visual transitions can always be previewed.
  private startLocalDemoFallbackLoop(): void {
    this.localDemoTimer = setInterval(() => {
      if (this.wsConnected() || !this.demoRunning() || this.livePaused() || this.replayActive()) {
        return;
      }
      this.emitSyntheticTrace('auto');
    }, 950);
  }

  public triggerTestBurst(): void {
    if (this.livePaused()) {
      this.togglePause();
    }
    this.emitSyntheticTrace('ok-primary');
    setTimeout(() => this.emitSyntheticTrace('ok-secondary'), 140);
    setTimeout(() => this.emitSyntheticTrace('error-hop'), 280);
    setTimeout(() => this.emitSyntheticTrace('unmapped-hop'), 420);
  }

  private emitSyntheticTrace(
    variant: 'auto' | 'ok-primary' | 'ok-secondary' | 'error-hop' | 'unmapped-hop'
  ): void {
    const g = this.graph();
    if (g.nodes.length === 0) return;

    const seqNum = ++this.syntheticCounter;
    const hexSuffix = seqNum.toString(16).padStart(4, '0');
    const traceId = `0194f1c0-0000-7000-8000-00000000${hexSuffix}`;
    const now = performance.now();

    if (this.isCommerceDiagram() && variant === 'auto') {
      this.emitSyntheticCommerceTrace(seqNum, now);
      return;
    }

    const sourceNode =
      g.nodes.find((n) => n.type === 'source') ?? g.nodes[0];
    this.engine.enqueueSpawn(
      {
        t: 'spawn',
        traceId,
        branch: 'main',
        node: sourceNode.key,
        status: 'ok',
        label: 'INGRESS',
        ts: now,
      },
      now
    );
    this.incrementNodeTotal(sourceNode.key);

    if (variant === 'unmapped-hop' && g.nodes.length >= 2) {
      const target = g.nodes[g.nodes.length - 1];
      if (target.key !== sourceNode.key) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: sourceNode.key,
            to: target.key,
            edgeId: null,
            unmapped: true,
            status: 'ok',
            label: 'BYPASS',
            ts: now + 50,
          },
          now + 50
        );
        this.incrementNodeTotal(target.key);
        this.engine.enqueueEnd({ t: 'end', traceId, branch: 'main', node: target.key, ts: now + 100 }, now + 100);
        return;
      }
    }

    // Walk outgoing edges from sourceNode
    let curr = sourceNode.key;
    const visited = new Set<string>([curr]);
    let hopCount = 0;

    while (hopCount < 5) {
      const outgoing = g.edges.filter((e) => e.from === curr && !visited.has(e.to));
      if (outgoing.length === 0) break;

      let chosen = outgoing[0];
      if (outgoing.length > 1) {
        if (variant === 'ok-primary') {
          chosen = outgoing[0];
        } else if (variant === 'ok-secondary') {
          chosen = outgoing[1];
        } else {
          chosen = outgoing[seqNum % outgoing.length];
        }
      }

      const isFinalStep =
        g.edges.filter((e) => e.from === chosen.to && !visited.has(e.to)).length === 0;
      const shouldFail =
        variant === 'error-hop' ? isFinalStep : variant === 'auto' && seqNum % 9 === 0 && isFinalStep;

      this.engine.enqueueHop(
        {
          t: 'hop',
          traceId,
          branch: 'main',
          from: curr,
          to: chosen.to,
          edgeId: chosen.id,
          unmapped: false,
          status: shouldFail ? 'error' : 'ok',
          label: shouldFail ? 'ERR 504' : chosen.label || `STEP ${hopCount + 1}`,
          ts: now + (hopCount + 1) * 40,
        },
        now + (hopCount + 1) * 40
      );
      this.incrementNodeTotal(chosen.to);
      this.edgeHeat.update((prev) => ({
        ...prev,
        [chosen.id]: Math.min(12, (prev[chosen.id] ?? 0) + 1),
      }));

      curr = chosen.to;
      visited.add(curr);
      hopCount++;
    }

    this.engine.enqueueEnd({ t: 'end', traceId, branch: 'main', node: curr, ts: now + 300 }, now + 300);
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

  // Visual style switchers
  public setHopStyle(style: HopVisualStyle): void {
    this.hopStyle.set(style);
  }

  public setNodeVisualStyle(style: NodeVisualStyle): void {
    this.nodeVisualStyle.set(style);
    this.engine.cardWidth = style === 'blueprint' ? BLUEPRINT_CARD_WIDTH : NODE_CARD_WIDTH;
    this.engine.cardHeight = style === 'blueprint' ? BLUEPRINT_CARD_HEIGHT : NODE_CARD_HEIGHT;
  }

  public setEditorDesignMode(mode: EditorDesignMode): void {
    this.editorDesignMode.set(mode);
    if (!this.editorMode()) {
      this.editorMode.set(true);
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
    const current = this.theme();
    const next = current === 'dark' ? 'cozy-light' : current === 'cozy-light' ? 'light' : 'dark';
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
    const nextState = !this.demoRunning();
    this.demoRunning.set(nextState);
    const proj = this.currentProject();
    if (!proj) return;
    try {
      if (!nextState) {
        await this.api.stopDemo(proj.id);
      } else {
        await this.api.startDemo(proj.id, this.demoRate(), 0.04);
      }
    } catch {
      // Fallback local demo loop handles offline mode automatically
    }
  }

  // TV / Kiosk Mode (Gate G1-S / E22-01)
  public async toggleTvMode(): Promise<void> {
    const next = !this.tvMode();
    this.tvMode.set(next);

    if (next) {
      this.hasToggledTvMode.set(true);
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Fullscreen may require explicit user gesture
        }
      }
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch {
          // WakeLock is optional
        }
      }
    } else {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      if (this.wakeLock) {
        try {
          await this.wakeLock.release();
        } catch {}
        this.wakeLock = null;
      }
    }
  }

  // Template Management (E18-01 & Gate G1-S)
  public onSelectTemplate(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.applySelectedTemplate(select.value);
      select.value = '';
    }
  }

  public async applySelectedTemplate(templateId: string): Promise<void> {
    const curProject = this.currentProject();
    if (curProject) {
      try {
        await this.api.applyTemplate(curProject.id, templateId);
      } catch (e) {
        console.warn('API applyTemplate unavailable, falling back to local diagram:', e);
      }
    }

    if (templateId === 'online-shop') {
      this.setDiagramGraph(this.getOnlineShopFallbackDiagram(), true);
      this.theme.set('cozy-light');
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', 'cozy-light');
      }
    } else if (templateId === 'queue-worker') {
      this.setDiagramGraph(this.getQueueWorkerFallbackDiagram(), true);
      this.theme.set('dark');
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } else if (templateId === 'ai-rag') {
      this.setDiagramGraph(this.getAiRagFallbackDiagram(), true);
      this.theme.set('dark');
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } else {
      this.setDiagramGraph(this.getMicroservicesFallbackDiagram(), true);
      this.theme.set('dark');
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }

    this.ordersCompletedCount.set(0);
    this.revenueToday.set(0);
    this.abandonedCount.set(0);
    this.failedCount.set(0);
    this.fitToScreen();
  }

  public isCommerceDiagram(): boolean {
    const keys = new Set(this.graph().nodes.map((n) => n.key));
    return keys.has('cart') || (keys.has('paid') && keys.has('visit'));
  }

  private emitSyntheticCommerceTrace(seqNum: number, now: number): void {
    const g = this.graph();
    const nodeKeys = new Set(g.nodes.map((n) => n.key));
    if (!nodeKeys.has('visit')) {
      return;
    }

    const hexSuffix = seqNum.toString(16).padStart(4, '0');
    const traceId = `0194f1c0-0000-7000-8000-00000000${hexSuffix}`;

    const avatars = ['cat', 'fox', 'bear', 'dog', 'rabbit'];
    const names = ['Alice', 'Marc', 'Elena', 'Lucas', 'Sofia', 'Julian', 'Clara'];
    const avatar = avatars[seqNum % avatars.length];
    const name = names[seqNum % names.length];

    const entity: EntityInfo = {
      kind: 'customer',
      ref: `cust_${seqNum % 100}`,
      label: name,
      avatar,
    };

    const catalog = [
      { sku: 'candle', label: 'Lavender Candle', price: 14.5, icon: '🕯️' },
      { sku: 'coffee', label: 'Artisan Coffee', price: 18.0, icon: '☕' },
      { sku: 'shirt', label: 'Cotton T-Shirt', price: 29.0, icon: '👕' },
      { sku: 'headphones', label: 'Nordic Headphones', price: 89.0, icon: '🎧' },
      { sku: 'journal', label: 'Crafted Journal', price: 22.0, icon: '📚' },
    ];
    const item = catalog[seqNum % catalog.length];
    const persona = seqNum % 4; // 0,1: Buyer, 2: Abandoner, 3: Hesitant/Failed

    // 1. Storefront Visit
    this.engine.enqueueSpawn(
      {
        t: 'spawn',
        traceId,
        branch: 'main',
        node: 'visit',
        status: 'ok',
        label: 'VISIT',
        entity,
        ts: now,
      },
      now
    );
    this.incrementNodeTotal('visit');

    // 2. Browse Catalog
    if (nodeKeys.has('browse')) {
      this.engine.enqueueHop(
        {
          t: 'hop',
          traceId,
          branch: 'main',
          from: 'visit',
          to: 'browse',
          edgeId: 'e_shop_1',
          unmapped: false,
          status: 'ok',
          label: 'browse',
          entity,
          ts: now + 50,
        },
        now + 50
      );
      this.incrementNodeTotal('browse');
    }

    // 3. Product Detail
    if (nodeKeys.has('product')) {
      this.engine.enqueueHop(
        {
          t: 'hop',
          traceId,
          branch: 'main',
          from: 'browse',
          to: 'product',
          edgeId: 'e_shop_2',
          unmapped: false,
          status: 'ok',
          label: item.label,
          entity,
          ts: now + 100,
        },
        now + 100
      );
      this.incrementNodeTotal('product');
    }

    const carrySummary: CarrySummary = {
      count: 1,
      total: item.price,
      currency: 'EUR',
      topIcons: [item.icon],
    };

    if (persona === 0 || persona === 1) {
      // Persona: BUYER
      if (nodeKeys.has('cart')) {
        this.engine.enqueueCarry(
          {
            t: 'carry',
            traceId,
            branch: 'main',
            node: 'cart',
            op: 'add',
            carry: carrySummary,
            ts: now + 140,
          },
          now + 140
        );
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'product',
            to: 'cart',
            edgeId: 'e_shop_4',
            unmapped: false,
            status: 'ok',
            label: `+${item.icon}`,
            entity,
            carry: carrySummary,
            ts: now + 150,
          },
          now + 150
        );
        this.incrementNodeTotal('cart');
      }

      if (nodeKeys.has('checkout')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'cart',
            to: 'checkout',
            edgeId: 'e_shop_6',
            unmapped: false,
            status: 'ok',
            label: 'checkout',
            entity,
            carry: carrySummary,
            ts: now + 200,
          },
          now + 200
        );
        this.incrementNodeTotal('checkout');
      }

      if (nodeKeys.has('payment')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'checkout',
            to: 'payment',
            edgeId: 'e_shop_8',
            unmapped: false,
            status: 'ok',
            label: 'pay',
            entity,
            carry: carrySummary,
            ts: now + 250,
          },
          now + 250
        );
        this.incrementNodeTotal('payment');
      }

      if (nodeKeys.has('paid')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'payment',
            to: 'paid',
            edgeId: 'e_shop_10',
            unmapped: false,
            status: 'ok',
            label: 'paid',
            entity,
            carry: carrySummary,
            ts: now + 300,
          },
          now + 300
        );
        this.incrementNodeTotal('paid');
        this.engine.enqueueComplete(
          {
            t: 'complete',
            traceId,
            branch: 'main',
            node: 'paid',
            entity,
            carry: carrySummary,
            ts: now + 350,
          },
          now + 350
        );
        this.ordersCompletedCount.update((c) => c + 1);
        this.revenueToday.update((r) => Math.round((r + item.price) * 100) / 100);
        this.showRevenuePulse.set(true);
        setTimeout(() => this.showRevenuePulse.set(false), 800);
      }
    } else if (persona === 2) {
      // Persona: ABANDONER
      if (nodeKeys.has('cart')) {
        this.engine.enqueueCarry(
          {
            t: 'carry',
            traceId,
            branch: 'main',
            node: 'cart',
            op: 'add',
            carry: carrySummary,
            ts: now + 140,
          },
          now + 140
        );
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'product',
            to: 'cart',
            edgeId: 'e_shop_4',
            unmapped: false,
            status: 'ok',
            label: `+${item.icon}`,
            entity,
            carry: carrySummary,
            ts: now + 150,
          },
          now + 150
        );
        this.incrementNodeTotal('cart');
      }

      if (nodeKeys.has('abandoned')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'cart',
            to: 'abandoned',
            edgeId: 'e_shop_7',
            unmapped: false,
            status: 'warn',
            label: 'abandon',
            entity,
            carry: carrySummary,
            ts: now + 200,
          },
          now + 200
        );
        this.incrementNodeTotal('abandoned');
        this.engine.enqueueAbandon(
          {
            t: 'abandon',
            traceId,
            branch: 'main',
            node: 'abandoned',
            entity,
            carry: carrySummary,
            ts: now + 250,
          },
          now + 250
        );
        this.abandonedCount.update((c) => c + 1);
      }
    } else {
      // Persona: HESITANT (PAYMENT FAILED)
      if (nodeKeys.has('cart')) {
        this.engine.enqueueCarry(
          {
            t: 'carry',
            traceId,
            branch: 'main',
            node: 'cart',
            op: 'add',
            carry: carrySummary,
            ts: now + 140,
          },
          now + 140
        );
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'product',
            to: 'cart',
            edgeId: 'e_shop_4',
            unmapped: false,
            status: 'ok',
            label: `+${item.icon}`,
            entity,
            carry: carrySummary,
            ts: now + 150,
          },
          now + 150
        );
        this.incrementNodeTotal('cart');
      }

      if (nodeKeys.has('checkout')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'cart',
            to: 'checkout',
            edgeId: 'e_shop_6',
            unmapped: false,
            status: 'ok',
            label: 'checkout',
            entity,
            carry: carrySummary,
            ts: now + 200,
          },
          now + 200
        );
        this.incrementNodeTotal('checkout');
      }

      if (nodeKeys.has('payment')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'checkout',
            to: 'payment',
            edgeId: 'e_shop_8',
            unmapped: false,
            status: 'ok',
            label: 'pay',
            entity,
            carry: carrySummary,
            ts: now + 250,
          },
          now + 250
        );
        this.incrementNodeTotal('payment');
      }

      if (nodeKeys.has('payment-failed')) {
        this.engine.enqueueHop(
          {
            t: 'hop',
            traceId,
            branch: 'main',
            from: 'payment',
            to: 'payment-failed',
            edgeId: 'e_shop_11',
            unmapped: false,
            status: 'error',
            label: 'declined',
            entity,
            carry: carrySummary,
            ts: now + 300,
          },
          now + 300
        );
        this.incrementNodeTotal('payment-failed');
        this.engine.enqueueFail(
          {
            t: 'fail',
            traceId,
            branch: 'main',
            node: 'payment-failed',
            entity,
            reason: 'Card declined',
            ts: now + 350,
          },
          now + 350
        );
        this.failedCount.update((c) => c + 1);
      }
    }
  }

  public getOnlineShopFallbackDiagram(): DiagramGraph {
    return {
      schema: 1,
      direction: 'LR',
      nodes: [
        { key: 'visit', label: 'Storefront', type: 'source', x: -340, y: 0, icon: 'globe' },
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
        { id: 'e_shop_5', from: 'product', to: 'browse', label: 'more' },
        { id: 'e_shop_6', from: 'cart', to: 'checkout', label: 'proceed' },
        { id: 'e_shop_7', from: 'cart', to: 'abandoned', label: 'abandon' },
        { id: 'e_shop_8', from: 'checkout', to: 'payment', label: 'pay' },
        { id: 'e_shop_9', from: 'checkout', to: 'abandoned', label: 'abandon' },
        { id: 'e_shop_10', from: 'payment', to: 'paid', label: 'success' },
        { id: 'e_shop_11', from: 'payment', to: 'payment-failed', label: 'declined' },
      ],
    };
  }

  public getMicroservicesFallbackDiagram(): DiagramGraph {
    return {
      schema: 1,
      direction: 'TB',
      nodes: [
        { key: 'website', label: 'Website', type: 'source', x: 0, y: 0, icon: 'globe' },
        { key: 'lb', label: 'Load Balancer', type: 'service', x: 0, y: 150, icon: 'cpu' },
        { key: 'if-premium', label: 'Premium?', type: 'decision', x: 0, y: 300, icon: 'git-branch' },
        { key: 'service-a', label: 'Service A', type: 'service', x: -220, y: 450, icon: 'cpu' },
        { key: 'service-b', label: 'Service B', type: 'service', x: 220, y: 450, icon: 'cpu' },
        { key: 'db', label: 'Database', type: 'datastore', x: 0, y: 600, icon: 'database' },
      ],
      edges: [
        { id: 'e1', from: 'website', to: 'lb' },
        { id: 'e2', from: 'lb', to: 'if-premium' },
        { id: 'e3', from: 'if-premium', to: 'service-a', label: 'route=A' },
        { id: 'e4', from: 'if-premium', to: 'service-b', label: 'route=B' },
        { id: 'e5', from: 'service-a', to: 'db' },
        { id: 'e6', from: 'service-b', to: 'db' },
      ],
    };
  }

  public getQueueWorkerFallbackDiagram(): DiagramGraph {
    return {
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
    };
  }

  public getAiRagFallbackDiagram(): DiagramGraph {
    return {
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
    };
  }

  public getBuiltInTemplates(): TemplateDefinition[] {
    return [
      {
        id: 'online-shop',
        name: 'Online Shop (B2C Live Commerce)',
        category: 'commerce',
        description: 'Storefront funnel: Visit -> Browse -> Product -> Cart -> Checkout -> Payment -> Paid / Abandoned',
        theme: 'cozy-light',
        diagram: this.getOnlineShopFallbackDiagram(),
        defaultPersonas: ['browser', 'buyer', 'hesitant', 'abandoner'],
        terminalNodes: ['paid', 'payment-failed', 'abandoned'],
      },
      {
        id: 'microservices',
        name: 'Cloud & Microservices (Technical)',
        category: 'engineering',
        description: 'Technical architecture: Website -> Load Balancer -> Decision -> Services -> DB',
        theme: 'dark-neon',
        diagram: this.getMicroservicesFallbackDiagram(),
        defaultPersonas: ['standard-request', 'pro-request', 'batch-job'],
        terminalNodes: ['db'],
      },
      {
        id: 'queue-worker',
        name: 'Async Queue & Event Bus',
        category: 'backend',
        description: 'Asynchronous pipeline: Webhooks -> Ingest API -> Kafka Queue -> Worker Pool -> Postgres / DLQ',
        theme: 'dark-neon',
        diagram: this.getQueueWorkerFallbackDiagram(),
        defaultPersonas: ['webhook-event', 'batch-task', 'retry-task'],
        terminalNodes: ['db', 'dlq'],
      },
      {
        id: 'ai-rag',
        name: 'AI Agent & RAG Pipeline',
        category: 'ai',
        description: 'LLM pipeline: User Prompt -> Embedding -> Vector Search -> LLM Orchestrator -> Tools -> Response',
        theme: 'dark-neon',
        diagram: this.getAiRagFallbackDiagram(),
        defaultPersonas: ['search-prompt', 'agent-task', 'tool-call'],
        terminalNodes: ['response'],
      },
    ];
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
    this.selectNode(node);

    if (this.editorMode()) {
      this.pushUndoSnapshot();
      this.draggingNodeKey = node.key;
      const pos = this.pointerCanvasPos();
      this.dragOffsetX = pos.x - node.x;
      this.dragOffsetY = pos.y - node.y;
    }
  }

  public onNodeKeyDown(event: KeyboardEvent, node: DiagramNode): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectNode(node);
    }
  }

  private selectNode(node: DiagramNode): void {
    this.selectedNodeKey.set(node.key);
    this.selectedEdgeId.set(null);
    this.studioConnectFrom.set(node.key);
    this.refreshInspectorTraces(node.key);
  }

  public onQuickBranchFromNode(event: MouseEvent, parentNode: DiagramNode): void {
    event.stopPropagation();
    this.editorMode.set(true);
    this.editorDesignMode.set('blueprint-studio');
    this.studioTab.set('composer');
    this.studioConnectFrom.set(parentNode.key);
    this.selectedNodeKey.set(parentNode.key);
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

  // Editor Operations: Classic Palette (Preserved) + New Blueprint Studio Composer
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

  public createNodeFromStudio(): void {
    const label = this.studioNodeLabel().trim() || 'New Service';
    const type = this.studioNodeType();
    const updated = structuredClone(this.graph());
    const desiredKey = this.computedStudioKey();
    const finalKey = updated.nodes.some((n) => n.key === desiredKey)
      ? this.slugifyKey(desiredKey, updated.nodes)
      : desiredKey;

    const fromKey = this.studioConnectFrom();
    const toKey = this.studioConnectTo();
    const edgeLabel = this.studioEdgeLabel().trim() || null;
    const fromNode = updated.nodes.find((n) => n.key === fromKey);
    const toNode = updated.nodes.find((n) => n.key === toKey);

    let spawnX = 0;
    let spawnY = updated.nodes.reduce((m, n) => Math.max(m, n.y), 0) + 160;
    if (fromNode && toNode) {
      spawnX = Math.round((fromNode.x + toNode.x) / 20) * 10;
      spawnY = Math.round((fromNode.y + toNode.y) / 20) * 10;
    } else if (fromNode) {
      const siblingCount = updated.edges.filter((e) => e.from === fromNode.key).length;
      spawnX = fromNode.x + (siblingCount % 2 === 0 ? siblingCount * 110 : -siblingCount * 110);
      spawnY = fromNode.y + 160;
    } else if (toNode) {
      spawnX = toNode.x;
      spawnY = Math.max(0, toNode.y - 160);
    } else if (updated.nodes.length === 0) {
      spawnY = 0;
    }

    const paletteMeta = this.paletteTypes.find((p) => p.type === type);
    this.pushUndoSnapshot();
    updated.nodes.push({
      key: finalKey,
      label,
      type,
      x: spawnX,
      y: spawnY,
      icon: paletteMeta?.icon ?? 'cpu',
      discovered: false,
    });

    if (fromNode && fromNode.key !== finalKey) {
      updated.edges.push({
        id: `e_${Date.now()}_in`,
        from: fromNode.key,
        to: finalKey,
        label: edgeLabel,
        discovered: false,
      });
    }
    if (toNode && toNode.key !== finalKey) {
      updated.edges.push({
        id: `e_${Date.now()}_out`,
        from: finalKey,
        to: toNode.key,
        discovered: false,
      });
    }

    this.setDiagramGraph(updated, true);
    this.selectedNodeKey.set(finalKey);
    this.studioNodeKeyCustom.set('');
    this.studioEdgeLabel.set('');
    this.copiedHint.set(`Created node "${label}" (${finalKey})`);
    setTimeout(() => this.copiedHint.set(''), 2200);
  }

  public insertBlueprintBlock(tpl: BlueprintTemplate): void {
    this.pushUndoSnapshot();
    const updated = structuredClone(this.graph());
    const anchorKey = this.selectedNodeKey() || this.studioConnectFrom();
    const anchorNode = updated.nodes.find((n) => n.key === anchorKey);

    const baseX = anchorNode ? anchorNode.x : 0;
    const baseY = anchorNode
      ? anchorNode.y + 160
      : updated.nodes.length === 0
        ? 0
        : updated.nodes.reduce((m, n) => Math.max(m, n.y), 0) + 170;

    const createdKeys: string[] = [];
    for (const item of tpl.nodes) {
      const key = this.slugifyKey(item.suffix, updated.nodes);
      updated.nodes.push({
        key,
        label: item.label,
        type: item.type,
        x: baseX + item.dx,
        y: baseY + item.dy,
        icon: item.icon,
        discovered: false,
      });
      createdKeys.push(key);
    }

    if (anchorNode && createdKeys.length > 0) {
      updated.edges.push({
        id: `e_${Date.now()}_anchor`,
        from: anchorNode.key,
        to: createdKeys[0],
        discovered: false,
      });
    }

    tpl.edges.forEach((edgeDef, idx) => {
      const from = createdKeys[edgeDef.fromIdx];
      const to = createdKeys[edgeDef.toIdx];
      if (from && to) {
        updated.edges.push({
          id: `e_${Date.now()}_bp_${idx}`,
          from,
          to,
          label: edgeDef.label ?? null,
          discovered: false,
        });
      }
    });

    this.setDiagramGraph(updated, true);
    if (createdKeys.length > 0) {
      this.selectedNodeKey.set(createdKeys[0]);
    }
    this.copiedHint.set(`Inserted blueprint: ${tpl.name}`);
    setTimeout(() => this.copiedHint.set(''), 2200);
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

  public updateSelectedNodeType(newType: NodeType): void {
    const key = this.selectedNodeKey();
    if (!key) return;
    const updated = structuredClone(this.graph());
    const node = updated.nodes.find((n) => n.key === key);
    if (!node) return;
    this.pushUndoSnapshot();
    node.type = newType;
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
      const totalWidth = (nodes.length - 1) * 250;
      nodes.forEach((n, idx) => {
        n.x = -totalWidth / 2 + idx * 250;
        n.y = layer * 165;
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
    if (!proj) {
      this.saveStatus.set('saved');
      return;
    }
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
      // Ignore when offline
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
      // Ignore when offline
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

  // Projects, Organizations, Workspaces & RBAC (M3 + Epic 1)
  public async createNewProject(): Promise<void> {
    const name = this.newProjectName().trim() || `Service Flow ${this.projects().length + 1}`;
    const orgId = this.currentOrgView()?.organization.id;
    const wsId = this.currentWorkspace()?.id;
    try {
      const created = await this.api.createProject(name, true, 7, orgId, wsId);
      this.newProjectName.set('');
      const list = await this.api.listProjects(orgId, wsId);
      this.projects.set(list);
      await this.selectProject(created);
      this.activeScreen.set('live');
    } catch {
      this.copiedHint.set('Backend offline: cannot persist new project right now.');
      setTimeout(() => this.copiedHint.set(''), 2500);
    }
  }

  public async createNewOrganization(): Promise<void> {
    const name = this.newOrgName().trim();
    if (!name) return;
    const billing = this.newOrgBillingEmail().trim() || this.loginEmail();
    try {
      const created = await this.api.createOrganization(name, undefined, billing);
      this.newOrgName.set('');
      this.newOrgBillingEmail.set('');
      const all = await this.api.listOrganizations();
      this.organizations.set(all);
      await this.selectOrganizationView(created);
      this.copiedHint.set(`Created organization "${created.organization.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2200);
    } catch {
      const nowIso = new Date().toISOString();
      const orgId = `0194f1c0-0000-7000-8000-${Date.now().toString().slice(-12)}`;
      const wsId = `0194f1c0-0000-7000-8000-${(Date.now() + 1).toString().slice(-12)}`;
      const localCreated: OrganizationView = {
        organization: {
          id: orgId,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          billingEmail: billing,
          planTier: 'FREE',
          createdAt: nowIso,
        },
        myRole: 'OWNER',
        permissions: this.currentOrgView()?.permissions ?? ['ORG_VIEW', 'ORG_MANAGE', 'MEMBER_MANAGE'],
        workspaces: [{ id: wsId, organizationId: orgId, name: 'Production', slug: 'production', createdAt: nowIso }],
      };
      this.organizations.update((list) => [...list, localCreated]);
      this.currentOrgView.set(localCreated);
      this.currentWorkspace.set(localCreated.workspaces[0]);
      this.newOrgName.set('');
      this.copiedHint.set(`Created local organization "${name}"`);
      setTimeout(() => this.copiedHint.set(''), 2200);
    }
  }

  public async saveOrganizationSettings(): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    const name = this.editOrgName().trim() || orgView.organization.name;
    const billingEmail = this.editOrgBillingEmail().trim() || orgView.organization.billingEmail;
    const planTier = this.editOrgPlanTier();
    try {
      const updated = await this.api.updateOrganization(orgView.organization.id, {
        name,
        billingEmail,
        planTier,
      });
      this.currentOrgView.set(updated);
      const all = await this.api.listOrganizations();
      this.organizations.set(all);
      this.copiedHint.set('Organization settings saved');
      setTimeout(() => this.copiedHint.set(''), 2000);
    } catch {
      const updatedLocal: OrganizationView = {
        ...orgView,
        organization: { ...orgView.organization, name, billingEmail, planTier },
      };
      this.currentOrgView.set(updatedLocal);
      this.organizations.update((list) =>
        list.map((o) => (o.organization.id === updatedLocal.organization.id ? updatedLocal : o))
      );
      this.copiedHint.set('Updated organization settings locally');
      setTimeout(() => this.copiedHint.set(''), 2000);
    }
  }

  public async createNewWorkspace(): Promise<void> {
    const orgView = this.currentOrgView();
    const name = this.newWorkspaceName().trim();
    if (!orgView || !name) return;
    try {
      const ws = await this.api.createWorkspace(orgView.organization.id, name);
      this.newWorkspaceName.set('');
      const refreshed = await this.api.listOrganizations();
      this.organizations.set(refreshed);
      const updatedOrg = refreshed.find((o) => o.organization.id === orgView.organization.id);
      if (updatedOrg) {
        this.currentOrgView.set(updatedOrg);
      }
      this.currentWorkspace.set(ws);
      this.editWorkspaceName.set(ws.name);
      this.copiedHint.set(`Created workspace "${ws.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    } catch {
      const ws: Workspace = {
        id: `ws_${Date.now()}`,
        organizationId: orgView.organization.id,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        createdAt: new Date().toISOString(),
      };
      const updatedOrg: OrganizationView = {
        ...orgView,
        workspaces: [...orgView.workspaces, ws],
      };
      this.currentOrgView.set(updatedOrg);
      this.currentWorkspace.set(ws);
      this.editWorkspaceName.set(ws.name);
      this.newWorkspaceName.set('');
      this.copiedHint.set(`Created workspace "${ws.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    }
  }

  public async renameCurrentWorkspace(): Promise<void> {
    const orgView = this.currentOrgView();
    const ws = this.currentWorkspace();
    const newName = this.editWorkspaceName().trim();
    if (!orgView || !ws || !newName) return;
    try {
      const updatedWs = await this.api.updateWorkspace(orgView.organization.id, ws.id, newName);
      this.currentWorkspace.set(updatedWs);
      const refreshed = await this.api.listOrganizations();
      this.organizations.set(refreshed);
      const updatedOrg = refreshed.find((o) => o.organization.id === orgView.organization.id);
      if (updatedOrg) this.currentOrgView.set(updatedOrg);
      this.copiedHint.set(`Renamed workspace to "${updatedWs.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    } catch {
      const updatedWs: Workspace = { ...ws, name: newName };
      this.currentWorkspace.set(updatedWs);
      this.copiedHint.set(`Renamed workspace to "${newName}"`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    }
  }

  public async deleteCurrentWorkspace(): Promise<void> {
    const orgView = this.currentOrgView();
    const ws = this.currentWorkspace();
    if (!orgView || !ws || orgView.workspaces.length <= 1) return;
    try {
      await this.api.deleteWorkspace(orgView.organization.id, ws.id);
      const refreshed = await this.api.listOrganizations();
      this.organizations.set(refreshed);
      const updatedOrg = refreshed.find((o) => o.organization.id === orgView.organization.id);
      if (updatedOrg) {
        this.currentOrgView.set(updatedOrg);
        this.currentWorkspace.set(updatedOrg.workspaces[0] ?? null);
      }
      this.copiedHint.set(`Deleted workspace "${ws.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    } catch {
      const remaining = orgView.workspaces.filter((w) => w.id !== ws.id);
      this.currentOrgView.set({ ...orgView, workspaces: remaining });
      this.currentWorkspace.set(remaining[0] ?? null);
    }
  }

  public async inviteTeamMember(): Promise<void> {
    const orgView = this.currentOrgView();
    const email = this.inviteEmail().trim();
    const role = this.inviteRole();
    if (!orgView || !email) return;
    try {
      const inv = await this.api.createInvitation(orgView.organization.id, email, role);
      this.inviteEmail.set('');
      this.lastCreatedInviteToken.set(inv.token ?? '');
      const [list, logs] = await Promise.all([
        this.api.listInvitations(orgView.organization.id),
        this.api.listAuditLogs(orgView.organization.id, undefined, 60),
      ]);
      this.orgInvitations.set(list);
      this.orgAuditLogs.set(logs);
      this.copiedHint.set(`Sent ${role} invitation to ${email}`);
      setTimeout(() => this.copiedHint.set(''), 2400);
    } catch {
      const suffix = Date.now().toString(16).padStart(12, '0');
      const token = `ft_inv_${suffix}a9b8c7d6e5f401234567`;
      const tokenPrefix = token.slice(0, 14);
      const inv: Invitation = {
        id: `inv_${Date.now()}`,
        organizationId: orgView.organization.id,
        email,
        role,
        token: null,
        tokenPrefix,
        tokenHash: `sha256_${suffix}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.orgInvitations.update((prev) => [inv, ...prev]);
      this.lastCreatedInviteToken.set(token);
      this.inviteEmail.set('');
      this.recordLocalAudit('member.invited', 'invitation', inv.id, {
        email,
        role,
        tokenPrefix,
      });
      this.copiedHint.set(`Created ${role} invitation token for ${email}`);
      setTimeout(() => this.copiedHint.set(''), 2400);
    }
  }

  public async resendOrgInvitation(inv: Invitation): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    try {
      const refreshed = await this.api.resendInvitation(orgView.organization.id, inv.id);
      this.lastCreatedInviteToken.set(refreshed.token ?? '');
      const [list, logs] = await Promise.all([
        this.api.listInvitations(orgView.organization.id),
        this.api.listAuditLogs(orgView.organization.id, undefined, 60),
      ]);
      this.orgInvitations.set(list);
      this.orgAuditLogs.set(logs);
      this.copiedHint.set(`Rotated token and resent invitation to ${inv.email}`);
      setTimeout(() => this.copiedHint.set(''), 2500);
    } catch {
      const suffix = Date.now().toString(16).padStart(12, '0');
      const newToken = `ft_inv_${suffix}f1e2d3c4b5a698765432`;
      const newPrefix = newToken.slice(0, 14);
      const newExpires = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      this.orgInvitations.update((list) =>
        list.map((item) =>
          item.id === inv.id
            ? {
                ...item,
                token: null,
                tokenPrefix: newPrefix,
                tokenHash: `sha256_${suffix}`,
                expiresAt: newExpires,
              }
            : item
        )
      );
      this.lastCreatedInviteToken.set(newToken);
      this.recordLocalAudit('member.invitation_resent', 'invitation', inv.id, {
        email: inv.email,
        role: inv.role,
        tokenPrefix: newPrefix,
      });
      this.copiedHint.set(`Rotated token and resent invitation to ${inv.email}`);
      setTimeout(() => this.copiedHint.set(''), 2500);
    }
  }

  public async changeMemberRole(member: OrganizationMember, newRole: OrgRole): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    try {
      const updated = await this.api.updateMemberRole(orgView.organization.id, member.userId, newRole);
      this.orgMembers.set(updated);
      await this.refreshAuditLogs();
      this.copiedHint.set(`Updated ${member.email} role to ${newRole}`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    } catch {
      const prevRole = member.role;
      this.orgMembers.update((list) =>
        list.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m))
      );
      this.recordLocalAudit('member.role_updated', 'member', member.userId, {
        previousRole: prevRole,
        newRole,
      });
      this.copiedHint.set(`Updated ${member.email} role to ${newRole}`);
      setTimeout(() => this.copiedHint.set(''), 2000);
    }
  }

  public async removeTeamMember(member: OrganizationMember): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    try {
      await this.api.removeMember(orgView.organization.id, member.userId);
      const updated = await this.api.listOrgMembers(orgView.organization.id);
      this.orgMembers.set(updated);
      await this.refreshAuditLogs();
    } catch {
      this.orgMembers.update((list) => list.filter((m) => m.userId !== member.userId));
      this.recordLocalAudit('member.removed', 'member', member.userId, {
        removedRole: member.role,
      });
    }
  }

  public async revokeOrgInvitation(invitationId: string): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    const existing = this.orgInvitations().find((i) => i.id === invitationId);
    try {
      await this.api.revokeInvitation(orgView.organization.id, invitationId);
      const list = await this.api.listInvitations(orgView.organization.id);
      this.orgInvitations.set(list);
      await this.refreshAuditLogs();
    } catch {
      this.orgInvitations.update((list) => list.filter((i) => i.id !== invitationId));
      this.recordLocalAudit('member.invitation_revoked', 'invitation', invitationId, {
        email: existing?.email ?? 'unknown',
        role: existing?.role ?? 'MEMBER',
      });
    }
  }

  public async acceptInvitationByToken(): Promise<void> {
    const token = this.acceptInviteTokenInput().trim();
    if (!token) return;
    try {
      const joined = await this.api.acceptInvitation(token);
      this.acceptInviteTokenInput.set('');
      const all = await this.api.listOrganizations();
      this.organizations.set(all);
      await this.selectOrganizationView(joined);
      this.copiedHint.set(`Joined organization "${joined.organization.name}" as ${joined.myRole}`);
      setTimeout(() => this.copiedHint.set(''), 2500);
    } catch {
      this.copiedHint.set('Could not accept token (verify token or backend connection).');
      setTimeout(() => this.copiedHint.set(''), 2500);
    }
  }

  public async transferOrgOwnership(): Promise<void> {
    const orgView = this.currentOrgView();
    const targetId = this.transferTargetUserId();
    if (!orgView || !targetId) return;
    try {
      const updated = await this.api.transferOwnership(orgView.organization.id, targetId);
      this.currentOrgView.set(updated);
      const members = await this.api.listOrgMembers(orgView.organization.id);
      this.orgMembers.set(members);
      await this.refreshAuditLogs();
      this.copiedHint.set('Transferred organization ownership');
      setTimeout(() => this.copiedHint.set(''), 2200);
    } catch {
      this.copiedHint.set('Ownership transfer requires an active backend session.');
      setTimeout(() => this.copiedHint.set(''), 2200);
    }
  }

  public async softDeleteCurrentOrganization(): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    const deletedAt = new Date().toISOString();
    try {
      await this.api.deleteOrganization(orgView.organization.id);
      this.softDeletedOrgInfo.set({
        id: orgView.organization.id,
        name: orgView.organization.name,
        deletedAt,
      });
      const all = await this.api.listOrganizations();
      this.organizations.set(all);
      if (all.length > 0) {
        await this.selectOrganizationView(all[0]);
      }
      this.copiedHint.set(
        `Scheduled "${orgView.organization.name}" for deletion (30-day recovery window)`
      );
      setTimeout(() => this.copiedHint.set(''), 3000);
    } catch {
      this.softDeletedOrgInfo.set({
        id: orgView.organization.id,
        name: orgView.organization.name,
        deletedAt,
      });
      this.recordLocalAudit('org.soft_deleted', 'organization', orgView.organization.id, {
        name: orgView.organization.name,
        deletedAt,
        retentionDays: 30,
      });
      this.copiedHint.set(
        `Scheduled "${orgView.organization.name}" for deletion (30-day recovery window)`
      );
      setTimeout(() => this.copiedHint.set(''), 3000);
    }
  }

  public async restoreSoftDeletedOrganization(): Promise<void> {
    const info = this.softDeletedOrgInfo();
    if (!info) return;
    try {
      const restored = await this.api.restoreOrganization(info.id);
      this.softDeletedOrgInfo.set(null);
      const all = await this.api.listOrganizations();
      this.organizations.set(all);
      await this.selectOrganizationView(restored);
      this.copiedHint.set(`Restored organization "${restored.organization.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2500);
    } catch {
      this.softDeletedOrgInfo.set(null);
      this.recordLocalAudit('org.restored', 'organization', info.id, {
        name: info.name,
      });
      this.copiedHint.set(`Restored organization "${info.name}"`);
      setTimeout(() => this.copiedHint.set(''), 2500);
    }
  }

  public async refreshAuditLogs(): Promise<void> {
    const orgView = this.currentOrgView();
    if (!orgView) return;
    this.auditLoading.set(true);
    this.auditError.set('');
    try {
      const logs = await this.api.listAuditLogs(
        orgView.organization.id,
        this.auditActionFilter() || undefined,
        80
      );
      this.orgAuditLogs.set(logs);
    } catch {
      // Keep local audit log entries when backend is offline
    } finally {
      this.auditLoading.set(false);
    }
  }

  public formatAuditMeta(meta: Record<string, unknown> | undefined | null): string {
    if (!meta) return '';
    const entries = Object.entries(meta);
    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${k}=${String(v)}`).join(' · ');
  }

  private recordLocalAudit(
    action: string,
    targetType: string,
    targetId: string,
    meta: Record<string, unknown>
  ): void {
    const orgId = this.currentOrgView()?.organization.id ?? '0194f1c0-0000-7000-8000-000000000100';
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
      organizationId: orgId,
      actorUserId: '0194f1c0-0000-7000-8000-000000000010',
      actorEmail: this.loginEmail(),
      action,
      targetType,
      targetId,
      meta,
      createdAt: new Date().toISOString(),
    };
    this.orgAuditLogs.update((prev) => [entry, ...prev]);
  }

  public async loadOrganizationUsage(orgId?: string): Promise<void> {
    const targetOrgId = orgId || this.currentOrgView()?.organization.id;
    if (!targetOrgId) return;
    try {
      const usage = await this.api.getOrganizationUsage(targetOrgId);
      this.currentOrgUsage.set(usage);
    } catch {
      // Graceful offline fallback
      const tier = this.currentOrgView()?.organization.planTier || 'FREE';
      const quota =
        tier === 'ENTERPRISE' ? 10_000_000 : tier === 'BUSINESS' ? 1_000_000 : tier === 'PRO' ? 500_000 : 100_000;
      this.currentOrgUsage.set({
        organizationId: targetOrgId,
        planTier: tier,
        monthlyQuota: quota,
        totalEventsThisMonth: 0,
        totalBytesThisMonth: 0,
        percentUsed: 0,
        isQuotaExceeded: false,
        projectBreakdown: [],
      });
    }
  }

  public async generateApiKey(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      const res = await this.api.createKey(proj.id, this.newKeyName(), 1000, this.newKeyScopes());
      this.newlyCreatedKey.set(res.fullKey);
      const keys = await this.api.listKeys(proj.id);
      this.apiKeys.set(keys);
    } catch {
      this.copiedHint.set('Backend offline: using demo ingest key.');
      setTimeout(() => this.copiedHint.set(''), 2500);
    }
  }

  public async rotateApiKey(keyId: string, gracePeriodHours = 24): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      const res = await this.api.rotateKey(proj.id, keyId, gracePeriodHours);
      this.newlyCreatedKey.set(res.fullKey);
      this.copiedHint.set(`Key rotated! New key generated with ${gracePeriodHours}h grace period.`);
      setTimeout(() => this.copiedHint.set(''), 4000);
      const keys = await this.api.listKeys(proj.id);
      this.apiKeys.set(keys);
    } catch {
      this.copiedHint.set('Failed to rotate key (offline or unauthorized)');
      setTimeout(() => this.copiedHint.set(''), 3000);
    }
  }

  public async revokeKey(keyId: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    await this.api.revokeKey(proj.id, keyId);
    const keys = await this.api.listKeys(proj.id);
    this.apiKeys.set(keys);
  }

  // Onboarding Wizard & Activation Checklist Handlers (E5 / Gate G1)
  public openOnboardingWizard(templateId?: string): void {
    if (templateId) {
      this.wizardSelectedTemplate.set(templateId);
    }
    this.wizardStep.set(1);
    this.wizardWaitingForEvent.set(false);
    this.wizardEventDetected.set(false);
    this.wizardTimeToFirstEvent.set(null);
    this.showOnboardingWizard.set(true);
  }

  public closeOnboardingWizard(): void {
    this.showOnboardingWizard.set(false);
    this.wizardWaitingForEvent.set(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('flowtrace_wizard_dismissed', 'true');
    }
  }

  public async wizardNextToSnippets(): Promise<void> {
    const curProj = this.currentProject();
    if (curProj && this.wizardProjectName().trim() && this.wizardProjectName() !== curProj.name) {
      try {
        const updated = await this.api.updateProject(curProj.id, {
          name: this.wizardProjectName().trim(),
        });
        this.currentProject.set(updated);
      } catch {
        // Local fallback
      }
    }
    await this.applySelectedTemplate(this.wizardSelectedTemplate());
    if (this.apiKeys().length === 0) {
      await this.generateApiKey();
    }
    this.wizardStep.set(2);
  }

  public wizardNextToRadar(): void {
    this.wizardStep.set(3);
    this.wizardWaitingForEvent.set(true);
    this.wizardEventDetected.set(false);
    this.wizardStartTime.set(Date.now());
    this.wizardTimeToFirstEvent.set(null);
  }

  public onFirstEventDetected(): void {
    if (!this.wizardWaitingForEvent()) return;
    this.wizardWaitingForEvent.set(false);
    this.wizardEventDetected.set(true);
    const elapsedMs = Date.now() - (this.wizardStartTime() || Date.now());
    const seconds = Math.max(1, Math.round(elapsedMs / 1000));
    this.wizardTimeToFirstEvent.set(seconds);
    this.hasSentFirstEvent.set(true);
  }

  public async wizardSendTestPing(): Promise<void> {
    const proj = this.currentProject();
    this.wizardSimulatingPing.set(true);
    const firstNode = this.firstNodeKey();
    const key = this.newlyCreatedKey();
    const traceId = `0194f1c0-0000-7000-8000-${Date.now().toString(16).slice(-12)}`;

    try {
      if (proj) {
        await fetch(`${this.api.apiBaseUrl}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key,
          },
          body: JSON.stringify([
            {
              traceId,
              node: firstNode,
            },
          ]),
        });
      }
      this.onFirstEventDetected();
    } catch {
      // Offline fallback simulation
      this.engine.enqueueSpawn(
        {
          t: 'spawn',
          traceId,
          branch: 'main',
          node: firstNode,
          status: 'ok',
          ts: Date.now(),
        },
        performance.now()
      );
      this.incrementNodeTotal(firstNode);
      this.onFirstEventDetected();
    } finally {
      this.wizardSimulatingPing.set(false);
    }
  }

  public wizardFinish(): void {
    this.showOnboardingWizard.set(false);
    this.wizardWaitingForEvent.set(false);
    this.activeScreen.set('live');
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('flowtrace_wizard_dismissed', 'true');
    }
  }

  public getSnippetCode(lang: 'curl' | 'java' | 'node' | 'python' | 'go'): string {
    const key = this.newlyCreatedKey();
    const node = this.firstNodeKey();
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
    const endpoint = `${base}/api/v1/events`;

    switch (lang) {
      case 'curl':
        return `curl -X POST ${endpoint} \\\n  -H "X-API-Key: ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"${node}"}]'`;

      case 'java':
        return `FlowTrace client = FlowTrace.builder()\n    .endpoint("${base}")\n    .apiKey("${key}")\n    .build();\n\nclient.checkpoint("0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11", "${node}");`;

      case 'node':
        return `await fetch('${endpoint}', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': '${key}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify([{\n    traceId: '0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11',\n    node: '${node}'\n  }])\n});`;

      case 'python':
        return `import requests\n\nrequests.post(\n    "${endpoint}",\n    headers={"X-API-Key": "${key}"},\n    json=[{"traceId": "0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11", "node": "${node}"}]\n)`;

      case 'go':
        return `package main\n\nimport (\n    "bytes"\n    "net/http"\n)\n\nfunc main() {\n    payload := []byte(\`[{"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"${node}"}]\`)\n    req, _ := http.NewRequest("POST", "${endpoint}", bytes.NewBuffer(payload))\n    req.Header.Set("X-API-Key", "${key}")\n    req.Header.Set("Content-Type", "application/json")\n    http.DefaultClient.Do(req)\n}`;
    }
  }

  public handleChecklistAction(id: string): void {
    switch (id) {
      case 'template':
        this.openOnboardingWizard('microservices');
        break;
      case 'key':
        this.activeScreen.set('settings');
        break;
      case 'event':
        this.openOnboardingWizard(this.wizardSelectedTemplate());
        this.wizardStep.set(2);
        break;
      case 'invite':
        this.activeScreen.set('team');
        break;
      case 'kiosk':
        this.toggleTvMode();
        break;
    }
  }

  public toggleChecklist(): void {
    const next = !this.checklistCollapsed();
    this.checklistCollapsed.set(next);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('flowtrace_checklist_collapsed', String(next));
    }
  }

  public dismissChecklist(): void {
    this.showActivationChecklist.set(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('flowtrace_checklist_dismissed', 'true');
    }
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

  public tokenEdgePath(token: ActiveToken): string {
    if (!token.fromNode) return '';
    return this.engine.buildEdgeSvgPath(token.fromNode, token.toNode, token.staggerOffsetPx);
  }

  public tokenColor(token: ActiveToken): string {
    if (token.status === 'error') return '#ef4444';
    if (token.status === 'warn') return '#f59e0b';
    return '#06b6d4';
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
    const cx = this.currentCardWidth() / 2;
    const cy = this.currentCardHeight() / 2;
    if (scale !== 1) {
      return `translate(${node.x + shake}, ${node.y}) translate(${cx}, ${cy}) scale(${scale.toFixed(3)}) translate(${-cx}, ${-cy})`;
    }
    return `translate(${node.x + shake}, ${node.y})`;
  }

  public nodeTypeBadgeText(type: NodeType): string {
    switch (type) {
      case 'source':
        return 'INGRESS';
      case 'service':
        return 'SERVICE';
      case 'decision':
        return 'ROUTER';
      case 'datastore':
        return 'STORAGE';
      case 'queue':
        return 'QUEUE';
      case 'external':
        return 'EXTERNAL';
      case 'end':
        return 'SINK';
    }
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

  // E-Commerce Connectors & Webhooks Handlers (Gate G1-E / E20)
  public async loadProjectConnectors(projectId?: string): Promise<void> {
    const curProjId = projectId || this.currentProject()?.id;
    if (!curProjId) return;
    try {
      const list = await this.api.listConnectors(curProjId);
      this.projectConnectors.set(list);
    } catch {
      // Offline fallback
      this.projectConnectors.set([
        {
          id: '0194f1c0-0000-7000-8000-000000000881',
          projectId: curProjId,
          name: 'Shopify Storefront Webhook',
          type: 'SHOPIFY_WEBHOOK',
          tokenPrefix: 'ft_hook_shop01',
          mapping: { defaultNode: 'paid', traceIdPath: 'id', amountPath: 'total_price', currencyPath: 'currency' },
          status: 'CONNECTED',
          lastEventAt: new Date(Date.now() - 120000).toISOString(),
          totalEvents: 42,
          lastError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
  }

  public async createConnector(): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      const res = await this.api.createConnector(proj.id, {
        name: this.newConnectorName().trim(),
        type: this.newConnectorType(),
      });
      this.newlyCreatedConnectorToken.set(res.secretToken);
      this.copiedHint.set('Connector created! Webhook endpoint ready.');
      setTimeout(() => this.copiedHint.set(''), 3500);
      await this.loadProjectConnectors(proj.id);
    } catch {
      this.copiedHint.set('Failed to create connector (offline or unauthorized)');
      setTimeout(() => this.copiedHint.set(''), 3000);
    }
  }

  public async deleteConnector(connectorId: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj) return;
    try {
      await this.api.deleteConnector(proj.id, connectorId);
      await this.loadProjectConnectors(proj.id);
    } catch {
      this.projectConnectors.update((prev) => prev.filter((c) => c.id !== connectorId));
    }
  }

  public async testConnector(connectorId?: string): Promise<void> {
    const proj = this.currentProject();
    if (!proj || !connectorId) return;
    this.isTestingConnector.set(true);
    try {
      const parsed = JSON.parse(this.webhookTestJson());
      const res = await this.api.testConnectorMapping(proj.id, connectorId, parsed);
      this.webhookTestResult.set(JSON.stringify(res, null, 2));
    } catch (e: any) {
      this.webhookTestResult.set(`Error: ${e?.message || 'Invalid JSON or failed test'}`);
    } finally {
      this.isTestingConnector.set(false);
    }
  }

  public getConnectorWebhookUrl(secretTokenOrPrefix: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
    return `${base}/api/v1/connectors/webhook/${secretTokenOrPrefix}`;
  }
}
