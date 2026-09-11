import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useDraftPreserver } from "@/features/clinical/draft-preserver";
import { createClinicalRecord } from "@/lib/attribution/clinical-mutations";
import type { Attribution } from "@/lib/attribution/types";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import type { ConsultationDraft } from "@/lib/storage/drafts";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * RLS denial (42501) or a rejected JWT (PGRST3xx): the session is no longer valid.
 *
 * A grant refusal also surfaces as 42501 (PostgreSQL: "permission denied for table ..."),
 * but that means the client sent a column the Data API role cannot write — a client bug,
 * not an expired session — so it is excluded here to avoid a false "session expired" dialog.
 */
export function isAuthenticationRequired(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  if (message.startsWith("permission denied for")) {
    return false;
  }
  return code === "42501" || code.startsWith("PGRST3");
}

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultationId = String(id);
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const clinicId = useSessionStore((state) => state.clinicId);
  const accessState = useSessionStore((state) => state.accessState);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<ConsultationDraft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedAttribution, setSavedAttribution] = useState<Attribution | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleRestore = useCallback((restored: ConsultationDraft) => {
    setNotes(restored.notes);
    setStatus("Se recuperó un borrador no guardado.");
  }, []);
  const draftSession = useDraftPreserver({
    veterinarianId,
    consultationId,
    draft,
    isSessionActive: accessState === "active",
    onRestore: handleRestore,
  });

  const handleChange = (text: string) => {
    setNotes(text);
    setDraft({ notes: text, updatedAt: new Date().toISOString() });
  };

  const preserveCurrentNotes = async () => {
    draftSession?.edit({ notes, updatedAt: new Date().toISOString() });
    await draftSession?.flush();
  };

  const handleSave = async () => {
    if (!draftSession || !clinicId) {
      return;
    }
    // Save blocking after expiry: nothing enters the history without a valid identity.
    if (accessState !== "active") {
      await preserveCurrentNotes();
      openExpiredDialog();
      return;
    }

    setIsSaving(true);
    const requestId = makeRequestId();
    try {
      const result = await createClinicalRecord(supabase, {
        clinic_id: clinicId,
        record_type: "anamnesis",
        content: { consultationId, notes },
      });
      await draftSession.markSaved();
      setSavedAttribution(result.attribution);
      setStatus("Anamnesis guardada.");
    } catch (error) {
      await preserveCurrentNotes();
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
        setStatus("La sesión ya no es válida. El borrador se conservó.");
      } else {
        void captureClientError(errorReporter, { error, operation: "save_anamnesis", requestId });
        setStatus("No pudimos guardar. El borrador se conservó.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <Head>
        <title>Consulta · Diklass</title>
      </Head>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="2xl">Consulta</Heading>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Notas de la consulta</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                accessibilityLabel="Notas de la consulta"
                aria-label="Notas de la consulta"
                className="min-h-[160px]"
                multiline
                onChangeText={handleChange}
                testID="consultation-notes"
                textAlignVertical="top"
                value={notes}
              />
            </Input>
          </FormControl>
          {status ? (
            <Text accessibilityLiveRegion="polite" testID="consultation-status">
              {status}
            </Text>
          ) : null}
          <Button
            accessibilityLabel="Guardar anamnesis"
            isDisabled={isSaving || !draftSession}
            onPress={() => void handleSave()}
            testID="consultation-save"
          >
            <ButtonText>{isSaving ? "Guardando…" : "Guardar anamnesis"}</ButtonText>
          </Button>
          {savedAttribution ? <AttributionBadge attribution={savedAttribution} /> : null}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
