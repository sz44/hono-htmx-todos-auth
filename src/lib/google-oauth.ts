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
