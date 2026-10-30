/** Cómo se nombra al veterinario cada herramienta del agente en «¿Por qué?». */
const ROTULOS: Record<string, string> = {
  buscar_paciente: "Buscó pacientes",
  navegar: "Abrió una pantalla",
  consulta_abierta: "Revisó las consultas abiertas",
  consultas_de_hoy: "Revisó las consultas de hoy",
  resumen_de_consulta: "Leyó el resumen de la consulta",
  proponer_resumen: "Preparó una propuesta de resumen",
  proponer_antecedente: "Preparó una propuesta de antecedente",
};

/** Una herramienta nueva sin rótulo se muestra por su nombre: nunca se oculta lo que hizo el agente. */
export const rotuloHerramienta = (name: string) => ROTULOS[name] ?? name;
