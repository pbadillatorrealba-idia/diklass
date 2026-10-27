import { create } from "zustand";

/**
 * Un solo micrófono (asistente-conversacional «Grabar, revisar y enviar audio»): la escucha de una
 * consulta vive en su pantalla, pero el chat es del shell, así que la escucha activa se publica aquí
 * para que el botón de grabar del chat quede deshabilitado explicando por qué.
 */
export const useMicLockStore = create<{
  listenActive: boolean;
  setListenActive: (active: boolean) => void;
}>()((set) => ({
  listenActive: false,
  setListenActive: (listenActive) => set({ listenActive }),
}));

export const LISTEN_BLOCK_REASON = "La escucha de la consulta usa el micrófono.";
