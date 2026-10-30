# Mapeo de las reglas de 006 a la hoja etológica (propuesta, pendiente de validación clínica)

**Estado:** propuesta. No se aplica ni se toca `reglas.ts` hasta que se valide.

## Por qué

006 se escribió contra el catálogo de anamnesis anterior. La hoja etológica (`anamnesis-catalog.ts`) lo
reemplazó: los campos `comportamiento_problematico`, `frecuencia`, `duracion`, `contexto`,
`desencadenantes`, `cambios_recientes`, `ambiente`, `convivencia`, `alimentacion`, `actividad`, `rutinas` y
`respuesta_tratamientos` son ahora **previos**: se leen con su rótulo, pero ya no se pueden escribir
(`isLegacyAnamnesisField`). Las reglas de `reglas.ts` los usan para decidir qué está «cubierto» y qué
«apoya» o «contradice» una hipótesis. Con la anamnesis nueva:

- ninguna sugerencia se da nunca por cubierta, así que «información faltante» repite siempre las mismas
  preguntas;
- ninguna hipótesis recibe insumos, salvo por `motivo_consulta`, `texto_libre` y `tratamientos_anteriores`,
  que sí siguen vigentes.

Los 6 tests vivos de `tests/integration/asistencia` fallan por esto (escriben campos previos).

## Cómo funcionan los campos nuevos

- `texto`: texto libre; las reglas lo buscan por términos, como hoy.
- `sino` (`si`, `no`) y `tri` (`si`, `no`, `a_veces`): respuesta cerrada. Para las reglas, **estar
  respondido** cubre la pregunta, y el valor sirve de apoyo (`si`, `a_veces`) o contra (`no`).
- Una regla admite varias entradas por rama: mapear un campo viejo a varios nuevos no cambia el código,
  solo los datos de `reglas.ts`.

## Sugerencias (`SUGERENCIAS`)

| Regla | Campo(s) previo(s) | Propuesta | Duda a validar |
|---|---|---|---|
| `aloneContext` | `contexto` | Cubierta si se responde alguno de `soledad_vocaliza`, `soledad_elimina`, `soledad_destroza`, `soledad_otras` o `soledad_destacar` | La sección «soledad» responde «cuando se queda solo», no «también en presencia del tutor». Se conservan los `terminosCobertura` |
| `behaviorProblem` | `motivo_consulta`, `comportamiento_problematico` | `motivo_consulta`, `otros_problemas` (+ `historia_problema`); `soloSi` sobre `motivo_consulta`, `otros_problemas`, `texto_libre` | ¿`historia_problema` cuenta como describir el comportamiento? |
| `frequency` | `frecuencia` | **Sin campo propio.** Cubierta por `historia_problema` solo si el texto trae términos de frecuencia (`veces`, `diari`, `semanal`, `cada`, `frecuen`) | ¿Conviene agregar un campo de frecuencia a la hoja? |
| `duration` | `duracion` | `historia_problema` («inicio, evolución») | Ninguna: es la correspondencia natural |
| `triggers` | `desencadenantes` | **Sin campo propio.** Cubierta si se responde `familia_contextos`, `calle_contextos`, `visitas_contextos` o `miedo_reaccion` | ¿Son esos los contextos que importan o falta uno? |
| `previousTreatments` | `tratamientos_anteriores`, `respuesta_tratamientos` | Solo `tratamientos_anteriores` (la respuesta al tratamiento ya no es un campo) | ¿Se pierde algo clínico al no preguntar la respuesta por separado? |
| `currentMedications`, `knownAllergies` | — (ficha) | Sin cambio | — |

## Hipótesis (`REGLAS_HIPOTESIS`)

`soporte` y `contra` pasan de un campo previo a una o varias entradas. Los términos de texto se conservan;
las respuestas cerradas aportan `si`/`a_veces` como apoyo y `no` como contra.

| Hipótesis | Rama | Campo previo | Campos nuevos propuestos |
|---|---|---|---|
| Ansiedad por separación | soporte | `contexto` | `soledad_tiempo`, `soledad_destacar` (términos actuales) |
| | soporte | `comportamiento_problematico` | `soledad_vocaliza`, `soledad_elimina`, `soledad_destroza` (`si`, `a_veces`); `otros_problemas` (términos actuales) |
| | soporte | `desencadenantes` | `soledad_destacar`, `historia_problema` (términos actuales) |
| | contra | `contexto` | `soledad_vocaliza`, `soledad_elimina`, `soledad_destroza` = `no`; `soledad_destacar` (términos actuales) |
| | discrim. | `frecuencia`, `duracion`, `tratamientos_anteriores`, `respuesta_tratamientos` | `historia_problema`, `tratamientos_anteriores` |
| Miedo o fobia a ruidos | soporte | `desencadenantes` | `miedo_reaccion`, `historia_problema` (términos actuales); `miedo` (`si`, `a_veces`) |
| | soporte | `comportamiento_problematico` | `miedo_reaccion`, `conductas_repetitivas_otras` (términos actuales) |
| | contra | `desencadenantes` | `historia_problema` (`sin ruidos`) |
| | discrim. | `frecuencia`, `duracion`, `ambiente` | `historia_problema`, `vivienda_tipo`, `vivienda_destacar` |
| Agresividad territorial o hacia extraños | soporte | `comportamiento_problematico` | `motivo_consulta`, `otros_problemas` (términos actuales); `visitas_agresion`, `calle_agresion`, `familia_agresion` = `si` |
| | soporte | `contexto` | `visitas_contextos`, `calle_contextos`, `visitas_otros` (términos actuales) |
| | contra | `contexto` | `visitas_agresion` y `calle_agresion` = `no`; `visitas_contextos` (términos actuales) |
| | discrim. | `convivencia`, `frecuencia`, `tratamientos_anteriores` | `familia_otros_animales`, `contacto_familia`, `historia_problema`, `tratamientos_anteriores` |

## Lo que cambiaría si se valida

- `reglas.ts`: solo datos (campos y términos); sin cambios de lógica.
- Tests y fixtures de 006 (`tests/unit/asistencia`, `tests/integration/asistencia`,
  `tests/fixtures/asistencia/casos-anotados.json`): reescribirlos con campos vigentes. Los 13 casos anotados
  son los que miden si el mapeo conserva el comportamiento clínico esperado.
- `FR-008`/`FR-009` no cambian: es el mismo mecanismo transparente con otros campos.

## Fuera de alcance

Los términos clínicos (`ladra`, `tembla`, `visita`…) no se revisan aquí; solo se reubican. Una revisión de
esos términos con la hoja nueva es otra decisión.
