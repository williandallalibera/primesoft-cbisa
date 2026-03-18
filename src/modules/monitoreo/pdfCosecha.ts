import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfCosecha(
  supabase: SupabaseClient,
  cosechaId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: cosecha } = await supabase
    .from("cosechas")
    .select("*, monitoreos(clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)), destinos(nombre)")
    .eq("id", cosechaId)
    .single();
  if (!cosecha) return;

  const c = cosecha as any;
  const mon = c.monitoreos ?? c.monitoreo;
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Cosecha",
    userName: options?.userName,
    generalInfo: {
      cliente: mon?.clientes?.nombre ?? undefined,
      parcela: mon?.parcelas?.nombre_parcela ?? undefined,
      zafra: mon?.zafras?.nombre_zafra ?? undefined,
    },
  });
  let y = startY;

  doc.setFontSize(10);
  doc.text(`Fecha inicio: ${c.fecha_inicio ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Fecha término: ${c.fecha_termino ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Resultado líquido (kg): ${formatNum(c.resultado_liquido_kg)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Productividad (bolsas/alq): ${formatNum(c.productividad_bolsas_alq)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Humedad: ${formatNum(c.humedad)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Costo/bolsa: ${formatNum(c.costo_bolsa)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Costo total (USD): ${formatNum(c.costo_total)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Destino: ${c.destinos?.nombre ?? "-"}`, MARGIN_X, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Cosecha"), MARGIN_X, y);

  const safeName = (mon?.clientes?.nombre ?? "cosecha").substring(0, 20).replace(/\s/g, "_");
  doc.save(`cosecha_${c.fecha_inicio ?? "sin_fecha"}_${safeName}.pdf`);
}
