// Solo lo que usan las pruebas de componentes (design.md D11); evita añadir @types/react-dom.
declare module "react-dom/server" {
  import type { ReactNode } from "react";
  export function renderToStaticMarkup(element: ReactNode): string;
}
