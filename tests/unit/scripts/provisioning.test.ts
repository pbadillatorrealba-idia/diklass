import { describe, expect, test } from "bun:test";
import {
  findUserIdByEmail,
  isLocalSupabaseUrl,
  normalizeEmail,
  parseArgs,
} from "../../../scripts/lib/provisioning";

describe("isLocalSupabaseUrl", () => {
  test.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "%s is local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    },
  );

  test.each(["https://abcd.supabase.co", "http://127.0.0.1.evil.test", "not a url"])(
    "%s is not local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(false);
    },
  );
});

describe("findUserIdByEmail", () => {
  test("matches regardless of case and surrounding spaces", async () => {
    const id = await findUserIdByEmail(
      async () => ({ users: [{ id: "u1", email: "Vet.Ana@Example.test" }] }),
      " vet.ana@example.test ",
      1000,
    );
    expect(id).toBe("u1");
    expect(normalizeEmail(" Vet.Ana@Example.test ")).toBe("vet.ana@example.test");
  });

  test("walks every page until the user appears", async () => {
    const pages = [
      [
        { id: "u1", email: "a@x.test" },
        { id: "u2", email: "b@x.test" },
      ],
      [{ id: "u3", email: "c@x.test" }],
    ];
    const requested: number[] = [];
    const id = await findUserIdByEmail(
      async (page) => {
        requested.push(page);
        return { users: pages[page - 1] ?? [] };
      },
      "c@x.test",
      2,
    );
    expect(id).toBe("u3");
    expect(requested).toEqual([1, 2]);
  });

  test("stops after the last page when the user does not exist", async () => {
    const pages = [
      [
        { id: "u1", email: "a@x.test" },
        { id: "u2", email: "b@x.test" },
      ],
      [{ id: "u3", email: "c@x.test" }],
    ];
    const requested: number[] = [];
    const id = await findUserIdByEmail(
      async (page) => {
        requested.push(page);
        return { users: pages[page - 1] ?? [] };
      },
      "missing@x.test",
      2,
    );
    expect(id).toBeUndefined();
    expect(requested).toEqual([1, 2]);
  });
});

describe("parseArgs", () => {
  test("reads --fixture's value", () => {
    expect(parseArgs(["--fixture", "path.json"])).toEqual({
      fixturePath: "path.json",
      allowRemote: false,
    });
  });

  test("reads --fixture and --allow-remote together", () => {
    expect(parseArgs(["--fixture", "path.json", "--allow-remote"])).toEqual({
      fixturePath: "path.json",
      allowRemote: true,
    });
  });

  test("is order-independent", () => {
    expect(parseArgs(["--allow-remote", "--fixture", "path.json"])).toEqual({
      fixturePath: "path.json",
      allowRemote: true,
    });
  });

  test("throws when --fixture's value looks like another flag, and does not set allowRemote", () => {
    expect(() => parseArgs(["--fixture", "--allow-remote"])).toThrow();
  });

  test("throws when --fixture has no value at all", () => {
    expect(() => parseArgs(["--fixture"])).toThrow();
  });

  test("defaults to the fixture path with no flags", () => {
    expect(parseArgs([])).toEqual({
      fixturePath: "tests/fixtures/veterinarians.json",
      allowRemote: false,
    });
  });

  test("rejects an unknown argument", () => {
    expect(() => parseArgs(["--bogus"])).toThrow();
  });
});
