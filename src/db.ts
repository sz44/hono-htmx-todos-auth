import { Database } from "bun:sqlite";

export type Todo = {
  id: number;
  text: string;
  isDone: boolean;
};

type TodoRow = {
  id: number;
  text: string;
  is_done: number;
};

export type User = {
  id: string;
  email: string;
  createdAt: number;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

export type Session = {
  id: string;
  userId: string;
  secretHash: string;
  createdAt: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  secret_hash: string;
  created_at: number;
};

type SessionWithToken = Session & {
  token: string;
};

type TableColumnRow = {
  name: string;
};

const db = new Database("todos.db", { create: true });

db.run("PRAGMA foreign_keys = ON");
db.run(await Bun.file("schema.sql").text());
migrateExistingTodosTable();

const toTodo = (row: TodoRow): Todo => ({
  id: row.id,
  text: row.text,
  isDone: row.is_done === 1,
});

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  createdAt: row.created_at,
});

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  secretHash: row.secret_hash,
  createdAt: row.created_at,
});

export const getTodos = (userId: string, filter?: string): Todo[] => {
  if (filter === "done") {
    return db
      .query<TodoRow, [string]>(
        "SELECT id, text, is_done FROM todos WHERE user_id = ? AND is_done = 1 ORDER BY id",
      )
      .all(userId)
      .map(toTodo);
  }

  if (filter === "undone") {
    return db
      .query<TodoRow, [string]>(
        "SELECT id, text, is_done FROM todos WHERE user_id = ? AND is_done = 0 ORDER BY id",
      )
      .all(userId)
      .map(toTodo);
  }

  return db
    .query<TodoRow, [string]>("SELECT id, text, is_done FROM todos WHERE user_id = ? ORDER BY id")
    .all(userId)
    .map(toTodo);
};

export const createTodo = (userId: string, text: string): Todo => {
  const result = db.query("INSERT INTO todos (user_id, text, is_done) VALUES (?, ?, 0)").run(userId, text);
  const row = db
    .query<TodoRow, [number, string]>("SELECT id, text, is_done FROM todos WHERE id = ? AND user_id = ?")
    .get(Number(result.lastInsertRowid), userId);

  if (!row) {
    throw new Error("Failed to create todo");
  }

  return toTodo(row);
};

export const updateTodoDone = (userId: string, id: number, isDone: boolean): Todo | undefined => {
  db.query("UPDATE todos SET is_done = ? WHERE id = ? AND user_id = ?").run(isDone ? 1 : 0, id, userId);

  const row = db
    .query<TodoRow, [number, string]>("SELECT id, text, is_done FROM todos WHERE id = ? AND user_id = ?")
    .get(id, userId);

  return row ? toTodo(row) : undefined;
};

export const deleteTodo = (userId: string, id: number) => {
  db.query("DELETE FROM todos WHERE id = ? AND user_id = ?").run(id, userId);
};

export const addUser = (email: string, password: string): User | null => {
  const id = generateSecureRandomString();
  const hash = Bun.password.hashSync(password);

  try {
    const row = db
      .query<UserRow, [string, string, string]>(
        "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?) RETURNING id, email, password_hash, created_at",
      )
      .get(id, email, hash);

    if (!row) {
      throw new Error("Failed to create user");
    }

    return toUser(row);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
      return null;
    }

    throw error;
  }
};

export function createSession(userId: string): SessionWithToken {
  const now = Math.floor(Date.now() / 1000);
  const id = generateSecureRandomString();
  const secret = generateSecureRandomString();
  const secretHash = Bun.password.hashSync(secret);
  const token = `${id}.${secret}`;

  const session: SessionWithToken = {
    id,
    userId,
    secretHash,
    createdAt: now,
    token,
  };

  db.query("INSERT INTO sessions (id, user_id, secret_hash, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    userId,
    secretHash,
    session.createdAt,
  );

  return session;
}

const sessionExpiresInSeconds = 60 * 60 * 24;

export function getSession(sessionId: string): Session | null {
  const row = db
    .query<SessionRow, [string]>("SELECT id, user_id, secret_hash, created_at FROM sessions WHERE id = ?")
    .get(sessionId);

  if (!row) {
    return null;
  }

  const session = toSession(row);
  const now = Math.floor(Date.now() / 1000);

  if (now - session.createdAt >= sessionExpiresInSeconds) {
    deleteSession(sessionId);
    return null;
  }

  return session;
}

export function deleteSession(sessionId: string) {
  db.query("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function validateSessionToken(token: string): Session | null {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 2) {
    return null;
  }

  const [sessionId, sessionSecret] = tokenParts;
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  const validSecret = Bun.password.verifySync(sessionSecret, session.secretHash);

  if (!validSecret) {
    return null;
  }

  return session;
}

export function checkEmailPassword(email: string, password: string): User | null {
  const row = db
    .query<UserRow, [string]>("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email);

  if (!row) {
    return null;
  }

  const validPassword = Bun.password.verifySync(password, row.password_hash);

  if (!validPassword) {
    return null;
  }

  return toUser(row);
}

function migrateExistingTodosTable() {
  const columns = db.query<TableColumnRow, []>("PRAGMA table_info(todos)").all();
  const hasUserId = columns.some((column) => column.name === "user_id");

  if (!hasUserId) {
    db.run("ALTER TABLE todos ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE");
  }
}

function generateSecureRandomString(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  let id = "";
  for (let i = 0; i < bytes.length; i++) {
    id += alphabet[bytes[i] >> 3];
  }

  return id;
}
