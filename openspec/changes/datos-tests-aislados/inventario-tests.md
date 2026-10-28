# Inventario de escritores de tests para #82

Inspección estática del worktree `docs/dataset-clinico-trazable`, 2026-10-27. Solo lectura: no se ejecutaron suites vivas, DB, Auth, Storage ni borrados. No contiene credenciales. Los números del apéndice permiten localizar los escritores en el código inspeccionado. Las rutas son relativas al repositorio.

## Hallazgos que condicionan el diseño

1. Los nombres visibles no son claves únicas: se repiten «Rocky Voz», «Luna…», «Tutor de…». La recuperación fiable requiere conservar IDs de creación y relaciones, no borrar por nombre ni por clínica completa.
2. `tests/support/rut.ts:randomRut()` genera un RUT válido aleatorio; evita colisiones frecuentes pero no garantiza unicidad entre procesos/reintentos. `patientContent()` usa `tutorId: "tutor-de-prueba"`: ese valor es texto de fixture, no un tutor real recuperable.
3. Los auxiliares compartidos crean datos y devuelven solo parte de sus IDs. No hay un registro común de recursos/teardown. `dispose()` cierra el cliente HTTP; no borra filas. `browserContext.close()` tampoco.
4. Hay aislamiento por autor en el chat, pero se reutilizan ANA/BRUNO entre suites: borrar «toda mi conversación» afecta a otras pruebas del mismo autor. Las cuotas/consentimientos también son compartidos por autor, sin ID de ejecución.
5. La evaluación de conocimiento retira TODAS las fuentes disponibles de la clínica visible, no solo las de esa suite. No es un DELETE pero sí altera globalmente el corpus del resto.
6. Registros aprobados, correctivas, auditoría y corpus tienen protecciones de inmutabilidad. No debe diseñarse un teardown por Data API como si fueran CRUD desechables. Las FKs y los enlaces JSON exigen un diseño explícito; no introducir bypasses productivos para limpiar tests.

## Auxiliares comunes y claves de recuperación

| Auxiliar | Actor y escrituras | Recursos/IDs disponibles | Teardown actual |
|---|---|---|---|
| `tests/integration/live-supabase.ts:signedInVeterinarian` | Auth contraseña de cuenta provisionada + RPC `start_access_session` | `userId`, `clinicId`, `accessSessionId`, token efímero. Cada invocación abre sesión Auth/acceso | Ninguno común. Algunos casos revocan/cerran su propia sesión por su escenario |
| `tests/e2e/web/fixtures.ts:submitLogin` | Login real desde UI | `readSupabaseSession(page)` recupera userId/token; auth session también se extrae del JWT en pruebas de caducidad | Cierre de página/contexto, sin purga de filas de acceso |
| `tests/e2e/web/preparar-paciente.ts:prepararPaciente` | ANA; POST `clinical_records` con `clinic_id` derivado de perfil | Crea tutor (RUT aleatorio) y paciente enlazado por `content.tutorId`; devuelve `api`, `patientId`, `crear(recordType, content)` que devuelve ID. `tutorId` queda local y NO se retorna | Solo los consumidores llaman `api.dispose()`; no elimina grafo |
| `tests/e2e/web/caso-sintetico.ts:provisionClinicalCase` | ANA/BRUNO reales por dos contextos; POST clínicos y RPC de aprobación | Tutor, paciente, dos consultas, anamnesis, diagnóstico/plan, epicrisis aprobada + correctiva, feedback original + correctiva y material de seguimiento. Retorna `patientId`, `openConsultationId`, `closedConsultationId`; otros IDs quedan locales | `finally` cierra contexts y APIs; persisten datos. Lo usan navegación, panel asistente y accesibilidad |
| `tests/integration/voz/consulta-voz.ts:nuevaConsultaVoz` | Veterinario recibido; `createPatientFicha`, `openConsultation` | Tutor nuevo con RUT aleatorio, paciente «Rocky Voz», consulta abierta; retorna SOLO consultationId | Ninguno |
| `tests/e2e/web/panel.ts:limpiarConversacion` | Autor conectado; RPC `delete_assistant_conversation` | Borra TODOS `assistant_messages` de `auth.uid()`; no hay executionId/conversationId de test | Es limpieza global por autor, no por prueba |
| `tests/e2e/web/panel.ts:consentimientoDeVoz` | Aceptar: autor, POST con conflicto `(author_id,version)` e ignore duplicates; retirar: service role DELETE | Consentimientos `(author_id, version)`; retirada filtra solo `author_id`, todas las versiones | Retirada no restaura automáticamente el estado previo |

## Integración: todos los grupos escritores

