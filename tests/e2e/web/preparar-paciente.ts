import { type APIRequestContext, request as apiRequest, type Page } from "@playwright/test";
import {
  ANA,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
} from "./fixtures";

/**
 * Inicia sesión como Ana y crea por la Data API un tutor y un paciente de su clínica. Los
 * datos de partida no son el objeto de estas pruebas, así que no se cargan por la interfaz.
 */
export async function prepararPaciente(
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

export type Crear = (recordType: string, content: Record<string, unknown>) => Promise<string>;
