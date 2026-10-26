# Design

## Context

Motivación y alcance: `proposal.md`. La auditoría inicial de `317cd9a` inventarió 93 archivos
unitarios, 14 de integración, 14 E2E web, 18 SQL y 2 flujos nativos. La lectura fue selectiva;
no acredita una revisión exhaustiva ni autoriza recortes fuera de la matriz.

Como línea base histórica se ejecutó `bun install --frozen-lockfile` y:

```sh
bun test tests/unit/clinical tests/unit/storage tests/unit/auth tests/unit/theme tests/unit/ui tests/unit/navigation tests/unit/agenda tests/integration/auth/auth-contract.test.ts
```

Resultado observado en la auditoría: 566 tests, 37 archivos, 0 fallos, 353 ms. No se ejecutaron
E2E, Maestro, SQL, integración viva ni la batería completa. Este resultado no es una verificación
posterior a los recortes ni una medición del ahorro de CI.

## Goals / Non-Goals

**Goals:**

- Retirar pruebas redundantes o equivocadas con una razón concreta y evidencia conservada.
- Mantener los requisitos y regresiones vigentes aunque su implementación ya pase los tests.
- Eliminar código sin consumidores, verificando referencias estáticas y dinámicas.

**Non-Goals:**

- Cambiar comportamiento de producto, criterios de aceptación, matriz de plataformas o CI.
- Reducir cantidad de casos como objetivo aislado, silenciar fallos o eliminar casos solo por
  antigüedad, tamaño del archivo o porque prueben código aparentemente sencillo.
- Completar aquí el flujo clínico nativo de dos cuentas, introducir un framework de tests,
  generalizar los clientes falsos o modificar datos clínicos y contratos públicos. Las migraciones quedan limitadas a la corrección de rendimiento autorizada al cierre.

## Decisions

### D1 — Cada eliminación conserva una garantía identificada

La alternativa de borrar por cobertura numérica o parecido textual no distingue fronteras de
confianza. Se comparan entrada, camino ejecutado y fallo observable; un test de interfaz no
reemplaza RLS ni una integración real. Las comprobaciones de librerías se mantienen cuando
protegen nuestra configuración, adaptación o una regresión demostrada.

La matriz siguiente contiene candidatos, no eliminaciones ya aplicadas. Sus números conservan
los del informe de auditoría para poder relacionar conversación, tareas y diff.

