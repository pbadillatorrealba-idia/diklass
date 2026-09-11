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
import { flushDraft, useDraftPreserver } from "@/features/clinical/draft-preserver";
import { createClinicalRecord } from "@/lib/attribution/clinical-mutations";
import type { Attribution } from "@/lib/attribution/types";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import type { ConsultationDraft } from "@/lib/storage/drafts";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

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

  // Resolves to whether the draft actually made it to storage, so callers can tell the
  // user the truth instead of always claiming it was kept (review #4 follow-up).
  const preserveCurrentNotes = async (): Promise<boolean> => {
    if (!draftSession) {
      return true;
    }
    draftSession.edit({ notes, updatedAt: new Date().toISOString() });
    return flushDraft(draftSession);
  };

  const handleSave = async () => {
    if (!draftSession || !clinicId) {
      return;
    }
    // Save blocking after expiry: nothing enters the history without a valid identity.
    if (accessState !== "active") {
      const preserved = await preserveCurrentNotes();
      openExpiredDialog();
      setStatus(
        preserved
          ? "La sesión ya no es válida. El borrador se conservó."
          : "La sesión ya no es válida. No pudimos guardar el borrador: no cierres esta pantalla.",
      );
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
      try {
        await draftSession.markSaved();
      } catch (error) {
        // The record is already saved; only clearing the local draft cache failed.
        // Distinct label from "save_anamnesis" so the two are not conflated in logs.
        void captureClientError(errorReporter, { error, operation: "clear_draft", requestId });
      }
      setSavedAttribution(result.attribution);
      setStatus("Anamnesis guardada.");
    } catch (error) {
      const preserved = await preserveCurrentNotes();
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
        setStatus(
          preserved
            ? "La sesión ya no es válida. El borrador se conservó."
            : "La sesión ya no es válida. No pudimos guardar el borrador: no cierres esta pantalla.",
        );
      } else {
        void captureClientError(errorReporter, { error, operation: "save_anamnesis", requestId });
        setStatus(
          preserved
            ? "No pudimos guardar. El borrador se conservó."
            : "No pudimos guardar. Tampoco pudimos guardar el borrador: no cierres esta pantalla.",
        );
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
