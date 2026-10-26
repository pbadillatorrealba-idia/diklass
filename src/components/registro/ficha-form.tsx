import { Fragment } from "react";
import { z } from "zod";
import { OptionPicker } from "@/components/registro/option-picker";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { VStack } from "@/components/ui/vstack";
import { REPRODUCTIVE_OPTIONS, SEX_OPTIONS, SPECIES_OPTIONS } from "@/features/registro/catalogs";
import { type PatientContent, patientContentSchema } from "@/features/registro/schema";
import { getFieldErrors } from "@/lib/forms/errors";

export type FichaFormValues = {
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  ageMonths: string;
  weightKg: string;
  sex: string;
  reproductiveStatus: string;
  fileNumber: string;
  firstVisitDate: string;
  origin: string;
  adoptionAge: string;
  adoptionState: string;
  neuterAge: string;
  litterInfo: string;
  /** `""` = sin dato; no se confunde con «no refiere» (FR-044). */
  referrerRefers: "" | "si" | "no";
  referrerName: string;
  referrerCenter: string;
  referrerPhone: string;
  referrerInsurance: string;
  referrerOpinion: string;
};

export type FichaField = keyof FichaFormValues;

export const emptyFichaFormValues: FichaFormValues = {
  name: "",
  species: "",
  breed: "",
  birthDate: "",
  ageMonths: "",
  weightKg: "",
  sex: "",
  reproductiveStatus: "",
  fileNumber: "",
  firstVisitDate: "",
  origin: "",
  adoptionAge: "",
  adoptionState: "",
  neuterAge: "",
  litterInfo: "",
  referrerRefers: "",
  referrerName: "",
  referrerCenter: "",
  referrerPhone: "",
  referrerInsurance: "",
  referrerOpinion: "",
};

/** Contenido guardado → valores del formulario (edición de la ficha). */
export function fichaValuesFromContent(content: PatientContent): FichaFormValues {
  const referrer = content.referrer ?? null;
  return {
    name: content.name,
    species: content.species,
    breed: content.breed,
    birthDate: content.birthDate ?? "",
    ageMonths: content.ageMonths === null ? "" : String(content.ageMonths),
    weightKg: content.weightKg === null ? "" : String(content.weightKg),
    sex: content.sex,
    reproductiveStatus: content.reproductiveStatus,
    fileNumber: content.fileNumber ?? "",
    firstVisitDate: content.firstVisitDate ?? "",
    origin: content.origin ?? "",
    adoptionAge: content.adoptionAge ?? "",
    adoptionState: content.adoptionState ?? "",
    neuterAge: content.neuterAge ?? "",
    litterInfo: content.litterInfo ?? "",
    referrerRefers: referrer?.refers ?? "",
    referrerName: referrer?.name ?? "",
    referrerCenter: referrer?.center ?? "",
    referrerPhone: referrer?.phone ?? "",
    referrerInsurance: referrer?.insurance ?? "",
    referrerOpinion: referrer?.opinion ?? "",
  };
}

export const FICHA_FORM_FIELDS: {
  field: FichaField;
  label: string;
  keyboardType?: "numeric";
}[] = [
  { field: "name", label: "Nombre" },
  { field: "breed", label: "Raza" },
  { field: "birthDate", label: "Fecha de nacimiento (AAAA-MM-DD)" },
  { field: "ageMonths", label: "Edad (meses)", keyboardType: "numeric" },
  { field: "weightKg", label: "Peso (kg)", keyboardType: "numeric" },
  { field: "fileNumber", label: "Número de expediente" },
  { field: "firstVisitDate", label: "Fecha de la 1ª visita (AAAA-MM-DD)" },
  { field: "origin", label: "Procedencia" },
  { field: "adoptionAge", label: "Edad con que fue adoptado" },
  { field: "adoptionState", label: "Estado en el momento de la adopción" },
  { field: "neuterAge", label: "Edad de gonadectomía" },
  { field: "litterInfo", label: "Progenitores / camada" },
];

/** Bloque «Datos del veterinario» de la hoja; `referrerRefers` va aparte (grupo Sí/No). */
export const REFERRER_FORM_FIELDS: { field: FichaField; label: string }[] = [
  { field: "referrerName", label: "Veterinario derivante: nombre completo" },
  { field: "referrerCenter", label: "Veterinario derivante: centro" },
  { field: "referrerPhone", label: "Veterinario derivante: teléfono" },
  { field: "referrerInsurance", label: "Dispone de seguro veterinario" },
  { field: "referrerOpinion", label: "Opinión del veterinario sobre el problema" },
];

