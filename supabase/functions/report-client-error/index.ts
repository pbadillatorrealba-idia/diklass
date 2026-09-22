import { createClient } from "@supabase/supabase-js";
import { CLIENT_ERROR_REPORTS_PER_MINUTE, handleClientErrorReport } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

// The Edge runtime provides both variables. The service role only touches the quota counter,
// never clinical data.
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve((request) =>
  handleClientErrorReport(request, {
    // Never persist request bodies, auth headers, tokens, or clinical content.
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    consumeQuota: async (bucketKey) => {
      const { data, error } = await admin.rpc("consume_client_error_quota", {
        p_bucket_key: bucketKey,
        p_limit: CLIENT_ERROR_REPORTS_PER_MINUTE,
      });
      if (error) {
        throw new Error(error.message);
      }
      return data === true;
    },
  }),
);
