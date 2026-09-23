import type { KnowledgeAnswer } from "@/features/conocimiento/schema";
import type {
  AnamnesisField,
  AntecedentGroup,
  PatientContent,
  Provenance,
} from "@/features/registro/schema";
import { computeMissingFichaFields } from "@/features/registro/summaries";
import { matchearTerminos } from "./deteccion";
import { REGLAS_HIPOTESIS, type ReglaHipotesis, SUGERENCIAS } from "./reglas";
import {
  DESCARGO_ASISTENCIA,
  type AnalisisHipotesis,
  type DecisionHipotesis,
  type EntradaAnamnesis,
  type HipotesisSoportada,
  type HypothesisContent,
  type InsumoAnamnesis,
  type InsumoFicha,
  type InsumosHipotesis,
  type ItemAnalisis,
  type OrigenHipotesis,
  type PapelInsumo,
  type RespaldoHipotesis,
  type RespaldoPresentado,
} from "./schema";

/**
 * Soporte al diagnóstico diferencial (D5/D6/D7 del diseño del cambio): funciones puras y
 * deterministas sobre las reglas transparentes y el contrato de respuesta de 003. Sin modelos
 * generativos ni scoring (HD1): toda afirmación clínica del respaldo es una cita verbatim y
 * todo lo derivado del sistema queda declarado en el análisis con su procedencia (FR-021).
 */

/** Mínimo de campos de anamnesis cubiertos para no declarar información insuficiente (D6 · HD7). */
export const MIN_CAMPOS_SUFICIENCIA = 3;

/** Tope de hipótesis presentadas por generación (presupuesto de rendimiento, D12 · HD7). */
export const MAX_HIPOTESIS_PRESENTADAS = 3;

const GRUPOS_ANTECEDENTES: AntecedentGroup[] = [
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
];

const AUSENCIA_A_FAVOR = "Sin antecedentes a favor registrados.";
const AUSENCIA_EN_CONTRA = "Sin antecedentes en contra registrados.";
const AUSENCIA_FALTANTE = "Sin información faltante identificada para evaluarla.";

export type Suficiencia = { estado: "insuficiente" | "suficiente"; faltantes: string[] };

/**
 * Puerta de suficiencia (FR-022 · US8-AC5, caso límite de anamnesis vacía): con menos de
 * `MIN_CAMPOS_SUFICIENCIA` campos de anamnesis cubiertos se declara la insuficiencia nombrando
 * lo que falta en lugar de proponer hipótesis débilmente fundadas. Los `faltantes` combinan
 * `computeMissingFichaFields` con los campos que nombran las sugerencias (D6).
 */
export function evaluateSuficiencia(input: {
  anamnesis: EntradaAnamnesis[];
  ficha: PatientContent | null;
}): Suficiencia {
  const cubiertos = new Set<AnamnesisField>();
  for (const entrada of input.anamnesis) {
    if (entrada.content.text.trim() !== "") {
      cubiertos.add(entrada.content.field);
    }
  }

  const faltantes = new Set<string>();
  if (input.ficha !== null) {
    for (const falta of computeMissingFichaFields(input.ficha)) {
      faltantes.add(falta.field);
    }
  }
  for (const sugerencia of SUGERENCIAS) {
    for (const campo of sugerencia.cobertura.anamnesis) {
      if (!cubiertos.has(campo)) {
        faltantes.add(campo);
      }
    }
  }

  return {
    estado: cubiertos.size >= MIN_CAMPOS_SUFICIENCIA ? "suficiente" : "insuficiente",
    faltantes: [...faltantes].sort(),
  };
}

export type MatchRegla = {
  regla: ReglaHipotesis;
  aFavor: ItemAnalisis[];
  enContra: ItemAnalisis[];
  insumos: InsumosHipotesis;
  terminosMatch: string[];
};

/**
 * Matcheo transparente de una regla (FR-009 · US8-AC1 · FR-020/US8-AC8): clasifica cada
 * insumo como `aFavor` o `enContra` conservando su referencia (`recordId`/`fichaRef`), su
 * procedencia (FR-021) y los términos que dispararon la regla. Los antecedentes de la ficha se
 * evalúan como `fichaRef` con su papel (D5).
 */
