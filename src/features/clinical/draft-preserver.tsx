import { useEffect, useMemo, useRef, useState } from "react";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import {
  type ConsultationDraft,
  createDraftSession,
  type DraftSession,
} from "@/lib/storage/drafts";
import { createPlatformAuthStorage } from "@/lib/storage/platform-auth-storage";
import { errorReporter } from "@/lib/supabase/client";

type DraftPreserverOptions = {
  veterinarianId: string | null;
  consultationId: string;
  draft: ConsultationDraft | null;
  isSessionActive: boolean;
  onRestore: (draft: ConsultationDraft) => void;
};

const DRAFT_DEBOUNCE_MS = 500;

// A failed write must not become an unhandled rejection: report it (Constitution IV).
function flushDraft(session: DraftSession) {
  session.flush().catch((error: unknown) => {
    void captureClientError(errorReporter, {
      error,
      operation: "save_draft",
      requestId: makeRequestId(),
    });
  });
}

export function useDraftPreserver({
  veterinarianId,
  consultationId,
  draft,
  isSessionActive,
  onRestore,
}: DraftPreserverOptions): DraftSession | null {
  const session = useMemo(
    () =>
      veterinarianId
        ? createDraftSession(createPlatformAuthStorage(), veterinarianId, consultationId)
        : null,
    [consultationId, veterinarianId],
  );
  const [isRestored, setIsRestored] = useState(false);
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  });

  // restored: bring back what an expired session left behind, before any new write.
  useEffect(() => {
    setIsRestored(false);
    if (!session) {
      return;
    }
    let cancelled = false;
    session
      .restore()
      .then((restored) => {
        if (!cancelled && restored) {
          onRestoreRef.current(restored);
        }
      })
      .catch((error: unknown) => {
        void captureClientError(errorReporter, {
          error,
          operation: "restore_draft",
          requestId: makeRequestId(),
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestored(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // editing: debounced writes, never before the restore finished, or the empty initial
  // state would overwrite the preserved draft.
  useEffect(() => {
    if (!session || !isRestored || !draft) {
      return;
    }
    session.edit(draft);
    const timeout = setTimeout(() => flushDraft(session), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draft, isRestored, session]);

  // Expiry must keep the latest edit instead of dropping the pending debounce (FR-061).
  useEffect(() => {
    if (session && !isSessionActive) {
      flushDraft(session);
    }
  }, [isSessionActive, session]);

  // Leaving the screen (reauthentication navigates away) flushes as well.
  useEffect(
    () => () => {
      if (session) {
        flushDraft(session);
      }
    },
    [session],
  );

  return session;
}
