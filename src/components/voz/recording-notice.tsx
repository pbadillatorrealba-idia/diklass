import { Callout } from "@/components/ui/callout";

/**
 * Aviso persistente de grabación y conservación del audio (D5 del cambio
 * implementar-asr-real-captura-voz): solo con la captura real activa. Texto y título, no solo
 * color; el `Callout` de advertencia es una región `polite`.
 */
export function RecordingNotice({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <Callout testID="recording-notice" title="Grabando audio" tone="warning">
      Se está grabando y conservando el audio de esta conversación.
    </Callout>
  );
}
