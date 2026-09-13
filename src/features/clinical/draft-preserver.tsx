import { useEffect, useMemo } from "react";
import { type ConsultationDraft, createDraftStorage } from "@/lib/storage/drafts";
import { createPlatformAuthStorage } from "@/lib/storage/platform-auth-storage";

type DraftPreserverProps = {
  veterinarianId: string | null;
  consultationId: string;
  draft: ConsultationDraft;
  isSessionActive: boolean;
  children?: React.ReactNode;
};

const DRAFT_DEBOUNCE_MS = 500;

export function useDraftPreserver({
  veterinarianId,
  consultationId,
  draft,
  isSessionActive,
}: Omit<DraftPreserverProps, "children">) {
  const storage = useMemo(() => createDraftStorage(createPlatformAuthStorage()), []);

  useEffect(() => {
    if (!veterinarianId || !isSessionActive) {
      return;
    }

    const timeout = setTimeout(() => {
      void storage.save(veterinarianId, consultationId, draft);
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [consultationId, draft, isSessionActive, storage, veterinarianId]);

  return storage;
}

export function DraftPreserver({ children, ...props }: DraftPreserverProps) {
  useDraftPreserver(props);
  return children ?? null;
}
