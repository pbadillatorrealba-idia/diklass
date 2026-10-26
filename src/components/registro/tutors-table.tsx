import { type Href, Link } from "expo-router";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useContentWidth } from "@/features/asistente/use-content-width";
import type { SortDirection } from "@/features/registro/patient-search";
import type { TutorRow, TutorSortColumn } from "@/features/registro/tutor-search";
import { formatRut } from "@/lib/rut";

/**
 * Ancho de contenido desde el que los tutores se pintan como tabla; debajo, como tarjetas. Se mide
 * el contenido y no la ventana (ver `patients-table`).
 */
const TABLE_FROM = 800;

type Column = { key: TutorSortColumn | null; label: string; flex?: number; className?: string };

// Pesos de reparto del ancho disponible; «Pacientes» es un número y lleva ancho fijo.
const FLEX = { name: 2, rut: 1.3, phone: 1.3, email: 2.2 } as const;
// Solo nombre y pacientes ordenan en el servidor; contacto va como texto.
const COLUMNS: Column[] = [
  { key: "name", label: "Nombre", flex: FLEX.name },
  { key: null, label: "RUT", flex: FLEX.rut },
  { key: null, label: "Teléfono", flex: FLEX.phone },
  { key: null, label: "Correo", flex: FLEX.email },
  { key: "patients", label: "Pacientes", className: "w-24" },
];

export type TutorsTableProps = {
  rows: TutorRow[];
  sort: TutorSortColumn;
  dir: SortDirection;
  /** Destino de la cabecera de una columna: alterna el sentido si ya es la activa. Sin él, no ordenan. */
  sortHref?: (column: TutorSortColumn) => Href;
};

function OpenButton({ row }: { row: TutorRow }) {
  return (
    <Link asChild href={`/tutors/${row.id}`}>
      <Button
        accessibilityLabel={`Ver ficha de ${row.fullName}`}
        testID="tutor-open"
        variant="outline"
      >
        <ButtonText>Ver ficha</ButtonText>
      </Button>
    </Link>
  );
}

const orMissing = (value: string | null) =>
  value ? <Text selectable>{value}</Text> : <Text tone="muted">Sin dato</Text>;

const rutOrMissing = (rut: string | null) => orMissing(rut ? formatRut(rut) : null);

function HeaderCell({
  column,
  dir,
  href,
  sort,
}: {
  column: Column;
  dir: SortDirection;
  href?: Href;
  sort: TutorSortColumn;
}) {
  const active = column.key === sort;
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <View
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={column.className}
      role="columnheader"
      style={column.flex ? { flex: column.flex, minWidth: 0 } : undefined}
    >
      {href && column.key ? (
        <Link asChild href={href}>
          <Button
            accessibilityLabel={`Ordenar por ${column.label}`}
            className="items-start self-start"
            size="sm"
            style={{ paddingHorizontal: 0 }}
            testID={`tutors-sort-${column.key}`}
            variant="ghost"
          >
            <ButtonText>{`${column.label}${arrow}`}</ButtonText>
          </Button>
        </Link>
      ) : (
        <Text variant="label">{column.label}</Text>
      )}
    </View>
  );
}

/**
 * Tutores como tabla desde 800 px de contenido y como tarjetas etiquetadas debajo (sin scroll horizontal).
 * Las cabeceras ordenan en el servidor: son enlaces con los parámetros de la URL (FR-119).
 */
export function TutorsTable({ dir, rows, sort, sortHref }: TutorsTableProps) {
  const isTable = useContentWidth() >= TABLE_FROM;

  if (!isTable) {
    return (
      <View className="gap-3" role="list" testID="tutors-list">
        {rows.map((row) => (
          <Card className="gap-3" key={row.id} role="listitem" testID="tutor-item">
            <Text selectable variant="strong">
              {row.fullName}
            </Text>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                RUT
              </Text>
              {rutOrMissing(row.rut)}
            </View>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                Teléfono
              </Text>
              {orMissing(row.phone)}
            </View>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                Correo
              </Text>
              {orMissing(row.email)}
            </View>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                Pacientes
              </Text>
              <Text variant="data">{row.patientCount}</Text>
            </View>
            <OpenButton row={row} />
          </Card>
        ))}
      </View>
    );
  }

  return (
    <Card className="overflow-hidden p-0" role="table" testID="tutors-list">
      <View
        className="flex-row items-center gap-3 border-b border-border bg-muted px-4 py-1"
        role="row"
      >
        {COLUMNS.map((column) => (
          <HeaderCell
            column={column}
            dir={dir}
            href={column.key ? sortHref?.(column.key) : undefined}
            key={column.label}
            sort={sort}
          />
        ))}
        <View className="w-28" />
      </View>
      {rows.map((row, index) => (
        <View
          className={`flex-row items-center gap-3 px-4 py-3 hover:bg-muted ${
            index > 0 ? "border-t border-border" : ""
          }`}
          key={row.id}
          role="row"
          testID="tutor-item"
        >
          <View role="cell" style={{ flex: FLEX.name, minWidth: 0 }}>
            <Text selectable variant="strong">
              {row.fullName}
            </Text>
          </View>
          <View role="cell" style={{ flex: FLEX.rut, minWidth: 0 }}>
            {rutOrMissing(row.rut)}
          </View>
          <View role="cell" style={{ flex: FLEX.phone, minWidth: 0 }}>
            {orMissing(row.phone)}
          </View>
          <View role="cell" style={{ flex: FLEX.email, minWidth: 0 }}>
            {orMissing(row.email)}
          </View>
          <View className="w-24" role="cell">
            <Text variant="data">{row.patientCount}</Text>
          </View>
          <View className="w-28 items-end" role="cell">
            <OpenButton row={row} />
          </View>
        </View>
      ))}
    </Card>
  );
}
