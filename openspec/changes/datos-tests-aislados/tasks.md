# Tasks

Implementación autorizada por el usuario el 2026-10-28. Dataset de #81 implementado y
verificado localmente; esta rama depende de aquella. Marcas no equivalen a aceptación clínica.

## 1. Configuración y destino

- [x] 1.1 Registrar aprobación de spec/diseño e inventariar todos los escritores de integración/e2e web,
  dependencias SQL y storage, recursos compartidos y baseline por suite (FR-133–FR-136).
  Verificación: tabla de escritores/recursos revisada; ninguna suite queda fuera por no usar helpers.
  Incluir auditoría, Auth/access_sessions, fragmentos, cuotas y RPC de borrado por autor; para
  cada mutación definir identidad reservable o criterio exacto de recuperación antes de enviarla.
- [x] 1.2 Escribir pruebas de configuración incompleta, URL remota, destino de desarrollo, claves
  incoherentes, puerto web y backend exportado distinto; observar rojo antes de implementar
  (FR-134; US21-AC2). Verificación: fallan por el contrato nuevo y ninguna hace escrituras.
- [x] 1.3 Implementar resolución de `TEST_*`, puerto e inyección coherente en helpers y export;
  exigir error al solicitar backend sin configuración (FR-134). Verificación: 1.2 en verde,
  export dirigida a testing y ninguna clave privada en su bundle; documentar `.env.example` y `SETUP.md`.
- [x] 1.4 Escribir primero tests de rechazo de identidad no verificable y lock ocupado, después
  implementar configuración local temporal derivada, comprobación de proyecto/marca y reserva
  en DB (FR-134/FR-136). Verificación: rojo/verde, destino `diklass` rechazado y segundo runner
  bloqueado; confirmar compatibilidad del CLI fijado, sin detener el backend del usuario.

## 2. Plantillas y ciclo de recursos

- [x] 2.1 Escribir y observar fallar tests de nombres naturales, vínculos por clave, UUID/RUT
  distintos por intento y homónimos; adaptar plantillas compartidas en soporte de tests
  (FR-133; US21-AC1). Verificación: verde con ambos intentos preservando contenido editorial y
  documentación de las excepciones para fixtures deliberadamente inválidos.
- [x] 2.2 Escribir y observar fallar tests de intención durable previa, confirmación con respuesta
  perdida, interrupción antes de registrar el ID devuelto, recuperación exacta, setup parcial, error
  original más error de limpieza, centinelas y referencias correctivas (FR-135; US21-AC3/AC4).
  Implementar intención/reconciliación y teardown acotado sin cambios de permisos. Verificación: verde y ausencia
  comprobada de IDs propios, preservando los ajenos y el rechazo de DELETE a authenticated.
- [x] 2.3 Adaptar primero `preparar-paciente.ts`, `caso-sintetico.ts`, fixtures Playwright y soporte
  vivo de Bun; después sus consumidores y escritores directos, incluidos voz/chat/conocimiento
  (FR-133/FR-135). Verificación: tests focalizados de cada familia pasan, sin «Caso Sintético» ni
  «Tutor de…» en nombres ordinarios; mantener casos negativos y límites que necesiten otros valores.
  Para chat, usar cuentas exclusivas del caso/intento, baseline vacío y centinelas de otro autor;
  no vaciar cuentas compartidas mediante RPC ni cambiar el contrato de borrado del producto.
- [x] 2.4 Escribir primero prueba de fallo de storage y recuperación de residuos, implementar su
  limpieza y el reporte local de recursos/intentos sin secretos (FR-135/FR-136). Verificación:
  fallo inyectado visible, posterior recuperación limitada al entorno e IDs de esa ejecución;
  documentar qué no puede limpiarse inmediatamente tras SIGKILL.

## 3. Integración y CI

- [x] 3.1 Ejecutar dos veces un subconjunto de integración y e2e web con caso cerrado/correctiva y
  objetos de voz/conocimiento, incluyendo fallo deliberado (FR-135/FR-136; US21-AC3–AC5).
  Verificación: baseline equivalente antes/después, centinelas intactos y reporte trazable.
- [x] 3.2 Adaptar CI al destino explícito, un worker y ejecución secuencial; retirar reset intermedio
  solo después de demostrar ausencia de residuos en la suite completa (FR-134–FR-136).
  Verificación: CI con evidencias de limpieza y repetición; documentar comandos nuevos en `SETUP.md`.
  No modificar `.github/workflows/native-e2e.yml` ni `tests/e2e/native/`: Maestro Cloud y su
  backend remoto quedan fuera de esta entrega por decisión del usuario.
