# Design

## Context

La barra compacta de AppNavigation contiene únicamente Logo. Todas las rutas protegidas usan Screen o ScreenList. El login ya contiene su marca.

## Goals / Non-Goals

Eliminar la franja superior y centrar una sola marca en el contenido desplazable de todas las pantallas web compactas. Se conservan navegación nativa, identidad y lógica clínica.

## Decisions

- Logo sm (20 px de alto), con 8 px adicionales de padding superior en web compacta, centrado y sin fondo ni borde propio, antes del título y del enlace de retroceso. Se reutiliza ScreenHeading para Screen y ScreenList; la marca se muestra incluso sin título.
- Visibilidad con lg:hidden, usando el mismo corte CSS de 1024 px que la barra lateral, sin nuevas decisiones de ancho en JavaScript ni saltos iniciales.
- No se añade la marca a las cabeceras nativas: la barra eliminada pertenece al shell web.
- Alcance aprobado por el usuario: «Dale, aplica pero en todas las pantallas» tras acordar el logo dentro del contenido desplazable. El diseño concreta esa dirección sin cambiar identidad.

## Risks / Trade-offs

La marca consume 20 px y el espaciado existente del contenido, pero deja de ser una barra fija. Verificar pantallas de lista y detalle, claro/oscuro y escritorio; nativo conserva su comportamiento y requiere dispositivo para verificación visual. Sin dependencias ni complejidad nueva, sin peticiones de red adicionales y con la imagen existente. WCAG, navegación y seguridad mantienen sus contratos.

## Ajuste aprobado posterior

El usuario solicita retirar Seguimiento de la barra inferior web: quedan Inicio, Pacientes, Conocimiento y Configuración. Se conserva en SECTIONS para escritorio y nativo y se filtra solo en TABBAR_SECTIONS. No se añade una ruta alternativa; la ruta existente sigue disponible.

Petición posterior aprobada: Configuración muestra su nombre debajo del icono, igual que los demás destinos compactos. Comprobar el texto visible y legible en 320 y 375 px.

## Cápsula de asistente aprobada

Reutilizar PanelDockView y ScreenBottomBar (incluida ScreenList): dos FAB extendidos apilados a la derecha, con 16 px a los bordes. Asistente usa primary y contenido primary-foreground; Iniciar consulta usa outline y enlaza a /patients, igual que el acceso de Inicio. Ambos tienen radio completo. El contenedor se posiciona absolutamente sobre el contenido, sin franja en el flujo. Su altura medida solo añade padding al final del contenido desplazable, de modo que los últimos controles puedan desplazarse por encima de los FAB. La zona transparente permite interacción con el contenido que hay debajo. Los avisos y controles de escucha se conservan. En Inicio se retira la acción móvil duplicada; escritorio conserva su botón. Iniciar consulta permanece disponible aunque no haya hilos del asistente (p. ej. Conocimiento). Sin nuevos tokens ni dependencias.
