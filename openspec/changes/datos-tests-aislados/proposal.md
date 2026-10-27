# Proposal

## Why

Los e2e incluyen nombres como «Luna Caso Sintético» y «Tutor de…», y las suites vivas dejan filas:
la CI reinicia la base entre integración y e2e para evitar contaminación. Se necesita reutilizar
los nombres y relaciones del dataset, aislar el backend de pruebas y limpiar lo creado incluso
cuando falla una prueba, conservando las restricciones de la aplicación.

## What Changes

- Usar plantillas del dataset de `dataset-clinico-trazable` en los helpers compartidos de
  integración/e2e; nombres visibles naturales y claves/UUID/RUT exclusivos por ejecución.
  Conservar fixtures deliberadamente inválidos, homónimos y casos límite de pruebas unitarias.
- Configuración de backend de pruebas explícita y sobrescribible, separada de `.env` de desarrollo;
  app exportada, helpers y limpieza deben apuntar al mismo destino antes de escribir.
- Instancia Supabase local desechable con identidad/puertos propios, iniciada solo cuando se use.
  Por la RAM disponible, no arrancarla en paralelo con el backend de desarrollo automáticamente.
- Creación con sesiones reales y limpieza privilegiada privada de tests, acotada a los IDs
  registrados por ejecución. No conceder DELETE a la app ni añadir un RPC público de limpieza.
- Teardown ante éxito/fallo, registro local de residuos si se interrumpe el proceso y rechazo de
  limpieza sobre desarrollo, demo o remoto. Una prueba que solicita backend no se omite en silencio.

## Capabilities

### New Capabilities

- `datos-tests-aislados`: destino de pruebas explícito, reutilización de plantillas y ciclo de vida
  de datos con limpieza verificable.

### Modified Capabilities

Ninguna publicada. Se mantienen RLS, atribución, inmutabilidad clínica y retención del producto;
la destrucción se limita a una instancia de pruebas desechable identificada expresamente.

## Impact

- `tests/integration/live-supabase.ts`, `tests/e2e/web/fixtures.ts`, `preparar-paciente.ts`,
  `caso-sintetico.ts`, sus consumidores y las suites que escriben directamente; soporte común de
  tests con plantillas y registro de recursos. Inventariar también storage, voz, chat y conocimiento.
- `playwright.config.ts`, `scripts/e2e-web-server.sh`, runner de tests, `package.json`, CI,
  `.env.example` y `SETUP.md`; nunca editar `.env` ni exponer secretos en `EXPO_PUBLIC_*`.
- Construcción: dataset aprobado e implementado, servicios y esquema actual de Supabase.
  Aceptación conjunta con integración/e2e: comprobar aislamiento, limpieza y que el demo permanece intacto.
- Sin nuevas dependencias ni cambios de permisos o migraciones del producto. Si la limpieza
  necesitara alterar contratos o migraciones, detenerse y presentar esa decisión al usuario.

Dependencia de contenido: [PR #81](https://github.com/pbadillatorrealba-idia/diklass/pull/81).
Esta segunda PR es planificación independiente; no supone que el dataset ya esté implementado.
