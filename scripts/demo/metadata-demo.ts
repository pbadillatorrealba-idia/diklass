import { sectionOf } from "@/features/registro/anamnesis-catalog";
import type { Provenance } from "@/features/registro/schema";
import { CONSULTAS_DEMO, PACIENTES_DEMO, TUTORES_DEMO } from "./datos-demo";

/** Hashes históricos de la inspección inicial; no se abren ni verifican los PDF. */
export const DATASET_META = {
  datasetId: "diklass-clinica-demo",
  version: "1.0.0",
  referenceDate: "2026-10-27",
  synthetic: true,
  revisiones: [
    {
      id: "EDITORIAL-CL-01",
      date: "2026-10-27",
      reason: "Elenco y guiones aprobados para implementación; aceptación clínica pendiente",
      requirements: ["FR-128", "FR-129", "FR-130"],
      editorialReview: "Aprobación del usuario en PR #81",
      clinicalReview: "pendiente",
      gitRevision: "commit que contiene esta versión (registrado al cargar)",
    },
  ],
  fuentes: [
    {
      id: "DOC-CAN",
      path: "data/docs/Hªclinica canina nueva.pdf",
      sha256: "8920caf141b1d567230498e83c88442642617e619061ff4e71f36e44257c6df5",
      pages: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11],
      section: "Ficha y consulta canina",
      use: "estructura; nunca evidencia de diagnóstico, dosis o resultado",
      historical: true,
    },
    {
      id: "DOC-FEL",
      path: "data/docs/Hªclinica felina nueva.pdf",
      sha256: "4f36bf4a39435f266efbd82a99a4b91d2cae892300a4f2658b11aeafcd7981c0",
      pages: [1],
      section: "Identificación felina",
      use: "estructura administrativa; sin anamnesis felina",
      historical: true,
    },
    {
      id: "EDITORIAL-CL-01",
      path: "openspec/changes/dataset-clinico-trazable/dataset.md",
      sha256: null,
      pages: [],
      section: "Households, Patients, Consultations y Feedback",
      use: "contenido inventado; revisión Git del commit que lo contiene",
      historical: false,
    },
  ],
};
export type FieldCoverage =
  | { status: "covered"; keys: string[]; test: string }
  | { status: "excluded"; reason: string; test: string };
