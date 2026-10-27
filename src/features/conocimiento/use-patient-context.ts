import { useEffect } from "react";
import { useConversationStore } from "@/features/conocimiento/conversation-store";

/**
 * Fija al paciente de la pantalla como contexto del hilo «Conocimiento» (FR-026 · sistema-visual
 * «Conocimiento en el panel»): desde una consulta o una ficha el veterinario pregunta sobre ese
 * paciente sin elegirlo. Con `null` (pantalla sin paciente, o aún cargando) no toca el contexto
 * que ya hubiera; el selector de paciente de `ConocimientoThread` sigue disponible. Al salir de la
 * pantalla suelta el paciente que fijó, para que el hilo «Asistente» (que no muestra el contexto)
 * no responda con el de una consulta anterior.
 */
export function usePatientContext(patientId: string | null) {
  const setPatient = useConversationStore((state) => state.setPatient);
  useEffect(() => {
    if (patientId === null) return;
    setPatient(patientId);
    return () => releasePatientContext(patientId);
  }, [patientId, setPatient]);
}

/** Suelta el contexto solo si sigue siendo el de esta pantalla (no pisa otra elección). */
export function releasePatientContext(patientId: string) {
  const { patientId: current, setPatient } = useConversationStore.getState();
  if (current === patientId) setPatient(null);
}
