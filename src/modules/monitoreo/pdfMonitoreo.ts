import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";
import { formatDecimal } from "../productos/utils";

export async function generarPdfMonitoreo(
  supabase: SupabaseClient,
  monitoreoId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: mon } = await supabase
    .from("monitoreos")
    .select(
      "id, id_cliente, id_parcela, id_zafra, hectares, costo_estimado, productividad_estimada, tiene_siembra, tiene_aplicaciones, tiene_evaluaciones, tiene_cosecha, tiene_rte, concluido"
    )
    .eq("id", monitoreoId)
    .single();
  if (!mon) return;

  const [clienteRes, parcelaRes, zafraRes, siembraRes, aplicacionesRes, evaluacionesRes, cosechaRes, rteRes] = await Promise.all([
    supabase.from("clientes").select("nombre").eq("id", (mon as any).id_cliente).single(),
    supabase.from("parcelas").select("nombre_parcela").eq("id", (mon as any).id_parcela).single(),
    supabase.from("zafras").select("nombre_zafra").eq("id", (mon as any).id_zafra).single(),
    supabase.from("siembra").select("fecha_inicio, fecha_termino, costo_total, costo_ha").eq("id_monitoreo", monitoreoId).maybeSingle(),
    supabase.from("aplicaciones").select("fecha_aplicacion, costo_total, costo_ha").eq("id_monitoreo", monitoreoId).order("fecha_aplicacion", { ascending: true }),
    supabase.from("evaluaciones").select("fecha_evaluacion, descripcion_general").eq("id_monitoreo", monitoreoId).order("fecha_evaluacion", { ascending: true }),
    supabase.from("cosechas").select("fecha_inicio, fecha_termino, resultado_liquido_kg, productividad_bolsas_alq, costo_total").eq("id_monitoreo", monitoreoId).maybeSingle(),
    supabase.from("rte").select("costo_total, ingreso_total, resultado_tecnico").eq("id_monitoreo", monitoreoId).maybeSingle(),
  ]);

  const clienteNombre = (clienteRes.data as any)?.nombre ?? "";
  const parcelaNombre = (parcelaRes.data as any)?.nombre_parcela ?? "";
  const zafraNombre = (zafraRes.data as any)?.nombre_zafra ?? "";
  const siembra = siembraRes.data as { fecha_inicio?: string; fecha_termino?: string; costo_total?: number; costo_ha?: number } | null;
  const aplicaciones = (aplicacionesRes.data ?? []) as { fecha_aplicacion?: string; costo_total?: number; costo_ha?: number }[];
  const evaluaciones = (evaluacionesRes.data ?? []) as { fecha_evaluacion?: string; descripcion_general?: string }[];
  const cosecha = cosechaRes.data as { fecha_inicio?: string; fecha_termino?: string; resultado_liquido_kg?: number; productividad_bolsas_alq?: number; costo_total?: number } | null;
  const rte = rteRes.data as { costo_total?: number; ingreso_total?: number; resultado_tecnico?: number } | null;

  const { doc, startY } = await createReportPdf(supabase, {
    title: "Monitoreo",
    userName: options?.userName,
    generalInfo: {
      cliente: clienteNombre || undefined,
      parcela: parcelaNombre || undefined,
      zafra: zafraNombre || undefined,
    },
  });
  let y = startY;

  const line = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.text(`${label}: ${value}`, MARGIN_X, y);
    y += 5;
  };

  line("Hectáreas", formatDecimal((mon as any).hectares) + " ha");
  line("Costo estimado (USD)", formatDecimal((mon as any).costo_estimado));
  line("Productividad estimada (kg/ha)", formatDecimal((mon as any).productividad_estimada));
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  if (siembra) {
    doc.text("Siembra", MARGIN_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`  Fechas: ${siembra.fecha_inicio ?? "-"} a ${siembra.fecha_termino ?? "-"} | Costo total: ${formatDecimal(siembra.costo_total)} USD | Costo/ha: ${formatDecimal(siembra.costo_ha)}`, MARGIN_X, y);
    y += 6;
  } else if ((mon as any).tiene_siembra) {
    doc.setFont("helvetica", "normal");
    doc.text("Siembra: registrada (sin detalle en este resumen).", MARGIN_X, y);
    y += 6;
  }

  if (aplicaciones.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Aplicaciones", MARGIN_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    aplicaciones.forEach((a) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(`  ${a.fecha_aplicacion ?? "-"} | Costo: ${formatDecimal(a.costo_total)} USD | Costo/ha: ${formatDecimal(a.costo_ha)}`, MARGIN_X, y);
      y += 5;
    });
    y += 2;
  } else if ((mon as any).tiene_aplicaciones) {
    doc.setFont("helvetica", "normal");
    doc.text("Aplicaciones: registradas.", MARGIN_X, y);
    y += 6;
  }

  if (evaluaciones.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Evaluaciones", MARGIN_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    evaluaciones.forEach((e) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const desc = (e.descripcion_general ?? "").slice(0, 60);
      doc.text(`  ${e.fecha_evaluacion ?? "-"}${desc ? " | " + desc : ""}`, MARGIN_X, y);
      y += 5;
    });
    y += 2;
  } else if ((mon as any).tiene_evaluaciones) {
    doc.setFont("helvetica", "normal");
    doc.text("Evaluaciones: registradas.", MARGIN_X, y);
    y += 6;
  }

  if (cosecha) {
    doc.setFont("helvetica", "bold");
    doc.text("Cosecha", MARGIN_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`  Fechas: ${cosecha.fecha_inicio ?? "-"} a ${cosecha.fecha_termino ?? "-"}`, MARGIN_X, y);
    y += 5;
    doc.text(`  Resultado líquido: ${formatDecimal(cosecha.resultado_liquido_kg)} kg | Productividad (bolsas/alq): ${formatDecimal(cosecha.productividad_bolsas_alq)} | Costo total: ${formatDecimal(cosecha.costo_total)} USD`, MARGIN_X, y);
    y += 6;
  } else if ((mon as any).tiene_cosecha) {
    doc.setFont("helvetica", "normal");
    doc.text("Cosecha: registrada.", MARGIN_X, y);
    y += 6;
  }

  if (rte) {
    doc.setFont("helvetica", "bold");
    doc.text("RTE (Resultado Técnico Económico)", MARGIN_X, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`  Costo total: ${formatDecimal(rte.costo_total)} USD | Ingreso total: ${formatDecimal(rte.ingreso_total)} USD | Resultado técnico: ${formatDecimal(rte.resultado_tecnico)} USD`, MARGIN_X, y);
    y += 6;
  } else if ((mon as any).tiene_rte) {
    doc.setFont("helvetica", "normal");
    doc.text("RTE: registrado.", MARGIN_X, y);
    y += 6;
  }
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Monitoreo"), MARGIN_X, y);

  const safeName = [clienteNombre, parcelaNombre, zafraNombre].join("_").replace(/\s+/g, "_").slice(0, 40);
  doc.save(`monitoreo_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
