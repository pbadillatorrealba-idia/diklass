# Tasks

## 1. Base
- [ ] 1.1 Prueba de humo: LangGraph.js + ChatOpenAI en Edge Function (Deno) con streaming SSE.
- [ ] 1.2 Puerto `ChatModel` (OpenAI/Claude/Gemini por env) con test de contrato.
- [ ] 1.3 `Responder` del agente en `src/features/asistente/responders.ts`.

## 2. Herramientas (pruebas primero)
- [ ] 2.1 Lectura: pacientes/fichas, agenda, consulta.
- [ ] 2.2 Conocimiento con citas (reutiliza `conocimiento`).
- [ ] 2.3 Asistencia proactiva (006) y tratamiento/farmacología (007).
- [ ] 2.4 Escritura como `propuesta` + tarjeta de confirmación + deshacer.
- [ ] 2.5 `navegar(ruta)` con lista blanca.

## 3. Voz
- [ ] 3.1 Puerto `Speaker` (proveedor + expo-speech de respaldo).
- [ ] 3.2 Manos libres y barge-in sobre `turn-gate`.

## 4. Calidad
- [ ] 4.1 Trazas con RLS y redacción de PII.
- [ ] 4.2 Evaluación con casos anotados; presupuesto de latencia < 2 s.
- [ ] 4.3 Límites de coste y modo degradado.
- [ ] 4.4 Pruebas de prompt injection y de aislamiento entre clínicas.

## 5. Funcionalidades faltantes
- [ ] 5.1 Memoria de consulta, 5.2 pacientes por nombre, 5.3 nota SOAP, 5.4 seguimientos.
