import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { PatientContent } from "@/features/registro/schema";

export type FichaSummaryProps = {
  content: PatientContent;
  /** Tutor enlazado y su medio de contacto; `null` si la ficha no tiene uno legible. */
  tutor: { name: string; contact: string } | null;
};

const REFIERE = { si: "Sí", no: "No", sin: null } as const;

/** Valor de un dato: en la mono de datos (D20), o «Sin dato» si falta. */
function Dato({ value }: { value: string | number | null }) {
  return value === null ? (
    <Text tone="muted">Sin dato</Text>
  ) : (
    <Text selectable variant="data">
      {String(value)}
    </Text>
  );
}

/**
 * Ficha del paciente como formulario (sistema-visual D20): rótulo preimpreso y dato, con fechas,
 * edad y peso en la mono. No hay procedencia en el modelo de la ficha, así que no hay marca.
 */
export function FichaSummary({ content, tutor }: FichaSummaryProps) {
  return (
    <VStack className="w-full">
      <Field label="Nombre">{content.name}</Field>
      <Field label="Especie">{content.species}</Field>
      <Field label="Raza">{content.breed}</Field>
      <Field label="Fecha de nacimiento">
        <Dato value={content.birthDate} />
      </Field>
      <Field label="Edad (meses)">
        <Dato value={content.ageMonths} />
      </Field>
      <Field label="Peso (kg)">
        <Dato value={content.weightKg} />
      </Field>
      <Field label="Sexo">{content.sex}</Field>
      <Field label="Estado reproductivo">{content.reproductiveStatus}</Field>
      <Field label="Número de expediente">
        <Dato value={content.fileNumber ?? null} />
      </Field>
      <Field label="Fecha de la 1ª visita">
        <Dato value={content.firstVisitDate ?? null} />
      </Field>
      <Field label="Procedencia">
        <Dato value={content.origin ?? null} />
      </Field>
      <Field label="Edad con que fue adoptado">
        <Dato value={content.adoptionAge ?? null} />
      </Field>
      <Field label="Estado en la adopción">
        <Dato value={content.adoptionState ?? null} />
      </Field>
      <Field label="Edad de gonadectomía">
        <Dato value={content.neuterAge ?? null} />
      </Field>
      <Field label="Progenitores / camada">
        <Dato value={content.litterInfo ?? null} />
      </Field>
      <Field label="Refiere el caso">
        <Dato value={REFIERE[content.referrer?.refers ?? "sin"]} />
      </Field>
      <Field label="Veterinario derivante">
        <Dato value={content.referrer?.name ?? null} />
      </Field>
      <Field label="Centro veterinario">
        <Dato value={content.referrer?.center ?? null} />
      </Field>
      <Field label="Teléfono del derivante">
        <Dato value={content.referrer?.phone ?? null} />
      </Field>
      <Field label="Seguro veterinario">
        <Dato value={content.referrer?.insurance ?? null} />
      </Field>
      <Field label="Opinión del derivante">
        <Dato value={content.referrer?.opinion ?? null} />
      </Field>
      <Field label="Tutor">
        {tutor ? `${tutor.name} — ${tutor.contact}` : <Text tone="muted">Sin tutor asociado</Text>}
      </Field>
    </VStack>
  );
}
