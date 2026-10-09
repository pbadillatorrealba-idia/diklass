## 1. Modelo (D1–D5 · FR-001, FR-027, FR-110–112)

- [x] 1.1 Confirmar que `clinical_record_action` (003) y los triggers admiten campos nuevos en
  `diagnosis` sin migración (D5); si no, reabrir D5. Verificación: nota en design.md.
- [x] 1.2 Escribir en rojo `tests/unit/registro/schema.test.ts`: campos nuevos opcionales → `null`,
  tutor sin contacto rechazado, `tri` inválido rechazado, plan con 4 diferenciales rechazado.
- [x] 1.3 Extender `schema.ts` (paciente, tutor, derivante) y crear el catálogo
  `ANAMNESIS_SECTIONS` con `kind` y `LEGACY_FIELDS` (D2–D4). Verificación: 1.2 en verde, `tsc`.
- [ ] 1.4 Extender `diagnosis` con protocolo, diferenciales, presuntivo, tratamiento y seguimiento
  (D5) y su servicio. Verificación: unit + integración viva (`SUPABASE_LIVE_TESTS=1`).

## 2. Servicios y consumidores (D6)

- [x] 2.1 Adaptar `ficha-service`, `tutor-service`, `anamnesis-service` (rechazo de campo legacy
  al escribir, lectura tolerante). Verificación: tests de servicio rojo→verde.
- [x] 2.2 Actualizar `features/voz` (esquema, extracción, panel) y `epicrisis-draft` al catálogo;
  actualizar `tests/fixtures/voz/conversacion-referencia.json`. Verificación: `bun test tests/unit/voz tests/unit/registro`.

## 3. Interfaz (D7)

- [x] 3.1 `ficha-form`: paciente ampliado, tutor ampliado, bloque derivante; etiquetas en
  `labels.ts`. Verificación: test de componente + e2e de alta de ficha.
- [x] 3.2 `anamnesis-section` por secciones plegables con campos `texto` y `tri`; «Campo previo» y
  panel de faltantes por sección. Verificación: `anamnesis-section.test.tsx`, axe claro/oscuro.
- [x] 3.3 Formulario del plan de la consulta (FR-112) y su inclusión en la epicrisis como
  propuesta del veterinario. Verificación: e2e `consulta-formulario.spec.ts` actualizado y sellado
  tras cierre.

## 4. Cierre

- [ ] 4.1 `bun run lint`, `tsc --noEmit`, unit, integración viva, e2e web (workers=1). Registrar
  evidencia y URLs de CI.
