# Auditoría Impeccable de Configuración

Fecha: 2026-10-27. Worktree: ui-ux-login, rama feat/mejoras-ui-ux.
Superficie: /settings y navegación que la rodea, web con Chromium y Metro en localhost:9701.
La auditoría no modificó la interfaz. Los ajustes posteriores de marca y barra inferior fueron pedidos expresamente por el usuario y se distinguen abajo.

## Implementation Integrity Verdict

Sistema coherente con el producto y DESIGN.md: tokens compartidos, tipografía Atkinson, tres tarjetas en una columna y controles reutilizados. El detector empaquetado de Impeccable no encontró patrones en los seis archivos inspeccionados. Esto no demuestra ausencia de problemas de interacción o adaptación: las comprobaciones del navegador sí encontraron tres.

## Audit Health Score

Evaluación orientativa del estado anterior al último ajuste móvil, sin certificación de accesibilidad ni medición de rendimiento de producción.

| Dimensión | Puntuación | Evidencia |
|---|---:|---|
| Accesibilidad | 2/4 | Teclado y foco correctos; título recortado con texto ampliado |
| Rendimiento | 3/4 | Sin listas largas, efectos costosos ni trabajo pesado en la pantalla; sin perfil de producción |
| Adaptación | 2/4 | Columna única correcta; etiquetas móviles partidas y perfil demasiado estrecho con texto ampliado |
| Temas | 4/4 | Tokens y contraste comprobados en ambos temas, preferencia conservada al recargar |
| Integridad | 3/4 | Componentes coherentes; falta estado pendiente en cierre de sesión |
| Total | 14/20 | Bueno, con correcciones necesarias |

## Hallazgos por prioridad

### P1 — El texto ampliado pierde legibilidad y recorta el título

- Ubicación: src/components/ui/screen.tsx, ScreenHeading; src/app/(protected)/(settings)/settings/index.tsx:33, fila de avatar y datos.
- Categorías: accesibilidad y adaptación.
- Reproducción: ancho 320 px, fuente raíz ampliada de 16 a 32 px (200 %). El título pasa de 24 a 48 px; su borde derecho queda en x=344,73, fuera de una ventana de 320 px, con recorte en el contenedor. La fila del perfil mantiene avatar y datos en horizontal, dejando al nombre apenas espacio para una o dos letras por línea.
- Impacto: usuarios con texto grande no pueden leer la pantalla con normalidad. Afecta al criterio de redimensionamiento del texto WCAG 1.4.4; revisar también el reflujo.
- Recomendación: permitir que el título se ajuste al ancho y que la fila de perfil se apile cuando los datos ya no tengan espacio. No reducir el tamaño de texto elegido por el usuario.
- Comando sugerido: $impeccable harden.
- Estado: corregido y verificado tras la autorización del usuario. El título se ajusta al ancho y los datos del perfil se apilan cuando no caben junto al avatar. Prueba e2e con fuente raíz al 200 % en 320 px aprobada.
- Evidencia local: /tmp/settings-audit-320-text200.png.

### P2 — Las etiquetas de navegación se parten dentro de las palabras

- Ubicación: src/components/navigation/nav-item.tsx:66 y TABBAR_SECTIONS en sections.ts.
- Categoría: adaptación del shell compartido, visible desde Configuración.
- Reproducción inicial: 320 px, ambos temas, cinco destinos inferiores. Seguimiento aparece como «Seguimien / to» y Conocimiento como «Conocimie / nto».
- Impacto: lectura y reconocimiento más lentos; no se afirma una infracción automática de WCAG.
- Recomendación: reducir la presión de ancho y evitar partir las etiquetas de esa manera.
- Comando sugerido: $impeccable polish.
- Estado posterior: resuelto en la comprobación a tamaño normal de 320 y 375 px por la retirada de Seguimiento que pidió el usuario. Quedan cuatro destinos y Conocimiento ocupa una sola línea. La adaptación a texto ampliado continúa cubierta por el P1 anterior.

### P2 — Cerrar sesión no indica que está procesando

