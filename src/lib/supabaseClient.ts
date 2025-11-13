import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Supabase environment variables are missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
    );
  }

  if (!browserClient && supabaseUrl && supabaseAnonKey) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      },
    });
  }

  if (!browserClient) {
    throw new Error(
      "Supabase client could not be initialized. Check your environment variables.",
    );
  }

  return browserClient;
}