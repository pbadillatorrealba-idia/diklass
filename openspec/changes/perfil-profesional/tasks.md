## 1. Base de datos (D1–D2 · FR-095)

- [ ] 1.1 Escribir en rojo `supabase/tests/perfil_profesional.test.sql` (pgTap):
  - el propio nombre cambia y deja 1 evento con `previous`/`current`;
  - el mismo valor no deja evento;
  - rechaza «A», más de 80 caracteres y solo espacios;
  - rechaza una sesión revocada;
  - `update` directo rechazado para cualquier fila;
  - sin `execute` para `anon`.
  Verificación: `supabase test db` en rojo.
- [ ] 1.2 Implementar `supabase/migrations/014_perfil_profesional.sql` y regenerar
  `database.types.ts`. Verificación: pgTap verde y `db:types` sin diff.

## 2. Cliente (D3 · FR-095 · FR-096)

- [ ] 2.1 Escribir en rojo las pruebas unitarias del esquema zod (normalización y límites) y la
  integración viva (`SUPABASE_LIVE_TESTS=1`):
  - ANA cambia su nombre y ve el evento;
  - BRUNO no puede cambiar el de ANA.
  Después, implementar `profile-service.ts`. Verificación: rojo→verde.
- [ ] 2.2 Implementar `/settings/profile`:
  - formulario, `Callout` de éxito o error, historial «Cambios de nombre»;
  - invalidación de `useVeterinarianDisplayName` y `session-store`;
  - manejo de la sesión expirada.
  Verificación: e2e web `perfil.spec.ts` (cambio visible en la barra lateral y en la atribución sin
  recargar; validación; historial) y axe verde en claro y en oscuro.
- [ ] 2.3 Restaurar el nombre sintético al terminar cada e2e (con otra llamada auditada), para no
  romper otras suites que buscan «Dra. Ana Torres». Verificación: `auth.spec.ts` y
  `attribution.spec.ts` en verde tras `perfil.spec.ts`.

## 3. Cierre

- [ ] 3.1 Registrar la evidencia en `quickstart.md` y dejar CI en verde. Verificación: URLs de CI.
