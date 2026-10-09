#!/bin/sh
# Gate previo al push, en secuencia (nunca en paralelo) y con tope de memoria si hay systemd:
# un test descontrolado muere en su cgroup en vez de reiniciar el equipo. Mismos pasos que CI.
# `bun run gate --changed` limita Biome a los archivos que difieren de origin/main.
set -e
if command -v systemd-run >/dev/null 2>&1; then
  run() { systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 "$@"; }
else
  run() { "$@"; }
fi
if [ "$1" = "--changed" ]; then
  run bunx biome ci --error-on-warnings --changed --since=origin/main
else
  run bunx biome ci --error-on-warnings .
fi
run bunx tsc --noEmit
# Un proceso por directorio: el pico de memoria queda acotado al directorio más pesado y un
# directorio con fuga no arrastra a los demás.
for dir in tests/unit/*/ tests/integration; do
  case "$dir" in tests/unit/setup/) continue ;; esac # preload compartido, sin pruebas
  run bun test "$dir"
done
