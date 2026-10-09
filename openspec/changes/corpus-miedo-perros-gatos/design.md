# Design

## Context

La ingesta ya existe: `incorporateSource` valida con `fuenteContentSchema` (bibliografía, licencia
y fragmentos numerados de 1 sin huecos; una fila = un documento) y `loadSyntheticCorpus` la usa
desde `scripts/cargar-corpus-conocimiento.ts` y desde `evaluacion.test.ts`. El corpus es inmutable
salvo retirada y no admite borrado (FR-053). El PDF fuente tiene 60 diapositivas, casi todas con
poco texto; varias son solo imagen, gráfico, vídeo o cierre. Ver `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Corpus real citable sin tocar esquema, RPC ni UI.
- Conjunto anotado verificable contra el corpus nuevo.

**Non-Goals:**
- Extraer datos de gráficos o imágenes; dividir el documento en varias fuentes; automatizar la
  conversión PDF→JSON.

## Decisions

### D1. Una fuente, fragmentos por tema

Una sola fuente porque el PDF es un único documento y la cita es documento+fragmento. Fragmentos
por tema (no uno por diapositiva, que sería ruido de 3–6 palabras), con `seccion` y el rango de
diapositivas al comienzo del texto («[diap. 22–24]») para poder auditar contra el original.
Secciones previstas: definición de miedo y ansiedad; estructuras nerviosas y respuesta de estrés;
conductas (lucha, huida, paralización, desplazamiento); cuándo es problema de bienestar;
clasificación social/no social/generalizado; prevalencia; factores predisponentes (genética, vida
temprana, socialización, habituación, adversidad, experiencias adultas, salud y dolor); aprendizaje
(condicionamiento, generalización, sensibilización); protocolo diagnóstico; fobia a ruidos
(frecuencia, factores de riesgo, tratamiento paliativo y curativo, medidas generales, fármacos y
medidas complementarias). *Alternativa*: un fragmento por diapositiva — rechazada, empeora la
búsqueda léxica y la lectura de las citas.

### D2. Transcripción manual, sin inventar

La transcripción se hace a mano desde las diapositivas ya revisadas. Los gráficos solo aportan lo
rotulado en texto (p. ej. «Fear/anxiety: 44 % [43, 46]», n = 1814); no se extrapolan barras. Los
fármacos (benzodiacepinas, trazodona, agonistas α2, imepitoína, gabapentina, pregabalina,
feromonas, dietas) se listan como figuran, sin dosis ni pauta: el documento no las da. La diapositiva
de acepromacina tachada se transcribe como «no recomendada» solo si el texto legible lo permite; si
no, se omite y se anota en el quickstart.
*Alternativa*: OCR automático — rechazada, sin garantía de fidelidad y sin revisión.

### D3. Metadatos mínimos y honestos

`bibliografia`: título «Problemas de miedo en perros y gatos», autoras `["Susana Le Brech"]`,
editorial «Animal Welfare Education Centre (AWEC) · Universitat Autònoma de Barcelona», año `null`,
doi/url `null`. `licencia`: tipo «Por confirmar», nota con la procedencia y que no hay licencia
verificada. Las referencias que cita cada diapositiva (Landsberg 2013, Diwoodie 2019, etc.) quedan
dentro del texto del fragmento correspondiente, no como fuentes aparte.

### D4. Conjunto anotado derivado del documento

`conjunto-anotado.json` conserva el formato `{ preguntas, preguntasFueraDeDominio }` con 10–12
preguntas, cada una con `documentoClave` y `ordinal` de su evidencia, y 5 fuera de dominio
(anestesia en caballos, vacunación en aves rapaces, etc.; ninguna sobre miedo en perros y gatos).
La clave del documento es `miedo-perros-gatos`.

### D5. Sustitución en entornos vivos por retirada

Las fuentes sintéticas ya incorporadas no se pueden borrar (FR-053): se retiran con la operación
existente de retirada, atribuida al veterinario que carga el corpus. El guion de carga no cambia de
contrato; solo lee el fixture nuevo.

## Risks / Trade-offs

- [Licencia desconocida de material con derechos de autor] → la licencia consta «por confirmar»; el
  PDF no se versiona; confirmar con la autora antes de cualquier uso fuera de la PoC.
- [Transcripción incompleta o con error clínico] → cada fragmento lleva sus diapositivas; revisión
  de un segundo lector contra el PDF antes de aceptar; los números se copian solo si son legibles.
- [Búsqueda léxica pobre con texto telegráfico] → fragmentos por tema con frases completas pero sin
  añadir contenido; la evaluación viva mide el efecto sobre SC-002.
- [Todo el corpus depende de un documento] → el conjunto anotado mide solo este documento; no
  generaliza a otros temas, y así se declara.

## Migration Plan

1. Fixture y conjunto nuevos con prueba unitaria; 2. repuntar guion y evaluación; 3. en cada
entorno vivo, retirar las fuentes sintéticas y cargar el corpus nuevo. Reversión: retirar la
fuente nueva y reponer el fixture sintético desde git.
