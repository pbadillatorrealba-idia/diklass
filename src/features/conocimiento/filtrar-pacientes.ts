import type { PatientEntry } from "@/features/registro/ficha-service";

/** Coincidencias que muestra el selector de paciente de `/knowledge` (FR-095 · design.md D19). */
export const MAX_COINCIDENCIAS = 8;

/** Minúsculas y sin tildes: «Ñandú» y «nandu» coinciden. */
function normalizar(texto: string) {
  return (
    texto
      .normalize("NFD")
      // Marcas combinantes (U+0300–U+036F) y no `\p{Diacritic}`: más seguro en Hermes.
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .trim()
  );
}

function coincide({ content }: PatientEntry, termino: string) {
  return [content.name, content.breed, content.species].some((campo) =>
    normalizar(campo ?? "").includes(termino),
  );
}

/** Total de fichas que coinciden, sin tope: es lo que se anuncia (FR-095). */
export function contarCoincidencias(pacientes: PatientEntry[], busqueda: string) {
  const termino = normalizar(busqueda);
  return pacientes.filter((entry) => coincide(entry, termino)).length;
}

/**
 * Pacientes que ofrece el selector: hasta `MAX_COINCIDENCIAS` que coinciden por nombre, raza o
 * especie, y el elegido siempre (primero, si no coincide), para que la selección nunca desaparezca.
 */
export function filtrarPacientes(
  pacientes: PatientEntry[],
  busqueda: string,
  elegidoId: string | null,
): PatientEntry[] {
  const termino = normalizar(busqueda);
  const coincidencias = pacientes
    .filter((entry) => coincide(entry, termino))
    .slice(0, MAX_COINCIDENCIAS);
  const elegido = pacientes.find((entry) => entry.record.id === elegidoId);
  if (!elegido || coincidencias.includes(elegido)) return coincidencias;
  return [elegido, ...coincidencias];
}
