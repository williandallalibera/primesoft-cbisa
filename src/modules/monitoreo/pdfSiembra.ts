import { jsPDF } from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfSiembra(
  supabase: SupabaseClient,
  siembraId: string
): Promise<void> {
  const { data: siembra } = await supabase
    .from("siembra")
    .select("id, id_monitoreo, fecha_inicio, fecha_termino, costo_total, costo_ha")
    .eq("id", siembraId)
    .single();
  if (!siembra) return;

  const { data: monitoreo } = await supabase
    .from("monitoreos")
    .select("id, id_cliente, id_parcela, id_zafra, hectares, clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)")
    .eq("id", (siembra as any).id_monitoreo)
    .single();
  if (!monitoreo) return;

  const { data: items } = await supabase
    .from("siembra_productos")
    .select("*, productos(nombre)")
    .eq("id_siembra", siembraId)
    .order("created_at", { ascending: true });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50);
  doc.text("Primesoft CBISA – Siembra", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const mon = monitoreo as any;
  doc.text(`Cliente: ${mon.clientes?.nombre ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Parcela: ${mon.parcelas?.nombre_parcela ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Zafra: ${mon.zafras?.nombre_zafra ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Área (ha): ${formatNum(mon.hectares)}`, 14, y);
  y += 5;
  doc.text(`Fecha inicio: ${(siembra as any).fecha_inicio ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Fecha término: ${(siembra as any).fecha_termino ?? "-"}`, 14, y);
  y += 8;

  const colWidths = [55, 22, 18, 22, 28];
  const headers = ["Producto", "Cantidad", "Dosis/ha", "Costo/ha", "Importe total"];
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  let x = 14;
  headers.forEach((h, i) => {
    doc.text(h.substring(0, 14), x, y);
    x += colWidths[i];
  });
  y += 6;
  doc.setFont("helvetica", "normal");

  (items ?? []).forEach((it: any) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    x = 14;
    const nombreProducto = it.productos?.nombre ?? "-";
    const row = [
      nombreProducto.substring(0, 28),
      formatNum(it.cantidad),
      formatNum(it.dosis_ha),
      formatNum(it.costo_ha),
      formatNum(it.importe_total),
    ];
    row.forEach((cell, i) => {
      doc.text(String(cell).substring(0, 14), x, y);
      x += colWidths[i];
    });
    y += 5;
  });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Costo total (USD): ${formatNum((siembra as any).costo_total)}`, 14, y);
  y += 5;
  doc.text(`Costo/ha (USD): ${formatNum((siembra as any).costo_ha)}`, 14, y);
  doc.setFont("helvetica", "normal");

  const safeName = (mon.clientes?.nombre ?? "siembra").substring(0, 20).replace(/\s/g, "_");
  doc.save(`siembra_${(siembra as any).fecha_inicio ?? "sin_fecha"}_${safeName}.pdf`);
}
