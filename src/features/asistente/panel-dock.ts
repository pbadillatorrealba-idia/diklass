import { createContext, type ReactNode, use } from "react";

/**
 * Dock de asistente en compacto (design.md D7): el shell publica la cinta aquí y cada pantalla la
 * pinta en su barra al pie, porque en iOS/Android la barra de pestañas es del sistema y solo
 * dentro de la pantalla se puede poner algo justo sobre ella. `null`: sin dock (escritorio).
 */
const DockContext = createContext<ReactNode>(null);

export const DockProvider = DockContext;

export const useDock = () => use(DockContext);
