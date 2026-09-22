# Diseño de implementación: Captura de voz hacia anamnesis

**Fecha**: 2026-09-22 | **Especificación**: [captura-voz-anamnesis](specs/captura-voz-anamnesis/spec.md)

**Entrada**: propuesta y especificación del cambio. Este diseño asume mergeada la rama
`feat/002-registro-clinico-longitudinal` (entidades de registro clínico, anamnesis, sellado de
consultas y RPC `approve_clinical_record`) sobre la que este cambio se apila, más la capa de
identidad y atribución de [identidad y acceso](../implementar-identidad-y-acceso/design.md). Este
diseño se aprueba antes de `tasks.md`; su implementación sigue el Rojo-Verde-Refactor obligatorio
(Constitución II).

**Restricción de esta ejecución**: sin Docker/Supabase local ni Playwright. El SQL se verifica en un
clúster PostgreSQL scratch con shims en `/tmp/verify-004/` (patrón del
[quickstart de 002](../implementar-registro-clinico-longitudinal/quickstart.md)) y en el job
`database` de CI; la integración viva se ejecuta solo en CI (`SUPABASE_LIVE_TESTS=1`) y su corrida
queda condicionada al requisito de integración R1. Es una limitación de verificación declarada, no
una reducción de alcance.

## Context

Solo el estado y las restricciones que condicionan el enfoque (la motivación vive en
`proposal.md`):

- `public.clinical_records` + `public.clinical_audit_events` son la convención única de
  persistencia clínica (001/003 endurecidas, 002 ampliadas): triggers de atribución
  (`deny_attribution_mutation`, `stamp_update_attribution`, `audit_clinical_record`),
  sellado de consultas cerradas (`guard_consultation_sealed`, D5 de 002) y RPC de aprobación
  (`approve_clinical_record`, D4 de 002). El enum taxativo de FR-063 ya contiene el entity
  `audio_fact` y la acción `audio_fact_confirmed`. `clinical_record_action` mapea hoy **toda**
  transición `audio_fact` (INSERT y UPDATE) a `audio_fact_confirmed`, sin distinguir el momento de
  la confirmación.
- La anamnesis de 002 (`src/features/registro/schema.ts`, `anamnesis-service.ts`) es el destino de
  los borradores confirmables: `AnamnesisContent = { consultationId, field: AnamnesisField, text,
  provenance, provenanceHistory? }` con `Provenance = 'reportada' | 'inferida' | 'recuperada' |
  'desconocida'`, y `recordAnamnesisEntry` como puerta de escritura. Por su propia convención
  «toda observación se registra ya confirmada por el veterinario»: el estado de confirmación que
  esta spec anticipa (Key Entities de 002) vive, por tanto, en el lado borrador de la observación.
- Contrato de atribución en `src/lib/attribution` (`createClinicalRecord`, `updateClinicalContent`,
  guardas `ATTRIBUTION_CONTROL_FIELDS`, respuesta `ClinicalMutationResult`) y sesión de acceso de
  001 (`current_access_session()`; RLS exige sesión activa y clínica compartida).
- Brief §5 (decisión de producto): la captura por voz puede ser incremental, en ventanas de
  aproximadamente 30 segundos, sin exigir transcripción en tiempo real estricta. Brief §13:
  preguntar al asistente por voz está fuera de alcance; la voz entra solo como captura de la
  conversación clínica. Nada de audio real es requisito del PoC (fixtures sintéticos).

## Goals / Non-Goals

**Goals:**

- La cadena completa del «modo de escucha clínica» sobre datos sintéticos: activar/detener con
  indicación visible, segmentar en ventanas de ~30 s, transcribir incrementalmente, extraer
  borradores confirmables trazables al fragmento de transcripción, y confirmar antecedente por
  antecedente hacia la anamnesis de 002, con atribución y auditoría según FR-063.
- Las garantías de FR-014, FR-017, FR-021, FR-031, FR-032, FR-054, FR-055 y FR-068 verificadas por
  pruebas (pgTap, unidad e integración viva), no solo por UI; SC-004 y SC-016 medidos por test
  sobre la conversación de referencia; SC-027 y SC-048 verificados en base de datos.

