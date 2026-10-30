import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const expoRequire = createRequire(require.resolve("@expo/config/package.json"));
type Merge = (target: unknown, source: unknown) => Record<string, unknown>;
const payload = () => JSON.parse('{"__proto__":{"injectedFlag":true}}');

for (const entry of ["deepmerge", "deepmerge/dist/umd.js"]) {
  const merge = expoRequire(entry) as Merge;
  describe(`GHSA-gcqx-w48m-w2h4 · ${entry} usado por Expo`, () => {
    for (const variant of ["null-prototype", "null-placeholder", "target-own-key"]) {
      test(`rechaza __proto__ con ${variant}`, () => {
        const merged =
          variant === "null-prototype"
            ? merge(Object.create(null), payload())
            : variant === "null-placeholder"
              ? merge({ session: null }, { session: payload() }).session
              : merge(payload(), {});
        expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
        expect((merged as Record<string, unknown>).injectedFlag).toBeUndefined();
        expect(Object.hasOwn(merged as object, "__proto__")).toBe(false);
      });
    }

    test("conserva la combinación normal de configuración, arrays, símbolos y placeholders", () => {
      const key = Symbol("config");
      expect(
        merge(
          { extra: { enabled: true }, plugins: ["router"], session: null },
          { extra: { port: 8083 }, plugins: ["audio"], session: { active: true }, [key]: 1 },
        ),
      ).toEqual({
        extra: { enabled: true, port: 8083 },
        plugins: ["router", "audio"],
        session: { active: true },
        [key]: 1,
      });
      const legitimate = Object.assign(Object.create(null), { constructor: "data", prototype: 7 });
      expect(merge(legitimate, {})).toEqual({ constructor: "data", prototype: 7 });
      expect(({} as Record<string, unknown>).injectedFlag).toBeUndefined();
    });
  });
}
