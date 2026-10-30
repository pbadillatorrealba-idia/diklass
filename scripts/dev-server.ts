export function findDevPort(): number {
  for (let port = 9701; port <= 9710; port++) {
    try {
      const listener = Bun.listen({ hostname: "::", port, socket: { data() {} } });
      listener.stop(true);
      return port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error("Todos los puertos de desarrollo 9701–9710 están ocupados.");
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  // Los e2e proporcionan su puerto explícito; el rango es el valor por defecto de desarrollo.
  if (!args.some((arg) => arg === "--port" || arg === "-p" || arg.startsWith("--port="))) {
    args.push("--port", String(findDevPort()));
  }
  const server = Bun.spawn(["bunx", "expo", "start", ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.kill(signal));
  }
  process.exit(await server.exited);
}
