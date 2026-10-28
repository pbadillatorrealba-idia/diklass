import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SQL } from "bun";
import { DATASET_META } from "../../scripts/demo/metadata-demo";
import { findUserIdByEmail } from "../../scripts/lib/provisioning";
import baseActors from "../fixtures/veterinarians.json";
import { resolveTestConfig, type TestConfig } from "./test-config";

type Environment = Record<string, string | undefined>;
export type TestActor = { email: string; password: string; displayName: string };
type Identity = {
  projectId: string;
  url: string;
  databaseUrl: string;
  containerId?: string;
  environmentId?: string;
};
type Row = Record<string, string>;
export type ScopeState = {
  version: 1;
  id: string;
  label: string;
  projectId: string;
  apiPort: string;
  dbPort: string;
  clinicId: string;
  actorEmails: string[];
  actorIds: string[];
  status: "pending" | "clean" | "residue";
  resources: Record<string, Row[]>;
  discovered?: Record<string, Row[]>;
  remembered?: Record<string, Row[]>;
  removedByProduct?: Record<string, Row[]>;
  deleted?: Record<string, Row[]>;
  storage: { bucket_id: string; name: string }[];
  datasetVersion: string;
  datasetKeys: string[];
  containerId?: string;
  environmentId?: string;
  rutNext?: number;
  rutEnd?: number;
  failure?: string;
  childExitCode?: number;
  childFailed?: boolean;
  sharedQuotaCaptured?: boolean;
  restoredSharedQuota?: boolean;
};
export type TestScope = { path: string; actorsPath: string; state: ScopeState };

