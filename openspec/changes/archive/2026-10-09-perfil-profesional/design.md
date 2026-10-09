## Context

`public.veterinarians` (migración 001) guarda `display_name` y revoca `insert/update/delete` a
`authenticated`. La atribución clínica muestra el nombre con `useVeterinarianDisplayName(actorId)`,
una lectura en vivo por id. `clinical_audit_events` ya registra acciones con `actor_id`,
`entity_type`, `entity_id` y `metadata`. Las escrituras clínicas exigen una sesión de acceso activa
(migración 006).

## Goals / Non-Goals

**Goals**

- Que el profesional corrija su nombre visible con auditoría completa.
- No abrir ningún `update` directo.
- Reflejar el cambio al momento en la interfaz.

**Non-Goals**

- Cambiar el correo o identificador, la contraseña o la foto.
- Nombres por registro (instantánea histórica).
- Que un administrador edite perfiles ajenos.

## Decisions

### D1 — Función `security definer` en vez de política `update`

- `update_own_profile(p_display_name text) returns public.veterinarians`, con
  `set search_path = ''`.
- Comprueba la sesión con `public.is_active_access()` (migración 006), el mismo predicado de las
  escrituras clínicas, y normaliza con `regexp_replace(btrim(...), '\s+', ' ', 'g')`.
- Valida la longitud (2–80) y, si el valor no cambia, devuelve la fila sin evento.
- Actualiza y registra el evento en la misma transacción.
- `grant execute ... to authenticated` y `revoke all ... from anon`.

Alternativa descartada: una política RLS `update` con `check (id = auth.uid())`. No garantiza el
evento de auditoría, que dependería del cliente, ni restringe las columnas que se pueden tocar.

### D2 — Evento de auditoría

- `entity_type = 'veterinarian'`, `entity_id = auth.uid()` y
  `action = 'veterinarian_profile_updated'`.
- `metadata = jsonb_build_object('previous', old, 'current', new)`.
- La lectura del historial va por la política de lectura de eventos ya existente, filtrada por
  `entity_type`/`entity_id`.

### D3 — Cliente

- `src/features/perfil/profile-service.ts` (`updateOwnProfile`, `listProfileChanges`) y un esquema
  zod con las mismas reglas que el servidor (validación temprana; el servidor sigue mandando).
- Formulario con `@tanstack/react-form`, como `login-form`.
- Si se guarda:
  - se invalidan `["veterinarian-display-name", id]` y el historial;
  - se actualiza `session-store.displayName`;
  - se muestra un `Callout tone="success"`.
- Si la sesión expira, se usa el mismo manejo que las escrituras clínicas: el diálogo, con el
  borrador conservado.
- La pantalla usa `Screen title="Datos personales" back={{ href: "/settings", label:
  "Configuración" }}`.

## Risks / Trade-offs

- **Nombre actual en registros antiguos:** puede sorprender a quien lea un registro antiguo. Se
  mitiga con el historial auditado; el `actor_id` no cambia.
- **Una función más con `security definer`:** se revisa con pgTap y con `search_path` vacío.

## Complexity Tracking

| Elemento | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Función `update_own_profile` | Auditoría obligatoria y columnas acotadas (FR-095) | Política `update` directa: sin auditoría garantizada |

## Migration Plan

1. `014_perfil_profesional.sql`, `supabase test db` y `bun run db:types`.
2. Servicio y esquema, con integración viva.
3. Vista y e2e.

Sin datos que migrar. Para revertir: `drop function`; los eventos quedan como historial.

## Open Questions

- Ninguna bloqueante. Ampliar los datos personales (teléfono, colegiatura) queda para una decisión
  de producto posterior.
