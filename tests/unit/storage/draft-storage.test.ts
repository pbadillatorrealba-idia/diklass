import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@/lib/storage/auth-storage";
import { createDraftStorage, draftStorageKey } from "@/lib/storage/drafts";

describe("draft storage", () => {
  test("isolates a draft by veterinarian and consultation", async () => {
    const drafts = createDraftStorage(createMemoryStorage());
    const aliceDraft = { notes: "Paciente estable", updatedAt: "2026-09-09T12:00:00.000Z" };
    const bobDraft = { notes: "Revisar laboratorio", updatedAt: "2026-09-09T12:01:00.000Z" };

    await drafts.save("vet-alice", "consultation-1", aliceDraft);
    await drafts.save("vet-bob", "consultation-1", bobDraft);

    expect(await drafts.load("vet-alice", "consultation-1")).toEqual(aliceDraft);
    expect(await drafts.load("vet-bob", "consultation-1")).toEqual(bobDraft);
    expect(draftStorageKey("vet-alice", "consultation-1")).not.toBe(
      draftStorageKey("vet-bob", "consultation-1"),
    );
  });
});
