import { type Href, Link } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkText } from "@/components/ui/link-text";
import { Text } from "@/components/ui/text";
import type {
  PatientRow,
  PatientSortColumn,
  SortDirection,
} from "@/features/registro/patient-search";

/** Ventana desde la que los pacientes se pintan como tabla; debajo, como tarjetas (`lg`). */
const TABLE_FROM = 1024;

type Column = { key: PatientSortColumn; label: string; width: string };

// Anchos en fracciones; el tutor toma el resto: sin scroll horizontal.
const COLUMNS: Column[] = [
  { key: "name", label: "Nombre", width: "w-1/5" },
  { key: "species", label: "Especie", width: "w-1/6" },
  { key: "breed", label: "Raza", width: "w-1/6" },
  { key: "last_visit", label: "Última visita", width: "w-1/6" },
  { key: "tutor", label: "Tutor", width: "flex-1" },
];

export type PatientsTableProps = {
  rows: PatientRow[];
  sort: PatientSortColumn;
  dir: SortDirection;
  /** Destino de la cabecera de una columna: alterna el sentido si ya es la activa. Sin él, las cabeceras no ordenan. */
  sortHref?: (column: PatientSortColumn) => Href;
};

export function formatVisit(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Sin visitas";
}

function TutorLink({ row }: { row: PatientRow }) {
  if (!row.tutorName) return <Text tone="muted">Sin tutor</Text>;
  return (
    <Link asChild href={`/tutors/${row.tutorId}`}>
      <LinkText accessibilityLabel={`Ver tutor ${row.tutorName}`} testID="patient-tutor">
        {row.tutorName}
      </LinkText>
    </Link>
  );
}

function OpenButton({ row }: { row: PatientRow }) {
  return (
    <Link asChild href={`/patients/${row.id}`}>
      <Button
        accessibilityLabel={`Ver ficha de ${row.name}`}
        testID="patient-open"
        variant="outline"
      >
        <ButtonText>Ver ficha</ButtonText>
      </Button>
    </Link>
  );
}

function HeaderCell({
  column,
  dir,
  href,
  sort,
}: {
  column: Column;
  dir: SortDirection;
  href?: Href;
  sort: PatientSortColumn;
}) {
  const active = column.key === sort;
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <View
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={column.width}
      role="columnheader"
    >
      {href ? (
        <Link asChild href={href}>
          <Button
            accessibilityLabel={`Ordenar por ${column.label}`}
            className="items-start self-start"
            size="sm"
            testID={`patients-sort-${column.key}`}
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
 * Pacientes como tabla desde `lg` y como tarjetas etiquetadas debajo (sin scroll horizontal).
 * Las cabeceras ordenan en el servidor: son enlaces con los parámetros de la URL.
 */
export function PatientsTable({ dir, rows, sort, sortHref }: PatientsTableProps) {
  const isTable = useWindowDimensions().width >= TABLE_FROM;

  if (!isTable) {
    return (
      <View className="gap-3" role="list" testID="patients-list">
        {rows.map((row) => (
          <Card className="gap-3" key={row.id} role="listitem" testID="patient-item">
            <View className="gap-1">
              <Text selectable variant="strong">
                {row.name}
              </Text>
              <Text tone="muted">
                {row.species} · {row.breed}
              </Text>
            </View>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                Última visita
              </Text>
              <Text variant="data">{formatVisit(row.lastVisitAt)}</Text>
            </View>
            <View className="gap-1">
              <Text tone="muted" variant="rubric">
                Tutor
              </Text>
              <TutorLink row={row} />
            </View>
            <OpenButton row={row} />
          </Card>
        ))}
      </View>
    );
  }

  return (
    <Card className="overflow-hidden p-0" role="table" testID="patients-list">
      <View
        className="flex-row items-center gap-3 border-b border-border bg-muted px-4 py-1"
        role="row"
      >
        {COLUMNS.map((column) => (
          <HeaderCell
            column={column}
            dir={dir}
            href={sortHref?.(column.key)}
            key={column.key}
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
          testID="patient-item"
        >
          <View className="w-1/5" role="cell">
            <Text selectable variant="strong">
              {row.name}
            </Text>
          </View>
          <View className="w-1/6" role="cell">
            <Text selectable>{row.species}</Text>
          </View>
          <View className="w-1/6" role="cell">
            <Text selectable>{row.breed}</Text>
          </View>
          <View className="w-1/6" role="cell">
            <Text variant="data">{formatVisit(row.lastVisitAt)}</Text>
          </View>
          <View className="flex-1" role="cell">
            <TutorLink row={row} />
          </View>
          <View className="w-28 items-end" role="cell">
            <OpenButton row={row} />
          </View>
        </View>
      ))}
    </Card>
  );
}
