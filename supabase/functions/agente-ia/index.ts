// Edge Function: chat con OpenAI usando contexto del banco (clientes, propuestas, vouchers, etc.).
// La API key se lee de public.integraciones.api_openai (configurar en Ajustes → Integraciones).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getContextoBanco(supabaseAdmin: ReturnType<typeof createClient>) {
  const hoy = new Date().toISOString().slice(0, 10);

  const [
    clientes,
    propuestasHoy,
    propuestasTotal,
    vouchers,
    evaluaciones,
    parcelas,
    monitoreos,
  ] = await Promise.all([
    supabaseAdmin
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "activo"),
    supabaseAdmin
      .from("propuestas")
      .select("total_general")
      .eq("fecha", hoy),
    supabaseAdmin
      .from("propuestas")
      .select("total_general"),
    supabaseAdmin
      .from("vouchers")
      .select("valor_restante, valor_total_generado"),
    supabaseAdmin
      .from("evaluaciones")
      .select("id", { count: "exact", head: true })
      .eq("fecha_proxima_evaluacion", hoy),
    supabaseAdmin
      .from("parcelas")
      .select("area_real_ha, estado"),
    supabaseAdmin
      .from("monitoreos")
      .select("id, concluido"),
  ]);

  const totalPropuestasHoy = (propuestasHoy.data ?? []).reduce(
    (a: number, p: any) => a + (p.total_general ?? 0),
    0,
  );
  const totalPropuestasHistorico = (propuestasTotal.data ?? []).reduce(
    (a: number, p: any) => a + (p.total_general ?? 0),
    0,
  );
  const totalVouchersPendentes = (vouchers.data ?? []).reduce(
    (a: number, v: any) => a + (v.valor_restante ?? 0),
    0,
  );
  const totalVouchersGerados = (vouchers.data ?? []).reduce(
    (a: number, v: any) => a + (v.valor_total_generado ?? 0),
    0,
  );
  const parcelasAtivas = (parcelas.data ?? []).filter(
    (p: any) => (p.estado ?? "activo") === "activo",
  );
  const totalParcelasAtivas = parcelasAtivas.length;
  const areaTotalParcelasHa = parcelasAtivas.reduce(
    (a: number, p: any) => a + (p.area_real_ha ?? 0),
    0,
  );
  const monitoreosLista = (monitoreos.data ?? []) as any[];
  const totalMonitoreos = monitoreosLista.length;
  const monitoreosConcluidos = monitoreosLista.filter(
    (m) => m.concluido === true,
  ).length;

  return {
    fecha: hoy,
    // Clientes / CRM
    clientes_activos: clientes.count ?? 0,
    propuestas_hoy: (propuestasHoy.data ?? []).length,
    total_propuestas_hoy_usd: totalPropuestasHoy.toFixed(2),
    total_propuestas_historico_usd: totalPropuestasHistorico.toFixed(2),
    // Vouchers
    vouchers_restante_usd: totalVouchersPendentes.toFixed(2),
    vouchers_generado_usd: totalVouchersGerados.toFixed(2),
    // Evaluaciones / visitas
    evaluaciones_programadas_hoy: evaluaciones.count ?? 0,
    // Parcelas / monitoreos
    parcelas_activas: totalParcelasAtivas,
    area_total_parcelas_ha: areaTotalParcelasHa.toFixed(2),
    monitoreos_total: totalMonitoreos,
    monitoreos_concluidos: monitoreosConcluidos,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: int } = await supabaseAdmin
    .from("integraciones")
    .select("api_openai")
    .limit(1)
    .maybeSingle();
  const apiKey = (int as any)?.api_openai?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Configure la clave OpenAI en Ajustes → Integraciones." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: { message: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const { message, history = [] } = body;
  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "message es obligatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contexto = await getContextoBanco(supabaseAdmin);
  const systemContent = `Eres un asistente del sistema Primesoft CBISA (gestión agrícola). Responde en español de forma breve y clara.
Datos actuales del sistema (usa estos para responder y para hacer cálculos adicionales cuando sea necesario):
- Clientes activos: ${contexto.clientes_activos}
- Propuestas de hoy (${contexto.fecha}): ${contexto.propuestas_hoy} propuestas, total ${contexto.total_propuestas_hoy_usd} USD
- Total histórico de propuestas: ${contexto.total_propuestas_historico_usd} USD
- Evaluaciones programadas para hoy: ${contexto.evaluaciones_programadas_hoy}
- Vouchers generados (histórico): ${contexto.vouchers_generado_usd} USD
- Vouchers pendientes de liberación: ${contexto.vouchers_restante_usd} USD
- Parcelas activas: ${contexto.parcelas_activas}, área total: ${contexto.area_total_parcelas_ha} ha
- Monitoreos: ${contexto.monitoreos_total} en total, de los cuales ${contexto.monitoreos_concluidos} concluidos

Si el usuario pregunta por clientes, propuestas, vouchers, parcelas, área, monitoreos o evaluaciones, usa estos datos y explica de forma sencilla.
Si pregunta sobre períodos (por ejemplo "este mes", "año pasado"), aclara que estás utilizando los datos agregados más recientes que tienes disponibles.
Si pregunta otra cosa, responde según el contexto del negocio agrícola sin inventar números adicionales.`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemContent },
    ...history.slice(-10).map((m) => ({
      role: m.role === "ia" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: message.trim() },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 600,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "OpenAI: " + (err || res.statusText) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
  return new Response(
    JSON.stringify({ response: reply }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
