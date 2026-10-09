import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { TutorsTable } from "@/components/registro/tutors-table";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import type { SortDirection } from "@/features/registro/patient-search";
import {
  searchTutors,
  TUTOR_PAGE_SIZE,
  TUTOR_SORT_COLUMNS,
  type TutorSortColumn,
} from "@/features/registro/tutor-search";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { hrefWithParams, useDebouncedParam } from "@/lib/url-filters";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

type Params = { name?: string; contact?: string; sort?: string; dir?: string; page?: string };

const tutorsHref = (params: Record<string, string | undefined>) =>
  hrefWithParams("/tutors", params);

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text variant="label">{label}</Text>
      {children}
    </View>
  );
}

/** Lista de tutores con búsqueda, orden y página en el servidor y en la URL (FR-119, FR-120). */
export default function TutorsScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<Params>();
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

  const sort: TutorSortColumn = TUTOR_SORT_COLUMNS.find((c) => c === raw.sort) ?? "name";
  const dir: SortDirection = raw.dir === "desc" ? "desc" : "asc";
  const page = Math.max(Number.parseInt(raw.page ?? "1", 10) || 1, 1);
  const name = raw.name ?? "";
  const contact = raw.contact ?? "";
  const current = { name, contact, sort: raw.sort, dir: raw.dir };

  // Cambiar un filtro vuelve a la primera página.
  const setParam = (key: "name" | "contact") => (value: string) =>
    router.setParams({ [key]: value || undefined, page: undefined });
  const [nameDraft, setNameDraft] = useDebouncedParam(name, setParam("name"));
  const [contactDraft, setContactDraft] = useDebouncedParam(contact, setParam("contact"));

  const tutorsQuery = useQuery({
    queryKey: ["registro", "tutors", "search", { name, contact, sort, dir, page }],
    queryFn: () => searchTutors(supabase, { name, contact, sort, dir, page }),
    placeholderData: keepPreviousData,
  });

  const queryError = tutorsQuery.error;
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
      operation: "list_tutors_page",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const rows = queryError ? [] : (tutorsQuery.data?.rows ?? []);
  const total = tutorsQuery.data?.total ?? 0;
  const hasFilters = Boolean(name || contact);
  const pageCount = Math.max(Math.ceil(total / TUTOR_PAGE_SIZE), 1);
  const isEmpty = tutorsQuery.isSuccess && rows.length === 0;

  const sortHref = (column: TutorSortColumn) =>
    tutorsHref({
      ...current,
      sort: column,
      dir: column === sort && dir === "asc" ? "desc" : "asc",
    });
  const pageHref = (target: number) =>
    tutorsHref({ ...current, page: target > 1 ? String(target) : undefined });

  const registerLink = (className?: string) => (
    <Link asChild href="/tutors/new">
      <Button accessibilityLabel="Registrar tutor" className={className} testID="tutors-register">
        <ButtonText>Registrar tutor</ButtonText>
      </Button>
    </Link>
  );

  return (
    <Screen
      // Igual que en pacientes: sin filtros y vacío, el botón va dentro del aviso (FR-083).
      action={isEmpty && !hasFilters ? null : registerLink()}
      back={{ href: "/patients", label: "Pacientes" }}
      testID="tutors-screen"
      title="Tutores"
      width="wide"
    >
      <Card className="gap-3 md:flex-row md:items-end" testID="tutors-filters">
        <FilterField label="Nombre">
          <Input>
            <InputField
              accessibilityLabel="Filtrar por nombre"
              onChangeText={setNameDraft}
              placeholder="Buscar por nombre o apellido"
              value={nameDraft}
            />
          </Input>
        </FilterField>
        <FilterField label="Contacto">
          <Input>
            <InputField
              accessibilityLabel="Filtrar por teléfono o correo"
              onChangeText={setContactDraft}
              placeholder="Teléfono o correo"
              value={contactDraft}
            />
          </Input>
        </FilterField>
        {hasFilters ? (
          <Link asChild href={tutorsHref({ sort: raw.sort, dir: raw.dir })}>
            <Button accessibilityLabel="Limpiar filtros" testID="tutors-clear" variant="ghost">
              <ButtonText>Limpiar filtros</ButtonText>
            </Button>
          </Link>
        ) : null}
      </Card>

      <QueryState
        empty={
          hasFilters ? (
            <Card className="gap-3" testID="tutors-empty">
              <Text>Ningún tutor coincide con los filtros.</Text>
            </Card>
          ) : (
            <Card className="gap-3" testID="tutors-empty">
              <Text>Aún no hay tutores registrados. Registra el primero.</Text>
              {registerLink("self-start")}
            </Card>
          )
        }
        error={queryError}
        errorMessage="No pudimos cargar los tutores."
        isEmpty={isEmpty}
        isPending={tutorsQuery.isPending}
        onRetry={() => void tutorsQuery.refetch()}
        testID="tutors"
      >
        <TutorsTable dir={dir} rows={rows} sort={sort} sortHref={sortHref} />
        {pageCount > 1 ? (
          <View className="flex-row items-center justify-between gap-3" testID="tutors-pager">
            <Text tone="muted">
              {total} tutores · página {page} de {pageCount}
            </Text>
            <View className="flex-row gap-3">
              {page > 1 ? (
                <Link asChild href={pageHref(page - 1)}>
                  <Button testID="tutors-prev" variant="outline">
                    <ButtonText>Anterior</ButtonText>
                  </Button>
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link asChild href={pageHref(page + 1)}>
                  <Button testID="tutors-next" variant="outline">
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