| Hallazgo | Candidato y cambio propuesto | Evidencia o garantía conservada | Verificación local |
|---|---|---|---|
| 1 | Retirar `tests/e2e/native/attribution.yaml`: solo abre la app y busca dos textos del login. Actualizar `tests/e2e/native/README.md`. | `auth.yaml` contiene esas mismas comprobaciones. La cobertura nativa de dos cuentas y atribución US12 sigue pendiente: documentarla antes de borrar. | Comparar ambos YAML y buscar referencias al nombre eliminado en CI, scripts y documentación; distinguir ejecución real de inspección estática. |
| 2 | Retirar las aserciones `"signUp" in loginSchema` y `"signUp" in client.auth` de `tests/unit/auth/login-screen.test.ts` y `tests/integration/auth/auth-contract.test.ts`. Renombrar el contrato unitario para describir validación de credenciales. | Conservar los parseos del esquema, los contratos del servicio, la ausencia de registro visible en `auth.spec.ts` y el rechazo de cuentas autorregistradas en `self-registration.test.ts` (FR-062, US11). | Ejecutar ambos archivos Bun; no interpretar sus resultados como ejecución de Supabase o del navegador. |
| 3 | Eliminar `tests/unit/clinical/draft-preserver.test.ts`: solo guarda y lee en memoria. | `draft-storage.test.ts`, `draft-lifecycle.test.ts`, `draft-key.test.ts` y el E2E de notas tras expirar y reautenticar (`auth.spec.ts`) protegen FR-061, SC-047 y US11-AC5. | Ejecutar los tests de almacenamiento conservados; revisar que el E2E de recuperación permanece intacto. |
| 4 | Retirar solo el primer bloque `shared clinic attribution contract` y su import de `tests/integration/attribution/shared-clinic.test.ts`. | `tests/unit/clinical/attribution-guards.test.ts` ya rechaza `created_by` y las demás columnas. Conservar toda la integración viva de dos profesionales (FR-063, SC-041, SC-042, SC-044). | Ejecutar la guarda unitaria y, cuando se aplique este recorte de atribución, la integración viva según AGENTS.md. |
| 5 | Eliminar «todas las rutas cubiertas siguen resolviendo» de `tests/e2e/web/navegacion.spec.ts` y retirar su import exclusivo de `syntheticScreens`. | `accessibility.spec.ts` visita las mismas 10 rutas y espera los mismos elementos antes de comprobar accesibilidad (FR-079). Conservar navegación por activación de enlaces. | Comparar rutas y condiciones de espera; ejecutar smoke durante implementación y la suite web al cierre. El smoke pierde el recorrido general; la suite completa lo conserva. |
| 6 | Fusionar el envío vacío del login de `auth.spec.ts` con el recorrido por teclado que ya muestra el mismo error. | Conservar orden de foco, envío por Intro y anuncio `role="alert"` (constitución, Restricciones de Aplicación Web: teclado y anuncio de errores). Si el caso afirma que no sale una petición de credenciales, verificar esa ausencia en el caso conservado. | Añadir primero la comprobación de red al caso conservado; ejecutar el caso web durante la verificación de cierre y registrar su resultado. No sustituir ese resultado por smoke, que no incluye `auth.spec.ts`. |
| 7 | Retirar los símbolos de D3 y sus imports exclusivos. | Sin comportamiento requerido ni consumidores confirmados; preservar los exports usados, incluidos los que solo sirven a tests o scripts. | Búsqueda global de referencias antes y después, tests afectados y `bun run typecheck` tras retirar exports. |
| 8 | En `tests/unit/theme/tema.test.ts`, calcular cada distancia de color solo en los esquemas base claro y oscuro. | Conservar las igualdades de `:root.light`/`:root.dark` con sus respectivos esquemas y los umbrales de separación (FR-104 y D20). Mantener todos los pares de contraste y las guardas de tokens. | Ejecutar `bun test tests/unit/theme/tema.test.ts`; un bloque forzado divergente debe seguir fallando por igualdad. |
| 9 | Integrar en el caso `label` existente las prohibiciones de mayúsculas y monoespaciado y retirar el test separado en `tests/unit/ui/typography.test.tsx`. | Conservar `text-sm`, `font-medium`, fuente sans y ambas restricciones (FR-074, D20). | Ejecutar `bun test tests/unit/ui/typography.test.tsx tests/unit/theme/tema.test.ts`. |

El hallazgo 6 comprueba validación local y accesibilidad del envío vacío; no acredita
US11-AC2. US11-AC2 y US11-AC3 (FR-060, SC-046) conservan su caso existente
«a wrong password and an unknown identifier are indistinguishable» en `auth.spec.ts`, que
utiliza credenciales y compara las respuestas. Ese caso no se fusiona ni se elimina.

### D2 — La cobertura inexistente se registra como deuda, no como aceptación

Antes de retirar el placeholder nativo, añadir en el cambio activo
`implementar-identidad-y-acceso` una tarea pendiente que exija el flujo real de US12 con dos
cuentas y su evidencia en dispositivo. Mantener pendientes T045/T063 según su estado real;
no marcar la atribución nativa como aceptada ni borrar el historial documental de T036.
Actualizar las referencias operativas que anunciaban el archivo retirado, explicando su
reemplazo por el smoke de acceso y la ausencia del flujo real de atribución.

Completar esa deuda es trabajo de identidad, no condición que esta limpieza pueda declarar
satisfecha. No se reduce la obligación normativa: se retira un duplicado que nunca la comprobó.

### D3 — Código sin consumidores y límites de la búsqueda

La auditoría encontró únicamente declaración o referencias internas para:

| Archivo | Símbolos candidatos |
|---|---|
| `src/lib/forms/form.ts` | `validateWithSchema` |
| `src/lib/errors.ts` | `AccessDeniedError` |
| `src/components/registro/labels.ts` | `ANAMNESIS_STRUCTURED_ORDER`, `ANAMNESIS_FIELD_OPTIONS`; retirar también imports exclusivos |
| `tests/support/rut.ts` | `SAMPLE_RUT` |
| `src/features/voz/listen-session-service.ts` | `listListenSessions` |

