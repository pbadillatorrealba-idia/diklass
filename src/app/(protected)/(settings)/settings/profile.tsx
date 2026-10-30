import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
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
import { Input, InputField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/features/auth/auth-provider";
import { listProfileChanges, updateOwnProfile } from "@/features/perfil/profile-service";
import { displayNameSchema } from "@/features/perfil/schema";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

type Status = { tone: "success" | "error"; message: string } | null;

/** Editar datos personales (FR-095): nombre visible auditado, con su historial (FR-096). */
export default function ProfileScreen() {
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const storedName = useSessionStore((state) => state.displayName) ?? "";
  const { user } = useAuth();
  const guard = useClinicalGuard();
  const queryClient = useQueryClient();
  // `null`: sin tocar; se muestra el nombre vigente.
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const value = draft ?? storedName;
  const parsed = displayNameSchema.safeParse(value);
  const error = draft !== null && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  const changes = useQuery({
    queryKey: ["profile-changes", veterinarianId],
    queryFn: () => listProfileChanges(supabase, veterinarianId ?? ""),
    enabled: Boolean(veterinarianId),
  });

  const save = async () => {
    if (!parsed.success) {
      setDraft(value);
      return;
    }
    setIsSaving(true);
    setStatus(null);
    const outcome = await guard("update_own_profile", async () => {
      const { displayName } = await updateOwnProfile(supabase, parsed.data);
      const identity = useSessionStore.getState();
      if (identity.veterinarianId && identity.clinicId && identity.accessSessionId) {
        useSessionStore.getState().setIdentity({
          veterinarianId: identity.veterinarianId,
          clinicId: identity.clinicId,
          accessSessionId: identity.accessSessionId,
          displayName,
        });
      }
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["veterinarian-display-name"] }),
        queryClient.invalidateQueries({ queryKey: ["profile-changes"] }),
      ]);
    });
    setIsSaving(false);
    if (outcome === "ok") setStatus({ tone: "success", message: "Nombre actualizado." });
    // El borrador se conserva ante cualquier fallo; la sesión expirada la explica su diálogo.
    else if (outcome === "error") {
      setStatus({ tone: "error", message: "No pudimos guardar el cambio. Inténtalo nuevamente." });
    }
  };

  return (
    <Screen
      back={{ href: "/settings", label: "Configuración" }}
      testID="profile-screen"
      title="Datos personales"
      width="content"
    >
      <View className="gap-6">
        <Card className="gap-4">
          <FormControl isInvalid={Boolean(error)}>
            <FormControlLabel>
              <FormControlLabelText>Nombre visible</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                accessibilityLabel="Nombre visible"
                aria-label="Nombre visible"
                autoComplete="name"
                onChangeText={setDraft}
                onSubmitEditing={() => void save()}
                testID="profile-display-name"
                value={value}
              />
            </Input>
            {error ? (
              <FormControlError>
                <FormControlErrorText>{error}</FormControlErrorText>
              </FormControlError>
            ) : null}
          </FormControl>
          <VStack className="gap-1">
            <Text variant="rubric">Identificador de acceso</Text>
            <Text selectable testID="profile-identifier">
              {user?.email ?? ""}
            </Text>
          </VStack>
          {status ? (
            <Callout testID="profile-status" tone={status.tone}>
              {status.message}
            </Callout>
          ) : null}
          <Button
            accessibilityLabel="Guardar cambios"
            isDisabled={isSaving}
            onPress={() => void save()}
            testID="profile-save"
          >
            <ButtonText>{isSaving ? "Guardando…" : "Guardar cambios"}</ButtonText>
          </Button>
        </Card>

        <Card className="gap-3" testID="profile-history">
          <Heading level={2}>Cambios de nombre</Heading>
          {changes.data?.length ? (
            changes.data.map((change) => (
              <VStack className="gap-1 border-border border-b pb-2" key={change.id}>
                <Text tone="muted" variant="caption">
                  {new Date(change.occurredAt).toLocaleString("es-CL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
                <Text selectable>{`${change.previous} → ${change.current}`}</Text>
              </VStack>
            ))
          ) : (
            <Text tone="muted">
              {changes.isPending ? "Cargando…" : "Aún no has cambiado tu nombre."}
            </Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
