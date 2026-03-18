import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";

/** Valores en USD: 2 decimales */
function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(2);
}

/** Cantidad y dosificación: 3 decimales */
function formatCant(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(3);
}

export async function generarPdfPropuesta(
  supabase: SupabaseClient,
  propuestaId: string,
  conMargenYCosto: boolean,
  options?: { userName?: string }
): Promise<void> {
  const { data: prop } = await supabase
    .from("propuestas")
    .select(
      "id, sku, fecha, total_general, total_voucher, total_items, id_cliente, clientes(nombre)"
    )
    .eq("id", propuestaId)
    .single();
  if (!prop) return;

  const { data: items } = await supabase
    .from("productos_propuesta")
    .select("*, productos(nombre)")
    .eq("id_propuesta", propuestaId)
    .order("created_at", { ascending: true });

  const clienteNombre = (prop as any).clientes?.nombre ?? "";
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Propuesta",
    subtitle: conMargenYCosto ? "PDF gerencial – composición de precio" : undefined,
    userName: options?.userName,
    generalInfo: { cliente: clienteNombre || undefined },
  });
  let y = startY;

  doc.setFontSize(10);
  doc.text(`Fecha: ${(prop as any).fecha}`, MARGIN_X, y);
  y += 6;
  if ((prop as any).sku) {
    doc.text(`SKU: ${(prop as any).sku}`, MARGIN_X, y);
    y += 6;
  }
  y += 7;

  const productos = (items ?? []) as any[];

  if (conMargenYCosto) {
    // PDF gerencial: tabla con composición de precio (columnas más anchas para evitar solapamiento)
    const colW = [32, 14, 16, 14, 16, 14, 14, 16, 14, 14, 18, 18];
    const headers = [
      "Producto",
      "Cant",
      "P. compra",
      "Margen",
      "P. venta",
      "C. oper.",
      "C. fin.",
      "Bonif. cl.",
      "Voucher",
      "P. mín.",
      "Impacto cost.",
      "Importe",
    ];
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    let x = MARGIN_X;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colW[i];
    });
    y += 7;
    doc.setFont("helvetica", "normal");

    productos.forEach((it) => {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      x = MARGIN_X;
      const nombreProducto = (it as any).productos?.nombre ?? (it as any).nombre ?? "-";
      const row = [
        nombreProducto.substring(0, 18),
        formatCant(it.cantidad),
        formatUsd(it.precio_compra_base),
        formatUsd(it.margen_base),
        formatUsd(it.precio_final_base ?? it.precio_producto),
        formatUsd(it.costo_operacional_base),
        formatUsd(it.costo_financiero_base),
        formatUsd(it.bonificacion_cliente_base),
        formatUsd(it.voucher),
        formatUsd(it.precio_minimo),
        formatUsd(it.impacto_total_costo_base),
        formatUsd(it.importe_total),
      ];
      row.forEach((cell, i) => {
        doc.text(String(cell), x, y);
        x += colW[i];
      });
      y += 6;
    });
  } else {
    // PDF simple: producto, cantidad, dosis, área, costo/ha, importe (cant/dosis 3 dec, USD 2 dec)
    const colWidths = [55, 22, 18, 22, 25, 28];
    const headers = ["Producto", "Cantidad", "Dosis/ha", "Área tratada", "Costo/ha", "Importe total"];
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    let x = MARGIN_X;
    headers.forEach((h, i) => {
      doc.text(h.substring(0, 12), x, y);
      x += colWidths[i];
    });
    y += 6;
    doc.setFont("helvetica", "normal");

    productos.forEach((it) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      x = MARGIN_X;
      const nombreProducto = (it as any).productos?.nombre ?? (it as any).nombre ?? "-";
      const row = [
        nombreProducto.substring(0, 28),
        formatCant(it.cantidad),
        formatCant(it.dosis_ha),
        formatCant(it.area_tratada),
        formatUsd(it.costo_ha),
        formatUsd(it.importe_total),
      ];
      row.forEach((cell, i) => {
        doc.text(String(cell).substring(0, 14), x, y);
        x += colWidths[i];
      });
      y += 5;
    });
  }

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text(`Total ítems: ${(prop as any).total_items ?? 0}`, MARGIN_X, y);
  y += 6;
  doc.text(`Total general (USD): ${formatUsd((prop as any).total_general)}`, MARGIN_X, y);
  if ((prop as any).total_voucher) {
    y += 6;
    doc.text(`Total voucher (USD): ${formatUsd((prop as any).total_voucher)}`, MARGIN_X, y);
  }
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 5;
  doc.text(getDefaultNotas("Propuesta"), MARGIN_X, y);

  doc.save(
    `propuesta_${(prop as any).fecha}_${clienteNombre.substring(0, 20).replace(/\s/g, "_")}.pdf`
  );
}
