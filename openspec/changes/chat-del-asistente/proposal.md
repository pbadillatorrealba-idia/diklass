# Proposal

## Why

El hilo «Asistente» que dejó `shell-asistente-tres-zonas` es un formulario de una pregunta con sus
respuestas apiladas: no se siente como el chat al que el veterinario está acostumbrado, no recuerda
nada al cerrar sesión, no acepta voz y obliga a elegir un paciente a mano. Será además la base del
agente futuro, así que conviene construirlo ahora como un chat de verdad (mensajes, composer, lista
anclada, partes de mensaje, estados) y no como un parche más.

## What Changes

- **Chat con mensajes**: lista cronológica (lo más nuevo abajo, anclada al final, «Ir al final»), mensajes
  de usuario y de asistente con partes (texto en markdown, respuesta de conocimiento con citas, audio,
  propuesta del agente), estados (enviando, pensando, listo, error con «Reintentar») y acciones por mensaje
  (copiar, reintentar, eliminar audio). Mensajes inmutables una vez enviados. Sin burbujas: bloques
  `rounded-sm`, según DESIGN.md.
- **Composer** multilínea (Enter envía, Shift+Enter salto de línea), «Detener» mientras responde, foco que
  vuelve al campo.
- **Conversación continua y persistida** por veterinario (tabla propia con RLS): últimos 50 mensajes,
  «Cargar anteriores» y «Borrar conversación». `knowledge_queries` (FR-020) permanece como auditoría.
- **Audio**: grabar (tocar), revisar y enviar desde el composer; mínimo 1 s, máximo 2 min; bloqueado
  mientras la escucha de consulta usa el micrófono. El audio se conserva 90 días en un bucket privado y la
  transcripción queda como texto del mensaje; el veterinario puede eliminar el audio antes. Transcribe una
  **Edge Function nueva** que no exige sesión de escucha.
- **Conocimiento se funde en el chat**: desaparece la pestaña «Conocimiento» y `/knowledge` pasa a mostrar
  el mismo chat. Lo que no es consulta básica se pregunta a la base de conocimiento.
- **Paciente de contexto automático**: la app lo inyecta al abrir la ficha o una consulta y lo limpia al
  salir; se muestra como etiqueta de solo lectura («Contexto: Bruma»). Se elimina el selector de pacientes
  del chat y de `/knowledge`. Cada mensaje guarda el paciente con el que se respondió.
- **Markdown completo y seguro** (con la librería `marked` y un renderizador propio sobre los tokens del
  sistema): sin HTML ni imágenes; enlaces solo `http(s)` y rutas internas.
- **No leído**: marca en el riel y en el dock cuando llega una respuesta con el panel cerrado.
- **El panel del Inicio** sigue ofreciendo solo el chat; «Escucha» se mantiene como hilo propio de la consulta.
- **Fuera de este cambio**: el agente real (LLM, herramientas, HD1), editar o regenerar mensajes, menciones
  de pacientes por nombre y varias conversaciones.

## Capabilities

### New Capabilities

- `asistente-conversacional`: el chat del asistente (mensajes, composer, persistencia privada, audio,
  contexto de paciente automático, markdown seguro, avisos de no leído).

### Modified Capabilities

- `base-conocimiento-trazable`: FR-026 — el paciente de contexto lo fija la navegación y no un selector.

Los requisitos de `shell-asistente-tres-zonas` que este cambio reemplaza («Conocimiento en el panel» y
«Hilo del asistente con consultas básicas», y «Conocimiento» en «Hilos contextuales del panel») se
movieron fuera de esa spec: viven aquí. La rama de la PR #70 sigue construyendo la pestaña
«Conocimiento» y el asistente básico, de modo que #70 debe mergearse junto con este cambio o justo antes.

## Impact

- **Base**: apilado sobre la PR #70 (`feat/shell-asistente-tres-zonas`); su PR base es esa rama hasta que se
  mergee.
- **Datos**: migración nueva (`assistant_messages`, bucket `assistant-audio`, RLS, vencimiento a 90 días) y
  Edge Function `transcribe-chat-audio`; `database.types.ts` se regenera con `db:types`.
- **Código**: `src/components/asistente/*` (chat), `src/features/asistente/*` (modelo, almacén, puerto,
  respondedores, contexto), `src/features/voz/*` (reutiliza `WindowRecorder`), `knowledge/index.tsx` y
  `ConocimientoThread` (se retiran sus selectores), pantallas de ficha y consulta (contexto).
- **Dependencias**: `marked` (sin dependencias propias).
- **Docs**: DESIGN.md (mensajes, composer, audio), PRODUCT.md, brief de superficie, quickstart.
- **No verificable aquí**: nativo (iOS/Android). La verificación es del veterinario/desarrollador en su
  teléfono con la lista de `quickstart.md`; sin su confirmación se declara pendiente.
