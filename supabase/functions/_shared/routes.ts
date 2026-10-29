/** Lista blanca de rutas a las que el agente puede llevar al usuario; la validan el servidor y el cliente. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Lista blanca de rutas: el agente solo navega a pantallas conocidas. */
const RUTAS = [
  /^\/home$/,
  /^\/patients$/,
  new RegExp(`^/patients/${UUID}$`),
  /^\/tutors$/,
  new RegExp(`^/tutors/${UUID}$`),
  /^\/knowledge$/,
  /^\/follow-up$/,
  /^\/settings$/,
];
export const isAllowedRoute = (path: string) => RUTAS.some((r) => r.test(path));