- [x] 3.3 Tras autorización para cerrar la PR de implementación, ejecutar las compuertas aplicables
  y prerrevisión con Sobreingeniería según AGENTS.md (FR-133–FR-136). Verificación: resultados y
  reporte en español en la PR, diferenciando pruebas locales de CI y límites pendientes.

## Workflow follow-up

- Si para limpiar hacen falta migraciones, cambios de contratos o debilitar permisos, presentar
  el hallazgo y alternativas al usuario antes de tocar esas áreas.
- Sincronizar/archivar después de implementación y aceptación demostrada; mantener esta entrega
  separada de la implementación del dataset.

## Evidencia acumulada

- Inventario de escritores/recursos en inventario-tests.md. Configuración: rojo contra servidor
  fijado en 8083/fallback de desarrollo y verde tras aislar TEST_*, puerto, claves públicas y caché.
- Helpers: rojo por sexo incoherente y RUT duplicados con RNG constante; plantillas reales,
  actores exclusivos y reserva de RUT durable por scope después en verde.
- Núcleo: pruebas vivas de escritura confirmada sin ID devuelto, SIGKILL real, recuperación,
  exclusión mutua, IDs ajenos, grafo con correctivas/voz/conocimiento/Storage y permisos originales.
  Los IDs del demo y su auditoría permanecieron intactos.
- Cuotas globales por IP: decisión de restaurar filas exactas bajo lock aprobada por el usuario;
  prueba viva de purga/incremento/fallo y restauración exacta en verde; recuperación tras SIGKILL
  también conserva toda la tabla. Núcleo: 12 vivas / 85 aserciones; 9 unitarias / 29 aserciones.
- Integración demo por runner de archivo completó 15/25/8 en su propio scope y lo limpió al salir.
- Integración completa dos veces: 125 correctas / 4 omitidas (ASR externo opt-in) / 0 fallos.
  Chromium: los 22 archivos completados, 122 correctas y 4 de micrófono omitidas en modo simulado;
  las 4 de micrófono pasaron después en modo real con transcripción interceptada. Se ejecutó por
  lotes: los primeros fallos de `estados` y `tema` revelaron dependencia de pacientes de otros
  archivos; corregidos provisionando su propio caso, sin cambios de producto.
- Repetición web de epicrisis, correctivas de feedback, conocimiento y voz: 27 correctas / 0 fallos.
  Smoke: 13 correctas. Un solo worker, una exportación por lote y sin reset entre estas ejecuciones.
- Tras los primeros 48 scopes conservados: todos `clean`; SQL confirmó cero cuentas, clínicas y
  fichas propias restantes. Cada teardown verifica todo su grafo y la restauración exacta de cuota.
  Retirado el reset intermedio de CI después de esta evidencia local; la CI del nuevo HEAD sigue
  pendiente y no se confunde con aceptación remota.
- Incidente inicial de Playwright: su salida por defecto borró los diarios antes de arrancar los
  tests. Se reconstruyeron las identidades exactas de las tres cuentas/clínica provisionadas y
  se recuperaron únicamente sus filas, comprobando que no había registros clínicos ni cuotas
  modificadas y que el baseline ajeno seguía intacto. Fue recuperación manual, no automática
  de un diario perdido. La salida dedicada y una prueba real mínima de Playwright evitan repetirlo.
- Prerrevisión de implementación, ronda 1, publicada en #82: corregidos salida de Playwright,
  expectativa de tutor y nombres/fallback; se exige clave/nombre existente del dataset.
  CI previa: pgTap 375 correctas, tipos y unitarios correctos; carga demo cortada por timeout de
  5 s, ahora con presupuesto explícito de 60 s para el grafo completo. Auditoría de dependencias
  bloqueada por `deepmerge` (GHSA-gcqx-w48m-w2h4), ajeno a esta entrega; decisión solicitada al usuario.
- Compuerta final: Biome (465 archivos), tipos y 1.648 tests correctos / 155 vivas omitidas /
  0 fallos; las vivas se verificaron aparte. Soporte focalizado: 70 correctas / 173 aserciones.
  Integración de los cuatro archivos corregidos: 26 correctas / 0 fallos, incluida la carga demo.
  Segunda prerrevisión independiente sin nuevos hallazgos; informes de ambas rondas en #82.
- Comprobación SQL final: 56 scopes `clean`, cero pendientes y cero cuentas/clínicas/fichas
  propias restantes; tabla de cuota idéntica al último snapshot privado. Esto acredita la
  ejecución local y no sustituye una CI verde ni aceptación humana de la PR.
- Pendiente: CI del HEAD corregido, incluida la auditoría de dependencias ajena al cambio.
  Firefox/WebKit, Maestro Cloud y proveedor externo de ASR no se han verificado localmente.
