import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useElapsed } from "@/features/voz/use-elapsed";
import type { ListenModeApi } from "@/features/voz/use-listen-mode";

const STOP_LABEL = "Detener el modo de escucha clínica";

/**
 * Estado de la escucha fuera del hilo (sistema-visual «Escucha siempre visible» · design.md D7 ·
 * D8): con el panel colapsado (riel de 56 px) o la hoja cerrada (cinta al pie) el veterinario ve
 * que se está grabando, cuánto lleva y puede detener. El aviso es siempre texto —corto en el
 * riel, para caber, con el aviso completo como nombre accesible; completo en la cinta— y nunca
 * solo color. Colapsar o cerrar el panel no detiene la captura: esta pieza solo la muestra y
 * ofrece detenerla. Sin captura no pinta nada.
 */
export function ListenLiveStatus({
  modo,
  variant,
}: {
  modo: ListenModeApi;
  variant: "rail" | "dock";
}) {
  const elapsed = useElapsed(modo.startedAt);
  if (modo.state !== "capturando") return null;

  const aviso = modo.modoReal ? "Grabando y conservando audio" : "Escuchando";
  const estado = (
    <>
      <Icon decorative name="record-circle" size="sm" tone="destructive" />
      <Text variant={variant === "rail" ? "nav" : "strong"}>
        {variant === "rail" ? (modo.modoReal ? "Grabando" : "Escuchando") : aviso}
      </Text>
    </>
  );
  // Fuera de la región `polite`: un tiempo que cambia cada segundo no se anuncia.
  const tiempo = (
    <Text
      className="font-mono tabular-nums"
      testID={`listen-elapsed-${variant}`}
      variant={variant === "rail" ? "nav" : "body"}
    >
      {elapsed}
    </Text>
  );
  const detener = (
    <Pressable
      accessibilityLabel={STOP_LABEL}
      accessibilityRole="button"
      aria-label={STOP_LABEL}
      className={`min-h-touch min-w-touch items-center justify-center rounded-sm ${
        variant === "dock" ? "flex-row gap-1 px-2" : ""
      }`.trim()}
      onPress={() => void modo.stop()}
      role="button"
      testID={`listen-stop-${variant}`}
    >
      <Icon decorative name="stop-circle-outline" tone="destructive" />
      <Text variant={variant === "rail" ? "nav" : "label"}>Detener</Text>
    </Pressable>
  );

  if (variant === "rail") {
    return (
      <View className="items-center gap-2" testID="listen-status-rail">
        <View
          accessibilityLabel={aviso}
          aria-label={aviso}
          aria-live="polite"
          className="items-center"
          role="status"
        >
          {estado}
        </View>
        {tiempo}
        {detener}
      </View>
    );
  }
  return (
    <View className="w-full flex-row flex-wrap items-center gap-x-3" testID="listen-status-dock">
      <View aria-live="polite" className="flex-row items-center gap-1" role="status">
        {estado}
      </View>
      {tiempo}
      {detener}
    </View>
  );
}
