# Tasks

Estado inicial: todas las tareas están pendientes. Crear y publicar este plan no acredita su
implementación ni la aceptación de las funcionalidades afectadas. Las referencias D1–D5
corresponden a `design.md`; no son nuevos IDs de requisitos.

## 1. Confirmar la base y conservar la trazabilidad

- [ ] 1.1 Revisar y aprobar propuesta y diseño antes de aplicar; contrastar los nueve candidatos con la base de integración y localizar los cambios de identidad, sistema visual y ficha canina aunque hayan sido archivados. Verificación: registrar revisión, commit base y diferencias relevantes en `design.md` (Principios I y II; D1, D4).
- [ ] 1.2 Registrar en `implementar-identidad-y-acceso/tasks.md` la deuda del flujo nativo real de dos cuentas para US12 y su criterio de evidencia en dispositivo, conforme a D2. Verificación: tarea pendiente explícita y referencias a T036/T045/T063 coherentes, sin declarar aceptación nativa ni cambiar requisitos (FR-063; US12; D2).

## 2. Retirar contratos antiguos y duplicados unitarios

- [ ] 2.1 Eliminar las dos aserciones sobre `signUp` del hallazgo 2 y renombrar el contrato de `loginSchema` según lo que realmente comprueba. Verificación: pasan `bun test tests/unit/auth/login-screen.test.ts tests/integration/auth/auth-contract.test.ts`; permanecen el E2E sin registro visible y la integración de cuentas autorregistradas (FR-062; US11; D1).
- [ ] 2.2 Eliminar `tests/unit/clinical/draft-preserver.test.ts`, conservando los casos de almacenamiento, claves, ciclo de vida y recuperación E2E identificados en D1. Verificación: pasa `bun test tests/unit/storage` y el diff no altera el flujo web de expiración y recuperación (FR-061; SC-047; US11-AC5).
- [ ] 2.3 Eliminar solo el bloque unitario inicial y su import de `tests/integration/attribution/shared-clinic.test.ts`. Verificación: pasa `bun test tests/unit/clinical/attribution-guards.test.ts` y `SUPABASE_LIVE_TESTS=1 bun --env-file=.env run test:integration` con Supabase local configurado según SETUP.md; la suite viva se ejecuta sin omisiones (FR-063; SC-041, SC-042, SC-044; D1).
- [ ] 2.4 Reducir los cálculos repetidos de distancias de color conservando igualdades, pares AA y umbrales; integrar las restricciones de `label` en su caso existente. Verificación: pasa `bun test tests/unit/theme/tema.test.ts tests/unit/ui/typography.test.tsx`; comprobar temporalmente, y después revertir, una divergencia de bloque forzado y una variante `label` incorrecta para confirmar que siguen fallando (FR-074, FR-104; D1, D5).
- [ ] 2.5 Ejecutar Biome únicamente sobre los archivos de código modificados en este grupo. Verificación: `bunx biome check --write <rutas-tocadas>` termina sin errores y el diff conserva las garantías enumeradas en D1.

## 3. Depurar recorridos web y el placeholder nativo

- [ ] 3.1 Eliminar el recorrido general duplicado de `navegacion.spec.ts` y su import exclusivo, manteniendo las pruebas de activación de enlaces. Verificación: comparar rutas y condiciones de disponibilidad con `accessibility.spec.ts` y ejecutar `bun --env-file=.env run test:e2e:smoke -- --workers=1` con backend; documentar que el recorrido general permanece en la suite completa, no en smoke (FR-079; D1, D5).
- [ ] 3.2 Antes de fusionar los casos de envío vacío de `auth.spec.ts`, añadir al recorrido por teclado la observación de ausencia de petición de credenciales y comprobar que detecta un envío incorrecto; después retirar el duplicado. Verificación: conservar orden de foco, envío por Intro, mensaje y `role="alert"`; su ejecución web se acredita en 5.1, sin presentarla como verificada por smoke; mantener intacto el caso de contraseña incorrecta e identificador desconocido que cubre US11-AC2/AC3 (constitución, Restricciones de Aplicación Web: teclado y anuncio de errores; FR-060, SC-046; D1, D5).
- [ ] 3.3 Tras 1.2, retirar `tests/e2e/native/attribution.yaml` y actualizar `tests/e2e/native/README.md` y referencias operativas. Verificación: cada paso retirado permanece en `auth.yaml`, los comandos siguen apuntando al directorio correcto y ninguna referencia operativa exige un archivo inexistente; mantener el historial documental y la deuda US12 pendientes (FR-063; US12; D2).
- [ ] 3.4 Ejecutar Biome sobre los archivos TypeScript modificados en este grupo y revisar README y referencias nativas. Verificación: comprobación focalizada sin errores y documentación que distingue inspección de YAML de ejecución real en dispositivo (D2, D5).

## 4. Eliminar código sin consumidores

- [ ] 4.1 Revalidar los seis símbolos de D3 en los cinco archivos enumerados, incluyendo referencias por string, namespace, reexports, scripts, tests, configuración y OpenSpec; retirar solo los confirmados sin uso y sus imports exclusivos. Verificación: registrar por símbolo la evidencia de ausencia o el consumidor que obliga a conservarlo; no retirar utilidades de tests/scripts ni compatibilidad histórica (Principio III; FR-024; D3, D4).
- [ ] 4.2 Ejecutar Biome sobre los archivos tocados, `bun run typecheck` y `bun test tests/unit/auth tests/unit/registro tests/unit/voz tests/unit/storage tests/integration/auth/auth-contract.test.ts`. Verificación: comandos sin errores tras retirar exports, sin cambios en contratos ni supresión de validaciones (Principios II, III y V; D3, D5).

## 5. Verificación conjunta y revisión

- [ ] 5.1 Tras la autorización de cierre de PR, ejecutar una vez `bun run gate`, la integración viva si no existe evidencia vigente tras el último cambio de autenticación/atribución, y `bun --env-file=.env run test:e2e:web -- --project=chromium --workers=1`. Verificación: registrar comandos, entorno y resultados, incluidas omisiones; la suite web debe ejecutar los casos de `auth.spec.ts` y la compuerta que conserva el recorrido de rutas (US11, US12; FR-079; D5).
- [ ] 5.2 Revisar el diff contra la matriz y registrar en `design.md` qué candidatos se aplicaron o descartaron, cuántos casos/líneas se retiraron y qué quedó sin ejecutar. Verificación: cada eliminación tiene garantía conservada o ausencia demostrada de consumidores; ninguna estimación de tiempo se presenta como medida (D1–D5).
- [ ] 5.3 Completar `requesting-code-review` y `receiving-code-review` conforme a AGENTS.md, con informe en español y revisión por alguien distinto del autor antes de integrar. Verificación: resultados y decisiones documentados, hallazgos correctos resueltos y comprobados, sin aceptación basada únicamente en las casillas (Principios I–V; D5).

## Workflow follow-up

- Archivar este cambio solo después de la implementación, verificación y revisión exigidas.
- Mantener la deuda nativa de US12 en identidad y acceso hasta obtener su evidencia real; archivar esta limpieza no satisface esa deuda.
