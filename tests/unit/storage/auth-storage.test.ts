import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@/lib/storage/auth-storage";

describe("auth storage adapter", () => {
  test("stores, reads and removes values through one small contract", async () => {
    const storage = createMemoryStorage();

    await storage.setItem("session", "opaque-session");
    expect(await storage.getItem("session")).toBe("opaque-session");

    await storage.removeItem("session");
    expect(await storage.getItem("session")).toBeNull();
  });
});
