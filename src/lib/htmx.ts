import type { Context } from "hono";

export function isHtmxRequest(c: Context) {
  return c.req.header("HX-Request") === "true";
}
