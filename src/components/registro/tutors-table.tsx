import { type Href, Link } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { SortDirection } from "@/features/registro/patient-search";
import type { TutorRow, TutorSortColumn } from "@/features/registro/tutor-search";

/** Ventana desde la que los tutores se pintan como tabla; debajo, como tarjetas (`lg`). */
const TABLE_FROM = 1024;

type Column = { key: TutorSortColumn | null; label: string; width: string };

// Solo nombre y pacientes ordenan en el servidor; contacto va como texto.
const COLUMNS: Column[] = [
  { key: "name", label: "Nombre", width: "w-1/4" },
  { key: null, label: "Teléfono", width: "w-1/5" },
  { key: null, label: "Correo", width: "flex-1" },
  { key: "patients", label: "Pacientes", width: "w-1/6" },
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
      className={column.width}
      role="columnheader"
    >
      {href && column.key ? (
        <Link asChild href={href}>
          <Button
            accessibilityLabel={`Ordenar por ${column.label}`}
            className="items-start self-start"
            size="sm"
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
 * Tutores como tabla desde `lg` y como tarjetas etiquetadas debajo (sin scroll horizontal).
 * Las cabeceras ordenan en el servidor: son enlaces con los parámetros de la URL (FR-119).
 */
export function TutorsTable({ dir, rows, sort, sortHref }: TutorsTableProps) {
  const isTable = useWindowDimensions().width >= TABLE_FROM;

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
          <View className="w-1/4" role="cell">
            <Text selectable variant="strong">
              {row.fullName}
            </Text>
          </View>
          <View className="w-1/5" role="cell">
            {orMissing(row.phone)}
          </View>
          <View className="flex-1" role="cell">
            {orMissing(row.email)}
          </View>
          <View className="w-1/6" role="cell">
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
