import { type APIRequestContext, request as apiRequest, type Page } from "@playwright/test";
import {
  ANA,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

/**
 * Inicia sesión como Ana y crea por la Data API un tutor y un paciente de su clínica. Los
 * datos de partida no son el objeto de estas pruebas, así que no se cargan por la interfaz.
 */
async function prepararPaciente(
  page: Page,
  nombre: string,
): Promise<{ api: APIRequestContext; patientId: string; crear: Crear }> {
  await submitLogin(page, ANA);
  await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });
  const session = await readSupabaseSession(page);

  const api = await apiRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });

  const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${session.userId}`);
  const [anaPerfil] = (await perfil.json()) as Array<{ clinic_id: string }>;
  if (!anaPerfil) {
    throw new Error("Could not read Ana's clinic_id from her veterinarian profile.");
  }
  const clinicId = anaPerfil.clinic_id;

  const crear: Crear = async (recordType, content) => {
    const respuesta = await api.post("/rest/v1/clinical_records", {
      data: { clinic_id: clinicId, record_type: recordType, content, status: "draft" },
    });
    expect(respuesta.status()).toBe(201);
    const [fila] = (await respuesta.json()) as Array<{ id: string }>;
    if (!fila) {
      throw new Error(`The ${recordType} insert returned no row.`);
    }
    return fila.id;
  };

  const tutorId = await crear("tutor", {
    name: `Tutor de ${nombre}`,
    phone: "+56 9 5550 0101",
    email: null,
  });
  const patientId = await crear("patient", {
    name: nombre,
    species: "canino",
    breed: "Mestizo",
    birthDate: "2021-03-10",
    ageMonths: null,
    weightKg: 12.5,
    sex: "hembra",
    reproductiveStatus: "entera",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    tutorId,
  });
  return { api, patientId, crear };
}

type Crear = (recordType: string, content: Record<string, unknown>) => Promise<string>;

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
      await page.getByRole("button", { name: "Aprobar y cerrar consulta" }).click();
      await expect(page.getByTestId("consultation-status")).toHaveText(/Epicrisis aprobada/);

      await page.getByRole("button", { name: "Ver ficha del paciente" }).click();
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
