# Tasks: Sistema visual

Convención: Rojo-Verde-Refactor obligatorio (Constitución II): cada prueba se observa fallando por
la razón prevista antes de la implementación que cubre. El grupo 1 es la excepción documentada. Ese
código ya existe en `feat/tema-visual` sin especificación previa, así que sus tareas verifican y
registran evidencia en lugar de implementar; si una prueba nueva del grupo 1 pasa a la primera, se
comprueba que falla al revertir el cambio que cubre (mutación manual) y se deja constancia.
`quickstart.md` del cambio se crea en 1.1 y se completa de forma incremental. Las decisiones Dn
remiten a [design.md](design.md) y los requisitos a [la spec](specs/sistema-visual/spec.md). La
máquina de desarrollo tiene poca RAM: las suites e2e se ejecutan de una en una, con `--workers=1`.

## 1. Base implementada: verificación y registro (D1–D3)

- [x] 1.1 Crear `quickstart.md` con el inventario de lo implementado en `feat/tema-visual` (tokens, espejo, `useThemeColors`, fuente en `app.json`/`public/fonts`/`+html.tsx`, `AppUiProvider`, variantes de `Button`, `Input`, `:focus-visible`, `chromium-dark`, skills de Expo) y registrar `bun test tests/unit/theme` en verde, junto con la mutación que lo pone en rojo (alterar un canal de `--primary` en `global.css`) (FR-071 · FR-072). Verificación: salida rojo→verde pegada en `quickstart.md`.
- [x] 1.2 Verificar el modo oscuro en nativo (riesgo de D1/D9): arrancar la app en un emulador Android o simulador iOS con el esquema oscuro y confirmar fondo, texto, `Input` y navegación oscuros. Si no hay dispositivo disponible, dejarlo como pendiente explícito en `quickstart.md` (FR-071 · US13-AC1). Verificación: captura adjunta o pendiente registrado.
- [x] 1.3 Verificar la fuente en web y nativo: en web, las 4 peticiones `woff2` salen como `preload` antes del primer render y `/login` tiene CLS ≤ 0.1 (presupuesto de design.md); en nativo, `font-semibold` resuelve al peso 600 sin síntesis (FR-073 · US13-AC6). Verificación: traza de Playwright y captura registradas en `quickstart.md`.
- [x] 1.4 Ejecutar `accessibility.spec.ts` en `chromium` y `chromium-dark` (uno a la vez) y registrar 0 violaciones, incluido el recorrido de foco por teclado en `/patients` (FR-080 · SC-050). Verificación: resultados en `quickstart.md`.
- [x] 1.5 Comprobar que `OptionPicker` sigue exponiendo `checked` y que la opción elegida conserva la variante `primary` aunque esté deshabilitada (regresión de la sustitución de colores inline). Si no hay una prueba que lo cubra, escribirla en `tests/unit/` (FR-081). Verificación: prueba verde, y roja al quitar `variant`.

## 2. Tokens (pruebas primero) (D4, D6)

- [x] 2.1 Escribir en rojo `tests/unit/theme/sin-literales.test.ts` (D10): falla con archivo y línea ante hex, `rgb()`/`rgba()` y colores de paleta fija de Tailwind en `src/` fuera de `src/theme/`. Debe fallar hoy por `session-expired-dialog.tsx:19` (FR-081 · SC-051). Verificación: `bun test tests/unit/theme` en rojo, nombrando ese archivo.
- [x] 2.2 Ampliar `tema.test.ts` en rojo con los pares nuevos: `warning`, `success`, `info` y `destructive` con `-surface`/`-foreground` (≥ 4.5:1 para el texto, ≥ 3:1 para el borde contra `card`), `suggested` (≥ 3:1 contra `card`) y `background` más oscuro en claro. Luego añadir los valores a `global.css` y `colors.ts` ajustando solo la luminosidad, y el token `scrim` (FR-072 · FR-075 · SC-053). Verificación: rojo por tokens ausentes → verde; se muestran al usuario los valores propuestos (Open Question de design.md) antes del grupo 4.
- [x] 2.3 Subir la separación card/fondo en modo claro (`--background`, `--border` ≥ 1.4:1 contra `card`) y volver a verificar todos los pares con `background` (D4). Verificación: `tema.test.ts` verde y captura antes/después de `/patients` en `quickstart.md`.
- [x] 2.4 Extender `tailwind.config.js` con los colores nuevos, `maxWidth.content`/`wide` y `minHeight.touch`/`textarea` (D6), y sustituir `rgba(...)` + `padding: 24` del diálogo de sesión por `bg-scrim/55` y `p-6`. Verificación: `sin-literales.test.ts` verde y `bun run typecheck` verde.

