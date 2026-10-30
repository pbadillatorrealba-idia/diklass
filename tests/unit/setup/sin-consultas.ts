import { afterAll, beforeAll, mock } from "bun:test";

const RUTA = "@/features/conocimiento/consulta-service";

/**
 * Hace que `getQuery` devuelva null (sin respaldo registrado) solo mientras corren las pruebas del
 * archivo que lo llama. `mock.module` vive en todo el proceso y Bun carga todos los archivos antes de
 * ejecutarlos, así que un mock fijo llegaría a `consulta-service.test.ts` según el orden: fuera de las
 * pruebas del archivo se delega al `getQuery` real.
 */
export async function sinConsultas() {
  const real = await import(RUTA);
  const getQueryReal = real.getQuery;
  let activo = false;
  mock.module(RUTA, () => ({
    ...real,
    getQuery: (...args: Parameters<typeof getQueryReal>) =>
      activo ? Promise.resolve(null) : getQueryReal(...args),
  }));
  beforeAll(() => {
    activo = true;
  });
  afterAll(() => {
    activo = false;
  });
}
