import type { Session, Todo } from "../db";
import { Layout } from "./layout";

type TodoProps = {
  todo: Todo;
};

type TodoListProps = {
  todos: Todo[];
};

export const TodoItem = ({ todo }: TodoProps) => (
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
      hx-delete={`/todos/${todo.id}`}
      hx-target={`#todo-${todo.id}`}
      hx-swap="delete"
      class="text-red-500 text-sm"
    >
      Delete
    </button>
  </li>
);

export const TodoListItems = ({ todos }: TodoListProps) => (
  <>
    {todos.map((todo) => (
      <TodoItem todo={todo} />
    ))}
  </>
);

export const TodoAppPage = ({ session, todos }: { session: Session; todos: Todo[] }) => (
  <Layout>
    <h1 class="text-2xl font-bold mb-4">My Todos</h1>
    <h2>user: {session.userEmail}</h2>
    <button hx-post="/signout">sign out</button>
    <form
      hx-post="/todo"
      hx-target="#todo-list"
      hx-swap="beforeend"
      hx-on-htmx-after-request="if(event.detail.successful) this.reset()"
    >
      <input name="todo" class="border p-2" placeholder="New todo..." maxLength="500" required />
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
      <TodoListItems todos={todos} />
    </ul>
  </Layout>
);
