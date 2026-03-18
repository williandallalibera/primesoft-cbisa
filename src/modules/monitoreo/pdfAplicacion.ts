import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfAplicacion(
  supabase: SupabaseClient,
  aplicacionId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: apl } = await supabase
    .from("aplicaciones")
    .select("id, id_monitoreo, fecha_aplicacion, rendimiento_tanque_ha, costo_total, costo_ha, id_tipo_aplicacion, tipo_aplicacion(descripcion)")
    .eq("id", aplicacionId)
    .single();
  if (!apl) return;

  const { data: monitoreo } = await supabase
    .from("monitoreos")
    .select("id, id_cliente, id_parcela, id_zafra, hectares, clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)")
    .eq("id", (apl as any).id_monitoreo)
    .single();
  if (!monitoreo) return;

  const { data: items } = await supabase
    .from("aplicacion_productos")
    .select("*, productos(nombre)")
    .eq("id_aplicacion", aplicacionId)
    .order("created_at", { ascending: true });

  const mon = monitoreo as any;
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Aplicación",
    userName: options?.userName,
    generalInfo: {
      cliente: mon.clientes?.nombre ?? undefined,
      parcela: mon.parcelas?.nombre_parcela ?? undefined,
      zafra: mon.zafras?.nombre_zafra ?? undefined,
    },
  });
  let y = startY;

  doc.setFontSize(10);
  doc.text(`Fecha: ${(apl as any).fecha_aplicacion ?? "-"}`, MARGIN_X, y);
  y += 5;
  const tipoDesc = (apl as any).tipo_aplicacion?.descripcion ?? "-";
  doc.text(`Tipo: ${tipoDesc}`, MARGIN_X, y);
  y += 5;
  doc.text(`Área (ha): ${formatNum(mon.hectares)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Rend. tanque/ha: ${formatNum((apl as any).rendimiento_tanque_ha)}`, MARGIN_X, y);
  y += 8;

  const colWidths = [55, 22, 18, 22, 28];
  const headers = ["Producto", "Cantidad", "Dosis/ha", "Costo/ha", "Importe total"];
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  let x = MARGIN_X;
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
    x = MARGIN_X;
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
  doc.text(`Costo total (USD): ${formatNum((apl as any).costo_total)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Costo/ha (USD): ${formatNum((apl as any).costo_ha)}`, MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Aplicación"), MARGIN_X, y);

  const safeName = (mon.clientes?.nombre ?? "aplicacion").substring(0, 20).replace(/\s/g, "_");
  doc.save(`aplicacion_${(apl as any).fecha_aplicacion ?? "sin_fecha"}_${safeName}.pdf`);
}
