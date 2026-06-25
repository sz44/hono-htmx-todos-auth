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
	const now = new Date();

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
    .run(id, userId, secretHash, Math.floor(session.createdAt.getTime() / 1000));

	return session;
}

type Session = {
  id: string
  userId: string
  secretHash:string
  createdAt: Date
}

type SessionWithToken = Session & {
  token:string
}
