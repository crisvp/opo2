import { ApiError } from "@opo/shared";

const BASE_URL = "/api";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  // Unwrap { success: true, data: T } envelope
  if (data && typeof data === "object" && "data" in data) {
    return data.data as T;
  }
  return data as T;
}

export const apiClient = {
  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const response = await fetch(buildUrl(path, params), {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    const response = await fetch(buildUrl(path), {
      method: "POST",
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    const response = await fetch(buildUrl(path), {
      method: "PUT",
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return handleResponse<T>(response);
  },
};
