// API-Client. Schaltet zwischen Mock-Backend (in-memory, localStorage-persistiert)
// und echtem Pi-Backend um, basierend auf Vite-Env-Variablen.
//
//   VITE_USE_MOCK=true   -> Mock (Default in Dev)
//   VITE_USE_MOCK=false  -> Echtes Backend
//   VITE_API_BASE_URL=http://meinpi.local:4000

import { mockBackend } from "@/lib/mock/backend";

const USE_MOCK =
  (import.meta.env.VITE_USE_MOCK ?? "true").toString().toLowerCase() !== "false";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").toString().replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type FetchInit = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(method: string, path: string, init: FetchInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  let body: BodyInit | undefined;

  if (init.body !== undefined) {
    if (init.body instanceof FormData) {
      body = init.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    credentials: "include", // für HttpOnly-Cookie-Auth vom Pi
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(
      typeof data === "string" ? data : (data as { message?: string }).message ?? res.statusText,
      res.status,
      data,
    );
  }
  return data as T;
}

export const api = {
  isMock: USE_MOCK,
  get: <T>(path: string) =>
    USE_MOCK ? mockBackend<T>("GET", path) : request<T>("GET", path),
  post: <T>(path: string, body?: unknown) =>
    USE_MOCK ? mockBackend<T>("POST", path, body) : request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) =>
    USE_MOCK ? mockBackend<T>("PATCH", path, body) : request<T>("PATCH", path, { body }),
  put: <T>(path: string, body?: unknown) =>
    USE_MOCK ? mockBackend<T>("PUT", path, body) : request<T>("PUT", path, { body }),
  delete: <T>(path: string) =>
    USE_MOCK ? mockBackend<T>("DELETE", path) : request<T>("DELETE", path),
};