## 3. Primitivas (pruebas primero) (D5, D7, D8)

- [x] 3.1 Instalar `@expo/vector-icons` con `bunx expo install @expo/vector-icons` (versión alineada con SDK 57, justificada en el Complexity Tracking) y ejecutar la auditoría de vulnerabilidades del proyecto. Verificación: `package.json` y lockfile actualizados, auditoría sin hallazgos altos y `expo-doctor` sin avisos nuevos.
- [x] 3.2 Escribir en rojo `tests/unit/ui/icon.test.tsx` y luego implementar `Icon`: exige `label` o `decorative` por tipos (`@ts-expect-error` en la prueba), el `label` expone `role="img"` + nombre y `decorative` queda oculto a la accesibilidad (FR-078). Verificación: la prueba pasa de rojo a verde y `typecheck` falla sin `label` ni `decorative`.
- [x] 3.3 Escribir en rojo las pruebas de `Text` (`variant` body/caption/label/strong, `tone` default/muted/destructive/warning/success/info) y `Heading` (`level` 1–3 → tamaño y nivel semántico), y luego implementarlos conservando `size`/`bold` como alias deprecados (FR-074 · D5). Verificación: pruebas en verde y pantallas actuales sin cambios de tipos.
- [x] 3.4 Escribir en rojo y luego implementar `Card` y `Screen` (`width` content/wide, `scroll`, padding `p-4 md:p-6`, `SafeAreaView`, propagación de `testID`) (FR-079 · FR-081 · D7). Verificación: pruebas verdes que comprueban las clases resultantes y el `testID`.
- [x] 3.5 Escribir en rojo y luego implementar `Callout` (`tone`, icono por tono, título opcional, `accessibilityRole` adecuado y `accessibilityLiveRegion="polite"` para `error`/`warning`) (FR-075). Verificación: pruebas verdes; el icono lleva nombre o el texto equivalente está presente.
- [x] 3.6 Escribir en rojo y luego implementar `SuggestedBlock` (borde `suggested`, etiqueta visible "Sugerencia del sistema" con icono y `accessibilityLabel` con el prefijo) (FR-076). Verificación: pruebas verdes, incluido que la etiqueta es texto y no solo color.
- [x] 3.7 Escribir en rojo y luego implementar `SeverityBadge` con la correspondencia de D4 para `leve`/`moderado`/`grave`/`critico`: nombre visible, icono, relleno sólido en `critico` y negrita desde `grave` (FR-077). Verificación: pruebas verdes para los 4 niveles, y el tipo acepta `AdverseEventSeverity` sin cambiar su vocabulario.
- [x] 3.8 Añadir a `Button` la variante `ghost` y la prop `size` (`sm`/`md`) manteniendo `min-h-touch`, con prueba en rojo primero (D7). Verificación: prueba verde y altura mínima de 44 px en ambos tamaños.

## 4. Migración por pantalla (una tarea = un commit con su e2e verde)

Cada tarea de este grupo:
- sustituye `SafeAreaView`/`ScrollView`/`max-w-[720px]` por `Screen`, las tarjetas por `Card`,
  `text-foreground/70` por `tone="muted"`, los `text-sm`/`text-xs` por `variant` y los `Heading
  size` por `level`;
- conserva todos los `testID`;
- se verifica con `sin-literales.test.ts` y `typecheck` en verde, la suite e2e de su feature en
  verde (`--workers=1`) y capturas claro/oscuro a 320 px y 1280 px en `quickstart.md`.

