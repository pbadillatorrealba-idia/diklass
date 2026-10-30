# Quickstart y evidencia: shell-asistente-tres-zonas

Rama `feat/shell-asistente-tres-zonas`, creada desde `origin/main` (f9f92ab).

## Base (tarea 1.1, parte verificable)

`git log` de la base incluye las dos PR previas: #64 `implementar-captura-voz-anamnesis`
(merge 8b7b506) y #66 `implementar-asr-real-captura-voz` (merge a95a4d8).

## Cómo probarlo

```sh
bun run provision:veterinarians          # local
sh scratchpad/e2e.sh playwright --project=chromium tests/e2e/web/panel-asistente.spec.ts
```

A mano, con sesión `vet.ana@example.test`: abrir una consulta, activar «Modo de escucha» desde el hilo
«Escucha», confirmar un borrador y ver «Nuevo» + «I» en su campo; achicar la ventana a 1280 y 375 px.

## Compuertas (tarea 7.3)

| Compuerta | Resultado |
|---|---|
| `bunx biome ci --error-on-warnings .` | limpio (383 archivos) |
| `bun run typecheck` | limpio |
| `tests/unit/theme/tema.test.ts` | 343 pass |
| `bun test tests/unit` | 1178 pass |
| `SUPABASE_LIVE_TESTS=1 bun run test` | 1259 pass, 4 skip, 0 fail |
| `openspec validate shell-asistente-tres-zonas --strict` | válido |
| e2e completo, `--project=chromium` | 95 pass, 4 skip (los de voz real, que se omiten en modo simulado) |
| e2e en modo real (`EXPO_PUBLIC_VOZ_MODO=real`) | `modo-escucha-real`: 4 pass |
| e2e `chromium-dark` | `accessibility.spec.ts` pass (axe a 1440/1280/375 y recorrido de teclado) |

Los 4 skip de la suite viva están condicionados por entorno (p. ej. ASR con clave real), no por este cambio.

## Capturas (tarea 7.2)

Todas en `capturas/`.

| Pantalla | Ancho | Tema | Archivo |
|---|---|---|---|
| Consulta con borradores | 1440 | claro | `light-1440-consulta-borradores.png` |
| Consulta con borradores | 1440 | oscuro | `dark-1440-consulta-borradores.png` |
| Consulta con borradores | 1280 | claro | `light-1280-consulta-borradores.png` |
| Consulta con borradores | 375 | claro | `light-375-consulta-borradores.png` |
| Grabando, panel cerrado (riel) | 1280 | claro / oscuro | `light-1280-…`, `dark-1280-consulta-grabando-panel-cerrado.png` |
| Grabando (dock) | 375 | claro | `light-375-consulta-grabando-panel-cerrado.png` |
| Aterrizaje: «Nuevo» + «I» | 1440 | claro | `light-1440-consulta-aterrizaje-nuevo.png` |
| Hoja con foco | 375 | claro | `light-375-consulta-hoja-foco.png` |
| `/patients` | 1440 · 1024 | claro | `light-1440-patients.png`, `light-1024-patients.png` |
| `/knowledge` | 1440 | claro | `light-1440-knowledge.png` |

Rondas: la ronda 1 encontró 5 fallos (columna «Tutor» partida letra a letra, contador de pendientes
bajo el icono equivocado, reloj del riel en 00:00 al montar, «Detener» recortado en el dock, pestañas
de la hoja apretadas); se corrigieron en un lote y la ronda 2 los confirmó.

Revisión final de `impeccable` (agente independiente, solo capturas): disposición «fix» con cuatro
puntos. Resueltos: placeholders recortados (ahora «Nombre», «Raza», «Escribe tu pregunta»; filtros
con ajuste de línea), cabeceras de las tablas de pacientes y tutores desalineadas con sus celdas
(relleno horizontal del botón de orden a 0), y tres capturas que faltaban (aterrizaje, «Asistente»,
hoja con foco). El tiempo del riel es variante `nav`, dentro de la excepción de 12 px: sin cambio.

