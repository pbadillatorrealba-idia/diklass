/**
 * Vocabularios cerrados de la ficha del paciente. Los valores son los que viajan al contenido
 * (y los que revisa el `check` de la migración 018); las etiquetas son solo de interfaz.
 * Agregar una especie o un estado exige migración: el `check` de la base los enumera.
 */

export const SPECIES = ["canino", "felino"] as const;
export const SEXES = ["macho", "hembra"] as const;
export const REPRODUCTIVE_STATUSES = ["entero", "esterilizado"] as const;

export type Species = (typeof SPECIES)[number];
export type Sex = (typeof SEXES)[number];
export type ReproductiveStatus = (typeof REPRODUCTIVE_STATUSES)[number];

export const SPECIES_LABELS: Record<Species, string> = { canino: "Canino", felino: "Felino" };
export const SEX_LABELS: Record<Sex, string> = { macho: "Macho", hembra: "Hembra" };
export const REPRODUCTIVE_LABELS: Record<ReproductiveStatus, string> = {
  entero: "Entero/a",
  esterilizado: "Esterilizado/a",
};

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export const SPECIES_OPTIONS = options(SPECIES_LABELS);
export const SEX_OPTIONS = options(SEX_LABELS);
export const REPRODUCTIVE_OPTIONS = options(REPRODUCTIVE_LABELS);

/** Etiqueta de lectura de un valor del catálogo; un valor ajeno (dato previo) se muestra tal cual. */
export const catalogLabel = (labels: Record<string, string>, value: string) =>
  labels[value] ?? value;
