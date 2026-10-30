# Design

## Context

La navegación global vive en `AppNavigation` (`app-navigation.web.tsx`: barra lateral `w-sidebar` de
240 px desde `lg`, barra superior más barra inferior de pestañas bajo `lg`, `TabSlot` como contenido
`role="main"`; `app-navigation.tsx`: `NativeTabs`, que es la barra de pestañas del sistema). La
consulta (`consultations/[id].tsx`) monta `ListenModeSection` dentro de «1 Anamnesis», y esa sección
llama a `useListenMode`. La conversación de conocimiento es la pantalla `/knowledge` (191 líneas, con
el formulario, la consulta y el «ver respaldo» dentro de la propia pantalla) y comparte
`useConversationStore` (Zustand, paciente de contexto y turnos). `Screen` ya tiene una barra fija al
pie (`screen-action-bar`) con área segura. El sistema visual (DESIGN.md) y `tema.test.ts` quedan
fijos. Ver `proposal.md` para el porqué y el brief de superficie en
`.impeccable/surfaces/src-app-protected-patients-consultations-id-tsx.md` para la dirección elegida.

## Goals / Non-Goals

**Goals:**
- Un panel de asistente en el shell de toda la app, colapsable y contextual, que aloje los hilos
  «Escucha», «Conocimiento» y «Asistente» con una sola infraestructura.
- La escucha no mueve el formulario y su aviso de grabación nunca queda oculto.
- Dejar el lugar, los estados y las reglas de agencia listos para un agente futuro, sin construirlo.
- Sin tokens, colores ni tipografías nuevos; WCAG 2.2 AA en claro y oscuro.

**Non-Goals:**
- El agente real: proveedor de LLM, herramientas, seguridad y revisión de la decisión HD1
  (conocimiento extractivo). Es un cambio futuro aparte.
- Cambiar el sistema visual, el flujo de firma, los textos clínicos o la lógica de captura.
- Separar hablantes o presentar el hilo de escucha como conversación con el sistema.
- Rediseñar el contenido de las pantallas (ficha, listas, consulta): conservan su composición.
- Verificación nativa en dispositivo (declarada pendiente).

## Decisions

### D1. El panel es del shell, no de la pantalla

El panel se monta en `AppNavigation`, como hermano de `TabSlot`, y no dentro de ninguna pantalla. Así
el contenido conserva su composición (la consulta sigue a una columna, FR-079) y el panel sobrevive
al cambio de pantalla. *Alternativa rechazada*: una columna dentro de la consulta («hoja partida»):
no sirve al resto de la app y obligaba a modificar FR-079.

### D2. Presentación por ancho

| Ancho | Presentación | Contenido |
|---|---|---|
| web ≥ 1440 px | acoplado, expandido (360 px por defecto; 280–560 px), colapsable a riel de 56 px | ≥ 840 px con panel expandido |
| web 1024–1439 px | riel visible; el panel se abre como cajón superpuesto | sin reflujo |
| web < 1024 px y nativo | dock (cinta) + hoja modal | una columna, el dock sobre las pestañas |

A 1440 px el contenido queda en ~840 px con la barra lateral y el panel (> 720 px de lectura); a
1280 px un panel acoplado dejaría ~680 px, por eso ahí es riel. Los umbrales viven en una constante
(`PANEL_DOCKED_FROM = 1440`, `PANEL_RAIL_FROM = 1024`). `listColumns` de `ScreenList` hoy usa 1280 px
de ventana para dos columnas: pasa a medirse sobre el **ancho del contenido** para que el panel
acoplado no la rompa.

### D3. Estado del panel y registro de hilos

- `usePanelStore` (Zustand, patrón de `createThemeStore`: almacenamiento inyectado, lectura que
  degrada al valor por defecto): `expanded`, `activeThread`, persistidos por dispositivo (web:
  `localStorage`; nativo no aplica salvo el hilo activo, en memoria).
