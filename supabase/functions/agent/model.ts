/**
 * Modelo por `proveedor:modelo`. Se instancia aquí y no con el string de `createAgent`: bajo Deno,
 * `langchain` importa el proveedor por su cuenta y no ve el mapa de imports de la función (falla con
 * «Cannot read properties of undefined»). Importar desde aquí sí lo resuelve.
 */
export async function makeModel(spec: string) {
  const i = spec.indexOf(":");
  const provider = i < 0 ? "openai" : spec.slice(0, i);
  const model = i < 0 ? spec : spec.slice(i + 1);
  switch (provider) {
    case "openai":
      // Responses API: los modelos con razonamiento (gpt-6-luna) rechazan herramientas en Chat Completions.
      // `store: false`: esa API conserva por defecto lo enviado en OpenAI; son datos clínicos (Principio V).
      return new (await import("@langchain/openai")).ChatOpenAI({
        model,
        useResponsesApi: true,
        modelKwargs: { store: false },
        // Coste acotado: por defecto reintenta 6 veces dentro de la ventana de 55 s y no limita la salida.
        // shortcut: 8192 tokens de salida por paso (incluye el razonamiento), subir si trunca respuestas.
        maxRetries: 1,
        maxTokens: 8192,
      });
    case "anthropic":
      return new (await import("@langchain/anthropic")).ChatAnthropic({ model });
    case "google-genai":
    case "google":
      return new (await import("@langchain/google-genai")).ChatGoogleGenerativeAI({ model });
    default:
      throw new Error(`Proveedor de modelo no soportado: ${provider}`);
  }
}