- Ubicación: src/components/auth/logout-button.tsx:5–13, compartido por Configuración y la barra lateral.
- Categoría: integridad de interacción.
- Reproducción: retrasar 1,5 s la petición revoke_current_access_session. Durante la espera, el botón sigue habilitado, mantiene «Cerrar sesión» y no publica aria-busy.
- Impacto: no informa si recibió la acción y permite volver a activarlo mientras hay una petición en curso.
- Recomendación: bloquear nuevas activaciones durante la operación y mostrar/anunciar un estado de progreso. Revisar ambos lugares que reutilizan el componente.
- Comando sugerido: $impeccable harden.
- Estado: corregido y verificado tras la autorización del usuario. LogoutButton muestra «Cerrando sesión…», se deshabilita y publica aria-busy durante la espera. Dos pruebas e2e aprobadas, una desde Configuración y otra desde la barra lateral. No se auditó seguridad de la revocación ni se simuló un fallo de backend.

## Verificación y aspectos que funcionan

- Ocho combinaciones: 320, 375, 1280 y 1920 px, temas claro y oscuro. Axe con reglas WCAG A/AA hasta 2.2: cero infracciones automáticas. La regla color-contrast dejó elementos para revisión manual, por lo que no se declara conformidad completa.
- Contraste calculado con los tokens efectivos de la pantalla: texto/card 17,38:1 y 14,32:1; texto secundario/card 7,79:1 y 7,20:1; texto/opción seleccionada 9,88:1 y 9,53:1, claro y oscuro respectivamente. Se comprobaron estas combinaciones, no cada píxel del shell.
- Teclado: Editar datos personales → opción de tema seleccionada → Cerrar sesión; anillo visible. ArrowRight selecciona Claro y conserva el foco correctamente.
- Preferencia Sistema conservada tras recargar. Tarjetas de igual ancho, una columna y sin desplazamiento horizontal a tamaño normal.
- Botones Editar y Cerrar sesión medidos con 50 px de alto; opciones de tema usan el mínimo compartido de 44 px. No se detectó contenido ficticio ni colores literales en la pantalla.

## Patrones y acciones aplicadas

El reflujo del título y el estado de cierre pertenecen a componentes compartidos: conviene corregirlos allí y comprobar sus demás usos, sin introducir soluciones particulares en Configuración.

1. $impeccable harden para el título y perfil con texto ampliado.
2. $impeccable harden para el estado pendiente de LogoutButton.
3. $impeccable polish como pasada final. Se pueden abordar juntos o por separado y volver a ejecutar $impeccable audit después.

## Límites

Solo web/Chromium. No ejecutados VoiceOver, TalkBack, dispositivos nativos, Firefox/WebKit, pruebas de lector de pantalla, perfil de rendimiento ni gate completo. La simulación del 200 % cambió el tamaño de fuente raíz; no equivale a comprobar todas las modalidades de zoom del navegador. Las capturas y este informe están en /tmp y son temporales.


## Cierre de las correcciones autorizadas

Los tres hallazgos iniciales están corregidos en el alcance web comprobado. La última petición
hace visible «Configuración» debajo del icono; las cuatro etiquetas caben en una línea a 320 y
375 px, con la fuente de navegación existente de 12 px. Se eliminó únicamente el relleno
horizontal de los botones inferiores para aprovechar sus 80 px de ancho en 320 px.

Verificación posterior: seis e2e focalizados aprobados; 418 unitarias, typecheck y Biome aprobados.
Axe repetido en 320, 375, 1280 y 1920 px, claro y oscuro: cero infracciones automáticas.
Se conservan los límites descritos: contraste automático parcialmente incompleto, revisión manual
por tokens, solo Chromium, sin lector de pantalla ni dispositivo nativo ni perfil de producción.
No se transforma esta evidencia en una afirmación de aceptación completa ni certificación WCAG.

La suite focalizada de navegación también pasó completa: 6 escenarios en Chromium, incluidos teclado, barra móvil, breadcrumb y retroceso por URL directa.
