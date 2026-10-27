# Tasks

Estado: planificación documental. Todo pendiente de implementación; ninguna casilla acredita
aceptación. Especificación y diseño deben aprobarse antes de ejecutar estas tareas.

## 1. Fixture editorial y contrato

- [ ] 1.1 Aprobar especificación, diseño y elenco, y registrar la revisión de plausibilidad de hogares,
  edades, pesos y relatos sin confundirla con validación veterinaria (FR-128, FR-130; US20-AC1/AC2).
  Verificación: aprobación identificable y observaciones resueltas en la PR.
- [ ] 1.2 Escribir pruebas de `tests/unit/scripts/datos-demo.test.ts` para cantidades de FR-127,
  claves/referencias, esquemas vigentes, homónimos y cambios de nombre, campos cerrados y faltantes;
  observarlas fallar por ausencia del contrato nuevo (FR-128–FR-130; US20-AC1/AC3/AC4/AC6).
  Verificación: registrar comando focalizado y fallo esperado antes de implementar.
- [ ] 1.3 Adaptar `scripts/demo/datos-demo.ts` al elenco y las claves estables, con 14 secciones,
  procedencias, antecedentes negativos explícitos y datos desconocidos. Crear el manifiesto
  versionado de fuentes/cobertura y desglosar los guiones C01–C08 y F01–F06 de `dataset.md`
  en entradas tipadas (FR-128–FR-130). Verificación: pruebas 1.2 en verde y revisión editorial de
  los ocho guiones completos; cada campo clasificado como cubierto o excluido con motivo.
- [ ] 1.4 Documentar fuentes, versión, claves, convenciones, ausencia de datos personales reales y
  límite felino en `SETUP.md` (FR-128/FR-129). Verificación: enlaces/rutas resuelven y no se
  presenta inspiración estructural como evidencia clínica; no se publican secretos ni contactos.

## 2. Carga y trazabilidad de ejecución

- [ ] 2.1 Escribir y observar fallar pruebas focalizadas del cargador: fixture inválido antes de
  escribir, veterinarios vacíos/de clínicas distintas, remoto bloqueado, carga parcial, versión
  distinta, manifiesto ausente, repetición completa y registros alterados (FR-132; US20-AC9/AC10).
  Verificación: pruebas fallan por la limitación concreta y no por configuración ausente.
- [ ] 2.2 Ampliar el cargador con prevalidación, mapeo por claves, operaciones clínicas existentes,
  manifiesto local progresivo ignorado por Git y verificación de grafo/contenido/eventos (FR-129,
  FR-130, FR-132). Verificación: pruebas 2.1 pasan; un error intermedio da salida no cero sin reset,
  y una segunda ejecución completa no crea ningún registro adicional.
- [ ] 2.3 Escribir y observar fallar integración viva focalizada de las ocho consultas, tres epicrisis
  aprobadas, un borrador, seis retroalimentaciones incluida correctiva, epicrisis correctiva,
  atribución cruzada y recuperación longitudinal (FR-129/FR-130/FR-132; US20-AC3/AC5/AC10).
  Verificación: rojo documentado, posterior verde con Supabase local aislado; comparar originales.
- [ ] 2.4 Documentar carga completa/parcial/antigua, ubicación del manifiesto, cronología simulada
  frente a fechas reales, y reconstrucción explícita de base desechable (FR-132). Verificación:
  ningún camino reinicia automáticamente la base; el ejemplo permite seguir una entrada desde
  fuente hasta evento real sin introducir credenciales en el manifiesto.

## 3. Vigencia y CI ligera

- [ ] 3.1 Escribir pruebas de deriva de esquema/catálogo, fuente modificada, alta/baja de archivo
  vigilado, spec cambiada y revisión compatible justificada; observar rojo (FR-131; US20-AC7/AC8).
  Verificación: el fallo nombra contrato/clave afectados y no se resuelve únicamente renovando huellas.
- [ ] 3.2 Implementar comprobación de huellas e inventario, cobertura y revisiones motivadas; exponer
  un comando focalizado de comprobación en `package.json` (FR-129/FR-131). Verificación: 3.1 en verde,
  comprobación sin credenciales ni DB y medición ≤10 s / 256 MiB RSS tras instalación.
- [ ] 3.3 Añadir workflow ligero separado para dataset y contratos/documentos vigilados, incluidas
  modificaciones solo OpenSpec; documentar cómo extender vigilancia al crear capacidades (FR-131).
  Verificación: comprobar filtros para un cambio de spec, un catálogo y una adición de migración;
  el trabajo ligero no arranca Supabase ni modifica datos y el cambio solo documental no lanza gate.

## 4. Integración y aceptación

- [ ] 4.1 En una base de prueba explícitamente desechable, verificar carga inicial y repetición,
  inspeccionar fichas e historial de Cholito y Frida, comparar epicrisis originales/correctivas,
  y registrar qué se probó y qué sigue pendiente (FR-128–FR-132). Verificación: evidencia local
  y manifiesto completo; revisión veterinaria del contenido registrada por separado.
- [ ] 4.2 Tras autorizar el cierre de la PR de implementación, ejecutar las compuertas requeridas
  por las rutas finalmente modificadas y prerrevisión en español con Sobreingeniería conforme
  a AGENTS.md (FR-128–FR-132). Verificación: resultados y reporte enlazados en la PR; no inferir
  aceptación clínica a partir de pruebas automatizadas.

## Workflow follow-up

- La reutilización de nombres y el ciclo de creación/eliminación de datos en tests serán otro cambio
  y otra PR, dependientes de este contrato. No renombrar ni limpiar suites dentro de esta entrega.
- Sincronizar/archivar solo después de implementación, verificación y aceptación demostrada, sin
  declarar aceptado el cambio activo `catalogos-y-datos-demo` por haber preparado este documento.
