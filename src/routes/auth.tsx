import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import {
  addGoogleUser,
  addUser,
  checkEmailPassword,
  deleteSession,
  getUserByEmail,
  getUserByGoogleId,
  linkGoogleUser,
} from "../db";
import { clearSessionCookie, signInAndRedirect } from "../lib/auth";
import {
  clearGoogleOAuthCookies,
  createGoogleClient,
  createGoogleOAuthState,
  getGoogleOAuthCookies,
  parseGoogleIdToken,
  setGoogleOAuthCookies,
  verifyGoogleIdToken,
  type GoogleIdTokenClaims,
} from "../lib/google-oauth";
import { isHtmxRequest } from "../lib/htmx";
import { parseCredentials } from "../lib/validation";
import { SignInPage, SignUpPage } from "../views/auth";

export const authRoutes = new Hono();

authRoutes.get("/", (c) => c.html(<SignInPage {...getGoogleSignInProps(c)} />));

authRoutes.get("/signup-email", (c) => c.html(<SignUpPage {...getGoogleSignInProps(c)} />));

authRoutes.get("/auth/google", (c) => {
  const google = createGoogleClient(c);

  if (!google) {
    return c.text("Google OAuth is not configured", 500);
  }

  const { state, codeVerifier } = createGoogleOAuthState();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);

  setGoogleOAuthCookies(c, state, codeVerifier);

  return c.redirect(url.toString());
});

authRoutes.get("/auth/google/callback", async (c) => {
  const google = createGoogleClient(c);

  if (!google) {
    return c.text("Google OAuth is not configured", 500);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const stored = getGoogleOAuthCookies(c);

  clearGoogleOAuthCookies(c);

  if (!code || !state || !stored.state || !stored.codeVerifier || state !== stored.state) {
    return c.text("Invalid Google OAuth request", 400);
  }

  const tokens = await google.validateAuthorizationCode(code, stored.codeVerifier);
  const claims = parseGoogleIdToken(tokens.idToken());

  return signInWithGoogleClaims(c, claims);
});

authRoutes.post("/auth/google/credential", async (c) => {
  const body = await c.req.parseBody();
  const credential = body["credential"];
  const bodyCsrfToken = body["g_csrf_token"];
  const cookieCsrfToken = getCookie(c, "g_csrf_token");

  if (
    typeof credential !== "string" ||
    typeof bodyCsrfToken !== "string" ||
    !cookieCsrfToken ||
    bodyCsrfToken !== cookieCsrfToken
  ) {
    return c.text("Invalid Google sign-in request", 400);
  }

  let claims: GoogleIdTokenClaims | null;

  try {
    claims = await verifyGoogleIdToken(credential);
  } catch {
    return c.text("Unable to verify Google sign-in", 502);
  }

  return signInWithGoogleClaims(c, claims);
});

function getGoogleSignInProps(c: Context) {
  return {
    googleClientId: Bun.env.GOOGLE_CLIENT_ID,
    googleLoginUri: `${new URL(c.req.url).origin}/auth/google/credential`,
  };
}

function signInWithGoogleClaims(c: Context, claims: GoogleIdTokenClaims | null) {
  if (!claims || !claims.emailVerified) {
    return c.text("Google account email must be verified", 400);
  }

  const googleUser = getUserByGoogleId(claims.sub);

  if (googleUser) {
    return signInAndRedirect(c, googleUser.id);
  }

  const existingUser = getUserByEmail(claims.email);

  if (existingUser) {
    if (existingUser.googleId) {
      return c.text("Email is already linked to another Google account", 409);
    }

    const linkedUser = linkGoogleUser(existingUser.id, claims.sub);

    if (!linkedUser) {
      return c.text("Unable to link Google account", 409);
    }

    return signInAndRedirect(c, linkedUser.id);
  }

  const user = addGoogleUser(claims.sub, claims.email);

  if (!user) {
    return c.text("Unable to create Google user", 409);
  }

  return signInAndRedirect(c, user.id);
}

authRoutes.post("/signin", async (c) => {
  const credentials = await parseCredentials(c, "signin");

  if (!credentials.ok) {
    return credentials.response;
  }

  const user = checkEmailPassword(credentials.value.email, credentials.value.password);

  if (!user) {
    return c.html("credential error", 401);
  }

  return signInAndRedirect(c, user.id);
});

authRoutes.post("/signout", (c) => {
  if (!isHtmxRequest(c)) {
    return c.text("HTMX request required", 400);
  }

  const token = getCookie(c, "session");

  if (token) {
    const [sessionId] = token.split(".");

    if (sessionId) {
      deleteSession(sessionId);
    }
  }

  clearSessionCookie(c);

  c.header("HX-Redirect", "/");
  return c.body(null, 204);
});

authRoutes.post("/auth/signup-email", async (c) => {
  const credentials = await parseCredentials(c, "signup");

  if (!credentials.ok) {
    return credentials.response;
  }

  const user = addUser(credentials.value.email, credentials.value.password);

  if (!user) {
    return c.html("user exists error", 409);
  }

  return signInAndRedirect(c, user.id);
});
