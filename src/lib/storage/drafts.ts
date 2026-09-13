import type { AuthStorage } from "@/lib/storage/auth-storage";

export type ConsultationDraft = {
  notes: string;
  updatedAt: string;
};

export function draftStorageKey(veterinarianId: string, consultationId: string): string {
  return `diklass:draft:${veterinarianId}:${consultationId}`;
}

export function createDraftStorage(storage: AuthStorage) {
  return {
    async save(veterinarianId: string, consultationId: string, draft: ConsultationDraft) {
      await storage.setItem(draftStorageKey(veterinarianId, consultationId), JSON.stringify(draft));
    },
    async load(veterinarianId: string, consultationId: string): Promise<ConsultationDraft | null> {
      const raw = await storage.getItem(draftStorageKey(veterinarianId, consultationId));
      if (!raw) {
        return null;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof (parsed as Record<string, unknown>).notes === "string" &&
          typeof (parsed as Record<string, unknown>).updatedAt === "string"
        ) {
          return parsed as ConsultationDraft;
        }
      } catch {
        return null;
      }

      return null;
    },
    async remove(veterinarianId: string, consultationId: string) {
      await storage.removeItem(draftStorageKey(veterinarianId, consultationId));
    },
  };
}
