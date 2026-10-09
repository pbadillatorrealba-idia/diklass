import { type ReactNode, useState } from "react";
import { View } from "react-native";
import {
  type FichaField,
  FichaForm,
  type FichaFormValues,
  fichaValuesFromContent,
} from "@/components/registro/ficha-form";
import { MISSING_FIELD_LABELS } from "@/components/registro/labels";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { PatientContent } from "@/features/registro/schema";
import { computeMissingFichaFields } from "@/features/registro/summaries";

/**
 * Edad legible: calculada desde la fecha de nacimiento y, sin ella, desde los meses registrados.
 * `null` si no hay ninguno de los dos datos.
 */
export function ageLabel(
  birthDate: string | null,
  ageMonths: number | null,
  now: Date = new Date(),
): string | null {
  let months = ageMonths;
  if (birthDate) {
    const [year, month, day] = birthDate.split("-").map(Number);
    if (year && month && day) {
      months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
      if (now.getDate() < day) months -= 1;
    }
  }
  if (months === null || months < 0) return null;
  if (months < 1) return "Menos de 1 mes";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 0 ? "" : `${years} ${years === 1 ? "año" : "años"}`;
  const m = rest === 0 ? "" : `${rest} ${rest === 1 ? "mes" : "meses"}`;
  return [y, m].filter(Boolean).join(" ");
}

/** Dato destacado de la cabecera: valor grande en la mono de datos y su rótulo debajo. */
function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="w-1/2 gap-1 lg:w-1/4">
      {value === null ? (
        <Text tone="muted">Sin dato</Text>
      ) : (
        <Text selectable variant="data">
          {value}
        </Text>
      )}
      <Text variant="rubric">{label}</Text>
    </View>
  );
}

export type PatientHeaderProps = {
  content: PatientContent;
  /** Última consulta (ISO) o `null`; viene del historial. */
  lastVisitAt: string | null;
  consultationCount: number;
};

/** Identidad del animal y sus datos principales en bloques. */
export function PatientHeader({ content, lastVisitAt, consultationCount }: PatientHeaderProps) {
  const missing = computeMissingFichaFields(content)
    .filter((item) => item.kind === "sin_dato")
    .map((item) => MISSING_FIELD_LABELS[item.field] ?? item.field);
  return (
    <VStack className="gap-4">
      <View className="flex-row flex-wrap gap-y-4">
        <Stat label="Especie" value={content.species} />
        <Stat label="Raza" value={content.breed} />
        <Stat label="Sexo" value={content.sex} />
        <Stat label="Estado reproductivo" value={content.reproductiveStatus} />
        <Stat label="Edad" value={ageLabel(content.birthDate, content.ageMonths)} />
        <Stat label="Peso" value={content.weightKg === null ? null : `${content.weightKg} kg`} />
        <Stat label="Nacimiento" value={content.birthDate} />
        <Stat label="Expediente" value={content.fileNumber || null} />
        <Stat label="1ª visita" value={content.firstVisitDate ?? null} />
        <Stat
          label="Última visita"
          value={lastVisitAt ? new Date(lastVisitAt).toLocaleDateString("es-CL") : null}
        />
        <Stat label="Consultas" value={String(consultationCount)} />
      </View>
      {/* Un campo sin dato no es un hallazgo negativo (FR-044): lo negativo solo cuenta si se registró. */}
      {missing.length > 0 ? (
        <Text testID="patient-missing" tone="warning">
          {missing.length === 1 ? "1 dato sin completar" : `${missing.length} datos sin completar`}:{" "}
          {missing.join(", ")}.
        </Text>
      ) : null}
    </VStack>
  );
}

/** Campos editables de cada card; la cabecera concentra la identidad y las medidas. */
export const HEADER_FIELDS: FichaField[] = [
  "name",
  "species",
  "breed",
  "sex",
  "reproductiveStatus",
  "birthDate",
  "ageMonths",
  "weightKg",
  "fileNumber",
  "firstVisitDate",
];
export const ORIGIN_FIELDS: FichaField[] = [
  "origin",
  "adoptionAge",
  "adoptionState",
  "neuterAge",
  "litterInfo",
];
export const REFERRER_FIELDS: FichaField[] = [
  "referrerRefers",
  "referrerName",
  "referrerCenter",
  "referrerPhone",
  "referrerInsurance",
  "referrerOpinion",
];