**Non-Goals:**

- Micrófono real, audio real y ASR real: extensiones documentadas, sin dependencias externas nuevas
  (Principio III; contrato del orquestador).
- Transcripción en tiempo real estricta, separación de hablantes, i18n (solo español), y
  retención/políticas de eliminación de transcripción o audio (discovery previo, según los
  supuestos de la spec).
- Interacción hablada con el asistente (brief §13).
- Información faltante (006), hipótesis y diagnóstico asistido (006), tratamientos (007),
  retroalimentación clínica (005).
- Playwright y e2e web (restricción de esta ejecución).

## Decisions

### D1. Los hechos extraídos del audio son `clinical_records`/`audio_fact`; la confirmación aterriza en la anamnesis de 002

Cada antecedente extraído vive como una fila `record_type = 'audio_fact'`, `status = 'draft'` cuyo
`content` (esquema propio en `src/features/voz/schema.ts`, claves camelCase, validado con Zod) es:

```text
{ consultationId, field: AnamnesisField, text,
  provenance: 'inferida',
  confirmationState: 'pending' | 'confirmed' | 'discarded',
  transcriptSegmentId, transcriptExcerpt, segmentSeq,
  anamnesisEntryId?: string,
  contradiction?: { refKind: 'borrador' | 'ficha' | 'anamnesis', refId: string, note: string } }
```

Al confirmar (D5) se crea la entrada de anamnesis de 002 (`recordAnamnesisEntry`, procedencia
`inferida`) y el `audio_fact` queda sellado como **traza confirmada** con `anamnesisEntryId` y el
fragmento de origen. Reutiliza íntegra la convención FR-063 (`audio_fact` / `audio_fact_confirmed`)
y los triggers de atribución y sellado existentes: cero tablas nuevas para el ciclo de vida del
hecho, cero segunda convención de persistencia clínica (Principio III).

*Alternativas rechazadas*: (a) borradores en tablas propias y `audio_fact` solo al confirmar —
obliga a reimplementar RLS/atribución/sellado para los borradores y duplica la convención clínica;
(b) un único `audio_fact` que «sea» la anamnesis — invisible para `listAnamnesisEntries` y el resto
de lectores de 002, exigiría tocar `src/features/registro/*` (prohibido) y rompería el destino de
anamnesis que la spec declara.

### D2. Decisión dura: el ASR por defecto es `SimulatedTranscriptionAdapter`, determinista

Se define el puerto `TranscriptionPort` (`src/features/voz/transcription-port.ts`):

```ts
type AudioWindow = { listenSessionId: string; seq: number; startedAt: string; durationMs: number; audio?: unknown };
type TranscriptResult = { text: string; quality: 'ok' | 'insufficient' };
interface TranscriptionPort { transcribe(window: AudioWindow): Promise<TranscriptResult>; }
```

Implementación por defecto `SimulatedTranscriptionAdapter`: transcribe a partir del **guion** de la
conversación de referencia (`tests/fixtures/voz/conversacion-referencia.json`, texto conocido y
determinista por número de ventana, con tramos marcados `insufficient` para ejercitar FR-031).
Es una decisión dura y reversible: para cambiarla basta con implementar `TranscriptionPort` sobre
un servicio real (p. ej. un ASR en la nube o local) e inyectarlo en `ListenModeSection` /
`listen-mode-controller`; el resto del pipeline (extracción, borradores, confirmación) no cambia.
El adaptador real queda como **extensión documentada, SIN implementar** y sin dependencias externas
nuevas (Principio III: el PoC no requiere audio real).

*Alternativa rechazada*: adoptar ya un SDK de ASR (Whisper/Google/…) — añadiría una dependencia de
ejecución externa, credenciales y latencia real sin un requisito que lo exija, y haría imposible la
medición determinista de SC-004/SC-016 en CI.

### D3. Captura y segmentación en ventanas de ~30 s detrás de `CaptureSource`, con reloj inyectado

