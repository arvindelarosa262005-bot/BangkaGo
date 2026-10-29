import { readFile, writeFile } from "node:fs/promises";
// Initial migration only: after deployment create a new migration instead.
await writeFile(
  "supabase/migrations/20261027114451_bangkago_core.sql",
  (await readFile("supabase/schema.sql", "utf8")) +
    "\n" +
    (await readFile("supabase/operations.sql", "utf8")),
);