- [x] 4.1 `(auth)/login.tsx` y `login-form.tsx` (FR-074 · FR-079).
- [x] 4.2 `home.tsx` y el diálogo de sesión expirada (`rounded-xl`, `scrim`) (FR-081).
- [x] 4.3 `patients/index.tsx`, `patients/new.tsx`, `patients/[id].tsx`, `patient-history`, `antecedents-panel` y `AttributionBadge` (tarjeta de paciente con la acción a la derecha en `lg`, D9) (FR-079 · US13-AC4).
- [x] 4.4 `knowledge/index.tsx`, `knowledge/sources/*`, `avisos-cobertura` (→ `Callout`, `sin_respaldo_documental` como `error` y el resto como `warning`/`info`), `segmento-respuesta` (→ `SuggestedBlock`), `cita-fragmento` y `visor-documento` (FR-075 · FR-076 · US13-AC2).
- [x] 4.5 Componentes de voz: `draft-facts-panel` (hechos pendientes → `SuggestedBlock`; aprobados → atribución), `transcript-review` y `listen-mode-section` (FR-076 · escenario "Sugerencia aprobada").
- [x] 4.6 `consultations/[id].tsx`: `Screen width="wide"`, dos columnas en `lg` según D9 con el orden del DOM intacto, `missing-fields-panel` → `Callout warning`, más las secciones de anamnesis, diagnóstico y epicrisis y `follow-up-summary`. Resolver con el usuario la Open Question del resumen de seguimiento (FR-079 · US13-AC5). Verificación adicional: prueba e2e que a 1280 px afirma las dos columnas lado a lado y a 375 px una sola.
- [ ] 4.7 `follow-up/index.tsx`, `follow-up/[patientId].tsx`, `feedback-form`, `feedback-timeline` y `adverse-event-report` (→ `SeverityBadge`; `grave` destacado) (FR-077 · US13-AC3).
- [ ] 4.8 Revisar que `option-picker`, `anamnesis-section`, `diagnosis-section` y `epicrisis-fields` usan `min-h-textarea`/`min-h-touch` en vez de valores arbitrarios (FR-081).

## 5. Compuertas de accesibilidad y adaptabilidad

- [ ] 5.1 Escribir en rojo el caso de reflujo en `accessibility.spec.ts` (viewport 320×640 en todas las rutas cubiertas; `scrollWidth <= clientWidth`) antes de terminar el grupo 4. Debe fallar en al menos una pantalla sin migrar, o documentar que ya pasa (FR-079 · SC-052). Verificación: rojo→verde registrado.
- [ ] 5.2 Ejecutar la compuerta axe completa en `chromium` y `chromium-dark` y los proyectos `firefox`/`webkit` requeridos por la constitución, de uno en uno (SC-050). Verificación: 0 violaciones, con resultados y URLs de CI en `quickstart.md`.
- [ ] 5.3 Revisión en escala de grises (emulación `forced-colors`/grayscale de Chromium) de `/knowledge`, `/consultations/[id]` y `/follow-up/[patientId]`: sugerido vs validado y severidades distinguibles sin color (US13-AC2/AC3). Verificación: capturas en `quickstart.md`.
- [ ] 5.4 Prueba de texto ampliado: zoom del navegador al 200 % y, si hay dispositivo, Dynamic Type al máximo en `/patients` y `/consultations/[id]`, sin recortes (FR-074 · escenario "Texto ampliado"). Verificación: capturas o pendiente explícito en `quickstart.md`.

## 6. Limpieza y cierre

- [ ] 6.1 Confirmar con grep que no quedan `text-foreground/70`, `text-xs`, `max-w-[`, `min-h-[`, `rounded-2xl` ni `gap-1.5` en `src/` (D5–D6), y añadir esos patrones a `sin-literales.test.ts`. Verificación: prueba verde, y roja al reintroducir cualquiera de ellos.
- [ ] 6.2 Actualizar `AGENTS.md` con una sección breve sobre el sistema visual: dónde viven los tokens, qué primitiva usar para cada caso y la prohibición de literales. Verificación: sección presente y revisada.
- [ ] 6.3 Retirar los alias deprecados (`Text size`/`bold`, `Heading size`). Verificación: `typecheck`, `bun test` y Biome en verde.
- [ ] 6.4 Ejecutar las compuertas locales (`bun run typecheck`, `bunx biome check`, `bun test`) y dejar CI en verde; consolidar `quickstart.md` sin dar por aceptado nada que no lo esté, con los pendientes explícitos (verificación nativa si faltó y aceptación conjunta de FR-076/FR-077 con 003–005). Verificación: documento completo y URLs de CI.
- [ ] 6.5 Generar el reporte de revisión en español con `requesting-code-review` sobre el rango completo de la rama. Verificación: reporte existente y su ubicación registrada.
