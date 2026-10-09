import type { SupabaseClient } from "@supabase/supabase-js";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Búsqueda de pacientes en el servidor (RPC `search_patients`): filtros, orden por columna y
 * paginación. El filtro de fechas llega como `YYYY-MM-DD` y se traduce a un rango UTC
 * semiabierto [desde, hasta + 1 día).
 */

export const PATIENT_PAGE_SIZE = 25;

export const PATIENT_SORT_COLUMNS = ["name", "species", "breed", "last_visit", "tutor"] as const;
export type PatientSortColumn = (typeof PATIENT_SORT_COLUMNS)[number];
export type SortDirection = "asc" | "desc";

export type PatientSearchParams = {
  name?: string;
  breed?: string;
  tutorId?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  visitFrom?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  visitTo?: string;
  sort: PatientSortColumn;
  dir: SortDirection;
  /** Desde 1. */
  page: number;
};

export type PatientRow = {
  id: string;
  name: string;
  species: string;
  breed: string;
  tutorId: string;
  tutorName: string | null;
  lastVisitAt: string | null;
};

export type PatientPage = { rows: PatientRow[]; total: number };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha válida `YYYY-MM-DD` o `undefined`: lo demás es entrada del usuario y se ignora. */
export function validDateOnly(value: string | undefined): string | undefined {
  if (!(value && DATE_ONLY.test(value))) return undefined;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? undefined : value;
}

function startOfDayUtc(date: string): string {
  return `${date}T00:00:00Z`;
}

function startOfNextDayUtc(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export async function searchPatients(
  client: SupabaseClient<Database>,
  params: PatientSearchParams,
): Promise<PatientPage> {
  const requestId = makeRequestId();
  const from = validDateOnly(params.visitFrom);
  const to = validDateOnly(params.visitTo);
  try {
    const { data, error } = await client.rpc("search_patients", {
      p_name: params.name?.trim() || undefined,
      p_breed: params.breed?.trim() || undefined,
      p_tutor_id: params.tutorId || undefined,
      p_visit_from: from ? startOfDayUtc(from) : undefined,
      p_visit_to: to ? startOfNextDayUtc(to) : undefined,
      p_sort: params.sort,
      p_dir: params.dir,
      p_limit: PATIENT_PAGE_SIZE,
      p_offset: (Math.max(params.page, 1) - 1) * PATIENT_PAGE_SIZE,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      total: Number(rows[0]?.total_count ?? 0),
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        species: row.species,
        breed: row.breed,
        tutorId: row.tutor_id,
        tutorName: row.tutor_name,
        lastVisitAt: row.last_visit_at,
      })),
    };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "searchPatients",
      requestId,
    });
    throw error;
  }
}