/** Vocabularios cerrados (catálogos): grupo de opciones en vez de texto libre. */
export const CATALOG_FIELDS: {
  field: FichaField;
  /** Se pinta justo antes de este campo, para conservar el orden de la hoja. */
  before: FichaField;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  { field: "species", before: "breed", label: "Especie", options: SPECIES_OPTIONS },
  { field: "sex", before: "fileNumber", label: "Sexo", options: SEX_OPTIONS },
  {
    field: "reproductiveStatus",
    before: "fileNumber",
    label: "Estado reproductivo",
    options: REPRODUCTIVE_OPTIONS,
  },
];

const REFERS_OPTIONS = [
  { value: "", label: "Sin dato" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
] as const;

const TEST_ID_BY_FIELD: Record<FichaField, string> = {
  name: "patient-name",
  species: "patient-species",
  breed: "patient-breed",
  birthDate: "patient-birth-date",
  ageMonths: "patient-age-months",
  weightKg: "patient-weight-kg",
  sex: "patient-sex",
  reproductiveStatus: "patient-reproductive-status",
  fileNumber: "patient-file-number",
  firstVisitDate: "patient-first-visit-date",
  origin: "patient-origin",
  adoptionAge: "patient-adoption-age",
  adoptionState: "patient-adoption-state",
  neuterAge: "patient-neuter-age",
  litterInfo: "patient-litter-info",
  referrerRefers: "patient-referrer-refers",
  referrerName: "patient-referrer-name",
  referrerCenter: "patient-referrer-center",
  referrerPhone: "patient-referrer-phone",
  referrerInsurance: "patient-referrer-insurance",
  referrerOpinion: "patient-referrer-opinion",
};

// Primer paso de validación: los textos del formulario con mensajes en español. Los
// opcionales de FR-044 aceptan vacío y se convierten después en `null`, sin inventar datos.
const optionalIsoDateTextSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Registra la fecha en formato ISO (AAAA-MM-DD).",
  );

const optionalIntegerSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d+$/.test(value),
    "Registra la edad en meses (número entero).",
  );

const optionalDecimalSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d+([.,]\d+)?$/.test(value),
    "Registra el peso en kilogramos (número, sin unidades).",
  );

const fichaFormSchema = z.object({
  name: z.string().trim().min(1, "Este campo es obligatorio."),
  species: z.string().trim().min(1, "Este campo es obligatorio."),
  breed: z.string().trim().min(1, "Este campo es obligatorio."),
  birthDate: optionalIsoDateTextSchema,
  ageMonths: optionalIntegerSchema,
  weightKg: optionalDecimalSchema,
  sex: z.string().trim().min(1, "Este campo es obligatorio."),
  reproductiveStatus: z.string().trim().min(1, "Este campo es obligatorio."),
  fileNumber: z.string().trim(),
  firstVisitDate: optionalIsoDateTextSchema,
  origin: z.string().trim(),
  adoptionAge: z.string().trim(),
  adoptionState: z.string().trim(),
  neuterAge: z.string().trim(),
  litterInfo: z.string().trim(),
  referrerRefers: z.enum(["", "si", "no"]),
  referrerName: z.string().trim(),
  referrerCenter: z.string().trim(),
  referrerPhone: z.string().trim(),
  referrerInsurance: z.string().trim(),
  referrerOpinion: z.string().trim(),
});

const fichaContentSchema = patientContentSchema.omit({ tutorId: true });

/**
 * Valores del formulario → `Omit<PatientContent, "tutorId">` validado por el contrato de
 * contenido (D2). Después de los textos del formulario pasa el esquema completo, que es
 * quien rechaza fechas fuera de calendario y magnitudes con signo imposible.
 */
