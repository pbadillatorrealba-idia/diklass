# Parches de dependencias

## deepmerge 4.3.1

Mitiga [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4): rechaza
`__proto__` antes de copiar propiedades del target y del source. Conserva el tratamiento de
las demás claves, arrays y símbolos. Cubre el código fuente y las entradas CommonJS/UMD
distribuidas; Expo resuelve la entrada CommonJS de esta dependencia transitiva.

Al 2026-10-28, npm sigue publicando 4.3.1 y el aviso no identifica una versión corregida.
El bypass se reprodujo localmente con target de prototipo nulo, placeholder `null` y clave
propia en el target; las seis regresiones de ambas entradas fallaban antes del parche.
La defensa coincide con la propuesta de [upstream #274](https://github.com/TehShrike/deepmerge/pull/274),
cerrada sin publicación; no se presenta como un parche oficialmente aceptado.

Generado con `bun patch deepmerge@4.3.1` y `bun patch --commit deepmerge@4.3.1`, sin editar
`bun.lock` a mano. `bun install --frozen-lockfile` aplica `patchedDependencies`; se comprobó
reinstalando el paquete y ejecutando las regresiones después. Prueba focalizada:

```sh
bun test tests/unit/scripts/deepmerge-patch.test.ts
```

El parche conserva el número de versión: la auditoría por avisos sigue detectando 4.3.1.
Esta entrega no omite el aviso en CI; ese tratamiento queda pendiente de decisión explícita.
Retirar el parche cuando una publicación oficial supere las mismas regresiones, o cuando
Expo deje de consumir esta dependencia. Antes de revertirlo, tener presente que vuelve el bypass.
