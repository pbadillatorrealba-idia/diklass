import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import {
  emptyFichaFormValues,
  type FichaField,
  FichaForm,
  type FichaFormValues,
  parseFichaValues,
} from "@/components/registro/ficha-form";
import { OptionPicker } from "@/components/registro/option-picker";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { invalidateRegistro } from "@/features/registro/query-cache";
import {
  type PatientContent,
  type TutorContent,
  tutorContentSchema,
} from "@/features/registro/schema";
import { listTutors } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { getFieldErrors } from "@/lib/forms/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
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

type TutorValues = { name: string; phone: string; email: string };

const TUTOR_FIELDS: { field: keyof TutorValues; label: string; testID: string }[] = [
  { field: "name", label: "Nombre del tutor", testID: "tutor-name" },
  { field: "phone", label: "Teléfono del tutor", testID: "tutor-phone" },
  { field: "email", label: "Correo del tutor", testID: "tutor-email" },
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
  const [tutorValues, setTutorValues] = useState<TutorValues>({ name: "", phone: "", email: "" });
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
      const parsed = tutorContentSchema.safeParse(tutorValues);
      if (parsed.success) {
        tutor = { newTutor: parsed.data };
      } else {
        nextTutorErrors = getFieldErrors(parsed.error);
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
    <Screen>
      <Head>
        <title>Registrar paciente · Diklass</title>
      </Head>
      <Heading level={1}>Registrar paciente</Heading>
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
                label: `${entry.content.name} — ${entry.content.phone ?? entry.content.email ?? "sin medio de contacto"}`,
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
        <VStack className="w-full gap-4">
          {TUTOR_FIELDS.map(({ field, label, testID }) => {
            const error = tutorErrors[field];
            return (
              <FormControl isInvalid={Boolean(error)} key={field}>
                <FormControlLabel>
                  <FormControlLabelText>{label}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    accessibilityLabel={label}
                    aria-label={label}
                    autoCapitalize="none"
                    editable={!isSaving}
                    keyboardType={field === "email" ? "email-address" : "default"}
                    onChangeText={(text) => setTutorValues((prev) => ({ ...prev, [field]: text }))}
                    testID={testID}
                    value={tutorValues[field]}
                  />
                </Input>
                {error ? (
                  <FormControlError>
                    <FormControlErrorText>{error}</FormControlErrorText>
                  </FormControlError>
                ) : null}
              </FormControl>
            );
          })}
          {tutorErrors.form ? (
            <FormControl isInvalid>
              <FormControlError>
                <FormControlErrorText>{tutorErrors.form}</FormControlErrorText>
              </FormControlError>
            </FormControl>
          ) : null}
        </VStack>
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
