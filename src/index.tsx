import { Hono } from "hono";
import { html } from "hono/html";
import { createTodo, deleteTodo, getTodos, type Todo, updateTodoDone } from "./db";

const app = new Hono();

type TodoProps = {
  todo: Todo;
};
type TodoListProps = {
  todos: Todo[];
};

const TodoItem = ({ todo }: TodoProps) => (
  <li id={`todo-${todo.id}`} class="flex gap-2 mb-2 items-center">
    <input
      type="checkbox"
      name="isDone"
      value="true"
      checked={todo.isDone}
      hx-patch={`/todos/${todo.id}`}
      hx-trigger="change"
      hx-target="closest li"
      hx-swap="outerHTML"
    />
    <span class={`${todo.isDone ? "line-through" : ""}`}>{todo.text}</span>
    <button
      hx-delete={`/delete/${todo.id}`}
      hx-target={`#todo-${todo.id}`}
      hx-swap="delete"
      class="text-red-500 text-sm"
    >
      Delete
    </button>
  </li>
);

const TodoListItems = ({ todos }: TodoListProps) => (
  <>
    {todos.map((todo) => (
      <TodoItem todo={todo} />
    ))}
  </>
);

// Layout Component
const Layout = (props: { children: any }) => html`
  <!DOCTYPE html>
  <html>
    <head>
      <title>Hono + HTMX Todo</title>
      <script src="https://unpkg.com/htmx.org@2.0.1"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="p-8">
      ${props.children}
    </body>
  </html>
`;

// Initial Page Load
app.get("/", (c) =>
  c.html(
    <Layout>
      <h1 class="text-2xl font-bold mb-4"> My Todos </h1>
      <form
        hx-post="/add"
        hx-target="#todo-list"
        hx-swap="beforeend"
        hx-on-htmx-after-request="if(event.detail.successful) this.reset()"
      >
        <input name="todo" class="border p-2" placeholder="New todo..." required />
        <button type="submit" class="bg-blue-500 text-white p-2">
          Add
        </button>
      </form>
      <div>
        <button
          class="bg-blue-500 text-white p-2 mx-0"
          hx-get="/todos"
          hx-target="#todo-list"
          hx-swap="innerHTML"
        >
          All
        </button>
        <button
          class="bg-blue-500 text-white p-2 mx-1"
          hx-get="/todos?filter=done"
          hx-target="#todo-list"
          hx-swap="innerHTML"
        >
          Done
        </button>
        <button
          class="bg-blue-500 text-white p-2 mx-0"
          hx-get="/todos?filter=undone"
          hx-target="#todo-list"
          hx-swap="innerHTML"
        >
          Undone
        </button>
      </div>
      <ul id="todo-list" class="mb-4">
        <TodoListItems todos={getTodos()} />
      </ul>
    </Layout>,
  ),
);

app.get("/todos", (c) => {
  const filter = c.req.query("filter");

  return c.html(<TodoListItems todos={getTodos(filter)} />);
});

app.delete("/delete/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  deleteTodo(id);

  // Returning an empty body tells HTMX to proceed with the swap="delete"
  return c.body(null, 200);
});

app.patch("/todos/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  const todo = updateTodoDone(id, body["isDone"] === "true");

  if (!todo) {
    return c.notFound();
  }

  return c.html(TodoItem({ todo }));
});

// HTMX Endpoint for adding a todo
app.post("/add", async (c) => {
  const body = await c.req.parseBody();
  const text = body["todo"] as string;
  const newTodo = createTodo(text);

  // Return only the new fragment to be swapped into the list
  return c.html(TodoItem({ todo: newTodo }));
});

export default app;
