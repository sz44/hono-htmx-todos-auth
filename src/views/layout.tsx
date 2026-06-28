import { html } from "hono/html";

export const Layout = (props: { children: any }) => html`
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
