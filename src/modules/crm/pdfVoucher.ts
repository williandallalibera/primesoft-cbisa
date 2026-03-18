import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";
import { formatDecimal } from "../productos/utils";

export async function generarPdfVoucher(
  supabase: SupabaseClient,
  voucherId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: v } = await supabase
    .from("vouchers")
    .select("id, id_cliente, valor_total_generado, valor_total_liberado, valor_restante")
    .eq("id", voucherId)
    .single();
  if (!v) return;

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre")
    .eq("id", (v as any).id_cliente)
    .single();

  const { data: movimientos } = await supabase
    .from("movimiento_vouchers")
    .select("fecha, tipo, valor_generado, valor_liberado")
    .eq("id_voucher", voucherId)
    .order("fecha", { ascending: false })
    .limit(30);

  const nombreCliente = (cliente as any)?.nombre ?? "";
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Voucher",
    userName: options?.userName,
    generalInfo: { cliente: nombreCliente || undefined },
  });
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.text(`Valor total generado (USD): ${formatDecimal((v as any).valor_total_generado)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Valor total liberado (USD): ${formatDecimal((v as any).valor_total_liberado)}`, MARGIN_X, y);
  y += 5;
  doc.text(`Valor restante (USD): ${formatDecimal((v as any).valor_restante)}`, MARGIN_X, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const movs = (movimientos ?? []) as { fecha: string; tipo: string; valor_generado?: number | null; valor_liberado?: number | null }[];
  if (movs.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Movimientos recientes", MARGIN_X, y);
    y += 5;
    const colW = [45, 28, 32, 32];
    doc.text("Fecha", MARGIN_X, y);
    doc.text("Tipo", MARGIN_X + colW[0], y);
    doc.text("Generado", MARGIN_X + colW[0] + colW[1], y);
    doc.text("Liberado", MARGIN_X + colW[0] + colW[1] + colW[2], y);
    y += 5;
    doc.setFont("helvetica", "normal");
    movs.forEach((m) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(m.fecha).toLocaleDateString("es-PY"), MARGIN_X, y);
      doc.text(String(m.tipo), MARGIN_X + colW[0], y);
      doc.text(formatDecimal(m.valor_generado), MARGIN_X + colW[0] + colW[1], y);
      doc.text(formatDecimal(m.valor_liberado), MARGIN_X + colW[0] + colW[1] + colW[2], y);
      y += 5;
    });
  }
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Voucher"), MARGIN_X, y);

  const fileName = `voucher_${nombreCliente.replace(/\s+/g, "_").slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
