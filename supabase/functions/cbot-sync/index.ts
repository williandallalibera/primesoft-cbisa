// Edge Function: sincroniza cotizaciones de SOJA desde Yahoo Finance (CBOT).
// Milho y Trigo son manuales (mercado local). Soja: dos mercados CBISA por día:
// - Soja Safrinha: inicio ene, vencimiento jul 2026 (Soja 2026/2027)
// - Soja Safra normal: inicio jul, vencimiento may 2027
// Ejecutar diariamente a las 08:00 America/Asuncion vía cron.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SOJA_SYMBOL = "ZS=F";
// Fórmula Agrofertil/CBISA: tonelada = (bushel_cents * 0.367454) + costo; bolsa = tonelada / 16.666
// bushel en centavos (Yahoo ZS=F); costo puede ser negativo (ej. -110 para restar costos)
const BUSHEL_TO_TON = 0.367454;
const BOLSAS_PER_TON = 16.666; // 1 ton = 1000 kg, bolsa 60 kg

interface YahooQuote {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
}

interface YahooResult {
  meta?: {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: YahooQuote[] };
}

function getLast<T>(arr: (T | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  const v = arr[arr.length - 1];
  return typeof v === "number" ? v : null;
}

async function fetchYahooOHLC(symbol: string): Promise<{ open: number; high: number; low: number; close: number; prevClose: number } | null> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { "User-Agent": "Primesoft-CBISA/1.0" } });
  if (!res.ok) return null;
  const json = await res.json();
  const result: YahooResult | undefined = json?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta ?? {};
  const quote = result.indicators?.quote?.[0];
  const open = getLast(quote?.open) ?? meta.regularMarketPrice ?? null;
  const high = getLast(quote?.high) ?? meta.regularMarketDayHigh ?? meta.regularMarketPrice ?? null;
  const low = getLast(quote?.low) ?? meta.regularMarketDayLow ?? meta.regularMarketPrice ?? null;
  const close = getLast(quote?.close) ?? meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? open ?? close;

  if (close == null) return null;
  return {
    open: open ?? close,
    high: high ?? close,
    low: low ?? close,
    close,
    prevClose: prevClose ?? close,
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let costoSoja: number | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.costo === "number") costoSoja = body.costo;
  } catch {
    // ignore
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (costoSoja === null) {
    try {
      const { data: config } = await supabase
        .from("integraciones")
        .select("costo_cbot_soja")
        .limit(1)
        .maybeSingle();
      const v = config?.costo_cbot_soja;
      costoSoja = typeof v === "number" && !Number.isNaN(v) ? v : 110;
    } catch {
      costoSoja = 110;
    }
  }

  const { data: sojaRow, error: errSoja } = await supabase
    .from("culturas")
    .select("id")
    .eq("codigo", "soja")
    .maybeSingle();

  if (errSoja || !sojaRow?.id) {
    return new Response(
      JSON.stringify({ error: "Cultura soja no encontrada", detail: errSoja?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const ohlc = await fetchYahooOHLC(SOJA_SYMBOL);
  if (!ohlc) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sin datos de Yahoo para soja (ZS=F)" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const bushelCents = ohlc.close;
  const bushelUsd = Math.round((bushelCents / 100) * 1000) / 1000;

  const costo = costoSoja;
  const tonelada = bushelCents * BUSHEL_TO_TON - costo;
  const precioBolsa = Math.round((tonelada / BOLSAS_PER_TON) * 100) / 100;
  const prevTonelada = ohlc.prevClose * BUSHEL_TO_TON - costo;
  const prevBolsa = prevTonelada / BOLSAS_PER_TON;
  const variacion = Math.round((precioBolsa - prevBolsa) * 100) / 100;

  const baseRow = {
    id_cultura: sojaRow.id,
    cierre: bushelUsd,
    apertura: Math.round((ohlc.open / 100) * 1000) / 1000,
    alto: Math.round((ohlc.high / 100) * 1000) / 1000,
    bajo: Math.round((ohlc.low / 100) * 1000) / 1000,
    variacion,
    precio_bolsa: precioBolsa,
    precio_bolsa_simulacion: precioBolsa,
    costo,
  };

  // Mercado CBISA: ano automático. Safrinha = julho do ano atual; Safra normal = maio do ano seguinte
  const currentYear = new Date().getFullYear();
  const SAFRINHA_VENC = `${currentYear}-07-01`;
  const SAFRA_NORMAL_VENC = `${currentYear + 1}-05-01`;

  const inserted: { mercado: string; vencimiento: string; cierre: number }[] = [];
  const errors: { mercado: string; message: string }[] = [];

  for (const venc of [SAFRINHA_VENC, SAFRA_NORMAL_VENC]) {
    const { error: insErr } = await supabase.from("cbot").insert({
      ...baseRow,
      vencimiento: venc,
    });
    if (insErr) {
      errors.push({ mercado: venc, message: insErr.message });
    } else {
      inserted.push({
        mercado: venc === SAFRINHA_VENC ? `Soja ${currentYear}/${currentYear + 1} (Safrinha)` : "Soja Safra normal",
        vencimiento: venc,
        cierre: bushelUsd,
        precio_bolsa: precioBolsa,
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      date: new Date().toISOString().slice(0, 10),
      inserted,
      errors: errors.length ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
