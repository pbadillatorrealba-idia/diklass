/**
 * Catálogo de la anamnesis etológica canina (D2 de `ficha-canina-etologia`): las secciones y
 * preguntas de la hoja «Consulta de etología clínica» del Hospital Clínic Veterinari (FVB).
 * Cada pregunta es una fila de anamnesis con su procedencia (FR-021). `texto` guarda texto
 * libre; `sino` y `tri` guardan una respuesta cerrada (FR-111): una pregunta sin responder es
 * «sin dato», nunca «no».
 */

const texto = <const I extends string>(id: I, label: string) =>
  ({ id, label, kind: "texto" }) as const;
const sino = <const I extends string>(id: I, label: string) =>
  ({ id, label, kind: "sino" }) as const;
const tri = <const I extends string>(id: I, label: string) => ({ id, label, kind: "tri" }) as const;

export const ANAMNESIS_SECTIONS = [
  {
    id: "motivo",
    label: "Motivo de consulta",
    fields: [
      texto("motivo_consulta", "Motivo de consulta"),
      texto("otros_problemas", "Otros problemas"),
      texto("historia_problema", "Historia clínica del problema (inicio, evolución)"),
    ],
  },
  {
    id: "entorno",
    label: "Entorno del perro",
    fields: [
      texto("vivienda_tipo", "Tipo de vivienda (piso/casa)"),
      texto("vivienda_destacar", "Vivienda: aspectos a destacar"),
      texto("contacto_familia", "Contacto con la familia"),
      texto("familia_adultos", "Adultos (nº y perfil)"),
      texto("familia_ninos", "Niños pequeños y edades"),
      texto("familia_otros_animales", "Otros animales y relación"),
    ],
  },
  {
    id: "rutina",
    label: "Rutina diaria",
    fields: [
      texto("rutina_paseos", "Paseos (número y duración)"),
      texto("rutina_comida", "Pauta de administración de la comida"),
    ],
  },
  {
    id: "alimentacion",
    label: "Alimentación",
    fields: [
      texto("alimentacion_dieta", "Tipo de dieta"),
      texto("alimentacion_pauta", "Pauta: ad libitum o racionado (nº de tomas)"),
      texto("alimentacion_premios", "Premios (tipo y cuándo se le dan)"),
    ],
  },
  {
    id: "eliminacion",
    label: "Conducta de eliminación",
    fields: [
      sino("eliminacion_calle", "Orina y defeca en la calle"),
      texto("eliminacion_calle_destacar", "Calle: aspectos a destacar"),
      texto("eliminacion_casa_donde", "Dentro de casa: dónde lo hace"),
      texto("eliminacion_casa_desde", "Dentro de casa: desde cuándo"),
      texto("eliminacion_casa_limpieza", "Dentro de casa: cómo se limpian los residuos"),
      texto("eliminacion_casa_estrategias", "Dentro de casa: estrategias que han probado"),
    ],
  },
  {
    id: "soledad",
    label: "Comportamiento cuando se queda solo",
    fields: [
      texto("soledad_tiempo", "Tiempo que se queda solo"),
      tri("soledad_vocaliza", "¿Ladra, llora y/o aúlla cuando se queda solo?"),
      tri("soledad_elimina", "¿Orina y/o defeca?"),
      tri("soledad_destroza", "¿Destroza cosas?"),
      tri("soledad_otras", "¿Hace otras cosas cuando se queda solo?"),
      texto("soledad_destacar", "Soledad: otros aspectos a destacar"),
    ],
  },
  {
    id: "actividad",
    label: "Actividad general",
    fields: [
      texto("actividad_cambios", "Cambios en el nivel de actividad / desde cuándo"),
      texto("actividad_juega", "Sigue jugando como antes"),
      texto("actividad_como_juega", "Cómo le gusta jugar"),
      texto("actividad_juguetes", "Cómo jugáis con el perro / juguetes disponibles"),
    ],
  },
  {
    id: "social_familia",
    label: "Conducta social: familia",
    fields: [
      sino("familia_agresion", "¿Os ha gruñido, enseñado los dientes o mordido?"),
      texto("familia_contextos", "Familia: contextos"),
      texto("familia_inicio", "Familia: inicio"),
      texto("familia_postura", "Familia: postura"),
      texto("familia_pide", "¿Cómo os pide las cosas?"),
      texto("familia_ignorado", "Si lo ignoráis, ¿cómo reacciona?"),
    ],
  },
  {
    id: "social_desconocidos",
    label: "Conducta social: desconocidos y visitas",
    fields: [
      sino("calle_agresion", "En la calle: ¿ha gruñido, enseñado los dientes o mordido?"),
      texto("calle_contextos", "Calle: contextos"),
      texto("calle_inicio", "Calle: inicio"),
      texto("calle_postura", "Calle: postura"),
      texto("calle_perfil", "¿Su comportamiento cambia según el perfil del desconocido?"),
      texto("calle_bicicletas", "Reacción ante bicicleta, monopatín o alguien corriendo"),
      sino("visitas_agresion", "Visitas: ¿ha gruñido, enseñado los dientes o mordido?"),
      texto("visitas_contextos", "Visitas: contextos"),
      texto("visitas_inicio", "Visitas: inicio"),
      texto("visitas_postura", "Visitas: postura"),
      tri("visitas_ladra", "Visitas: ladra"),
      tri("visitas_esconde", "Visitas: se esconde"),
      tri("visitas_atencion", "Visitas: pide atención / busca su contacto"),
      texto("visitas_otros", "Visitas: otros"),
    ],
  },
  {
    id: "otros_perros",
    label: "Conducta social: otros perros",
    fields: [
      texto("perros_machos", "Relación con machos"),
      texto("perros_machos_destacar", "Machos: aspectos a destacar (postura, inicio)"),
      texto("perros_hembras", "Relación con hembras"),
      texto("perros_hembras_destacar", "Hembras: aspectos a destacar"),
      texto("perros_tamano", "¿Depende del tamaño o la raza?"),
    ],
  },
  {
    id: "manejo",
    label: "Manejo y educación",
    fields: [
      texto("manejo_correccion", "Cómo corrigen una conducta que les molesta"),
      texto("manejo_correa_collar", "Correa y collar que utiliza"),
      tri("manejo_acuerdo", "¿Están de acuerdo en casa en lo que le dejan hacer?"),
      texto("manejo_acuerdo_destacar", "Acuerdo: aspectos a destacar"),
      texto("manejo_duerme", "Dónde duerme"),
      texto("manejo_descansa", "¿Descansa por la noche?"),
      texto("manejo_muerde_manos", "¿Suele morder las manos cuando quiere atención o jugar?"),
      texto("manejo_senales", "¿Conoce alguna señal?"),
      texto("manejo_educador", "¿Han acudido a un educador o adiestrador?"),
    ],
  },
  {
    id: "otras_conductas",
    label: "Otras conductas",
    fields: [
      tri("miedo", "¿Tiene miedo a algo?"),
      texto("miedo_reaccion", "Miedo: cómo reacciona"),
      texto("miedo_desde", "Miedo: desde cuándo"),
      tri("monta_sexual", "Monta sexual"),
      texto("monta_sexual_descripcion", "Monta sexual: descripción"),
      tri("fugas", "Fugas"),
      texto("fugas_descripcion", "Fugas: descripción"),
      tri("lame_mucho", "¿Se lame mucho?"),
      texto("lame_detalles", "Lamido: detalles"),
      texto("lame_desde", "Lamido: desde cuándo"),
      tri("persigue_cola", "¿Se persigue la cola?"),
      texto("cola_detalles", "Cola: detalles"),
      texto("cola_desde", "Cola: desde cuándo"),
      texto("conductas_repetitivas_otras", "Otras conductas repetitivas"),
    ],
  },
  {
    id: "tratamientos_previos",
    label: "Tratamientos anteriores",
    fields: [texto("tratamientos_anteriores", "Tratamientos anteriores")],
  },
  {
    id: "historial_medico",
    label: "Historial médico",
    fields: [
      texto("medico_antecedentes", "Antecedentes médicos"),
      texto("medico_tratamientos_actuales", "Tratamientos médicos actuales"),
      texto("medico_chequeos", "Chequeos médicos realizados y fecha"),
    ],
  },
] as const;

