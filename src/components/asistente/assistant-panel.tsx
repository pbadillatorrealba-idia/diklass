import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { ResizeHandle } from "@/components/asistente/resize-handle";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { presentationFor, RAIL_WIDTH, usePanelStore } from "@/features/asistente/panel-store";
import {
  type PanelThread,
  resolveActiveThread,
  usePanelThreadList,
} from "@/features/asistente/panel-threads";
import { restoreFocus } from "@/features/asistente/restore-focus";

export const ASSISTANT_ID = "asistente";

const DEFAULT_ICON: IconName = "message-text-outline";

/** Control de colapsar/expandir: nombre accesible, `aria-expanded` y teclado (FR-082). */
function ToggleButton({
  expanded,
  onPress,
  ref,
  testID,
}: {
  expanded: boolean;
  onPress: () => void;
  ref?: React.Ref<View>;
  testID: string;
}) {
  return (
    <Button
      accessibilityLabel={
        expanded ? "Colapsar el panel del asistente" : "Abrir el panel del asistente"
      }
      aria-controls={ASSISTANT_ID}
      aria-expanded={expanded}
      className="min-w-touch"
      size="sm"
      onPress={onPress}
      ref={ref}
      testID={testID}
      variant="ghost"
    >
      <Icon decorative name={expanded ? "chevron-right" : "chevron-left"} />
    </Button>
  );
}

function ThreadTabs({
  active,
  onSelect,
  threads,
}: {
  active: string;
  onSelect: (id: string) => void;
  threads: readonly PanelThread[];
}) {
  // Un solo hilo (p. ej. el inicio) no necesita pestañas: se nombra y listo.
  if (threads.length <= 1) {
    return (
      <View className="flex-1 px-1">
        <Text variant="strong">{threads[0]?.label ?? ""}</Text>
      </View>
    );
  }
  return (
    <View className="flex-1 flex-row flex-wrap gap-1">
      {threads.map((thread) => (
        <Button
          aria-pressed={thread.id === active}
          className="px-3"
          key={thread.id}
          onPress={() => onSelect(thread.id)}
          size="sm"
          testID={`assistant-thread-${thread.id}`}
          variant={thread.id === active ? "outline" : "ghost"}
        >
          <ButtonText>{thread.label}</ButtonText>
        </Button>
      ))}
    </View>
  );
}

/**
 * Panel abierto: cabecera con los hilos y su control (`control`: colapsar el panel acoplado, cerrar
 * el cajón o cerrar la hoja), y el hilo activo con su propio desplazamiento.
 */
export function PanelBody({
  active,
  control,
  onSelect,
  threads,
  title,
}: {
  active: PanelThread | undefined;
  control: ReactNode;
  onSelect: (id: string) => void;
  threads: readonly PanelThread[];
  /** Con título (la hoja, estrecha), el control va junto a él y los hilos en su propia fila. */
  title?: string;
}) {
  return (
    <View className="flex-1">
      {title ? (
        <View className="gap-2 border-b border-border p-2">
          <View className="flex-row items-center justify-between gap-2 px-1">
            <Text variant="strong">{title}</Text>
            {control}
          </View>
          {threads.length > 1 ? (
            <ThreadTabs active={active?.id ?? ""} onSelect={onSelect} threads={threads} />
          ) : null}
        </View>
      ) : (
        <View className="flex-row items-center gap-2 border-b border-border p-2">
          <ThreadTabs active={active?.id ?? ""} onSelect={onSelect} threads={threads} />
          {control}
        </View>
      )}
      {/* «Escucha siempre visible»: el aviso de grabación no depende del hilo abierto. El hilo que
          lo declara ya lo muestra en su propio contenido, así que no se repite. */}
      <View className="px-3">
        {threads
          .filter((thread) => thread.id !== active?.id)
          .map((thread) => (
            <Fragment key={thread.id}>{thread.status?.("dock")}</Fragment>
          ))}
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        testID="assistant-thread"
      >
        {active ? (
          active.element
        ) : (
          <Text tone="muted">Esta pantalla no ofrece hilos del asistente.</Text>
        )}
      </ScrollView>
    </View>
  );
}

