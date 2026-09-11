import { describe, expect, test } from "bun:test";
import type { AuthStorage } from "@/lib/storage/auth-storage";
import { createMemoryStorage } from "@/lib/storage/auth-storage";
import { createDraftSession } from "@/lib/storage/drafts";

const draft = (notes: string) => ({ notes, updatedAt: "2026-09-11T12:00:00.000Z" });

/** Wraps an in-memory AuthStorage so the next `setItem` can be made to fail on demand. */
function createFlakyStorage(): { storage: AuthStorage; failNextWrite: () => void } {
  const values = new Map<string, string>();
  let failNext = false;
  return {
    storage: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("simulated write failure");
        }
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    },
    failNextWrite: () => {
      failNext = true;
    },
  };
}

describe("draft lifecycle (FR-061, SC-047, data-model borrador)", () => {
  test("restores a draft preserved before the session expired", async () => {
    const storage = createMemoryStorage();
    const first = createDraftSession(storage, "vet-ana", "consultation-1");
    first.edit(draft("Antecedente sin guardar"));
    await first.flush();

    const afterReauthentication = createDraftSession(storage, "vet-ana", "consultation-1");
    expect(await afterReauthentication.restore()).toEqual(draft("Antecedente sin guardar"));
  });

  test("flushing on expiry keeps the latest edit instead of dropping it", async () => {
    const storage = createMemoryStorage();
    const session = createDraftSession(storage, "vet-ana", "consultation-1");
    session.edit(draft("primera versión"));
    session.edit(draft("última versión antes de expirar"));
    await session.flush();
    expect(await createDraftSession(storage, "vet-ana", "consultation-1").restore()).toEqual(
      draft("última versión antes de expirar"),
    );
  });

  test("a successful save discards the preserved draft", async () => {
    const storage = createMemoryStorage();
    const session = createDraftSession(storage, "vet-ana", "consultation-1");
    session.edit(draft("contenido"));
    await session.flush();
    await session.markSaved();
    expect(await session.restore()).toBeNull();
  });

  test("a draft never leaks to another veterinarian", async () => {
    const storage = createMemoryStorage();
    const ana = createDraftSession(storage, "vet-ana", "consultation-1");
    ana.edit(draft("solo de Ana"));
    await ana.flush();
    expect(await createDraftSession(storage, "vet-bruno", "consultation-1").restore()).toBeNull();
  });

  // Review #4 follow-up: a failed SecureStore write must not silently drop the draft.
  test("a failed write leaves the pending draft intact and rethrows", async () => {
    const { storage, failNextWrite } = createFlakyStorage();
    const session = createDraftSession(storage, "vet-ana", "consultation-1");
    session.edit(draft("no se pudo guardar"));

    failNextWrite();
    await expect(session.flush()).rejects.toThrow("simulated write failure");

    // The failed write must not have cleared the in-memory draft: a retry can save it.
    await session.flush();
    expect(await session.restore()).toEqual(draft("no se pudo guardar"));
  });

  test("a failed write followed by a newer edit keeps the newer draft, not the stale one", async () => {
    const { storage, failNextWrite } = createFlakyStorage();
    const session = createDraftSession(storage, "vet-ana", "consultation-1");
    session.edit(draft("versión que falla"));

    failNextWrite();
    const failedFlush = session.flush();
    // A newer edit lands while the failed write is still in flight.
    session.edit(draft("versión más reciente"));
    await expect(failedFlush).rejects.toThrow("simulated write failure");

    await session.flush();
    expect(await session.restore()).toEqual(draft("versión más reciente"));
  });

  test("a successful write still clears the pending draft as before", async () => {
    const storage = createMemoryStorage();
    const session = createDraftSession(storage, "vet-ana", "consultation-1");
    session.edit(draft("contenido"));
    await session.flush();

    // A second flush with nothing pending must not re-save the already-flushed draft.
    await session.flush();
    expect(await session.restore()).toEqual(draft("contenido"));
  });
});
