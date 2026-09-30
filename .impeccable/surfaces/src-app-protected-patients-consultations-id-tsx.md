---
version: 1
slug: "src-app-protected-patients-consultations-id-tsx"
primary_target: "src/app/(protected)/(patients)/consultations/[id].tsx"
related_targets: []
---

## Scope

Pantalla de Consulta (`consultations/[id]`), modo **Operate**. Primera superficie del mundo visual
nuevo; el resto de la app lo hereda. Adaptativa: iOS, Android y web.

## Audience and task

El veterinario, durante la consulta, con tutor y perro presentes. Registra la anamnesis con su
procedencia, revisa lo que falta, considera los diferenciales, valida y firma la epicrisis. En la
demo, los evaluadores tienen que ver en segundos qué sugirió el sistema y qué firmó el profesional.

## Constraints

Todo lo visual se puede reemplazar. Evitar lo frío-hospitalario y lo lúdico (sin patitas ni
ilustraciones de perros). WCAG 2.2 AA en modo claro y oscuro. La navegación sigue a cada sistema
operativo.

## Direction contract

THESIS: Lo sugerido es la copia amarilla y solo la firma del veterinario la vuelve original. Rechaza
el tablero de tarjetas con panel de «Hallazgos IA», destellos y violeta.

OWN-WORLD: Formulario clínico normalizado. La estructura preimpresa va en una sola tinta verde de
formulario (reglas, recuadros, rótulos, números de campo) sobre papel frío casi blanco. Lo escrito
por el veterinario va en tinta negra. Lo sugerido va en pliego canario y las correcciones en pliego
rosa, con el renglón anterior tachado de una línea: los pliegos son el único color de superficie. La
firma es un timbre de tampón índigo con nombre y hora. La procedencia se marca al margen con un
código de una letra (R, I, F, ?) y siempre lleva forma además de color. Los estados salen de un solo
enum que traduce una sola hoja de estilo.

STORY: El veterinario recorre el formulario de arriba abajo y ve de dónde viene cada dato. Revisa en
canario la epicrisis que redactó el sistema, ve cada corrección tachada junto a lo que reemplaza, y
firma. Al firmar, la copia pasa a ser el original. Los diferenciales en canario llegan con 006.

FIRST VIEWPORT: En web ancho, a la izquierda el encabezado del formulario: paciente, tutor, «Consulta
n.º N», fecha en mono y la clave de procedencia siempre visible. Las secciones 1 Anamnesis,
2 Diagnóstico y 3 Epicrisis y firma bajan por un solo eje vertical; la activa se marca con una banda.
A la derecha, el resumen de seguimiento longitudinal. En compacto, una columna. «Firmar y cerrar
consulta» queda al pie de la sección 3.

FORM: Formulario en copias (formularios normalizados + lista de verificación de la OMS). Candidato 5
de la lista ordenada. Seed key 76e472f6.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: la firma. «Firmar y cerrar consulta» estampa el timbre (nombre + hora, FR-063) y el pliego
canario vira a papel en un solo movimiento. Con Reduce Motion, el cambio es inmediato.

## Resolved (design.md D20, 2026-09-30)

- Rótulos preimpresos en Atkinson Hyperlegible Next (variante `rubric`); datos en Atkinson
  Hyperlegible Mono (variante `data`).
- Modo oscuro: pizarra con tinte verde; los pliegos pasan a tintes cálidos opacos verificados AA.
- La información faltante y los diferenciales no son secciones de la consulta hasta 006.

## Unresolved

- Ninguno para esta superficie. Los valores finales de color los fija `tema.test.ts` (12.1).
