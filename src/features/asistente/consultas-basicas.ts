import type { CalendarEvent } from "@/features/agenda/calendar-event";

/**
 * Consultas básicas del hilo «Asistente»: reglas deterministas sobre la fecha, la agenda y las
 * consultas del día. No es un agente: no interpreta, no escribe y lo que no reconoce va a la base
 * de conocimiento. ponytail: coincidencia por palabras; un agente real (cambio futuro) la reemplaza.
 */
export type BasicIntent = "fecha" | "agenda" | "pacientes-hoy";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export function detectIntent(question: string): BasicIntent | null {
  const q = normalize(question);
  if (/pacientes?\b.*\bhoy|(a quien|quienes?)\b.*\b(atiend|veo|vemos)/.test(q)) {
    return "pacientes-hoy";
  }
  // Con límite de palabra y forma de pregunta: «eventos adversos», «cita la fuente» o «dosis diaria»
  // son preguntas clínicas y van a la base de conocimiento.
  if (
    /\bagenda\b|\b(eventos?|citas?|reuniones?)\b.*\b(tengo|hay|agendad[oa]s?|proximos?)\b|\b(tengo|hay|mis|proximos?)\b.*\b(eventos?|citas?|reuniones?)\b/.test(
      q,
    )
  ) {
    return "agenda";
  }
  if (
    /\bque dia (es|sera|estamos)\b|\bcual es la fecha\b|\ba que fecha\b|\bfecha de hoy\b|\bdia es hoy\b/.test(
      q,
    )
  ) {
    return "fecha";
  }
  return null;
}

export const startOfDay = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export function answerFecha(now: Date): string {
  const date = new Intl.DateTimeFormat("es-CL", { dateStyle: "full" }).format(now);
  return `Hoy es ${date}.`;
}

const hour = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Eventos de hoy en adelante que no están cancelados, por hora de inicio. */
export function answerAgenda(events: readonly CalendarEvent[], now: Date): string {
  const next = events
    .filter((event) => event.status !== "cancelled" && new Date(event.end) >= now)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (next.length === 0) {
    return "No tienes eventos agendados. La agenda aún no tiene una fuente de eventos.";
  }
  return [
    "Tus próximos eventos:",
    ...next.map((event) => {
      const start = new Date(event.start);
      const when = sameDay(start, now) ? "hoy" : start.toLocaleDateString("es-CL");
      return `• ${when} ${event.allDay ? "todo el día" : hour(event.start)} · ${event.title}`;
    }),
  ].join("\n");
}

/** Pacientes con una consulta abierta hoy (la agenda aún no existe: «hoy» son las consultas). */
export function answerPacientesHoy(
  consultations: ReadonlyArray<{ patientId: string; createdAt: string }>,
  patientNames: ReadonlyMap<string, string>,
  now: Date,
): string {
  const names = new Set<string>();
  for (const { patientId, createdAt } of consultations) {
    if (sameDay(new Date(createdAt), now)) names.add(patientNames.get(patientId) ?? "Paciente");
  }
  if (names.size === 0) return "No hay pacientes con consulta registrada hoy.";
  return ["Pacientes con consulta hoy:", ...[...names].map((name) => `• ${name}`)].join("\n");
}
