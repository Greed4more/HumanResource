import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createSupabaseClient() {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL");
  const supabaseKey = readEnv("VITE_SUPABASE_ANON_KEY") ?? readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("YOUR_PROJECT_REF") ||
    supabaseKey.includes("REPLACE_ME")
  ) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let client: ReturnType<typeof createSupabaseClient> | undefined;

// Lazily create the client so builds work without env vars, but any real use
// fails with a clear message instead of a confusing network error.
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!client) client = createSupabaseClient();
    return Reflect.get(client, prop, receiver);
  },
});
