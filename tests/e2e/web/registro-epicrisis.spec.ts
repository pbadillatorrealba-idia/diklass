import { request as apiRequest } from "@playwright/test";
import {
  ANA,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

// Revisión de la PR #27: los campos de lista de la epicrisis (uno por línea) recortaban el
// texto en cada pulsación, así que no admitían espacios ni un segundo elemento.
test.describe("epicrisis: campos de lista", () => {
  test("admiten elementos de varias palabras en varias líneas y se guardan como lista", async ({
    page,
  }) => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );

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

    try {
      const perfil = await api.get(
        `/rest/v1/veterinarians?select=clinic_id&id=eq.${session.userId}`,
      );
      const [anaPerfil] = (await perfil.json()) as Array<{ clinic_id: string }>;
      if (!anaPerfil) {
        throw new Error("Could not read Ana's clinic_id from her veterinarian profile.");
      }
      const clinicId = anaPerfil.clinic_id;

      const crear = async (recordType: string, content: Record<string, unknown>) => {
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
        name: "Sra. Epicrisis E2E",
        phone: "+56 9 5550 0101",
        email: null,
      });
      const patientId = await crear("patient", {
        name: "Luna E2E epicrisis",
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
});