| Ruta bajo `tests/integration/` | Escrituras/recursos | Recuperación y limpieza |
|---|---|---|
| `auth/access-session.test.ts` | Logins/sesiones, paciente mínimo «Luna sesión», touch/start/revoke. Admin modifica `last_activity_at`/`expires_at` de una sesión | `accessSessionId` exacto y paciente insertado; sin afterAll. Algunas sesiones se revocan como parte del test |
| `auth/self-registration.test.ts` | `auth.signUp` de `self.registered.<timestamp>@example.test`; intentos clínicos denegados | Guarda `createdUserId`; `afterAll` llama `auth.admin.deleteUser(createdUserId)`. No verifica error de delete. Si falla antes de asignarlo, no se limpia |
| `attribution/shared-clinic.test.ts` | ANA crea paciente, BRUNO edita su peso; intentos de suplantación/atribución denegados | `recordId` en beforeAll; no teardown |
| `perfil/profile.test.ts` | ANA `updateOwnProfile`, auditoría de cambios; intento BRUNO editar ANA denegado | `finally` restaura nombre esperado «Dra. Ana Torres», no el valor realmente leído antes; auditoría permanece |
| `registro/ficha.test.ts` | Tutores/pacientes, consultas, anamnesis, diagnósticos, epicrisis aprobadas; lote directo `clinical_records` para paginación | `provisionarCasoCerrado` retorna patient/tutor/consultation IDs; variables locales y fixture compartido. Sin teardown. Hay relaciones JSON, no FK tutor/paciente |
| `registro/anamnesis.test.ts` | Ficha + consulta compartida, entradas por servicios, corrección de procedencia, diagnósticos, casos cerrados con aprobación | IDs de consulta y entradas; corrección de anamnesis actualiza contenido con eventos aditivos, no confundir con correctiva de epicrisis. Sin teardown |
| `registro/epicrisis.test.ts` | Ficha/consultas, anamnesis, diagnósticos, borradores/updates, aprobaciones y correctivas repetidas | consultationId y record IDs; correctivas sucesivas apuntan al MISMO evento `epicrisis_approved` original. Sin teardown |
| `retroalimentacion/feedback.test.ts` | Paciente directo; tres consultas, dos epicrisis aprobadas (cierran dos consultas), diagnóstico previo, originales y corrección de feedback ANA/BRUNO | patientId, primera/segunda/consultaAbierta IDs, IDs/eventos de feedback; sin teardown |
| `voz/captura-voz.test.ts` | Tutor/paciente, consulta, listening_sessions, transcript_segments, hechos de audio (`clinical_records`), confirmación que aterriza en anamnesis, cambios de estado de sesión/segmento | patientId, consultationId, sessionId, fact IDs y landedEntryId. Sin teardown; intentos de edición inmutable fallan |
| `voz/audio-storage.test.ts` | `nuevaConsultaVoz`, listening session, segmentos con audio_path; upload real bucket `consultation-audio` | Path por segmento conservado en variable; algunos tests intentan borrar como verificación de permisos; no limpieza general |
| `voz/asr-openai.test.ts` | `nuevaConsultaVoz`, listening session; invoca Edge Function `transcribe-audio` con audio de fixtures | sessionId; comprobar si proveedor configurado al ejecutar. No teardown. No asumir que la función no consume cuota/coste por ser un test |
| `voz/carrera-cierre.test.ts` | Grafo `nuevaConsultaVoz`, listening sessions; SQL directo `Bun.SQL` cierra consulta/sesión con `set local session_replication_role=replica` para provocar carrera; API intenta insertar sesión/tramo bloqueado | consultationId/sessionId exactos; afterAll SOLO `admin.close()`. No borra filas ni revierte los estados confirmados. URL DB configurable por `SUPABASE_DB_URL` |
| `conocimiento/coleccion.test.ts` | `incorporateSource`, corpus sintético cargado, materialización de `knowledge_fragments`, retirada por BRUNO, consultas persistidas | documentId/`claves` del loader; DELETE directo de knowledge_documents es intento DENEGADO de inmutabilidad, no teardown. Sin limpieza |
| `conocimiento/consulta.test.ts` | Fuente nueva, fichas/tutores de contexto, consultas `knowledge_queries`, retirada de fuente por BRUNO | documentId/patientId/queryId; no teardown |
| `conocimiento/evaluacion.test.ts` | Retira todas las fuentes disponibles que devuelve listSources; `loadSyntheticCorpus` del corpus-miedo + preguntas dentro/fuera dominio persistidas | `claves[documentoClave]`, queryIds no retenidos en conjunto de resultados; retirada global por clínica visible en beforeAll, sin restauración |
| `asistente/asistente-mensajes.test.ts` | Mensajes directos/por servicio, contexto patient_id, `nuevaConsultaVoz`, lote de 120 mensajes paginados, mensaje fallido/terminal | IDs explícitos para lote; beforeAll borra conversación ANA/BRUNO, otros beforeAll/casos vuelven a borrar todo ANA. No afterAll. DELETE directo por ID es intento DENEGADO |
| `asistente/audio-mensajes.test.ts` | Mensajes UUID, audio real `assistant-audio`, admin envejece `audio_expires_at`, `remove_assistant_audio`; consentimiento v1/v2 y cuota por RPC | Path `${clinicId}/${userId}/${messageId}.${ext}`; mensaje.id/author_id; 100 objetos creados con service role para probar cuota Storage y eliminados en finally por lista exacta. Otros objetos/mensajes permanecen. beforeAll borra conversación de ambos; consentimiento y usage se borran por author_id; v2 se borra por author_id+version. Algunos `remove` son pruebas RLS denegadas, otros eliminan objetos propios |
| `observability/report-client-error.test.ts` | HTTP/functions.invoke `report-client-error` | Emite telemetría de test (`requestId` conocido), sin fixture DB explícito ni limpieza |

