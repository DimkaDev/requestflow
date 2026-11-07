import { Injectable, signal } from '@angular/core';
import {
  ApiKey,
  CreatedApiKeyResult,
  DiagramGraph,
  DiagramVersion,
  Project,
  TraceDetail,
  TraceSummary,
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

  public async listProjects(): Promise<Project[]> {
    const res = await fetch(`${this.apiBaseUrl}/projects`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
    return res.json();
  }

  public async createProject(
    name: string,
    autoDiscover = true,
    retentionDays = 7
  ): Promise<Project> {
    const res = await fetch(`${this.apiBaseUrl}/projects`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, autoDiscover, retentionDays }),
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
    rateLimitPerS = 1000
  ): Promise<CreatedApiKeyResult> {
    const res = await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, rateLimitPerS }),
    });
    if (!res.ok) throw new Error(`Failed to create key: ${res.status}`);
    return res.json();
  }

  public async revokeKey(projectId: string, keyId: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/projects/${projectId}/keys/${keyId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
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
}
