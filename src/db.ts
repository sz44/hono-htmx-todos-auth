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

type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}
const db = new Database("todos.db", { create: true });

db.run(await Bun.file("schema.sql").text());

const seedCount = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM todos").get();

if (seedCount?.count === 0) {
  const insert = db.query("INSERT INTO todos (text, is_done) VALUES (?, ?)");
  insert.run("Learn Hono", 0);
  insert.run("Learn HTMX", 1);
}

const toTodo = (row: TodoRow): Todo => ({
  id: row.id,
  text: row.text,
  isDone: row.is_done === 1,
});

export const getTodos = (filter?: string): Todo[] => {
  if (filter === "done") {
    return db
      .query<TodoRow, []>("SELECT id, text, is_done FROM todos WHERE is_done = 1 ORDER BY id")
      .all()
      .map(toTodo);
  }

  if (filter === "undone") {
    return db
      .query<TodoRow, []>("SELECT id, text, is_done FROM todos WHERE is_done = 0 ORDER BY id")
      .all()
      .map(toTodo);
  }

  return db.query<TodoRow, []>("SELECT id, text, is_done FROM todos ORDER BY id").all().map(toTodo);
};

export const createTodo = (text: string): Todo => {
  const result = db.query("INSERT INTO todos (text, is_done) VALUES (?, 0)").run(text);
  const row = db
    .query<TodoRow, [number]>("SELECT id, text, is_done FROM todos WHERE id = ?")
    .get(Number(result.lastInsertRowid));

  if (!row) {
    throw new Error("Failed to create todo");
  }

  return toTodo(row);
};

export const updateTodoDone = (id: number, isDone: boolean): Todo | undefined => {
  db.query("UPDATE todos SET is_done = ? WHERE id = ?").run(isDone ? 1 : 0, id);

  const row = db.query<TodoRow, [number]>("SELECT id, text, is_done FROM todos WHERE id = ?").get(id);

  return row ? toTodo(row) : undefined;
};

export const deleteTodo = (id: number) => {
  db.query("DELETE FROM todos WHERE id = ?").run(id);
};

export const findUserByEmail = (email: string) => {
  const res = db
    .query("SELECT 1 FROM users WHERE email = ? LIMIT 1")
    .get(email);

  // If res is not null/undefined, the user exists
  return res !== null; 
};

export const addUser = (email: string, password: string) => {
  const id = generateSecureRandomString();
  const hash = Bun.password.hashSync(password);
  const result = db
    .query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .run(id, email, hash);
  return {
    // cound have used Number(result.lastInsertRowid)
    id: id, email,
  };
}


function generateSecureRandomString(): string {
	// Human readable alphabet (a-z, 0-9 without l, o, 0, 1 to avoid confusion)
	const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";

	// Generate 24 bytes = 192 bits of entropy.
	// We're only going to use 5 bits per byte so the total entropy will be 192 * 5 / 8 = 120 bits
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);

	let id = "";
	for (let i = 0; i < bytes.length; i++) {
		// >> 3 "removes" the right-most 3 bits of the byte
		id += alphabet[bytes[i] >> 3];
	}
	return id;
}

export async function createSession(userId: string) {
	const now = Math.floor(Date.now() / 1000);

	const id = generateSecureRandomString();
	const secret = generateSecureRandomString();
  const secretHash = Bun.password.hashSync(secret);
	const token = id + "." + secret;

	const session: SessionWithToken = {
		id,
    userId,
		secretHash,
		createdAt: now,
    token
	};

  const result = db
    .query("INSERT INTO sessions (id, user_id, secret_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, secretHash, session.createdAt);

	return session;
}

type Session = {
  id: string
  userId: string
  secretHash:string
  createdAt: number
}

type SessionRow = {
  id: string
  user_id: string
  secret_hash:string
  created_at: number
}

type SessionWithToken = Session & {
  token:string
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  secretHash: row.secret_hash,
  createdAt: row.created_at
});

const sessionExpiresInSeconds = 60 * 60 * 24;

export function getSession(sessionId: string): Session | null {
	const now = new Date();

  const result = db
    .query<SessionRow, [string]>("SELECT id, user_id, secret_hash, created_at FROM sessions WHERE id = ?")
    .get(sessionId)

	if (!result) {
		return null;
	}

	const session: Session = {
		id: result.id,
    userId: result.user_id,
		secretHash: result.secret_hash,
		createdAt: result.created_at
	};

	// Check expiration
	if (Math.floor(now.getTime() / 1000) - session.createdAt >= sessionExpiresInSeconds) {
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
	const sessionId = tokenParts[0];
	const sessionSecret = tokenParts[1];

	const session = getSession(sessionId);
	if (!session) {
		return null;
	}

	const validSecret = Bun.password.verifySync(sessionSecret, session.secretHash);
	// const validSecret = constantTimeEqual(tokenSecretHash, session.secretHash);
	if (!validSecret) {
		return null;
	}

	return session;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) {
		return false;
	}
	let c = 0;
	for (let i = 0; i < a.byteLength; i++) {
		c |= a[i] ^ b[i];
	}
	return c === 0;
}

export function checkEmailPassword(email: string, password: string): User | null {
  const row = db
    .query<UserRow, [string]>("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email);
  if (!row) return null;

	const validPassword = Bun.password.verifySync(password, row.password_hash);
	if (!validPassword) {
		return null;
	}

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}
