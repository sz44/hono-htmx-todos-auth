import { Hono } from "hono";
import { createTodo, deleteTodo, getTodos, updateTodoDone } from "../db";
import { getAuthenticatedSession, redirectToSignin } from "../lib/auth";
import { isHtmxRequest } from "../lib/htmx";
import { normalizeTodoFilter, parseTodoId, parseTodoText } from "../lib/validation";
import { TodoAppPage, TodoItem, TodoListItems } from "../views/todos";

export const todoRoutes = new Hono();

todoRoutes.get("/app", (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return c.redirect("/");
  }

  return c.html(<TodoAppPage session={session} todos={getTodos(session.userId)} />);
});

todoRoutes.get("/todos", (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return redirectToSignin(c);
  }

  const filter = normalizeTodoFilter(c.req.query("filter"));

  return c.html(<TodoListItems todos={getTodos(session.userId, filter)} />);
});

todoRoutes.post("/todo", async (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return redirectToSignin(c);
  }

  if (!isHtmxRequest(c)) {
    return c.text("HTMX request required", 400);
  }

  const body = await c.req.parseBody();
  const text = parseTodoText(body["todo"]);

  if (!text) {
    return c.text("Todo text is required", 400);
  }

  const newTodo = createTodo(session.userId, text);

  return c.html(TodoItem({ todo: newTodo }));
});

todoRoutes.delete("/todos/:id", (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return redirectToSignin(c);
  }

  if (!isHtmxRequest(c)) {
    return c.text("HTMX request required", 400);
  }

  const id = parseTodoId(c.req.param("id"));

  if (id === null) {
    return c.text("Invalid todo id", 400);
  }

  deleteTodo(session.userId, id);

  return c.body(null, 200);
});

todoRoutes.patch("/todos/:id", async (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return redirectToSignin(c);
  }

  if (!isHtmxRequest(c)) {
    return c.text("HTMX request required", 400);
  }

  const id = parseTodoId(c.req.param("id"));

  if (id === null) {
    return c.text("Invalid todo id", 400);
  }

  const body = await c.req.parseBody();
  const todo = updateTodoDone(session.userId, id, body["isDone"] === "true");

  if (!todo) {
    return c.notFound();
  }

  return c.html(TodoItem({ todo }));
});
