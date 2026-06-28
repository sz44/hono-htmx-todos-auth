import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { todoRoutes } from "./routes/todos";

const app = new Hono();

app.route("/", authRoutes);
app.route("/", todoRoutes);

export default app;
