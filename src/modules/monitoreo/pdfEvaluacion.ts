import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportPdf, MARGIN_X, getDefaultNotas } from "../../lib/pdfReportTemplate";

export async function generarPdfEvaluacion(
  supabase: SupabaseClient,
  evaluacionId: string,
  options?: { userName?: string }
): Promise<void> {
  const { data: ev } = await supabase
    .from("evaluaciones")
    .select("*, monitoreos(clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)), etapas_fenologicas(descripcion), vigor(descripcion), estres_hidrico(descripcion), clima_reciente(descripcion)")
    .eq("id", evaluacionId)
    .single();
  if (!ev) return;

  const { data: plagasData } = await supabase.from("evaluacion_plagas").select("id_plaga, plagas(descripcion)").eq("id_evaluacion", evaluacionId);
  const { data: enfData } = await supabase.from("evaluacion_enfermedades").select("id_enfermedad, enfermedades(descripcion)").eq("id_evaluacion", evaluacionId);
  const { data: malezasData } = await supabase.from("evaluacion_malezas").select("id_maleza, malezas(descripcion)").eq("id_evaluacion", evaluacionId);

  const e = ev as any;
  const mon = e.monitoreos ?? e.monitoreo;
  const { doc, startY } = await createReportPdf(supabase, {
    title: "Evaluación",
    userName: options?.userName,
    generalInfo: {
      cliente: mon?.clientes?.nombre ?? undefined,
      parcela: mon?.parcelas?.nombre_parcela ?? undefined,
      zafra: mon?.zafras?.nombre_zafra ?? undefined,
    },
  });
  let y = startY;

  doc.setFontSize(10);
  doc.text(`Fecha evaluación: ${e.fecha_evaluacion ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Etapa fenológica: ${e.etapas_fenologicas?.descripcion ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Vigor: ${e.vigor?.descripcion ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Estrés hídrico: ${e.estres_hidrico?.descripcion ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Clima reciente: ${e.clima_reciente?.descripcion ?? "-"}`, MARGIN_X, y);
  y += 5;
  doc.text(`Próxima evaluación: ${e.fecha_proxima_evaluacion ?? "-"}`, MARGIN_X, y);
  y += 6;
  if (e.descripcion_general) {
    const lines = doc.splitTextToSize(e.descripcion_general, 180);
    doc.text("Descripción:", MARGIN_X, y);
    y += 5;
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 5 + 4;
  }
  const plagasList = (plagasData as any[])?.map((p) => p.plagas?.descripcion).filter(Boolean).join(", ") || "-";
  const enfList = (enfData as any[])?.map((x) => x.enfermedades?.descripcion).filter(Boolean).join(", ") || "-";
  const malezasList = (malezasData as any[])?.map((x) => x.malezas?.descripcion).filter(Boolean).join(", ") || "-";
  doc.text(`Plagas: ${plagasList}`, MARGIN_X, y);
  y += 5;
  doc.text(`Enfermedades: ${enfList}`, MARGIN_X, y);
  y += 5;
  doc.text(`Malezas: ${malezasList}`, MARGIN_X, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Notas:", MARGIN_X, y);
  y += 4;
  doc.text(getDefaultNotas("Evaluación"), MARGIN_X, y);

  const safeName = (mon?.clientes?.nombre ?? "evaluacion").substring(0, 20).replace(/\s/g, "_");
  doc.save(`evaluacion_${e.fecha_evaluacion ?? "sin_fecha"}_${safeName}.pdf`);
}
