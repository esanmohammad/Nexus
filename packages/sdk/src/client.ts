export class NexusError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "NexusError";
    this.status = status;
    this.code = code;
  }
}

export class NexusClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      let code = "UNKNOWN";
      let message = response.statusText;
      try {
        const body = await response.json();
        if (body.error) {
          code = body.error.code || code;
          message = body.error.message || message;
        }
      } catch {
        // ignore parse errors
      }
      throw new NexusError(message, response.status, code);
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // ── Sandbox Methods ──

  async createSandbox(
    config: Record<string, unknown>,
    source: Blob | File
  ): Promise<any> {
    const formData = new FormData();
    formData.append("config", JSON.stringify(config));
    formData.append("source", source);

    const url = `${this.baseUrl}/api/sandboxes`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: formData,
    });

    if (!response.ok) {
      let code = "UNKNOWN";
      let message = response.statusText;
      try {
        const body = await response.json();
        if (body.error) {
          code = body.error.code || code;
          message = body.error.message || message;
        }
      } catch {}
      throw new NexusError(message, response.status, code);
    }

    return response.json();
  }

  async createSandboxFromGithub(
    config: Record<string, unknown> & { github_url: string }
  ): Promise<any> {
    return this.request<any>("/api/sandboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }

  async listSandboxes(): Promise<any[]> {
    return this.request<any[]>("/api/sandboxes");
  }

  async getSandbox(id: string): Promise<any> {
    return this.request<any>(`/api/sandboxes/${id}`);
  }

  async updateSandbox(id: string, input: Record<string, unknown>): Promise<any> {
    return this.request<any>(`/api/sandboxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async destroySandbox(id: string): Promise<void> {
    await this.request<any>(`/api/sandboxes/${id}`, {
      method: "DELETE",
    });
  }

  async extendSandbox(id: string, ttlDays: number): Promise<any> {
    return this.request<any>(`/api/sandboxes/${id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_days: ttlDays }),
    });
  }

  async shareSandbox(id: string, input: Record<string, unknown>): Promise<any> {
    return this.request<any>(`/api/sandboxes/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  // ── Version Methods ──

  async deployVersion(
    sandboxId: string,
    source: Blob | File,
    label?: string,
    config?: Record<string, unknown>
  ): Promise<any> {
    const formData = new FormData();
    formData.append("source", source);
    const configObj: Record<string, unknown> = { ...config };
    if (label) configObj.label = label;
    if (Object.keys(configObj).length > 0) {
      formData.append("config", JSON.stringify(configObj));
    }

    const url = `${this.baseUrl}/api/sandboxes/${sandboxId}/versions`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: formData,
    });

    if (!response.ok) {
      let code = "UNKNOWN";
      let message = response.statusText;
      try {
        const body = await response.json();
        if (body.error) {
          code = body.error.code || code;
          message = body.error.message || message;
        }
      } catch {}
      throw new NexusError(message, response.status, code);
    }

    return response.json();
  }

  async listVersions(sandboxId: string): Promise<any[]> {
    return this.request<any[]>(`/api/sandboxes/${sandboxId}/versions`);
  }

  async rollback(sandboxId: string, targetVersion?: number): Promise<any> {
    const body: Record<string, unknown> = {};
    if (targetVersion !== undefined) {
      body.target_version = targetVersion;
    }
    return this.request<any>(`/api/sandboxes/${sandboxId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async getBuildLog(sandboxId: string, versionNumber: number): Promise<string> {
    return this.request<string>(
      `/api/sandboxes/${sandboxId}/versions/${versionNumber}/log`
    );
  }

  async getSourceDownloadUrl(
    sandboxId: string,
    versionNumber: number
  ): Promise<string> {
    const result = await this.request<{ url: string }>(
      `/api/sandboxes/${sandboxId}/versions/${versionNumber}/source`
    );
    return typeof result === "string" ? result : result.url;
  }
}
