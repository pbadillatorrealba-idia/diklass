import type { AuthStorage } from "@/lib/storage/auth-storage";

export type ConsultationDraft = {
  notes: string;
  updatedAt: string;
};

// SecureStore keys may only contain alphanumerics, ".", "-" and "_", and the consultation id
// comes from a route param, so every other character is replaced. Segments never contain
// ".", which keeps the separator unambiguous.
const keySegment = (value: string) => value.replace(/[^\w-]/g, "_");

export function draftStorageKey(veterinarianId: string, consultationId: string): string {
  return `diklass.draft.${keySegment(veterinarianId)}.${keySegment(consultationId)}`;
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

export type DraftSession = {
  /** Records the latest content; persisted by `flush`. */
  edit: (draft: ConsultationDraft) => void;
  /** Persists the pending edit, if any. Called on debounce, on expiry and on unmount. */
  flush: () => Promise<void>;
  restore: () => Promise<ConsultationDraft | null>;
  /** `saved` transition: the content reached the clinical record. */
  markSaved: () => Promise<void>;
};

/**
 * One consultation's draft for one veterinarian, following the data-model cycle
 * `editing → restored → saved`; `discarded` arrives with the explicit consultation close
 * of spec 002, which has no caller yet.
 */
export function createDraftSession(
  storage: AuthStorage,
  veterinarianId: string,
  consultationId: string,
): DraftSession {
  const drafts = createDraftStorage(storage);
  let pending: ConsultationDraft | null = null;

  const clear = async () => {
    pending = null;
    await drafts.remove(veterinarianId, consultationId);
  };

  return {
    edit(draft) {
      pending = draft;
    },
    async flush() {
      if (!pending) {
        return;
      }
      const next = pending;
      pending = null;
      await drafts.save(veterinarianId, consultationId, next);
    },
    restore: () => drafts.load(veterinarianId, consultationId),
    markSaved: clear,
  };
}
