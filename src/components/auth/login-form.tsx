import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import type { TextInput } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AuthenticationError } from "@/features/auth/auth-service";
import { type LoginValues, loginSchema } from "@/lib/forms/form";
import { AuthForm } from "./auth-form";
import { PasswordToggle } from "./password-toggle";

type LoginFormProps = {
  onSubmit: (values: LoginValues) => Promise<void>;
};

/**
 * Lo que un gestor de contraseñas (o el usuario) escribió en el HTML estático antes de la
 * hidratación (FR-089 · US15-AC2 · design.md D16). Se lee una vez, en el primer render del
 * cliente, antes de que React tome los campos.
 */
function readPrefilled(): LoginValues {
  if (process.env.EXPO_OS !== "web" || typeof document === "undefined") {
    return { email: "", password: "" };
  }
  const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
  return { email: value("username") ?? "", password: value("password") ?? "" };
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [prefilled] = useState(readPrefilled);
  const passwordRef = useRef<TextInput>(null);
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
        // La contraseña no se conserva tras un intento fallido; el correo sí (FR-090 · US15-AC5).
        form.setFieldValue("password", "");
        setSubmitError(
          error instanceof AuthenticationError
            ? error.message
            : "No pudimos iniciar sesión. Inténtalo nuevamente.",
        );
      }
    },
  });

  useEffect(() => {
    // Los campos no son `readOnly` antes de hidratar: lo ya escrito se adopta como valor inicial.
    if (prefilled.email) form.setFieldValue("email", prefilled.email);
    if (prefilled.password) form.setFieldValue("password", prefilled.password);
    setIsHydrated(true);
  }, [form, prefilled]);

  const submit = () => void form.handleSubmit();
  const isWeb = process.env.EXPO_OS === "web";

  return (
    <AuthForm onSubmit={submit}>
      <Card className="w-full max-w-form gap-6">
        <VStack className="gap-2">
          <Icon decorative name="paw" size="lg" tone="primary" />
          <Heading level={1}>Diklass</Heading>
          <Text tone="muted">Acceso para profesionales veterinarios</Text>
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
                    autoComplete="username"
                    importantForAutofill="yes"
                    keyboardType="email-address"
                    nativeID="username"
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    placeholder="nombre@clinica.test"
                    returnKeyType="next"
                    submitBehavior="submit"
                    testID="login-email"
                    textContentType="username"
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
                    autoCapitalize="none"
                    autoComplete="current-password"
                    importantForAutofill="yes"
                    nativeID="password"
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    // En web, Intro envía el `<form>` (envío implícito); en nativo, este evento.
                    onSubmitEditing={isWeb ? undefined : submit}
                    placeholder="Tu contraseña"
                    ref={passwordRef}
                    returnKeyType="go"
                    secureTextEntry={!showPassword}
                    testID="login-password"
                    textContentType="password"
                    value={field.state.value}
                  />
                  <PasswordToggle
                    onToggle={() => setShowPassword((visible) => !visible)}
                    visible={showPassword}
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
          <Callout testID="login-error" tone="error">
            {submitError}
          </Callout>
        ) : null}

        <Button
          accessibilityLabel="Iniciar sesión"
          isDisabled={!isHydrated || form.state.isSubmitting}
          // En web el envío llega por el evento `submit` del `<form>` (design.md D16).
          onPress={isWeb ? undefined : submit}
          testID="login-submit"
          type="submit"
        >
          <ButtonText>{form.state.isSubmitting ? "Ingresando…" : "Iniciar sesión"}</ButtonText>
        </Button>
      </Card>
    </AuthForm>
  );
}
