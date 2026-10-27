# Proposal

## Why

La consulta es hoy una sola columna larga y el modo de escucha ocupa lo más alto de «1 Anamnesis»:
al activarlo, transcripción y borradores empujan el formulario hacia abajo, justo cuando el
veterinario mira al tutor. Con la voz real (`implementar-asr-real-captura-voz`) la captura dura
minutos y el aviso de grabación debe estar siempre a la vista. Además, la intención del producto es
que la app llegue a ser **agéntica**: un asistente presente en cada pantalla, que acompañe sin quitar
la decisión al veterinario. Resolver la escucha como un parche de la consulta obligaría a rehacerlo
cuando llegue el asistente; conviene darle a toda la app un lugar para él desde ahora.

## What Changes

- **Shell de tres zonas en toda la app** (pantallas protegidas): navegación | contenido | **panel de
  asistente** a la derecha. El panel es parte del shell, no una columna de la pantalla: el contenido
  de cada pantalla conserva su composición (la consulta sigue a una columna).
- **Panel colapsable y contextual**, con su estado recordado por dispositivo:
  - web ≥ 1440 px: acoplado y expandido (360 px por defecto, 280–560 px al arrastrar), colapsable a un **riel** de 56 px;
  - web 1024–1439 px: riel visible; el panel se abre como **cajón superpuesto** sin reflujo del
    contenido;
  - web < 1024 px y nativo: **dock** (cinta persistente al pie, sobre la barra de pestañas) y una
    **hoja modal** con el hilo.
- **Tres hilos en el panel**:
  - **Escucha** (solo con una consulta abierta): el hilo cronológico de tramos transcritos con sus
    borradores debajo (Confirmar / Corregir / Descartar), sin hablantes ni burbujas; sustituye a
    `ListenModeSection` dentro de «1 Anamnesis», que deja de empujar el formulario.
  - **Conocimiento**: la consulta a la base de conocimiento con citas (hoy la pantalla `/knowledge`,
    que se conserva), con el paciente de contexto tomado de la pantalla.
  - **Asistente**: responde consultas básicas por reglas (fecha, agenda, pacientes de hoy) y consulta
    la base de conocimiento; no es un agente y **no simula** respuestas. Los estados de un agente
    futuro (en espera, pensando, propone, error) quedan para ese cambio.
- **El agente solo propone**: toda propuesta se muestra como sugerencia (pliego canario con contorno
  ocre), no escribe en el registro clínico ni ejecuta nada sin Confirmar explícito, queda atribuida
  y con procedencia «Inferida» (FR-010 · FR-021 · FR-076).
- **El riel y la cinta muestran siempre el estado de la escucha** (estado, tiempo y el aviso «Grabando
  y conservando audio») aunque el panel esté colapsado.
- **Al confirmar un borrador**, el dato aterriza en su campo, que se trae a la vista y se marca
  «Nuevo» con el código «I», sin animación nueva (la única animación de autor sigue siendo la firma).
- Sin tokens, colores ni tipografía nuevos: «el formulario en copias» se conserva (DESIGN.md). **No se
  modifican FR-079 ni FR-082.**
- **Fuera de este cambio**: el agente real (LLM, herramientas, seguridad y la revisión de la decisión
  dura HD1 de conocimiento extractivo) es un cambio futuro aparte.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `sistema-visual`: nuevos requisitos de composición (shell de tres zonas, panel de asistente, hilos,
  dock y hoja, aterrizaje del borrador confirmado). No cambian los requisitos existentes de
  navegación (FR-082) ni de adaptación al ancho (FR-079).

## Impact

- **Construcción**: depende de `implementar-captura-voz-anamnesis` e `implementar-asr-real-captura-voz`
  (PR #64 y #66) y de `implementar-base-conocimiento-trazable` (ya archivada). Archivar los dos
  primeros antes.
- **Código**: `src/components/navigation/app-navigation.web.tsx` y `app-navigation.tsx` (shell),
  `src/components/ui/screen.tsx` (prop `dock`), `src/components/voz/*` (hilo de escucha),
  `src/components/conocimiento/*` y `src/features/conocimiento/conversation-store.ts`
  (reutilización), `src/app/(protected)/(patients)/consultations/[id].tsx` y nuevos
  `src/components/asistente/*` y `src/features/asistente/*` (estado del panel y registro de hilos).
- **Pruebas**: el e2e «la consulta usa una sola columna a 1280 px y a 375 px» se mantiene para el
  contenido; se añaden los del panel, el riel, el cajón, el dock y la hoja, y la compuerta axe se
  extiende en claro y oscuro.
- **Docs**: brief de superficie de `impeccable`, `DESIGN.md`, `PRODUCT.md` y `docs/brief-poc-cdss.md`
  §14 (ver `tasks.md` grupo 8); se actualizan al implementar, sin afirmar lo pendiente.
- **Dependencias**: ninguna.
- **No verificable aquí**: nativo (iOS/Android) sin dispositivo; se verifica en web (1440, 1280, 1024 y
  375 px) y se declara la verificación nativa como pendiente.