// fsync antes de mutar el servidor: el rename por sí solo no hace durable la intención.
function persist(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  const directory = openSync(resolve(path, ".."), "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}
function privateJson(path: string): unknown {
  const stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())
    throw new Error("El archivo de testing debe ser privado, regular y del usuario actual.");
  return JSON.parse(readFileSync(path, "utf8"));
}
export function readTestActors(env: Environment = process.env): TestActor[] {
  if (!env.TEST_ACTORS_FILE) {
    if (env.TEST_BACKEND === "1" || env.TEST_SUPABASE_URL || env.SUPABASE_LIVE_TESTS === "1")
      throw new Error("TEST_ACTORS_FILE es obligatorio en el backend de testing.");
    return baseActors;
  }
  const actors = privateJson(env.TEST_ACTORS_FILE);
  if (
    !Array.isArray(actors) ||
    actors.length !== 3 ||
    actors.some(
      (actor) =>
        !actor ||
        typeof actor.email !== "string" ||
        !actor.email.endsWith("@example.test") ||
        typeof actor.password !== "string" ||
        !actor.password ||
        typeof actor.displayName !== "string",
    )
  )
    throw new Error("Archivo de actores de testing inválido.");
  return actors;
}
export function createScopeFiles(directory: string, label: string, config: Identity): TestScope {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const path = resolve(directory, `${id}.scope.json`);
  const actorsPath = resolve(directory, `${id}.actors.json`);
  const actors = baseActors.map((actor, index) => ({
    ...actor,
    email: `scope.${id}.${index}@example.test`,
    password: randomUUID(),
  }));
  const state: ScopeState = {
    version: 1,
    id,
    label,
    projectId: config.projectId,
    apiPort: new URL(config.url).port,
    dbPort: new URL(config.databaseUrl).port,
    clinicId: randomUUID(),
    actorEmails: actors.map((actor) => actor.email),
    actorIds: [],
    status: "pending",
    resources: {},
    storage: [],
    datasetVersion: DATASET_META.version,
    datasetKeys: [],
    containerId: config.containerId,
    environmentId: config.environmentId,
  };
  persist(path, state);
  persist(actorsPath, actors);
  return { path, actorsPath, state };
}
function loadState(path: string): ScopeState {
  const state = privateJson(path) as ScopeState;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (
    state.version !== 1 ||
    !uuid.test(state.id) ||
    !uuid.test(state.clinicId) ||
    !Array.isArray(state.actorEmails) ||
    state.actorEmails.some(
      (email) =>
        typeof email !== "string" ||
        !email.startsWith(`scope.${state.id}.`) ||
        !email.endsWith("@example.test"),
    )
  )
    throw new Error("Registro de testing inválido.");
  return state;
}
export function reserveTestEmail(label: string, env: Environment = process.env): string {
  if (!env.TEST_SCOPE_FILE)
    throw new Error("TEST_SCOPE_FILE es obligatorio antes de reservar Auth.");
  const state = loadState(env.TEST_SCOPE_FILE);
  if (!/^[a-z0-9-]+$/.test(label) || state.status !== "pending")
    throw new Error("Reserva Auth inválida.");
  const email = `scope.${state.id}.${randomUUID().replaceAll("-", "").slice(0, 16)}@example.test`;
  state.actorEmails.push(email);
  persist(env.TEST_SCOPE_FILE, state);
  return email;
}
const primaryKeys: Record<string, readonly string[]> = {
  assistant_messages: ["id"],
  knowledge_documents: ["id"],
  knowledge_queries: ["id"],
  listening_sessions: ["id"],
  clinical_records: ["id"],
  clinical_audit_events: ["id"],
  access_sessions: ["id"],
  transcript_segments: ["id"],
  veterinarians: ["id"],
  clinics: ["id"],
  knowledge_fragments: ["documento_id", "ordinal"],
  assistant_audio_usage: ["author_id", "used_at"],
  assistant_voice_consent: ["author_id", "version"],
};
function rowKey(row: Row): string {
  return JSON.stringify(
    Object.keys(row)
      .sort()
      .map((key) => [key, row[key]]),
  );
}
function mergeRows(before: Row[], after: Row[]): Row[] {
  return [...new Map([...before, ...after].map((row) => [rowKey(row), row])).values()];
}
function pickPrimaryKey(table: string, row: Record<string, unknown>): Row {
  const columns = Object.hasOwn(primaryKeys, table) ? primaryKeys[table] : undefined;
  if (!columns) throw new Error("Tabla no permitida en el registro de testing.");
  const result: Row = {};
  for (const column of columns) {
    const value = row[column];
    if (typeof value !== "string" && typeof value !== "number")
      throw new Error("El checkpoint requiere todas sus claves primarias.");
    const text = String(value);
    if (column === "id" || column.endsWith("_id")) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text))
        throw new Error("UUID de checkpoint inválido.");
      result[column] = text.toLowerCase();
    } else if (column === "ordinal") {
      if (!/^\d+$/.test(text) || Number(text) < 1 || !Number.isSafeInteger(Number(text)))
        throw new Error("Ordinal de checkpoint inválido.");
      result[column] = String(Number(text));
    } else if (column === "version") {
      if (!text.length || text.length > 20) throw new Error("Versión de checkpoint inválida.");
      result[column] = text;
    } else {
      const timestamp = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(\.\d+)?(?:Z|\+00(?::?00)?)$/.exec(
        text,
      );
      if (!timestamp || Number.isNaN(Date.parse(text)))
        throw new Error("Fecha de checkpoint inválida.");
      const fraction = (timestamp[3] ?? "").replace(/0+$/, "").replace(/\.$/, "");
      result[column] = `${timestamp[1]}T${timestamp[2]}${fraction}Z`;
    }
  }
  return result;
}
export function rememberTestRows(
  table: string,
  rows: readonly Record<string, unknown>[],
  env: Environment = process.env,
): void {
  if (!env.TEST_SCOPE_FILE) throw new Error("TEST_SCOPE_FILE es obligatorio para registrar filas.");
  const state = loadState(env.TEST_SCOPE_FILE);
  if (state.status !== "pending") throw new Error("El scope ya no admite checkpoints.");
  if (!Object.hasOwn(primaryKeys, table))
    throw new Error("Tabla no permitida en el registro de testing.");
  const keys = rows.map((row) => pickPrimaryKey(table, row));
  state.remembered ??= {};
  state.remembered[table] = mergeRows(state.remembered[table] ?? [], keys);
  persist(env.TEST_SCOPE_FILE, state);
}
export function reserveTestRutBody(env: Environment = process.env): number {
  if (!env.TEST_SCOPE_FILE) throw new Error("TEST_SCOPE_FILE es obligatorio para reservar RUT.");
  const state = loadState(env.TEST_SCOPE_FILE);
  const body = state.rutNext;
  if (
    state.status !== "pending" ||
    !Number.isInteger(body) ||
    !Number.isInteger(state.rutEnd) ||
    (body as number) < 10_000_000 ||
    (state.rutEnd as number) > 99_999_999 ||
    (body as number) > (state.rutEnd as number)
  )
    throw new Error("El bloque RUT está ausente o agotado.");
  state.rutNext = (body as number) + 1;
  persist(env.TEST_SCOPE_FILE, state);
  return body as number;
}
export function reserveTestStorageObject(
  bucket: string,
  path: string,
  env: Environment = process.env,
): void {
  if (!env.TEST_SCOPE_FILE)
    throw new Error("TEST_SCOPE_FILE es obligatorio antes de subir Storage.");
  const state = loadState(env.TEST_SCOPE_FILE);
  if (
    state.status !== "pending" ||
    !["assistant-audio", "consultation-audio"].includes(bucket) ||
    !path.startsWith(`${state.clinicId}/`) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("La ruta Storage debe pertenecer a la raíz del scope.");
  if (!state.storage.some((object) => object.bucket_id === bucket && object.name === path))
    state.storage.push({ bucket_id: bucket, name: path });
  persist(env.TEST_SCOPE_FILE, state);
}
export function recordTestDatasetKey(key: string, env: Environment = process.env): void {
  if (!env.TEST_SCOPE_FILE)
    throw new Error("TEST_SCOPE_FILE es obligatorio para registrar plantillas.");
  const state = loadState(env.TEST_SCOPE_FILE);
  if (state.status !== "pending" || !/^[A-Z][A-Z0-9-]*$/.test(key))
    throw new Error("Clave de dataset inválida.");
  if (!state.datasetKeys.includes(key)) state.datasetKeys.push(key);
  persist(env.TEST_SCOPE_FILE, state);
}
async function inspectContainer(name: string): Promise<{
  Id: string;
  State: { Running: boolean };
  NetworkSettings: { Ports: Record<string, { HostIp: string; HostPort: string }[] | null> };
}> {
  const process = Bun.spawn(["docker", "inspect", name], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(process.stdout).text();
  if (await process.exited) throw new Error("No se pudo verificar la identidad Docker de testing.");
  return JSON.parse(output)[0];
}
export async function verifyTestBackend(config: TestConfig): Promise<string> {
  resolveTestConfig(
    {
      TEST_SUPABASE_URL: config.url,
      TEST_SUPABASE_ANON_KEY: config.anonKey,
      TEST_DATABASE_URL: config.databaseUrl,
      TEST_SUPABASE_PROJECT_ID: config.projectId,
    },
    true,
  );
  const db = await inspectContainer(`supabase_db_${config.projectId}`);
  const api = await inspectContainer(`supabase_kong_${config.projectId}`);
  const mapped = (container: typeof db, port: string, expected: string) =>
    container.State.Running &&
    container.NetworkSettings.Ports[port]?.some((binding) => binding.HostPort === expected);
  if (
    !mapped(db, "5432/tcp", new URL(config.databaseUrl).port) ||
    !mapped(api, "8000/tcp", new URL(config.url).port)
  )
    throw new Error("Los puertos no corresponden al proyecto Docker de testing.");
  const health = await fetch(`${config.url}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.serviceRoleKey ?? ""}` },
  });
  await health.body?.cancel();
  if (!health.ok) throw new Error("Las credenciales no corresponden al backend de testing.");
  return db.Id;
}