const REFIERE = { si: "Sí", no: "No", sin: null } as const;

function Dato({ value }: { value: string | null | undefined }) {
  return value ? (
    <Text selectable variant="data">
      {value}
    </Text>
  ) : (
    <Text tone="muted">Sin dato</Text>
  );
}

export function OriginFields({ content }: { content: PatientContent }) {
  return (
    <VStack className="w-full">
      <Field label="Procedencia">
        <Dato value={content.origin} />
      </Field>
      <Field label="Edad con que fue adoptado">
        <Dato value={content.adoptionAge} />
      </Field>
      <Field label="Estado en la adopción">
        <Dato value={content.adoptionState} />
      </Field>
      <Field label="Edad de gonadectomía">
        <Dato value={content.neuterAge} />
      </Field>
      <Field label="Progenitores / camada">
        <Dato value={content.litterInfo} />
      </Field>
    </VStack>
  );
}

export function ReferrerFields({ content }: { content: PatientContent }) {
  const referrer = content.referrer;
  return (
    <VStack className="w-full">
      <Field label="Refiere el caso">
        <Dato value={REFIERE[referrer?.refers ?? "sin"]} />
      </Field>
      <Field label="Veterinario derivante">
        <Dato value={referrer?.name} />
      </Field>
      <Field label="Centro veterinario">
        <Dato value={referrer?.center} />
      </Field>
      <Field label="Teléfono del derivante">
        <Dato value={referrer?.phone} />
      </Field>
      <Field label="Seguro veterinario">
        <Dato value={referrer?.insurance} />
      </Field>
      <Field label="Opinión del derivante">
        <Dato value={referrer?.opinion} />
      </Field>
    </VStack>
  );
}

export type EditableCardProps = {
  /** Título de la card (en la cabecera, el nombre del paciente). */
  title: string;
  /** Nombre de la sección para los textos accesibles de sus botones; por defecto, el título. */
  label?: string;
  testID: string;
  editTestID: string;
  content: PatientContent;
  fields: FichaField[];
  isBusy: boolean;
  /** Guarda solo estos campos; devuelve los errores por campo, o `null` si quedó guardado. */
  onSave: (values: Partial<FichaFormValues>) => Promise<Record<string, string> | null>;
  /** Lectura de la card. */
  children: ReactNode;
};

/**
 * Card de la ficha con edición propia: «Editar» abre solo los campos de esta card, y al guardar
 * se fusionan con la ficha vigente, de modo que editar una card no pisa a otra.
 */
export function EditableCard({
  title,
  label = title,
  testID,
  editTestID,
  content,
  fields,
  isBusy,
  onSave,
  children,
}: EditableCardProps) {
  const [values, setValues] = useState<FichaFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    if (!values) return;
    const picked = Object.fromEntries(fields.map((field) => [field, values[field]]));
    const result = await onSave(picked);
    setErrors(result ?? {});
    if (result === null) setValues(null);
  };

  return (
    <Card className="gap-4" testID={testID}>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Heading level={2}>{title}</Heading>
        {values === null ? (
          <View className="flex-row flex-wrap gap-3">
            <Button
              accessibilityLabel={`Editar ${label.toLowerCase()}`}
              isDisabled={isBusy}
              onPress={() => {
                setErrors({});
                setValues(fichaValuesFromContent(content));
              }}
              testID={editTestID}
              variant="outline"
            >
              <ButtonText>Editar</ButtonText>
            </Button>
          </View>
        ) : null}
      </View>
      {values ? (
        <VStack className="w-full gap-4">
          <FichaForm
            errors={errors}
            fields={fields}
            isDisabled={isBusy}
            onChange={(field, text) =>
              setValues((prev) => (prev === null ? prev : { ...prev, [field]: text }))
            }
            values={values}
          />
          <View className="flex-row flex-wrap gap-3">
            <Button
              accessibilityLabel={`Guardar ${label.toLowerCase()}`}
              isDisabled={isBusy}
              onPress={() => void save()}
              testID={`${editTestID}-save`}
            >
              <ButtonText>Guardar</ButtonText>
            </Button>
            <Button
              accessibilityLabel="Cancelar la edición"
              onPress={() => setValues(null)}
              testID={`${editTestID}-cancel`}
              variant="outline"
            >
              <ButtonText>Cancelar</ButtonText>
            </Button>
          </View>
        </VStack>
      ) : (
        children
      )}
    </Card>
  );
}
