// The Edge Runtime entry point. The logic is in handler.ts, which tests run outside Deno.
import { createHandler, readConfig } from "./handler.ts";

Deno.serve(
  createHandler(
    readConfig((name) => Deno.env.get(name)),
    {
      fetch: (input, init) => fetch(input, init),
      randomUUID: () => crypto.randomUUID(),
      log: (message) => {
        console.error(message);
      },
    },
  ),
);
