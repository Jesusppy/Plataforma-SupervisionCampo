"use client";

import { clearSession, getAccessToken, redirectToLogin } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiClientError extends Error {
  status: number;
  details: string;

  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function buildHeaders(
  incomingHeaders?: HeadersInit,
  body?: BodyInit | null,
): Headers {
  const headers = new Headers(incomingHeaders);
  const token = getAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function readErrorDetails(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    return payload?.detail ?? JSON.stringify(payload ?? {});
  }

  return (await response.text().catch(() => "")) || response.statusText;
}

async function handleUnauthorized(response: Response): Promise<never> {
  const details = await readErrorDetails(response);
  clearSession();

  if (typeof window !== "undefined") {
    const nextPath = `${window.location.pathname}${window.location.search}`;
    redirectToLogin("session-expired", nextPath);
  }

  throw new ApiClientError("La sesión expiró o no es válida.", 401, details);
}

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as TResponse;
  }

  return (await response.text()) as TResponse;
}

export async function apiFetch<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(resolveApiUrl(path), {
    ...init,
    cache: init.cache ?? "no-store",
    headers: buildHeaders(init.headers, init.body),
  });

  if (response.status === 401) {
    return handleUnauthorized(response);
  }

  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new ApiClientError(
      `La API devolvió un error HTTP ${response.status}.`,
      response.status,
      details,
    );
  }

  return parseResponse<TResponse>(response);
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  return apiFetch<TResponse>(path, { method: "GET" });
}

export async function apiPost<TResponse>(
  path: string,
  payload: unknown,
  init: RequestInit = {},
): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    ...init,
    method: init.method ?? "POST",
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

function resolveDownloadName(
  response: Response,
  fallbackFileName: string,
): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const matches = disposition.match(/filename="?([^";]+)"?/i);
  return matches?.[1] ?? fallbackFileName;
}

export async function downloadFile(
  path: string,
  fallbackFileName: string,
): Promise<void> {
  const response = await fetch(resolveApiUrl(path), {
    cache: "no-store",
    headers: buildHeaders(),
  });

  if (response.status === 401) {
    await handleUnauthorized(response);
  }

  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new ApiClientError(
      `No fue posible descargar el archivo (${response.status}).`,
      response.status,
      details,
    );
  }

  const blob = new Blob([await response.arrayBuffer()], {
    type: response.headers.get("content-type") ?? "application/octet-stream",
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = resolveDownloadName(response, fallbackFileName);
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}