const inventory = [
  ["assistant_messages", "author_id"],
  ["knowledge_documents", "created_by"],
  ["listening_sessions", "started_by"],
  ["clinical_records", "created_by"],
  ["clinical_audit_events", "actor_id"],
  ["access_sessions", "veterinarian_id"],
] as const;
function predicateFor(rows: Row[]): { predicate: string; parameters: string[] } {
  const parameters: string[] = [];
  const predicate = rows
    .map(
      (row) =>
        `(${Object.entries(row)
          .map(([column, value]) => {
            parameters.push(value);
            return `${column} = $${parameters.length}`;
          })
          .join(" and ")})`,
    )
    .join(" or ");
  return { predicate, parameters };
}
async function reconcile(sql: SQL, scope: TestScope) {
  const state = loadState(scope.path);
  scope.state = state;
  const users =
    await sql`select id from auth.users where email = any(${sql.array(state.actorEmails, "TEXT")}::text[])`;
  state.actorIds = users.map((row: Row) => row.id as string);
  for (const [table, owner] of inventory) {
    state.resources[table] = await sql.unsafe(
      `select id from public.${table} where ${owner} = any($1::uuid[])`,
      [`{${state.actorIds.join(",")}}`],
    );
  }
  const ids = (table: string) => (state.resources[table] ?? []).map((row) => row.id);
  state.resources.knowledge_queries =
    await sql`select id from public.knowledge_queries where patient_id = any(${sql.array(ids("clinical_records"), "TEXT")}::uuid[]) or clinic_id = ${state.clinicId}::uuid`;
  state.resources.knowledge_fragments =
    await sql`select documento_id, ordinal::text from public.knowledge_fragments where documento_id = any(${sql.array(ids("knowledge_documents"), "TEXT")}::uuid[])`;
  state.resources.transcript_segments =
    await sql`select id from public.transcript_segments where listening_session_id = any(${sql.array(ids("listening_sessions"), "TEXT")}::uuid[])`;
  state.resources.assistant_audio_usage =
    await sql`select author_id, used_at::text from public.assistant_audio_usage where author_id = any(${sql.array(state.actorIds, "TEXT")}::uuid[])`;
  state.resources.assistant_voice_consent =
    await sql`select author_id, version from public.assistant_voice_consent where author_id = any(${sql.array(state.actorIds, "TEXT")}::uuid[])`;
  state.resources.veterinarians =
    await sql`select id from public.veterinarians where id = any(${sql.array(state.actorIds, "TEXT")}::uuid[])`;
  state.resources.clinics =
    await sql`select id from public.clinics where id = ${state.clinicId}::uuid`;
  const objects =
    await sql`select bucket_id, name from storage.objects where owner_id = any(${sql.array(state.actorIds, "TEXT")}::text[]) or name in (select audio_path from public.assistant_messages where id = any(${sql.array(ids("assistant_messages"), "TEXT")}::uuid[]) union select audio_path from public.transcript_segments where id = any(${sql.array(ids("transcript_segments"), "TEXT")}::uuid[]))`;
  state.storage = [
    ...new Map(
      [...state.storage, ...objects].map((row) => [
        `${row.bucket_id}/${row.name}`,
        { bucket_id: row.bucket_id as string, name: row.name as string },
      ]),
    ).values(),
  ];
  state.discovered ??= {};
  state.removedByProduct ??= {};
  for (const [table, rows] of Object.entries(state.resources)) {
    state.resources[table] = rows.map((row) => pickPrimaryKey(table, row));
  }
  for (const [table, rows] of Object.entries(state.remembered ?? {})) {
    const allowed = new Set((state.resources[table] ?? []).map(rowKey));
    const previouslyDeleted = new Set((state.deleted?.[table] ?? []).map(rowKey));
    for (const remembered of rows) {
      const key = pickPrimaryKey(table, remembered);
      const { predicate, parameters } = predicateFor([key]);
      const columns = Object.keys(key)
        .map((column) => `${column}::text as ${column}`)
        .join(", ");
      const found = await sql.unsafe(
        `select ${columns} from public.${table} where ${predicate}`,
        parameters,
      );
      if (found.length && !allowed.has(rowKey(pickPrimaryKey(table, found[0]))))
        throw new Error(`El checkpoint contiene una fila sin propiedad verificada en ${table}.`);
      if (!found.length && !previouslyDeleted.has(rowKey(key)))
        state.removedByProduct[table] = mergeRows(state.removedByProduct[table] ?? [], [key]);
      state.discovered[table] = mergeRows(state.discovered[table] ?? [], [key]);
    }
  }
  for (const [table, rows] of Object.entries(state.resources)) {
    state.discovered[table] = mergeRows(state.discovered[table] ?? [], rows);
  }
  persist(scope.path, state);
}
const deletionOrder = [
  "assistant_messages",
  "knowledge_queries",
  "knowledge_fragments",
  "knowledge_documents",
  "transcript_segments",
  "listening_sessions",
  "clinical_records",
  "clinical_audit_events",
  "assistant_audio_usage",
  "assistant_voice_consent",
  "access_sessions",
  "veterinarians",
  "clinics",
];
type SharedQuotaRow = { bucket_key: string; window_start: string; hits: number };
type QuotaSnapshot = { scopeId: string; environmentId: string; rows: SharedQuotaRow[] };
function quotaPath(scope: TestScope): string {
  return scope.path.replace(/\.scope\.json$/, ".quota.json");
}
function quotaKey(row: SharedQuotaRow): string {
  return JSON.stringify([row.bucket_key, row.window_start]);
}
async function captureSharedQuota(sql: SQL, scope: TestScope): Promise<void> {
  if (!scope.state.environmentId)
    throw new Error("Falta identidad durable antes de capturar cuotas.");
  const rows =
    await sql`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
  persist(quotaPath(scope), {
    scopeId: scope.state.id,
    environmentId: scope.state.environmentId,
    rows,
  });
  scope.state.sharedQuotaCaptured = true;
  scope.state.restoredSharedQuota = false;
  persist(scope.path, scope.state);
}
async function restoreSharedQuota(
  sql: SQL,
  config: TestConfig,
  scope: TestScope,
  containerId: string,
): Promise<void> {
  scope.state = loadState(scope.path);
  const path = quotaPath(scope);
  if (!scope.state.sharedQuotaCaptured && !existsSync(path)) return;
  const snapshot = privateJson(path) as QuotaSnapshot;
  if (
    snapshot.scopeId !== scope.state.id ||
    snapshot.environmentId !== scope.state.environmentId ||
    !Array.isArray(snapshot.rows) ||
    snapshot.rows.some(
      (row) =>
        typeof row.bucket_key !== "string" ||
        typeof row.window_start !== "string" ||
        !Number.isInteger(row.hits) ||
        row.hits < -2147483648 ||
        row.hits > 2147483647,
    )
  )
    throw new Error("Snapshot privado de cuotas inválido; se conserva para revisión.");
  if ((await verifyTestBackend(config)) !== containerId)
    throw new Error("El destino cambió antes de restaurar cuotas.");
  await sql.begin(async (transaction) => {
    const marker =
      await transaction`select project_id,instance_id from testsupport.environment where singleton=true`;
    if (
      marker[0]?.project_id !== config.projectId ||
      marker[0]?.instance_id !== snapshot.environmentId
    )
      throw new Error("La identidad durable no coincide al restaurar cuotas.");
    const baseline = new Set(snapshot.rows.map(quotaKey));
    const current =
      await transaction`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
    for (const row of current as SharedQuotaRow[]) {
      if (!baseline.has(quotaKey(row)))
        await transaction`delete from private.client_error_quota where bucket_key=${row.bucket_key} and window_start=${row.window_start}::timestamptz`;
    }
    for (const row of snapshot.rows)
      await transaction`insert into private.client_error_quota(bucket_key,window_start,hits) values(${row.bucket_key},${row.window_start}::timestamptz,${row.hits}) on conflict(bucket_key,window_start) do update set hits=excluded.hits`;
    const restored =
      await transaction`select bucket_key,window_start::text,hits from private.client_error_quota order by bucket_key,window_start`;
    const actual = new Map((restored as SharedQuotaRow[]).map((row) => [quotaKey(row), row.hits]));
    if (
      actual.size !== baseline.size ||
      snapshot.rows.some((row) => actual.get(quotaKey(row)) !== row.hits)
    )
      throw new Error("La restauración exacta de cuotas no se verificó.");
  });
  scope.state.restoredSharedQuota = true;
  persist(scope.path, scope.state);
}
async function cleanupOwnedResources(
  sql: SQL,
  config: TestConfig,
  scope: TestScope,
  containerId: string,
) {
  if ((await verifyTestBackend(config)) !== containerId)
    throw new Error("El destino Docker cambió durante la ejecución.");
  scope.state = loadState(scope.path);
  const identity =
    await sql`select project_id, instance_id from testsupport.environment where singleton = true`;
  if (
    identity[0]?.project_id !== config.projectId ||
    identity[0]?.instance_id !== scope.state.environmentId
  )
    throw new Error("La identidad durable del entorno de testing no coincide.");
  await reconcile(sql, scope);
  const admin = createClient(config.url, config.serviceRoleKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Primero Storage: si falla, conservar todas las filas y las rutas para reintentar.
  for (const bucket of new Set(scope.state.storage.map((object) => object.bucket_id))) {
    const names = scope.state.storage
      .filter((object) => object.bucket_id === bucket)
      .map((object) => object.name);
    const { error } = await admin.storage.from(bucket).remove(names);
    if (error) throw new Error("Falló la limpieza de Storage; se conserva el registro.");
  }
  await sql.begin(async (transaction) => {
    const marker =
      await transaction`select project_id, instance_id from testsupport.environment where singleton = true`;
    if (
      marker[0]?.project_id !== config.projectId ||
      marker[0]?.instance_id !== scope.state.environmentId
    )
      throw new Error("La identidad durable del entorno de testing no coincide.");
    for (const table of deletionOrder) {
      const rows = scope.state.resources[table] ?? [];
      if (!rows.length) continue;
      const { predicate, parameters } = predicateFor(rows);
      await transaction.unsafe(`delete from public.${table} where ${predicate}`, parameters);
      if (
        (await transaction.unsafe(`select 1 from public.${table} where ${predicate}`, parameters))
          .length
      )
        throw new Error(`Persisten filas de testing en ${table}.`);
    }
  });
  scope.state.deleted ??= {};
  for (const [table, rows] of Object.entries(scope.state.resources))
    scope.state.deleted[table] = mergeRows(scope.state.deleted[table] ?? [], rows);
  persist(scope.path, scope.state);
  for (const email of scope.state.actorEmails) {
    const id = await findUserIdByEmail(
      async (page) => {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error("Falló la reconciliación Auth.");
        return data;
      },
      email,
      1000,
    );
    if (id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Falló la limpieza Auth; se conserva el registro.");
    }
  }
  const remaining =
    await sql`select id from auth.users where email = any(${sql.array(scope.state.actorEmails, "TEXT")}::text[])`;
  const storage =
    await sql`select id from storage.objects where owner_id = any(${sql.array(scope.state.actorIds, "TEXT")}::text[])`;
  const exactStorage =
    await sql`select bucket_id, name from storage.objects where bucket_id = any(${sql.array(
      scope.state.storage.map((object) => object.bucket_id),
      "TEXT",
    )}::text[]) and name = any(${sql.array(
      scope.state.storage.map((object) => object.name),
      "TEXT",
    )}::text[])`;
  const storageResidue = exactStorage.some((object: { bucket_id: string; name: string }) =>
    scope.state.storage.some(
      (expected) => expected.bucket_id === object.bucket_id && expected.name === object.name,
    ),
  );
  if (remaining.length || storage.length || storageResidue)
    throw new Error("Persisten recursos Auth/Storage del scope.");
  persist(scope.path, scope.state);
}
async function cleanup(
  sql: SQL,
  config: TestConfig,
  scope: TestScope,
  containerId: string,
): Promise<void> {
  let ownFailure: unknown;
  try {
    await cleanupOwnedResources(sql, config, scope, containerId);
  } catch (error) {
    ownFailure = error;
  }
  try {
    await restoreSharedQuota(sql, config, scope, containerId);
  } catch (error) {
    if (ownFailure)
      throw new AggregateError(
        [ownFailure, error],
        "Fallaron la limpieza propia y la restauración de cuotas.",
      );
    throw error;
  }
  if (ownFailure) throw ownFailure;
  scope.state = loadState(scope.path);
  scope.state.status = "clean";
  delete scope.state.failure;
  persist(scope.path, scope.state);
}

export async function withTestScope(
  config: TestConfig,
  label: string,
  operation: (env: Record<string, string>, scope: TestScope) => Promise<number | undefined>,
): Promise<number> {
  if (!config.serviceRoleKey)
    throw new Error("TEST_SUPABASE_SERVICE_ROLE_KEY es obligatorio para el ciclo de vida aislado.");
  const containerId = await verifyTestBackend(config);
  const { SQL } = await import("bun");
  const sql = new SQL(config.databaseUrl, { max: 1 });
  let scope: TestScope | undefined;
  let original: unknown;
  let exitCode = 0;
  try {
    const lock = await sql`select pg_try_advisory_lock(134135136) as acquired`;
    if (!lock[0]?.acquired)
      throw new Error("La instancia de testing está ocupada por otro runner.");
    await sql`create schema if not exists testsupport`;
    await sql`revoke all on schema testsupport from public, anon, authenticated`;
    await sql`create table if not exists testsupport.environment(singleton boolean primary key default true check(singleton), project_id text not null, instance_id uuid not null default gen_random_uuid())`;
    await sql`alter table testsupport.environment add column if not exists instance_id uuid not null default gen_random_uuid()`;
    await sql`insert into testsupport.environment(singleton, project_id) values(true, ${config.projectId}) on conflict do nothing`;
    const marker =
      await sql`select project_id, instance_id from testsupport.environment where singleton = true`;
    if (marker[0]?.project_id !== config.projectId)
      throw new Error("Marca privada de testing incompatible.");
    const directory = resolve("test-results/scopes");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".scope.json"))) {
      const previousPath = resolve(directory, file);
      const previous = loadState(previousPath);
      if (previous.projectId === config.projectId && previous.status !== "clean")
        throw new Error(`Scope interrumpido pendiente; recuperar: ${previousPath}`);
    }
    scope = createScopeFiles(directory, label, {
      ...config,
      containerId,
      environmentId: marker[0]?.instance_id,
    });
    try {
      await sql`create sequence if not exists testsupport.rut_blocks minvalue 0 maxvalue 8999 start 0 no cycle`;
      const allocation = await sql`select nextval('testsupport.rut_blocks')::int as slot`;
      scope.state.rutNext = 10_000_000 + Number(allocation[0]?.slot) * 10_000;
      scope.state.rutEnd = scope.state.rutNext + 9999;
      scope.state.containerId = containerId;
      persist(scope.path, scope.state);
      await captureSharedQuota(sql, scope);
      await sql`insert into public.clinics(id, name) values(${scope.state.clinicId}::uuid, 'Clínica Veterinaria Los Aromos')`;
      const admin = createClient(config.url, config.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const actor of readTestActors({ TEST_ACTORS_FILE: scope.actorsPath })) {
        const { data, error } = await admin.auth.admin.createUser({
          email: actor.email,
          password: actor.password,
          email_confirm: true,
        });
        if (error || !data.user) throw new Error("Falló el provisioning del actor exclusivo.");
        await sql`insert into public.veterinarians(id, clinic_id, identifier, display_name) values(${data.user.id}::uuid, ${scope.state.clinicId}::uuid, ${actor.email}, ${actor.displayName})`;
      }
      exitCode =
        (await operation(
          {
            TEST_BACKEND: "1",
            TEST_SCOPE_FILE: scope.path,
            TEST_ACTORS_FILE: scope.actorsPath,
            TEST_RUT_START: String(scope.state.rutNext),
            TEST_RUT_END: String(scope.state.rutEnd),
            EXPO_PUBLIC_SUPABASE_URL: config.url,
            EXPO_PUBLIC_SUPABASE_ANON_KEY: config.anonKey,
          },
          scope,
        )) ?? 0;
    } catch (error) {
      original = error;
    }
    scope.state = loadState(scope.path);
    scope.state.childExitCode = exitCode;
    scope.state.childFailed = Boolean(original) || exitCode !== 0;
    persist(scope.path, scope.state);
    try {
      await cleanup(sql, config, scope, containerId);
    } catch (cleanupError) {
      scope.state = loadState(scope.path);
      scope.state.status = "residue";
      scope.state.failure = "Limpieza incompleta; recuperar este scope en el mismo backend.";
      persist(scope.path, scope.state);
      throw new AggregateError(
        original ? [original, cleanupError] : [cleanupError],
        `Recursos pendientes: ${scope.path}; código hijo: ${exitCode}`,
      );
    }
    if (original) throw original;
    return exitCode;
  } finally {
    await sql.close();
  }
}

