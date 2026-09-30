import { expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { prepararPaciente } from "./preparar-paciente";

test.describe("registro clínico web", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // Revisión de la PR #27: los campos de lista de la epicrisis (uno por línea) recortaban el
  // texto en cada pulsación, así que no admitían espacios ni un segundo elemento.
  test("los campos de lista de la epicrisis admiten varias palabras y varias líneas", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Luna E2E epicrisis");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });

      await page.goto(`/consultations/${consultationId}`);
      await page.getByRole("button", { name: "Generar borrador de epicrisis" }).click();

      const examenes = page.getByLabel("Exámenes solicitados (uno por línea)");
      await expect(examenes).toBeEditable();
      await examenes.click();
      await page.keyboard.type("hemograma completo", { delay: 15 });
      await page.keyboard.press("Enter");
      await page.keyboard.type("perfil bioquímico", { delay: 15 });
      await expect(examenes).toHaveValue("hemograma completo\nperfil bioquímico");

      await page.getByRole("button", { name: "Guardar borrador de epicrisis" }).click();
      await expect(page.getByTestId("consultation-status")).toHaveText(/Borrador guardado/);

      const guardada = await api.get(
        `/rest/v1/clinical_records?select=content&record_type=eq.epicrisis&content->>consultationId=eq.${consultationId}`,
      );
      const [epicrisis] = (await guardada.json()) as Array<{
        content: { examenesSolicitados: string[] };
      }>;
      expect(epicrisis?.content.examenesSolicitados).toEqual([
        "hemograma completo",
        "perfil bioquímico",
      ]);
    } finally {
      await api.dispose();
    }
  });

  // Revisión de la PR #27: tras abrir y cerrar una consulta, la ficha mostraba durante 30 s
  // el historial que tenía en caché (sin la consulta, o con ella abierta).
  test("al volver a la ficha tras cerrar la consulta, el historial la muestra cerrada", async ({
    page,
  }) => {
    const { api, patientId } = await prepararPaciente(page, "Nube E2E historial");
    try {
      await page.goto(`/patients/${patientId}`);
      await expect(page.getByTestId("history-empty")).toBeVisible();

      await page.getByRole("button", { name: "Abrir consulta" }).click();
      await expect(page).toHaveURL(/\/consultations\//);
      await page.getByRole("button", { name: "Generar borrador de epicrisis" }).click();
      await page.getByRole("button", { name: "Firmar y cerrar consulta" }).click();
      await expect(page.getByTestId("consultation-status")).toHaveText(/Epicrisis aprobada/);

      await page.getByRole("link", { name: "Ver ficha del paciente" }).click();
      await expect(page).toHaveURL(new RegExp(`/patients/${patientId}$`));
      // La ficha anterior sigue montada bajo la pila de navegación: solo cuenta la visible.
      const historial = page.getByTestId("history-item").filter({ visible: true });
      await expect(historial).toHaveCount(1);
      await expect(historial).toContainText("Cerrada");
    } finally {
      await api.dispose();
    }
  });
});
