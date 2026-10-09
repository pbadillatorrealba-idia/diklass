import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TutorsTable, type TutorsTableProps } from "@/components/registro/tutors-table";
import type { TutorRow } from "@/features/registro/tutor-search";

const ORIGINAL_OS = process.env.EXPO_OS;
afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
});

const rows: TutorRow[] = [
  {
    id: "t1",
    fullName: "Marta Soto",
    rut: "12345678-5",
    phone: "+56 9 5550 0101",
    email: null,
    patientCount: 2,
  },
  {
    id: "t2",
    fullName: "Zoe",
    rut: null,
    phone: null,
    email: "zoe@example.test",
    patientCount: 0,
  },
];

const render = async (width: number, sortHref?: TutorsTableProps["sortHref"]) => {
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
      <TutorsTable dir="asc" rows={rows} sort="name" sortHref={sortHref} />,
    );
  } finally {
    spy.mockRestore();
  }
};

// administracion-tutores FR-119: tabla desde `lg`, tarjetas etiquetadas debajo.
describe("TutorsTable", () => {
  test("bajo 1024 px pinta tarjetas rotuladas, sin tabla", async () => {
    const html = await render(768);
    expect(html).toContain('role="list"');
    expect(html).not.toContain('role="table"');
    expect(html).toContain("Teléfono");
    expect(html).toContain("Marta Soto");
    expect(html).toContain("Sin dato");
  });

  test("desde 1024 px pinta la tabla con una fila por tutor", async () => {
    const html = await render(1280);
    expect(html).toContain('role="table"');
    expect(html.match(/data-testid="tutor-item"/g)).toHaveLength(2);
  });

  test("las cabeceras solo ordenan con sortHref", async () => {
    expect(await render(1280, () => "/tutors")).toContain("tutors-sort-name");
    expect(await render(1280)).not.toContain("tutors-sort-");
  });
});