export type CatalogField = (typeof ANAMNESIS_SECTIONS)[number]["fields"][number];
export type AnswerKind = CatalogField["kind"];

/**
 * Campos de la anamnesis genérica previa a la hoja etológica. Solo se leen (D4): las filas
 * existentes siguen visibles como «Campo previo» y no se ofrecen para escribir.
 */
export const LEGACY_ANAMNESIS_FIELDS = [
  "comportamiento_problematico",
  "frecuencia",
  "duracion",
  "contexto",
  "desencadenantes",
  "cambios_recientes",
  "ambiente",
  "convivencia",
  "alimentacion",
  "actividad",
  "rutinas",
  "respuesta_tratamientos",
] as const;

export const ANSWER_VALUES = {
  sino: ["si", "no"],
  tri: ["si", "no", "a_veces"],
} as const;

export const ANSWER_LABELS = { si: "Sí", no: "No", a_veces: "A veces" } as const;

/** Tipo de respuesta por campo; todo lo que no es pregunta cerrada es `texto`. */
export const ANSWER_KIND_BY_FIELD: Record<string, AnswerKind> = Object.fromEntries(
  ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((f) => [f.id, f.kind])),
);

const LEGACY_FIELD_LABELS = {
  comportamiento_problematico: "Comportamiento problemático",
  frecuencia: "Frecuencia",
  duracion: "Duración",
  contexto: "Contexto",
  desencadenantes: "Desencadenantes",
  cambios_recientes: "Cambios recientes",
  ambiente: "Ambiente",
  convivencia: "Convivencia",
  alimentacion: "Alimentación",
  actividad: "Actividad",
  rutinas: "Rutinas",
  respuesta_tratamientos: "Respuesta a tratamientos",
} as const;

