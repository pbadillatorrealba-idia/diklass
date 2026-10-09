#!/bin/sh
# Gate previo al push, en secuencia (nunca en paralelo) y con tope de memoria si hay systemd:
# un test descontrolado muere en su cgroup en vez de reiniciar el equipo. Mismos pasos que CI.
set -e
if command -v systemd-run >/dev/null 2>&1; then
  run() { systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 "$@"; }
else
  run() { "$@"; }
fi
run bunx biome ci --error-on-warnings .
run bunx tsc --noEmit
run bun test tests/unit tests/integration
