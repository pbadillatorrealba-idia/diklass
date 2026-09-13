import {
  Button,
  ButtonText,
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
  Heading,
  Input,
  InputField,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { type LoginValues, loginSchema } from "@/lib/forms/form";

type LoginFormProps = {
  onSubmit: (values: LoginValues) => Promise<void>;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "", password: "" } satisfies LoginValues,
    onSubmit: async ({ value }) => {
      const result = loginSchema.safeParse(value);
      if (!result.success) {
        setSubmitError("Revisa los campos marcados antes de continuar.");
        return;
      }

      setSubmitError(null);
      try {
        await onSubmit(result.data);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "No pudimos iniciar sesión.");
      }
    },
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <VStack style={{ gap: 24, maxWidth: 480, width: "100%" }}>
      <VStack style={{ gap: 4 }}>
        <Heading style={{ fontSize: 30, fontWeight: "700" }}>Diklass</Heading>
        <Text color="$textLight600">Acceso para profesionales veterinarios</Text>
      </VStack>

      <form.Field name="email">
        {(field) => {
          const error = field.state.meta.errors[0];
          return (
            <FormControl isInvalid={Boolean(error)}>
              <FormControlLabel>
                <FormControlLabelText>Correo de acceso</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  accessibilityLabel="Correo de acceso"
                  aria-label="Correo de acceso"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  nativeID="login-email"
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder="nombre@clinica.test"
                  testID="login-email"
                  value={field.state.value}
                />
              </Input>
              {error ? (
                <FormControlError>
                  <FormControlErrorText>{String(error)}</FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>
          );
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => {
          const error = field.state.meta.errors[0];
          return (
            <FormControl isInvalid={Boolean(error)}>
              <FormControlLabel>
                <FormControlLabelText>Contraseña</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  accessibilityLabel="Contraseña"
                  aria-label="Contraseña"
                  autoComplete="current-password"
                  nativeID="login-password"
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder="Tu contraseña"
                  secureTextEntry
                  testID="login-password"
                  value={field.state.value}
                />
              </Input>
              {error ? (
                <FormControlError>
                  <FormControlErrorText>{String(error)}</FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>
          );
        }}
      </form.Field>

      {submitError ? (
        <Text accessibilityLiveRegion="polite" color="$error600" testID="login-error">
          {submitError}
        </Text>
      ) : null}

      <Button
        accessibilityLabel="Iniciar sesión"
        isDisabled={!isHydrated || form.state.isSubmitting}
        onPress={() => void form.handleSubmit()}
        testID="login-submit"
      >
        <ButtonText>{form.state.isSubmitting ? "Ingresando…" : "Iniciar sesión"}</ButtonText>
      </Button>
    </VStack>
  );
}
