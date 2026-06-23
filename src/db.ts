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

db.exec(await Bun.file("schema.sql").text());

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
