## Why

La sección Configuración de `sistema-visual` (FR-093) necesita que el profesional pueda corregir
su propio nombre visible. Hoy nadie puede: `public.veterinarians` revoca `update` a
`authenticated` (migración 001) y el nombre solo se fija al provisionar la cuenta. Como la
atribución clínica resuelve el nombre por el id del autor (`useVeterinarianDisplayName`), un cambio
de nombre afecta a cómo se leen los registros ya firmados. Por eso el cambio tiene que ser
controlado y auditado, no un `update` directo.

## What Changes

- Función `public.update_own_profile(p_display_name text)` (`security definer`):
  - solo actúa sobre el propio registro, y exige una sesión de acceso activa (mismo contrato que
    las escrituras clínicas);
  - valida y normaliza el nombre (espacios, longitud 2–80);
  - registra un evento `veterinarian_profile_updated` en `clinical_audit_events` con el nombre
    anterior y el nuevo.
  - Ningún `update` directo se habilita.
- Vista `/settings/profile` («Editar datos personales»):
  - nombre visible editable;
  - identificador de acceso de solo lectura;
  - guardado con estados de envío, error y éxito, sin perder lo escrito si falla.
- Historial «Cambios de nombre» en la misma vista, con fecha y valores anterior y nuevo.
- Tras guardar, la sesión y la atribución muestran el nombre nuevo sin recargar (se invalidan las
  consultas de nombre).
- La atribución no cambia de dueño: sigue ligada al `actor_id`. El nombre visible es el actual
  (decisión del usuario, 2026-09-25).

Fuera de alcance: cambiar el correo o identificador de acceso, cambiar la contraseña, subir la foto
de perfil (el avatar con iniciales está en `sistema-visual`, FR-092) y los datos de colegiatura.

## Capabilities

### New Capabilities

- `perfil-profesional`: edición controlada y auditada de los datos personales del propio
  profesional, y su historial.

### Modified Capabilities

Ninguna publicada en `openspec/specs/`. Se apoya en la atribución de `identidad-y-acceso`
(FR-063) sin cambiarla: la identidad atribuida sigue siendo el `actor_id`.

## Impact

- Base de datos: la migración nueva `014_perfil_profesional.sql` (función, `grant execute` a
  `authenticated`) con sus pruebas pgTap; `database.types.ts` se regenera.
- Código:
  - `src/features/perfil/` (servicio y esquema zod);
  - `src/app/(protected)/(settings)/settings/profile.tsx`;
  - la invalidación de `useVeterinarianDisplayName` y de `session-store.displayName`.
- Pruebas: pgTap (propio registro, sesión activa, validación, evento de auditoría, sin `update`
  directo), integración viva y e2e web.
- Dependencias de construcción: `identidad-y-acceso` (sesiones, auditoría) y `sistema-visual`
  (sección Configuración, `Screen`, primitivas).
- Aceptación conjunta: la lectura del nombre actual en la atribución de 002–005 se acepta junto con
  esas features.
