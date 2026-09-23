import type { AnamnesisField } from "@/features/registro/schema";

/**
 * Registro de reglas transparentes de la asistencia (D3 y D5 del diseño del cambio, HD9).
 *
 * Son el mecanismo determinista del PoC para sugerir preguntas (FR-008) y proponer hipótesis
 * (FR-009): cada entrada declara en claro por qué se propone, qué la cubre, cuándo aplica y con
 * qué consulta se busca su fundamento documental. Los términos se comparan sin distinguir
 * mayúsculas ni acentos; los `terminosMatch` que disparan una hipótesis quedan en su
 * reconstrucción (FR-020 · US8-AC8).
 */

/** Campo evaluado por una regla: un campo de anamnesis o los antecedentes de la ficha. */
export type CampoRegla = AnamnesisField | "antecedentes";

export type SugerenciaRegla = {
  key: string;
  pregunta: string;
  /** Campos que relaciona la sugerencia (para la interfaz y la decisión registrada). */
  camposRelacionados: string[];
  /** Cubierta cuando un campo de anamnesis tiene texto o la ficha tiene el grupo registrado. */
  cobertura: { anamnesis: AnamnesisField[]; ficha: string[] };
  /** Cobertura por contenido: alguno de estos términos en algún texto de la anamnesis. */
  terminosCobertura: string[];
  /** Solo se propone si algún término aplica (null: siempre pertinente cuando falta). */
  soloSi: { campos: AnamnesisField[]; terminos: string[] } | null;
  /** Consulta de recuperación del fundamento documental (null: criterio general sin intento). */
  fundamento: { query: string } | null;
};

/**
 * Preguntas sugeridas ante información faltante (FR-008 · FR-033 · US7). El conjunto es
 * acotado y sintético (HD8): se ajusta con la evaluación del panel (SC-017) sin tocar el
 * contrato.
 */
export const SUGERENCIAS: readonly SugerenciaRegla[] = [
  {
    key: "aloneContext",
    pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo, o también en presencia del tutor?",
    camposRelacionados: ["contexto"],
    cobertura: { anamnesis: ["contexto"], ficha: [] },
    terminosCobertura: ["queda solo", "en ausencia del tutor", "cuando se queda solo"],
    soloSi: null,
    fundamento: { query: "protocolo ansiedad por separación conducta en ausencia del tutor" },
  },
  {
    key: "behaviorProblem",
    pregunta: "¿Cuál es el comportamiento problemático y en qué se manifiesta?",
    camposRelacionados: ["motivo_consulta", "comportamiento_problematico"],
    cobertura: { anamnesis: ["motivo_consulta", "comportamiento_problematico"], ficha: [] },
    terminosCobertura: [],
    soloSi: {
      campos: ["motivo_consulta", "texto_libre"],
      terminos: ["conducta", "comportamiento", "problema"],
    },
    fundamento: null,
  },
  {
    key: "frequency",
    pregunta: "¿Con qué frecuencia ocurre el comportamiento problemático?",
    camposRelacionados: ["frecuencia"],
    cobertura: { anamnesis: ["frecuencia"], ficha: [] },
    terminosCobertura: [],
    soloSi: {
      campos: ["motivo_consulta", "comportamiento_problematico", "texto_libre"],
      terminos: ["conducta", "comportamiento", "problema"],
    },
    fundamento: null,
  },
  {
    key: "duration",
    pregunta: "¿Desde cuándo se observa el comportamiento?",
    camposRelacionados: ["duracion"],
    cobertura: { anamnesis: ["duracion"], ficha: [] },
    terminosCobertura: [],
    soloSi: {
      campos: ["motivo_consulta", "comportamiento_problematico", "texto_libre"],
      terminos: ["conducta", "comportamiento", "problema"],
    },
    fundamento: { query: "evolución temporal conductas problema anamnesis etología" },
  },
  {
    key: "triggers",
    pregunta: "¿Hay desencadenantes o contextos que disparan el comportamiento?",
    camposRelacionados: ["desencadenantes"],
    cobertura: { anamnesis: ["desencadenantes"], ficha: [] },
    terminosCobertura: [],
    soloSi: {
      campos: ["motivo_consulta", "comportamiento_problematico", "texto_libre"],
      terminos: ["conducta", "comportamiento", "problema"],
    },
    fundamento: { query: "desencadenantes conducta problema etología canina" },
  },
  {
    key: "previousTreatments",
    pregunta:
      "¿Se ha ensayado algún tratamiento o modificación de conducta previa? ¿Con qué respuesta?",
    camposRelacionados: ["tratamientos_anteriores", "respuesta_tratamientos"],
    cobertura: { anamnesis: ["tratamientos_anteriores", "respuesta_tratamientos"], ficha: [] },
    terminosCobertura: [],
    soloSi: {
      campos: ["motivo_consulta", "comportamiento_problematico", "texto_libre"],
      terminos: ["conducta", "comportamiento", "problema"],
    },
    fundamento: { query: "tratamientos previos modificación de conducta respuesta clínica" },
  },
  {
    key: "currentMedications",
    pregunta: "¿Recibe medicación actualmente? Regístrala en la ficha si la hay.",
    camposRelacionados: ["currentMedications"],
    cobertura: { anamnesis: [], ficha: ["currentMedications"] },
    terminosCobertura: [],
    soloSi: null,
    fundamento: { query: "interacciones medicación conducta canina" },
  },
  {
    key: "knownAllergies",
    pregunta: "¿Tiene alergias conocidas? Regístralas en la ficha.",
    camposRelacionados: ["knownAllergies"],
    cobertura: { anamnesis: [], ficha: ["knownAllergies"] },
    terminosCobertura: [],
    soloSi: null,
    fundamento: null,
  },
];

