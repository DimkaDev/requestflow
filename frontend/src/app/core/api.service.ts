import { Injectable, signal } from '@angular/core';
import {
  ApiKey,
  AuditLogEntry,
  ConnectorConfig,
  ConnectorType,
  CreatedApiKeyResult,
  CreatedConnectorResponse,
  DiagramGraph,
  DiagramVersion,
  Invitation,
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
  WebhookMapping,
  Workspace,
} from './models';

@Injectable({ providedIn: 'root' })
export class FlowTraceApiService {
  public readonly apiBaseUrl = this.resolveApiBase();
  public readonly authUserEmail = signal<string>('dev@flowtrace.local');
  public readonly authToken = signal<string>('local-dev-user');

  private resolveApiBase(): string {
    if (typeof window === 'undefined') {
      return 'http://localhost:8080/api/v1';
    }
    const { protocol, hostname, port } = window.location;
    if (port === '4200') {
      return `${protocol}//${hostname}:8080/api/v1`;
    }
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api/v1`;
  }

  public getWsUrl(projectId: string, ticket?: string): string {
    if (typeof window === 'undefined') {
      return `ws://localhost:8080/ws/v1/projects/${projectId}/stream`;
    }
    const { protocol, hostname, port } = window.location;
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    const targetPort = port === '4200' ? ':8080' : port ? `:${port}` : '';
    const query = ticket ? `?ticket=${encodeURIComponent(ticket)}` : '';
    return `${wsProto}//${hostname}${targetPort}/ws/v1/projects/${projectId}/stream${query}`;
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authToken()}`,
    };
  }

  public async listOrganizations(): Promise<OrganizationView[]> {
    const res = await fetch(`${this.apiBaseUrl}/organizations`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list organizations: ${res.status}`);
    return res.json();
  }

  public async createOrganization(
    name: string,
    slug?: string,
    billingEmail?: string
  ): Promise<OrganizationView> {
    const res = await fetch(`${this.apiBaseUrl}/organizations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, slug, billingEmail }),
    });
    if (!res.ok) throw new Error(`Failed to create organization: ${res.status}`);
    return res.json();
  }

  public async updateOrganization(
    orgId: string,
    patch: { name?: string; slug?: string; billingEmail?: string; planTier?: PlanTier }
  ): Promise<OrganizationView> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update organization: ${res.status}`);
    return res.json();
  }

  public async transferOwnership(orgId: string, newOwnerUserId: string): Promise<OrganizationView> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/transfer-ownership`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ newOwnerUserId }),
    });
    if (!res.ok) throw new Error(`Failed to transfer ownership: ${res.status}`);
    return res.json();
  }

  public async deleteOrganization(orgId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to soft-delete organization: ${res.status}`);
  }

  public async restoreOrganization(orgId: string): Promise<OrganizationView> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/restore`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to restore organization: ${res.status}`);
    return res.json();
  }

  public async createWorkspace(orgId: string, name: string, slug?: string): Promise<Workspace> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/workspaces`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
    return res.json();
  }

  public async updateWorkspace(
    orgId: string,
    workspaceId: string,
    name: string,
    slug?: string
  ): Promise<Workspace> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) throw new Error(`Failed to update workspace: ${res.status}`);
    return res.json();
  }

  public async deleteWorkspace(orgId: string, workspaceId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to delete workspace: ${res.status}`);
  }

  public async listOrgMembers(orgId: string): Promise<OrganizationMember[]> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/members`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list members: ${res.status}`);
    return res.json();
  }

  public async updateMemberRole(
    orgId: string,
    memberUserId: string,
    role: OrgRole
  ): Promise<OrganizationMember[]> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/members/${memberUserId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(`Failed to update member role: ${res.status}`);
    return res.json();
  }

  public async removeMember(orgId: string, memberUserId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/members/${memberUserId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to remove member: ${res.status}`);
  }

  public async listInvitations(orgId: string): Promise<Invitation[]> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/invitations`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list invitations: ${res.status}`);
    return res.json();
  }

  public async createInvitation(
    orgId: string,
    email: string,
    role: OrgRole
  ): Promise<Invitation> {
    const baseAppUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/invitations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email, role, baseAppUrl }),
    });
    if (!res.ok) throw new Error(`Failed to create invitation: ${res.status}`);
    return res.json();
  }

  public async resendInvitation(orgId: string, invitationId: string): Promise<Invitation> {
    const baseAppUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
    const res = await fetch(
      `${this.apiBaseUrl}/organizations/${orgId}/invitations/${invitationId}/resend`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ baseAppUrl }),
      }
    );
    if (!res.ok) throw new Error(`Failed to resend invitation: ${res.status}`);
    return res.json();
  }

  public async revokeInvitation(orgId: string, invitationId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to revoke invitation: ${res.status}`);
  }

  public async acceptInvitation(token: string): Promise<OrganizationView> {
    const res = await fetch(`${this.apiBaseUrl}/organizations/invitations/accept`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error(`Failed to accept invitation: ${res.status}`);
    return res.json();
  }

  public async listAuditLogs(
    orgId: string,
    action?: string,
    limit = 60
  ): Promise<AuditLogEntry[]> {
    const q = new URLSearchParams();
    if (action) q.set('action', action);
    if (limit) q.set('limit', String(limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/audit-logs${qs}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list audit logs: ${res.status}`);
    return res.json();
  }

  public async listProjects(organizationId?: string, workspaceId?: string): Promise<Project[]> {
    const q = new URLSearchParams();
    if (organizationId) q.set('organizationId', organizationId);
    if (workspaceId) q.set('workspaceId', workspaceId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${this.apiBaseUrl}/projects${qs}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
    return res.json();
  }

  public async createProject(
    name: string,
    autoDiscover = true,
    retentionDays = 7,
    organizationId?: string,
    workspaceId?: string
  ): Promise<Project> {
    const res = await fetch(`${this.apiBaseUrl}/projects`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, autoDiscover, retentionDays, organizationId, workspaceId }),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
    return res.json();
  }

  public async updateProject(
    projectId: string,
    patch: { name?: string; autoDiscover?: boolean; retentionDays?: number }
  ): Promise<Project> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update project: ${res.status}`);
    return res.json();
  }

  public async deleteProject(projectId: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/projects/${projectId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }

  public async getDiagram(projectId: string): Promise<DiagramVersion> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/diagram`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to get diagram: ${res.status}`);
    return res.json();
  }

  public async saveDiagram(projectId: string, graph: DiagramGraph): Promise<DiagramVersion> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/diagram`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(graph),
    });
    if (!res.ok) throw new Error(`Failed to save diagram: ${res.status}`);
    return res.json();
  }

  public async listDiagramVersions(projectId: string): Promise<DiagramVersion[]> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/diagram/versions`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list diagram versions: ${res.status}`);
    return res.json();
  }

  public async listKeys(projectId: string): Promise<ApiKey[]> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list keys: ${res.status}`);
    return res.json();
  }

  public async createKey(
    projectId: string,
    name: string,
    rateLimitPerS = 1000,
    scopes = 'ingest'
  ): Promise<CreatedApiKeyResult> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, rateLimitPerS, scopes }),
    });
    if (!res.ok) throw new Error(`Failed to create key: ${res.status}`);
    return res.json();
  }

  public async rotateKey(
    projectId: string,
    keyId: string,
    gracePeriodHours = 24
  ): Promise<RotatedApiKeyResult> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys/${keyId}/rotate`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ gracePeriodHours }),
    });
    if (!res.ok) throw new Error(`Failed to rotate key: ${res.status}`);
    return res.json();
  }

  public async revokeKey(projectId: string, keyId: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys/${keyId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }

  public async getOrganizationUsage(orgId: string, month?: string): Promise<OrganizationUsage> {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const res = await fetch(`${this.apiBaseUrl}/organizations/${orgId}/usage${query}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to load organization usage: ${res.status}`);
    return res.json();
  }

  public async searchTraces(
    projectId: string,
    params: { status?: string; node?: string; cursor?: string; limit?: number } = {}
  ): Promise<TraceSummary[]> {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.node) q.set('node', params.node);
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/traces${qs}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to search traces: ${res.status}`);
    return res.json();
  }

  public async getTraceDetail(projectId: string, traceId: string): Promise<TraceDetail> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/traces/${traceId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to fetch trace detail: ${res.status}`);
    return res.json();
  }

  public async issueWsTicket(projectId: string): Promise<string | undefined> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/ws-ticket`, {
        method: 'POST',
        headers: this.headers(),
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      return data.ticket;
    } catch {
      return undefined;
    }
  }

  public async getDemoStatus(
    projectId: string
  ): Promise<{ running: boolean; rate?: number; errorRate?: number }> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/demo`, {
      headers: this.headers(),
    });
    if (!res.ok) return { running: false };
    return res.json();
  }

  public async startDemo(
    projectId: string,
    rate = 2.5,
    errorRate = 0.04
  ): Promise<{ running: boolean; rate: number; errorRate: number }> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/demo`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ rate, errorRate }),
    });
    return res.json();
  }

  public async stopDemo(projectId: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/projects/${projectId}/demo`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }

  public async listTemplates(): Promise<TemplateDefinition[]> {
    const res = await fetch(`${this.apiBaseUrl}/templates`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
    return res.json();
  }

  public async applyTemplate(projectId: string, templateId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/template/${templateId}`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to apply template: ${res.status}`);
  }

  // Connectors & E-Commerce Webhooks (Gate G1-E / E20)
  public async listConnectors(projectId: string): Promise<ConnectorConfig[]> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/connectors`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list connectors: ${res.status}`);
    return res.json();
  }

  public async createConnector(
    projectId: string,
    req: { name: string; type: ConnectorType; mapping?: WebhookMapping }
  ): Promise<CreatedConnectorResponse> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/connectors`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Failed to create connector: ${res.status}`);
    return res.json();
  }

  public async deleteConnector(projectId: string, connectorId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/connectors/${connectorId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to delete connector: ${res.status}`);
  }

  public async testConnectorMapping(
    projectId: string,
    connectorId: string,
    sampleJson: Record<string, unknown>
  ): Promise<any> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/connectors/${connectorId}/test`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(sampleJson),
    });
    if (!res.ok) throw new Error(`Failed to test connector: ${res.status}`);
    return res.json();
  }

  public async sendTestEvents(
    apiKey: string,
    events: Array<Record<string, unknown>>
  ): Promise<{ accepted: number; rejected?: Array<{ index: number; reason: string }> }> {
    const res = await fetch(`${this.apiBaseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(events),
    });
    if (!res.ok) throw new Error(`Failed to send test event: ${res.status}`);
    return res.json();
  }

  public async listAlerts(projectId: string): Promise<any[]> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/alerts`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list alerts: ${res.status}`);
    return res.json();
  }

  public async createAlert(
    projectId: string,
    payload: {
      name: string;
      severity: string;
      metric: string;
      threshold: number;
      windowSeconds: number;
      targetNode?: string;
      channelType: string;
      channelTarget: string;
    }
  ): Promise<any> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/alerts`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create alert: ${res.status}`);
    return res.json();
  }

  public async updateAlert(
    projectId: string,
    alertId: string,
    patch: { enabled?: boolean; muteMinutes?: number }
  ): Promise<any> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/alerts/${alertId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update alert: ${res.status}`);
    return res.json();
  }

  public async testAlert(projectId: string, alertId: string): Promise<any> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/alerts/${alertId}/test`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to test alert: ${res.status}`);
    return res.json();
  }

  public async deleteAlert(projectId: string, alertId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/alerts/${alertId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to delete alert: ${res.status}`);
  }
}
