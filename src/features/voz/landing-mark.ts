/**
 * Marca «Nuevo» del borrador confirmado (sistema-visual «El borrador confirmado aterriza en su
 * campo» · design.md D9). Dura hasta la siguiente acción del veterinario: toda operación de la
 * consulta deja un estado nuevo (`OperationStatus`), así que la marca sobrevive solo mientras el
 * estado sea el objeto que anunció el aterrizaje. Sin animación: es el rótulo y el desplazamiento.
 */
export type Landing = { entryId: string; announcement: object };

export function landAt(entryId: string, announcement: object): Landing {
  return { entryId, announcement };
}

/** La marca vigente tras un cambio de estado: se quita si ya no es el del aterrizaje. */
export function keepLanding(landing: Landing | null, current: object | null): Landing | null {
  return landing !== null && current === landing.announcement ? landing : null;
}