`auth/auth-contract.test.ts` usa un cliente falso local: no escritor vivo. Los tests puramente de lectura se apoyan en cuentas provisionadas o en sus fixtures previos; no se debe inferir escritura de una importación `createClient`.

## Web E2E: escritores y efectos por suite

Toda sesión válida crea/toca access_sessions; no repetirlo en cada fila. Los nombres siguientes son etiquetas visibles actuales, NO llaves seguras de eliminación.

| Ruta bajo `tests/e2e/web/` | Grafo y efectos | Limpieza actual |
|---|---|---|
| `tutores.spec.ts` | UI crea «Tutora E2E <timestamp>», prueba duplicados RUT, crea familiar con teléfono compartido tras confirmación, edita RUT/teléfono | Sin teardown; IDs están en URL de tutor, RUT aleatorio no se devuelve |
| `ficha-etologica.spec.ts` | UI ficha «Rocky E2E etología» + tutora «Marta Soto»; prepararPaciente para hoja/plan incompleto; consulta, anamnesis cerrada y diagnóstico/plan | dispose API solamente |
| `consulta-formulario.spec.ts` | prepararPaciente y consultas; anamnesis/procedencia/campo largo, borradores, firmas/cierre y correctivas | dispose API solamente; patientId/consultationId conocidos |
| `registro-epicrisis.spec.ts` | «Luna E2E epicrisis» + consulta + borrador; «Nube E2E historial» + consulta UI + aprobación/cierre | dispose API solamente |
| `retroalimentacion.spec.ts` | Preparador local crea paciente con tutorId UUID SIN tutor real; consulta y epicrisis aprobada; feedback original y cadena de correctivas; UI crea nuevas entradas | `api.dispose()`; evento `clinical_feedback_recorded` del original usado para correctivas |
| `modo-escucha.spec.ts`, `panel-escucha.spec.ts` | prepararPaciente, consulta, sesiones/tramos/hechos de escucha demo; confirmación aterriza anamnesis | dispose API solamente |
| `modo-escucha-real.spec.ts` | prepararPaciente; consulta, escucha real, segmentos y audio `consultation-audio`; transcripción Edge interceptada por Playwright (audio Storage real) | dispose API solamente. IDs consultados por consultation_id/listening_session_id; conserva audio_path |
| `conocimiento.spec.ts` | UI incorpora fuente con título temporal, retira fuente, chat consulta persistida, otro caso incorpora fuente directa y envejece sesión con service role | dispose APIs; retirada es comportamiento funcional, no limpieza de toda suite; chat pasa por limpiarConversacion |
| `panel-conocimiento.spec.ts` | prepararPaciente + consulta, fuente directa con término único `zorrilomaquia<timestamp>`, pregunta de chat y knowledge_queries asociada al paciente | dispose API; limpia conversación antes, no borra fuente/grafo |
| `chat-asistente.spec.ts` | POST/API y UI assistant_messages; pruebas de error/contexto; chat persistente real con respuestas interceptadas | beforeEach y afterEach RPC delete_assistant_conversation del autor; no scope por test |
| `chat-voz.spec.ts` | Mensajes reales, consentimiento real (aceptar/retirar), conversación; Storage assistant-audio INTERCEPTADO en helper salvo variantes de fallo también interceptadas; caso prepararPaciente y consulta al final | beforeEach limpiar conversación/aceptar; afterEach delete_assistant_conversation y dispose. Consentimiento alterado sin restauración genérica |
| `chat-voz-sin-permiso.spec.ts` | Aceptación real de consentimiento antes de comprobar permiso del navegador | Sin restauración |
| `panel-asistente.spec.ts` | beforeAll provisionClinicalCase; beforeEach login+limpiarConversacion; UI chat contextual puede persistir mensajes | No teardown de grafo clínico |
| `navegacion.spec.ts` | beforeAll provisionClinicalCase | Sin teardown de grafo |
| `accessibility.spec.ts` | beforeAll provisionClinicalCase; inserts assistant_messages para historial + borrado RPC; prepararPaciente y pacientes adicionales para lista | Borra conversación cuando lo pide caso; sin teardown clínico común |
| `attribution.spec.ts` | ANA paciente directo, BRUNO intenta suplantar/editar atribución (denegado) | Dispose APIs; sin borrar paciente |
| `auth.spec.ts` | Pruebas sesiones/login/logout; crea patientId UUID y consultationId UUID directos (tutorId UUID de relleno), intenta escritura tras caducidad, admin envejece access_sessions por auth_session_id | Dispose APIs; sin teardown de filas de sesión/paciente/consulta |
| `perfil.spec.ts` | UI actualiza nombre profesional y deja auditoría | finally restaura ANA.displayName fijo; no purga historial |
| `login.spec.ts`, `estados.spec.ts`, `tema.spec.ts` | Principalmente login/navegación, interceptores de fallos; efectos de sesiones reales cuando hay backend | Sin recursos clínicos nuevos detectados en las rutas de escritura explícitas |

