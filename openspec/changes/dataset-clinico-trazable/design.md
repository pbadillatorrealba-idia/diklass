# Design

## Context

Ver [proposal.md](proposal.md). `scripts/demo/datos-demo.ts` ya define 15 tutores, 17 perros y
8 gatos con nombres naturales. El cargador usa los servicios de aplicación y sesiones reales;
su detección de duplicados solo consulta el primer RUT y considera también una carga parcial
como éxito. Vincula tutores por posición y consultas por nombre, y fuerza `field as AnamnesisField`.
Todas las entradas se marcan `reportada`. No hay pruebas específicas del dataset.

Los PDF locales son formularios vacíos. El canino tiene 11 páginas y el felino 9; la extracción
de texto permite localizar sus secciones. El catálogo actual ya refleja la ficha canina. No se
detectó un ID obsoleto en las ocho consultas existentes: el problema es la poca cobertura.
El README del ZIP canino advierte que sus bases no son historias clínicas completas y pueden
solaparse. No se importan sus filas ni se infieren diagnósticos a partir de ellas.

## Goals / Non-Goals

**Goals:** conservar comandos y cantidades, enriquecer el fixture existente y dejar una comprobación
ligera que obligue a revisarlo al evolucionar la app. El inventario y los relatos propuestos están
en [dataset.md](dataset.md); FR-128–FR-132 fijan la aceptación.

**Non-Goals:** generar personas desde fichas reales, automatizar diagnósticos, simular prevalencias,
crear un motor de generación, ampliar el esquema felino, fabricar grabaciones o modificar relojes
y auditoría del servidor. No sustituir fixtures mínimos de pruebas ni el corpus de conocimiento.

## Decisions

### D1 — Un fixture editorial pequeño y determinista

Reutilizar `datos-demo.ts`, los tipos de entrada de servicios, los esquemas y los catálogos
existentes. Cada entidad y entrada tiene `key` estable; los vínculos usan esas claves en lugar de
índices y nombres. La fecha de referencia del elenco es `2026-10-27`; los valores no dependen
aleatoriamente del día de ejecución. Los pacientes de nacimiento incierto llevan edad estimada,
no un cumpleaños inventado presentado como conocido.

No se añade Faker: no garantiza coherencia dentro de hogares ni aporta valor a 25 mascotas.
Cada relato se escribe en español local sobrio («departamento», «correa», «premios», «tutor»).
Se amplían los campos ya admitidos: adopción, esterilización, derivante y antecedentes negativos.

### D2 — Metadatos editoriales separados del contenido clínico

Un manifiesto versionado junto al fixture identifica `datasetId`, `version`, `referenceDate`,
`synthetic: true`, historial de revisiones y fuentes por ruta/SHA-256/página/sección/uso. Por entrada
se relacionan clave, caso, campo, procedencia clínica, fuente estructural o `editorial`, FR,
escenarios y prueba. Los nombres son parte del contenido, no de la identidad técnica.

Las reglas compartidas se referencian por ID: no repetir la misma cita en cien filas. Las frases
inventadas se describen como relatos sintéticos. El origen estructural «formulario canino, p. 5»
no implica que ese documento respalde el relato. `recuperada` solo se ejercita si hay una fuente
documental y fragmento reales del corpus; no es necesario fabricar esa procedencia en este cambio.

Por decisión del usuario, no se verifican los PDF ni localmente ni en CI. Las rutas, páginas y
SHA-256 son evidencia histórica de la inspección inicial, no una dependencia ejecutable ni una
garantía de vigencia documental. `data/` está ignorado por Git y no se distribuye a CI. Un checkout
limpio sin esos archivos permite validar íntegramente el contrato versionado del dataset.

### D3 — Dos historias longitudinales dentro de ocho consultas

Tres consultas cerradas, cinco abiertas (una con epicrisis en borrador) y una epicrisis correctiva
adicional, sin retroalimentación (módulo retirado por `eliminar-seguimiento`). El orden de operaciones respeta:
consulta → anamnesis/plan → borrador → aprobación simulada → siguiente consulta.

Reutilizar `recordDiagnosis`, `generateEpicrisisDraft`, `updateEpicrisisDraft`, `approveEpicrisis`,
y `correctEpicrisis`. Los tres estados aprobados
provienen de contenido editorial revisado como fixture y de actos simulados de cuentas de prueba;
no son aprobación de salidas generadas por un asistente. Documentar esto al ejecutar la carga.
No añadir acceso por service role ni atajos a triggers.

Los servicios no permiten fechar retrospectivamente consultas ni evoluciones: la auditoría registra
la carga real. Los intervalos del relato son una cronología simulada documentada y expresada en
el texto pertinente, sin falsear `created_at`, autores ni eventos. Esta versión demuestra orden y
vínculos, no agendas distribuidas durante semanas ni latencia clínica real. Una fecha de primera
visita histórica en la ficha no se presenta como fecha auditada de la consulta cargada.

### D4 — Contrato vivo y revisión explícita

Un test focalizado valida el fixture completo contra esquemas actuales, referencias, claves,
respuestas cerradas, cantidades, estados y matriz de cobertura. Todas las secciones tienen
ejemplos; cada campo del catálogo figura como cubierto o excluido con motivo. Las exclusiones no
permiten eliminar los ejemplos exigidos por FR-130.

