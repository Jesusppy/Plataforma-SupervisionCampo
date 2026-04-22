export const AUTH_TOKEN_COOKIE_NAME = "psc_access_token";

type JwtPayload = {
  exp?: number;
  sub?: string;
  type?: string;
  email?: string;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

function decodeBase64UrlToBytes(input: string): Uint8Array {
  const decoded = decodeBase64Url(input);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = decodeBase64Url(segments[1]);
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

export function isJwtTokenValid(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowInSeconds;
}

export async function verifyJwtTokenSignature(
  token: string,
  secret: string,
): Promise<boolean> {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64UrlToBytes(segments[2]),
      new TextEncoder().encode(`${segments[0]}.${segments[1]}`),
    );
  } catch {
    return false;
  }
}

export async function isServerSessionValid(
  token: string | null | undefined,
  secret?: string,
): Promise<boolean> {
  if (!isJwtTokenValid(token)) {
    return false;
  }

  if (!token || !secret) {
    return Boolean(token);
  }

  return verifyJwtTokenSignature(token, secret);
}