export function matchRegla(
  regla: ReglaHipotesis,
  input: { anamnesis: EntradaAnamnesis[]; ficha: PatientContent | null },
): MatchRegla {
  const aFavor: ItemAnalisis[] = [];
  const enContra: ItemAnalisis[] = [];
  const insumosAnamnesis: InsumoAnamnesis[] = [];
  const insumosFicha: InsumoFicha[] = [];
  const terminosMatch: string[] = [];
  const grupos = [
    { papel: "aFavor" as const, reglas: regla.soporte },
    { papel: "enContra" as const, reglas: regla.contra },
  ];

  const clasificar = (item: ItemAnalisis) => {
    if (item.papel === "aFavor") {
      aFavor.push(item);
    } else {
      enContra.push(item);
    }
  };

  const registrarTermino = (termino: string) => {
    if (!terminosMatch.includes(termino)) {
      terminosMatch.push(termino);
    }
  };

  for (const entrada of input.anamnesis) {
    for (const grupo of grupos) {
      for (const condicion of grupo.reglas) {
        if (condicion.campo !== entrada.content.field) {
          continue;
        }
        const match = matchearTerminos(entrada.content.text, condicion.terminos);
        if (match.length === 0) {
          continue;
        }
        match.forEach(registrarTermino);
        insumosAnamnesis.push({
          recordId: entrada.recordId,
          field: entrada.content.field,
          text: entrada.content.text,
          provenance: entrada.content.provenance,
          papel: grupo.papel,
        });
        clasificar({
          ref: entrada.recordId,
          campo: entrada.content.field,
          texto: entrada.content.text,
          provenance: entrada.content.provenance,
          papel: grupo.papel,
        });
      }
    }
  }

  if (input.ficha !== null) {
    for (const grupo of GRUPOS_ANTECEDENTES) {
      input.ficha.antecedentes[grupo].forEach((item, indice) => {
        for (const condicionGrupo of grupos) {
          for (const condicion of condicionGrupo.reglas) {
            if (condicion.campo !== "antecedentes") {
              continue;
            }
            const match = matchearTerminos(item.text, condicion.terminos);
            if (match.length === 0) {
              continue;
            }
            match.forEach(registrarTermino);
            insumosFicha.push({
              fichaRef: `antecedentes.${grupo}[${indice}]`,
              valor: item.text,
              papel: condicionGrupo.papel,
            });
            clasificar({
              ref: `antecedentes.${grupo}[${indice}]`,
              campo: "antecedentes",
              texto: item.text,
              provenance: "reportada",
              papel: condicionGrupo.papel,
            });
          }
        }
      });
    }
  }

  return {
    regla,
    aFavor,
    enContra,
    insumos: {
      anamnesis: insumosAnamnesis,
      ficha: insumosFicha,
      faltante: [],
      terminosMatch: [...terminosMatch].sort(),
    },
    terminosMatch: [...terminosMatch].sort(),
  };
}

/**
 * Candidatas del sistema (FR-009): solo reglas con al menos un antecedente a favor; se
 * presentan como máximo `MAX_HIPOTESIS_PRESENTADAS`, por número de insumos a favor y luego en
 * el orden del registro (determinista).
 */
export function evaluarReglas(input: {
  anamnesis: EntradaAnamnesis[];
  ficha: PatientContent | null;
}): MatchRegla[] {
  return REGLAS_HIPOTESIS.map((regla) => matchRegla(regla, input))
    .filter((match) => match.aFavor.length > 0)
    .sort((a, b) => b.aFavor.length - a.aFavor.length)
    .slice(0, MAX_HIPOTESIS_PRESENTADAS);
}

/**
 * Respaldo documental desde el contrato de respuesta de 003 (FR-007 · FR-023): las citas
 * documento+fragmento de sus segmentos de evidencia y sus avisos, con la ausencia de respaldo
 * siempre declarada (SC-030).
 */
