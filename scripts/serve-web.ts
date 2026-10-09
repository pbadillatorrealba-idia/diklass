// Sirve el export estático de Expo (`dist-e2e`) para los e2e web: evita mantener Metro (cientos de
// MB y recompilación bajo demanda) vivo mientras corren los navegadores. Uso: bun scripts/serve-web.ts <dir> <puerto>
import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const [dir = "dist-e2e", port = "8083"] = process.argv.slice(2);

/** Rutas de Expo `output: "static"`: `/a/b` vive en `a/b.html` o en `a/b/index.html`. */
function resolverArchivo(pathname: string): string | null {
  const limpio = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidatos = [limpio, `${limpio}.html`, join(limpio, "index.html")];
  for (const candidato of candidatos) {
    const ruta = join(dir, candidato);
    if (existsSync(ruta) && statSync(ruta).isFile()) {
      return ruta;
    }
  }
  return null;
}

Bun.serve({
  hostname: "127.0.0.1",
  port: Number(port),
  fetch(request) {
    const archivo = resolverArchivo(new URL(request.url).pathname);
    if (archivo) {
      return new Response(Bun.file(archivo));
    }
    // Ruta dinámica (p. ej. /pacientes/[id]): la app resuelve la ruta en el cliente.
    const respaldo = ["+not-found.html", "index.html"].map((f) => join(dir, f)).find(existsSync);
    return respaldo
      ? new Response(Bun.file(respaldo), { headers: { "content-type": "text/html" } })
      : new Response("Not found", { status: 404 });
  },
});