export function parseFichaValues(
  values: FichaFormValues,
  antecedentes: PatientContent["antecedentes"],
): { value: Omit<PatientContent, "tutorId"> | null; errors: Record<string, string> } {
  const formResult = fichaFormSchema.safeParse(values);
  if (!formResult.success) {
    return { value: null, errors: getFieldErrors(formResult.error) };
  }
  const clean = formResult.data;
  const contentResult = fichaContentSchema.safeParse({
    name: clean.name,
    species: clean.species,
    breed: clean.breed,
    birthDate: clean.birthDate === "" ? null : clean.birthDate,
    ageMonths: clean.ageMonths === "" ? null : Number(clean.ageMonths),
    weightKg: clean.weightKg === "" ? null : Number(clean.weightKg.replace(",", ".")),
    sex: clean.sex,
    reproductiveStatus: clean.reproductiveStatus,
    antecedentes,
    fileNumber: clean.fileNumber,
    firstVisitDate: clean.firstVisitDate === "" ? null : clean.firstVisitDate,
    origin: clean.origin,
    adoptionAge: clean.adoptionAge,
    adoptionState: clean.adoptionState,
    neuterAge: clean.neuterAge,
    litterInfo: clean.litterInfo,
    // Sin ningún dato del bloque, el derivante queda «sin dato» (null), no un objeto vacío.
    referrer: [
      clean.referrerRefers,
      clean.referrerName,
      clean.referrerCenter,
      clean.referrerPhone,
      clean.referrerInsurance,
      clean.referrerOpinion,
    ].some((value) => value !== "")
      ? {
          refers: clean.referrerRefers === "" ? null : clean.referrerRefers,
          name: clean.referrerName,
          center: clean.referrerCenter,
          phone: clean.referrerPhone,
          insurance: clean.referrerInsurance,
          opinion: clean.referrerOpinion,
        }
      : null,
  });
  if (!contentResult.success) {
    return { value: null, errors: getFieldErrors(contentResult.error) };
  }
  return { value: contentResult.data, errors: {} };
}

type FichaFormProps = {
  values: FichaFormValues;
  errors: Record<string, string>;
  isDisabled?: boolean;
  onChange: (field: FichaField, text: string) => void;
  /** Subconjunto de campos a pintar (edición por card); sin él, la ficha completa. */
  fields?: FichaField[];
};

/** Campos de FR-001 con etiqueta programática y error por campo (WCAG 2.2 AA 3.3.1). */
export function FichaForm({
  values,
  errors,
  isDisabled = false,
  onChange,
  fields,
}: FichaFormProps) {
  const shows = (field: FichaField) => !fields || fields.includes(field);
  const renderField = ({
    field,
    label,
    keyboardType,
  }: {
    field: FichaField;
    label: string;
    keyboardType?: "numeric";
  }) => {
    const error = errors[field];
    return (
      <FormControl isInvalid={Boolean(error)} key={field}>
        <FormControlLabel>
          <FormControlLabelText>{label}</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel={label}
            aria-label={label}
            editable={!isDisabled}
            keyboardType={keyboardType}
            onChangeText={(text) => onChange(field, text)}
            testID={TEST_ID_BY_FIELD[field]}
            value={values[field]}
          />
        </Input>
        {error ? (
          <FormControlError>
            <FormControlErrorText>{error}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>
    );
  };

  const renderCatalogField = ({ field, label, options }: (typeof CATALOG_FIELDS)[number]) => (
    <FormControl isInvalid={Boolean(errors[field])} key={field}>
      <OptionPicker
        isDisabled={isDisabled}
        label={label}
        onChange={(value) => onChange(field, value)}
        options={options}
        testID={TEST_ID_BY_FIELD[field]}
        value={values[field]}
      />
      {errors[field] ? (
        <FormControlError>
          <FormControlErrorText>{errors[field]}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );

  return (
    <VStack className="w-full gap-4" testID="patient-form">
      {FICHA_FORM_FIELDS.filter((item) => shows(item.field)).map((item) => (
        <Fragment key={item.field}>
          {CATALOG_FIELDS.filter((c) => c.before === item.field && shows(c.field)).map(
            renderCatalogField,
          )}
          {renderField(item)}
        </Fragment>
      ))}
      {shows("referrerRefers") ? (
        <OptionPicker
          isDisabled={isDisabled}
          label="Refiere el caso otro veterinario"
          onChange={(value) => onChange("referrerRefers", value)}
          options={[...REFERS_OPTIONS]}
          testID={TEST_ID_BY_FIELD.referrerRefers}
          value={values.referrerRefers}
        />
      ) : null}
      {REFERRER_FORM_FIELDS.filter((item) => shows(item.field)).map(renderField)}
    </VStack>
  );
}