## Pendientes y desviaciones declaradas

- **1.1, línea de partida**: no se tomaron capturas de la UI anterior; solo se verificó la base con `git log`. Por eso 1.1 queda sin marcar.
- **1.2, rojo primero**: el e2e del panel se escribió después del shell; no se observó en rojo. Los casos de composición están en `panel-asistente.spec.ts` y los de accesibilidad en `accessibility.spec.ts`. Queda sin marcar.
- **Nativo (iOS/Android)**: sin verificar, no hay dispositivo. El dock usa el mismo contexto que en web.
- **Orden del hilo**: más antiguo arriba y sin desplazamiento automático; decidir con voz real y consultas largas.
- **Ancho del panel (360 px)**: suficiente para las tablas; el hilo «Conocimiento» es alto porque lista todas las fichas.
- **«Conocimiento» duplicado en `/knowledge`**: el panel y la pantalla muestran dos campos de pregunta sobre la misma conversación (la spec lo pide literal).
- **Extensiones a la spec**: `resolveActiveThread` cae al primer hilo disponible si «Conocimiento» tampoco está; `PanelThread` ganó `status` y `pending`; el dock viaja por un contexto (`DockProvider`).
- **Eliminados**: `transcript-review.tsx` y `draft-facts-panel.tsx`, reemplazados por el hilo.
- **Archivo de test**: `tests/unit/ui/screen-dock.test.tsx` (no `.ts`, necesita JSX).
- **DESIGN.md**: se corrigió que la consulta pasa a dos columnas desde `lg`; siempre es una.

## Mejoras del asistente (grupo 9)

- **Desviación de la spec «Hilo del asistente reservado»**: el hilo «Asistente» ya no declara que no está disponible; responde consultas básicas (reglas por palabras, sin LLM) y consulta conocimiento. No escribe ni propone: solo `AgentProposal` queda como contrato del agente futuro; `AgentThread`, `AgentThreadView` y `useAgentAvailability` se retiraron por no tener consumidores. El delta está en `specs/sistema-visual/spec.md` («Hilo del asistente con consultas básicas», «Ancho del panel elegible» y los ajustes a «Panel de asistente colapsable» e «Hilos contextuales»).
- **«Pacientes de hoy»** = pacientes con una consulta creada hoy (hora local); no hay agenda de citas. **Eventos**: siempre vacío hasta que exista una fuente (`useAgendaEvents`).
- **Ancho del panel**: ya no es fijo en 360 px (el e2e y las capturas anteriores lo asumen por defecto).
- **Sin verificar**: arrastre en táctil (solo mouse y teclado); el e2e completo no se reejecutó tras este grupo (corrieron `panel-asistente`, `accessibility`, `navegacion`, `conocimiento` y `panel-conocimiento`, en claro y oscuro donde aplica).

## Revisión del agente (ronda 1)

Corregido: regex de intenciones con límite de palabra (`consultas-basicas`), aviso de grabación en la cabecera del panel con otro hilo activo (`PanelBody`), parada de la captura al desmontar la consulta (`useListenMode`), contexto de paciente que se suelta al salir de la pantalla (`usePatientContext`), docs reconciliados con el grupo 9 y retiro de `AgentThread`, `AgentThreadView` y `useAgentAvailability`.

Verificado: `biome ci`, `typecheck` y `bun test tests/unit` en local, con pruebas en rojo primero para las regex, `PanelBody` y el contexto de paciente. **Sin ejecutar**: e2e (ni el de la escucha con otro hilo abierto ni el de navegar durante la captura, que faltan escribir) y la suite viva. Menores del reporte sin atender: separador táctil y de un solo puntero, persistencia del ancho por `pointermove`, `aria-controls` del riel, orden de pestañas, e2e «pacientes de hoy» débil y las capturas versionadas.
