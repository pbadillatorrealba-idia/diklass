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

## Funcionalidades faltantes propuestas

1. Memoria de la consulta en curso (resumen corto persistente por consulta).
2. Resolver pacientes por nombre/tutor con desambiguación hablada («¿Bruma de Pérez o de Soto?»).
3. Borrador de nota SOAP y resumen de consulta a partir de la anamnesis dictada.
4. Seguimientos y recordatorios propuestos desde la consulta (agenda).
5. Deshacer: cada propuesta aplicada se puede revertir.
6. Transparencia: «¿por qué?» muestra herramientas usadas y fuentes citadas.
7. Trazas del agente (tabla con RLS) y conjunto de evaluación con casos anotados.
8. Límites: coste por usuario/día, tiempo máximo por turno, modo degradado sin LLM
   (`consultas-basicas`).
9. Salvaguardas: prompt injection en documentos recuperados, redacción de RUT/PII en trazas, bloqueo de
   dosis sin cita.

## Riesgos

- LangChain en Deno: validar compatibilidad antes de comprometerse (tarea 1.1); plan B, bucle de
  herramientas propio con el SDK del proveedor.
- Latencia voz a voz: presupuesto objetivo < 2 s al primer audio; medir en 4.x.
