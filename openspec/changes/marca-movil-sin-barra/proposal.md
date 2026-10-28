# Proposal

## Why

La barra superior móvil ocupa espacio solo para la marca. El usuario aprueba mover el logo al centro superior del contenido en todas las pantallas internas, desplazándolo con ellas.

## What Changes

- Web bajo 1024 px: retirar la barra superior y mostrar la marca centrada dentro del desplazamiento de cada pantalla protegida.
- Conservar el logo existente del login y de la barra lateral de escritorio.
- Añadir 8 px de espacio sobre la marca compacta y retirar Seguimiento solo de la barra inferior web, por petición posterior del usuario. Conservar su ruta y su acceso de escritorio.
- Mantener Configuración en la barra inferior, como ya está implementado en esta rama.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `sistema-visual`: ubicación de marca en web compacta, especialización de FR-079/FR-082.

## Impact

`AppNavigation` web, `Screen`, `ScreenList`, pruebas y DESIGN.md. Sin dependencias nuevas ni cambios clínicos o de datos. Depende del sistema visual y de la navegación ya implementada en esta rama; aceptación conjunta con sus cambios de login e Inicio. Las referencias aceptadas de FR-091/FR-093 a controles en la antigua barra ya difieren del código de esta rama: tema y cuenta están en Configuración; este cambio no vuelve a introducir esos controles.

## Acceso compacto al asistente

Dirección aprobada por el usuario: sustituir el botón de la cinta por una cápsula flotante a la derecha en móvil, con icono y nombre fijo Asistente. Conservar el panel de escritorio y la hoja existente, superpuestos al contenido, con padding final desplazable para alcanzar los últimos controles y controles de escucha siempre visibles. El usuario aclara que no debe existir una franja que ocupe espacio y solicita un segundo FAB Iniciar consulta, reutilizando /patients.
