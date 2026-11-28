import type { RbacRole } from '../types/crm';
import type { CrmState } from './stateSchema';

export type RuntimeMode = 'auto' | 'server' | 'demo';

export interface RuntimeConfig {
  mode?: RuntimeMode;
  apiBase?: string;
}

declare global {
  interface Window {
    RASPINA_APP?: RuntimeConfig;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = 'network_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getRuntimeConfig(): Required<RuntimeConfig> {
  const raw = typeof window !== 'undefined' ? window.RASPINA_APP : undefined;
  const mode: RuntimeMode =
    raw?.mode === 'server' || raw?.mode === 'demo' || raw?.mode === 'auto' ? raw.mode : 'auto';
  const apiBase = String(raw?.apiBase ?? './api').replace(/\/+$/, '') || './api';
  return { mode, apiBase };
}

export interface SessionUser {
  username: string;
  displayName: string;
  role: RbacRole;
  csrfToken: string;
  expiresAt?: string;
}

export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  role: RbacRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface RemoteState {
  state: CrmState;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface ApiEnvelope {
  ok?: boolean;
  error?: string | { message?: string; code?: string };
  [key: string]: unknown;
}

const REQUEST_TIMEOUT_MS = 15_000;

export class CrmApi {
  private csrfToken: string | null = null;

  get apiBase(): string {
    return getRuntimeConfig().apiBase;
  }

  setCsrfToken(token: string | null): void {
    this.csrfToken = token;
  }

  private async request<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBase}/${path}`, {
        method: options.method ?? 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {}),
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });

      const text = await response.text();
      let payload: ApiEnvelope = {};
      if (text) {
        try {
          payload = JSON.parse(text) as ApiEnvelope;
        } catch {
          throw new ApiError('پاسخ سرور قابل خواندن نیست.', response.status, 'invalid_response');
        }
      }

      if (!response.ok || payload.ok === false) {
        const errorValue = payload.error;
        const message =
          typeof errorValue === 'string'
            ? errorValue
            : errorValue?.message ?? `خطای سرور (${response.status})`;
        const code = typeof errorValue === 'object' && errorValue?.code ? errorValue.code : 'request_failed';
        throw new ApiError(message, response.status, code);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('زمان پاسخ سرور به پایان رسید. اتصال را بررسی کنید.', 0, 'timeout');
      }
      throw new ApiError('ارتباط با سرور برقرار نشد. اتصال شبکه یا نصب API را بررسی کنید.', 0, 'network_error');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async session(): Promise<SessionUser> {
    const data = await this.request<{ user: SessionUser }>('auth.php?action=session');
    this.csrfToken = data.user.csrfToken;
    return data.user;
  }

  async login(username: string, password: string): Promise<SessionUser> {
    const data = await this.request<{ user: SessionUser }>('auth.php?action=login', {
      method: 'POST',
      body: { username, password },
    });
    this.csrfToken = data.user.csrfToken;
    return data.user;
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ ok: true }>('auth.php?action=logout', { method: 'POST' });
    } finally {
      this.csrfToken = null;
    }
  }

  async fetchState(): Promise<RemoteState> {
    return this.request<RemoteState>('state.php');
  }

  async saveState(state: CrmState, version: number): Promise<{ version: number; updatedAt: string }> {
    return this.request<{ version: number; updatedAt: string }>('state.php', {
      method: 'PUT',
      headers: { 'If-Match': String(version) },
      body: { state, version },
    });
  }

  async listUsers(): Promise<ManagedUser[]> {
    const data = await this.request<{ users: ManagedUser[] }>('users.php');
    return data.users;
  }

  async createUser(input: {
    username: string;
    displayName: string;
    role: RbacRole;
    password: string;
  }): Promise<void> {
    await this.request<{ ok: true }>('users.php?action=create', { method: 'POST', body: input });
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    await this.request<{ ok: true }>('users.php?action=toggle', {
      method: 'POST',
      body: { userId, isActive },
    });
  }

  async resetUserPassword(userId: string, password: string): Promise<void> {
    await this.request<{ ok: true }>('users.php?action=reset_password', {
      method: 'POST',
      body: { userId, password },
    });
  }
}

export const api = new CrmApi();
