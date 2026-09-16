# AGENTS.md

Guía común para agentes (Claude, Codex, Oh My Pi u otros) que trabajan en este repositorio.
Este archivo está subordinado a `docs/constitution.md`, que prevalece ante cualquier conflicto.

## Antes de trabajar

1. Lee `docs/constitution.md` — autoridad normativa del proyecto.
2. Lee `docs/brief-poc-cdss.md` — documento canónico de producto.
3. Lee el cambio seleccionado bajo `openspec/changes/` (proposal, specs y, si existen, design y
   tasks) antes de tocar código o artefactos.

## openspec/changes/ frente a openspec/specs/

- `openspec/changes/`: propuestas activas. Cada cambio contiene su proposal, los deltas de
  especificación y, cuando correspondan, design y tasks. El contenido vive aquí hasta que se
  acepta y sincroniza.
- `openspec/specs/`: capacidades ya aceptadas y sincronizadas. Está vacío al inicio: ninguna
  capability está publicada todavía.

## Reglas

- Conserva los IDs globales de requisitos (FR-NNN), historias (US) y criterios (SC) en todo
  artefacto; no los renumeres ni reutilices IDs retirados.
- No interpretes las marcas de tareas, checklists ni estados documentales como aceptación
  demostrada.
- No archives un cambio antes de completar la verificación que exige la constitución; los
  checklists acreditan revisión documental, no implementación.
- Diferencia pendiente / implementado / aceptado en cada afirmación que escribas.

## Comandos

Usa los scripts ya definidos en `package.json` (Bun es el runtime y package manager):

```sh
bun run start              # Expo dev server
bun run web                # Expo web dev server
bun run typecheck          # tsc --noEmit
bun run lint               # biome check .
bun run format             # biome format --write .
bun run test               # bun test tests/unit tests/integration
bun run test:integration   # bun test tests/integration
bun run test:e2e:web       # Playwright
bun run test:e2e:native    # Maestro
bun run provision:veterinarians
```

No añadas scripts ni dependencias sin justificarlos conforme al Principio III de la constitución.

## Idioma

El contenido de los artefactos se escribe en español; los encabezados y las palabras clave
estructurales de OpenSpec (MUST, MUST NOT, Requirement, Scenario, GIVEN/WHEN/THEN) permanecen en
inglés.
