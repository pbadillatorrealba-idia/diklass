import { useFocusEffect } from "expo-router";
import { useCallback, useId } from "react";
import { useConversationStore } from "@/features/conocimiento/conversation-store";

/**
 * Fija al paciente de la pantalla como contexto del chat (FR-026 · asistente-conversacional
 * «Paciente de contexto automático»): desde una consulta o una ficha el veterinario pregunta sobre ese
 * paciente sin elegirlo, y no hay selector de pacientes en el chat. Con `null` (pantalla sin paciente,
 * o aún cargando) no toca el contexto.
 *
 * Sigue al foco de la pantalla y no a su montaje: navegar entre pestañas deja la pantalla montada, y
 * el chat no debe responder con el paciente de una pantalla que ya no se ve. Cada pantalla es dueña de
 * lo que fijó: al salir solo suelta lo suyo, así que el último en enfocarse gana.
 */
export function usePatientContext(patientId: string | null, patientName?: string | null) {
  const owner = useId();
  useFocusEffect(
    useCallback(() => {
      if (patientId === null) return;
      useConversationStore.getState().setPatient(patientId, patientName ?? null, owner);
      return () => useConversationStore.getState().releasePatient(owner);
    }, [owner, patientId, patientName]),
  );
}