`CaptureSource` (`src/features/voz/capture-source.ts`) produce las ventanas de captura mientras la
escucha está activa y expone su disponibilidad (`available()`), que es la señal de indisponibilidad
de FR-054. Implementación por defecto `SyntheticCaptureSource`: emite ventanas sintéticas de
30 000 ms (`WINDOW_MS`, constante única) desde el guion de referencia, con un escenario
`unavailable` para ejercitar FR-054/US6-AC10 sin micrófono. El segmentador usa un reloj inyectado
(`now()`) para que las pruebas de unidad controlen el tiempo real.

*Extensión documentada (sin implementar)*: `MicrophoneCaptureSource` sobre `expo-audio`, que
materializa `AudioWindow.audio` como bytes/Blob y traduce la denegación de permiso de micrófono a
`available() = false`. Exigirá entonces justificar `expo-audio` como dependencia (Principio III).

### D4. Extracción determinista pura `extractClinicalFacts` y contradicciones como señal

`extractClinicalFacts(segmentText)` (`src/features/voz/extraction.ts`) es una función pura de
reglas deterministas en español (patrones por `AnamnesisField`, detección de negación y de
expresiones temporales) que devuelve borradores `{ field, text, excerpt [start, end] }`; nunca se
ejecuta sobre tramos `quality: 'insufficient'` (FR-031). El umbral de calidad se mide por test sobre
la conversación de referencia con ground truth etiquetado: SC-004 (≥ 70 % de recall) y SC-016
(≤ 30 % de propuestas incorrectas). Un extractor externo (LLM/NLP) sería el mismo seam de sustitución
que el ASR real: hoy no se construye (Principio III).

`detectContradictions(nuevo, contexto)` (`src/features/voz/contradictions.ts`, pura) compara el
hecho nuevo con (a) los borradores ya extraídos en la sesión, (b) la anamnesis registrada y (c) los
antecedentes de la ficha, por sujeto normalizado con polaridad o valor opuestos (incluye la
autocorrección del tutor dentro de la conversación). **Solo señala** (`content.contradiction`):
FR-032 prohíbe resolverla por cuenta del sistema y US6-AC8 prohíbe sobrescribir el dato previo; la
decisión es siempre del veterinario. Los falsos positivos son admisibles porque el resultado es una
advertencia revisable, nunca una escritura.

### D5. Confirmación atómica: el trigger de dominio aterriza la anamnesis en la misma transacción

La única ruta de confirmación es la UPDATE del borrador a `confirmationState = 'confirmed'` por el
contrato `updateClinicalContent` (sesión activa obligatoria vía RLS y `stamp_update_attribution`,
FR-068). El trigger `guard_audio_fact_lifecycle` (`BEFORE UPDATE`, ver D6) **aterriza en la misma
transacción** la entrada de anamnesis de 002 con `provenance = 'inferida'` y enlaza
`content.anamnesisEntryId` antes de dejar pasar la UPDATE: la sentencia es indivisible, no existe
estado intermedio persistido (`pending → confirmed | discarded`, estados terminales) ni ventana de
fallo parcial, y `confirmed` solo puede escribirse aterrizando — no hay ruta de confirmación que
burlar. Los triggers de auditoría existentes emiten `anamnesis_recorded` (actor = confirmante,
derivado del servidor) y `audio_fact_confirmed` (actor = confirmante, que puede ser distinto del que
abrió la consulta, US6-AC15 · SC-048); la procedencia queda en `inferida` y no cambia
(FR-021 · US6-AC9).

*Alternativas rechazadas*: (a) una RPC `confirm_audio_fact(uuid)` al estilo
`approve_clinical_record` — la enumeración de funciones ejecutables por `authenticated` está
pinificada taxativamente en `004_function_privileges.sql` (exactamente nueve) y el orquestador exige
las suites 001–008 verdes sin tocarlas: toda RPC nueva con `grant execute` rompe esa suite
compartida; (b) orquestar en el cliente dos escrituras (anamnesis y luego UPDATE de la traza) — deja
una ventana de fallo parcial con antecedente aterrizado sin traza (rompe SC-027) o traza sin
anamnesis, y obligaría a una máquina de estados `landing` con reglas de adopción. La atribución
server-side (Constitución V) se conserva: `created_by`/`updated_by`/`actor_id` los sella el servidor
desde `auth.uid()` y el cliente no puede nombrarlos.

