import { describe, expect, test } from "bun:test";
import { CONSULTAS_DEMO, PACIENTES_DEMO, TUTORES_DEMO } from "../../../scripts/demo/datos-demo";

describe("dataset clínico trazable", () => {
  test("las consultas de seguimiento resuelven claves estables de seis perros", () => {
    expect(TUTORES_DEMO).toHaveLength(15);
    expect(PACIENTES_DEMO).toHaveLength(25);
    expect(CONSULTAS_DEMO).toHaveLength(8);
    expect(new Set(CONSULTAS_DEMO.map((consulta) => consulta.paciente)).size).toBe(6);
    expect(CONSULTAS_DEMO.map((consulta) => consulta.paciente)).toEqual([
      "P01",
      "P01",
      "P04",
      "P07",
      "P07",
      "P15",
      "P18",
      "P24",
    ]);
  });
});

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Fixture de prueba incompleto");
  return value;
}

const clone = () =>
  structuredClone({ tutores: TUTORES_DEMO, pacientes: PACIENTES_DEMO, consultas: CONSULTAS_DEMO });

test("prevalidación acepta homónimos y reordenamiento sin alterar relaciones", async () => {
  const { validateDemo } = await import("../../../scripts/demo/validar-demo");
  const dataset = clone();
  present(dataset.pacientes[0]).ficha.name = "Pepa";
  dataset.pacientes.reverse();
  dataset.tutores.reverse();
  dataset.consultas.reverse();
  expect(() => validateDemo(dataset)).not.toThrow();
});

test("prevalidación identifica claves duplicadas y referencias rotas", async () => {
  const { validateDemo } = await import("../../../scripts/demo/validar-demo");
  const duplicated = clone();
  present(duplicated.pacientes[1]).key = "P01";
  expect(() => validateDemo(duplicated)).toThrow(/P01/);
  const broken = clone();
  present(broken.consultas[0]).paciente = "P99";
  expect(() => validateDemo(broken)).toThrow(/C01.*P99/);
  const tutor = clone();
  present(tutor.pacientes[0]).tutorKey = "T99";
  expect(() => validateDemo(tutor)).toThrow(/P01.*T99/);
});

test("prevalidación rechaza fechas futuras, respuestas inválidas y consultas felinas", async () => {
  const { validateDemo } = await import("../../../scripts/demo/validar-demo");
  const future = clone();
  present(future.pacientes[0]).ficha.birthDate = "2026-10-28";
  expect(() => validateDemo(future)).toThrow(/P01.*birthDate/);
  const answer = clone();
  present(present(answer.consultas[0]).anamnesis[8]).text = "quizás";
  expect(() => validateDemo(answer)).toThrow(/C01-A09/);
  const cat = clone();
  present(cat.consultas[0]).paciente = "P03";
  expect(() => validateDemo(cat)).toThrow(/C01.*felin/);
});

test("prevalidación protege composición, estados y categorías de evolución", async () => {
  const { validateDemo } = await import("../../../scripts/demo/validar-demo");
  expect(() => validateDemo()).not.toThrow();
  const status = clone();
  present(present(status.consultas[0]).epicrisis).status = "draft";
  expect(() => validateDemo(status)).toThrow(/cerrada|aprobada/);
  const feedback = clone();
  present(present(feedback.consultas[0]).feedback[0]).content.adherence = "completa";
  present(present(feedback.consultas[3]).feedback[1]).content.adherence = "completa";
  expect(() => validateDemo(feedback)).toThrow(/adherencia/);
  const correction = clone();
  present(present(correction.consultas[7]).feedback[1]).corrects = "F99";
  expect(() => validateDemo(correction)).toThrow(/F06.*F99/);
  const count = clone();
  count.tutores.pop();
  expect(() => validateDemo(count)).toThrow(/15 tutores/);
});

test("cada campo tiene cobertura explícita y cada entrada conserva origen editorial separado", async () => {
  const { DATASET_META, FIELD_COVERAGE, traceFor } = await import(
    "../../../scripts/demo/metadata-demo"
  );
  const { ANAMNESIS_SECTIONS } = await import("../../../src/features/registro/anamnesis-catalog");
  expect(DATASET_META.synthetic).toBe(true);
  expect(DATASET_META.fuentes.find((source) => source.id === "DOC-CAN")?.sha256).toBe(
    "8920caf141b1d567230498e83c88442642617e619061ff4e71f36e44257c6df5",
  );
  const ids = ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((field) => field.id));
  expect(Object.keys(FIELD_COVERAGE).sort()).toEqual([...ids, "texto_libre"].sort());
  expect(FIELD_COVERAGE.soledad_destroza).toMatchObject({ status: "excluded" });
  const keys = [...TUTORES_DEMO, ...PACIENTES_DEMO, ...CONSULTAS_DEMO].map((item) => item.key);
  for (const consultation of CONSULTAS_DEMO) {
    keys.push(
      ...consultation.anamnesis.map((item) => item.key),
      ...consultation.feedback.map((item) => item.key),
    );
    for (const item of [consultation.diagnosis, consultation.epicrisis, consultation.correction])
      if (item) keys.push(item.key);
  }
  for (const key of keys) {
    const trace = traceFor(key);
    expect(trace.editorialAuthor).toBe("EDITORIAL-CL-01");
    expect(trace.requirements.length).toBeGreaterThan(0);
    expect(trace.scenarios.length).toBeGreaterThan(0);
    expect(trace.test).toBe("tests/unit/scripts/datos-demo.test.ts");
  }
  expect(traceFor("C01-A09")).toMatchObject({
    caseKey: "C01",
    field: "soledad_vocaliza",
    clinicalProvenance: "reportada",
    clinicalAuthor: "V01",
  });
  expect(() => traceFor("NO-EXISTE")).toThrow(/NO-EXISTE/);
});

test("prevalidación conserva atribución y procedencia del guion trazado", async () => {
  const { validateDemo } = await import("../../../scripts/demo/validar-demo");
  const author = clone();
  present(present(author.consultas[0]).anamnesis[19]).author = 0;
  expect(() => validateDemo(author)).toThrow(/C01-A20.*autor/);
  const provenance = clone();
  present(present(provenance.consultas[0]).anamnesis[19]).provenance = "reportada";
  expect(() => validateDemo(provenance)).toThrow(/C01-A20.*procedencia/);
});

test("la ausencia de observación conserva procedencia desconocida sin inventar evidencia documental", () => {
  const entries = CONSULTAS_DEMO.flatMap((consultation) => consultation.anamnesis);
  expect(entries.some((entry) => entry.provenance === "desconocida")).toBe(true);
  expect(entries.some((entry) => entry.provenance === "recuperada")).toBe(false);
});
