import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  emptyFichaFormValues,
  type FichaField,
  FichaForm,
  type FichaFormValues,
  parseFichaValues,
} from "@/components/registro/ficha-form";
import { OptionPicker } from "@/components/registro/option-picker";
import {
  emptyTutorValues,
  parseTutorValues,
  TutorForm,
  type TutorFormValues,
} from "@/components/registro/tutor-form";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlError, FormControlErrorText } from "@/components/ui/form-control";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { invalidateRegistro } from "@/features/registro/query-cache";
import type { PatientContent, TutorContent } from "@/features/registro/schema";
import { findTutorByRut } from "@/features/registro/tutor-search";
import { listTutors } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { formatRut } from "@/lib/rut";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

const EMPTY_ANTECEDENTES: PatientContent["antecedentes"] = {
  medicalHistory: [],
  preexistingDiseases: [],
  currentMedications: [],
  knownAllergies: [],
  behavioralHistory: [],
};

const TUTOR_MODE_OPTIONS: { value: "existing" | "new"; label: string }[] = [
  { value: "existing", label: "Tutor existente" },
  { value: "new", label: "Nuevo tutor" },
];

export default function NewPatientScreen() {
  const router = useRouter();
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const guard = useClinicalGuard();
  const [fichaValues, setFichaValues] = useState<FichaFormValues>(emptyFichaFormValues);
  const [fichaErrors, setFichaErrors] = useState<Record<string, string>>({});
  const [tutorMode, setTutorMode] = useState<"existing" | "new">("existing");
  const [selectedTutorId, setSelectedTutorId] = useState("");
  const [tutorValues, setTutorValues] = useState<TutorFormValues>(emptyTutorValues);
  const [tutorErrors, setTutorErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();
  const tutorsQuery = useQuery({
    queryKey: ["registro", "tutors"],
    queryFn: () => listTutors(supabase),
  });

  const queryError = tutorsQuery.error;
  useEffect(() => {
    if (!queryError) {
      return;
    }
    if (isAuthenticationRequired(queryError)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, {
      error: queryError,
      operation: "list_tutors",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const handleSubmit = async () => {
    if (!clinicId) {
      return;
    }
    let tutor: { existingTutorId: string } | { newTutor: TutorContent } | null = null;
    let nextTutorErrors: Record<string, string> = {};
    if (tutorMode === "existing") {
      if (selectedTutorId === "") {
        nextTutorErrors = { tutor: "Selecciona un tutor existente o registra uno nuevo." };
      } else {
        tutor = { existingTutorId: selectedTutorId };
      }
    } else {
      const parsed = parseTutorValues(tutorValues);
      const sameRut = parsed.value ? await findTutorByRut(supabase, parsed.value.rut) : null;
      if (parsed.value && sameRut) {
        nextTutorErrors = { rut: `Ya hay un tutor con este RUT: ${sameRut.fullName}.` };
      } else if (parsed.value) {
        tutor = { newTutor: parsed.value };
      } else {
        nextTutorErrors = parsed.errors;
      }
    }
    const ficha = parseFichaValues(fichaValues, EMPTY_ANTECEDENTES);
    setFichaErrors(ficha.errors);
    setTutorErrors(nextTutorErrors);
    const fichaValue = ficha.value;
    const tutorChoice = tutor;
    if (!fichaValue || !tutorChoice) {
      setStatus("Revisa los campos marcados antes de continuar.");
      return;
    }
    setIsSaving(true);
    const outcome = await guard("create_patient", async () => {
      const result = await createPatientFicha(supabase, {
        clinicId,
        ficha: fichaValue,
        tutor: tutorChoice,
      });
      await invalidateRegistro(queryClient);
      setStatus("Paciente registrado.");
      router.push(`/patients/${result.record.id}`);
    });
    setIsSaving(false);
    if (outcome === "expired") {
      setStatus("La sesión ya no es válida. Regístrate de nuevo para continuar.");
    } else if (outcome === "error") {
      setStatus("No pudimos registrar el paciente. Vuelve a intentarlo.");
    }
  };

  return (
    <Screen title="Registrar paciente" back={{ href: "/patients", label: "Pacientes" }}>
      <Text tone="muted">
        Los campos opcionales pueden quedar sin dato: el sistema los señala sin inventar valores ni
        confundirlos con hallazgos negativos.
      </Text>
      <FichaForm
        errors={fichaErrors}
        isDisabled={isSaving}
        onChange={(field: FichaField, text: string) =>
          setFichaValues((prev) => ({ ...prev, [field]: text }))
        }
        values={fichaValues}
      />
      <OptionPicker
        label="Tutor responsable"
        onChange={setTutorMode}
        options={TUTOR_MODE_OPTIONS}
        testID="tutor-mode"
        value={tutorMode}
      />
      {tutorMode === "existing" ? (
        <VStack className="w-full gap-3">
          {tutorsQuery.isLoading ? <Text testID="tutors-loading">Cargando tutores…</Text> : null}
          {(tutorsQuery.data ?? []).length === 0 && tutorsQuery.isSuccess ? (
            <Text testID="tutors-empty">Aún no hay tutores registrados: registra uno nuevo.</Text>
          ) : (
            <OptionPicker
              label="Tutor existente"
              onChange={setSelectedTutorId}
              options={(tutorsQuery.data ?? []).map((entry) => ({
                value: entry.record.id,
                label: `${entry.content.name} — ${formatRut(entry.content.rut)}`,
              }))}
              testID="tutor-picker"
              value={selectedTutorId}
            />
          )}
          {tutorErrors.tutor ? (
            <FormControl isInvalid>
              <FormControlError>
                <FormControlErrorText>{tutorErrors.tutor}</FormControlErrorText>
              </FormControlError>
            </FormControl>
          ) : null}
        </VStack>
      ) : (
        <TutorForm
          errors={tutorErrors}
          isDisabled={isSaving}
          onChange={(field, text) => setTutorValues((prev) => ({ ...prev, [field]: text }))}
          values={tutorValues}
        />
      )}
      {status ? (
        <Text accessibilityLiveRegion="polite" testID="patient-new-status">
          {status}
        </Text>
      ) : null}
      <Button
        accessibilityLabel="Registrar paciente"
        isDisabled={isSaving}
        onPress={() => void handleSubmit()}
        testID="patient-submit"
      >
        <ButtonText>{isSaving ? "Registrando…" : "Registrar paciente"}</ButtonText>
      </Button>
    </Screen>
  );
}