export async function recoverTestScope(config: TestConfig, path: string): Promise<void> {
  const state = loadState(path);
  if (
    state.projectId !== config.projectId ||
    state.apiPort !== new URL(config.url).port ||
    state.dbPort !== new URL(config.databaseUrl).port
  )
    throw new Error("El destino no coincide con el registro de recuperación.");
  if (!config.serviceRoleKey)
    throw new Error("La recuperación exige la clave administrativa de testing.");
  const containerId = await verifyTestBackend(config);

  const { SQL } = await import("bun");
  const sql = new SQL(config.databaseUrl, { max: 1 });
  try {
    const lock = await sql`select pg_try_advisory_lock(134135136) as acquired`;
    if (!lock[0]?.acquired)
      throw new Error("La instancia de testing está ocupada por otro runner.");
    const marker =
      await sql`select project_id, instance_id from testsupport.environment where singleton = true`;
    if (
      marker[0]?.project_id !== config.projectId ||
      marker[0]?.instance_id !== state.environmentId
    )
      throw new Error("La identidad durable del entorno de testing no coincide.");
    if (state.status === "clean") return;
    await cleanup(
      sql,
      config,
      { path, actorsPath: path.replace(".scope.json", ".actors.json"), state },
      containerId,
    );
  } finally {
    await sql.close();
  }
}