Registrar huellas SHA-256 de los archivos vigilados: esquemas/catálogos y servicios clínicos usados,
`clinical-mutations` y sus tipos, migraciones, specs publicadas de registro/ficha
y specs activas de identidad y catálogos. Para directorios registrar también su inventario, para
detectar altas y bajas. Las rutas exactas se fijan al implementar y se comprueban en tests.

Un cambio de huella falla hasta revisar datos o justificar que siguen cubriendo el contrato.
La revisión contiene motivo y requisitos afectados; actualizar huellas no sustituye a ejecutar las
pruebas ni a revisar casos. Los cambios puramente internos pueden requerir confirmar vigencia:
se acepta ese coste pequeño frente a una integración semántica nueva con el parser de OpenSpec.

La CI actual omite Markdown y `openspec/**`; por eso un workflow ligero separado ejecutará solo
esta verificación para contratos, dataset y documentación clínica versionada vigilados, incluidas
specs. Usa Bun sin Supabase. La CI general conserva su tratamiento de cambios solo documentales.
Documentar el inventario de vigilancia y su ampliación al crear capacidades clínicas nuevas.
No vigilar rutas PDF, recalcular sus hashes ni introducir credenciales para obtenerlos.

### D5 — Prevalidación y carga fail-closed

Validar antes de autenticar/escribir; rechazar fixtures de veterinarios vacíos o mal formados y
cuentas de clínicas distintas. Mantener el bloqueo remoto salvo autorización explícita de FR-127.
Las escrituras permanecen secuenciales para reducir carga y facilitar diagnóstico.

Generar un manifiesto local de ejecución ignorado por Git, con versión, revisión, huella del fixture,
fecha real, mapeo clave → registro y eventos, conteos esperados/reales y estado. Se escribe
progresivamente para conservar el punto de fallo. No guardar claves, sesiones, RUT ni contactos.
Los IDs de auditoría se obtienen del servidor; no se inventan.

Al repetir, contrastar manifiesto y grafo persistido completo, incluyendo contenidos, estados,
vínculos y eventos esperados. Si falta el manifiesto pero hay datos del demo previo, informar
estado no verificable y detenerse; no adoptarlos silenciosamente. Versión distinta, contenido
alterado o carga parcial fallan con diagnóstico por claves. No reanudar ni hacer upsert en este
cambio: la reconstrucción explícita de una base local desechable es la solución existente.
No basta un archivo local de «completo», ni el primer tutor, para acreditar éxito.

### D6 — Datos personales y alcance clínico

Conservar correos `@example.test` y RUT sintéticos válidos de FR-127, sin publicarlos en reportes.
El prefijo telefónico del demo y los cuerpos de RUT no son garantía de rangos reservados: pueden
coincidir por azar. No conectar notificaciones ni verificaciones externas. Direcciones editoriales,
sin copiar domicilios de documentos. Las cuentas de veterinarios siguen en el fixture existente.

Los gatos sirven para probar ficha, búsqueda y hogares; no se les asignan preguntas caninas ni
se atribuye soporte clínico felino. Se preservan enfermedades/medicamentos solo como antecedentes
editoriales, sin añadir dosis nuevas ni presentar planes como recomendaciones de uso real.

## Risks / Trade-offs

- Realismo no equivale a validación veterinaria → revisión editorial y clínica registradas por
  separado; aceptación pendiente hasta reunir evidencia.
- Deriva silenciosa al añadir una capacidad fuera de rutas vigiladas → documentar que cada cambio
  clínico amplía la matriz y el inventario; no prometer detección automática de toda decisión de producto.
- Fallo a mitad de carga → manifiesto parcial y salida no cero; reconstrucción local deliberada.
- Reset borra toda la base local → no ejecutarlo en la comprobación de vigencia ni automáticamente.
- PDF local modificado o eliminado → no se detecta ni bloquea; su referencia conserva el carácter
  histórico. Un contrato versionado archivado sí exige revisar rutas/huellas y mantener su origen.
- Cronología auditada concentrada en la carga → no acreditar pruebas de intervalos o agendas
  históricas; fuera de alcance alterar contratos para permitir backdating.

## Migration Plan

1. Aprobar propuesta, diseño y elenco; completar primero pruebas focalizadas fallando.
2. Reemplazar el contenido editorial del fixture y ampliar el cargador y sus verificaciones.
3. La base demo existente se detecta como versión anterior/no verificable y no se toca. Para una
   base local desechable, el operador puede ejecutar el reset existente tras revisar su alcance.
4. Reversión: restaurar fixture y cargador anteriores y reconstruir solo la base demo desechable;
   nunca sobrescribir registros aprobados ni migrar datos reales.

## Complexity / Budgets

Sin dependencias, migraciones, servicio adicional ni cambio de UI. Un manifiesto versionado y otro
local se justifican por FR-129/FR-131 y FR-132, respectivamente; no se crea un sistema de migraciones
de datasets. La comprobación focalizada tiene presupuesto de 10 s y 256 MiB RSS en esta máquina
una vez instaladas dependencias; medirlo al implementar. La integración usa una sola base y se
ejecuta secuencialmente. Los presupuestos de UI existentes permanecen aplicables sin modificaciones.

Constitución: I, aprobación previa y tareas trazadas; II, pruebas antes de implementación;
III, reutilización; IV, errores y manifiesto verificable; V, sesiones reales, RLS y datos editoriales.
Este documento no certifica la ejecución de esas verificaciones.
