import { describe, expect, test } from "bun:test";
import { AuthErrorCode, normalizeAuthError } from "@/lib/errors";

describe("normalizeAuthError", () => {
  test("uses the same public code for an invalid password and an unknown account", () => {
    const invalidPassword = normalizeAuthError({
      status: 400,
      message: "Invalid login credentials",
    });
    const unknownAccount = normalizeAuthError({ status: 400, code: "user_not_found" });

    expect(invalidPassword.code).toBe(AuthErrorCode.AuthenticationFailed);
    expect(unknownAccount.code).toBe(AuthErrorCode.AuthenticationFailed);
    expect(invalidPassword.publicMessage).toBe(unknownAccount.publicMessage);
  });

  test("does not expose the provider error or credentials", () => {
    const result = normalizeAuthError({
      status: 500,
      message: "upstream token=secret-password failed for user@example.com",
    });

    expect(result.code).toBe(AuthErrorCode.ServiceUnavailable);
    expect(result.publicMessage).not.toContain("secret-password");
    expect(result.publicMessage).not.toContain("user@example.com");
  });
});
