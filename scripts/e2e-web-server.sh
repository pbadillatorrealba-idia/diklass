#!/bin/sh
# Servidor de los e2e web: exporta la app una vez (las EXPO_PUBLIC_* se hornean aquí) y la sirve
# estática. Sustituye a `expo start --web`; con E2E_DEV_SERVER=1 se vuelve a Metro.
set -e
if [ -n "$E2E_DEV_SERVER" ]; then
  exec bun run web -- --port "${1:-8083}"
fi
# 2 workers de Metro: pico de ~1,2 GB en vez de ~3 GB, a cambio de ~12 s más de export.
bunx expo export --platform web --output-dir dist-e2e --max-workers 2
exec bun scripts/serve-web.ts dist-e2e "${1:-8083}"