Repetir la búsqueda contra la base de implementación, incluyendo imports de namespace,
reexports, claves por string, scripts y OpenSpec. Si aparece un consumidor válido, conservar el
símbolo y registrar la exclusión; no cambiar un contrato para forzar su eliminación.
`createMemoryStorage` y `setLogSink` son utilidades usadas por tests; `loadSyntheticCorpus`
también se usa desde scripts. No son código muerto.

### D4 — Compatibilidad y regresiones protegidas

Conservar los casos de concurrencia, fallos y reintentos de almacenamiento, caducidad y
revocación en servidor, autoría, correcciones e inmutabilidad (FR-024, FR-061, FR-063).
Conservar campos previos de anamnesis para lectura histórica: `ficha-canina-etologia`, D4,
mantiene explícitamente esa compatibilidad aunque prohíba escribir campos legacy nuevos.
Mantener los casos de paginación sin `count`, las guardas AA, los assets por plataforma y la
regresión de la curva de firma: una prueba pequeña o de una adaptación no es redundante por eso.

### D5 — Verificación y complejidad

No se incorporan dependencias, abstracciones, scripts ni presupuestos nuevos. Los umbrales
clínicos, de rendimiento y de accesibilidad permanecen íntegros. Las 100–130 líneas y unos
10 casos estimados en la auditoría son orientativos; el resultado se obtiene del diff real.

Cada grupo ejecuta Biome solo sobre código tocado y sus tests focalizados. Si se refuerza o
corrige una expectativa, comprobar antes que detecta la regresión prevista, siguiendo el
Principio II; no añadir tests que únicamente repitan la implementación. Una eliminación pura
de duplicados no requiere crear un test sustituto si ya existe la cobertura identificada.

Al cierre autorizado de la PR ejecutar la batería que exige AGENTS.md: gate, integración viva
por autenticación/atribución y E2E web por navegación, con entorno explícito de SETUP.md y un
solo worker para los E2E. No registrar suites omitidas por falta de backend como verificadas.
Revisar el diff y registrar cada candidato aplicado o descartado con su motivo. La revisión de
agente no sustituye la revisión por alguien distinto del autor exigida por la constitución.

## Risks / Trade-offs

- Parecido entre capas sin equivalencia → conservar ambas pruebas cuando cambie el límite de
  confianza o el defecto observable; usar la matriz como evidencia, no como cuota.
- Base de auditoría anterior a otros trabajos → revalidar rutas, consumidores y ubicación de
  cambios activos/archivados antes de aplicar; no modificar el checkout original.
- Menor cobertura del comando smoke → conservar la compuerta completa y registrar la
  diferencia del hallazgo 5, sin alterar scripts ni CI para ocultarla.
- Placeholder nativo retirado sin evidencia real → dejar la tarea de US12 pendiente en identidad
  y explicar en README qué cubre realmente Maestro.
- Mejoras de tiempo no medidas → informar ahorro de líneas y casos por separado del tiempo;
  comparar tiempos solo con el mismo entorno y comando.

## Migration Plan

Aplicar los grupos de tareas por separado tras la revisión y aprobación del plan. La limpieza original no requiere migraciones de datos; la corrección de rendimiento puede añadir una migración SQL sin borrar datos ni cambiar contratos. Ante pérdida de una garantía, restaurar el recorte
afectado desde Git y conservar la prueba hasta resolver la equivalencia; no añadir omisiones.

## Registro de implementación

- Base: `122ec6964f6325103928c986343c762b96f80678`. Plan aprobado mediante PR #63 e instrucción de implementación del responsable. Revalidados los nueve candidatos: sin cambios relevantes en su código desde la auditoría. Identidad sigue activa; sistema visual y ficha canina están archivados bajo `archive/2026-10-26-*`; su compatibilidad y garantías se conservan.
- Preparación: `bun install --frozen-lockfile`; baseline focalizada de autenticación, almacenamiento, guardas de atribución, tema y tipografía: 370 tests, 0 fallos, 9 archivos. No equivale a gate ni a evidencia nativa.
- Deuda US12 registrada como tarea pendiente en identidad antes de retirar el placeholder; T036 conserva su historia y T045/T063 siguen pendientes.

