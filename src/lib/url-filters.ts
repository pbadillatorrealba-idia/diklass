import type { Href } from "expo-router";
import { useEffect, useRef, useState } from "react";

/** Pausa al escribir antes de subir el valor de un filtro a la URL. */
const FILTER_DEBOUNCE_MS = 300;

/** Href de `path` con solo los parámetros que tienen valor. */
export function hrefWithParams(path: string, params: Record<string, string | undefined>): Href {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return (query ? `${path}?${query}` : path) as Href;
}

/** Campo de texto cuyo valor sube a la URL tras una pausa al escribir. */
export function useDebouncedParam(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  // Solo un cambio externo de la URL (p. ej. «Limpiar filtros») reinicia el borrador: el eco
  // de lo que este campo ya subió no debe pisar lo que se siguió escribiendo.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);
  useEffect(() => {
    if (draft === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = draft;
      commit.current(draft);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  return [draft, setDraft] as const;
}
