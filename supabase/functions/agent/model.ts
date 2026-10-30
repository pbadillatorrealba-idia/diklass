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
      return new (await import("@langchain/openai")).ChatOpenAI({ model, useResponsesApi: true });
    case "anthropic":
      return new (await import("@langchain/anthropic")).ChatAnthropic({ model });
    case "google-genai":
    case "google":
      return new (await import("@langchain/google-genai")).ChatGoogleGenerativeAI({ model });
    default:
      throw new Error(`Proveedor de modelo no soportado: ${provider}`);
  }
}
