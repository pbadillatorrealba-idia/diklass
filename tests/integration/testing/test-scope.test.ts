import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SQL } from "bun";
import { PACIENTES_DEMO } from "../../../scripts/demo/datos-demo";
import { patientContent } from "../../support/rut";
import { resolveTestConfig } from "../../support/test-config";
import {
  createScopeFiles,
  readTestActors,
  recordTestDatasetKey,
  recoverTestScope,
  rememberTestRows,
  reserveTestRutBody,
  reserveTestStorageObject,
  type TestScope,
  withTestScope,
} from "../../support/test-scope";

const enabled = process.env.TEST_LIFECYCLE_TESTS === "1";
const config = resolveTestConfig(process.env, enabled);

describe.skipIf(!enabled)("ciclo de vida en backend exclusivo (FR-134–FR-136)", () => {
  test("recupera una creación sin ID devuelto y conserva el fallo original", async () => {
    if (!config) throw new Error("Falta configuración");
    let scope: TestScope | undefined;
    const sql = new SQL(config.databaseUrl, { max: 1 });
    const before = await sql`select id from public.clinical_records order by id`;
    try {
      await expect(
        withTestScope(config, "respuesta-perdida", async (env, current) => {
          scope = current;
          const actor = readTestActors(env)[0];
          if (!actor) throw new Error("Falta actor");
          const client = createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const signed = await client.auth.signInWithPassword(actor);
          expect(signed.error).toBeNull();
          expect((await client.rpc("start_access_session")).error).toBeNull();
          // No select ni ID retornado: solo la intención durable de su actor permite reconciliarlo.
          const inserted = await client.from("clinical_records").insert({
            clinic_id: current.state.clinicId,
            record_type: "patient",
            content: patientContent("Luna"),
            status: "draft",
          });
          expect(inserted.error).toBeNull();
          const messageId = crypto.randomUUID();
          const path = `${current.state.clinicId}/${signed.data.user?.id}/${messageId}.webm`;
          reserveTestStorageObject("assistant-audio", path, env);
          const admin = createClient(config.url, config.serviceRoleKey as string, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          expect(
            (
              await admin.storage
                .from("assistant-audio")
                .upload(path, new Uint8Array(16), { contentType: "audio/webm" })
            ).error,
          ).toBeNull();
          throw new Error("aserción deliberada después de confirmar el servidor");
        }),
      ).rejects.toThrow("aserción deliberada");
      expect(scope).toBeDefined();
      const state = JSON.parse(readFileSync((scope as TestScope).path, "utf8"));
      expect(state.status).toBe("clean");
      expect(state.resources.clinical_records.length).toBe(1);
      expect(state.resources.clinical_audit_events.length).toBeGreaterThan(0);
      expect(await sql`select id from public.clinical_records order by id`).toEqual(before);
      expect(
        await sql`select id from public.clinics where id = ${(scope as TestScope).state.clinicId}::uuid`,
      ).toHaveLength(0);
      expect(
        await sql`select id from auth.users where email = any(${sql.array(state.actorEmails, "TEXT")}::text[])`,
      ).toHaveLength(0);
      expect(
        await sql`select id from storage.objects where name = ${state.storage[0].name}`,
      ).toHaveLength(0);
      await recoverTestScope(config, (scope as TestScope).path);
    } finally {
      await sql.close();
    }
  }, 30000);
  test("el lock rechaza otro runner antes de ejecutar su caso", async () => {
    if (!config) throw new Error("Falta configuración");
    await withTestScope(config, "lock", async () => {
      let entered = false;
      await expect(
        withTestScope(config, "segundo-runner", async () => {
          entered = true;
        }),
      ).rejects.toThrow("ocupada");
      expect(entered).toBe(false);
    });
  }, 30000);

  test("SIGKILL conserva intención y recupera Auth, filas y Storage sin tocar el demo", async () => {
    if (!config) throw new Error("Falta configuración");
    const beforeFiles = new Set(readdirSync("test-results/scopes"));
    const sql = new SQL(config.databaseUrl, { max: 1 });
    const before = await sql`select id from public.clinical_records order by id`;
    const beforeQuota =
      await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
    try {
      const program = `
        import {createClient} from "@supabase/supabase-js";
        import {resolveTestConfig} from "./tests/support/test-config";
        import {withTestScope, readTestActors, reserveTestEmail, reserveTestStorageObject} from "./tests/support/test-scope";
        import {patientContent} from "./tests/support/rut";
        const config = resolveTestConfig(process.env,true);
        await withTestScope(config,"interrupcion",async (env,scope)=>{
          const actor = readTestActors(env)[0];
          const client = createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
          const signed = await client.auth.signInWithPassword(actor);
          if(signed.error)throw new Error("No inició sesión");
          if((await client.rpc("start_access_session")).error)throw new Error("No inició sesión de acceso");
          if((await client.from("clinical_records").insert({clinic_id:scope.state.clinicId,record_type:"patient",content:patientContent("Luna"),status:"draft"})).error)throw new Error("No creó paciente");
          const admin=createClient(config.url,config.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
          const email=reserveTestEmail("signup",env);
          if((await admin.auth.admin.createUser({email,password:crypto.randomUUID(),email_confirm:true})).error)throw new Error("No creó Auth extra");
          const path=scope.state.clinicId+"/"+signed.data.user.id+"/"+crypto.randomUUID()+".webm";
          reserveTestStorageObject("assistant-audio",path,env);
          if((await admin.storage.from("assistant-audio").upload(path,new Uint8Array(16),{contentType:"audio/webm"})).error)throw new Error("No subió audio");
          if((await admin.rpc("consume_client_error_quota",{p_bucket_key:scope.state.id,p_limit:30})).error)throw new Error("No consumió cuota");
          process.kill(process.pid,"SIGKILL");
        });
      `;
      const child = Bun.spawn([process.execPath, "-e", program], {
        env: process.env,
        stdout: "ignore",
        stderr: "pipe",
      });
      const failure = await new Response(child.stderr).text();
      expect(await child.exited).toBe(137);
      expect(failure).toBe("");
      const files = readdirSync("test-results/scopes").filter(
        (file) => file.endsWith(".scope.json") && !beforeFiles.has(file),
      );
      expect(files).toHaveLength(1);
      const path = `test-results/scopes/${files[0]}`;
      const state = JSON.parse(readFileSync(path, "utf8"));
      expect(state.status).toBe("pending");
      expect(state.actorEmails).toHaveLength(4);
      expect(
        await sql`select id from public.clinical_records where clinic_id = ${state.clinicId}::uuid`,
      ).toHaveLength(1);
      await recoverTestScope(config, path);
      expect(JSON.parse(readFileSync(path, "utf8")).status).toBe("clean");
      expect(JSON.parse(readFileSync(path, "utf8")).restoredSharedQuota).toBe(true);
      expect(
        await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`,
      ).toEqual(beforeQuota);
      expect(await sql`select id from public.clinical_records order by id`).toEqual(before);
      expect(
        await sql`select id from auth.users where email = any(${sql.array(state.actorEmails, "TEXT")}::text[])`,
      ).toHaveLength(0);
      expect(
        await sql`select id from storage.objects where name = ${state.storage[0].name}`,
      ).toHaveLength(0);
    } finally {
      await sql.close();
    }
  }, 30000);

  test("bloques RUT no se reutilizan entre scopes de dos ejecuciones", async () => {
    if (!config) throw new Error("Falta configuración");
    let first = 0;
    await withTestScope(config, "rut-primero", async (env) => {
      first = reserveTestRutBody(env);
    });
    await withTestScope(config, "rut-segundo", async (env) => {
      expect(reserveTestRutBody(env)).toBeGreaterThan(first + 9999);
    });
  }, 30000);

  test("conserva código hijo y reporte cuando falla limpieza; la recuperación reintenta", async () => {
    if (!config) throw new Error("Falta configuración");
    const credentials = config.serviceRoleKey;
    let path = "";
    let failure: unknown;
    try {
      await withTestScope(config, "limpieza-fallida", async (_env, scope) => {
        path = scope.path;
        config.serviceRoleKey = "invalid";
        return 42;
      });
    } catch (error) {
      failure = error;
    } finally {
      config.serviceRoleKey = credentials;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as Error).message).toContain("42");
    const state = JSON.parse(readFileSync(path, "utf8"));
    expect(state.status).toBe("residue");
    expect(state.childExitCode).toBe(42);
    await recoverTestScope(config, path);
    expect(JSON.parse(readFileSync(path, "utf8")).status).toBe("clean");
  }, 30000);
  test("elimina correctivas, voz, conocimiento y cuotas propias en orden FK sin ampliar permisos", async () => {
    if (!config) throw new Error("Falta configuración");
    const sql = new SQL(config.databaseUrl, { max: 1 });
    const baseline = await sql`select id from public.clinical_audit_events order by id`;
    let path = "";
    try {
      await withTestScope(config, "grafo-completo", async (env, scope) => {
        path = scope.path;
        const actor = readTestActors(env)[0];
        const template = PACIENTES_DEMO[0];
        if (!actor || !template) throw new Error("Faltan plantillas");
        recordTestDatasetKey(template.key, env);
        const client = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        expect((await client.auth.signInWithPassword(actor)).error).toBeNull();
        expect((await client.rpc("start_access_session")).error).toBeNull();
        const clinic_id = scope.state.clinicId;
        const patient = await client
          .from("clinical_records")
          .insert({
            clinic_id,
            record_type: "patient",
            content: patientContent(template.ficha.name),
            status: "draft",
          })
          .select("id")
          .single();
        expect(patient.error).toBeNull();
        const consultation = await client
          .from("clinical_records")
          .insert({
            clinic_id,
            record_type: "consultation",
            content: { patientId: patient.data?.id, status: "open" },
            status: "draft",
          })
          .select("id")
          .single();
        expect(consultation.error).toBeNull();
        const listening = await client
          .from("listening_sessions")
          .insert({ clinic_id, consultation_id: consultation.data?.id })
          .select("id")
          .single();
        expect(listening.error).toBeNull();
        const now = new Date().toISOString();
        expect(
          (
            await client.from("transcript_segments").insert({
              clinic_id,
              listening_session_id: listening.data?.id,
              seq: 0,
              started_at: now,
              ended_at: now,
              text: "Ladra",
              quality: "ok",
            })
          ).error,
        ).toBeNull();
        const source = await client
          .from("knowledge_documents")
          .insert({
            clinic_id,
            content: {
              bibliografia: {
                titulo: "Guía",
                autores: ["Equipo"],
                anio: 2026,
                revista: null,
                editorial: null,
                edicion: null,
                doi: null,
                url: null,
              },
              licencia: { tipo: "CC BY 4.0", nota: "Sintética" },
              fragmentos: [
                { ordinal: 1, seccion: "Síntesis", texto: "Contenido clínico ficticio." },
              ],
            },
          })
          .select("id")
          .single();
        expect(source.error).toBeNull();
        expect(
          (
            await client.from("knowledge_queries").insert({
              clinic_id,
              patient_id: patient.data?.id,
              question: "Consulta",
              answer: { pregunta: "Consulta", segmentos: [], cobertura: [], avisos: [] },
            })
          ).error,
        ).toBeNull();
        const event = await client
          .from("clinical_audit_events")
          .select("id")
          .eq("entity_id", patient.data?.id)
          .single();
        expect(event.error).toBeNull();
        expect(
          (
            await client.from("clinical_records").insert({
              clinic_id,
              record_type: "patient",
              content: patientContent(template.ficha.name),
              status: "corrective",
              supersedes_event_id: event.data?.id,
            })
          ).error,
        ).toBeNull();
        expect(
          (await client.from("assistant_voice_consent").insert({ version: "v1" })).error,
        ).toBeNull();
        expect((await client.rpc("consume_assistant_audio_quota")).data).toBe("ok");
        expect(
          (
            await client.from("assistant_messages").insert({
              clinic_id,
              patient_id: patient.data?.id,
              role: "user",
              parts: [{ type: "text", text: "Consulta" }],
              status: "done",
            })
          ).error,
        ).toBeNull();
        expect(
          (await client.from("clinical_records").delete().eq("id", patient.data?.id)).error?.code,
        ).toBe("42501");
        expect(
          (await client.from("clinical_audit_events").delete().eq("id", event.data?.id)).error
            ?.code,
        ).toBe("42501");
      });
      const state = JSON.parse(readFileSync(path, "utf8"));
      expect(state.status).toBe("clean");
      for (const table of [
        "clinical_records",
        "clinical_audit_events",
        "assistant_messages",
        "assistant_audio_usage",
        "assistant_voice_consent",
        "knowledge_documents",
        "knowledge_queries",
        "knowledge_fragments",
        "listening_sessions",
        "transcript_segments",
      ])
        expect(state.resources[table].length).toBeGreaterThan(0);
      expect(await sql`select id from public.clinical_audit_events order by id`).toEqual(baseline);
    } finally {
      await sql.close();
    }
  }, 30000);
  test("el journal conserva IDs borrados por RPC y distingue borrados del producto", async () => {
    if (!config) throw new Error("Falta configuración");
    let path = "";
    const messageId = crypto.randomUUID();
    await withTestScope(config, "journal-rpc", async (env, scope) => {
      path = scope.path;
      const actor = readTestActors(env)[0];
      if (!actor) throw new Error("Falta actor");
      const client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      expect((await client.auth.signInWithPassword(actor)).error).toBeNull();
      expect((await client.rpc("start_access_session")).error).toBeNull();
      expect(
        (
          await client.from("assistant_messages").insert({
            id: messageId,
            clinic_id: scope.state.clinicId,
            role: "user",
            parts: [{ type: "text", text: "Consulta" }],
            status: "done",
          })
        ).error,
      ).toBeNull();
      const before = await client.from("assistant_messages").select("*");
      expect(before.error).toBeNull();
      rememberTestRows("assistant_messages", before.data ?? [], env);
      expect((await client.rpc("delete_assistant_conversation")).error).toBeNull();
    });
    const state = JSON.parse(readFileSync(path, "utf8"));
    expect(state.discovered.assistant_messages).toContainEqual({ id: messageId });
    expect(state.removedByProduct.assistant_messages).toContainEqual({ id: messageId });
    expect(state.deleted.assistant_messages ?? []).not.toContainEqual({ id: messageId });
  }, 30000);

  test("la recuperación usa identidad durable del entorno y tolera cambiar contenedor", async () => {
    if (!config) throw new Error("Falta configuración");
    let path = "";
    await withTestScope(config, "identidad-durable", async (_env, scope) => {
      path = scope.path;
    });
    const state = JSON.parse(readFileSync(path, "utf8"));
    state.status = "pending";
    state.containerId = "contenedor-anterior";
    writeFileSync(path, JSON.stringify(state));
    await recoverTestScope(config, path);
    const recovered = JSON.parse(readFileSync(path, "utf8"));
    expect(recovered.status).toBe("clean");
    expect(recovered.environmentId).toMatch(/^[0-9a-f-]{36}$/);
  }, 30000);
  test("un ID ajeno en el journal falla cerrado y preserva ambos conjuntos", async () => {
    if (!config) throw new Error("Falta configuración");
    const sql = new SQL(config.databaseUrl, { max: 1 });
    let own: TestScope | undefined;
    let sentinel: TestScope | undefined;
    let failure: unknown;
    try {
      try {
        await withTestScope(config, "journal-ajeno", async (env, scope) => {
          own = scope;
          sentinel = createScopeFiles("test-results/scopes", "centinela-journal", {
            ...config,
            containerId: scope.state.containerId,
            environmentId: scope.state.environmentId,
          });
          await sql`insert into public.clinics(id,name) values(${sentinel.state.clinicId}::uuid,'Clínica Veterinaria Los Aromos')`;
          rememberTestRows("clinics", [{ id: sentinel.state.clinicId }], env);
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      expect(
        (failure as AggregateError).errors.some(
          (error) => error instanceof Error && error.message.includes("propiedad"),
        ),
      ).toBe(true);
      if (!own || !sentinel) throw new Error("Faltan scopes");
      expect(
        await sql`select id from public.clinics where id=any(${sql.array([own.state.clinicId, sentinel.state.clinicId], "TEXT")}::uuid[])`,
      ).toHaveLength(2);
      expect(
        await sql`select id from public.veterinarians where clinic_id=${own.state.clinicId}::uuid`,
      ).toHaveLength(3);
    } finally {
      if (own) {
        const state = JSON.parse(readFileSync(own.path, "utf8"));
        delete state.remembered.clinics;
        writeFileSync(own.path, JSON.stringify(state));
        await recoverTestScope(config, own.path);
      }
      if (sentinel) await recoverTestScope(config, sentinel.path);
      await sql.close();
    }
  }, 30000);

  test("una marca durable diferente bloquea recuperación aunque proyecto y puertos coincidan", async () => {
    if (!config) throw new Error("Falta configuración");
    let path = "";
    await withTestScope(config, "marca-ajena", async (_env, scope) => {
      path = scope.path;
    });
    const original = readFileSync(path, "utf8");
    const state = JSON.parse(original);
    state.status = "pending";
    state.environmentId = crypto.randomUUID();
    writeFileSync(path, JSON.stringify(state));
    try {
      await expect(recoverTestScope(config, path)).rejects.toThrow("identidad durable");
    } finally {
      writeFileSync(path, original);
    }
  }, 30000);
  test("restaura cuotas exactas tras incremento, purga y fallo del hijo", async () => {
    if (!config) throw new Error("Falta configuración");
    const sql = new SQL(config.databaseUrl, { max: 1 });
    const key = `quota-${crypto.randomUUID()}`;
    const other = `quota-${crypto.randomUUID()}`;
    const added = `quota-${crypto.randomUUID()}`;
    let path = "";
    try {
      await sql`insert into private.client_error_quota(bucket_key,window_start,hits) values(${key},date_trunc('minute',timezone('utc',now()))-interval '20 minutes',7),(${key},date_trunc('minute',timezone('utc',now())),9),(${other},date_trunc('minute',timezone('utc',now())),11)`;
      const baseline =
        await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
      await expect(
        withTestScope(config, "snapshot-cuotas", async (_env, scope) => {
          path = scope.path;
          const admin = createClient(config.url, config.serviceRoleKey as string, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          expect(
            (await admin.rpc("consume_client_error_quota", { p_bucket_key: key, p_limit: 30 }))
              .error,
          ).toBeNull();
          expect(
            (await admin.rpc("consume_client_error_quota", { p_bucket_key: added, p_limit: 30 }))
              .error,
          ).toBeNull();
          expect(
            await sql<
              { hits: number }[]
            >`select hits from private.client_error_quota where bucket_key=${key} order by window_start`,
          ).toEqual([{ hits: 10 }]);
          throw new Error("fallo deliberado después de cuota");
        }),
      ).rejects.toThrow("fallo deliberado después de cuota");
      expect(
        await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`,
      ).toEqual(baseline);
      const state = JSON.parse(readFileSync(path, "utf8"));
      expect(state.restoredSharedQuota).toBe(true);
      expect(statSync(path.replace(".scope.json", ".quota.json")).mode & 0o777).toBe(0o600);
      expect(readFileSync(path, "utf8")).not.toContain(key);
    } finally {
      const rows =
        await sql`select bucket_key,window_start::text from private.client_error_quota where bucket_key=any(${sql.array([key, other, added], "TEXT")}::text[])`;
      for (const row of rows)
        await sql`delete from private.client_error_quota where bucket_key=${row.bucket_key} and window_start=${row.window_start}::timestamptz`;
      await sql.close();
    }
  }, 30000);
  test("un setup anterior al snapshot no inventa baseline vacío ni borra cuotas", async () => {
    if (!config) throw new Error("Falta configuración");
    const sql = new SQL(config.databaseUrl, { max: 1 });
    const key = `quota-${crypto.randomUUID()}`;
    try {
      const marker =
        await sql`select instance_id from testsupport.environment where singleton=true`;
      const scope = createScopeFiles("test-results/scopes", "antes-snapshot", {
        ...config,
        environmentId: marker[0]?.instance_id,
      });
      await sql`insert into private.client_error_quota(bucket_key,window_start,hits) values(${key},date_trunc('minute',timezone('utc',now())),6)`;
      const before =
        await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
      await recoverTestScope(config, scope.path);
      expect(
        await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`,
      ).toEqual(before);
      expect(JSON.parse(readFileSync(scope.path, "utf8")).restoredSharedQuota).toBeUndefined();
    } finally {
      const rows =
        await sql`select window_start::text from private.client_error_quota where bucket_key=${key}`;
      for (const row of rows)
        await sql`delete from private.client_error_quota where bucket_key=${key} and window_start=${row.window_start}::timestamptz`;
      await sql.close();
    }
  }, 30000);
});
