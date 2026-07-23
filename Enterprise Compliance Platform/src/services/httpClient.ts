const TOKEN_KEY = "ghe.auth.token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return getToken();
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

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
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? (isFormData ? body as FormData : JSON.stringify(body)) : undefined,
  });

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
