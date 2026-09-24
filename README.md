# diklass

Proof of Concept de un sistema de apoyo a la decisión clínica (CDSS) para etología veterinaria
canina. Es una aplicación Expo (Expo Router) con Supabase como backend: Postgres con RLS,
autenticación y Edge Functions en `supabase/functions/`.

El contexto de producto está en [docs/brief-poc-cdss.md](docs/brief-poc-cdss.md) y la autoridad
normativa, en [docs/constitution.md](docs/constitution.md).

## Requisitos previos

- [Bun](https://bun.sh) en la versión fijada en `.bun-version`.
- [Supabase CLI](https://supabase.com/docs/guides/local-development) y Docker, para el backend
  local.
- Opcional: navegadores de Playwright (`bunx playwright install`) para el e2e web y
  [Maestro](https://maestro.mobile.dev) para el e2e nativo.

## Quickstart

```bash
bun install --frozen-lockfile
cp .env.example .env
supabase start
supabase status -o env              # copia API_URL, ANON_KEY y SERVICE_ROLE_KEY en .env (ver SETUP.md)
bun run provision:veterinarians     # veterinarios sintéticos para entrar
bun run start                       # o: bun run web
```

Nunca commitees `.env` ni compartas sus valores. El detalle del entorno (variables, base de datos
local, tests y CI) está en [SETUP.md](SETUP.md).

## Documentación

- [SETUP.md](SETUP.md) — entorno de desarrollo completo.
- [AGENTS.md](AGENTS.md) — reglas de trabajo con agentes y comandos del proyecto.
- [`openspec/changes/`](openspec/changes/) — cambios activos (propuestas, specs, design y tasks).
