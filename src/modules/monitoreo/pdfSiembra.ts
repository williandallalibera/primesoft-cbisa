import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReportPdf,
  MARGIN_X,
  addReportImage,
  getDefaultNotas,
} from "../../lib/pdfReportTemplate";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

const PARCEL_IMAGE_MM = 28;

export async function generarPdfSiembra(
  supabase: SupabaseClient,
  siembraId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: siembra } = await supabase
    .from("siembra")
    .select("id, id_monitoreo, fecha_inicio, fecha_termino, costo_total, costo_ha")
    .eq("id", siembraId)
    .single();
  if (!siembra) return;

  const { data: monitoreo } = await supabase
    .from("monitoreos")
    .select("id, id_cliente, id_parcela, id_zafra, hectares, clientes(nombre), parcelas(nombre_parcela, thumbnail_url), zafras(nombre_zafra)")
    .eq("id", (siembra as any).id_monitoreo)
    .single();
  if (!monitoreo) return;

  const { data: items } = await supabase
    .from("siembra_productos")
    .select("*, productos(nombre)")
    .eq("id_siembra", siembraId)
    .order("created_at", { ascending: true });

  const mon = monitoreo as any;
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Siembra",
    userName: options?.userName,
    generalInfo: {
      cliente: mon.clientes?.nombre ?? undefined,
      parcela: mon.parcelas?.nombre_parcela ?? undefined,
      zafra: mon.zafras?.nombre_zafra ?? undefined,
    },
  });
  let y = startY;

  // 2. DETALLES DE LA OPERACIÓN (imagen parcela + datos)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("2. DETALLES DE LA OPERACIÓN", MARGIN_X, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  const parcelThumb = mon.parcelas?.thumbnail_url;
  const textStartX = parcelThumb ? MARGIN_X + PARCEL_IMAGE_MM + 4 : MARGIN_X;
  if (parcelThumb) {
    const drawn = await addReportImage(supabase, doc, parcelThumb, MARGIN_X, y, PARCEL_IMAGE_MM, PARCEL_IMAGE_MM);
    if (drawn) {
      doc.text(`Área Total: ${formatNum(mon.hectares)} ha`, textStartX, y + 4);
      doc.text(`Fecha de Inicio: ${(siembra as any).fecha_inicio ?? "-"}`, textStartX, y + 9);
      doc.text(`Fecha de Término: ${(siembra as any).fecha_termino ?? "-"}`, textStartX, y + 14);
      y += PARCEL_IMAGE_MM + 4;
    } else {
      doc.text(`Área Total: ${formatNum(mon.hectares)} ha`, textStartX, y + 4);
      doc.text(`Fecha de Inicio: ${(siembra as any).fecha_inicio ?? "-"}`, textStartX, y + 9);
      doc.text(`Fecha de Término: ${(siembra as any).fecha_termino ?? "-"}`, textStartX, y + 14);
      y += 20;
    }
  } else {
    doc.text(`Área Total: ${formatNum(mon.hectares)} ha`, MARGIN_X, y + 4);
    doc.text(`Fecha de Inicio: ${(siembra as any).fecha_inicio ?? "-"}`, MARGIN_X, y + 9);
    doc.text(`Fecha de Término: ${(siembra as any).fecha_termino ?? "-"}`, MARGIN_X, y + 14);
    y += 22;
  }

  // 3. DETALLE DE INSUMOS
  doc.setFont("helvetica", "bold");
  doc.text("3. DETALLE DE INSUMOS", MARGIN_X, y);
  y += 6;
  const colWidths = [55, 22, 18, 22, 28];
  const headers = ["Producto", "Cantidad", "Dosis/ha", "Costo/ha", "Importe Total"];
  doc.setFontSize(9);
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

  // 4. RESUMEN FINANCIERO (USD)
  doc.setFont("helvetica", "bold");
  doc.text("4. RESUMEN FINANCIERO (USD)", MARGIN_X, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Costo por Hectárea: ${formatNum((siembra as any).costo_ha)}`, MARGIN_X, y);
  y += 5;
  doc.text(`COSTO TOTAL: ${formatNum((siembra as any).costo_total)}`, MARGIN_X, y);
  y += 8;

  // Notas
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Siembra"), MARGIN_X, y);

  const safeName = (mon.clientes?.nombre ?? "siembra").substring(0, 20).replace(/\s/g, "_");
  doc.save(`siembra_${(siembra as any).fecha_inicio ?? "sin_fecha"}_${safeName}.pdf`);
}
