## Why

La ficha actual (FR-001, FR-004) es genérica: paciente con 8 campos, tutor con nombre y contacto,
y una anamnesis de 14 campos inventados para la PoC. La clínica trabaja con la hoja «Consulta de
etología clínica» del Hospital Clínic Veterinari (FVB, Barcelona; `data/docs/Hªclinica canina
nueva.pdf`, 11 págs.). Mientras la ficha no hable el mismo idioma que esa hoja, el veterinario
tiene que reinterpretar cada dato y el CDSS no recibe la información que la etología realmente usa
(conducta social, eliminación, soledad, fobias, manejo, protocolo diagnóstico).

## What Changes

- **Paciente (perro)**: añadir los datos de la hoja que faltan: procedencia, edad de adopción,
  estado al adoptar, edad de gonadectomía, datos de progenitores/camada, nº de expediente y fecha
  de la 1ª visita. Todos opcionales (FR-044).
- **Tutor**: añadir apellidos, dirección, población, CP. Se conserva «al menos un medio de
  contacto» (FR-027).
- **Veterinario derivante**: bloque nuevo (refiere sí/no, nombre, centro, teléfono, seguro,
  opinión sobre el problema) como parte de la ficha.
- **Anamnesis**: reemplazar el vocabulario de 14 campos por las secciones de la hoja: motivo
  principal y otros problemas, historia clínica del problema, entorno y familia, rutina, alimentación,
  eliminación, soledad, actividad, conducta social (familia / desconocidos / visitas / otros
  perros), manejo y educación, otras conductas (fobias, monta, fugas, repetitivas), tratamientos
  anteriores, historial médico. Se mantienen la procedencia por campo (FR-021) y el texto libre.
- **Preguntas Sí/No/A veces** pasan a ser un tipo de respuesta estructurado, no texto.
- **Plan de la consulta (nuevo)**: protocolo diagnóstico (pruebas marcables, grabación en vídeo),
  diagnósticos diferenciales de conducta (hasta 3), diagnóstico presuntivo, medidas de tratamiento
  (pautas generales/específicas, castración quirúrgica/médica, medicación con 2 principios activos)
  y seguimiento. Todo lo escribe el veterinario; ninguna decisión clínica automática.
- **BREAKING (solo datos sintéticos)**: los valores de `AnamnesisField` cambian; las filas
  `anamnesis` existentes con campos antiguos se siguen leyendo (se muestran bajo «Campo previo»),
  no se migran ni se borran. Se actualizan la extracción de voz y el borrador de epicrisis que
  usan esos identificadores.

Fuera de alcance: la hoja felina (`Hªclinica felina nueva.pdf`), la hoja «MIEDO», adjuntos de
analítica/vídeo/educación (las casillas de «Pautas, Informe vet, Educación, Analítica, Vídeo» se
guardan como marcas, sin subir archivos), y cambios de esquema SQL.

## Capabilities

### New Capabilities

- `ficha-etologica-canina`: contenido estructurado de la ficha canina de etología clínica
  (paciente, tutor, veterinario derivante, anamnesis por secciones y plan de la consulta).

### Modified Capabilities

Ninguna publicada en `openspec/specs/` (vacío). Redefine, sin retirarlos, FR-001, FR-027 y FR-004
del cambio `implementar-registro-clinico-longitudinal`: conserva sus IDs y escenarios y añade
campos. Condición de aceptación conjunta: ese cambio y `implementar-captura-voz-anamnesis`
(que consume `AnamnesisField`).

## Impact

- Código: `src/features/registro/schema.ts` (+ nuevo `etologia-schema.ts`), `ficha-service.ts`,
  `tutor-service.ts`, `anamnesis-service.ts`, `epicrisis-draft.ts`; `src/components/registro/*`
  (`ficha-form`, `anamnesis-section`, `labels`, `missing-fields-panel`, resúmenes);
  `src/features/voz/{schema,extraction,audio-fact-service}.ts`, `draft-facts-panel`.
- Base de datos: sin migración; `content` es jsonb validado con Zod. `supabase/tests/008` usa
  `motivo_consulta` como dato de fixture y sigue válido.
- Pruebas: unitarias de esquema, integración viva, e2e `consulta-formulario`, fixtures de voz.
- Dependencias: ninguna nueva.
