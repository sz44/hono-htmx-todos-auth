import { Hono } from "hono";
import { html } from "hono/html";

const app = new Hono();

type Todo = {
  id: number;
  text: string;
  isDone: boolean;
};
type TodoProps = {
  todo: Todo;
};

// In-memory "database"
let todos = [
  { id: 1, text: "Learn Hono", isDone: false },
  { id: 2, text: "Learn HTMX", isDone: true },
];

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
      <ul id="todo-list" class="mb-4">
        {todos.map((todo) => (
          <TodoItem todo={todo} />
        ))}
      </ul>
    </Layout>,
  ),
);


app.delete("/delete/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  todos = todos.filter((t) => t.id !== id);

  // Returning an empty body tells HTMX to proceed with the swap="delete"
  return c.body(null, 200);
});

app.patch("/todos/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  const todo = todos.find((t) => t.id === id);

  if (!todo) {
    return c.notFound();
  }

  todo.isDone = body["isDone"] === "true";

  return c.html(TodoItem({ todo }));
});

// HTMX Endpoint for adding a todo
app.post("/add", async (c) => {
  const body = await c.req.parseBody();
  const text = body["todo"] as string;
  const newTodo = { id: Date.now(), text, isDone: false };
  todos.push(newTodo);

  // Return only the new fragment to be swapped into the list
  return c.html(TodoItem({ todo: newTodo }));
});

export default app;
