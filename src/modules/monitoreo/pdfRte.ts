import { jsPDF } from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfRte(
  supabase: SupabaseClient,
  rteId: string
): Promise<void> {
  const { data: rte } = await supabase
    .from("rte")
    .select("*, monitoreos(id, clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra))")
    .eq("id", rteId)
    .single();
  if (!rte) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50);
  doc.text("Primesoft CBISA – RTE (Resultado Técnico Económico)", 14, y);
  y += 8;

  const r = rte as any;
  const mon = r.monitoreos;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cliente: ${mon?.clientes?.nombre ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Parcela: ${mon?.parcelas?.nombre_parcela ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Zafra: ${mon?.zafras?.nombre_zafra ?? "-"}`, 14, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Costo total (USD): ${formatNum(r.costo_total)}`, 14, y);
  y += 6;
  doc.text(`Ingreso total (USD): ${formatNum(r.ingreso_total)}`, 14, y);
  y += 6;
  doc.text(`Resultado técnico (USD): ${formatNum(r.resultado_tecnico)}`, 14, y);
  doc.setFont("helvetica", "normal");

  const safeName = (mon?.clientes?.nombre ?? "rte").substring(0, 20).replace(/\s/g, "_");
  doc.save(`rte_${safeName}.pdf`);
}
