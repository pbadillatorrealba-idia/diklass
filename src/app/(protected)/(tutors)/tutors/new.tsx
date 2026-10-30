import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  emptyTutorValues,
  parseTutorValues,
  TutorForm,
  type TutorFormValues,
} from "@/components/registro/tutor-form";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { LinkText } from "@/components/ui/link-text";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { invalidateRegistro } from "@/features/registro/query-cache";
import {
  findDuplicateTutors,
  findTutorByRut,
  type TutorRow,
} from "@/features/registro/tutor-search";
import { createTutor } from "@/features/registro/tutor-service";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

/** Alta de un tutor (FR-121) con aviso, sin bloqueo, de posible duplicado (FR-122). */
export default function NewTutorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clinicId = useSessionStore((state) => state.clinicId);
  const guard = useClinicalGuard();
  const [values, setValues] = useState<TutorFormValues>(emptyTutorValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<TutorRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // `isSaving` llega en el siguiente render: esta guarda frena un doble toque inmediato.
  const submitting = useRef(false);

  const handleChange = (field: keyof TutorFormValues, text: string) => {
    setValues((prev) => ({ ...prev, [field]: text }));
    // El aviso era sobre este teléfono o correo: si cambian, ya no vale.
    if (field === "phone" || field === "email") setDuplicates([]);
  };

  const handleSubmit = async () => {
    if (!clinicId || submitting.current) {
      return;
    }
    const parsed = parseTutorValues(values);
    setErrors(parsed.errors ?? {});
    if (!parsed.value) {
      setStatus("Revisa los campos marcados antes de continuar.");
      return;
    }
    const tutor = parsed.value;
    submitting.current = true;
    setIsSaving(true);
    // El RUT es único por clínica: un repetido bloquea (el teléfono o correo, no).
    const sameRut = await findTutorByRut(supabase, tutor.rut);
    if (sameRut) {
      setErrors({ rut: `Ya hay un tutor con este RUT: ${sameRut.fullName}.` });
      setStatus("Revisa los campos marcados antes de continuar.");
      setIsSaving(false);
      submitting.current = false;
      return;
    }
    // Con un aviso ya mostrado, este envío es la confirmación: no se vuelve a buscar.
    if (duplicates.length === 0) {
      const found = await findDuplicateTutors(supabase, tutor);
      if (found.length > 0) {
        setDuplicates(found);
        setStatus(null);
        setIsSaving(false);
        submitting.current = false;
        return;
      }
    }
    const outcome = await guard("create_tutor", async () => {
      const result = await createTutor(supabase, { clinicId, tutor });
      await invalidateRegistro(queryClient);
      // `replace`: volver atrás no debe reabrir el formulario con lo ya enviado.
      router.replace(`/tutors/${result.record.id}`);
    });
    setIsSaving(false);
    submitting.current = false;
    if (outcome === "expired") {
      setStatus("La sesión ya no es válida. Regístrate de nuevo para continuar.");
    } else if (outcome === "error") {
      setStatus("No pudimos registrar el tutor. Vuelve a intentarlo.");
    }
  };

  return (
    <Screen back={{ href: "/tutors", label: "Tutores" }} title="Registrar tutor">
      <TutorForm errors={errors} isDisabled={isSaving} onChange={handleChange} values={values} />
      {duplicates.length > 0 ? (
        <Callout
          testID="tutor-duplicate"
          title="Ya existe un tutor con este contacto"
          tone="warning"
        >
          <VStack className="gap-2">
            {duplicates.map((tutor) => (
              <Link asChild href={`/tutors/${tutor.id}`} key={tutor.id}>
                <LinkText testID="tutor-duplicate-link">{tutor.fullName}</LinkText>
              </Link>
            ))}
            <Text>Si es otra persona, puedes registrarla igualmente.</Text>
          </VStack>
        </Callout>
      ) : null}
      {status ? (
        <Callout testID="tutor-new-status" tone="error">
          {status}
        </Callout>
      ) : null}
      <Button
        accessibilityLabel="Registrar tutor"
        isDisabled={isSaving}
        onPress={() => void handleSubmit()}
        testID="tutor-submit"
      >
        <ButtonText>
          {isSaving
            ? "Registrando…"
            : duplicates.length > 0
              ? "Registrar de todos modos"
              : "Registrar tutor"}
        </ButtonText>
      </Button>
    </Screen>
  );
}
