# Design

## Context

`tests/e2e/web/caso-sintetico.ts` crea «Marcela Rojas (caso sintético)» y «Luna Caso Sintético»;
`preparar-paciente.ts` genera «Tutor de…». Los helpers de integración y e2e prefieren
`EXPO_PUBLIC_SUPABASE_URL` a `SUPABASE_URL`. La CI reconoce residuos y hace reset entre suites.
`playwright.config.ts` admite `PLAYWRIGHT_BASE_URL`, pero su servidor y URL de espera siguen
fijados a 8083. Exportar la app incorpora `EXPO_PUBLIC_*` al bundle.

La migración 004 revoca DELETE/TRUNCATE a anon/authenticated sobre registros y auditoría. Existen
referencias entre correctivas y eventos, consultas de conocimiento y pacientes, sesiones de voz,
documentos y fragmentos, además de objetos en storage. Cerrar un APIRequestContext no limpia DB.

Context7 se consultó para Supabase CLI y Playwright 1.63.0. El primero separa recursos por
`project_id` y permite configurar puertos; el segundo ofrece fixtures con setup/teardown e
identidad de worker. Las referencias se incluyen al final. La compatibilidad de opciones exactas
se verificará con el CLI fijado del repositorio; no asumir overrides de versiones más nuevas.

## Goals / Non-Goals

**Goals:** reutilizar contenido editorial sin compartir filas, proteger el demo y hacer verificable
el ciclo de limpieza de integración viva y e2e web. Ejecutar una sola instancia de testing y un
worker por disponibilidad de RAM. Maestro Cloud y los e2e nativos conservan su flujo actual,
incluido su backend remoto sintético; quedan fuera por decisión del usuario.

**Non-Goals:** modificar el backend remoto nativo, nueva clínica/tenancy del producto, permisos de borrado
en la aplicación, sincronización entre bases, framework genérico de factories o un servicio nuevo.
No renombrar cadenas que sean intencionadamente el objeto de una prueba de validación.

## Decisions

### D1 — Configuración explícita y mínima

Variables propuestas, con valores no sensibles en `.env.example` y explicación en `SETUP.md`:

| Variable | Uso / condición |
|---|---|
| `TEST_SUPABASE_URL` | URL local del API de testing; obligatoria para suites vivas |
| `TEST_SUPABASE_ANON_KEY` | Clave pública del mismo entorno; obligatoria |
| `TEST_DATABASE_URL` | Conexión PostgreSQL privilegiada solo para runner/teardown; obligatoria, nunca pública |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Solo suites que ya necesitan administración Auth/Storage; requerida en esas suites |
| `TEST_SUPABASE_PROJECT_ID` | Identidad esperada del proyecto local de testing, distinta de `diklass`; obligatoria |
| `E2E_WEB_PORT` | Puerto del servidor y URL de espera; predeterminado 8083, sobrescribible |

El runner valida configuración completa y destino antes de arrancar app o escribir. Inyecta las
dos variables públicas correspondientes en el proceso de exportación web y en los helpers, sin
editar `.env`. Un `PLAYWRIGHT_BASE_URL` explícito incompatible con el servidor gestionado falla
con diagnóstico, no se combina silenciosamente. Limpiar caché al cambiar backend exportado;
mantener una sola exportación. El runner produce un identificador de ejecución interno, no una
nueva variable obligatoria para el usuario.

`SUPABASE_LIVE_TESTS=1` sin configuración completa falla; sin ese opt-in, la suite unitaria normal
conserva la omisión de tests vivos. Igual criterio para e2e solicitados expresamente con backend.
No mostrar credenciales ni URLs con contraseña en errores.

### D2 — Un entorno local independiente, solo bajo demanda

Preparar una configuración de Supabase de testing derivada de la actual, en directorio de trabajo
temporal ignorado por Git: `project_id` propio y puertos libres explícitos para todos los servicios
habilitados y puerto shadow. Reutilizar migraciones/seed del repo sin otra copia mantenida a mano.
No modificar `supabase/config.toml` de desarrollo ni arrancar dos stacks automáticamente.

El runner confirma identidad de los recursos locales y correspondencia de API/DB/credenciales.
Además crea una marca privada de entorno en la DB desechable, fuera del API público, y la exige
en cada limpieza. La marca solo se crea al verificar el proyecto de testing; no convertir una
base arbitraria en «testing» por recibir una URL. Reservar el entorno con un lock de PostgreSQL
mantenido por la conexión del runner para que distintos checkouts no escriban simultáneamente.

Es necesario aislar también Auth/Storage, por lo que otra base PostgreSQL dentro del backend de
desarrollo no basta. La instancia usa los mismos servicios reducidos que `db:start`; ejecutarla
en lugar del stack de desarrollo, con parada/arranque solicitados expresamente si este está vivo.
No detener procesos del usuario automáticamente. CI ya dispone de entorno efímero y deberá
identificarlo con el mismo contrato.

### D3 — Plantillas compartidas, registros de cada test

Importar por clave las plantillas del dataset implementado. Copiar solo lo necesario para el caso,
sin cargar todos los pacientes. Los nombres visibles permanecen naturales; UUID y RUT válidos por
intento evitan colisiones. Los selectores usan el paciente creado o su URL/ID para resolver homónimos.
Cambiar helpers primero y luego sus consumidores; preservar pruebas de orden, búsqueda y duplicados.

