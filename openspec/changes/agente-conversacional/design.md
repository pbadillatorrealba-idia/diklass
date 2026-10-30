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
4. **Memoria de la consulta**: resumen corto por consulta como registro clínico auditado `consultation_summary` (migración 025): historial de solo agregar (trigger lo hace inmutable), procedencia «inferida», alta sin acción enumerada (la autoría es la de la fila), consulta validada en la misma clínica. El agente lo lee con `resumen_de_consulta` (envuelto en `<datos>`) y propone uno nuevo con `proponer_resumen`; nada se guarda sin confirmación.
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

## Proveedor del modelo y datos enviados (Principio V · tarea 5.7)

- **Proveedor:** OpenAI, por defecto `gpt-6-luna` (`AGENT_MODEL=proveedor:modelo`; también Anthropic y Google
  detrás del mismo puerto). Las claves viven solo en los secretos de la función.
- **Retención:** la Responses API conserva por defecto lo enviado; el agente fija `store: false`
  (`model.ts`, con test). Falta confirmar con el proveedor el contrato de tratamiento de datos (retención de
  abuso, ZDR): es una decisión de la clínica, no del código.
- **Sale hacia el proveedor** (por turno): lo que el veterinario escribe o dicta; los últimos 10 turnos de la
  conversación; y lo que devuelven las herramientas que el modelo decide llamar: nombre, especie, raza, edad,
  peso, sexo, estado reproductivo y antecedentes del paciente, **nombre** del tutor, ids de consulta, texto del
  resumen de la consulta, pacientes de las consultas de hoy y fragmentos de la base de conocimiento.
- **No sale:** RUT, teléfono ni correo del tutor (la ficha del agente los omite y un test vivo lo asevera), ni
  el audio (la transcripción es otro flujo, con su propio aviso de primer uso).
- **Acotado por usuario:** 30 turnos cada 10 minutos (`consume_agent_quota`, 027).
- **Pendiente antes de datos reales:** contrato con el proveedor y aviso de primer uso del agente (el de voz
  cubre solo el audio). Mientras tanto, solo datos sintéticos.

## Riesgos

- LangChain en Deno: validar compatibilidad antes de comprometerse (tarea 1.1); plan B, bucle de
  herramientas propio con el SDK del proveedor.
- OpenInference para LangChain JS en Deno: validar en 1.1 junto con LangGraph.
- Latencia voz a voz: presupuesto objetivo < 2 s al primer audio; medir en 4.x.
