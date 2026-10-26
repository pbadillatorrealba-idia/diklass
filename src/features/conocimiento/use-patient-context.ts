import { useEffect } from "react";
import { useConversationStore } from "@/features/conocimiento/conversation-store";

/**
 * Fija al paciente de la pantalla como contexto del hilo «Conocimiento» (FR-026 · sistema-visual
 * «Conocimiento en el panel»): desde una consulta o una ficha el veterinario pregunta sobre ese
 * paciente sin elegirlo. Con `null` (pantalla sin paciente, o aún cargando) no toca el contexto
 * que ya hubiera; el selector de paciente de `ConocimientoThread` sigue disponible.
 */
export function usePatientContext(patientId: string | null) {
  const setPatient = useConversationStore((state) => state.setPatient);
  useEffect(() => {
    if (patientId !== null) setPatient(patientId);
  }, [patientId, setPatient]);
}
