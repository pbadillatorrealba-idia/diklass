import { describe, expect, test } from "bun:test";
import { loginSchema } from "@/lib/forms/form";

describe("login credentials validation", () => {
  test("requires an email and password", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "vet@example.test", password: "valid" }).success).toBe(
      true,
    );
  });
});
