import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@/lib/storage/auth-storage";
import { createDraftStorage, draftStorageKey } from "@/lib/storage/drafts";

describe("draft preserver contract", () => {
  test("keeps a draft available for reauthentication without inserting it in a record", async () => {
    const storage = createDraftStorage(createMemoryStorage());
    const draft = { notes: "Borrador no guardado", updatedAt: "2026-09-10T12:00:00.000Z" };

    await storage.save("vet-ana", "consultation-1", draft);
    expect(await storage.load("vet-ana", "consultation-1")).toEqual(draft);
    expect(draftStorageKey("vet-ana", "consultation-1")).toContain("vet-ana");
  });
});
