import type { ReactNode } from "react";
import { Button, ButtonText } from "./button";
import { Callout } from "./callout";
import { Text } from "./text";

export type QueryStateProps = {
  /** `isPending` de TanStack Query v5: verdadero hasta la primera respuesta. */
  isPending: boolean;
  error: unknown;
  isEmpty: boolean;
  onRetry: () => void;
  errorMessage: string;
  /** Texto que explica qué falta y, si existe, la acción para crearlo. */
  empty: ReactNode;
  /** Prefijo de `testID`: `<testID>-loading` y `<testID>-status`. */
  testID: string;
  children: ReactNode;
};

/**
 * Cuatro estados de una pantalla que carga datos (FR-085 · design.md D13), con precedencia
 * cargando > error > vacío > contenido: el vacío nunca aparece durante la primera carga.
 */
export function QueryState({
  children,
  empty,
  error,
  errorMessage,
  isEmpty,
  isPending,
  onRetry,
  testID,
}: QueryStateProps) {
  if (isPending) {
    return (
      <Text aria-busy testID={`${testID}-loading`} tone="muted">
        Cargando…
      </Text>
    );
  }
  if (error) {
    return (
      <Callout testID={`${testID}-status`} tone="error">
        <Text>{errorMessage}</Text>
        <Button className="self-start" onPress={onRetry} size="sm" variant="outline">
          <ButtonText>Reintentar</ButtonText>
        </Button>
      </Callout>
    );
  }
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
