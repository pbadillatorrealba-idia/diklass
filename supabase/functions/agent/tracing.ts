import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { context, SpanStatusCode } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  type ReadableSpan,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

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

/** Tope al envío final: un Phoenix caído o lento no retrasa la respuesta al usuario. */
const FLUSH_MAX_MS = 1500;

/**
 * Los errores de proveedor traen mensajes que pueden arrastrar la credencial («Incorrect API key
 * provided: sk-…»). Antes de exportar, cada span conserva solo el nombre de la excepción.
 */
export class RedactErrors implements SpanProcessor {
  onStart() {}
  onEnd(span: ReadableSpan) {
    const mutable = span as unknown as {
      events: { name: string; attributes?: Record<string, unknown> }[];
      status: { code: number; message?: string };
    };
    for (const e of mutable.events) {
      if (e.name === "exception" && e.attributes) {
        e.attributes = { "exception.type": e.attributes["exception.type"] };
      }
    }
    if (mutable.status.message) mutable.status = { code: mutable.status.code };
  }
  forceFlush() {
    return Promise.resolve();
  }
  shutdown() {
    return Promise.resolve();
  }
}

// Una sola instalación por proceso: instrumentar dos veces duplicaría los callbacks de LangChain.
let installed: Tracing | null = null;

export function setupTracing(env: { endpoint?: string; apiKey?: string }): Tracing | null {
  if (!env.endpoint) return null;
  if (installed) return installed;
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      "service.name": "diklass-agent",
      "openinference.project.name": "diklass-agent",
    }),
    // `RedactErrors` va antes: `onEnd` corre en orden y el exportador ya recibe el span limpio.
    spanProcessors: [
      new RedactErrors(),
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
  installed = {
    turn: (fn) =>
      tracer.startActiveSpan("agent_turn", async (span) => {
        try {
          const result = await fn();
          return { result, traceId: span.spanContext().traceId };
        } catch (error) {
          // Solo el nombre de la clase: el mensaje del proveedor podría arrastrar la credencial.
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.name : "Error",
          });
          throw error;
        } finally {
          span.end();
        }
      }),
    flush: () =>
      Promise.race([
        provider.forceFlush(),
        new Promise<void>((resolve) => setTimeout(resolve, FLUSH_MAX_MS)),
      ]),
  };
  return installed;
}