## Borrados/alteraciones amplios que #82 debe sustituir o aislar

- `tests/integration/conocimiento/evaluacion.test.ts:52`: retirada de cada fuente disponible de la clínica. Conserva filas y cambia corpus compartido globalmente.
- `tests/integration/asistente/asistente-mensajes.test.ts:47,48,122,162,225`: `deleteConversation` del autor completo. `audio-mensajes.test.ts:48,49`: mismo alcance para ANA/BRUNO.
- `tests/e2e/web/panel.ts:39`: RPC de conversación por autor; consumida por chat/panel/conocimiento/accesibilidad. `chat-asistente.spec.ts:45,50`, `chat-voz.spec.ts:111`, `accessibility.spec.ts:362`: llamadas directas adicionales.
- `tests/integration/asistente/audio-mensajes.test.ts:282,398` y `tests/e2e/web/panel.ts:69`: DELETE consentimientos por author_id, todas versiones. Cuota `audio-mensajes.test.ts:363`: DELETE assistant_audio_usage por author_id, todas ventanas.
- `tests/integration/asistente/audio-mensajes.test.ts:254`: lista EXACTA de 100 rutas Storage, buen ejemplo de propiedad explícita (con finally); no es global.
- `tests/integration/auth/self-registration.test.ts:12`: eliminación Auth por ID propio, único teardown Auth general encontrado.
- No se encontró `truncate`/`db reset` dentro de estas dos carpetas; el reset de la batería está fuera, en workflow CI. No confundir el alcance global por autor/clínica con DELETE sin WHERE.

## FKs, integridad y orden de recuperación/limpieza

- `001_identity_access.sql`: veterinarians.id → auth.users.id ON DELETE CASCADE; access_sessions.veterinarian_id → veterinarians.id ON DELETE CASCADE. clinical_audit_events.actor_id → veterinarians.id SIN cascade; eventos pueden apuntarse por supersedes_event_id. Borrar una cuenta con actividad clínica no equivale a limpiar su grafo y puede quedar bloqueado por FKs.
- `002_clinical_attribution.sql`: clinical_records references clinics, veterinarians (created_by/updated_by/approved_by), supersedes_event_id → clinical_audit_events.id. Eventos auditados identifican entity_type/entity_id; no FK de entity_id a una tabla clínica concreta.
- Vínculos tutor/paciente/consulta/entradas son mayormente `content.tutorId`, `content.patientId`, `content.consultationId` JSON; no hay FK relacional que borre en cascada ese grafo. Hay triggers de dominio que verifican tipos/estado/alcance clínico.
- Epicrisis correctivas D8 apuntan al MISMO evento de aprobación original, también al corregir una correctiva. Feedback correctivo D7 apunta al evento original `clinical_feedback_recorded` del feedback. Sus originales deben seguir recuperables. No ordenar limpieza solamente por fecha de creación; conservar ambos grafos de registros y eventos.
- `010_base_conocimiento.sql`: knowledge_fragments PK `(documento_id,ordinal)` y FK a knowledge_documents SIN cascade; knowledge_queries.patient_id FK a clinical_records; sus citas están también en JSON answer. Los documentos son inmutables salvo retirada: la retirada no limpia fragments/queries ni auditoría.
- `011_captura_voz.sql`: listening_sessions.consultation_id UUID sin FK JSON clínica, started_by FK a veterinarians; transcript_segments.listening_session_id FK SIN cascade, UNIQUE `(listening_session_id,seq)`. Recuperar transcript/audio desde ese par y sessionId; incluir audio facts/landed anamnesis en el grafo clínico. Audio path vive en columna transcript_segments.audio_path (añadida después).
- `022_asistente_conversacional.sql`: assistant_messages.patient_id FK clinical_records.id, author_id FK veterinarians, clinic_id FK clinics, sin cascadas. La RPC delete_assistant_conversation elimina todos los mensajes del autor; no debe suponerse que elimina objetos Storage (inspeccionar purga de audio por separado).
- `023_audio_asistente.sql`: consentimientos y usage asociados a author_id FK veterinarians. Un namespace de ejecución en nombre de paciente NO aísla cuotas o consentimientos: exigen actor propio o serialización/restauración explícita.
- Storage assistant-audio tiene claves canónicas `clinicId/userId/messageId.ext`; consultation-audio se recupera por audio_path de segmentos. Conservar inventario de bucket+path al crear: borrar filas antes de guardar rutas puede perder la única llave segura de limpieza del objeto.

