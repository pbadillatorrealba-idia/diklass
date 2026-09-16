import { describe, expect, test } from "bun:test";
import { anonymousClient, isLiveSupabase } from "../live-supabase";

const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const functionUrl = `${baseUrl}/functions/v1/report-client-error`;

describe.skipIf(!isLiveSupabase)("report-client-error against local Supabase", () => {
  test("a browser preflight from the web app's origin is allowed", async () => {
    const response = await fetch(functionUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:8083",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization, apikey, content-type, x-client-info, x-request-id",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("the app's reporter reaches the function", async () => {
    const { error } = await anonymousClient().functions.invoke("report-client-error", {
      body: { operation: "sign_in", requestId: "live-test", error: { name: "TypeError" } },
      headers: { "x-request-id": "live-test" },
    });
    expect(error).toBeNull();
  });
});
