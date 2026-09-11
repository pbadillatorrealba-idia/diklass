import { createClient } from "@supabase/supabase-js";
import { createPlatformAuthStorage } from "@/lib/storage/platform-auth-storage";
import type { Database } from "@/lib/supabase/database.types";

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

const supabaseUrl = configuredUrl ?? "https://placeholder.invalid";
const supabaseAnonKey = configuredAnonKey ?? "public-anon-key-not-configured";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createPlatformAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
