# Tasks

## 1. Marca compacta (FR-079 · FR-082)

- [x] 1.1 Añadir pruebas de marca dentro del desplazamiento en Screen y ScreenList y observar su fallo antes de implementar.
- [x] 1.2 Retirar la barra superior web e incorporar Logo en ScreenHeading; comprobar pruebas focalizadas y tema, y actualizar DESIGN.md.
- [x] 1.3 Verificar visualmente web compacta y escritorio, claro/oscuro y el desplazamiento; registrar evidencia y limitaciones.

## Workflow follow-up

- Ejecutar las compuertas y prerrevisión al cerrar la PR; archivar solo con aceptación demostrada.

## Evidencia de esta sesión

Implementado y verificado localmente; aceptación del usuario y compuertas de integración pendientes.

- TDD: tres fallos esperados por ausencia de marca, luego 413 pruebas focalizadas aprobadas (Screen, ScreenList, dock, logo y tema).
- Biome: los tres archivos de código/pruebas modificados pasan.
- Navegador Chromium con Metro de este worktree: `/home`, `/follow-up`, `/patients/new` y `/settings` a 375 y 1280 px. Centro del logo a 187,5 px en compacto, oculto en escritorio y sin `app-topbar` en las ocho combinaciones.
- Desplazamiento en Configuración: la coordenada vertical de la marca pasa de 16 a −59 px al desplazar el contenedor.
- Capturas inspeccionadas: `/tmp/diklass-marca-375-light.png`, `/tmp/diklass-marca-375-dark.png`, `/tmp/diklass-marca-1280-light.png` y `/tmp/diklass-marca-1280-dark.png`. Son evidencia local temporal; la comprobación cubre composición, no aceptación de las consultas clínicas que estaban cargando.
- No ejecutados: gate, suite e2e completa, typecheck (sin cambios de tipos/firmas) ni verificación en dispositivo nativo.


## 2. Espacio de marca y barra inferior (FR-079 · FR-082)

- [x] 2.1 Actualizar la prueba de destinos compactos y añadir comprobación del espacio superior de marca en navegador; observar fallo antes de implementar.
- [x] 2.2 Añadir 8 px de padding superior a la marca compacta y filtrar Seguimiento de TABBAR_SECTIONS; mantener escritorio/nativo y actualizar pruebas e2e y DESIGN.md.
- [x] 2.3 Verificar navegación compacta, espacio del logo, tema y desktop con pruebas focalizadas y captura; registrar los hallazgos de auditoría anteriores al ajuste.


Evidencia del ajuste posterior: pruebas rojas por Seguimiento aún presente y logo a 16 px;
luego 389 unitarias y 2 e2e focalizados aprobados. Comprobación de navegador a 320 y 375 px:
logo en y=24 y Conocimiento en una línea; a 1280 px Seguimiento sigue en la barra lateral.
Biome y validación OpenSpec aprobados. La expectativa antigua de acceso a Seguimiento en una
activación desde la barra móvil se sustituye por su ausencia solicitada; se conserva esa prueba
en escritorio. Captura local: `/tmp/diklass-settings-mobile-adjusted.png`.
Informe de auditoría previo al ajuste y estado de sus hallazgos: `/tmp/diklass-configuracion-auditoria.md`.
Gate y e2e completos, nativo y otros navegadores siguen pendientes.


## 3. Etiqueta de Configuración (FR-082)

- [x] 3.1 Comprobar con un e2e primero rojo que Configuración tiene etiqueta visible bajo el icono a 320 y 375 px, y después retirar la presentación de solo icono; verificar las cuatro etiquetas sin partir palabras.


## 4. Correcciones de auditoría (FR-079 · FR-080 · FR-093)

- [x] 4.1 Tras pruebas rojas, corregir el reflujo del título y el perfil con fuente raíz al 200 % en 320 px; verificar el título dentro del viewport y el nombre legible.
- [x] 4.2 Tras pruebas rojas, añadir estado de progreso y bloqueo de activaciones durante el cierre de sesión; verificar el componente desde Configuración y barra lateral.
- [x] 4.3 Repetir la auditoría focalizada en ambos temas, teclado y dimensiones relevantes; actualizar el informe con los hallazgos corregidos y sus límites.


Evidencia final de etiqueta y auditoría: seis e2e focalizados de Configuración aprobados,
418 pruebas unitarias (siete archivos) y typecheck aprobados. Texto ampliado en 320 px:
título dentro del ancho y perfil apilado con nombre legible. LogoutButton deshabilitado,
aria-busy=true y texto de progreso durante la espera, probado desde tarjeta y barra lateral.
Segunda pasada de axe en 320, 375, 1280 y 1920 px, claro y oscuro: cero infracciones automáticas;
color-contrast conserva elementos de revisión manual, con las combinaciones principales verificadas
mediante tokens en el informe. No equivale a aceptación WCAG completa ni a verificación nativa.
Informe persistente: `evidencia/auditoria-configuracion.md`.

También se ejecutó completa `navegacion.spec.ts` en Chromium contra el servidor de este worktree: 6 pruebas aprobadas.
