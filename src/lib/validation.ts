import type { Context } from "hono";

export type Credentials = {
  email: string;
  password: string;
};

export async function parseCredentials(
  c: Context,
  action: "signin" | "signup",
): Promise<{ ok: true; value: Credentials } | { ok: false; response: Response }> {
  const body = await c.req.parseBody();
  const rawEmail = body["email"];
  const rawPassword = body["password"];

  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    return { ok: false, response: c.html(`invalid ${action} details`, 400) };
  }

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  if (!isValidEmail(email) || password.length < 8 || password.length > 256) {
    return { ok: false, response: c.html(`invalid ${action} details`, 400) };
  }

  return { ok: true, value: { email, password } };
}

export function parseTodoText(value: FormDataEntryValue | FormDataEntryValue[] | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > 500) {
    return null;
  }

  return text;
}

export function parseTodoId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    return null;
  }

  return id;
}

export function normalizeTodoFilter(filter?: string): "done" | "undone" | undefined {
  if (filter === "done" || filter === "undone") {
    return filter;
  }

  return undefined;
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
