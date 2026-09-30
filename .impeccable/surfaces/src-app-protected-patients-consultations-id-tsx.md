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
por el veterinario va en tinta negra. Lo sugerido va en pliego canario: es el único color de
superficie. Las correcciones van en pliego rosa, con el renglón anterior tachado de una línea. La
firma es un timbre de tampón azul-violeta con nombre y hora. La procedencia se marca al margen con un
código de una letra (R, I, F, ?) y siempre lleva forma además de color. Los estados salen de un solo
enum que traduce una sola hoja de estilo.

STORY: El veterinario recorre el formulario de arriba abajo, ve de dónde viene cada dato, recibe los
avisos del sistema como renglones impresos, revisa los diferenciales en canario con su cita y firma.
Al firmar, la copia pasa a ser el original.

FIRST VIEWPORT: En web ancho, a la izquierda el encabezado del formulario: paciente, tutor, número de
consulta y la clave de procedencia siempre visible. Las secciones numeradas del 1 al 6 bajan por un
solo eje vertical y la activa se marca con una banda. A la derecha, el resumen de seguimiento
longitudinal. En compacto, una columna. «Firmar» queda fijo al pie de la sección activa.

FORM: Formulario en copias (formularios normalizados + lista de verificación de la OMS). Candidato 5
de la lista ordenada. Seed key 76e472f6.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: la firma. «Firmar» estampa el timbre (nombre + hora, FR-063) y el pliego
canario vira a papel en un solo movimiento. Con Reduce Motion, el cambio es inmediato.

## Unresolved

- Cara tipográfica de los rótulos preimpresos, por decidir en la construcción. Los datos pueden
  seguir en Atkinson Hyperlegible Next por la legibilidad de dosis e identificadores.
- Modo oscuro: traducir papel y tinta a pizarra, con el canario como ámbar tenue. Hay que definirlo
  y verificar AA.