/** Campos previos a la hoja etológica (D4): se leen con su rótulo, no se ofrecen al escribir. */
export const isLegacyAnamnesisField = (field: string): boolean => field in LEGACY_FIELD_LABELS;

export const ANAMNESIS_FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((f) => [f.id, f.label])),
  ),
  ...Object.fromEntries(
    Object.entries(LEGACY_FIELD_LABELS).map(([id, label]) => [id, `Campo previo: ${label}`]),
  ),
  texto_libre: "Texto libre",
};

export const DIAGNOSTIC_TEST_LABELS = {
  exploracion_fisica: "Exploración física",
  exploracion_neurologica: "Exploración neurológica",
  analisis_sangre: "Análisis de sangre",
  urianalisis: "Urianálisis",
  coprologico: "Coprológico",
  ecografia: "Ecografía",
  radiografia: "Radiografía",
  resonancia: "Resonancia",
} as const;

/** Texto legible de una respuesta: las cerradas se muestran como Sí / No / A veces. */
export function answerText(field: string, text: string): string {
  const cerrada = (ANSWER_KIND_BY_FIELD[field] ?? "texto") !== "texto";
  return cerrada && text in ANSWER_LABELS
    ? ANSWER_LABELS[text as keyof typeof ANSWER_LABELS]
    : text;
}

/** Rótulo de un campo de anamnesis; un id desconocido se muestra tal cual en vez de fallar. */
export const fieldLabel = (field: string): string => ANAMNESIS_FIELD_LABELS[field] ?? field;

/** FR-111: una pregunta cerrada solo admite sus valores canónicos; el texto libre admite cualquiera. */
export function isValidAnswer(field: string, text: string): boolean {
  const kind = ANSWER_KIND_BY_FIELD[field];
  return !kind || kind === "texto" || (ANSWER_VALUES[kind] as readonly string[]).includes(text);
}

/** Id de la sección que contiene al campo; el texto libre y los campos previos van en `texto_libre`. */
export function sectionOf(field: string): string {
  return (
    ANAMNESIS_SECTIONS.find((section) => section.fields.some((f) => f.id === field))?.id ??
    "texto_libre"
  );
}

/** Valores que admite la respuesta cerrada de un campo, o `null` si el campo es de texto. */
export function answerOptions(field: string): { value: string; label: string }[] | null {
  const kind = ANSWER_KIND_BY_FIELD[field];
  if (!kind || kind === "texto") return null;
  return ANSWER_VALUES[kind].map((value) => ({ value, label: ANSWER_LABELS[value] }));
}
