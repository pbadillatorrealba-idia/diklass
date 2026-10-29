import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

/**
 * Trazas del agente en Arize Phoenix (agente-conversacional · observabilidad): un trace por turno con
 * sus llamadas al modelo y a las herramientas (OpenInference sobre los callbacks de LangChain). Opt-in:
 * sin `PHOENIX_COLLECTOR_ENDPOINT` no se instrumenta nada. Las trazas llevan datos clínicos (entradas y
 * salidas): Phoenix debe estar en una red privada (design.md, riesgos).
 */
export type Tracing = {
  /** Corre `fn` dentro de un span raíz y devuelve su resultado junto con el `trace_id`. */
  turn: <T>(fn: () => Promise<T>) => Promise<{ result: T; traceId: string }>;
  /** Envía lo pendiente antes de que la función termine. */
  flush: () => Promise<void>;
};

export function setupTracing(env: { endpoint?: string; apiKey?: string }): Tracing | null {
  if (!env.endpoint) return null;
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      "service.name": "diklass-agent",
      "openinference.project.name": "diklass-agent",
    }),
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: `${env.endpoint.replace(/\/$/, "")}/v1/traces`,
          headers: env.apiKey ? { Authorization: `Bearer ${env.apiKey}` } : {},
        }),
      ),
    ],
  });
  // Sin gestor de contexto asíncrono los spans hijos de LangChain no cuelgan del turno.
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  new LangChainInstrumentation({ tracerProvider: provider }).manuallyInstrument(
    CallbackManagerModule as never,
  );
  const tracer = provider.getTracer("diklass-agent");
  return {
    turn: (fn) =>
      tracer.startActiveSpan("agent_turn", async (span) => {
        try {
          const result = await fn();
          return { result, traceId: span.spanContext().traceId };
        } catch (error) {
          // Solo el nombre de la clase: el mensaje del proveedor podría arrastrar la credencial.
          span.setStatus({ code: 2, message: error instanceof Error ? error.name : "Error" });
          throw error;
        } finally {
          span.end();
        }
      }),
    flush: () => provider.forceFlush(),
  };
}

export { trace };