- Fase unitaria (hallazgos 2/3/4/8/9): retiradas aserciones sobre fakes, archivo de borrador trivial, bloque unitario de integración y repeticiones de color/label; permanecen los casos identificados en D1. Verificación focalizada: 365 pass, 0 fail; integración viva con `.env` local existente y `SUPABASE_LIVE_TESTS=1`: 73 pass, 0 fail, sin omisiones (14 archivos). Biome: 5 archivos sin errores. Mutaciones temporales revertidas: un token `stamp` divergente en `:root.light` falla por igualdad; `label` con `uppercase` y con `font-mono` falla en el caso conservado. Tras restaurar: tema/tipografía 338 pass, 0 fail.

- Fase web/nativa (hallazgos 1/5/6): smoke Chromium con backend local, 13 passed. Las diez rutas y sus `readyTestID` siguen en `accessibility.spec.ts`; el smoke conserva activación de enlaces, pero pierde el recorrido general duplicado. Envío vacío fusionado con teclado conservando foco/Intro/alerta y observando `/auth/v1/token`: una petición simulada en el evento submit hizo fallar la aserción; tras retirar la mutación, 1 passed. Esta comprobación focalizada reutilizó el export estático del smoke mediante configuración temporal externa (puerto 8084, un worker); no acredita la suite web completa de 5.1. Comparación estática: todos los pasos del placeholder nativo están en `auth.yaml`; README y T063 actualizados. T036/T049 conservan las rutas como historial, sin ejecución nativa ni aceptación US12. Biome: ambos archivos web sin errores.

- Fase de exports (hallazgo 7): eliminados los seis símbolos de D3. Para cada uno, búsqueda global literal incluyendo archivos ocultos, scripts, configuración y OpenSpec: solo declaración/referencias internas y documentación del plan, sin consumidores. Inspeccionados imports de los cinco módulos, namespaces, reexports y carga dinámica: no exponen esos símbolos. Búsqueda posterior en `src`, `tests`, `scripts` y `.github`: cero coincidencias. Se conservan `createMemoryStorage`, `setLogSink`, `loadSyntheticCorpus` y campos legacy. Biome: 5 archivos sin errores; `bun run typecheck`: sin errores; comando focalizado de 4.2: 315 pass, 0 fail, 47 archivos.

- Balance de la matriz: aplicados los nueve candidatos, ninguno descartado. Se retiran 7 casos Bun (borrador: 1; guarda repetida: 1; distancias duplicadas: 4; label duplicado: 1), 2 casos web y 1 flujo Maestro placeholder, además de 2 aserciones sin valor. Se eliminan 6 exports. Diff de código/tests, excluyendo Markdown: 14 líneas añadidas, 128 retiradas, reducción neta de 114; no se midió ahorro temporal. Pendientes al cierre: gate y suite web completa Chromium, prerrevisión publicada y revisión por alguien distinto del autor. No se ejecutaron Maestro, SQL, Firefox ni WebKit; no hay cambios de migraciones, UI ni requisitos.

## Verificación de cierre (2026-10-26)

Sobre `8f43f160b36940c400932f7ea29a07c4d7ac9770`, tras autorización del responsable:

