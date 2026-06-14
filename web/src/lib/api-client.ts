import { withBasePath } from "./base-path";

const TOKEN_STORAGE_KEY = "find-my-house.ha-token";

export function getHaToken(): string | null {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (stored) return stored;
  return import.meta.env.VITE_HA_TOKEN ?? null;
}

export function hasEnvHaToken(): boolean {
  return Boolean(import.meta.env.VITE_HA_TOKEN);
}

export function hasStoredHaToken(): boolean {
  return localStorage.getItem(TOKEN_STORAGE_KEY) !== null;
}

export function setHaToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearHaToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getHaToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const timeoutSignal = AbortSignal.timeout(30_000);
  const userSignal = init.signal ?? undefined;
  const signal =
    userSignal !== undefined
      ? AbortSignal.any([userSignal, timeoutSignal])
      : timeoutSignal;

  const response = await fetch(withBasePath(path), {
    ...init,
    headers,
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
