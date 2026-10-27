import { expect, readSupabaseSession, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { abrirHilo } from "./panel";
import { prepararPaciente } from "./preparar-paciente";

// sistema-visual «Conocimiento en el panel» (shell-asistente-tres-zonas, design.md D5, FR-026).
test.describe("hilo «Conocimiento» del panel (web)", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  test("pregunta desde la consulta con el paciente de contexto y responde con citas", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rocky E2E conocimiento");
    // Una palabra inventada: solo la fuente de esta prueba la contiene, así la cita es inequívoca.
    const palabra = `zorrilomaquia${Date.now()}`;
    const titulo = `Guía E2E ${palabra}`;
    try {
      const { userId } = await readSupabaseSession(page);
      const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
      const [{ clinic_id: clinicId } = { clinic_id: "" }] = (await perfil.json()) as Array<{
        clinic_id: string;
      }>;
      const fuente = await api.post("/rest/v1/knowledge_documents", {
        data: {
          clinic_id: clinicId,
          status: "available",
          content: {
            bibliografia: {
              titulo,
              autores: ["Dra. Ficticia"],
              anio: 2026,
              revista: null,
              editorial: null,
              edicion: null,
              doi: null,
              url: null,
            },
            licencia: { tipo: "CC BY 4.0 (ficticia)", nota: null },
            fragmentos: [
              {
                ordinal: 1,
                seccion: null,
                texto: `El protocolo de ${palabra} indica revisar el entorno del paciente.`,
              },
            ],
          },
        },
      });
      expect(fuente.ok()).toBeTruthy();

      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });

      await abrirHilo(page, "conocimiento");
      const panel = page.getByTestId("assistant-panel");
      const pregunta = `¿Qué indica el protocolo de ${palabra}?`;
      const campo = panel.getByLabel("Tu pregunta al asistente");
      await expect(campo).toBeEditable();
      await campo.click();
      await page.keyboard.type(pregunta, { delay: 5 });
      await expect(campo).toHaveValue(pregunta);
      await panel.getByTestId("conocimiento-consultar").click();

      // La respuesta lleva la cita con su fuente y fragmento, dentro del panel.
      const respuesta = panel.getByTestId("respuesta-conocimiento");
      await expect(respuesta).toBeVisible({ timeout: 15_000 });
      await expect(respuesta).toContainText(titulo);
      await expect(respuesta).toContainText("revisar el entorno del paciente");

      // El paciente de la consulta es el contexto, sin haberlo elegido: queda seleccionado y la
      // consulta registrada lo declara.
      await expect(panel.getByTestId(`selector-paciente-contexto-${patientId}`)).toHaveAttribute(
        "aria-checked",
        "true",
      );
      const registradas = await api.get(
        `/rest/v1/knowledge_queries?select=patient_id&question=eq.${encodeURIComponent(pregunta)}`,
      );
      expect(await registradas.json()).toEqual([{ patient_id: patientId }]);
    } finally {
      await api.dispose();
    }
  });
});
