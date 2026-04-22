"use client";

import { AUTH_TOKEN_COOKIE_NAME, isJwtTokenValid } from "./session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in_minutes: number;
  user: AuthenticatedUser;
};

const DEFAULT_AUTH_REDIRECT = "/reports";

function parseCookieString(cookieString: string): Record<string, string> {
  return cookieString
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, segment) => {
      const separatorIndex = segment.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = segment.slice(0, separatorIndex);
      const value = segment.slice(separatorIndex + 1);
      accumulator[key] = value;
      return accumulator;
    }, {});
}

export function sanitizeNextPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return candidate;
}

export function getAccessToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = parseCookieString(document.cookie);
  const token = cookies[AUTH_TOKEN_COOKIE_NAME];
  return token ? decodeURIComponent(token) : null;
}

export function persistSession(payload: TokenResponse): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureDirective = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAgeInSeconds = Math.max(payload.expires_in_minutes * 60, 60);
  document.cookie =
    `${AUTH_TOKEN_COOKIE_NAME}=${encodeURIComponent(payload.access_token)}; Path=/; Max-Age=${maxAgeInSeconds}; SameSite=Lax${secureDirective}`;
}

export function clearSession(): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureDirective = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureDirective}`;
}

export function hasActiveSession(): boolean {
  return isJwtTokenValid(getAccessToken());
}

export function redirectToLogin(reason?: string, nextPath?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL("/login", window.location.origin);
  const sanitizedNextPath = sanitizeNextPath(nextPath);

  if (reason) {
    url.searchParams.set("reason", reason);
  }
  if (sanitizedNextPath !== DEFAULT_AUTH_REDIRECT) {
    url.searchParams.set("next", sanitizedNextPath);
  }

  window.location.assign(url.toString());
}