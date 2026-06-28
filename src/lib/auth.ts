import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createSession, type Session, validateSessionToken } from "../db";
import { isHtmxRequest } from "./htmx";

export function getAuthenticatedSession(c: Context): Session | null {
  const token = getCookie(c, "session");

  if (!token) {
    return null;
  }

  return validateSessionToken(token);
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, "session", token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, "session", {
    path: "/",
  });
}

export function redirectToSignin(c: Context) {
  if (isHtmxRequest(c)) {
    c.header("HX-Redirect", "/");
    return c.body(null, 401);
  }

  return c.redirect("/");
}

export function signInAndRedirect(c: Context, userId: string) {
  const session = createSession(userId);
  setSessionCookie(c, session.token);

  if (isHtmxRequest(c)) {
    c.header("HX-Redirect", "/app");
    return c.body(null, 204);
  }

  return c.redirect("/app");
}