- Registro de hilos con un contexto y un *slot*: cada pantalla declara los hilos que ofrece con
  `usePanelThreads([{ id, label, element }])` y el shell los pinta; al desmontar la pantalla su hilo
  desaparece. «Conocimiento» y «Asistente» los registra el propio shell (toda pantalla protegida);
  «Escucha» la consulta abierta. El hilo activo se conserva al navegar si sigue disponible, y si no
  pasa a «Conocimiento» (spec «Hilos contextuales»).
- `useListenMode` se **eleva** a la pantalla de consulta y su objeto `modo` baja al hilo, al riel y a
  la cinta: todos comparten una sola sesión de captura. *Alternativa rechazada*: una instancia por
  presentación (dos sesiones de escucha posibles).

### D4. Hilo de escucha

`ListenThread` reemplaza al par `TranscriptReview` + `DraftFactsPanel`: columna cronológica; cada
tramo con su hora y, debajo, sus borradores (pliego canario, fragmento de origen, Confirmar /
Corregir / Descartar) y los avisos de contradicción. Conserva los `testID` actuales
(`transcript-segment`, `draft-fact-card`, `draft-fact-confirm`…). `ListenControls` agrupa el botón, el
indicador de estado y `RecordingNotice`. `ListenModeSection` deja de montarse en «1 Anamnesis».

### D5. Hilo de conocimiento

Se extrae de `/knowledge` un `ConocimientoThread` (formulario, consulta, turnos y «ver respaldo»)
que reutiliza `RespuestaConocimiento` y `useConversationStore`; la pantalla `/knowledge` pasa a
renderizarlo en su contenido (misma ruta, misma conducta) y el panel lo reutiliza. En una consulta o
una ficha, el panel fija `setPatient` con el paciente de la pantalla (FR-026); fuera de ellas el
selector de paciente sigue disponible. La respuesta sigue siendo extractiva (HD1).

### D6. Hilo del asistente y contrato de propuestas

El hilo «Asistente» responde consultas básicas y consulta conocimiento (grupo 9); no es un agente y no
propone. El contenedor `AgentThread` que reservaba los estados sin agente se retiró por no tener
consumidores: el agente futuro trae el suyo. El contrato de propuestas (`AgentProposal`) se
construye ya, con su prueba, porque es una regla de seguridad y no una función: una propuesta es una
sugerencia (`SuggestedBlock`, pliego canario), lleva su origen y procedencia «Inferida», y un
`onConfirm` es la única vía a una escritura, atribuida al veterinario (reutiliza la atribución de
`src/lib/attribution`). Sin Confirmar no hay escritura ni acción. *Alternativa rechazada*: dejarlo para
el cambio del agente — ahí el riesgo es que la regla se escriba después del primer uso.

### D7. Dock y hoja en compacto

`Screen` recibe un prop `dock` que reutiliza el contenedor de `screen-action-bar` (área segura, borde,
fondo `card`) a cualquier ancho; en iOS/Android queda sobre `NativeTabs` y en web sobre la barra
inferior, sin solaparlas. `PanelDock` muestra el hilo activo, el estado de escucha (punto con texto,
tiempo con `useElapsed`, «Grabando y conservando audio» si la captura es real), «Detener» y el número
de propuestas por confirmar; controles ≥ 44×44 px. `PanelSheet` es una hoja modal (RN `Modal`; en web
`role="dialog"` con `aria-modal`, foco atrapado, Escape y control visible, y foco de vuelta al dock) que
aloja el hilo activo. Cerrar la hoja no detiene la captura.

### D8. Riel y cajón

El riel (56 px) muestra un icono por hilo, el indicador de escucha activa (punto con texto corto y
tiempo; «Detener» accesible), el contador de borradores por confirmar y el control de expandir. El
cajón (1024–1439 px) es el mismo panel superpuesto con capa `scrim`, Escape y foco devuelto al riel.
En el riel el aviso de grabación es texto visible, nunca solo color.

### D9. Aterrizaje del borrador confirmado, sin animación nueva

