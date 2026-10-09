import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PatientsTable, type PatientsTableProps } from "@/components/registro/patients-table";
import type { PatientRow } from "@/features/registro/patient-search";

const ORIGINAL_OS = process.env.EXPO_OS;
afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
});

const rows: PatientRow[] = [
  {
    id: "p1",
    name: "Luna",
    species: "Canino",
    breed: "Labrador",
    tutorId: "t1",
    tutorName: "Ana Soto",
    lastVisitAt: null,
  },
  {
    id: "p2",
    name: "Nube",
    species: "Felino",
    breed: "Siames",
    tutorId: "",
    tutorName: null,
    lastVisitAt: null,
  },
];

const render = async (width: number, sortHref?: PatientsTableProps["sortHref"]) => {
  process.env.EXPO_OS = "web";
  const rn = await import("react-native");
  const spy = spyOn(rn, "useWindowDimensions").mockReturnValue({
    width,
    height: 800,
    scale: 1,
    fontScale: 1,
  });
  try {
    return renderToStaticMarkup(
      <PatientsTable dir="asc" rows={rows} sort="name" sortHref={sortHref} />,
    );
  } finally {
    spy.mockRestore();
  }
};

// sistema-visual FR-086: tabla desde `lg`, tarjetas etiquetadas debajo.
describe("PatientsTable", () => {
  test("bajo 1024 px pinta tarjetas, sin tabla ni cabeceras", async () => {
    const html = await render(768);
    expect(html).toContain('role="list"');
    expect(html).not.toContain('role="table"');
    expect(html).not.toContain('role="columnheader"');
    expect(html).toContain("Ana Soto");
    expect(html).toContain("Sin tutor");
  });

  test("desde 1024 px pinta la tabla con una fila por paciente", async () => {
    const html = await render(1280);
    expect(html).toContain('role="table"');
    expect(html).toContain('role="columnheader"');
    expect(html.match(/data-testid="patient-item"/g)).toHaveLength(2);
  });

  test("las cabeceras solo ordenan con sortHref; sin él son texto", async () => {
    expect(await render(1280, () => "/patients")).toContain("patients-sort-name");
    expect(await render(1280)).not.toContain("patients-sort-");
  });
});
