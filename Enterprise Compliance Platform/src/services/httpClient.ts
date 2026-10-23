import { getApiToken } from "@/services/authToken";

interface ApiError {
  status: number;
  error: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30000,
  options?: RequestOptions,
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  headers["Authorization"] = `Bearer ${await getApiToken()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? (isFormData ? body as FormData : JSON.stringify(body)) : undefined,
      signal: options?.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let errorBody: ApiError | null = null;
    try {
      errorBody = await res.json();
    } catch { /* ignore parse errors */ }
    throw new ApiClientError(
      res.status,
      errorBody?.error || `Request failed with status ${res.status}`,
    );
  }

  // 204 No Content — return undefined (callers must handle)
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, 30000, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body, 30000, options),
  postForm: <T>(path: string, body: FormData, options?: RequestOptions) => request<T>("POST", path, body, 30000, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body, 30000, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", path, body, 30000, options),
  del: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, 30000, options),
};
