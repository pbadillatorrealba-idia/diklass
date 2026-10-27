# Tasks

Planificación pendiente de aprobación, implementación y aceptación. Depende de que el dataset de
la PR #81 esté aprobado e implementado; no importar módulos futuros como si ya existieran.

## 1. Configuración y destino

- [ ] 1.1 Registrar aprobación de spec/diseño e inventariar todos los escritores de integración/e2e,
  dependencias SQL y storage, recursos compartidos y baseline por suite (FR-133–FR-136).
  Verificación: tabla de escritores/recursos revisada; ninguna suite queda fuera por no usar helpers.
- [ ] 1.2 Escribir pruebas de configuración incompleta, URL remota, destino de desarrollo, claves
  incoherentes, puerto web y backend exportado distinto; observar rojo antes de implementar
  (FR-134; US21-AC2). Verificación: fallan por el contrato nuevo y ninguna hace escrituras.
- [ ] 1.3 Implementar resolución de `TEST_*`, puerto e inyección coherente en helpers y export;
  exigir error al solicitar backend sin configuración (FR-134). Verificación: 1.2 en verde,
  export dirigida a testing y ninguna clave privada en su bundle; documentar `.env.example` y `SETUP.md`.
- [ ] 1.4 Escribir primero tests de rechazo de identidad no verificable y lock ocupado, después
  implementar configuración local temporal derivada, comprobación de proyecto/marca y reserva
  en DB (FR-134/FR-136). Verificación: rojo/verde, destino `diklass` rechazado y segundo runner
  bloqueado; confirmar compatibilidad del CLI fijado, sin detener el backend del usuario.

## 2. Plantillas y ciclo de recursos

- [ ] 2.1 Escribir y observar fallar tests de nombres naturales, vínculos por clave, UUID/RUT
  distintos por intento y homónimos; adaptar plantillas compartidas en soporte de tests
  (FR-133; US21-AC1). Verificación: verde con ambos intentos preservando contenido editorial y
  documentación de las excepciones para fixtures deliberadamente inválidos.
- [ ] 2.2 Escribir y observar fallar tests de registro inmediato de recursos, setup parcial, error
  original más error de limpieza, centinelas y referencias correctivas (FR-135; US21-AC3/AC4).
  Implementar registro y teardown acotado sin cambios de permisos. Verificación: verde y ausencia
  comprobada de IDs propios, preservando los ajenos y el rechazo de DELETE a authenticated.
- [ ] 2.3 Adaptar primero `preparar-paciente.ts`, `caso-sintetico.ts`, fixtures Playwright y soporte
  vivo de Bun; después sus consumidores y escritores directos, incluidos voz/chat/conocimiento
  (FR-133/FR-135). Verificación: tests focalizados de cada familia pasan, sin «Caso Sintético» ni
  «Tutor de…» en nombres ordinarios; mantener casos negativos y límites que necesiten otros valores.
- [ ] 2.4 Escribir primero prueba de fallo de storage y recuperación de residuos, implementar su
  limpieza y el reporte local de recursos/intentos sin secretos (FR-135/FR-136). Verificación:
  fallo inyectado visible, posterior recuperación limitada al entorno e IDs de esa ejecución;
  documentar qué no puede limpiarse inmediatamente tras SIGKILL.

## 3. Integración y CI

- [ ] 3.1 Ejecutar dos veces un subconjunto de integración y e2e con caso cerrado/correctiva y
  objetos de voz/conocimiento, incluyendo fallo deliberado (FR-135/FR-136; US21-AC3–AC5).
  Verificación: baseline equivalente antes/después, centinelas intactos y reporte trazable.
- [ ] 3.2 Adaptar CI al destino explícito, un worker y ejecución secuencial; retirar reset intermedio
  solo después de demostrar ausencia de residuos en la suite completa (FR-134–FR-136).
  Verificación: CI con evidencias de limpieza y repetición; documentar comandos nuevos en `SETUP.md`.
- [ ] 3.3 Tras autorización para cerrar la PR de implementación, ejecutar las compuertas aplicables
  y prerrevisión con Sobreingeniería según AGENTS.md (FR-133–FR-136). Verificación: resultados y
  reporte en español en la PR, diferenciando pruebas locales de CI y límites pendientes.

## Workflow follow-up

- Si para limpiar hacen falta migraciones, cambios de contratos o debilitar permisos, presentar
  el hallazgo y alternativas al usuario antes de tocar esas áreas.
- Sincronizar/archivar después de implementación y aceptación demostrada; mantener esta entrega
  separada de la implementación del dataset.
