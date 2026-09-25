import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthCalendar, toMarkedDates } from "@/components/calendar/month-calendar";
import type { CalendarEvent } from "@/features/agenda/calendar-event";

const evento = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  uid: "evento-1@diklass",
  title: "Control de Luna",
  start: "2026-09-28T10:00:00-03:00",
  end: "2026-09-28T10:30:00-03:00",
  timeZone: "America/Santiago",
  allDay: false,
  status: "confirmed",
  ...overrides,
});

// sistema-visual FR-094 · design.md D17.
describe("toMarkedDates", () => {
  test("sin eventos no marca nada", () => {
    expect(toMarkedDates([], "America/Santiago")).toEqual({});
  });

  test("marca el día local del inicio, ignora cancelados y agrupa por día", () => {
    const marked = toMarkedDates(
      [
        evento({}),
        evento({ uid: "2", start: "2026-09-28T23:30:00-03:00", end: "2026-09-29T00:30:00-03:00" }),
        evento({ uid: "3", start: "2026-09-30T09:00:00-03:00", status: "cancelled" }),
      ],
      "America/Santiago",
    );
    expect(Object.keys(marked)).toEqual(["2026-09-28"]);
    expect(marked["2026-09-28"]?.marked).toBe(true);
  });
});

describe("MonthCalendar", () => {
  const html = renderToStaticMarkup(<MonthCalendar events={[]} today="2026-09-25" />);

  test("muestra el mes en español", () => {
    expect(html).toContain("septiembre de 2026");
  });

  test("la semana empieza el lunes", () => {
    expect(html.indexOf(">lun<")).toBeGreaterThan(-1);
    expect(html.indexOf(">lun<")).toBeLessThan(html.indexOf(">dom<"));
  });

  test("sin eventos muestra el estado vacío, sin datos de ejemplo", () => {
    expect(html).toContain("Sin eventos agendados");
  });

  test("las flechas tienen nombre accesible", () => {
    expect(html).toContain("Mes anterior");
    expect(html).toContain("Mes siguiente");
  });

  // Revisión de la PR #38 (WCAG 4.1.2): sin acción por día, los días son texto, no botones.
  test("los únicos botones son las flechas de mes", () => {
    const botones = html.match(/role="button"/g) ?? [];
    expect(botones).toHaveLength(2);
    expect(html).toContain(">28<");
  });

  test("hoy se distingue con anillo y negrita, no solo con color", () => {
    const hoy = html.match(/<div[^>]*data-testid="calendar-today"[^>]*>/)?.[0] ?? "";
    expect(hoy).toContain("border-2");
    expect(html).toMatch(/data-testid="calendar-today"[\s\S]*?font-bold/);
  });
});
