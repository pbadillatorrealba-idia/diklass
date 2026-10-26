import { AgentProposal, type AgentProposalData } from "@/components/asistente/agent-proposal";
import { Callout } from "@/components/ui/callout";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAgentAvailability } from "@/features/asistente/agent-availability";

/** Estados que el hilo reserva para un agente futuro (design.md D6). */
export type AgentState = "idle" | "thinking" | "proposing" | "error";

type AgentThreadViewProps = {
  /** Hay un agente instalado. Sin él, el hilo declara que no está disponible y no simula nada. */
  available: boolean;
  state: AgentState;
  proposals: readonly AgentProposalData[];
  errorMessage?: string;
  onConfirm: (proposalId: string) => void;
};

/**
 * Presentación del hilo «Asistente» (sistema-visual «Hilo del asistente reservado» · design.md
 * D6). Reserva los estados en espera, pensando, propone y error; sin agente muestra solo que no
 * está disponible —aunque le lleguen estados o propuestas— porque una «presencia agéntica» que
 * simule capacidad sería una promesa falsa.
 */
export function AgentThreadView({
  available,
  state,
  proposals,
  errorMessage,
  onConfirm,
}: AgentThreadViewProps) {
  if (!available) {
    return (
      <VStack className="gap-2" testID="agent-unavailable">
        <Text variant="strong">El asistente conversacional no está disponible todavía</Text>
        <Text tone="muted">
          Cuando exista, propondrá y tú decidirás: nada se escribe en el registro clínico sin tu
          confirmación.
        </Text>
      </VStack>
    );
  }
  return (
    <VStack className="gap-3" testID="agent-thread">
      {state === "idle" ? (
        <Text tone="muted">En espera: el asistente propone y tú decides.</Text>
      ) : null}
      {state === "thinking" ? (
        <Text accessibilityLiveRegion="polite" aria-live="polite" role="status">
          Pensando…
        </Text>
      ) : null}
      {state === "proposing"
        ? proposals.map((proposal) => (
            <AgentProposal key={proposal.id} onConfirm={onConfirm} proposal={proposal} />
          ))
        : null}
      {state === "error" ? (
        <Callout testID="agent-error" tone="error">
          {errorMessage ?? "El asistente no pudo completar la solicitud."}
        </Callout>
      ) : null}
    </VStack>
  );
}

/** Hilo «Asistente» del panel: sin agente instalado declara que no está disponible. */
export function AgentThread() {
  return (
    <AgentThreadView
      available={useAgentAvailability()}
      onConfirm={() => {}}
      proposals={[]}
      state="idle"
    />
  );
}
