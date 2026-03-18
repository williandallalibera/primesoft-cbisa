import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
export const supabaseUrl = rawUrl === "YOUR_SUPABASE_URL" ? "" : rawUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
export const supabaseAnonKeyExport = supabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY");

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn("Supabase: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example)");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

