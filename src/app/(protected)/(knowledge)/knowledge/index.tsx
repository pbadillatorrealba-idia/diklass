import { ConocimientoThread } from "@/components/conocimiento/conocimiento-thread";
import { Screen } from "@/components/ui/screen";

/**
 * Conversación con el asistente de la base de conocimiento (FR-005, FR-026 · US5-AC1/AC4). El
 * contenido es el hilo «Conocimiento», que también vive en el panel de asistente del shell.
 */
export default function KnowledgeConversationScreen() {
  return (
    <Screen title="Base de conocimiento · Consulta">
      <ConocimientoThread />
    </Screen>
  );
}
