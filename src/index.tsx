import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { html } from "hono/html";
import {
  type Todo,
  createSession,
  addUser,
  createTodo,
  deleteTodo,
  findUserByEmail,
  getTodos,
  updateTodoDone,
  getSession,
  deleteSession,
  validateSessionToken,
  checkEmailPassword,
} from "./db";

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
      id={`todo-checkbox-${todo.id}`}
      type="checkbox"
      name="isDone"
      value="true"
      checked={todo.isDone}
      hx-patch={`/todos/${todo.id}`}
      hx-trigger="change"
      hx-target="closest li"
      hx-swap="outerHTML"
    />
    <label for={`todo-checkbox-${todo.id}`} class={`${todo.isDone ? "line-through" : ""}`}>
      {todo.text}
    </label>
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

app.get("/", (c) =>
  c.html(
    <Layout>
      <h1 class="text-2xl font-bold mb-4"> Sign In </h1>
      <form hx-post="/signin">
        <input type="email" name="email" class="border p-2" placeholder="email" required />
        <input type="password" name="password" class="border p-2" placeholder="password" required />
        <button type="submit" class="bg-blue-500 text-white p-2">
          continue
        </button>
      </form>
      <div>
        <span>
          no account? <a href="/signup-email">sign up</a>
        </span>
      </div>
    </Layout>,
  ),
);

app.get("/signup-email", (c) =>
  c.html(
    <Layout>
      <h1 class="text-2xl font-bold mb-4"> Sign Up </h1>
      <form hx-post="/auth/signup-email">
        <input type="email" name="email" class="border p-2" placeholder="email" required />
        <input type="password" name="password" class="border p-2" placeholder="password" required />
        <button type="submit" class="bg-blue-500 text-white p-2">
          continue
        </button>
      </form>
      <div>
        <span>
          have an account? <a href="/">sign in</a>
        </span>
      </div>
    </Layout>,
  ),
);
// Initial Page Load
app.get("/app", (c) => {

  const token = getCookie(c, "session");
  if (!token) {
    return c.redirect("/");
  }
  const session = validateSessionToken(token);
  if (!session) return c.redirect("/");

  return c.html(
    <Layout>
      <h1 class="text-2xl font-bold mb-4"> My Todos </h1>
      <h2>user: {session.userId}</h2>
      <button hx-post="/signout">sign out</button>
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
        <button class="bg-blue-500 text-white p-2 mx-0" hx-get="/todos" hx-target="#todo-list" hx-swap="innerHTML">
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
  );
});

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

const signinEmail = async (c: Context) => {
  const body = await c.req.parseBody();
  const email = body["email"];
  const password = body["password"];

  if (typeof email !== "string" || typeof password !== "string") {
    return c.html("invalid signin details", 400);
  }

  const user = checkEmailPassword(email, password);
  if (!user) return c.html("credential error", 409);

  const session = await createSession(user.id);

  setCookie(c, "session", session.token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });

  if (c.req.header("HX-Request")) {
    c.header("HX-Redirect", "/app");
    return c.body(null, 204);
  }

  return c.redirect("/app");
};

app.post("/signin", signinEmail);

app.post("/signout", (c) => {
  const token = getCookie(c, "session");

  if (token) {
    const [sessionId] = token.split(".");
    if (sessionId) {
      deleteSession(sessionId);
    }
  }

  deleteCookie(c, "session", {
    path: "/",
  });

  if (c.req.header("HX-Request")) {
    c.header("HX-Redirect", "/");
    return c.body(null, 204);
  }

  return c.redirect("/");
});

// HTMX Endpoint for adding a todo
app.post("/add", async (c) => {
  const body = await c.req.parseBody();
  const text = body["todo"] as string;
  const newTodo = createTodo(text);

  // Return only the new fragment to be swapped into the list
  return c.html(TodoItem({ todo: newTodo }));
});

const signupEmail = async (c: Context) => {
  const body = await c.req.parseBody();
  const email = body["email"];
  const password = body["password"];

  if (typeof email !== "string" || typeof password !== "string") {
    return c.html("invalid signup details", 400);
  }

  const user = createUser(email, password);
  if (user.id === "") return c.html("user exists error", 409);

  const session = await createSession(user.id);

  setCookie(c, "session", session.token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });

  if (c.req.header("HX-Request")) {
    c.header("HX-Redirect", "/app");
    return c.body(null, 204);
  }

  return c.redirect("/app");
};

app.post("/auth/signup-email", signupEmail);
app.post("/auth/sighup-email", signupEmail);

// console.log(findUserByEmail("a@gmail.com"));

function createUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (user) {
    return { id: "", email: "" };
  }

  const res = addUser(email, password);
  return res;
}


export default app;
