import type { CalendarEvent } from "@/features/agenda/calendar-event";

const NO_EVENTS: readonly CalendarEvent[] = [];

/** Eventos de la agenda. Aún no hay fuente (FR-094): siempre vacía; aquí se conectará la real. */
export function useAgendaEvents(): readonly CalendarEvent[] {
  return NO_EVENTS;
}
