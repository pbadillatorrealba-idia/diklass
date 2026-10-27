import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type AudioPlayback, createAudioPlayback } from "@/features/asistente/audio-playback";
import { restoreFocus } from "@/features/asistente/restore-focus";
import type { VoiceMessageApi } from "@/features/asistente/use-voice-message";
import { MAX_VOICE_MS, type VoiceNotice } from "@/features/asistente/voice-message";
import type { AudioPayload } from "@/features/voz/transcription-port";
import { formatElapsed } from "@/features/voz/use-elapsed";

type Voice = Pick<
  VoiceMessageApi,
  | "state"
  | "notice"
  | "elapsed"
  | "blockedReason"
  | "start"
  | "stop"
  | "cancel"
  | "discard"
  | "dismissNotice"
>;

/** Conservación del audio (asistente-conversacional «Conservación del audio por 90 días»). */
const RETENCION = "Se conserva 90 días.";

const AVISOS: Record<VoiceNotice, string> = {
  "too-short": "La grabación fue demasiado corta (mínimo 1 segundo) y no se envió.",
  unavailable:
    "No hay acceso al micrófono o al dispositivo de audio. Puedes escribir tu pregunta en su lugar.",
  blocked: "La escucha de la consulta usa el micrófono.",
  "not-understood": "No se entendió el audio. Puedes grabar de nuevo.",
  busy: "Hay una respuesta en curso. Envía el audio cuando termine.",
};

const asHtml = (node: unknown) => node as HTMLElement | null;

/**
 * Botón de grabar del composer (asistente-conversacional «Grabar, revisar y enviar audio» · tarea 7.4):
 * se graba tocando, sin gestos de puntero. Queda deshabilitado mientras hay otra grabación o la
 * escucha de la consulta usa el micrófono (el motivo lo dice `VoicePanel`). Al terminar cualquier
 * acción del panel (Cancelar, Descartar, Enviar), el foco vuelve aquí: el panel se desmonta y el foco
 * quedaría perdido (WCAG 2.4.3).
 */
export function VoiceButton({
  buttonRef,
  onPress,
  voice,
}: {
  /** Referencia del botón para devolverle el foco desde fuera (p. ej. al cancelar el aviso de primer uso). */
  buttonRef?: React.RefObject<View | null>;
  onPress: () => void;
  voice: Pick<Voice, "state" | "blockedReason">;
}) {
  const propia = useRef<View>(null);
  const ref = buttonRef ?? propia;
  const previous = useRef(voice.state.kind);
  const ocupado = voice.state.kind !== "idle" || voice.blockedReason !== null;

  useEffect(() => {
    if (previous.current !== "idle" && voice.state.kind === "idle") {
      restoreFocus(() => asHtml(ref.current));
    }
    previous.current = voice.state.kind;
  }, [voice.state.kind, ref]);

  return (
    <Button
      accessibilityLabel="Grabar un mensaje de voz"
      aria-label="Grabar un mensaje de voz"
      isDisabled={ocupado}
      onPress={onPress}
      ref={ref}
      testID="voice-record"
      variant="outline"
    >
      <Icon decorative name="microphone-outline" />
    </Button>
  );
}

/**
 * Aviso de primer uso (asistente-conversacional «Grabar, revisar y enviar audio»): el audio y su
 * transcripción se envían a un proveedor externo para transcribirse. Hay que aceptarlo antes de poder
 * grabar. Acción con consecuencias: el foco entra en «Cancelar».
 */
export function VoiceConsentDialog({
  onAccept,
  onCancel,
}: {
  onAccept: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<View>(null);
  useEffect(() => {
    asHtml(cancelRef.current)?.focus?.({ preventScroll: true });
  }, []);
  return (
    <View
      aria-label="Aviso antes de grabar"
      className="gap-2 rounded-sm border border-border bg-card p-3"
      role="alertdialog"
      testID="voice-consent"
    >
      <Text variant="strong">Antes de grabar tu primer mensaje de voz</Text>
      <Text>
        Tu audio y su transcripción se envían a un proveedor externo (OpenAI) para transcribir tu
        mensaje. En este sistema el audio se conserva 90 días y puedes eliminarlo cuando quieras; la
        transcripción queda como texto del mensaje.
      </Text>
      <Text tone="muted" variant="caption">
        No grabes datos que no necesites para tu pregunta.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button onPress={onAccept} size="sm" testID="voice-consent-accept">
          <ButtonText>Acepto y grabar</ButtonText>
        </Button>
        <Button
          onPress={onCancel}
          ref={cancelRef}
          size="sm"
          testID="voice-consent-cancel"
          variant="outline"
        >
          <ButtonText>Cancelar</ButtonText>
        </Button>
      </View>
    </View>
  );
}

function ReviewPlayer({
  payload,
  playRef,
}: {
  payload: AudioPayload;
  playRef?: React.RefObject<View | null>;
}) {
  const playback = useRef<AudioPlayback | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      playback.current?.dispose();
      playback.current = null;
    },
    [],
  );

  const toggle = () => {
    if (!playback.current) {
      playback.current = createAudioPlayback({ payload });
      playback.current.onEnded(() => setPlaying(false));
    }
    if (playing) playback.current.pause();
    else playback.current.play();
    setPlaying(!playing);
  };

  return (
    <Button onPress={toggle} ref={playRef} size="sm" testID="voice-play" variant="outline">
      <ButtonText>{playing ? "Pausar" : "Reproducir"}</ButtonText>
    </Button>
  );
}

