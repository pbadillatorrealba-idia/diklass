# Tasks

## 1. Base
- [ ] 1.1 Prueba de humo: LangGraph.js + ChatOpenAI + instrumentación OpenInference en Edge Function (Deno), con streaming SSE y trace visible en Phoenix.
- [ ] 1.2 Phoenix autoalojado en `docker-compose` de desarrollo y variables de entorno.
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
- [ ] 2.7 Memoria de la consulta (tabla con RLS + reinyección).

## 3. Voz
- [x] 3.1 TTS: Edge Function `speak` (OpenAI, misma cuota y consentimiento que la transcripción) y `speaker.ts` en el cliente. Sin respaldo `expo-speech` (pospuesto). NO verificado en dispositivo: el audio va como data URL y iOS puede no reproducirlo (alternativa: archivo en caché).
- [ ] 3.2 Manos libres (escucha continua) y barge-in por voz: hoy la respuesta se locuta si la pregunta fue por voz y se corta al grabar, enviar o «Detener». La escucha continua con detección de voz queda pendiente.
- [ ] 3.3 Vocabulario veterinario en ASR y glosario del agente.
- [ ] 3.4 Resumen del día por voz (opt-in).

## 4. Adjuntos
- [ ] 4.1 Bucket privado con RLS, subida y entrada multimodal.
- [ ] 4.2 Lectura mostrada como texto revisable antes de usarse.

## 5. Calidad y seguridad
- [ ] 5.1 «¿Por qué?»: herramientas, fuentes y `trace_id` en el mensaje.
- [ ] 5.2 Anti prompt-injection: delimitación de datos recuperados y tests con documentos hostiles.
- [ ] 5.3 Dataset de evaluación en Phoenix con casos anotados y experimento base.
- [ ] 5.4 Presupuesto de latencia voz a voz < 2 s al primer audio.
- [ ] 5.6 Cuota por usuario del agente en la base (patrón `consume_assistant_audio_quota`).
- [ ] 5.7 Declarar el proveedor de modelo y minimizar datos enviados (Principio V) antes de usar datos reales.
- [ ] 5.5 Aislamiento entre clínicas en cada herramienta.

## Diferido
Límites de coste, modo degradado sin LLM, redacción de PII en trazas, sugerencias durante el dictado.
