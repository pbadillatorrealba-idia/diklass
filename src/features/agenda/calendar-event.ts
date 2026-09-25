/**
 * Evento de agenda compatible con iCalendar (RFC 5545 · design.md D17), para exportar `.ics` y
 * sincronizar con los calendarios del dispositivo sin rehacer el modelo. En este cambio la
 * agenda está vacía: aún no hay fuente de eventos.
 */
export type CalendarEvent = {
  /** `UID` de iCalendar: estable y único, p. ej. `<uuid>@diklass`. */
  uid: string;
  /** `SUMMARY`. */
  title: string;
  /** `DTSTART`/`DTEND` en ISO 8601 con desfase. */
  start: string;
  end: string;
  /** `TZID` IANA con el que se interpreta el evento, p. ej. `America/Santiago`. */
  timeZone: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  /** `RRULE` (sin el prefijo), p. ej. `FREQ=WEEKLY;COUNT=4`. */
  rrule?: string;
  location?: string;
  patientId?: string;
};
