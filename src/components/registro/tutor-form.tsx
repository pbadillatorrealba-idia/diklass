import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { type TutorContent, tutorContentSchema } from "@/features/registro/schema";
import { getFieldErrors } from "@/lib/forms/errors";

export type TutorFormValues = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
};

export const emptyTutorValues: TutorFormValues = {
  name: "",
  surname: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  postalCode: "",
};

export const tutorValuesFromContent = (content: TutorContent): TutorFormValues => ({
  name: content.name,
  surname: content.surname ?? "",
  phone: content.phone ?? "",
  email: content.email ?? "",
  address: content.address ?? "",
  city: content.city ?? "",
  postalCode: content.postalCode ?? "",
});

/** Los obligatorios se rotulan en el texto (FR-121): el color no es la única señal. */
const FIELDS: { field: keyof TutorFormValues; label: string; testID: string }[] = [
  { field: "name", label: "Nombre del tutor (obligatorio)", testID: "tutor-name" },
  { field: "surname", label: "Apellidos del tutor", testID: "tutor-surname" },
  { field: "phone", label: "Teléfono del tutor", testID: "tutor-phone" },
  { field: "email", label: "Correo del tutor", testID: "tutor-email" },
  { field: "address", label: "Dirección del tutor", testID: "tutor-address" },
  { field: "city", label: "Población del tutor", testID: "tutor-city" },
  { field: "postalCode", label: "Código postal del tutor", testID: "tutor-postal-code" },
];

/** Valida con el esquema del tutor: el contenido, o los errores por campo (`form` para el global). */
export function parseTutorValues(
  values: TutorFormValues,
):
  | { value: TutorContent; errors?: undefined }
  | { value?: undefined; errors: Record<string, string> } {
  const parsed = tutorContentSchema.safeParse(values);
  return parsed.success ? { value: parsed.data } : { errors: getFieldErrors(parsed.error) };
}

export type TutorFormProps = {
  values: TutorFormValues;
  errors: Record<string, string>;
  isDisabled?: boolean;
  onChange: (field: keyof TutorFormValues, text: string) => void;
};

export function TutorForm({ values, errors, isDisabled, onChange }: TutorFormProps) {
  return (
    <VStack className="w-full gap-4">
      <Text tone="muted">
        Obligatorios: el nombre y al menos un medio de contacto (teléfono o correo).
      </Text>
      {FIELDS.map(({ field, label, testID }) => {
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
                autoCapitalize={field === "email" ? "none" : "words"}
                editable={!isDisabled}
                keyboardType={field === "email" ? "email-address" : "default"}
                onChangeText={(text) => onChange(field, text)}
                testID={testID}
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
      {errors.form ? (
        <FormControl isInvalid>
          <FormControlError>
            <FormControlErrorText>{errors.form}</FormControlErrorText>
          </FormControlError>
        </FormControl>
      ) : null}
    </VStack>
  );
}
