import { type ReactNode, useRef } from "react";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { MAX_LINES, sendOnKey } from "@/features/asistente/composer-keys";

const IS_WEB = process.env.EXPO_OS === "web";
// `text-base` (24 px de interlínea) más el relleno vertical de `py-3` de `InputField`.
const LINE_HEIGHT = 24;
const MAX_HEIGHT = MAX_LINES * LINE_HEIGHT + 24;

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Recibe el texto sin espacios sobrantes; quien lo llama vacía el borrador. */
  onSend: (text: string) => void;
  onStop?: () => void;
  isResponding: boolean;
  /** Acciones extra junto al envío (el micrófono de los mensajes de voz). */
  actions?: ReactNode;
};

/**
 * Composer del chat (asistente-conversacional «Composer del chat» · design.md D10): campo
 * multilínea que crece de 1 a 6 líneas, «Enviar» o «Detener» según haya una respuesta en curso y el
 * foco de vuelta al campo tras enviar. En web Enter envía y Shift+Enter inserta un salto (sin enviar
 * durante la composición IME); en nativo se envía solo con el botón.
 */
export function Composer({
  actions,
  isResponding,
  onChangeText,
  onSend,
  onStop,
  value,
}: ComposerProps) {
  const field = useRef<TextInput | null>(null);
  const text = value.trim();
  const canSend = text !== "" && !isResponding;

  const send = () => {
    if (!canSend) return;
    onSend(text);
    field.current?.focus();
  };

  return (
    // En columna: el campo ocupa todo el ancho (en el panel de 360 px, con el micrófono y «Enviar» en su
    // misma fila quedaba de ~170 px) y las acciones van debajo, a la derecha.
    <View className="gap-2" testID="composer">
      <Input>
        <InputField
          accessibilityLabel="Mensaje al asistente"
          aria-label="Mensaje al asistente"
          multiline
          onChangeText={onChangeText}
          // `onKeyPress` solo trae Enter/Shift en web; ahí se cancela el salto para enviar.
          onKeyPress={
            IS_WEB
              ? (event) => {
                  if (!sendOnKey(event.nativeEvent as never)) return;
                  event.preventDefault();
                  send();
                }
              : undefined
          }
          placeholder="Escribe tu pregunta"
          ref={field}
          style={{ maxHeight: MAX_HEIGHT }}
          testID="composer-input"
          value={value}
        />
      </Input>
      <View className="flex-row items-center justify-end gap-2">
        {actions}
        {isResponding ? (
          <Button onPress={onStop} testID="composer-stop" variant="outline">
            <ButtonText>Detener</ButtonText>
          </Button>
        ) : (
          <Button isDisabled={!canSend} onPress={send} testID="composer-send">
            <ButtonText>Enviar</ButtonText>
          </Button>
        )}
      </View>
    </View>
  );
}
