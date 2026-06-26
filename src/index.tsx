import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { html } from "hono/html";
import {
  type Session,
  type Todo,
  addUser,
  checkEmailPassword,
  createSession,
  createTodo,
  deleteSession,
  deleteTodo,
  getTodos,
  updateTodoDone,
  validateSessionToken,
} from "./db";

const app = new Hono();

type TodoProps = {
  todo: Todo;
};

type TodoListProps = {
  todos: Todo[];
};

type Credentials = {
  email: string;
  password: string;
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
      <h1 class="text-2xl font-bold mb-4">Sign In</h1>
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
      <h1 class="text-2xl font-bold mb-4">Sign Up</h1>
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

app.get("/app", (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return c.redirect("/");
  }

  return c.html(
    <Layout>
      <h1 class="text-2xl font-bold mb-4">My Todos</h1>
      <h2>user: {session.userId}</h2>
      <button hx-post="/signout">sign out</button>
      <form
        hx-post="/add"
        hx-target="#todo-list"
        hx-swap="beforeend"
        hx-on-htmx-after-request="if(event.detail.successful) this.reset()"
      >
        <input name="todo" class="border p-2" placeholder="New todo..." maxlength="500" required />
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
        <TodoListItems todos={getTodos(session.userId)} />
      </ul>
    </Layout>,
  );
});

app.get("/todos", (c) => {
  const session = getAuthenticatedSession(c);

  if (!session) {
    return redirectToSignin(c);
  }

  const filter = normalizeTodoFilter(c.req.query("filter"));

  return c.html(<TodoListItems todos={getTodos(session.userId, filter)} />);
});

app.delete("/delete/:id", (c) => {
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

app.patch("/todos/:id", async (c) => {
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

app.post("/signin", async (c) => {
  const credentials = await parseCredentials(c, "signin");

  if (!credentials.ok) {
    return credentials.response;
  }

  const user = checkEmailPassword(credentials.value.email, credentials.value.password);

  if (!user) {
    return c.html("credential error", 401);
  }

  return signInAndRedirect(c, user.id);
});

app.post("/signout", (c) => {
  if (!isHtmxRequest(c)) {
    return c.text("HTMX request required", 400);
  }

  const token = getCookie(c, "session");

  if (token) {
    const [sessionId] = token.split(".");

    if (sessionId) {
      deleteSession(sessionId);
    }
  }

  clearSessionCookie(c);

  c.header("HX-Redirect", "/");
  return c.body(null, 204);
});

app.post("/add", async (c) => {
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

app.post("/auth/signup-email", async (c) => {
  const credentials = await parseCredentials(c, "signup");

  if (!credentials.ok) {
    return credentials.response;
  }

  const user = addUser(credentials.value.email, credentials.value.password);

  if (!user) {
    return c.html("user exists error", 409);
  }

  return signInAndRedirect(c, user.id);
});

function getAuthenticatedSession(c: Context): Session | null {
  const token = getCookie(c, "session");

  if (!token) {
    return null;
  }

  return validateSessionToken(token);
}

function setSessionCookie(c: Context, token: string) {
  setCookie(c, "session", token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

function clearSessionCookie(c: Context) {
  deleteCookie(c, "session", {
    path: "/",
  });
}

function redirectToSignin(c: Context) {
  if (isHtmxRequest(c)) {
    c.header("HX-Redirect", "/");
    return c.body(null, 401);
  }

  return c.redirect("/");
}

function signInAndRedirect(c: Context, userId: string) {
  const session = createSession(userId);
  setSessionCookie(c, session.token);

  if (isHtmxRequest(c)) {
    c.header("HX-Redirect", "/app");
    return c.body(null, 204);
  }

  return c.redirect("/app");
}

async function parseCredentials(
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

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseTodoText(value: FormDataEntryValue | FormDataEntryValue[] | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > 500) {
    return null;
  }

  return text;
}

function parseTodoId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    return null;
  }

  return id;
}

function normalizeTodoFilter(filter?: string): "done" | "undone" | undefined {
  if (filter === "done" || filter === "undone") {
    return filter;
  }

  return undefined;
}

function isHtmxRequest(c: Context) {
  return c.req.header("HX-Request") === "true";
}

export default app;
