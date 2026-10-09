import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type Href, Link, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { PatientsTable } from "@/components/registro/patients-table";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import {
  PATIENT_PAGE_SIZE,
  PATIENT_SORT_COLUMNS,
  type PatientSortColumn,
  type SortDirection,
  searchPatients,
  validDateOnly,
} from "@/features/registro/patient-search";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

type Params = {
  name?: string;
  breed?: string;
  from?: string;
  to?: string;
  tutor?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const FILTER_DEBOUNCE_MS = 300;

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text variant="label">{label}</Text>
      {children}
    </View>
  );
}

/** Href de `/patients` con solo los parámetros que tienen valor. */
function patientsHref(params: Record<string, string | undefined>): Href {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return (query ? `/patients?${query}` : "/patients") as Href;
}

/** Campo de texto cuyo valor sube a la URL tras una pausa al escribir. */
function useDebouncedParam(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  // Un cambio externo de la URL (p. ej. «Limpiar filtros») reinicia el borrador.
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onCommit(draft), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);
  return [draft, setDraft] as const;
}

export default function PatientsScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<Params>();
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

  const sort: PatientSortColumn = PATIENT_SORT_COLUMNS.find((c) => c === raw.sort) ?? "name";
  const dir: SortDirection = raw.dir === "desc" ? "desc" : "asc";
  const page = Math.max(Number.parseInt(raw.page ?? "1", 10) || 1, 1);
  const name = raw.name ?? "";
  const breed = raw.breed ?? "";
  const from = raw.from ?? "";
  const to = raw.to ?? "";
  const tutorId = raw.tutor ?? "";

  const current = {
    name,
    breed,
    from,
    to,
    tutor: tutorId,
    sort: raw.sort,
    dir: raw.dir,
  };
  // Cambiar un filtro o el orden vuelve a la primera página.
  const setParam = (key: keyof Params) => (value: string) =>
    router.setParams({ [key]: value || undefined, page: undefined });

  const [nameDraft, setNameDraft] = useDebouncedParam(name, setParam("name"));
  const [breedDraft, setBreedDraft] = useDebouncedParam(breed, setParam("breed"));
  const [fromDraft, setFromDraft] = useDebouncedParam(from, setParam("from"));
  const [toDraft, setToDraft] = useDebouncedParam(to, setParam("to"));

  const patientsQuery = useQuery({
    queryKey: ["registro", "patients", { name, breed, from, to, tutorId, sort, dir, page }],
    queryFn: () =>
      searchPatients(supabase, {
        name,
        breed,
        tutorId,
        visitFrom: validDateOnly(from),
        visitTo: validDateOnly(to),
        sort,
        dir,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const queryError = patientsQuery.error;
  useEffect(() => {
    if (!queryError) {
      return;
    }
    if (isAuthenticationRequired(queryError)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, {
      error: queryError,
      operation: "list_patients",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const rows = queryError ? [] : (patientsQuery.data?.rows ?? []);
  const total = patientsQuery.data?.total ?? 0;
  const hasFilters = Boolean(name || breed || validDateOnly(from) || validDateOnly(to) || tutorId);
  const pageCount = Math.max(Math.ceil(total / PATIENT_PAGE_SIZE), 1);
  const isEmpty = patientsQuery.isSuccess && rows.length === 0;

  const sortHref = (column: PatientSortColumn) =>
    patientsHref({
      ...current,
      sort: column,
      dir: column === sort && dir === "asc" ? "desc" : "asc",
    });
  const pageHref = (target: number) =>
    patientsHref({ ...current, page: target > 1 ? String(target) : undefined });

  const registerLink = (
    <Link asChild href="/patients/new">
      <Button
        accessibilityLabel="Registrar paciente"
        className="self-start"
        testID="patients-register"
      >
        <ButtonText>Registrar paciente</ButtonText>
      </Button>
    </Link>
  );

  return (
    <Screen testID="patients-screen" title="Pacientes" width="wide">
      {/* Con filtros, el vacío no invita a registrar: invita a limpiarlos. */}
      {isEmpty && !hasFilters ? null : registerLink}

      <Card className="gap-3 md:flex-row md:items-end" testID="patients-filters">
        <FilterField label="Nombre">
          <Input>
            <InputField
              accessibilityLabel="Filtrar por nombre"
              onChangeText={setNameDraft}
              placeholder="Buscar por nombre"
              value={nameDraft}
            />
          </Input>
        </FilterField>
        <FilterField label="Raza">
          <Input>
            <InputField
              accessibilityLabel="Filtrar por raza"
              onChangeText={setBreedDraft}
              placeholder="Buscar por raza"
              value={breedDraft}
            />
          </Input>
        </FilterField>
        <FilterField label="Última visita desde">
          <Input>
            <InputField
              accessibilityLabel="Última visita desde (AAAA-MM-DD)"
              inputMode="numeric"
              onChangeText={setFromDraft}
              placeholder="AAAA-MM-DD"
              value={fromDraft}
            />
          </Input>
        </FilterField>
        <FilterField label="Hasta">
          <Input>
            <InputField
              accessibilityLabel="Última visita hasta (AAAA-MM-DD)"
              inputMode="numeric"
              onChangeText={setToDraft}
              placeholder="AAAA-MM-DD"
              value={toDraft}
            />
          </Input>
        </FilterField>
        {hasFilters ? (
          <Link asChild href={patientsHref({ sort: raw.sort, dir: raw.dir })}>
            <Button accessibilityLabel="Limpiar filtros" testID="patients-clear" variant="ghost">
              <ButtonText>Limpiar filtros</ButtonText>
            </Button>
          </Link>
        ) : null}
      </Card>

      <QueryState
        empty={
          hasFilters ? (
            <Card className="gap-3" testID="patients-empty">
              <Text>Ningún paciente coincide con los filtros.</Text>
            </Card>
          ) : (
            <Card className="gap-3" testID="patients-empty">
              <Text>
                Aún no hay pacientes registrados. Registra el primero para abrir su ficha.
              </Text>
              {registerLink}
            </Card>
          )
        }
        error={queryError}
        errorMessage="No pudimos cargar los pacientes."
        isEmpty={isEmpty}
        isPending={patientsQuery.isPending}
        onRetry={() => void patientsQuery.refetch()}
        testID="patients"
      >
        <PatientsTable dir={dir} rows={rows} sort={sort} sortHref={sortHref} />
        {pageCount > 1 ? (
          <View className="flex-row items-center justify-between gap-3" testID="patients-pager">
            <Text tone="muted">
              {total} pacientes · página {page} de {pageCount}
            </Text>
            <View className="flex-row gap-3">
              {page > 1 ? (
                <Link asChild href={pageHref(page - 1)}>
                  <Button testID="patients-prev" variant="outline">
                    <ButtonText>Anterior</ButtonText>
                  </Button>
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link asChild href={pageHref(page + 1)}>
                  <Button testID="patients-next" variant="outline">
                    <ButtonText>Siguiente</ButtonText>
                  </Button>
                </Link>
              ) : null}
            </View>
          </View>
        ) : null}
      </QueryState>
    </Screen>
  );
}
