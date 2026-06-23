To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

The app uses Bun's built-in SQLite driver. On startup it creates `todos.db`
from `schema.sql` if needed, then stores todos there instead of in memory.
