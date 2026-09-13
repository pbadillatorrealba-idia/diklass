import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

type Fixture = { email: string; password: string; displayName: string };

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clinicId = "00000000-0000-0000-0000-000000000001";

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios para provisioning.");
}

const fixturePath =
  process.argv[2] === "--fixture" ? process.argv[3] : "tests/fixtures/veterinarians.json";
if (!fixturePath) {
  throw new Error("Falta la ruta de --fixture.");
}

const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const fixture of fixtures) {
  const created = await admin.auth.admin.createUser({
    email: fixture.email,
    password: fixture.password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;

  if (!userId && created.error) {
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = users.data.users.find((user) => user.email === fixture.email)?.id;
  }

  if (!userId) {
    throw created.error ?? new Error(`No se pudo provisionar ${fixture.email}`);
  }

  const { error } = await admin.from("veterinarians").upsert({
    id: userId,
    clinic_id: clinicId,
    identifier: fixture.email,
    display_name: fixture.displayName,
  });
  if (error) {
    throw error;
  }
  console.info(`Provisioned synthetic veterinarian: ${fixture.email}`);
}