/** Lo que anuncia la región de estado: el inicio, la revisión, el envío y los avisos; nunca el tiempo. */
function liveText(voice: Voice): string {
  switch (voice.state.kind) {
    case "recording":
      return "Grabando y conservando audio";
    case "review":
      return voice.notice
        ? AVISOS[voice.notice]
        : "Grabación detenida. Revisa tu mensaje de voz antes de enviarlo.";
    case "sending":
      return "Enviando audio…";
    default:
      return voice.notice ? AVISOS[voice.notice] : "";
  }
}

/**
 * Panel del mensaje de voz sobre el composer: grabando (punto, tiempo, Cancelar, Detener), revisión
 * (reproducir, Descartar, Enviar) y avisos. El aviso de grabación y conservación es texto, no solo
 * color. Una región de estado SIEMPRE montada —vacía y luego poblada, porque varios lectores no
 * anuncian regiones que nacen con texto— anuncia solo el inicio y el fin; el tiempo queda fuera de
 * ella para no anunciar cada segundo. Al pasar a revisión el foco va a «Reproducir».
 */
export function VoicePanel({ voice, onSend }: { voice: Voice; onSend: () => void }) {
  const { state, notice, blockedReason } = voice;
  // Al entrar a revisión el foco va a «Reproducir», no a «Enviar»: un Enter de más no enviaría el audio a
  // un tercero sin querer.
  const playRef = useRef<View>(null);

  useEffect(() => {
    if (state.kind === "review") asHtml(playRef.current)?.focus?.({ preventScroll: true });
  }, [state.kind]);

  const region = (
    <View
      aria-live="polite"
      role="status"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
      testID="voice-status"
    >
      <Text>{liveText(voice)}</Text>
    </View>
  );

  if (state.kind === "recording") {
    return (
      <>
        {region}
        <View
          accessibilityLabel="Grabando un mensaje de voz"
          aria-label="Grabando un mensaje de voz"
          className="gap-2 rounded-sm border border-border bg-card p-3"
          role="group"
          testID="voice-panel"
        >
          <View className="flex-row items-center gap-2">
            <Icon decorative name="record-circle" size="sm" tone="destructive" />
            <Text variant="strong">Grabando y conservando audio</Text>
          </View>
          <Text tone="muted" variant="caption">
            {`${RETENCION} Máximo 2 minutos.`}
          </Text>
          <Text className="font-mono tabular-nums" testID="voice-elapsed">
            {voice.elapsed}
          </Text>
          <View className="flex-row gap-2">
            <Button onPress={voice.cancel} size="sm" testID="voice-cancel" variant="outline">
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button
              onPress={() => void voice.stop()}
              size="sm"
              testID="voice-stop"
              variant="destructive"
            >
              <ButtonText>Detener</ButtonText>
            </Button>
          </View>
        </View>
      </>
    );
  }

  if (state.kind === "review") {
    return (
      <>
        {region}
        <View
          aria-label="Revisar el mensaje de voz"
          className="gap-2 rounded-sm border border-border bg-card p-3"
          role="group"
          testID="voice-panel"
        >
          <Text variant="strong">{`Revisa tu mensaje de voz · ${formatElapsed(state.durationMs)}`}</Text>
          {state.autoStopped || state.durationMs >= MAX_VOICE_MS ? (
            <Text tone="muted" variant="caption">
              La grabación llegó al máximo de 2 minutos y se detuvo sola.
            </Text>
          ) : null}
          {notice ? (
            <Text testID="voice-notice" variant="caption">
              {AVISOS[notice]}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <ReviewPlayer payload={state.payload} playRef={playRef} />
            <Button onPress={voice.discard} size="sm" testID="voice-discard" variant="outline">
              <ButtonText>Descartar</ButtonText>
            </Button>
            <Button onPress={onSend} size="sm" testID="voice-send">
              <ButtonText>Enviar</ButtonText>
            </Button>
          </View>
        </View>
      </>
    );
  }

  if (state.kind === "sending") {
    return (
      <>
        {region}
        <Text tone="muted" testID="voice-panel">
          Enviando audio…
        </Text>
      </>
    );
  }

  if (notice !== null) {
    return (
      <>
        {region}
        <View className="gap-2 rounded-sm border border-border bg-card p-3" testID="voice-notice">
          <Text>{AVISOS[notice]}</Text>
          <Button className="self-start" onPress={voice.dismissNotice} size="sm" variant="ghost">
            <ButtonText>Entendido</ButtonText>
          </Button>
        </View>
      </>
    );
  }

  return (
    <>
      {region}
      {blockedReason !== null ? (
        <Text tone="muted" testID="voice-blocked" variant="caption">
          {blockedReason}
        </Text>
      ) : null}
    </>
  );
}
