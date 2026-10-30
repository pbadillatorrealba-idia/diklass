import { type Href, Link } from "expo-router";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkText } from "@/components/ui/link-text";
import { Text } from "@/components/ui/text";
import { useContentWidth } from "@/features/asistente/use-content-width";
import { catalogLabel, SPECIES_LABELS } from "@/features/registro/catalogs";
import type {
  PatientRow,
  PatientSortColumn,
  SortDirection,
} from "@/features/registro/patient-search";

/**
 * Ancho de contenido desde el que los pacientes se pintan como tabla; debajo, como tarjetas. Se
 * mide el contenido y no la ventana: con el panel de asistente acoplado la tabla de una ventana de
 * 1440 px tiene 840 px, y con el riel a 1024 px, 728 px (sistema-visual «Shell de tres zonas»).
 */
const TABLE_FROM = 800;

type Column = { key: PatientSortColumn; label: string; flex: number };

// Pesos de reparto del ancho disponible (no fracciones fijas): el tutor y el nombre, los más
// largos, reciben más y la tabla no desborda ni parte un nombre letra a letra.
const FLEX = { name: 2, species: 1, breed: 1.2, last_visit: 1.7, tutor: 2 } as const;
const COLUMNS: Column[] = [
  { key: "name", label: "Nombre", flex: FLEX.name },
  { key: "species", label: "Especie", flex: FLEX.species },
  { key: "breed", label: "Raza", flex: FLEX.breed },
  { key: "last_visit", label: "Última visita", flex: FLEX.last_visit },
  { key: "tutor", label: "Tutor", flex: FLEX.tutor },
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
      role="columnheader"
      style={{ flex: column.flex, minWidth: 0 }}
    >
      {href ? (
        <Link asChild href={href}>
          <Button
            accessibilityLabel={`Ordenar por ${column.label}`}
            className="items-start self-start"
            size="sm"
            style={{ paddingHorizontal: 0 }}
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
 * Pacientes como tabla desde 800 px de contenido y como tarjetas etiquetadas debajo (sin scroll horizontal).
 * Las cabeceras ordenan en el servidor: son enlaces con los parámetros de la URL.
 */
export function PatientsTable({ dir, rows, sort, sortHref }: PatientsTableProps) {
  const isTable = useContentWidth() >= TABLE_FROM;

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
                {catalogLabel(SPECIES_LABELS, row.species)} · {row.breed}
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
          <View role="cell" style={{ flex: FLEX.name, minWidth: 0 }}>
            <Text selectable variant="strong">
              {row.name}
            </Text>
          </View>
          <View role="cell" style={{ flex: FLEX.species, minWidth: 0 }}>
            <Text selectable>{catalogLabel(SPECIES_LABELS, row.species)}</Text>
          </View>
          <View role="cell" style={{ flex: FLEX.breed, minWidth: 0 }}>
            <Text selectable>{row.breed}</Text>
          </View>
          <View role="cell" style={{ flex: FLEX.last_visit, minWidth: 0 }}>
            <Text variant="data">{formatVisit(row.lastVisitAt)}</Text>
          </View>
          <View role="cell" style={{ flex: FLEX.tutor, minWidth: 0 }}>
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