export type ReglaHipotesis = {
  id: string;
  hipotesis: string;
  /** Pregunta documental con la que se busca el respaldo (contrato de 003, D5). */
  consultaRecuperacion: string;
  soporte: { campo: CampoRegla; terminos: string[] }[];
  contra: { campo: CampoRegla; terminos: string[] }[];
  /** Campos de anamnesis que discriminarían la hipótesis: la «información faltante» (US8-AC1). */
  discriminatorios: AnamnesisField[];
};

/**
 * Reglas de candidaturas diagnósticas (FR-009 · US8-AC1). A favor/en contra se derivan del
 * matcheo de términos sobre la anamnesis y los antecedentes de la ficha; una regla con
 * insumos en ambas ramas se presenta como contradictoria (caso límite de la spec).
 */
export const REGLAS_HIPOTESIS: readonly ReglaHipotesis[] = [
  {
    id: "separationAnxiety",
    hipotesis: "Ansiedad por separación",
    consultaRecuperacion: "ansiedad por separación perros protocolo diagnóstico",
    soporte: [
      {
        campo: "contexto",
        terminos: ["queda solo", "se queda solo", "solo", "ausencia del tutor", "ausente"],
      },
      {
        campo: "comportamiento_problematico",
        terminos: ["destroz", "ladra", "orina", "vocaliza"],
      },
      { campo: "desencadenantes", terminos: ["se va", "ausencia", "solo", "salida del tutor"] },
      { campo: "antecedentes", terminos: ["separación", "queda solo"] },
    ],
    contra: [
      {
        campo: "contexto",
        terminos: ["acompañado", "presencia del tutor", "siempre", "también en presencia"],
      },
      { campo: "antecedentes", terminos: ["acompañado"] },
    ],
    discriminatorios: ["frecuencia", "duracion", "tratamientos_anteriores", "respuesta_tratamientos"],
  },
  {
    id: "noisePhobia",
    hipotesis: "Miedo o fobia a ruidos",
    consultaRecuperacion: "miedo a ruidos tormentas perros protocolo conducta",
    soporte: [
      {
        campo: "desencadenantes",
        terminos: ["ruido", "tormenta", "trueno", "fuegos", "petardo", "truenos"],
      },
      { campo: "comportamiento_problematico", terminos: ["tembla", "esconde", "escape", "huye"] },
      { campo: "antecedentes", terminos: ["ruido", "tormenta"] },
    ],
    contra: [{ campo: "desencadenantes", terminos: ["sin ruidos"] }],
    discriminatorios: ["frecuencia", "duracion", "ambiente"],
  },
  {
    id: "territorialAggression",
    hipotesis: "Agresividad territorial o hacia extraños",
    consultaRecuperacion: "agresividad territorial perros protocolo diagnóstico diferencial",
    soporte: [
      { campo: "comportamiento_problematico", terminos: ["muerde", "mordisca", "agrede", "ladr"] },
      { campo: "contexto", terminos: ["visita", "extrañ", "territorio", "cerca de casa", "puerta"] },
      { campo: "antecedentes", terminos: ["agresividad", "territorial"] },
    ],
    contra: [{ campo: "contexto", terminos: ["sin visitas", "no territorial"] }],
    discriminatorios: ["convivencia", "frecuencia", "tratamientos_anteriores"],
  },
];
