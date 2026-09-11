import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { findUserIdByEmail, isLocalSupabaseUrl, normalizeEmail } from "./lib/provisioning";

type Fixture = { email: string; password: string; displayName: string };

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clinicId = "00000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const PER_PAGE = 1000;

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios para provisioning.");
}
if (!isLocalSupabaseUrl(url) && !args.includes("--allow-remote")) {
  throw new Error(
    `${url} no es un Supabase local. Usa --allow-remote solo para el backend sintético de e2e.`,
  );
}

const fixtureFlag = args.indexOf("--fixture");
const fixturePath =
  fixtureFlag === -1 ? "tests/fixtures/veterinarians.json" : args[fixtureFlag + 1];
if (!fixturePath) {
  throw new Error("Falta la ruta de --fixture.");
}

const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const fixture of fixtures) {
  const email = normalizeEmail(fixture.email);
  const created = await admin.auth.admin.createUser({
    email,
    password: fixture.password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;

  if (!userId) {
    userId = await findUserIdByEmail(
      async (page) => {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
        if (error) {
          throw error;
        }
        return data;
      },
      email,
      PER_PAGE,
    );
    if (!userId) {
      throw created.error ?? new Error(`No se pudo provisionar ${email}`);
    }
    // Re-running keeps the fixture authoritative: a changed password takes effect.
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: fixture.password,
      email_confirm: true,
    });
    if (updateError) {
      throw updateError;
    }
  }

  const { error } = await admin.from("veterinarians").upsert({
    id: userId,
    clinic_id: clinicId,
    identifier: email,
    display_name: fixture.displayName,
  });
  if (error) {
    throw error;
  }
  console.info(`Provisioned synthetic veterinarian: ${email}`);
}
