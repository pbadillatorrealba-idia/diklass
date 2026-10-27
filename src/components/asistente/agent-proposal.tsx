import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ProvenanceMark } from "@/components/ui/provenance-mark";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { Attribution } from "@/lib/attribution/types";

export type AgentProposalData = {
  id: string;
  /** Qué propone hacer el agente, en una frase que el veterinario pueda aceptar o no. */
  summary: string;
  /** De dónde sale la propuesta (qué leyó el agente); se muestra siempre. */
  origin: string;
};

type AgentProposalProps = {
  proposal: AgentProposalData;
  /** La única vía a una escritura o acción: sin esta llamada, el agente no cambia nada. */
  onConfirm: (proposalId: string) => void;
  /** Una confirmación está en curso: no admite otra. */
  busy?: boolean;
  /**
   * Quién confirmó y cuándo, tal como lo devuelve el servidor (la atribución es del servidor, no
   * del cliente: FR-063). Presente, la propuesta ya no es sugerencia.
   */
  confirmedBy?: Attribution | null;
};

/**
 * Propuesta de un agente (sistema-visual «Las propuestas del agente exigen confirmación» ·
 * design.md D6 · FR-010 · FR-021 · FR-063 · FR-076): el agente solo propone. Se pinta como
 * sugerencia (pliego canario con contorno ocre), con su origen y procedencia «Inferida»; no
 * escribe en el registro clínico ni ejecuta nada hasta que el veterinario pulsa Confirmar, y
 * entonces la autoría es de quien confirmó. No usa hooks: es una pieza de presentación que el
 * dueño del agente alimenta.
 */
export function AgentProposal({
  proposal,
  onConfirm,
  busy = false,
  confirmedBy = null,
}: AgentProposalProps) {
  const detalle = (
    <Box className="flex-row items-start gap-3">
      <VStack className="flex-1 gap-1">
        <Text selectable>{proposal.summary}</Text>
        <Text selectable tone="muted">{`Origen: ${proposal.origin}`}</Text>
      </VStack>
      <ProvenanceMark provenance="inferida" />
    </Box>
  );
  return (
    <Card className="gap-2" testID="agent-proposal">
      {confirmedBy ? detalle : <SuggestedBlock>{detalle}</SuggestedBlock>}
      {confirmedBy ? (
        // Confirmada: deja de ser sugerencia y muestra quién la validó (FR-076).
        <VStack className="gap-2">
          <Box className="flex-row items-center gap-1">
            <Icon decorative name="check-circle-outline" size="sm" tone="success" />
            <Text tone="success" variant="strong">
              Confirmada
            </Text>
          </Box>
          <AttributionBadge approved attribution={confirmedBy} />
        </VStack>
      ) : (
        <Button
          accessibilityLabel={`Confirmar la propuesta: ${proposal.summary}`}
          className="self-start"
          isDisabled={busy}
          onPress={() => onConfirm(proposal.id)}
          testID="agent-proposal-confirm"
        >
          <ButtonText>Confirmar</ButtonText>
        </Button>
      )}
    </Card>
  );
}