Antes de enviar una mutación, persistir en el registro local su intención asociada a ejecución,
test e intento y su criterio exacto de recuperación. Reservar UUID cuando el camino actual admita
ID del cliente; en UI o Auth con ID del servidor, reservar RUT/correo exacto exclusivo o un padre
ya propio que permita enumerar inequívocamente sus hijos. Storage usa una ruta exacta reservada.
La intención debe quedar durable antes de escribir; el ID devuelto la completa, no la inicia.

Reconciliar respuesta perdida o interrupción consultando esas identidades exactas y dependencias
del caso, registrar los IDs encontrados y verificar propiedad antes de limpiar. No inferir
propiedad por nombre, prefijo ni intervalo temporal. Inventariar el criterio para cada operación;
si no puede recuperarse sin ambigüedad con el contrato actual, no despacharla hasta resolverlo,
y consultar al usuario si requiere cambiar ese contrato. Probar específicamente confirmación
servidor seguida de respuesta perdida y de interrupción antes de completar el registro.

El setup también queda dentro de `try/finally`; Playwright usa fixture con `await use` y Bun
teardown equivalente. No confiar únicamente en `afterAll`. Mantener registro de recursos
indirectos: eventos, access_sessions, fragmentos materializados, cuotas y objetos de storage.

### D4 — Teardown privado y acotado

Las creaciones siguen los caminos de autenticación/atribución actuales. La limpieza usa conexión
privilegiada de tests, nunca un RPC desplegado ni credenciales enviadas al navegador. En una
transacción, verificar marca y propiedad y eliminar únicamente IDs registrados en orden inverso
de dependencias: hijos, correctivas y referencias a eventos antes que padres. No desactivar
constraints ni triggers. Determinar el orden exacto con los FKs del esquema implementado y
comprobarlo con un caso que incluya correctivas, voz y conocimiento.

Storage no participa de la transacción SQL: registrar objetos al crearlos y limpiar/verificarlos
por API administrativa, guardando residuos si falla una parte. Los recursos de auth/consentimiento
compartidos tienen baseline y restauración explícita; no borrar cuentas de veterinarios provisionadas
que no sean propiedad del test. Fuentes/corpus compartidos tampoco son propiedad de cada caso.

`delete_assistant_conversation` elimina todos los mensajes del autor, no solo los del fixture.
Los casos que ejercitan esa RPC usan cuentas exclusivas del caso/intento, cuyo correo se registra
como intención antes de provisionar; verificar conversación vacía antes del test. Conservar las
pruebas funcionales del borrado y mensajes centinela de otro autor. Los helpers de preparación
no vacían conversaciones ni consentimientos de cuentas compartidas; usan la cuenta del caso o
limpieza privada por IDs propios. Las cuentas exclusivas y sus recursos también se reconcilian.

Verificar ausencia de recursos del test y preservación de centinelas. La limpieza fallida hace
fallar la suite y se reporta junto al fallo original. Un archivo de ejecución ignorado por Git
permite recuperar residuos de procesos interrumpidos con la misma validación de entorno. No
ejecutar borrados por prefijos, nombres o clínica. No ejecutar reset como sustituto silencioso del
teardown: el reset inicial solo pertenece al entorno desechable identificado.

## Risks / Trade-offs

- RAM → una instancia bajo demanda, integración/e2e secuenciales y un worker; no aprovisionar aquí.
- Colisiones entre tests/retries → IDs nuevos por intento y lock en DB para runners independientes.
- Auditoría y correctivas con referencias cruzadas → orden de borrado probado sin cambiar el producto;
  si exige migración o cambio de contrato, presentar la decisión antes de implementar.
- SIGKILL no ejecuta teardown → reporte persistente de residuos y recuperación acotada; no prometer
  limpieza inmediata en ese caso.
- Cambiar el backend sin recompilar web → inyección consistente, limpieza de caché y verificación
  del destino desde el test antes de crear datos.

## Migration Plan

Tras aprobación e implementación del dataset, introducir configuración y registro de recursos,
adaptar helpers y después todos los escritores inventariados. Verificar fallos de setup/teardown
y repetición antes de retirar el reset intermedio de CI. Eliminar ese reset solo cuando la suite
completa demuestre ausencia de residuos. Reversión: restaurar helpers/configuración y el reset
anterior de CI; no requiere tocar el backend de desarrollo ni migraciones.

## Complexity / Budgets

Sin dependencia nueva: tipos/plantillas existentes, fixtures de Playwright, hooks de Bun y clientes
ya instalados. Configuración aislada, registro de recursos y marca/lock privados responden a
FR-134–FR-136; no son infraestructura del producto. Propuesta de presupuesto: validación de
configuración ≤1 s sin iniciar Docker; medir durante implementación. Supabase/exports/e2e siempre
secuenciales. Sin cambios de UI ni de su presupuesto existente.

Constitución: I, aprobación previa; II, tests rojos antes de cambios; III, soporte mínimo compartido;
IV, residuos y fallos observables; V, destino verificado y secretos fuera del cliente. Planificar
destrucción de una instancia de tests no autoriza borrar historiales de producto.

## References

- [Supabase CLI, plantilla de configuración](https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/templates/config.toml).
- [Supabase CLI, identidad de recursos Docker](https://github.com/supabase/cli/blob/develop/internal/utils/config.go).
- [Playwright 1.63.0, aislamiento por worker](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-parallel-js.md).
- [Playwright 1.63.0, fixtures](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-fixtures-js.md).
