# Tasks

Pruebas primero (Constitución II): cada tarea con código abre con su prueba en rojo. RAM baja:
Playwright con `--workers=1` y un proyecto a la vez; unitarias de a un archivo. Sin tokens ni colores
nuevos (`tests/unit/theme/tema.test.ts` debe seguir verde). El panel se entrega por grupos: tras el
grupo 3 ya funciona con un hilo.

## 1. Base y línea de partida

- [ ] 1.1 Confirmar que `implementar-captura-voz-anamnesis` (PR #64) e `implementar-asr-real-captura-voz` (PR #66) están mergeadas o son la base de esta rama, y registrar capturas de las pantallas actuales (consulta, `/knowledge`, `/patients`) a 1440, 1280, 1024 y 375 px en claro y oscuro como línea de partida en `quickstart.md`. Verificación: capturas citadas y `git log` con las dos PR en la base.
- [ ] 1.2 En rojo los e2e de composición en `tests/e2e/web/accessibility.spec.ts` y uno nuevo `tests/e2e/web/panel-asistente.spec.ts`: tres zonas a 1440 px; riel y cajón a 1280 px; sin panel acoplado a 375 px; el contenido de la consulta sigue a una columna y el e2e «la consulta usa una sola columna» se mantiene verde. Verificación: los casos del panel fallan con el shell actual y el de una columna pasa.

## 2. Infraestructura del panel (D1 · D2 · D3 · D10)

- [ ] 2.1 En rojo `tests/unit/asistente/panel-store.test.ts` y luego `src/features/asistente/panel-store.ts` (`expanded`, `activeThread`, persistencia por dispositivo con almacenamiento inyectado, degradación a los valores por defecto si no se puede leer). Verificación: prueba verde, incluido el almacenamiento que lanza.
- [ ] 2.2 En rojo y luego el registro de hilos (`usePanelThreads` + slot): una pantalla declara hilos y desaparecen al desmontar; el hilo activo se conserva al navegar si sigue disponible y, si no, pasa a «Conocimiento». Verificación: `tests/unit/asistente/panel-threads.test.tsx`.
- [ ] 2.3 En rojo y luego `AssistantPanel` en `app-navigation.web.tsx` (acoplado ≥ 1440 px con su control colapsar/expandir con `aria-expanded`, riel de 56 px, cajón superpuesto de 1024 a 1439 px con `scrim`, Escape y foco devuelto) y orden del DOM barra lateral → contenido → panel con el atajo «Ir al asistente». Verificación: 1.2 verde y recorrido de teclado en `accessibility.spec.ts`.
- [ ] 2.4 `listColumns` de `ScreenList` mide el ancho del contenido y no el de la ventana. Verificación: `tests/unit/ui/screen-list.test.ts` (con panel acoplado a 1440 px y sin él) y capturas de `/patients` a 1280 y 1440 px.

## 3. Hilo de escucha (D4 · D9)

- [ ] 3.1 En rojo `tests/unit/voz/use-elapsed.test.ts` y luego `src/features/voz/use-elapsed.ts` (mm:ss desde que la captura pasa a `capturando`; se detiene y reinicia con el estado). Verificación: prueba verde con reloj inyectado.
- [ ] 3.2 En rojo y luego `ListenThread` y `ListenControls` (`src/components/voz/`): tramos cronológicos con hora y, debajo, sus borradores con fragmento, contradicciones y Confirmar / Corregir / Descartar; sin hablantes ni burbujas; conservan los `testID` actuales. Verificación: `tests/unit/voz/voz-ui.test.tsx` (borradores bajo su tramo, sin tramos, con contradicción).
- [ ] 3.3 Elevar `useListenMode` a `consultations/[id].tsx`, registrar el hilo «Escucha» solo con la consulta abierta y dejar de montar `ListenModeSection` en «1 Anamnesis». Verificación: `modo-escucha.spec.ts` y `modo-escucha-real.spec.ts` adaptados pasan (activar desde el panel).
- [ ] 3.4 En rojo el e2e «la escucha no desplaza el formulario» (posición y ancho de los campos de la sección 1 no cambian al activar la escucha y llegar tramos y borradores) y luego hacerlo pasar. Verificación: caso verde a 1440 px y a 1280 px (cajón).
- [ ] 3.5 En rojo y luego el aterrizaje del borrador confirmado: la entrada se trae a la vista con la marca «Nuevo» y el código «I», se anuncia en `consultation-status` y se quita en la siguiente acción; sin animación. Verificación: unitaria del estado de la marca y e2e «confirmar un borrador».
- [ ] 3.6 En rojo y luego el estado de escucha en el riel y la cinta: estado, tiempo, aviso «Grabando y conservando audio» y «Detener» con el panel colapsado; colapsar o cerrar no detiene la captura. Verificación: e2e con la escucha real (micrófono falso) y el panel colapsado.

## 4. Hilo de conocimiento (D5)

- [ ] 4.1 En rojo `tests/unit/conocimiento/conocimiento-thread.test.tsx` y luego extraer `ConocimientoThread` de `knowledge/index.tsx` (formulario, consulta, turnos y «ver respaldo») sin cambiar la conducta de `/knowledge`. Verificación: los e2e y unitarias de conocimiento existentes siguen verdes.
- [ ] 4.2 En rojo y luego registrar «Conocimiento» en el shell de toda pantalla protegida y fijar `setPatient` con el paciente de la consulta o la ficha (FR-026). Verificación: e2e «pregunta desde la consulta con contexto del paciente» (respuesta con citas y paciente de contexto declarado).

## 5. Hilo del asistente y contrato de propuestas (D6)

- [ ] 5.1 En rojo `tests/unit/asistente/agent-proposal.test.tsx` y luego `AgentProposal`: se pinta como sugerencia (`SuggestedBlock`) con origen y procedencia «Inferida»; sin Confirmar no hay escritura ni acción; Confirmar llama a `onConfirm` y la atribución es la del veterinario. Verificación: prueba verde, incluido «sin confirmar no escribe».
- [ ] 5.2 En rojo y luego `AgentThread` con los estados `idle | thinking | proposing | error` y la disponibilidad `useAgentAvailability()` (siempre `false`): muestra que no está disponible y no renderiza respuestas simuladas. Verificación: `tests/unit/asistente/agent-thread.test.tsx` (los cuatro estados con un agente falso solo en la prueba) y e2e (el hilo declara su no disponibilidad).

## 6. Dock y hoja en compacto (D7)

- [ ] 6.1 En rojo `tests/unit/ui/screen-dock.test.ts` y luego el prop `dock` de `Screen`: la cinta se pinta en el contenedor de `screen-action-bar` a cualquier ancho, sobre la barra de pestañas y dentro del área segura. Verificación: prueba verde y sin regresiones en las pantallas con `action`.
- [ ] 6.2 En rojo y luego `PanelDock`: hilo activo, estado y tiempo de escucha, aviso de grabación, «Detener» y contador de propuestas; controles ≥ 44×44 px; visible al desplazar y al escribir. Verificación: `voz-ui.test.tsx` y e2e a 375 px con la hoja cerrada.
- [ ] 6.3 En rojo y luego `PanelSheet`: hoja modal con foco atrapado, Escape y control visible, foco devuelto al dock, y la captura sigue al cerrarla. Verificación: e2e a 375 px (abrir, cerrar con Escape, foco devuelto, «Detener» sigue disponible) y axe sin violaciones.

## 7. Accesibilidad y verificación integrada

- [ ] 7.1 Extender `accessibility.spec.ts` (axe WCAG 2.2 AA, `chromium` y `chromium-dark`) al shell con el panel acoplado (1440), el riel y el cajón (1280), y el dock con la hoja abierta (375). Verificación: sin violaciones nuevas en claro y oscuro.
- [ ] 7.2 Verificación visual en bloque, una sola ronda: capturas a 1440, 1280, 1024 y 375 px en claro y oscuro de la consulta (inactiva, grabando, con borradores), `/knowledge` y `/patients`; corregir todo lo que muestre en un único lote y confirmar con una ronda más. Verificación: capturas en `quickstart.md` y revisión final de `impeccable`.
- [ ] 7.3 Compuertas: `bunx biome ci --error-on-warnings .`, `bun run typecheck`, `tests/unit/theme/tema.test.ts`, `SUPABASE_LIVE_TESTS=1 bun run test` (sola) y `openspec validate shell-asistente-tres-zonas --strict`. Verificación: salidas en `quickstart.md`.

## 8. Docs relacionados (al implementar, sin afirmar lo pendiente)

- [ ] 8.1 Actualizar el brief de superficie de `impeccable` (`.impeccable/surfaces/src-app-protected-patients-consultations-id-tsx.md`: shell de tres zonas, hilo en vez de margen, aterrizaje sin animación, dock en compacto) y, si existe tras esta revisión, crear el brief del shell. Verificación: el brief coherente con lo construido y con la spec.
- [ ] 8.2 `DESIGN.md`: documentar el panel, el riel, el dock y el hilo como composición (sin tokens nuevos) y la regla «la única animación de autor es la firma» se mantiene. Verificación: DESIGN.md describe lo construido y `tema.test.ts` verde.
- [ ] 8.3 `PRODUCT.md`: reflejar el panel de asistente en Product Purpose y Operating Context (conocimiento y escucha en el panel; agente planificado, no implementado). Verificación: texto que distingue lo implementado de lo pendiente.
- [ ] 8.4 `docs/brief-poc-cdss.md` §14 «Evolución esperada»: añadir la visión agéntica (el agente propone, el veterinario decide) como evolución, sin alterar el alcance del PoC (interacción con el asistente por texto, voz solo como captura). Verificación: el brief no contradice la spec 003 ni la 004 y no declara implementado el agente.
- [ ] 8.5 `quickstart.md` del cambio con evidencia y pendientes declarados (verificación nativa en iOS/Android sin hacer; orden del hilo; ancho del panel). Verificación: documento con capturas y resultados reales.

## Workflow follow-up

- Archivar `implementar-captura-voz-anamnesis`, luego `implementar-asr-real-captura-voz` y por último este cambio: añade los requisitos de shell, panel, hilos, dock y aterrizaje a `sistema-visual`.
- Cambio futuro aparte: **agente real** (LLM, herramientas, seguridad, revisión de HD1).