DESIGN.md fija que la única animación de autor es la firma. Al confirmar, `confirmarHecho` invalida
`['registro']`; la consulta recuerda el id de la entrada confirmada, la trae a la vista con
desplazamiento instantáneo, la marca con el rótulo «Nuevo» (rubric, tinta `primary`, forma propia)
junto al código «I» y la anuncia en `consultation-status` («Antecedente incorporado a la
anamnesis»); la marca se quita en la siguiente acción. *Alternativa rechazada*: animar un traslado del
borrador al campo — segunda animación de autor y frágil entre presentaciones.

### D10. Orden del DOM y foco

Web ≥ 1024 px: barra lateral, contenido (`role="main"`), panel (`aside` «Asistente») en ese orden. El
panel es alcanzable por teclado después del contenido, con un atajo de salto («Ir al asistente») junto
al existente de «Saltar al contenido». Bajo 1024 px el dock va al final del DOM.

## Complejidad nueva (Principio III)

| Elemento | Requisito que lo exige | Se elimina cuando |
|---|---|---|
| `usePanelStore` y registro de hilos | Panel colapsable y hilos contextuales (spec «Panel colapsable», «Hilos contextuales») | Nunca mientras exista el panel |
| `ListenThread` y `ListenControls` | Hilo de escucha y escucha siempre visible | — |
| `ConocimientoThread` extraído de `/knowledge` | Conocimiento en el panel sin duplicar la pantalla | — |
| `AgentProposal` (contrato) | Regla «el agente solo propone» (spec «Propuestas exigen confirmación») | Si se descarta la visión agéntica |
| `Screen` `dock`, `PanelDock`, `PanelSheet` | Dock y hoja en compacto | Nunca mientras exista el panel en móvil |
| `useElapsed` | Tiempo transcurrido en el riel y el dock | — |

Dependencias nuevas: **ninguna**. Capas arquitectónicas nuevas: ninguna (`features/asistente` y
`components/asistente` sobre los patrones de `features/conocimiento` y `components/conocimiento`).

## Risks / Trade-offs

- **Alcance grande**: toca el shell de toda la app → se entrega por grupos con pruebas, y el panel
  funciona con un solo hilo desde el primer grupo; si un grupo se retrasa, los otros no dependen.
- **Foco atrapado en la hoja (web)**: RN `Modal` no siempre lo garantiza → se implementa
  explícitamente y se prueba con teclado y axe; si no alcanza, `<dialog>` propio en web.
- **Dock y teclado en móvil**: puede quedar bajo el teclado donde el viewport no se redimensiona → se
  verifica a 375 px con el teclado; en nativo es un riesgo declarado hasta probar en dispositivo.
- **Aviso de grabación oculto**: no se tolera → vive en el riel y en la cinta, no solo en el hilo, y una
  prueba falla si no es visible con el panel colapsado.
- **Una «presencia agéntica» que simule capacidad**: el hilo «Asistente» sin agente mostraría una
  promesa falsa → declara su no disponibilidad y una prueba exige que no haya respuestas simuladas.
- **`listColumns` sobre el ancho del contenido** puede cambiar listas existentes → se cubre con su prueba
  actual y capturas a 1280 y 1440 px.
- **Verificación nativa**: no es posible en esta máquina → se verifica en web a 1440, 1280, 1024 y 375 px.

## Migration Plan

Sin migraciones de datos. Cambia la composición del shell. Reversión: quitar el panel de
`AppNavigation` y volver a montar `ListenModeSection` en «1 Anamnesis»; `/knowledge` conserva su
conducta durante todo el cambio. El estado persistido del panel (`localStorage`) es una clave
nueva e inocua.

## Open Questions

- Orden del hilo de escucha (más nuevo arriba o abajo) y desplazamiento automático al último tramo: no
  cambia specs ni tareas; se decide al probarlo con voz real.
- Ancho del panel expandido (360 px por defecto) frente al contenido de las pantallas más densas (listas, tablas): se
  valida con capturas en la verificación visual y puede ajustarse sin cambiar la spec.
