/**
 * RUT chileno. Forma canónica guardada: cuerpo sin puntos, guion y dígito verificador en
 * mayúscula (`12345678-5`, `7654321-K`). La base la revisa igual (`rut_is_valid`, migración 018).
 */

/** Quita puntos, espacios y guion, y pasa a mayúscula: `12.345.678-5` → `123456785`. */
const compact = (value: string) => value.replace(/[.\s-]/g, "").toUpperCase();

/** Dígito verificador por módulo 11 del cuerpo numérico. */
export function rutCheckDigit(body: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body.charAt(i)) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  return rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
}

/** Forma canónica de un RUT válido, o `null` si el formato o el dígito verificador fallan. */
export function normalizeRut(value: string): string | null {
  const text = compact(value);
  const match = /^(\d{7,8})([0-9K])$/.exec(text);
  if (!match) return null;
  const [, body = "", dv = ""] = match;
  return rutCheckDigit(body) === dv ? `${body}-${dv}` : null;
}

/** `12345678-5` → `12.345.678-5`, para mostrar. Un valor no canónico se devuelve igual. */
export function formatRut(rut: string): string {
  const match = /^(\d{7,8})-([0-9K])$/.exec(rut);
  if (!match) return rut;
  const [, body = "", dv = ""] = match;
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