const test = "tests/unit/scripts/datos-demo.test.ts";
/** Inventario explícito: una pregunta nueva exige una decisión editorial, nunca una exclusión automática. */
export const FIELD_COVERAGE: Record<string, FieldCoverage> = {
  motivo_consulta: {
    status: "covered",
    keys: ["C01-A01", "C02-A01", "C03-A01", "C04-A01", "C05-A01", "C06-A01", "C07-A01", "C08-A01"],
    test,
  },
  otros_problemas: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  historia_problema: {
    status: "covered",
    keys: ["C01-A02", "C02-A02", "C03-A02", "C04-A02", "C05-A02"],
    test,
  },
  vivienda_tipo: { status: "covered", keys: ["C01-A03", "C04-A03"], test },
  vivienda_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  contacto_familia: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_adultos: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_ninos: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_otros_animales: {
    status: "covered",
    keys: ["C01-A04", "C03-A04", "C04-A04", "C06-A06", "C07-A05"],
    test,
  },
  rutina_paseos: { status: "covered", keys: ["C01-A05", "C07-A02"], test },
  rutina_comida: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  alimentacion_dieta: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  alimentacion_pauta: { status: "covered", keys: ["C01-A06"], test },
  alimentacion_premios: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  eliminacion_calle: { status: "covered", keys: ["C01-A07"], test },
  eliminacion_calle_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  eliminacion_casa_donde: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  eliminacion_casa_desde: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  eliminacion_casa_limpieza: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  eliminacion_casa_estrategias: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  soledad_tiempo: { status: "covered", keys: ["C01-A08"], test },
  soledad_vocaliza: { status: "covered", keys: ["C01-A09"], test },
  soledad_elimina: { status: "covered", keys: ["C01-A10"], test },
  soledad_destroza: {
    status: "excluded",
    reason: "Deliberadamente sin respuesta: mover la puerta no demuestra destrucción",
    test,
  },
  soledad_otras: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  soledad_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  actividad_cambios: { status: "covered", keys: ["C08-A02"], test },
  actividad_juega: { status: "covered", keys: ["C01-A11"], test },
  actividad_como_juega: { status: "covered", keys: ["C07-A03"], test },
  actividad_juguetes: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_agresion: { status: "covered", keys: ["C01-A12", "C03-A05"], test },
  familia_contextos: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_inicio: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_postura: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_pide: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  familia_ignorado: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_agresion: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_contextos: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_inicio: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_postura: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_perfil: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  calle_bicicletas: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  visitas_agresion: { status: "covered", keys: ["C06-A02"], test },
  visitas_contextos: { status: "covered", keys: ["C06-A03"], test },
  visitas_inicio: { status: "covered", keys: ["C06-A04"], test },
  visitas_postura: { status: "covered", keys: ["C06-A05"], test },
  visitas_ladra: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  visitas_esconde: { status: "covered", keys: ["C01-A13"], test },
  visitas_atencion: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  visitas_otros: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  perros_machos: { status: "covered", keys: ["C01-A14", "C03-A03"], test },
  perros_machos_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  perros_hembras: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  perros_hembras_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  perros_tamano: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_correccion: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_correa_collar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_acuerdo: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_acuerdo_destacar: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_duerme: { status: "covered", keys: ["C01-A15", "C04-A07"], test },
  manejo_descansa: { status: "covered", keys: ["C07-A04"], test },
  manejo_muerde_manos: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_senales: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  manejo_educador: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  miedo: { status: "covered", keys: ["C01-A16", "C04-A05"], test },
  miedo_reaccion: { status: "covered", keys: ["C01-A17", "C04-A06"], test },
  miedo_desde: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  monta_sexual: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  monta_sexual_descripcion: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  fugas: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  fugas_descripcion: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  lame_mucho: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  lame_detalles: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  lame_desde: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  persigue_cola: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  cola_detalles: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  cola_desde: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  conductas_repetitivas_otras: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  tratamientos_anteriores: { status: "covered", keys: ["C01-A18"], test },
  medico_antecedentes: { status: "covered", keys: ["C01-A19", "C08-A03"], test },
  medico_tratamientos_actuales: {
    status: "excluded",
    reason:
      "Fuera del guion acotado; no hay información editorial suficiente, se conserva sin dato",
    test,
  },
  medico_chequeos: { status: "covered", keys: ["C08-A04"], test },
  texto_libre: {
    status: "covered",
    keys: ["C01-A20", "C02-A03", "C03-A06", "C05-A03", "C07-A06"],
    test,
  },
};
export type DemoTrace = {
  key: string;
  caseKey: string;
  field: string | null;
  editorialAuthor: string;
  clinicalAuthor: string;
  clinicalProvenance: Provenance | null;
  sources: { id: string; pages: number[]; section: string; use: "estructura" | "editorial" }[];
  requirements: string[];
  scenarios: string[];
  criteria: string[];
  test: string;
};
const sectionPages: Record<string, number[]> = {
  motivo: [2, 3],
  entorno: [2],
  rutina: [2],
  alimentacion: [5],
  eliminacion: [5],
  soledad: [5],
  actividad: [5],
  social_familia: [6],
  social_desconocidos: [6],
  otros_perros: [7],
  manejo: [7],
  otras_conductas: [7, 8],
  tratamientos_previos: [8],
  historial_medico: [8],
};
const traces = new Map<string, DemoTrace>();
function add(
  key: string,
  caseKey: string,
  author: number,
  field: string | null,
  provenance: Provenance | null,
  document: string | null,
  pages: number[],
  section: string,
  requirements: string[],
  scenarios: string[],
) {
  traces.set(key, {
    key,
    caseKey,
    field,
    editorialAuthor: "EDITORIAL-CL-01",
    clinicalAuthor: `V${String(author + 1).padStart(2, "0")}`,
    clinicalProvenance: provenance,
    sources: [
      { id: "EDITORIAL-CL-01", pages: [], section: "Relato inventado", use: "editorial" },
      ...(document ? [{ id: document, pages, section, use: "estructura" as const }] : []),
    ],
    requirements: ["FR-129", ...requirements],
    scenarios,
    criteria: ["SC-024"],
    test,
  });
}
for (const tutor of TUTORES_DEMO)
  add(
    tutor.key,
    tutor.key,
    0,
    null,
    null,
    "DOC-CAN",
    [1],
    "Identificación de tutor",
    ["FR-027", "FR-128"],
    ["US20-AC1", "US20-AC3"],
  );
for (const patient of PACIENTES_DEMO)
  add(
    patient.key,
    patient.key,
    0,
    null,
    null,
    patient.ficha.species === "felino" ? "DOC-FEL" : "DOC-CAN",
    [1],
    "Identificación de paciente",
    ["FR-001", "FR-128"],
    ["US20-AC1", "US20-AC4"],
  );
for (const consultation of CONSULTAS_DEMO) {
  add(
    consultation.key,
    consultation.key,
    consultation.author,
    null,
    null,
    "DOC-CAN",
    [2],
    "Consulta",
    ["FR-130", "FR-063"],
    ["US20-AC3", "US20-AC5"],
  );
  for (const entry of consultation.anamnesis) {
    const section = sectionOf(entry.field);
    add(
      entry.key,
      consultation.key,
      entry.author,
      entry.field,
      entry.provenance,
      entry.field === "texto_libre" ? null : "DOC-CAN",
      sectionPages[section] ?? [],
      section,
      ["FR-004", "FR-021", "FR-111", "FR-130"],
      ["US20-AC3", "US20-AC6"],
    );
  }
  for (const entry of [consultation.diagnosis, consultation.epicrisis, consultation.correction]) {
    if (entry)
      add(
        entry.key,
        consultation.key,
        "author" in entry ? entry.author : consultation.author,
        null,
        null,
        entry === consultation.diagnosis ? "DOC-CAN" : null,
        entry === consultation.diagnosis ? [8, 9, 10] : [],
        entry === consultation.diagnosis ? "Plan editorial" : "Epicrisis editorial simulada",
        ["FR-010", "FR-024", "FR-112", "FR-130"],
        ["US20-AC3", "US20-AC5"],
      );
  }
  for (const entry of consultation.feedback)
    add(
      entry.key,
      consultation.key,
      entry.author,
      null,
      "reportada",
      "DOC-CAN",
      [11],
      "Seguimiento",
      ["FR-018", "FR-024", "FR-040", "FR-041", "FR-130"],
      ["US20-AC3", "US20-AC5"],
    );
}
export function traceFor(key: string): DemoTrace {
  const trace = traces.get(key);
  if (!trace) throw new Error(`Trazabilidad ausente para ${key}`);
  return trace;
}
