import { expect, test } from "bun:test";
import { isUuid } from "@/lib/uuid";

test("isUuid acepta UUID y rechaza lo demás", () => {
  expect(isUuid("e1500000-0000-4000-8000-000000000001")).toBe(true);
  expect(isUuid("x")).toBe(false);
  expect(isUuid("")).toBe(false);
  expect(isUuid(undefined)).toBe(false);
});
