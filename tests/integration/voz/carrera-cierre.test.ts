import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { startListenSession } from "@/features/voz/listen-session-service";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";
import { nuevaConsultaVoz } from "./consulta-voz";

/**
 * Carrera de cierre de los guardas de la 011 (FR-014 · US6-AC14 · SC-027 · D8 · D10), antes
 * verificada a mano con dos sesiones `psql`. pgTap no ejerce dos sesiones, así que aquí la
 * conexión A (Postgres directo) cierra y deja su transacción abierta, y la B (la API, como
 * la app) escribe en paralelo: sin `FOR SHARE` la B lee la fila vieja y entra; con él espera a
 * la A y falla cerrado. Corre solo con Supabase viva (`SUPABASE_LIVE_TESTS=1`).
 */

const dbUrl =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe.skipIf(!isLiveSupabase)("carrera de cierre con FOR SHARE (integración viva)", () => {
  let ana: LiveVeterinarian;
  let admin: SQL;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    admin = new SQL(dbUrl);
  });

  afterAll(async () => {
    await admin.close();
  });

  /** Espera a que alguna escritura quede bloqueada por un lock de fila (la B esperando a la A). */
  async function esperarBloqueo(): Promise<void> {
    for (let intento = 0; intento < 50; intento++) {
      const [fila] = await admin`select count(*)::int as n from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'`;
      if (fila.n > 0) return;
      await Bun.sleep(100);
    }
    throw new Error("La escritura de B no quedó esperando a la transacción de A.");
  }

  /**
   * Abre la transacción A, corre `ejecutarA` sin confirmar, lanza la escritura B y la deja
   * bloqueada, confirma A y devuelve el error con el que termina B.
   */
  async function carrera(
    ejecutarA: (tx: SQL) => Promise<unknown>,
    escrituraB: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    const a = await admin.reserve();
    try {
      await a`begin`;
      // Solo para el UPDATE de A: sin los triggers de dominio, que exigen aprobar la epicrisis.
      await a`set local session_replication_role = replica`;
      await ejecutarA(a);
      const b = Promise.resolve(escrituraB());
      await esperarBloqueo();
      await a`commit`;
      return (await b).error;
    } finally {
      a.release();
    }
  }

  test("activar la escucha mientras la consulta se cierra espera y falla con CONSULTATION_NOT_OPEN", async () => {
    const consultationId = await nuevaConsultaVoz(ana);
    const error = await carrera(
      (a) =>
        a`update public.clinical_records
          set content = content || '{"status":"closed"}'::jsonb where id = ${consultationId}`,
      () =>
        ana.client
          .from("listening_sessions")
          .insert({ clinic_id: ana.clinicId, consultation_id: consultationId }),
    );
    expect(error?.message).toContain("CONSULTATION_NOT_OPEN");
    const [fila] = await admin`select count(*)::int as n from public.listening_sessions
      where consultation_id = ${consultationId}`;
    expect(fila.n).toBe(0);
  });

  test("anexar un tramo mientras la consulta se cierra falla con CONSULTATION_NOT_OPEN", async () => {
    const consultationId = await nuevaConsultaVoz(ana);
    const sesión = await startListenSession(ana.client, { clinicId: ana.clinicId, consultationId });
    const error = await carrera(
      (a) =>
        a`update public.clinical_records
          set content = content || '{"status":"closed"}'::jsonb where id = ${consultationId}`,
      () => insertarTramo(sesión.id),
    );
    expect(error?.message).toContain("CONSULTATION_NOT_OPEN");
  });

  test("anexar un tramo mientras la sesión se cierra falla con LISTENING_SESSION_NOT_ACTIVE", async () => {
    const consultationId = await nuevaConsultaVoz(ana);
    const sesión = await startListenSession(ana.client, { clinicId: ana.clinicId, consultationId });
    const error = await carrera(
      (a) => a`update public.listening_sessions set state = 'stopped' where id = ${sesión.id}`,
      () => insertarTramo(sesión.id),
    );
    expect(error?.message).toContain("LISTENING_SESSION_NOT_ACTIVE");
    const [fila] = await admin`select count(*)::int as n from public.transcript_segments
      where listening_session_id = ${sesión.id}`;
    expect(fila.n).toBe(0);
  });

  function insertarTramo(listenSessionId: string) {
    const ahora = new Date().toISOString();
    return ana.client.from("transcript_segments").insert({
      listening_session_id: listenSessionId,
      clinic_id: ana.clinicId,
      seq: 0,
      started_at: ahora,
      ended_at: ahora,
      text: "Ladra todos los días",
      quality: "ok",
    });
  }
});