- `bun run gate`: salida 0; Biome (329 archivos), tipos y 1.017 tests pasan, 0 fallos. Las 80 omisiones de integración corresponden a la ejecución sin opt-in/configuración viva; no se presentan como verificadas.
- `SUPABASE_LIVE_TESTS=1 bun --env-file=<env-local-existente> run test:integration`: 73 pass, 0 fail, sin omisiones. Se repitió para aportar evidencia explícita de cierre.
- `bun --env-file=<env-local-existente> run test:e2e:web -- --project=chromium --workers=1`: 74 passed, 1 failed (4,6 min). Pasan los casos afectados, incluido teclado/login, recuperación tras caducidad, atribución, navegación y el recorrido conservado en accesibilidad. Falla `estados.spec.ts:66`, al esperar el primer paciente después de «Reintentar»: la pantalla sigue cargando al alcanzar los 5.000 ms. La suite local completa no está en verde.
- Diagnóstico focalizado con `systematic-debugging`: el mismo caso falla 3/3 veces, con instrumentación temporal de red y sin modificar sus expectativas; las dos respuestas sintéticas 500 llegan en 2–12 ms y no llega respuesta del reintento antes del límite. La instrumentación fue retirada. Una llamada autenticada directa a `searchPatients` con orden/página predeterminados tarda 5.318 ms, devuelve 25 filas y total 775. PostgreSQL muestra la consulta activa sin espera de bloqueo. La base contiene 775 pacientes acumulados. El servicio, la RPC, las migraciones y este test no cambian en la PR. Esto identifica una limitación local reproducible de la consulta frente al límite del test, no una regresión demostrada del recorte. No se aumentó el timeout, no se omitieron tests ni se borraron datos.
- [CI de la implementación](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/40345123583): calidad/tipos, unitarios/integración, auditoría de dependencias y job de Supabase/web en verde. Su base efímera pasa 337 tests SQL en 19 archivos, integración viva (73 pass) y Chromium (75 passed). Firefox/WebKit se omiten en PR conforme al workflow; Maestro no se ejecutó localmente. CI verde no elimina el fallo local reproducido.
- [Primera prerrevisión publicada](https://github.com/pbadillatorrealba-idia/diklass/pull/65#issuecomment-6419353501): sin hallazgos en los nueve candidatos. `receiving-code-review`: contrastado el informe, sin correcciones que aplicar. No consta revisión independiente en GitHub.

Estado histórico al registrar `2976e8a`: cierre bloqueado; 5.1 conserva el fallo web local y 5.3 requiere la revisión independiente. Resolver rendimiento de la RPC puede exigir migración o ampliar el alcance; D5 y AGENTS.md exigen consultar esa decisión al responsable. Este cambio no se archiva ni se declara aceptado mientras siga pendiente la resolución.

## Ampliación autorizada: rendimiento de búsqueda de pacientes

El responsable autoriza investigar y corregir el bloqueo de 5.1 en la misma PR. La aprobación
incluye la migración mínima que resulte del diagnóstico; no modifica resultados, requisitos,
contratos públicos, RLS ni atribución. Se mantienen los 5.000 ms del E2E y los datos existentes.

1. Obtener el plan real bajo rol autenticado y localizar el coste dominante, contrastando índices
y políticas existentes. No optimizar por suposición ni cambiar privilegios para ganar tiempo.
2. Añadir una regresión reproducible con volumen sintético acotado en una transacción que se
revierte. Debe detectar la búsqueda lenta y conservar paginación y aislamiento por clínica.
3. Aplicar la menor corrección de consulta/índice que conserve resultados y controles; comprobar
rojo/verde y registrar tiempos comparables. No se añaden dependencias ni abstracciones.
4. Verificar pgTap, tipos generados sin diferencias y typecheck si hay migración; integración viva
afectada y caso web fallido, un worker, sin repetir todo por fase. Actualizar evidencia y PR.
La revisión independiente y la aceptación siguen pendientes; no se descartan fallos del cierre.

### Primera corrección de la ampliación (sustituida)

- Plan real bajo `authenticated`, con `auto_explain` solo en la sesión de diagnóstico: la unión
  por `tutor.id::text` no usa la PK UUID. Repite lectura/RLS de 129 tutores por 775 pacientes,
  descartando 99.237 combinaciones; el plan tarda 4.071 ms sin red. Los índices existentes
  sobre `patientId` y `tutorId` no cubren esta expresión. No se cambia RLS ni se usa definer.
- Corrección mínima: migración `020_indice_busqueda_tutor.sql`, índice parcial de `id::text`
  para tutores. La RPC, sus permisos y resultados permanecen idénticos. Se usa 020 porque la
  base local compartida ya tiene 019 de audio aplicada por otro worktree; su archivo se facilitó
  temporalmente al CLI solo para reconocer el historial y se retiró sin añadirlo a esta rama.
- Regresión en la suite pgTap existente: 1.000 pacientes y 200 tutores sintéticos, insertados
  dentro de la transacción revertida de la suite. Antes del índice falla solo el límite de 5 s
  (14 s de suite); después pasan sus 14 casos (1 s), incluidos página de 25 y total 1.003 de su
  clínica. Los casos anteriores mantienen filtros, orden, nombres y aislamiento. No quedan fixtures.
- Tras aplicar el índice, el plan usa `clinical_records_tutor_text_id_idx` sin releer los tutores
  por paciente (240 ms). Llamada autenticada directa: 325/321/317 ms, 25 filas, total 776; el
  volumen local varió en un paciente por el entorno compartido (antes: 775 y 5.318 ms).
  Son mediciones locales, no un presupuesto para producción ni ahorro medido de CI.
- Verificación: pgTap completo 340 pass en 19 archivos; typecheck pasa; integración viva
  focalizada de ficha y atribución: 15 pass, sin omisiones. El E2E antes fallido pasa 3/3,
  conservando sus 5.000 ms y usando el export estático anterior con configuración temporal y
  un worker. No hubo cambios de cliente que requirieran regenerar ese export.
- `bun run db:types` ejecutado, pero la comparación local tiene drift ajeno: CLI local 2.122.0
  frente a 2.117.0 de CI, y esquema compartido de audio/storage. Repetir generación con CLI
  2.117.0 reduce el diff a `audio_path` y al esquema storage del otro trabajo. Se conserva el
  archivo versionado sin editar a mano; equivalencia exacta de la rama pendiente de CI limpio.
- Reversión de la corrección: eliminar únicamente el índice con `drop index
  public.clinical_records_tutor_text_id_idx` mediante una migración de reversión. No afecta datos;
  vuelve a permitir el plan lento, por lo que no resuelve el bloqueo de rendimiento.

- Prerrevisión de la ampliación publicada sobre `df5e5cf`: [informe](https://github.com/pbadillatorrealba-idia/diklass/pull/65#issuecomment-6419909749). Sin hallazgos críticos/importantes; se verifica y corrige el menor documental sobre estado histórico frente al estado posterior al índice. `receiving-code-review`: la corrección coincide con el E2E 3/3 y mantiene pendientes CI/tipos y revisión independiente.

### Corrección final: lectura de tutores materializada

El [CI de `df5e5cf`](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/40349022272)
reprodujo el fallo de la regresión pese al índice: la solución anterior dependía del plan.
Se clonó solo el esquema a una base temporal separada, sin datos compartidos. Allí se reprodujo
con 1.000 pacientes/200 tutores: 8.006 ms, lectura de 202 tutores repetida 1.003 veces. Aunque
usaba el índice, no había condición indexada por tutor y el plan de bajo volumen seguía
anidando recorridos completos. No se aumentó el límite ni se prepararon estadísticas para ocultarlo.

Se sustituye la migración 020, aún inédita en main, por `020_busqueda_pacientes_tutores.sql`:
misma definición de la RPC de 016, con una CTE `tutors as materialized` y la unión a esa lectura.
Esto evita repetir lectura/RLS de todos los tutores por paciente con independencia del plan,
sin convertir IDs, cambiar comparaciones de texto, privilegios, políticas, filtros ni resultados.
Se retira el índice innecesario. Localmente se revirtió únicamente el índice y registro 020 de
esta tarea antes de aplicar la versión corregida; no se tocó 019 ni datos de otros trabajos.

- Rojo/verde en el esquema temporal vacío: el mismo caso que fallaba a 8.006 ms pasa sin el
  índice y conserva los 14 resultados, página y aislamiento. Los fixtures terminan en rollback.
- Base compartida: pgTap completo 340 pass (19 archivos), integración focalizada 15 pass, E2E
  antes fallido 3/3 satisfactorio con el mismo timeout. Llamadas directas: 375/397/391 ms con
  1.421 pacientes; la base compartida siguió creciendo, por lo que no es una comparación de
  tiempos con idénticos datos. El código de cliente y el export reutilizado no cambian.
- Reversión: restaurar mediante una nueva migración la definición de `search_patients` de 016;
  no se borran datos, pero se recupera el trabajo repetido. No queda índice nuevo en esta PR.
- El fallo del CI del índice se conserva como evidencia histórica; tipos y verificación conjunta
  deben acreditarse de nuevo sobre la corrección final. La revisión independiente sigue pendiente.
