import { describe, expect, test } from "bun:test";
import { isAuthenticationRequired } from "@/lib/errors";

describe("isAuthenticationRequired", () => {
  test("a grant refusal is a client bug, not an expired session", () => {
    expect(
      isAuthenticationRequired({
        code: "42501",
        message: "permission denied for table clinical_records",
      }),
    ).toBe(false);
  });

  test("an RLS refusal means the session is no longer valid", () => {
    expect(
      isAuthenticationRequired({
        code: "42501",
        message: 'new row violates row-level security policy for table "clinical_records"',
      }),
    ).toBe(true);
  });

  test("our own RPC's AUTHENTICATION_REQUIRED means the session is no longer valid", () => {
    expect(
      isAuthenticationRequired({
        code: "42501",
        message: "AUTHENTICATION_REQUIRED",
      }),
    ).toBe(true);
  });

  test("a rejected JWT (PGRST3xx) means the session is no longer valid", () => {
    expect(isAuthenticationRequired({ code: "PGRST301" })).toBe(true);
  });

  // Defensive shapes: the predicate must be total and never throw. Each assertion below
  // records what the current implementation actually returns for that shape.
  test("null does not throw and is not treated as an expired session", () => {
    expect(isAuthenticationRequired(null)).toBe(false);
  });

  test("undefined does not throw and is not treated as an expired session", () => {
    expect(isAuthenticationRequired(undefined)).toBe(false);
  });

  test("a plain Error (no Supabase/PostgREST code) is not treated as an expired session", () => {
    expect(isAuthenticationRequired(new Error("boom"))).toBe(false);
  });

  test("an object with no code is not treated as an expired session", () => {
    expect(isAuthenticationRequired({ message: "something went wrong" })).toBe(false);
  });

  test("an object whose message is not a string is coerced, not thrown on", () => {
    // message is stringified before the "permission denied for" check, so a non-string
    // message never matches it and the 42501 code alone decides the outcome.
    expect(isAuthenticationRequired({ code: "42501", message: 12345 })).toBe(true);
  });
});
