#!/bin/sh
# Servidor de los e2e web: exporta la app una vez (las EXPO_PUBLIC_* se hornean aquí) y la sirve
# estática. Sustituye a `expo start --web`; con E2E_DEV_SERVER=1 se vuelve a Metro.
set -e
# El argumento tiene prioridad sobre E2E_WEB_PORT (por defecto 8083).
port="${1:-${E2E_WEB_PORT:-8083}}"
if [ -n "$E2E_DEV_SERVER" ]; then
  exec bun run web -- --port "$port"
fi
# 2 workers de Metro: pico de ~1,2 GB en vez de ~3 GB, a cambio de ~12 s más de export.
# Las EXPO_PUBLIC_* se hornean en la caché de Metro: al cambiar EXPO_PUBLIC_VOZ_MODO (real <-> simulado)
# hay que limpiarla con E2E_CLEAR_CACHE=1 o el export reutiliza el valor anterior.
bunx expo export --platform web --output-dir dist-e2e --max-workers 2 ${E2E_CLEAR_CACHE:+--clear}
exec bun scripts/serve-web.ts dist-e2e "$port"
