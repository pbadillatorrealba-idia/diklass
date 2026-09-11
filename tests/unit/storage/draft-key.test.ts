import { describe, expect, test } from "bun:test";
import type { AuthStorage } from "@/lib/storage/auth-storage";
import { createDraftStorage, draftStorageKey } from "@/lib/storage/drafts";

// expo-secure-store's isValidKey (packages/expo-secure-store/src/SecureStore.ts).
const SECURE_STORE_KEY = /^[\w.-]+$/;

/** In-memory storage that rejects keys exactly as SecureStore does on iOS and Android. */
function secureStoreLikeStorage(): AuthStorage {
  const values = new Map<string, string>();
  const ensureValidKey = (key: string) => {
    if (!SECURE_STORE_KEY.test(key)) {
      throw new Error("Invalid key provided to SecureStore.");
    }
  };
  return {
    getItem: async (key) => {
      ensureValidKey(key);
      return values.get(key) ?? null;
    },
    setItem: async (key, value) => {
      ensureValidKey(key);
      values.set(key, value);
    },
    removeItem: async (key) => {
      ensureValidKey(key);
      values.delete(key);
    },
  };
}

const VET = "a2a2a2a2-0000-0000-0000-0000000000a2";
const CONSULTATION = "d2d2d2d2-0000-0000-0000-0000000000d1";

describe("draft storage on native (review #4, finding 8)", () => {
  test("a draft key is a valid SecureStore key", () => {
    expect(draftStorageKey(VET, CONSULTATION)).toMatch(SECURE_STORE_KEY);
  });

  test("a route param with unsafe characters still yields a valid key", () => {
    expect(draftStorageKey(VET, "consulta:1/../x")).toMatch(SECURE_STORE_KEY);
  });

  test("a draft round-trips through SecureStore-like storage", async () => {
    const drafts = createDraftStorage(secureStoreLikeStorage());
    const draft = { notes: "Paciente estable", updatedAt: "2026-09-11T12:00:00.000Z" };

    await drafts.save(VET, CONSULTATION, draft);
    expect(await drafts.load(VET, CONSULTATION)).toEqual(draft);

    await drafts.remove(VET, CONSULTATION);
    expect(await drafts.load(VET, CONSULTATION)).toBeNull();
  });
});
