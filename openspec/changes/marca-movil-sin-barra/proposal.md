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
