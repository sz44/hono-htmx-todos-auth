import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { addUser, checkEmailPassword, deleteSession } from "../db";
import { clearSessionCookie, signInAndRedirect } from "../lib/auth";
import { isHtmxRequest } from "../lib/htmx";
import { parseCredentials } from "../lib/validation";
import { SignInPage, SignUpPage } from "../views/auth";

export const authRoutes = new Hono();

authRoutes.get("/", (c) => c.html(<SignInPage />));

authRoutes.get("/signup-email", (c) => c.html(<SignUpPage />));

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
