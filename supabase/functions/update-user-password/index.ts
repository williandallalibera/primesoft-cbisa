// Edge Function: actualiza la contraseña de un usuario por ID (Admin API).
// Solo administradores deben llamarla.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(obj: object, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Configuración del servidor incompleta." }, 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let body: { user_id?: string; new_password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Body JSON inválido" }, 200);
    }
    const user_id = body?.user_id;
    const new_password = body?.new_password;
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      return jsonResponse({ success: false, error: "user_id es obligatorio" }, 200);
    }
    if (!new_password || typeof new_password !== "string" || !new_password.trim()) {
      return jsonResponse({ success: false, error: "new_password es obligatorio" }, 200);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id.trim(), {
      password: new_password.trim(),
    });

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 200);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 200);
  }
});
