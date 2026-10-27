import { Fragment, type Ref, useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { PanelSheet } from "@/components/asistente/panel-sheet";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePanelStore } from "@/features/asistente/panel-store";
import {
  type PanelThread,
  resolveActiveThread,
  usePanelThreadList,
} from "@/features/asistente/panel-threads";
import { restoreFocus } from "@/features/asistente/restore-focus";

const DEFAULT_ICON: IconName = "message-text-outline";

type PanelDockViewProps = {
  threads: readonly PanelThread[];
  activeId: string;
  onOpen: () => void;
  /** Referencia del control que abre la hoja: a él vuelve el foco al cerrarla. */
  openRef?: Ref<View>;
};

/**
 * Cinta del asistente en compacto (sistema-visual «Dock de asistente en compacto» · design.md D7):
 * el nombre del hilo activo, el estado de la escucha de cualquier hilo (aunque el activo sea otro)
 * con su aviso de grabación y «Detener», y el número de cosas por confirmar. Todos sus controles
 * miden al menos 44×44 px. Activarla abre la hoja con el hilo activo.
 */
export function PanelDockView({ threads, activeId, onOpen, openRef }: PanelDockViewProps) {
  if (threads.length === 0) return null;
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const pending = threads.reduce((total, thread) => total + (thread.pending ?? 0), 0);
  return (
    <View className="flex-row flex-wrap items-center gap-x-3 px-2 py-1" testID="panel-dock">
      <Button
        accessibilityLabel={`Abrir el asistente: ${active?.label}`}
        aria-haspopup="dialog"
        onPress={onOpen}
        ref={openRef}
        size="sm"
        testID="panel-dock-open"
        variant="outline"
      >
        <View className="flex-row items-center gap-2">
          <Icon decorative name={(active?.icon as IconName | undefined) ?? DEFAULT_ICON} />
          <ButtonText>{active?.label}</ButtonText>
        </View>
      </Button>
      {pending > 0 ? (
        <Text testID="panel-dock-pending" variant="strong">
          {`${pending} por confirmar`}
        </Text>
      ) : null}
      {threads.some((thread) => thread.unread) ? (
        <View aria-live="polite" role="status">
          <Text testID="panel-dock-unread" variant="strong">
            Respuesta nueva
          </Text>
        </View>
      ) : null}
      {/* El estado de la escucha ocupa su propia fila: su aviso completo no cabe junto al botón. */}
      {threads.map((thread) => (
        <Fragment key={thread.id}>{thread.status?.("dock")}</Fragment>
      ))}
    </View>
  );
}

/** Cinta y hoja del asistente: la cinta abre la hoja y cerrarla no detiene nada (D7). */
export function PanelDock() {
  const threads = usePanelThreadList();
  const activeThread = usePanelStore((state) => state.activeThread);
  const setActiveThread = usePanelStore((state) => state.setActiveThread);
  const [open, setOpen] = useState(false);
  const openRef = useRef<View>(null);
  const close = useCallback(() => {
    setOpen(false);
    // El foco vuelve al control que abrió la hoja (WCAG 2.4.3).
    restoreFocus(() => openRef.current as unknown as HTMLElement | null);
  }, []);
  const activeId = resolveActiveThread(
    activeThread,
    threads.map((thread) => thread.id),
  );
  return (
    <>
      <PanelDockView
        activeId={activeId}
        onOpen={() => setOpen(true)}
        openRef={openRef}
        threads={threads}
      />
      <PanelSheet
        activeId={activeId}
        onClose={close}
        onSelect={setActiveThread}
        open={open && threads.length > 0}
        threads={threads}
      />
    </>
  );
}
