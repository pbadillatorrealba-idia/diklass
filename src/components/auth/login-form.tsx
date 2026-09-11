import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
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
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AuthenticationError } from "@/features/auth/auth-service";
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
        setSubmitError(
          error instanceof AuthenticationError
            ? error.message
            : "No pudimos iniciar sesión. Inténtalo nuevamente.",
        );
      }
    },
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <VStack className="w-full max-w-[480px] gap-6">
      <VStack className="gap-1">
        <Heading size="3xl">Diklass</Heading>
        <Text className="text-foreground/70">Acceso para profesionales veterinarios</Text>
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
                  // Read-only until hydrated: keystrokes typed into the static HTML before React
                  // takes over would be silently wiped (reproduced in WebKit e2e runs).
                  editable={isHydrated}
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
                  editable={isHydrated}
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
        <Text accessibilityLiveRegion="polite" className="text-destructive" testID="login-error">
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