export function extraerRespaldo(
  respuesta: KnowledgeAnswer | null,
  knowledgeQueryId: string | null,
): RespaldoHipotesis {
  if (respuesta === null) {
    return {
      knowledgeQueryId,
      citas: [],
      avisos: ["sin_respaldo_documental"],
      cobertura: null,
    };
  }
  const citas = respuesta.segmentos
    .filter((segmento) => segmento.kind === "evidencia")
    .map((segmento) => segmento.cita);
  const avisos = [...respuesta.avisos];
  if (citas.length === 0 && !avisos.includes("sin_respaldo_documental")) {
    avisos.push("sin_respaldo_documental");
  }
  return { knowledgeQueryId, citas, avisos, cobertura: respuesta.cobertura };
}

function analisisDesdeInsumos(insumos: InsumosHipotesis): AnalisisHipotesis {
  const itemsAnamnesis: ItemAnalisis[] = insumos.anamnesis.map((insumo) => ({
    ref: insumo.recordId,
    campo: insumo.field,
    texto: insumo.text,
    provenance: insumo.provenance,
    papel: insumo.papel,
  }));
  const itemsFicha: ItemAnalisis[] = insumos.ficha.map((insumo) => ({
    ref: insumo.fichaRef,
    campo: "antecedentes",
    texto: insumo.valor ?? "sin dato",
    provenance: "reportada" as Provenance,
    papel: insumo.papel,
  }));
  const items = [...itemsAnamnesis, ...itemsFicha];
  const aFavor = items.filter((item) => item.papel === "aFavor");
  const enContra = items.filter((item) => item.papel === "enContra");
  return {
    aFavor:
      aFavor.length > 0
        ? { items: aFavor, ausencia: null }
        : { items: [], ausencia: AUSENCIA_A_FAVOR },
    enContra:
      enContra.length > 0
        ? { items: enContra, ausencia: null }
        : { items: [], ausencia: AUSENCIA_EN_CONTRA },
    faltante:
      insumos.faltante.length > 0
        ? { campos: insumos.faltante, ausencia: null }
        : { campos: [], ausencia: AUSENCIA_FALTANTE },
  };
}

/**
 * Presentación de una hipótesis (FR-009 · SC-019 · FR-010/SC-031): las tres secciones del
 * análisis con sus ausencias explícitas, el respaldo citado con su declaración de ausencia y el
 * descargo constante. Los `insumos` viajan intactos: la presentación ES reconstruible (FR-020).
 */
export function composeHipotesisSoportada(input: {
  key: string;
  texto: string;
  origen: OrigenHipotesis;
  decision: DecisionHipotesis;
  reglaId: string | null;
  insumos: InsumosHipotesis;
  respaldo: RespaldoHipotesis;
}): HipotesisSoportada {
  const respaldo: RespaldoPresentado = {
    ...input.respaldo,
    sinRespaldo:
      input.respaldo.avisos.includes("sin_respaldo_documental") || input.respaldo.citas.length === 0,
  };
  return {
    key: input.key,
    texto: input.texto,
    origen: input.origen,
    decision: input.decision,
    reglaId: input.reglaId,
    analisis: analisisDesdeInsumos(input.insumos),
    respaldo,
    insumos: input.insumos,
    descargo: DESCARGO_ASISTENCIA,
  };
}

/**
 * Reconstrucción de una hipótesis ya registrada (US8-AC8): su contenido persistido se
 * presenta tal cual, con las referencias que la produjeron.
 */
export function presentarHipotesis(
  recordId: string,
  content: HypothesisContent,
): HipotesisSoportada {
  return composeHipotesisSoportada({ key: recordId, ...content });
}

const ESTADO_EPICRISIS: Record<DecisionHipotesis, string> = {
  added: "propuesta",
  accepted: "aceptada",
  discarded: "descartada",
};

/**
 * Hipótesis consideradas para el campo de la epicrisis (FR-049 · US8-AC6 · D7): de la marca
 * persistida al vocabulario de FR-049 («propuesta, aceptada, descartada»), en la forma
 * `[{ texto, estado }]` del campo `hipotesis` de la epicrisis de 002 (RI-1).
 */
export function composeHipotesisConsideradas(
  hipotesis: HypothesisContent[],
): { texto: string; estado: string }[] {
  return hipotesis.map((content) => ({
    texto: content.texto,
    estado: ESTADO_EPICRISIS[content.decision],
  }));
}
