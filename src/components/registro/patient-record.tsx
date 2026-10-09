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

/** Dato destacado de la cabecera: rótulo arriba y valor en la mono de datos debajo. */
export function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="w-full gap-1 sm:w-1/2 lg:w-1/4">
      <Text tone="muted" variant="label">
        {label}
      </Text>
      {value === null ? (
        <Text tone="muted">Sin dato</Text>
      ) : (
        <Text selectable variant="data">
          {value}
        </Text>
      )}
    </View>
  );
}

/** Grupo de datos con subtítulo: una columna en móvil, dos en tablet y cuatro en escritorio. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack className="gap-3 border-border border-t pt-4">
      <Text variant="rubric">{title}</Text>
      <View className="flex-row flex-wrap gap-y-4">{children}</View>
    </VStack>
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
      <Heading level={3}>Resumen</Heading>
      <Group title="Identidad">
        <Stat label="Especie" value={content.species} />
        <Stat label="Raza" value={content.breed} />
        <Stat label="Sexo" value={content.sex} />
        <Stat label="Estado reproductivo" value={content.reproductiveStatus} />
      </Group>
      <Group title="Edad y medidas">
        <Stat label="Edad" value={ageLabel(content.birthDate, content.ageMonths)} />
        <Stat label="Nacimiento" value={content.birthDate} />
        <Stat label="Peso" value={content.weightKg === null ? null : `${content.weightKg} kg`} />
      </Group>
      <Group title="Seguimiento">
        <Stat label="Expediente" value={content.fileNumber || null} />
        <Stat label="1ª visita" value={content.firstVisitDate ?? null} />
        <Stat
          label="Última visita"
          value={lastVisitAt ? new Date(lastVisitAt).toLocaleDateString("es-CL") : null}
        />
        <Stat label="Consultas" value={String(consultationCount)} />
      </Group>
      {/* Un campo sin dato no es un hallazgo negativo (FR-044): lo negativo solo cuenta si se registró. */}
      {missing.length > 0 ? (
        <Group title="Alertas">
          <Text testID="patient-missing" tone="warning">
            {missing.length === 1
              ? "1 dato sin completar"
              : `${missing.length} datos sin completar`}
            : {missing.join(", ")}.
          </Text>
        </Group>
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

export function OriginFields({ content }: { content: PatientContent }) {
  return (
    <View className="w-full flex-row flex-wrap gap-y-4">
      <Stat label="Procedencia" value={content.origin ?? null} />
      <Stat label="Edad con que fue adoptado" value={content.adoptionAge ?? null} />
      <Stat label="Estado en la adopción" value={content.adoptionState ?? null} />
      <Stat label="Edad de gonadectomía" value={content.neuterAge ?? null} />
      <Stat label="Progenitores / camada" value={content.litterInfo ?? null} />
    </View>
  );
}

export function ReferrerFields({ content }: { content: PatientContent }) {
  const referrer = content.referrer;
  return (
    <View className="w-full flex-row flex-wrap gap-y-4">
      <Stat label="Refiere el caso" value={REFIERE[referrer?.refers ?? "sin"] ?? null} />
      <Stat label="Veterinario derivante" value={referrer?.name ?? null} />
      <Stat label="Centro veterinario" value={referrer?.center ?? null} />
      <Stat label="Teléfono del derivante" value={referrer?.phone ?? null} />
      <Stat label="Seguro veterinario" value={referrer?.insurance ?? null} />
      <Stat label="Opinión del derivante" value={referrer?.opinion ?? null} />
    </View>
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