### D6. Refinamiento de `clinical_record_action` y sellado del ciclo de vida de `audio_fact`

La migración 011 hace `create or replace` de `clinical_record_action` **conservando firma,
`language sql immutable`, `set search_path = public, extensions` y privilegios** (fijados por
`004_function_privileges.sql`), y solo refina el caso `audio_fact`, aprovechando que la función ya
discrimina por contenido (`p_content ->>'decision'` para `hypothesis`):

- INSERT de `audio_fact` → `null` (una extracción nace borrador; su alta no es una acción clínica
  enumerada, igual que el borrador de epicrisis).
- UPDATE con `content->>'confirmationState' = 'confirmed'` → `audio_fact_confirmed`; cualquier otra
  transición (edición o descarte de borrador) → `null`.

Este refinamiento está anticipado por el propio comentario de 003 («Spec 002 refines this mapping as
it introduces the concrete entities») y **no rompe ninguna suite compartida**: las suites 001–008 no
contienen ninguna aserción sobre `audio_fact` (verificado). Las suites existentes pinifican la
firma y los privilegios de la función, que se conservan.

Complemento: el trigger `guard_audio_fact_lifecycle` (`BEFORE INSERT OR UPDATE`) impide fabricar
confirmaciones fuera de la ruta sancionada: (a) INSERT solo con `confirmationState = 'pending'`;
(b) cualquier UPDATE sobre un estado terminal (`confirmed`, `discarded`) → `AUDIO_FACT_IMMUTABLE`
23514 — la traza confirmada es inmutable (SC-027) y las correcciones del antecedente van por las
rutas de corrección de anamnesis de 002 (`correctProvenance`, anamnesis correctiva); y (c) la
transición a `confirmed` **aterriza** en la misma transacción la entrada de anamnesis (D5): exige
`consultationId`, `field` y `text` válidos (`AUDIO_FACT_INVALID_CONTENT` 22023), inserta la entrada
de anamnesis de 002 con `provenance = 'inferida'` y reescribe `content.anamnesisEntryId` con el id
que devuelve ese INSERT — id derivado por el servidor, nunca por el cliente.

### D7. Procedencia del flujo de voz = `inferida` (justificación)

FR-021 de esta spec lo impone («MUST registrar su procedencia como inferido», US6-AC9) y es la
lectura coherente con el principio «separación entre dato e inferencia» (brief §11.3): el
antecedente no lo registra un humano en la ficha, lo **infiere** el sistema del audio transcrito, y
la intermediación máquina (ASR + extracción) es justamente lo que la procedencia debe delatar.
`reportada` queda reservada al registro directo humano de 002; `recuperada` y `desconocida` no
aplican al flujo de voz. Confirmar un antecedente **no** cambia su procedencia (FR-021 · US6-AC9):
si el veterinario discrepa, la corrección de procedencia usa el camino recuperable de 002
(`correctProvenance`, US2-AC5). El «origen por voz» se expresa por la traza propia del hecho
(`record_type = 'audio_fact'`, acción `audio_fact_confirmed`, `transcriptSegmentId` +
`transcriptExcerpt`), no por un quinto valor del enum canónico.

### D8. Atribución y auditoría (FR-063, FR-068)

- Toda escritura de borradores cruza el contrato `src/lib/attribution` (`createClinicalRecord`,
  `updateClinicalContent`): ningún campo de control aceptado del cliente, atribución real sellada
  por el servidor.
