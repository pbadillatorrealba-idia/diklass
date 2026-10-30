# Tasks

## 1. Base
Modelo por defecto: `openai:gpt-6-luna` (vía Responses API: con razonamiento no admite herramientas en Chat Completions). `gpt-6.1-luna` no estaba disponible.

- [~] 1.1 (verificado bajo Deno 2.9 incl. trazas en Phoenix: un solo trace por turno con `deno run`/`deno check`: el agente corre con `fakeModel` y los tres proveedores llegan a su API con clave falsa; llamada real con `openai:gpt-6-luna` y herramienta OK bajo Deno 2.9; falta streaming SSE y la traza en Phoenix) Prueba de humo: LangGraph.js + ChatOpenAI + instrumentación OpenInference en Edge Function (Deno), con streaming SSE y trace visible en Phoenix.
- [x] 1.2 Phoenix autoalojado: `docker-compose.phoenix.yml` y variables en `supabase/functions/.env.example`.
- [ ] 1.3 Puerto `ChatModel` (OpenAI/Claude/Gemini por env) con test de contrato.
- [x] 1.4 `Responder` del agente en `src/features/asistente/responders.ts`.

## 2. Herramientas (pruebas primero)
- [ ] 2.1 Lectura (hecho: `buscar_paciente`, `consulta_abierta`; falta fichas y agenda): `buscar_paciente` con desambiguación, fichas, agenda, consulta.
- [ ] 2.2 Conocimiento con citas (`conocimiento`).
- [ ] 2.3 Asistencia proactiva (006) y tratamiento/farmacología (007).
- [x] 2.4 Escritura como `propuesta` + tarjeta de confirmación (antecedente de anamnesis, procedencia «inferida»).
- [ ] 2.4b Deshacer: pospuesto; el registro clínico es auditado y la anamnesis no admite correctivo (migración 009 solo exenta la epicrisis). Requiere diseño propio.
- [x] 2.5 `navegar(ruta)` con lista blanca.
- [ ] 2.6 Nota SOAP/resumen y seguimientos/recordatorios como propuestas.
- [x] 2.7 Memoria de la consulta: registro clínico auditado `consultation_summary` (migración 025, historial de solo agregar), tools `resumen_de_consulta` y `proponer_resumen` con confirmación. Verificado con pgTap y integración viva.

## 3. Voz
- [x] 3.1 TTS: Edge Function `speak` (OpenAI, misma cuota y consentimiento que la transcripción) y `speaker.ts` en el cliente. Sin respaldo `expo-speech` (pospuesto). NO verificado en dispositivo: el audio va como data URL y iOS puede no reproducirlo (alternativa: archivo en caché).
- [ ] 3.2 Manos libres (escucha continua) y barge-in por voz: hoy la respuesta se locuta si la pregunta fue por voz y se corta al grabar, enviar o «Detener». La escucha continua con detección de voz queda pendiente.
- [x] 3.3 Vocabulario veterinario: `prompt` del ASR y glosario en el prompt del agente (lista fija; sin evaluación de WER).
- [~] 3.4 Resumen del día: tool `consultas_de_hoy` (la agenda aún no tiene fuente, FR-094). Falta el disparo opt-in al abrir la app.

## 4. Adjuntos
- [ ] 4.1 Bucket privado con RLS, subida y entrada multimodal.
- [ ] 4.2 Lectura mostrada como texto revisable antes de usarse.

## 5. Calidad y seguridad
- [ ] 5.1 «¿Por qué?»: herramientas, fuentes y `trace_id` en el mensaje.
- [ ] 5.2 Anti prompt-injection: delimitación de datos recuperados y tests con documentos hostiles.
- [~] 5.3 Casos anotados (`tests/fixtures/agente/casos.json`) y marcador (`agent/eval.ts`, `scripts/eval-agente.ts`) probados con `fakeModel` y corridos con `openai:gpt-6-luna` real (9/9 OK, 2026-10-30). Falta subirlos como dataset/experimento de Phoenix.
- [ ] 5.4 Presupuesto de latencia voz a voz < 2 s al primer audio.
- [ ] 5.6 Cuota por usuario del agente en la base (patrón `consume_assistant_audio_quota`).
- [ ] 5.7 Declarar el proveedor de modelo y minimizar datos enviados (Principio V) antes de usar datos reales.
- [x] 5.5 Aislamiento entre clínicas en cada herramienta: `makeDb` (`agent/db.ts`) usa el cliente del solicitante; `tests/integration/agente/aislamiento-clinicas.test.ts` prueba en vivo con dos clínicas (control + otra clínica). Corrige además que «hoy» devolvía las 50 consultas más antiguas y no las más recientes.

## Diferido
Límites de coste, modo degradado sin LLM, redacción de PII en trazas, sugerencias durante el dictado.