/** Riel de 56 px: un icono por hilo y el control de expandir. */
export function Rail({
  covered,
  onOpen,
  threads,
  toggleRef,
}: {
  /** El cajón está abierto encima: su estado ya se ve en el hilo y bajo el `scrim` no debe ser enfocable. */
  covered: boolean;
  onOpen: (id?: string) => void;
  threads: readonly PanelThread[];
  toggleRef: React.Ref<View>;
}) {
  return (
    <View
      className="h-full items-center gap-2 border-l border-border bg-card py-2"
      style={{ width: RAIL_WIDTH }}
      testID="assistant-rail"
    >
      <ToggleButton
        expanded={false}
        onPress={() => onOpen()}
        ref={toggleRef}
        testID="assistant-toggle"
      />
      {threads.map((thread) => (
        // El contador de pendientes va pegado al icono de su hilo, no al final del riel.
        <View className="items-center gap-1" key={thread.id}>
          <Button
            accessibilityLabel={thread.label}
            className="min-w-touch"
            onPress={() => onOpen(thread.id)}
            size="sm"
            testID={`assistant-rail-${thread.id}`}
            variant="ghost"
          >
            <Icon decorative name={(thread.icon as IconName | undefined) ?? DEFAULT_ICON} />
          </Button>
          {thread.pending ? (
            <View
              accessibilityLabel={`${thread.pending} por confirmar en ${thread.label}`}
              accessible
              aria-label={`${thread.pending} por confirmar en ${thread.label}`}
              className="min-h-6 min-w-6 items-center justify-center rounded-sm border border-primary px-1"
              role="img"
              testID={`assistant-rail-pending-${thread.id}`}
            >
              <Text tone="primary" variant="nav">
                {thread.pending}
              </Text>
            </View>
          ) : null}
          {thread.unread ? (
            // Aviso de respuesta nueva: texto y borde, no solo color; sin sonido ni animación.
            <View
              accessibilityLabel={`Respuesta nueva en ${thread.label}`}
              accessible
              aria-label={`Respuesta nueva en ${thread.label}`}
              aria-live="polite"
              className="min-h-6 min-w-6 items-center justify-center rounded-sm border border-primary px-1"
              role="status"
              testID={`assistant-rail-unread-${thread.id}`}
            >
              <Text tone="primary" variant="nav">
                Nuevo
              </Text>
            </View>
          ) : null}
        </View>
      ))}
      {/* El estado de los hilos (p. ej. la escucha) sigue a la vista con el panel colapsado. */}
      {covered
        ? null
        : threads.map((thread) => <Fragment key={thread.id}>{thread.status?.("rail")}</Fragment>)}
    </View>
  );
}

/**
 * Panel de asistente del shell (sistema-visual «Shell de tres zonas» · design.md D1/D2/D8). Desde
 * 1440 px va acoplado (360 px) y colapsa a riel; de 1024 a 1439 px es un riel y el panel se abre
 * como cajón superpuesto con `scrim`, Escape y foco devuelto; por debajo, el dock (grupo 6) ocupa
 * su lugar y aquí no se pinta.
 */
export function AssistantPanel() {
  const presentation = presentationFor(useWindowDimensions().width);
  const expanded = usePanelStore((state) => state.expanded);
  const setExpanded = usePanelStore((state) => state.setExpanded);
  const activeThread = usePanelStore((state) => state.activeThread);
  const setActiveThread = usePanelStore((state) => state.setActiveThread);
  const threads = usePanelThreadList();
  const width = usePanelStore((state) => state.width);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<View>(null);
  const drawerRef = useRef<View>(null);

  const active = threads.find(
    (thread) =>
      thread.id ===
      resolveActiveThread(
        activeThread,
        threads.map((t) => t.id),
      ),
  );
  const open = presentation === "rail" && drawerOpen;

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // El foco vuelve al control que abrió el cajón.
    restoreFocus(() => toggleRef.current as unknown as HTMLElement | null);
  }, []);

  useEffect(() => {
    if (!open) return;
    (drawerRef.current as unknown as HTMLElement | null)?.focus?.({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDrawer]);

  // Cambiar el ancho de la ventana a un modo sin cajón lo cierra.
  useEffect(() => {
    if (presentation !== "rail") setDrawerOpen(false);
  }, [presentation]);

  if (presentation === "dock") return null;

  const openRail = (id?: string) => {
    if (id) setActiveThread(id);
    if (presentation === "docked") setExpanded(true);
    else setDrawerOpen(true);
  };
  const showDocked = presentation === "docked" && expanded;

  return (
    <>
      <View
        aria-label="Asistente"
        nativeID={ASSISTANT_ID}
        role="complementary"
        tabIndex={-1}
        testID="assistant-panel"
        // Acoplado y expandido: columna del ancho elegido (360 px por defecto); si no, el riel de 56 px.
        style={{ width: showDocked ? width : RAIL_WIDTH }}
      >
        {showDocked ? (
          <View className="h-full border-l border-border bg-card">
            <PanelBody
              active={active}
              control={
                <ToggleButton
                  expanded
                  onPress={() => setExpanded(false)}
                  testID="assistant-toggle"
                />
              }
              onSelect={setActiveThread}
              threads={threads}
            />
            {/* Último en el orden del teclado: el borde se alcanza después del contenido. */}
            <ResizeHandle />
          </View>
        ) : (
          <Rail covered={open} onOpen={openRail} threads={threads} toggleRef={toggleRef} />
        )}
      </View>
      {open ? (
        <>
          <Pressable
            aria-hidden
            className="absolute inset-0 z-10 bg-scrim/55"
            onPress={closeDrawer}
            tabIndex={-1}
            testID="assistant-scrim"
          />
          <View
            // Diálogo no modal: el landmark «Asistente» es el del panel (axe `landmark-unique`).
            aria-label="Panel del asistente"
            className="absolute inset-y-0 right-0 z-20 border-l border-border bg-card"
            ref={drawerRef}
            role="dialog"
            style={{ width }}
            tabIndex={-1}
            testID="assistant-drawer"
          >
            <PanelBody
              active={active}
              control={
                <ToggleButton expanded onPress={closeDrawer} testID="assistant-drawer-close" />
              }
              onSelect={setActiveThread}
              threads={threads}
            />
            <ResizeHandle />
          </View>
        </>
      ) : null}
    </>
  );
}
