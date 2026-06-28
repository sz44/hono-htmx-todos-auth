import { decodeIdToken, generateCodeVerifier, generateState, Google } from "arctic";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const googleOAuthStateCookie = "google_oauth_state";
export const googleOAuthCodeVerifierCookie = "google_oauth_code_verifier";

export function createGoogleOAuthState() {
  return {
    state: generateState(),
    codeVerifier: generateCodeVerifier(),
  };
}

export function createGoogleClient(c: Context): Google | null {
  const clientId = Bun.env.GOOGLE_CLIENT_ID;
  const clientSecret = Bun.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const origin = new URL(c.req.url).origin;
  return new Google(clientId, clientSecret, `${origin}/auth/google/callback`);
}

export function setGoogleOAuthCookies(c: Context, state: string, codeVerifier: string) {
  const options = getOAuthCookieOptions(c);

  setCookie(c, googleOAuthStateCookie, state, options);
  setCookie(c, googleOAuthCodeVerifierCookie, codeVerifier, options);
}

export function getGoogleOAuthCookies(c: Context) {
  return {
    state: getCookie(c, googleOAuthStateCookie),
    codeVerifier: getCookie(c, googleOAuthCodeVerifierCookie),
  };
}

export function clearGoogleOAuthCookies(c: Context) {
  deleteCookie(c, googleOAuthStateCookie, { path: "/" });
  deleteCookie(c, googleOAuthCodeVerifierCookie, { path: "/" });
}

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenClaims | null> {
  const clientId = Bun.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  const verified = await verifyGoogleJwt(idToken, clientId);

  if (!verified) {
    return null;
  }

  return parseGoogleIdToken(idToken);
}

export function parseGoogleIdToken(idToken: string): GoogleIdTokenClaims | null {
  const claims = decodeIdToken(idToken);

  if (!isGoogleIdTokenClaims(claims)) {
    return null;
  }

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified,
  };
}

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

let cachedGoogleJwks: {
  expiresAt: number;
  keys: JsonWebKey[];
} | null = null;

async function verifyGoogleJwt(idToken: string, audience: string): Promise<boolean> {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJwtPart(headerPart);
  const payload = parseJwtPart(payloadPart);

  if (!isGoogleJwtHeader(header) || !isGoogleJwtPayload(payload)) {
    return false;
  }

  if (header.alg !== "RS256" || payload.aud !== audience) {
    return false;
  }

  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    return false;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const jwk = (await getGoogleJwks()).find((key) => key.kid === header.kid);

  if (!jwk) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
}

async function getGoogleJwks(): Promise<JsonWebKey[]> {
  const now = Date.now();

  if (cachedGoogleJwks && cachedGoogleJwks.expiresAt > now) {
    return cachedGoogleJwks.keys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");

  if (!response.ok) {
    throw new Error("Failed to load Google public keys");
  }

  const jwks = (await response.json()) as JsonWebKeySet;
  const maxAge = parseCacheControlMaxAge(response.headers.get("cache-control"));

  cachedGoogleJwks = {
    expiresAt: now + maxAge * 1000,
    keys: jwks.keys,
  };

  return cachedGoogleJwks.keys;
}

function parseJwtPart(part: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(part)));
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function parseCacheControlMaxAge(value: string | null) {
  const fallbackSeconds = 60 * 60;

  if (!value) {
    return fallbackSeconds;
  }

  const match = value.match(/max-age=(\d+)/);

  if (!match) {
    return fallbackSeconds;
  }

  return Number(match[1]);
}

function getOAuthCookieOptions(c: Context) {
  return {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "Lax" as const,
    secure: new URL(c.req.url).protocol === "https:",
  };
}

function isGoogleIdTokenClaims(value: object): value is {
  sub: string;
  email: string;
  email_verified: boolean;
} {
  return (
    "sub" in value &&
    typeof value.sub === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "email_verified" in value &&
    typeof value.email_verified === "boolean"
  );
}

function isGoogleJwtHeader(value: unknown): value is {
  alg: string;
  kid: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "alg" in value &&
    typeof value.alg === "string" &&
    "kid" in value &&
    typeof value.kid === "string"
  );
}

function isGoogleJwtPayload(value: unknown): value is {
  aud: string;
  exp: number;
  iss: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "aud" in value &&
    typeof value.aud === "string" &&
    "exp" in value &&
    typeof value.exp === "number" &&
    "iss" in value &&
    typeof value.iss === "string"
  );
}
