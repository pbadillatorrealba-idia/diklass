---
version: 1
slug: "src-app-protected-patients-consultations-id-tsx"
primary_target: "src/app/(protected)/(patients)/consultations/[id].tsx"
related_targets: []
---

# Surface brief: pantalla de consulta y shell de asistente

Alcance: `src/app/(protected)/(patients)/consultations/[id].tsx` y el shell que la envuelve
(`AppNavigation`), cambio OpenSpec `shell-asistente-tres-zonas`. Modo: **Operate**.

## Task

El veterinario atiende una consulta con tutor y perro presentes. Completa la anamnesis (texto y voz),
revisa y confirma los borradores que propone el sistema, consulta la base de conocimiento, registra
diagnóstico y plan, y firma la epicrisis. Uso mixto: escritorio/notebook y tablet/móvil con el mismo
peso. La captura de voz corre en ventanas de ~30–60 s mientras él mira al tutor, no la pantalla. La
intención de producto es que la app llegue a ser agéntica: el asistente acompaña, pero solo propone.

## Direction contract

Seed key: 7da3da20 (surface, operate). Dealt 3 · 6 · 2; el usuario eligió la tercera
(«hoja partida con margen de escucha») y después la extendió a toda la app: **shell de tres zonas**,
navegación | contenido | panel de asistente. El mundo visual (DESIGN.md, «el formulario en copias») queda
fijo; solo cambia la composición del shell.

- **World**: una hoja de formulario con margen de anotaciones. El contenido de cada pantalla es el
  formulario o la lista de siempre; a su derecha, un **panel de asistente** en el borde del shell, la
  «cinta» de la consulta, donde viven los hilos: Escucha (tramos con sus borradores), Conocimiento
  (respuestas con cita) y Asistente (reservado). El panel es del shell, no de la pantalla.
- **First viewport** (≥ 1440 px): barra lateral, contenido (la consulta a una columna: encabezado,
  contexto, 1·2·3) y panel acoplado de 360 px con el hilo activo. Entre 1024 y 1439 px el panel es un
  riel de 56 px con el estado de escucha, que abre un cajón. Bajo 1024 px y en nativo, un dock al pie con
  el estado y una hoja con el hilo. El formulario nunca se mueve por la escucha.
- **Visitor path**: escuchar o escribir → ver aparecer tramos y borradores en el hilo con su fragmento →
  Confirmar / Corregir / Descartar sin salir del lugar → el dato aterriza en su campo, a la vista y
  marcado «Nuevo» con el código «I» → pasar a Diagnóstico → Epicrisis y firma. Preguntar a Conocimiento
  desde el mismo panel, con el paciente de contexto ya fijado.
- **Signature interaction**: el hilo único: cada tramo con sus borradores debajo, como un cuaderno de
  escucha. Sin animación nueva (la única animación de autor sigue siendo la firma, FR-099): el
  aterrizaje del borrador es una marca «Nuevo», no un movimiento.
- **Cross-surface reach**: el mismo panel y los mismos hilos en toda pantalla protegida; contextual
  (Escucha solo con consulta abierta, Conocimiento siempre, Asistente siempre). Reutilizable para el
  seguimiento y la ficha.
- **Honest risk**: un panel «agéntico» sin agente puede prometer lo que no existe; el hilo «Asistente»
  declara su no disponibilidad y no simula respuestas. Además: el aviso de grabación nunca puede quedar
  oculto (vive en el riel y en el dock), el dock compite con el teclado en móvil y la hoja modal necesita
  foco atrapado explícito en web.

## Unresolved

- Orden del hilo de escucha (más nuevo arriba o abajo) y desplazamiento al último tramo.
- Ancho del panel expandido (360 px) frente a las pantallas más densas.
- Verificación nativa en iOS y Android (sin dispositivo en esta máquina).
