import { jsPDF } from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfCosecha(
  supabase: SupabaseClient,
  cosechaId: string
): Promise<void> {
  const { data: cosecha } = await supabase
    .from("cosechas")
    .select("*, monitoreos(clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)), destinos(nombre)")
    .eq("id", cosechaId)
    .single();
  if (!cosecha) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50);
  doc.text("Primesoft CBISA – Cosecha", 14, y);
  y += 8;

  const c = cosecha as any;
  const mon = c.monitoreos ?? c.monitoreo;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cliente: ${mon?.clientes?.nombre ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Parcela: ${mon?.parcelas?.nombre_parcela ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Zafra: ${mon?.zafras?.nombre_zafra ?? "-"}`, 14, y);
  y += 6;
  doc.text(`Fecha inicio: ${c.fecha_inicio ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Fecha término: ${c.fecha_termino ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Resultado líquido (kg): ${formatNum(c.resultado_liquido_kg)}`, 14, y);
  y += 5;
  doc.text(`Productividad (bolsas/alq): ${formatNum(c.productividad_bolsas_alq)}`, 14, y);
  y += 5;
  doc.text(`Humedad: ${formatNum(c.humedad)}`, 14, y);
  y += 5;
  doc.text(`Costo/bolsa: ${formatNum(c.costo_bolsa)}`, 14, y);
  y += 5;
  doc.text(`Costo total (USD): ${formatNum(c.costo_total)}`, 14, y);
  y += 5;
  doc.text(`Destino: ${c.destinos?.nombre ?? "-"}`, 14, y);

  const safeName = (mon?.clientes?.nombre ?? "cosecha").substring(0, 20).replace(/\s/g, "_");
  doc.save(`cosecha_${c.fecha_inicio ?? "sin_fecha"}_${safeName}.pdf`);
}