- La **activación** de la escucha queda atribuida en `public.listening_sessions.started_by` /
  `started_at` (columnas con `default auth.uid()` / `timezone('utc', now())` y privilegios de
  columna revocados para `authenticated`, patrón de 001): FR-068 exige atribución de ambas acciones,
  y el enum taxativo de FR-063 no cubre la activación (no es registro clínico), por lo que su
  atribución vive en la tabla propia de la sesión de escucha, que además guarda `ended_at` y `state`
  (`active | stopped | interrupted`) — la entidad Sesión de escucha de la spec. No se registra
  «quién detuvo»: ningún FR lo exige (YAGNI).
- La **confirmación** se atribuye por la acción enumerada `audio_fact_confirmed` (actor del evento =
  confirmante) más `updated_by`/`updated_at` sellados en la fila (SC-048 · US6-AC15).

### D9. UX accesible del modo de escucha (WCAG 2.2 AA) y montaje mínimo documentado

Componentes aislados en `src/components/voz/`, con `ListenModeSection` como única entrada al
workspace de consulta (recibe `consultationId`; `clinicId` sale de `useSessionStore`):

- `ListenModeButton`: botón «Modo de escucha» (activar/detener) operable por teclado, con etiqueta
  programática, foco visible y `testID` estable.
- Indicador de captura: `role="status"` con `aria-live="polite"` («Capturando audio…» / «Escucha
  detenida» / «Captura no disponible»), nunca solo por color (FR-025 · FR-054).
- Revisión en vivo: lista de tránscripción por tramo (US6-AC13) y tarjetas de borrador con el
  fragmento de origen (US6-AC6), chip de procedencia `inferida` (US6-AC9), insignia de
  contradicción (FR-032), marca de tramo no confiable (FR-031) y acciones por antecedente
  Confirmar / Corregir / Descartar (FR-017 · US6-AC3), todas operables por teclado.
- Sin consulta abierta o sin sesión activa, el botón no inicia captura (FR-014 · US6-AC14); la
  indisponibilidad deja expedito el registro manual de anamnesis de 002 (FR-054 · US6-AC10) — nada
  de esta spec lo bloquea.

El montaje en `src/app/(protected)/consultations/[id].tsx` (archivo compartido, fuera de este
alcance) queda **documentado** como requisito de integración R2: una importación y
`<ListenModeSection consultationId={consulta.id} />` en el workspace.

### D10. Transcripción persistida por tramo, sin audio

`public.transcript_segments` guarda cada tramo (`listening_session_id`, `seq`, `started_at`,
`ended_at`, `text`, `quality: 'ok' | 'insufficient'`, `processing_state: 'pending' | 'processed' |
'discarded'`, `clinic_id` para RLS). `processing_state` hace explícita la garantía de FR-055 ·
US6-AC12: al interrumpir la captura a mitad de un tramo, el tramo parcial se marca `processed` o
`discarded` de forma explícita y ningún tramo queda a medio procesar (aserción pgTap/integración).
El audio **nunca** se persiste (supuestos de la spec: sin retención de audio como requisito).

### D11. Verificación: clúster scratch + CI, presupuestos con verificación

pgTap (`supabase/tests/010_captura_voz.sql`) rojo→verde localmente en el clúster PostgreSQL 18
scratch con shims de `/tmp/verify-004/` (patrón documentado en el quickstart de 002) y en el job
`database` de CI (suites 001–010). Unidad con `bun test tests/unit/voz`. Integración viva en CI
(`tests/integration/voz`, patrón `live-supabase.ts` con las veterinarias sintéticas ANA y BRUNO:
ANA abre consulta y escucha, BRUNO confirma → US6-AC15). Los presupuestos de rendimiento de abajo
se verifican con aserciones de tiempo/secuencia en las pruebas indicadas.

## Requisitos de integración (archivos compartidos fuera de este alcance)

