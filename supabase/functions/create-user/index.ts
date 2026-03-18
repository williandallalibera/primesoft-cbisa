// Edge Function: crea un usuario en Auth + public.usuarios sin cambiar la sesión del admin.
// Solo administradores pueden llamarla. Usa Admin API para no hacer auto-login del nuevo usuario.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let body: { email: string; password: string; nombre: string; perfil_acceso: string; ci?: string; telefono?: string; estado?: string; id_cliente?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const { email, password, nombre, perfil_acceso, ci, telefono, estado, id_cliente } = body;
  if (!email?.trim() || !password?.trim()) {
    return new Response(
      JSON.stringify({ error: "email y password son obligatorios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
    user_metadata: { nombre: nombre?.trim() || "Usuario", perfil_acceso: perfil_acceso || "cliente" },
  });

  if (createError) {
    return new Response(
      JSON.stringify({ error: createError.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!newUser.user?.id) {
    return new Response(
      JSON.stringify({ error: "No se creó el usuario" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: insertError } = await supabaseAdmin.from("usuarios").insert({
    id: newUser.user.id,
    nombre: nombre?.trim() || newUser.user.email ?? "Usuario",
    email: newUser.user.email ?? email.trim(),
    perfil_acceso: perfil_acceso || "cliente",
    estado: estado || "activo",
    ci: ci?.trim() || null,
    telefono: telefono?.trim() || null,
  });
  if (insertError) {
    return new Response(
      JSON.stringify({ error: "Error al crear registro en usuarios: " + insertError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (id_cliente?.trim()) {
    const { error: updateClienteError } = await supabaseAdmin
      .from("clientes")
      .update({ id_usuario_auth: newUser.user.id })
      .eq("id", id_cliente.trim());
    if (updateClienteError) {
      return new Response(
        JSON.stringify({ error: "Usuario creado pero error al vincular cliente: " + updateClienteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true, user_id: newUser.user.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
