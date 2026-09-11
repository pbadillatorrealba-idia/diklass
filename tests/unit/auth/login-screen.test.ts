import { describe, expect, test } from "bun:test";
import { loginSchema } from "@/lib/forms/form";

describe("login screen contract", () => {
  test("requires an email and password and does not offer signup", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "vet@example.test", password: "valid" }).success).toBe(
      true,
    );
    expect("signUp" in loginSchema).toBe(false);
  });
});