| ID | Requisito | Archivo compartido | Efecto hasta aplicarlo |
|---|---|---|---|
| R1 | Regenerar los tipos generados tras la migración 011: `supabase gen types --lang=typescript --local > src/lib/supabase/database.types.ts` (los tipos nuevos incluyen `listening_sessions` y `transcript_segments`) | `src/lib/supabase/database.types.ts` | La compuerta de CI «Generated database types match the migrations» queda en rojo en esta rama; la integración viva en CI queda tras ese paso. Mientras, `src/features/voz/db-types.ts` contiene el seam de tipado (un único `asVozClient`) con los tipos generados desde el clúster scratch, para que `bun run typecheck` quede limpio; se elimina al aplicar R1 |
| R2 | Montar el modo de escucha en el workspace de consulta (una importación y `<ListenModeSection consultationId={…} />`) | `src/app/(protected)/consultations/[id].tsx` | El botón «Modo de escucha» no aparece en la app; el componente aislado y sus pruebas existen |
| R3 | Actualizar la nota «Transiciones sin acción enumerada» del quickstart de 002: con el refinamiento de D6, el INSERT de `audio_fact` (borrador) también devuelve `null` | `openspec/changes/implementar-registro-clinico-longitudinal/quickstart.md` | Nota documental desactualizada (ninguna prueba la pinifica) |

No se necesita tocar `src/features/registro/*` ni `src/lib/attribution/*`: se usan solo sus APIs
públicas (`recordAnamnesisEntry`, `listAnamnesisEntries`, `getConsultation`, `createClinicalRecord`,
`updateClinicalContent`).

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| `TranscriptionPort` + `SimulatedTranscriptionAdapter` | FR-015 + contrato del orquestador (ASR determinista por defecto) | Nunca como seam; cambia la implementación al adoptar un ASR real (D2) |
| `CaptureSource` + `SyntheticCaptureSource` | FR-014 · FR-054 (señal de indisponibilidad) sin micrófono real | Al implementar `MicrophoneCaptureSource` (D3) |
| `extractClinicalFacts` determinista | FR-016 con SC-004/SC-016 medibles sin dependencias externas | Si un requisito futuro exige un extractor externo (mismo seam que D2) |
| `detectContradictions` | FR-032 (presentar la contradicción) | Nunca mientras la spec exija señalarla |
| Trigger `guard_audio_fact_lifecycle` con aterrizaje de la anamnesis | FR-017 + FR-068 + SC-027/SC-048: confirmación atómica y atribución server-side sin funciones ejecutables nuevas (D5) | Nunca; es la única ruta de confirmación |
| Refinamiento de `clinical_record_action` | FR-017/FR-063: `audio_fact_confirmed` exactamente al confirmar, nunca al insertar o editar un borrador | Nunca mientras la spec exija confirmación explícita |
| Tablas `listening_sessions` y `transcript_segments` | FR-068 (atribución de activación, entidad Sesión de escucha), FR-055 · US6-AC12 (estado explícito por tramo), SC-027 (fragmento) | — |
| Seam `src/features/voz/db-types.ts` | Tipos generados compartidos no editables (R1) | Al aplicar R1 |

Dependencias de ejecución nuevas: **ninguna** (Principio III; micrófono y ASR real son extensiones
documentadas). Capas arquitectónicas nuevas: **ninguna** (servicios sobre el patrón de
`features/registro`, componentes sobre el patrón de `components/clinical`).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Procesar una ventana de 30 s (transcribir + extraer + persistir borradores) con el adaptador simulado | ≤ 2 s desde el cierre de la ventana; y SC-028: el tramo N queda reflejado en el borrador antes del cierre del tramo N+1 | aserción de tiempo y de orden de eventos con reloj falso en `tests/unit/voz/listen-mode-controller.test.ts` (tarea 3.3) e integración (5.1) |
| `extractClinicalFacts` sobre un tramo de ~30 s de habla | ≤ 300 ms de CPU | aserción de tiempo en `tests/unit/voz/extraction.test.ts` (tarea 2.3) |
| `confirmAudioFact` (una UPDATE que aterriza la anamnesis en su misma transacción) | ≤ 2 s con red local | aserción de tiempo en `tests/integration/voz` (tarea 5.1) |
| Listar borradores de una consulta (≤ 100 borradores, ≤ 10 tramos) | ≤ 2 s | aserción de tiempo en `tests/integration/voz` (tarea 5.1) |

