import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { z } from "zod";
import {
  emptyFuenteFormValues,
  FormularioFuente,
  type FuenteFormValues,
} from "@/components/conocimiento/formulario-fuente";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { incorporateSource } from "@/features/conocimiento/coleccion-service";
import { invalidateConocimiento } from "@/features/conocimiento/query-cache";
import type { FuenteInput } from "@/features/conocimiento/schema";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

const CAMPO_POR_RUTA: Record<string, string> = {
  titulo: "titulo",
  autores: "autores",
  anio: "anio",
  revista: "revista",
  editorial: "editorial",
  edicion: "edicion",
  doi: "doi",
  url: "url",
  tipo: "licenciaTipo",
  nota: "licenciaNota",
};

/**
 * Incorporación de una fuente clínica a la colección (FR-028 · FR-030 · US5-AC6/AC9), con la
 * atribución sellada por el servidor (FR-069 · US5-AC13).
 */
export default function NewKnowledgeSourceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const [values, setValues] = useState<FuenteFormValues>(emptyFuenteFormValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (fuente: FuenteInput) => {
    if (!clinicId) {
      return;
    }
    setIsSaving(true);
    setStatus(null);
    setErrors({});
    try {
      await incorporateSource(supabase, { clinicId, fuente });
      // La colección en caché no incluye la fuente nueva (revisión de la PR #30).
      await invalidateConocimiento(queryClient);
      router.replace("/knowledge/sources");
    } catch (error) {
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
      } else if (error instanceof z.ZodError) {
        const porCampo: Record<string, string> = {};
        for (const issue of error.issues) {
          const ruta = issue.path.join(".");
          const ultimo = issue.path.at(-1);
          const clave = typeof ultimo === "string" ? ultimo : "";
          const campo = ruta === "fragmentos" ? "texto" : (CAMPO_POR_RUTA[clave] ?? "texto");
          porCampo[campo] ??= issue.message;
        }
        setErrors(porCampo);
        setStatus("Revisa los campos señalados antes de incorporar la fuente.");
      } else {
        setStatus(error instanceof Error ? error.message : "No se pudo incorporar la fuente.");
        void captureClientError(errorReporter, {
          error,
          operation: "incorporateSource",
          requestId: makeRequestId(),
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="lg">Base de conocimiento · Incorporar fuente</Heading>
          <Text className="text-foreground/70 text-sm">
            Una fuente incorporada queda atribuida a tu identidad y no puede editarse después: si
            hay que corregirla, se retira y se incorpora una fuente nueva.
          </Text>
          <FormularioFuente
            errors={errors}
            isSaving={isSaving}
            onChange={setValues}
            onSubmit={(fuente) => void onSubmit(fuente)}
            status={status}
            values={values}
          />
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
