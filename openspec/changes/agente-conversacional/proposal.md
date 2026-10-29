# Proposal

## Why

El chat del asistente (`chat-del-asistente`) ya responde consultas básicas y la base de conocimiento, y
dejó el puerto `Responder` y la «propuesta del agente» como parte de mensaje. Falta el agente real: que el
veterinario maneje toda la app hablando, sin dejar de decidir él.

## What Changes

- **Agente LangChain (LangGraph.js)** como nueva implementación de `Responder`, en una Edge Function de
  Supabase que usa el JWT del usuario (RLS intacto). Modelo detrás de un puerto: OpenAI por defecto,
  Claude y Gemini por configuración.
- **Herramientas** (lectura directa, escritura solo como propuesta): pacientes y fichas, consulta y
  anamnesis, base de conocimiento con citas, asistencia clínica proactiva (006), apoyo a tratamiento y
  farmacología (007), agenda y navegación de la app.
- **Confirmación obligatoria**: toda escritura clínica llega como tarjeta de propuesta (qué, a quién,
  diff) y solo se aplica al aceptarla. Sin decisión clínica definitiva automática; dosis solo como
  información a validar.
- **Voz a voz**: ASR existente → agente → TTS por puerto, con interrupción (barge-in) y manos libres.
- **Primer corte de features** (elegidas): pacientes por nombre con desambiguación, nota SOAP y resumen,
  seguimientos y recordatorios propuestos, memoria de la consulta, deshacer propuestas, «¿por qué?»,
  defensa anti prompt-injection, resumen del día por voz, adjuntar fotos/exámenes (multimodal) y
  vocabulario veterinario en ASR y agente.
- **Observabilidad con Arize Phoenix**: trazas OpenTelemetry/OpenInference de cada turno y evaluación con
  casos anotados (datasets y experimentos de Phoenix).
- **Integración de ramas**: 006 y 007 mergeadas en esta rama; `mejoras-ui-ux` ya incluida.
- **Fuera de este cambio** (diferido): límites de coste, modo degradado sin LLM, redacción de PII en trazas, sugerencias durante el dictado; varias conversaciones, agente autónomo sin confirmación, multi-clínica.

## Capabilities

### New Capabilities
- `agente-conversacional`: agente que opera la app por voz y texto con propuestas confirmables.

### Modified Capabilities
- `asistente-conversacional`: el `Responder` pasa a poder ser el agente.

## Impact

Nueva Edge Function `agent`, dependencias `@langchain/*` (Deno), puerto TTS, tabla de trazas del agente
con RLS. Depende de `chat-del-asistente`, `captura-voz-anamnesis`, `asistencia-clinica-proactiva`,
`apoyo-tratamiento-farmacologia`, `base-conocimiento-trazable`.
