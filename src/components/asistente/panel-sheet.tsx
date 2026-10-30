import { useCallback } from "react";
import { Modal, Pressable, View } from "react-native";
import { PanelBody } from "@/components/asistente/assistant-panel";
import { Button, ButtonText } from "@/components/ui/button";
import type { PanelThread } from "@/features/asistente/panel-threads";

type PanelSheetProps = {
  open: boolean;
  onClose: () => void;
  threads: readonly PanelThread[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * Hoja del asistente en compacto (sistema-visual «Hoja del asistente en compacto» · design.md D7):
 * modal con el hilo activo, sin animación. Lleva el foco al abrirse, lo atrapa mientras está abierta
 * y lo devuelve a la cinta al cerrarse (el `Modal` de React Native Web lo hace), se cierra con la
 * tecla Escape (`onRequestClose`; en Android, con «atrás») y con un control visible. Cerrarla no
 * detiene la captura: esta hoja solo aloja el hilo, que es de la pantalla.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Tab y Mayús+Tab ciclan dentro del diálogo: el foco no sale hacia la pantalla de atrás (WCAG 2.4.3). */
function trapTab(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget as HTMLElement;
  const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null,
  );
  const first = focusables[0];
  const last = focusables.at(-1);
  if (!(first && last)) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const actual = document.activeElement;
  if (event.shiftKey && (actual === first || actual === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && actual === last) {
    event.preventDefault();
    first.focus();
  }
}

export function PanelSheet({ open, onClose, threads, activeId, onSelect }: PanelSheetProps) {
  const active = threads.find((thread) => thread.id === activeId);
  // Al abrirse, el foco entra en la hoja (WCAG 2.4.3) y Tab cicla dentro de ella. Referencia
  // estable: se ejecuta al montarse, no en cada render (un render mientras se escribe no debe
  // robar el foco). El listener va en el nodo DOM: `View` no declara `onKeyDown`.
  const dialogRef = useCallback((node: View | null) => {
    const dialog = node as unknown as HTMLElement | null;
    if (!dialog?.addEventListener) return;
    dialog.focus({ preventScroll: true });
    dialog.addEventListener("keydown", trapTab);
    return () => dialog.removeEventListener("keydown", trapTab);
  }, []);
  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={open}
    >
      <View accessibilityViewIsModal className="flex-1 justify-end bg-scrim/55">
        {/* El fondo cierra con un toque; no es un control para teclado ni lectores (hay uno visible). */}
        <Pressable
          aria-hidden
          className="flex-1"
          onPress={onClose}
          tabIndex={-1}
          testID="panel-sheet-scrim"
        />
        <View
          aria-label="Asistente"
          aria-modal
          className="rounded-sm border border-border bg-card"
          ref={dialogRef}
          role="dialog"
          // Entre la mitad y el 85 % de la altura: deja ver la pantalla de atrás sin tapar el hilo.
          style={{ maxHeight: "85%", minHeight: "50%" }}
          tabIndex={-1}
          testID="panel-sheet"
        >
          <PanelBody
            active={active}
            control={
              <Button
                accessibilityLabel="Cerrar el asistente"
                className="min-w-touch"
                onPress={onClose}
                size="sm"
                testID="panel-sheet-close"
                variant="outline"
              >
                <ButtonText>Cerrar</ButtonText>
              </Button>
            }
            onSelect={onSelect}
            threads={threads}
            title="Asistente"
          />
        </View>
      </View>
    </Modal>
  );
}
