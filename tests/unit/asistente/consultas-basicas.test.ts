import { describe, expect, test } from "bun:test";
import {
  answerAgenda,
  answerFecha,
  answerPacientesHoy,
  detectIntent,
  startOfDay,
} from "@/features/asistente/consultas-basicas";

// Hoy = lunes 26 de octubre de 2026, 10:00 hora local.
const NOW = new Date(2026, 9, 26, 10, 0);
const at = (hour: number, day = 26) => new Date(2026, 9, day, hour, 0).toISOString();

describe("detectIntent", () => {
  test.each([
    ["¿Qué día es hoy?", "fecha"],
    ["cual es la fecha de hoy", "fecha"],
    ["¿Qué eventos tengo agendados?", "agenda"],
    ["Qué tengo en la agenda", "agenda"],
    ["¿Cuáles son los pacientes de hoy?", "pacientes-hoy"],
    ["a quién atiendo hoy", "pacientes-hoy"],
  ] as const)("«%s» → %s", (question, intent) => {
    expect(detectIntent(question)).toBe(intent);
  });

  test.each([
    "¿Qué tratamiento recomiendas para la diarrea canina?",
    "¿Cuál es la dosis diaria de meloxicam?",
    "¿Qué hago si no mejora en un día?",
    "¿Eventos adversos de meloxicam?",
    "cita la fuente de la dosis",
    "¿Cuál es el protocolo de la reunión clínica de parvovirus?",
  ])("«%s» no es una consulta básica", (question) => {
    expect(detectIntent(question)).toBeNull();
  });

  test.each([
    ["¿Qué citas tengo hoy?", "agenda"],
    ["¿Tengo reuniones esta semana?", "agenda"],
    ["¿A qué fecha estamos?", "fecha"],
  ] as const)("«%s» → %s", (question, intent) => {
    expect(detectIntent(question)).toBe(intent);
  });

  test.each(["¿Dosis de meloxicam en perros?", "protocolo de ayuno prequirúrgico", ""])(
    "«%s» va a la base de conocimiento",
    (question) => {
      expect(detectIntent(question)).toBeNull();
    },
  );
});

describe("respuestas", () => {
  test("la fecha se dice en español con día de la semana", () => {
    expect(answerFecha(NOW)).toMatch(/lunes,? 26 de octubre de 2026/);
  });

  test("sin eventos, la agenda dice que no hay y por qué", () => {
    expect(answerAgenda([], NOW)).toContain("No tienes eventos agendados");
  });

  test("lista los eventos de hoy en adelante, por hora, y omite los pasados y cancelados", () => {
    const base = { uid: "x", timeZone: "America/Santiago", allDay: false } as const;
    const text = answerAgenda(
      [
        { ...base, uid: "2", title: "Cirugía", start: at(15), end: at(16), status: "confirmed" },
        { ...base, uid: "1", title: "Vacuna", start: at(11), end: at(12), status: "tentative" },
        { ...base, uid: "0", title: "Pasado", start: at(8), end: at(9), status: "confirmed" },
        { ...base, uid: "3", title: "Anulado", start: at(12), end: at(13), status: "cancelled" },
      ],
      NOW,
    );
    expect(text).not.toContain("Pasado");
    expect(text).not.toContain("Anulado");
    expect(text.indexOf("Vacuna")).toBeLessThan(text.indexOf("Cirugía"));
  });

  test("pacientes de hoy: nombres sin repetir y los de otros días fuera", () => {
    const patients = new Map([
      ["p1", "Luna"],
      ["p2", "Rocky"],
    ]);
    const text = answerPacientesHoy(
      [
        { patientId: "p1", createdAt: at(9) },
        { patientId: "p1", createdAt: at(10) },
        { patientId: "p2", createdAt: at(9, 25) },
      ],
      patients,
      NOW,
    );
    expect(text).toContain("Luna");
    expect(text).not.toContain("Rocky");
    expect(text.match(/Luna/g)).toHaveLength(1);
  });

  test("sin consultas hoy lo dice", () => {
    expect(answerPacientesHoy([], new Map(), NOW)).toContain("No hay pacientes");
  });

  test("startOfDay es medianoche local", () => {
    expect(startOfDay(NOW).getHours()).toBe(0);
    expect(startOfDay(NOW).getDate()).toBe(26);
  });
});
