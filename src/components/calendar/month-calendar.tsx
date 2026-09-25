import { useMemo, useState } from "react";
import { View } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { CalendarEvent } from "@/features/agenda/calendar-event";
import { useThemeColors } from "@/theme/use-theme-colors";

LocaleConfig.locales.es = {
  monthNames: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  monthNamesShort: [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sept",
    "oct",
    "nov",
    "dic",
  ],
  dayNames: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  dayNamesShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  today: "hoy",
};
LocaleConfig.defaultLocale = "es";

const FONT = "Atkinson Hyperlegible Next";

/** Día local `YYYY-MM-DD` en la zona del evento. */
function localDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

/** Traduce eventos a las marcas de `react-native-calendars`; los cancelados no cuentan. */
export function toMarkedDates(events: CalendarEvent[], timeZone: string) {
  const marked: Record<string, { marked: true }> = {};
  for (const event of events) {
    if (event.status === "cancelled") continue;
    marked[localDay(event.start, event.timeZone || timeZone)] = { marked: true };
  }
  return marked;
}

// Lunes primero (`firstDay={1}`).
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((day) => LocaleConfig.locales.es.dayNamesShort[day]);

/**
 * Sustituye la cabecera del paquete: en web su `accessibilityRole="adjustable"` se convierte en
 * un `slider` sin nombre (axe `aria-input-field-name`). El título y las flechas ya son propios.
 */
function WeekdayHeader() {
  return (
    <View className="flex-row pb-2">
      {WEEKDAYS.map((day) => (
        <Text className="flex-1 text-center" key={day} tone="muted" variant="caption">
          {day}
        </Text>
      ))}
    </View>
  );
}

function shiftMonth(month: string, delta: number) {
  const [year = 0, index = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

export type MonthCalendarProps = {
  events: CalendarEvent[];
  /** `YYYY-MM-DD`; por defecto, hoy en la zona del dispositivo. */
  today?: string;
};

/**
 * Calendario mensual de Inicio (FR-094). Envuelve `react-native-calendars` para que el resto de
 * la app no dependa del paquete. La cabecera y las flechas son propias, para dar nombres
 * accesibles y usar la tipografía del sistema visual. Hoy se marca con peso y anillo, y los días
 * con eventos con fondo y subrayado: nunca solo con el color.
 */
export function MonthCalendar({ events, today }: MonthCalendarProps) {
  const colors = useThemeColors();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayKey = today ?? localDay(new Date().toISOString(), timeZone);
  const [month, setMonth] = useState(`${todayKey.slice(0, 7)}-01`);

  const markedDates = useMemo(() => {
    const styles: Record<string, { customStyles: object }> = {};
    for (const day of Object.keys(toMarkedDates(events, timeZone))) {
      styles[day] = {
        customStyles: {
          container: { backgroundColor: colors["primary-surface"] },
          text: { textDecorationLine: "underline" },
        },
      };
    }
    styles[todayKey] = {
      customStyles: {
        container: { borderColor: colors.primary, borderWidth: 2 },
        text: { color: colors.foreground, fontWeight: "700" },
      },
    };
    return styles;
  }, [colors, events, timeZone, todayKey]);

  const [year = "", monthIndex = "1"] = month.split("-");
  const title = `${LocaleConfig.locales.es.monthNames[Number(monthIndex) - 1]} de ${year}`;

  return (
    <View className="gap-3" testID="month-calendar">
      <View className="flex-row items-center justify-between">
        <Heading accessibilityLiveRegion="polite" level={3}>
          {title}
        </Heading>
        <View className="flex-row gap-2">
          <Button
            accessibilityLabel="Mes anterior"
            className="min-w-touch px-3"
            onPress={() => setMonth(shiftMonth(month, -1))}
            testID="calendar-previous"
            variant="ghost"
          >
            <Icon decorative name="chevron-left" />
          </Button>
          <Button
            accessibilityLabel="Mes siguiente"
            className="min-w-touch px-3"
            onPress={() => setMonth(shiftMonth(month, 1))}
            testID="calendar-next"
            variant="ghost"
          >
            <Icon decorative name="chevron-right" />
          </Button>
        </View>
      </View>
      <Calendar
        firstDay={1}
        key={`${month}-${colors.card}`}
        current={month}
        customHeader={WeekdayHeader}
        markedDates={markedDates}
        markingType="custom"
        theme={{
          backgroundColor: colors.card,
          calendarBackground: colors.card,
          dayTextColor: colors.foreground,
          monthTextColor: colors.foreground,
          textDayFontFamily: FONT,
          textDayHeaderFontFamily: FONT,
          textDayFontSize: 16,
          textDayHeaderFontSize: 14,
          textDisabledColor: colors["muted-foreground"],
          textSectionTitleColor: colors["muted-foreground"],
          todayTextColor: colors.foreground,
        }}
      />
      {events.length === 0 ? (
        <Text testID="calendar-empty" tone="muted">
          Sin eventos agendados
        </Text>
      ) : null}
    </View>
  );
}