## Recomendación de alcance para #82

Capturar IDs en los auxiliares existentes y devolver un contexto/registro por ejecución (clínica/actor/recursos), sin cambiar el dataset demo ni confundirlo con fixtures mínimos. Resolver primero cómo aislar actores/clínicas de chat/cuotas/corpus, y cómo limpiar una base de tests desechable respetando contratos de inmutabilidad. El requisito «nombres reutilizables» requiere desacoplar nombre visible de unicidad y propiedad del recurso; no basta añadir timestamps o buscar por nombre para hacer teardown. Una estrategia destructiva de DB exige diseño y autorización propios; este inventario no la ejecuta ni la aprueba.

## Apéndice: localizadores de escritura/teardown

La búsqueda siguiente incluye también intentos DENEGADOS y rutas interceptadas; se han distinguido arriba. Sirve como lista de lectura, no como prueba de que cada llamada llega a persistir.

```text
tests/e2e/web/chat-voz.spec.ts:63:  await page.route("**/storage/v1/object/assistant-audio/**", (route) => {
tests/e2e/web/chat-voz.spec.ts:67:  await page.route("**/storage/v1/object/assistant-audio", (route) => {
tests/e2e/web/chat-voz.spec.ts:71:  await page.route("**/storage/v1/object/sign/assistant-audio/**", (route) => {
tests/e2e/web/chat-voz.spec.ts:91:  test.beforeEach(async ({ page }) => {
tests/e2e/web/chat-voz.spec.ts:110:  test.afterEach(async () => {
tests/e2e/web/chat-voz.spec.ts:111:    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
tests/e2e/web/chat-voz.spec.ts:154:      "/rest/v1/assistant_messages?select=audio_path,audio_expires_at,created_at&audio_path=not.is.null",
tests/e2e/web/chat-voz.spec.ts:199:    const filas = await api.get("/rest/v1/assistant_voice_consent?select=version");
tests/e2e/web/chat-voz.spec.ts:215:    await page.route("**/rest/v1/assistant_voice_consent*", (route) =>
tests/e2e/web/chat-voz.spec.ts:267:    await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
tests/e2e/web/chat-voz.spec.ts:336:    await page.route("**/storage/v1/object/assistant-audio/**", (route) =>
tests/e2e/web/chat-voz.spec.ts:339:    await page.route("**/storage/v1/object/assistant-audio", (route) => responder(route, 200, []));
tests/e2e/web/chat-voz.spec.ts:369:      "/rest/v1/assistant_messages?select=audio_path&audio_path=not.is.null",
tests/e2e/web/ficha-etologica.spec.ts:19:  test.beforeEach(() => {
tests/e2e/web/modo-escucha-real.spec.ts:54:  test.beforeEach(({ browserName }) => {
tests/e2e/web/modo-escucha-real.spec.ts:88:        `/rest/v1/listening_sessions?select=id&consultation_id=eq.${consultationId}`,
tests/e2e/web/modo-escucha-real.spec.ts:94:        `/rest/v1/transcript_segments?select=audio_path&listening_session_id=eq.${sessionId}&order=seq`,
tests/e2e/web/modo-escucha-real.spec.ts:102:      const audio = await api.get(`/storage/v1/object/authenticated/consultation-audio/${primera}`);
tests/e2e/web/panel-escucha.spec.ts:10:  test.beforeEach(() => {
tests/e2e/web/tutores.spec.ts:18:  test.beforeEach(() => {
tests/e2e/web/panel-conocimiento.spec.ts:9:  test.beforeEach(() => {
tests/e2e/web/panel-conocimiento.spec.ts:25:      const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/panel-conocimiento.spec.ts:29:      const fuente = await api.post("/rest/v1/knowledge_documents", {
tests/e2e/web/panel-conocimiento.spec.ts:87:        `/rest/v1/knowledge_queries?select=patient_id&question=eq.${encodeURIComponent(pregunta)}`,
tests/e2e/web/panel.ts:39:    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
tests/e2e/web/panel.ts:64:      await api.post("/rest/v1/assistant_voice_consent?on_conflict=author_id,version", {
tests/e2e/web/panel.ts:69:      await api.delete(`/rest/v1/assistant_voice_consent?author_id=eq.${userId}`, {
tests/integration/attribution/shared-clinic.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/attribution/shared-clinic.test.ts:16:  beforeAll(async () => {
tests/e2e/web/conocimiento.spec.ts:51:  test.beforeEach(() => {
tests/e2e/web/conocimiento.spec.ts:85:        `/rest/v1/knowledge_documents?select=id&content->bibliografia->>titulo=eq.${encodeURIComponent(titulo)}`,
tests/e2e/web/conocimiento.spec.ts:96:      const antes = await api.get(`/rest/v1/knowledge_documents?select=status&id=eq.${fuente.id}`);
tests/e2e/web/conocimiento.spec.ts:138:      await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
tests/e2e/web/conocimiento.spec.ts:164:        `/rest/v1/knowledge_queries?select=id&question=eq.${encodeURIComponent(pregunta)}`,
tests/e2e/web/conocimiento.spec.ts:211:      const vet = await ana.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/conocimiento.spec.ts:216:      const incorporada = await ana.post("/rest/v1/knowledge_documents", {
tests/e2e/web/conocimiento.spec.ts:247:      await page.route("**/rest/v1/rpc/touch_access_session", (route) =>
tests/e2e/web/conocimiento.spec.ts:253:        `/rest/v1/access_sessions?auth_session_id=eq.${authSessionId}&revoked_at=is.null`,
tests/e2e/web/navegacion.spec.ts:11:  test.beforeAll(async ({ browser }) => {
tests/e2e/web/navegacion.spec.ts:15:  test.beforeEach(async ({ page }) => {
tests/e2e/web/accessibility.spec.ts:181:  test.beforeAll(async ({ browser }) => {
tests/e2e/web/accessibility.spec.ts:307:      const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/accessibility.spec.ts:310:        api.post("/rest/v1/assistant_messages", {
tests/e2e/web/accessibility.spec.ts:362:      await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
tests/e2e/web/chat-asistente.spec.ts:24:  test.beforeAll(async ({ browser }) => {
tests/e2e/web/chat-asistente.spec.ts:28:  test.beforeEach(async ({ page }) => {
tests/e2e/web/chat-asistente.spec.ts:42:    const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/chat-asistente.spec.ts:45:    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
tests/e2e/web/chat-asistente.spec.ts:49:  test.afterEach(async () => {
tests/e2e/web/chat-asistente.spec.ts:50:    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
tests/e2e/web/chat-asistente.spec.ts:62:      const respuesta = await api.post("/rest/v1/assistant_messages", {
tests/e2e/web/chat-asistente.spec.ts:222:    await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
tests/e2e/web/panel-asistente.spec.ts:13:  test.beforeAll(async ({ browser }) => {
tests/e2e/web/panel-asistente.spec.ts:17:  test.beforeEach(async ({ page }) => {
tests/e2e/web/consulta-formulario.spec.ts:26:  test.beforeEach(() => {
tests/e2e/web/tema.spec.ts:19:  test.beforeEach(async ({ page }) => {
tests/e2e/web/modo-escucha.spec.ts:6:  test.beforeEach(() => {
tests/e2e/web/perfil.spec.ts:7:  test.beforeEach(async ({ page }) => {
tests/e2e/web/attribution.spec.ts:67:        `/rest/v1/veterinarians?select=clinic_id&id=eq.${ana.userId}`,
tests/e2e/web/attribution.spec.ts:75:      const createResponse = await anaApi.post("/rest/v1/clinical_records", {
tests/e2e/web/attribution.spec.ts:92:      const brunoReadResponse = await brunoApi.get(`/rest/v1/clinical_records?id=eq.${record.id}`);
tests/e2e/web/attribution.spec.ts:99:      const spoofResponse = await brunoApi.post("/rest/v1/clinical_records", {
tests/e2e/web/attribution.spec.ts:111:      const tamperResponse = await brunoApi.patch(`/rest/v1/clinical_records?id=eq.${record.id}`, {
tests/e2e/web/preparar-paciente.ts:34:  const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${session.userId}`);
tests/e2e/web/preparar-paciente.ts:42:    const respuesta = await api.post("/rest/v1/clinical_records", {
tests/integration/auth/access-session.test.ts:19:  const touched = await client.rpc("touch_access_session", { p_session_id: vet.accessSessionId });
tests/integration/auth/access-session.test.ts:36:  const restart = await client.rpc("start_access_session");
tests/integration/auth/access-session.test.ts:67:    const touched = await ana.client.rpc("touch_access_session", {
tests/integration/auth/access-session.test.ts:76:    await ana.client.rpc("revoke_current_access_session");
tests/integration/auth/access-session.test.ts:106:    const firstResume = await firstDevice.client.rpc("current_access_session");
tests/integration/auth/access-session.test.ts:108:    const secondResume = await secondDevice.client.rpc("current_access_session");
tests/integration/auth/access-session.test.ts:111:    const revoked = await firstDevice.client.rpc("revoke_current_access_session");
tests/integration/auth/access-session.test.ts:115:    const stillActive = await secondDevice.client.rpc("touch_access_session", {
tests/e2e/web/registro-epicrisis.spec.ts:5:  test.beforeEach(() => {
tests/e2e/web/registro-epicrisis.spec.ts:36:        `/rest/v1/clinical_records?select=content&record_type=eq.epicrisis&content->>consultationId=eq.${consultationId}`,
tests/e2e/web/caso-sintetico.ts:67:      `/rest/v1/veterinarians?select=clinic_id&id=eq.${anaSession.userId}`,
tests/e2e/web/caso-sintetico.ts:83:      const response = await api.post("/rest/v1/clinical_records", {
tests/e2e/web/caso-sintetico.ts:183:    const approvalResponse = await anaApi.post("/rest/v1/rpc/approve_clinical_record", {
tests/e2e/web/caso-sintetico.ts:189:      `/rest/v1/clinical_audit_events?select=id&entity_id=eq.${epicrisisDraftId}` +
tests/e2e/web/caso-sintetico.ts:223:      "/rest/v1/clinical_audit_events?select=id&entity_type=eq.clinical_feedback" +
tests/e2e/web/estados.spec.ts:9:  test.beforeEach(async ({ page }) => {
tests/e2e/web/estados.spec.ts:21:    await page.route("**/rest/v1/knowledge_documents?*", async (route) => {
tests/e2e/web/estados.spec.ts:47:    await page.route("**/rest/v1/rpc/search_patients*", async (route) => {
tests/e2e/web/estados.spec.ts:82:    await page.route("**/rest/v1/rpc/search_patients*", (route) =>
tests/e2e/web/estados.spec.ts:107:    await page.route("**/rest/v1/clinical_records?*", (route) =>
tests/e2e/web/estados.spec.ts:126:    await page.route("**/rest/v1/clinical_records?*", (route) => {
tests/integration/live-supabase.ts:58:  const { data: accessSession, error: sessionError } = await client.rpc("start_access_session");
tests/e2e/web/retroalimentacion.spec.ts:39:  const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${session.userId}`);
tests/e2e/web/retroalimentacion.spec.ts:47:    const respuesta = await api.post("/rest/v1/clinical_records", {
tests/e2e/web/retroalimentacion.spec.ts:85:  const aprobacion = await api.post("/rest/v1/rpc/approve_clinical_record", {
tests/e2e/web/retroalimentacion.spec.ts:107:  const original = await api.post("/rest/v1/clinical_records", {
tests/e2e/web/retroalimentacion.spec.ts:118:    `/rest/v1/clinical_audit_events?select=id&entity_type=eq.clinical_feedback&entity_id=eq.${fila?.id}&action=eq.clinical_feedback_recorded`,
tests/e2e/web/retroalimentacion.spec.ts:122:    const correctiva = await api.post("/rest/v1/clinical_records", {
tests/e2e/web/retroalimentacion.spec.ts:136:  test.beforeEach(() => {
tests/e2e/web/retroalimentacion.spec.ts:225:        `/rest/v1/clinical_records?select=id&record_type=eq.clinical_feedback&content->>consultationId=eq.${preparado.consultationId}`,
tests/e2e/web/retroalimentacion.spec.ts:261:      await page.route("**/rest/v1/clinical_records?*", async (route) => {
tests/integration/retroalimentacion/feedback.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/retroalimentacion/feedback.test.ts:67:  beforeAll(async () => {
tests/integration/auth/self-registration.test.ts:1:import { afterAll, describe, expect, test } from "bun:test";
tests/integration/auth/self-registration.test.ts:10:  afterAll(async () => {
tests/integration/auth/self-registration.test.ts:12:      await adminClient().auth.admin.deleteUser(createdUserId);
tests/integration/auth/self-registration.test.ts:26:    const start = await client.rpc("start_access_session");
tests/e2e/web/auth.spec.ts:118:      const profile = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/auth.spec.ts:129:      const read = await api.get("/rest/v1/clinical_records?select=id");
tests/e2e/web/auth.spec.ts:131:      const write = await api.post("/rest/v1/clinical_records", {
tests/e2e/web/auth.spec.ts:176:      const vet = await anaApi.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
tests/e2e/web/auth.spec.ts:182:      const patient = await anaApi.post("/rest/v1/clinical_records", {
tests/e2e/web/auth.spec.ts:209:      const consultation = await anaApi.post("/rest/v1/clinical_records", {
tests/e2e/web/auth.spec.ts:247:        `/rest/v1/access_sessions?auth_session_id=eq.${authSessionId}&revoked_at=is.null`,
tests/e2e/web/auth.spec.ts:287:        `/rest/v1/clinical_records?select=id&content->>consultationId=eq.${consultationId}`,
tests/integration/asistente/asistente-mensajes.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/asistente/asistente-mensajes.test.ts:37:  beforeAll(async () => {
tests/integration/asistente/asistente-mensajes.test.ts:113:      .delete()
tests/integration/asistente/asistente-mensajes.test.ts:161:    beforeAll(async () => {
tests/integration/asistente/asistente-mensajes.test.ts:241:    await vet.client.rpc("revoke_access_session", { p_session_id: vet.accessSessionId });
tests/integration/registro/epicrisis.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/registro/epicrisis.test.ts:76:  beforeAll(async () => {
tests/integration/voz/captura-voz.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/voz/captura-voz.test.ts:45:  beforeAll(async () => {
tests/integration/conocimiento/evaluacion.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/conocimiento/evaluacion.test.ts:47:  beforeAll(async () => {
tests/integration/asistente/audio-mensajes.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/asistente/audio-mensajes.test.ts:45:  beforeAll(async () => {
tests/integration/asistente/audio-mensajes.test.ts:97:      const { data: devuelta, error } = await ana.client.rpc("remove_assistant_audio", {
tests/integration/asistente/audio-mensajes.test.ts:124:      await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
tests/integration/asistente/audio-mensajes.test.ts:125:      const { data } = await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
tests/integration/asistente/audio-mensajes.test.ts:133:      const { data } = await bruno.client.rpc("remove_assistant_audio", { p_message_id: id });
tests/integration/asistente/audio-mensajes.test.ts:153:      const { data } = await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
tests/integration/asistente/audio-mensajes.test.ts:172:      await ana.client.storage.from(BUCKET).remove([ruta(ana, id)]);
tests/integration/asistente/audio-mensajes.test.ts:215:      const borrado = await ana.client.storage.from(BUCKET).remove([path]);
tests/integration/asistente/audio-mensajes.test.ts:225:      const ajeno = await bruno.client.storage.from(BUCKET).remove([path]);
tests/integration/asistente/audio-mensajes.test.ts:229:      const propio = await ana.client.storage.from(BUCKET).remove([path]);
tests/integration/asistente/audio-mensajes.test.ts:254:        await admin.storage.from(BUCKET).remove(rutas);
tests/integration/asistente/audio-mensajes.test.ts:281:    beforeAll(async () => {
tests/integration/asistente/audio-mensajes.test.ts:282:      await adminClient().from("assistant_voice_consent").delete().eq("author_id", bruno.userId);
tests/integration/asistente/audio-mensajes.test.ts:332:        .delete()
tests/integration/asistente/audio-mensajes.test.ts:353:        .delete()
tests/integration/asistente/audio-mensajes.test.ts:363:      await adminClient().from("assistant_audio_usage").delete().eq("author_id", vet.userId);
tests/integration/asistente/audio-mensajes.test.ts:374:        const { data } = await veterinaria.client.rpc("consume_assistant_audio_quota");
tests/integration/asistente/audio-mensajes.test.ts:389:        Array.from({ length: 30 }, () => veterinaria.client.rpc("consume_assistant_audio_quota")),
tests/integration/asistente/audio-mensajes.test.ts:398:      await admin.from("assistant_voice_consent").delete().eq("author_id", veterinaria.userId);
tests/integration/asistente/audio-mensajes.test.ts:399:      const { data } = await veterinaria.client.rpc("consume_assistant_audio_quota");
tests/integration/asistente/audio-mensajes.test.ts:408:      await sinSesion.client.rpc("revoke_access_session", {
tests/integration/asistente/audio-mensajes.test.ts:411:      const { data } = await sinSesion.client.rpc("consume_assistant_audio_quota");
tests/integration/voz/carrera-cierre.test.ts:1:import { afterAll, beforeAll, describe, expect, test } from "bun:test";
tests/integration/voz/carrera-cierre.test.ts:22:  beforeAll(async () => {
tests/integration/voz/carrera-cierre.test.ts:27:  afterAll(async () => {
tests/integration/conocimiento/consulta.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/conocimiento/consulta.test.ts:66:  beforeAll(async () => {
tests/integration/conocimiento/consulta.test.ts:97:    const { error: errorBusqueda } = await ana.client.rpc("search_knowledge_fragments", {
tests/integration/registro/anamnesis.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/registro/anamnesis.test.ts:77:  beforeAll(async () => {
tests/integration/registro/anamnesis.test.ts:108:    // Consulta de trabajo compartida creada en beforeAll: los tests no consumen estado
tests/integration/registro/anamnesis.test.ts:131:    // ≥ 4: clínica compartida con la consulta de trabajo del beforeAll; lo que se fija es
tests/integration/conocimiento/coleccion.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/conocimiento/coleccion.test.ts:47:  beforeAll(async () => {
tests/integration/conocimiento/coleccion.test.ts:122:    const borrado = await ana.client.from("knowledge_documents").delete().eq("id", documentId);
tests/integration/voz/asr-openai.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/voz/asr-openai.test.ts:22:  beforeAll(async () => {
tests/integration/registro/ficha.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/registro/ficha.test.ts:127:  beforeAll(async () => {
tests/integration/registro/ficha.test.ts:130:    // Fixtures compartidos creados en beforeAll: los tests no consumen estado creado por
tests/integration/voz/audio-storage.test.ts:1:import { beforeAll, describe, expect, test } from "bun:test";
tests/integration/voz/audio-storage.test.ts:42:  beforeAll(async () => {
tests/integration/voz/audio-storage.test.ts:82:    const borrado = await ana.client.storage.from(AUDIO_BUCKET).remove([path]);

```
