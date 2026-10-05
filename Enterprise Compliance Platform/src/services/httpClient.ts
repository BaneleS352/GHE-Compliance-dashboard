import { getApiToken } from "@/app/auth/msal";

interface ApiError {
  status: number;
  error: string;
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
      signal: controller.signal,
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
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  postForm: <T>(path: string, body: FormData) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
