import { ANAMNESIS_SECTIONS, LEGACY_ANAMNESIS_FIELDS } from "@/features/registro/anamnesis-catalog";
import {
  anamnesisContentSchema,
  diagnosisContentSchema,
  patientContentSchema,
  tutorContentSchema,
} from "@/features/registro/schema";
import { Adherence, Evolution, feedbackContentSchema } from "@/features/retroalimentacion/schema";
import { CONSULTAS_DEMO, type DemoDataset, PACIENTES_DEMO, TUTORES_DEMO } from "./datos-demo";
import { DATASET_META, FIELD_COVERAGE, traceFor } from "./metadata-demo";

/** Pura y previa a autenticación/escrituras; no requiere PDF, reloj, credenciales ni base de datos. */
export function validateDemo(
  dataset: DemoDataset = {
    tutores: TUTORES_DEMO,
    pacientes: PACIENTES_DEMO,
    consultas: CONSULTAS_DEMO,
  },
): void {
  const { tutores, pacientes, consultas } = dataset;
  function check(ok: unknown, message: string): asserts ok {
    if (!ok) throw new Error(`Dataset inválido: ${message}`);
  }
  check(Array.isArray(tutores) && tutores.length === 15, "se requieren 15 tutores");
  check(Array.isArray(pacientes) && pacientes.length === 25, "se requieren 25 pacientes");
  check(Array.isArray(consultas) && consultas.length === 8, "se requieren 8 consultas");
  const keys = new Set<string>();
  function key(value: string) {
    check(
      typeof value === "string" && /^(T\d{2}|P\d{2}|C\d{2}(?:-[ADE]\d{2})?|F\d{2})$/.test(value),
      `clave mal formada ${value}`,
    );
    check(!keys.has(value), `clave duplicada ${value}`);
    keys.add(value);
    traceFor(value);
  }
  function author(value: number, entry: string) {
    check(Number.isInteger(value) && value >= 0 && value <= 2, `${entry}: autor inválido ${value}`);
    check(
      traceFor(entry).clinicalAuthor === `V${String(value + 1).padStart(2, "0")}`,
      `${entry}: autor distinto de la trazabilidad editorial`,
    );
  }
  function schema(result: { success: boolean; error?: unknown }, entry: string) {
    check(result.success, `${entry}: esquema inválido ${String(result.error ?? "")}`);
  }
  for (const tutor of tutores) {
    key(tutor.key);
    schema(tutorContentSchema.safeParse(tutor), tutor.key);
  }
  const tutorKeys = new Set(tutores.map((tutor) => tutor.key));
  for (const patient of pacientes) {
    key(patient.key);
    check(tutorKeys.has(patient.tutorKey), `${patient.key}: tutor inexistente ${patient.tutorKey}`);
    schema(
      patientContentSchema.safeParse({ ...patient.ficha, tutorId: patient.tutorKey }),
      patient.key,
    );
    for (const field of ["birthDate", "firstVisitDate"] as const) {
      const date = patient.ficha[field];
      check(
        !date || date <= DATASET_META.referenceDate,
        `${patient.key}: ${field} futura respecto de ${DATASET_META.referenceDate}`,
      );
    }
  }
  check(
    pacientes.filter((patient) => patient.ficha.species === "canino").length === 17,
    "se requieren 17 caninos y 8 felinos",
  );
  check(
    pacientes.filter((patient) => patient.ficha.species === "felino").length === 8,
    "se requieren 8 felinos",
  );
  const patientMap = new Map(pacientes.map((patient) => [patient.key, patient]));
  const entries = new Map<string, { field: string; text: string }>();
  const feedbackKeys = new Map<string, string>();
  // Las correcciones se validan por clave, independientemente del orden del array recibido.
  for (const consultation of consultas)
    for (const feedback of consultation.feedback ?? [])
      feedbackKeys.set(feedback.key, consultation.key);
  const sections = new Set<string>();
  const values = new Set<string>();
  const adherences = new Set<string>();
  const evolutions = new Set<string>();
  let approved = 0,
    drafts = 0,
    corrections = 0,
    feedbackCount = 0,
    feedbackCorrections = 0,
    adverseEvents = 0;
  for (const consultation of consultas) {
    key(consultation.key);
    author(consultation.author, consultation.key);
    const patient = patientMap.get(consultation.paciente);
    check(patient, `${consultation.key}: paciente inexistente ${consultation.paciente}`);
    check(
      patient.ficha.species === "canino",
      `${consultation.key}: anamnesis felina fuera de alcance`,
    );
    check(
      Array.isArray(consultation.anamnesis) && consultation.anamnesis.length > 0,
      `${consultation.key}: anamnesis vacía`,
    );
    for (const entry of consultation.anamnesis) {
      key(entry.key);
      author(entry.author, entry.key);
      check(
        entry.key.startsWith(`${consultation.key}-A`),
        `${entry.key}: clave ajena a ${consultation.key}`,
      );
      check(
        !(LEGACY_ANAMNESIS_FIELDS as readonly string[]).includes(entry.field),
        `${entry.key}: campo legacy ${entry.field}`,
      );
      check(
        entry.provenance !== "recuperada",
        `${entry.key}: recuperada sin fragmento documental real`,
      );
      schema(
        anamnesisContentSchema.safeParse({ ...entry, consultationId: consultation.key }),
        entry.key,
      );
      check(
        traceFor(entry.key).clinicalProvenance === entry.provenance,
        `${entry.key}: procedencia distinta de la trazabilidad editorial`,
      );
      entries.set(entry.key, entry);
      values.add(entry.text);
      for (const section of ANAMNESIS_SECTIONS)
        if (section.fields.some((field) => field.id === entry.field)) sections.add(section.id);
    }
    if (consultation.diagnosis) {
      key(consultation.diagnosis.key);
      check(
        consultation.diagnosis.key.startsWith(`${consultation.key}-D`),
        `${consultation.diagnosis.key}: diagnóstico ajeno a ${consultation.key}`,
      );
      schema(
        diagnosisContentSchema.safeParse({
          ...consultation.diagnosis,
          consultationId: consultation.key,
        }),
        consultation.diagnosis.key,
      );
    }
    if (consultation.epicrisis) {
      key(consultation.epicrisis.key);
      author(consultation.epicrisis.author, consultation.epicrisis.key);
      check(
        consultation.epicrisis.key.startsWith(`${consultation.key}-E`),
        `${consultation.epicrisis.key}: epicrisis ajena a ${consultation.key}`,
      );
      check(
        ["approved", "draft"].includes(consultation.epicrisis.status),
        `${consultation.epicrisis.key}: estado de epicrisis inválido`,
      );
      if (consultation.epicrisis.status === "approved") {
        approved++;
        check(
          consultation.diagnosis?.plan,
          `${consultation.key}: aprobación sin diagnóstico y plan editorial`,
        );
      } else drafts++;
    }
    if (consultation.correction) {
      key(consultation.correction.key);
      author(consultation.correction.author, consultation.correction.key);
      check(
        consultation.epicrisis?.status === "approved",
        `${consultation.correction.key}: correctiva sin epicrisis aprobada`,
      );
      check(
        consultation.correction.key.startsWith(`${consultation.key}-E`),
        `${consultation.correction.key}: correctiva ajena a ${consultation.key}`,
      );
      check(
        typeof consultation.correction.observaciones === "string" &&
          consultation.correction.observaciones.trim(),
        `${consultation.correction.key}: falta motivo correctivo`,
      );
      corrections++;
    }
    check(Array.isArray(consultation.feedback), `${consultation.key}: feedback inválido`);
    for (const feedback of consultation.feedback) {
      key(feedback.key);
      author(feedback.author, feedback.key);
      schema(
        feedbackContentSchema.safeParse({ ...feedback.content, consultationId: consultation.key }),
        feedback.key,
      );
      check(
        consultation.epicrisis?.status === "approved",
        `${feedback.key}: evolución sin consulta cerrada`,
      );
      if (feedback.corrects) {
        check(
          feedback.corrects !== feedback.key &&
            feedbackKeys.get(feedback.corrects) === consultation.key,
          `${feedback.key}: original inexistente o ajeno ${feedback.corrects}`,
        );
        check(
          !consultation.feedback.find((item) => item.key === feedback.corrects)?.corrects,
          `${feedback.key}: la corrección requiere una entrada original`,
        );
        feedbackCorrections++;
      }
      feedbackCount++;
      adherences.add(feedback.content.adherence);
      evolutions.add(feedback.content.evolution);
      adverseEvents += feedback.content.adverseEvents.length;
    }
  }
  check(
    new Set(consultas.map((consultation) => consultation.paciente)).size === 6,
    "se requieren consultas de seis perros",
  );
  check(approved === 3, "se requieren tres consultas cerradas con epicrisis aprobadas");
  check(drafts === 1, "se requiere un borrador en las cinco consultas abiertas");
  check(corrections === 1, "se requiere una epicrisis correctiva adicional");
  check(
    feedbackCount === 6 && feedbackCorrections === 1,
    "se requieren seis retroalimentaciones incluida una correctiva",
  );
  check(
    Adherence.every((value) => adherences.has(value)),
    "cobertura incompleta de adherencia",
  );
  check(
    Evolution.every((value) => evolutions.has(value)),
    "cobertura incompleta de evolución",
  );
  check(adverseEvents > 0, "falta evento adverso diferenciado");
  const longitudinal = [...patientMap.keys()].filter(
    (patientKey) =>
      consultas.some((c) => c.paciente === patientKey && c.epicrisis?.status === "approved") &&
      consultas.some((c) => c.paciente === patientKey && c.epicrisis?.status !== "approved"),
  );
  check(longitudinal.length === 2, "se requieren dos historias longitudinales cerrada/abierta");
  check(
    sections.size === ANAMNESIS_SECTIONS.length && sections.size === 14,
    "cobertura incompleta de las 14 secciones",
  );
  check(
    ["si", "no", "a_veces"].every((value) => values.has(value)),
    "faltan respuestas cerradas si/no/a_veces",
  );
  const fields = ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((field) => field.id));
  check(
    Object.keys(FIELD_COVERAGE).length === fields.length + 1,
    "inventario de cobertura desactualizado",
  );
  for (const field of [...fields, "texto_libre"]) {
    const coverage = FIELD_COVERAGE[field];
    check(coverage, `campo sin clasificar: ${field}`);
    check(coverage.test, `${field}: cobertura sin prueba`);
    if (coverage.status === "covered") {
      check(coverage.keys.length > 0, `${field}: cobertura vacía`);
      for (const entryKey of coverage.keys)
        check(
          entries.get(entryKey)?.field === field,
          `${entryKey}: cobertura ausente para ${field}`,
        );
    } else {
      check(coverage.reason.trim(), `${field}: exclusión sin motivo`);
      check(
        ![...entries.values()].some((entry) => entry.field === field),
        `${field}: exclusión contradice entradas`,
      );
    }
  }
  check(
    ![...entries.values()].some((entry) => entry.field === "soledad_destroza"),
    "soledad_destroza debe conservarse sin respuesta",
  );
}
