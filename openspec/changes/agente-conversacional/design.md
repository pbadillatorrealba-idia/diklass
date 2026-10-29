# Design

## Decisiones

- **Runtime**: Edge Function `agent` con LangGraph.js (ReAct con herramientas). Claves en el servidor; el
  cliente llama con su JWT, así que RLS limita cada herramienta a la clínica del usuario.
- **Modelo**: puerto `ChatModel` → `ChatOpenAI` (por defecto), `ChatAnthropic`, `ChatGoogleGenerativeAI`;
  se elige por variable de entorno. Mismo conjunto de herramientas con cualquiera.
- **Escrituras**: las herramientas de escritura no escriben; devuelven una `propuesta` (parte de mensaje ya
  prevista). La UI la confirma y llama al servicio existente (misma validación que la UI manual).
- **Navegación**: herramienta `navegar(ruta)` que emite un evento de UI; el cliente valida contra rutas
  conocidas.
- **Voz**: reutiliza el ASR real; TTS tras puerto `Speaker` (proveedor del LLM por defecto, expo-speech de
  respaldo). Barge-in: voz del usuario corta el audio y cancela el turno (`turn-gate`).
- **Streaming**: SSE desde la función; el chat pinta tokens y estados de herramienta.

## Funcionalidades del primer corte

1. **Pacientes por nombre**: herramienta `buscar_paciente(texto)`; con más de un resultado el agente pregunta
   (hablado y con botones). El elegido pasa a ser el paciente de contexto.
2. **Nota SOAP y resumen**: herramienta que lee la anamnesis y devuelve un borrador como propuesta editable.
3. **Seguimientos y recordatorios**: propuestas de agenda al cerrar la consulta; se crean solo al confirmar.
4. **Memoria de la consulta**: resumen corto por consulta, persistido y reinyectado en cada turno.
5. **Deshacer**: cada propuesta aplicada guarda su inversa; «Deshacer» la ejecuta (misma validación).
6. **«¿Por qué?»**: cada respuesta lleva herramientas usadas y fuentes citadas, visibles a demanda.
7. **Anti prompt-injection**: el texto recuperado va delimitado como dato; las herramientas de escritura no
   se pueden activar desde contenido recuperado, solo desde mensajes del usuario; tests con documentos hostiles.
8. **Resumen del día**: al abrir la app (opt-in) el agente lee por voz agenda y pendientes.
9. **Adjuntos**: fotos y PDF a bucket privado (RLS) y entrada multimodal; la lectura se muestra como texto
   revisable antes de usarse en el registro.
10. **Vocabulario veterinario**: lista de términos (etología, fármacos) como prompt del ASR y glosario del agente.

## Observabilidad (Arize Phoenix)

- `@arizeai/openinference-instrumentation-langchain` + exportador OTLP a Phoenix autoalojado (Docker).
- Un trace por turno: herramientas, latencia, tokens, errores. El `trace_id` viaja en el mensaje para el «¿por qué?».
- Evaluación: casos de `tests/fixtures/asistencia/casos-anotados.json` y nuevos como dataset de Phoenix;
  experimentos al cambiar modelo o prompt.
- Riesgo: las trazas contienen datos clínicos y RUT. Se mantiene Phoenix en red privada y se deja diferida la
  redacción de PII; revisar antes de usar datos reales.

## Riesgos

- LangChain en Deno: validar compatibilidad antes de comprometerse (tarea 1.1); plan B, bucle de
  herramientas propio con el SDK del proveedor.
- OpenInference para LangChain JS en Deno: validar en 1.1 junto con LangGraph.
- Latencia voz a voz: presupuesto objetivo < 2 s al primer audio; medir en 4.x.
