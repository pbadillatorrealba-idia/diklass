const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id de la URL que no es UUID no existe: se resuelve como «no encontrado», no como error. */
export const isUuid = (value: string | undefined): value is string => !!value && UUID.test(value);
