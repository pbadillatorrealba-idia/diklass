/**
 * Enlaces del markdown del asistente (asistente-conversacional «Markdown seguro»): solo `http(s)` o una
 * ruta interna de la app. Todo lo demás —`javascript:`, `data:`, `mailto:`, `//host`— se muestra como
 * texto, nunca como enlace.
 */
export const isInternalHref = (href: string) => /^\/(?!\/)/.test(href);

export function isSafeHref(href: string): boolean {
  if (isInternalHref(href)) return true;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return new URL(href).host !== "";
  } catch {
    return false;
  }
}

/** Destino visible de un enlace externo, para que el veterinario vea a dónde va. */
export function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}
