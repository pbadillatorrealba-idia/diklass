import { handleClientErrorReport } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

Deno.serve((request) =>
  handleClientErrorReport(request, {
    // Never persist request bodies, auth headers, tokens, or clinical content.
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
  }),
);
