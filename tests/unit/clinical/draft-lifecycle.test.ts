import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@/lib/storage/auth-storage";
import { createDraftSession } from "@/lib/storage/drafts";

const draft = (notes: string) => ({ notes, updatedAt: "2026-09-11T12:00:00.000Z" });

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
});
