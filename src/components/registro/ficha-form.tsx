import { z } from "zod";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { VStack } from "@/components/ui/vstack";
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
};

export const FICHA_FORM_FIELDS: {
  field: FichaField;
  label: string;
  keyboardType?: "numeric";
}[] = [
  { field: "name", label: "Nombre" },
  { field: "species", label: "Especie" },
  { field: "breed", label: "Raza" },
  { field: "birthDate", label: "Fecha de nacimiento (AAAA-MM-DD)" },
  { field: "ageMonths", label: "Edad (meses)", keyboardType: "numeric" },
  { field: "weightKg", label: "Peso (kg)", keyboardType: "numeric" },
  { field: "sex", label: "Sexo" },
  { field: "reproductiveStatus", label: "Estado reproductivo" },
];

const TEST_ID_BY_FIELD: Record<FichaField, string> = {
  name: "patient-name",
  species: "patient-species",
  breed: "patient-breed",
  birthDate: "patient-birth-date",
  ageMonths: "patient-age-months",
  weightKg: "patient-weight-kg",
  sex: "patient-sex",
  reproductiveStatus: "patient-reproductive-status",
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
};

/** Campos de FR-001 con etiqueta programática y error por campo (WCAG 2.2 AA 3.3.1). */
export function FichaForm({ values, errors, isDisabled = false, onChange }: FichaFormProps) {
  return (
    <VStack className="w-full gap-4" testID="patient-form">
      {FICHA_FORM_FIELDS.map(({ field, label, keyboardType }) => {
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
      })}
    </VStack>
  );
}
