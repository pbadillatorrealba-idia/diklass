import { describe, expect, mock, test } from "bun:test";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryState, type QueryStateProps } from "@/components/ui/query-state";
import { Text } from "@/components/ui/text";

// sistema-visual FR-085 · SC-056 · design.md D13: cuatro estados con precedencia
// cargando > error > vacío > contenido; el vacío nunca aparece durante la primera carga.
const base: QueryStateProps = {
  errorMessage: "No pudimos cargar los pacientes.",
  isPending: false,
  error: null,
  isEmpty: false,
  onRetry: () => {},
  testID: "patients",
  empty: <Text testID="patients-empty">Aún no hay pacientes registrados.</Text>,
  children: <Text testID="patients-content">Firulais</Text>,
};

const render = (props: Partial<QueryStateProps>) =>
  renderToStaticMarkup(<QueryState {...base} {...props} />);

/** Busca en el árbol de elementos (sin DOM) el primero con `onPress`. */
function findOnPress(node: ReactNode): (() => void) | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findOnPress(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as { onPress?: () => void; children?: ReactNode };
  if (props.onPress) return props.onPress;
  if (typeof node.type === "function" && node.type !== QueryState) {
    // Componentes propios sin hooks (Callout): se expanden para llegar al botón.
    try {
      const expanded = (node.type as (p: unknown) => ReactNode)(node.props);
      const found = findOnPress(expanded);
      if (found) return found;
    } catch {
      // Un componente con hooks no se puede llamar fuera de React: se miran sus hijos.
    }
  }
  return findOnPress(props.children);
}

describe("QueryState", () => {
  test("durante la carga muestra «Cargando…» con aria-busy y nunca el vacío", () => {
    const html = render({ isPending: true, isEmpty: true });
    expect(html).toContain("Cargando…");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-testid="patients-loading"');
    expect(html).not.toContain("patients-empty");
    expect(html).not.toContain("patients-content");
  });

  test("con error muestra el mensaje en un Callout de error y la acción «Reintentar»", () => {
    const html = render({ error: new Error("red"), isEmpty: true });
    expect(html).toContain('data-testid="patients-status"');
    expect(html).toContain("No pudimos cargar los pacientes.");
    expect(html).toContain(">Reintentar<");
    expect(html).toMatch(/data-class="[^"]*border-destructive/);
    expect(html).not.toContain("patients-empty");
    expect(html).not.toContain("patients-content");
  });

  test("«Reintentar» llama a onRetry", () => {
    const onRetry = mock(() => {});
    const tree = QueryState({ ...base, error: new Error("red"), onRetry });
    const press = findOnPress(tree);
    expect(press).not.toBeNull();
    press?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("sin datos tras cargar muestra el vacío", () => {
    const html = render({ isEmpty: true });
    expect(html).toContain("Aún no hay pacientes registrados.");
    expect(html).not.toContain("patients-content");
    expect(html).not.toContain("aria-busy");
  });

  test("con datos muestra el contenido", () => {
    const html = render({});
    expect(html).toContain("Firulais");
    expect(html).not.toContain("patients-empty");
    expect(html).not.toContain("patients-loading");
  });

  test("la carga tiene precedencia sobre el error", () => {
    const html = render({ isPending: true, error: new Error("red") });
    expect(html).toContain("Cargando…");
    expect(html).not.toContain("Reintentar");
  });
});