SC-004 (≥ 70 % de antecedentes identificados) y SC-016 (≤ 30 % de propuestas incorrectas) se miden
por test sobre la conversación de referencia etiquetada (tarea 2.3); no son presupuestos temporales.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; cambios de
  comportamiento pasarán primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo (pgTap en el
  clúster scratch y CI; unidad local; integración viva en CI, condicionada por R1) observadas
  fallando por la razón prevista; evidencia incremental en `quickstart.md` desde la tarea 1.1.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba;
  «quién detuvo la escucha» y retención de audio/transcripción quedan fuera por no existir
  requisito.
- **IV (observabilidad)**: servicios con `logEvent` + `requestId` y `captureClientError` en fallos;
  los triggers de la migración 011 siguen el patrón de los guards existentes (error normalizado que
  aborta la escritura, nunca silenciado); ninguna excepción silenciada.
- **V (seguridad)**: RLS y triggers del servidor como control real; validación Zod en cada frontera
  de entrada; atribución server-side (los triggers derivan el actor desde `auth.uid()` y el cliente
  no puede nombrarlo; columnas de atribución de
  `listening_sessions` con privilegios de columna revocados); sin secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible,
  contraste del paletín vigente y avisos nunca solo por color (D9); la compuerta visual/e2e queda
  condicionada por la restricción sin Playwright (ver Riesgos).

## Risks / Trade-offs

- **Compuerta de tipos en rojo hasta R1** (R1): la migración 011 añade dos tablas, y
  `database.types.ts` es archivo compartido. Mitigación: el seam `db-types.ts` mantiene
  `bun run typecheck` limpio y la evidencia pgTap corre localmente; el paso exacto de desbloqueo
  está documentado. Es el coste de la única convención de persistencia sin tocar archivos ajenos.
- **Verificación visual/e2e sin Playwright**: la UI se verifica por typecheck, revisión estática
  WCAG y smoke con el navegador del harness sobre Expo web si el entorno permite servir la app
  contra datos sintéticos; si no, queda **declarada pendiente** en `quickstart.md`. Declararlo no
  convierte la compuerta en cumplida.
- **Extractor determinista acotado**: SC-004/SC-016 se miden sobre la conversación de referencia;
  una conversación real degradaría las tasas. Mitigación: el seam de D2/D4 permite sustituir el
  extractor sin tocar el pipeline; el riesgo está declarado, no cubierto.
- **FR-054 sin micrófono real**: la indisponibilidad se ejercita por la señal de `CaptureSource`;
  el flujo real de permisos de micrófono queda como extensión documentada (D3) y no se afirma
  verificado.
- **Contradicciones con heurística** (D4): falsos positivos/negativos posibles; solo se señala y el
  veterinario decide (FR-032), nunca se escribe por el sistema.
- **Mención a un animal distinto del paciente**: la extracción puede proponer hechos de otro animal;
  la garantía es estructural — nada aterriza en la ficha sin confirmación explícita por
  antecedente (FR-017) — y el riesgo se declara en la revisión (edge case de la spec).
- **`jsonb` sin FK** (D1, igual que en 002): las referencias `transcriptSegmentId` /
  `anamnesisEntryId` las asegura la única puerta de escritura (`audio-fact-service` + trigger de
  dominio) y las
  pruebas de integración; es el coste de no crear una segunda convención clínica.

## Open Questions

Ninguna bloqueante. Las siguientes son diferibles sin cambiar spec, enfoque ni desglose (con
default propuesto):

- **Retención de la transcripción persistida**: los supuestos de la spec dejan la conservación
  posterior como discovery. *Default*: conservar `transcript_segments` indefinidamente en el PoC
  (datos sintéticos) y decidir retención/eliminación en discovery antes de tutores reales.
- **Amplitud de la conversación de referencia**: SC-004/SC-016 se miden sobre un guion acotado
  (≈ 6 tramos, ≥ 10 antecedentes etiquetados, un tramo no confiable, una autocorrección y una
  mención a otro animal). *Default*: mantener ese guion mínimo; ampliarlo solo si la revisión pide
  más representatividad.
