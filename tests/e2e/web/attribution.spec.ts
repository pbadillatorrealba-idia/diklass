import type { Browser, Page } from "@playwright/test";
import { request as apiRequest } from "@playwright/test";
import {
  ANA,
  BRUNO,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

type VeterinarianSession = { accessToken: string; userId: string };

async function loginAndCaptureSession(
  page: Page,
  credentials: { email: string; password: string },
): Promise<VeterinarianSession> {
  await submitLogin(page, credentials);
  await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });
  return readSupabaseSession(page);
}

test.describe("attribution web contract", () => {
  test("does not expose shared clinical records without a valid session", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("two authenticated veterinarians share clinic records and cannot spoof attribution", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test and vet.bruno@example.test provisioned.",
    );

    const anaContext = await browser.newContext();
    const ana = await loginAndCaptureSession(await anaContext.newPage(), ANA);

    const brunoContext = await browser.newContext();
    const bruno = await loginAndCaptureSession(await brunoContext.newPage(), BRUNO);

    const anaApi = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${ana.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const brunoApi = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${bruno.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    try {
      const clinicResponse = await anaApi.get(
        `/rest/v1/veterinarians?select=clinic_id&id=eq.${ana.userId}`,
      );
      const [anaProfile] = (await clinicResponse.json()) as Array<{ clinic_id: string }>;
      if (!anaProfile?.clinic_id) {
        throw new Error("Could not read Ana's clinic_id from her veterinarian profile.");
      }

      // Ana creates a clinical record; attribution is derived from her session, never sent by the client.
      const createResponse = await anaApi.post("/rest/v1/clinical_records", {
        data: {
          clinic_id: anaProfile.clinic_id,
          record_type: "patient",
          content: { name: "Luna E2E" },
          status: "draft",
        },
        headers: { Prefer: "return=representation" },
      });
      expect(createResponse.ok()).toBeTruthy();
      const [record] = (await createResponse.json()) as Array<{ id: string; created_by: string }>;
      if (!record) {
        throw new Error("Clinical record creation did not return a representation.");
      }
      expect(record.created_by).toBe(ana.userId);

      // Bruno, same clinic, can see and attend to a patient he did not register.
      const brunoReadResponse = await brunoApi.get(`/rest/v1/clinical_records?id=eq.${record.id}`);
      expect(brunoReadResponse.ok()).toBeTruthy();
      const brunoRecords = (await brunoReadResponse.json()) as Array<{ created_by: string }>;
      expect(brunoRecords).toHaveLength(1);
      expect(brunoRecords[0]?.created_by).toBe(ana.userId);

      // Bruno cannot create a record attributed to Ana.
      const spoofResponse = await brunoApi.post("/rest/v1/clinical_records", {
        data: {
          clinic_id: anaProfile.clinic_id,
          record_type: "patient",
          content: { name: "Rex E2E" },
          status: "draft",
          created_by: ana.userId,
        },
      });
      expect(spoofResponse.ok()).toBeFalsy();

      // Bruno cannot modify the attribution of Ana's existing record.
      const tamperResponse = await brunoApi.patch(`/rest/v1/clinical_records?id=eq.${record.id}`, {
        data: { created_by: bruno.userId },
      });
      expect(tamperResponse.ok()).toBeFalsy();
    } finally {
      await anaApi.dispose();
      await brunoApi.dispose();
      await anaContext.close();
      await brunoContext.close();
    }
  });
});
