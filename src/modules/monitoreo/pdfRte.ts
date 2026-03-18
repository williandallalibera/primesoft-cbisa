import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfRte(
  supabase: SupabaseClient,
  rteId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: rte } = await supabase
    .from("rte")
    .select("*, monitoreos(id, clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra))")
    .eq("id", rteId)
    .single();
  if (!rte) return;

  const r = rte as any;
  const mon = r.monitoreos;
  const { doc, startY } = await createReportPdf(supabase, {
    title: "RTE (Resultado Técnico Económico)",
    userName: options?.userName,
    generalInfo: {
      cliente: mon?.clientes?.nombre ?? undefined,
      parcela: mon?.parcelas?.nombre_parcela ?? undefined,
      zafra: mon?.zafras?.nombre_zafra ?? undefined,
    },
  });
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.text(`Costo total (USD): ${formatNum(r.costo_total)}`, MARGIN_X, y);
  y += 6;
  doc.text(`Ingreso total (USD): ${formatNum(r.ingreso_total)}`, MARGIN_X, y);
  y += 6;
  doc.text(`Resultado técnico (USD): ${formatNum(r.resultado_tecnico)}`, MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("RTE"), MARGIN_X, y);

  const safeName = (mon?.clientes?.nombre ?? "rte").substring(0, 20).replace(/\s/g, "_");
  doc.save(`rte_${safeName}.pdf`);
}
