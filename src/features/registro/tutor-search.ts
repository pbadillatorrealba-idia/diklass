import type { SupabaseClient } from "@supabase/supabase-js";
import type { SortDirection } from "@/features/registro/patient-search";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Búsqueda de tutores en el servidor (RPC `search_tutors`, migración 017): filtro por nombre y
 * contacto, orden por columna y paginación. Mismo patrón que `patient-search`.
 */

export const TUTOR_PAGE_SIZE = 25;

export const TUTOR_SORT_COLUMNS = ["name", "patients"] as const;
export type TutorSortColumn = (typeof TUTOR_SORT_COLUMNS)[number];

export type TutorSearchParams = {
  name?: string;
  /** Teléfono o correo. */
  contact?: string;
  sort: TutorSortColumn;
  dir: SortDirection;
  /** Desde 1. */
  page: number;
};

export type TutorRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  patientCount: number;
};

export type TutorPage = { rows: TutorRow[]; total: number };

type SearchTutorsRow = Database["public"]["Functions"]["search_tutors"]["Returns"][number];

const toRow = (row: SearchTutorsRow): TutorRow => ({
  id: row.id,
  fullName: row.full_name,
  phone: row.phone,
  email: row.email,
  patientCount: Number(row.patient_count),
});

export async function searchTutors(
  client: SupabaseClient<Database>,
  params: TutorSearchParams,
): Promise<TutorPage> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client.rpc("search_tutors", {
      p_name: params.name?.trim() || undefined,
      p_contact: params.contact?.trim() || undefined,
      p_sort: params.sort,
      p_dir: params.dir,
      p_limit: TUTOR_PAGE_SIZE,
      p_offset: (Math.max(params.page, 1) - 1) * TUTOR_PAGE_SIZE,
    });
    if (error) throw error;
    const rows = data ?? [];
    return { total: Number(rows[0]?.total_count ?? 0), rows: rows.map(toRow) };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "searchTutors",
      requestId,
    });
    throw error;
  }
}

const norm = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

/**
 * ponytail: mira solo la primera página (25) de la búsqueda por subcadena; con más de 25 tutores
 * cuyo contacto contenga la sonda, un duplicado exacto podría quedar fuera. Mejora: un argumento
 * de igualdad exacta en `search_tutors`.
 *
 * Tutores de la clínica con el mismo teléfono o correo (FR-122). `search_tutors` filtra por
 * subcadena, así que aquí se descarta lo que no coincide exacto. Es una ayuda, no una compuerta:
 * si la búsqueda falla devuelve `[]` y el alta sigue.
 */
export async function findDuplicateTutors(
  client: SupabaseClient<Database>,
  contact: { phone: string | null; email: string | null; excludeId?: string },
): Promise<TutorRow[]> {
  const phone = norm(contact.phone);
  const email = norm(contact.email);
  const probes = [phone, email].filter(Boolean);
  if (probes.length === 0) return [];
  try {
    const pages = await Promise.all(
      probes.map((probe) =>
        searchTutors(client, { contact: probe, sort: "name", dir: "asc", page: 1 }),
      ),
    );
    const found = new Map<string, TutorRow>();
    for (const row of pages.flatMap((page) => page.rows)) {
      const same = (phone && norm(row.phone) === phone) || (email && norm(row.email) === email);
      if (same && row.id !== contact.excludeId) found.set(row.id, row);
    }
    return [...found.values()];
  } catch {
    return [];
  }
}
