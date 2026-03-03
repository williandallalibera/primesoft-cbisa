import { jsPDF } from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generarPdfEvaluacion(
  supabase: SupabaseClient,
  evaluacionId: string
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

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50);
  doc.text("Primesoft CBISA – Evaluación", 14, y);
  y += 8;

  const e = ev as any;
  const mon = e.monitoreos ?? e.monitoreo;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cliente: ${mon?.clientes?.nombre ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Parcela: ${mon?.parcelas?.nombre_parcela ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Zafra: ${mon?.zafras?.nombre_zafra ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Fecha evaluación: ${e.fecha_evaluacion ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Etapa fenológica: ${e.etapas_fenologicas?.descripcion ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Vigor: ${e.vigor?.descripcion ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Estrés hídrico: ${e.estres_hidrico?.descripcion ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Clima reciente: ${e.clima_reciente?.descripcion ?? "-"}`, 14, y);
  y += 5;
  doc.text(`Próxima evaluación: ${e.fecha_proxima_evaluacion ?? "-"}`, 14, y);
  y += 6;
  if (e.descripcion_general) {
    const lines = doc.splitTextToSize(e.descripcion_general, 180);
    doc.text("Descripción:", 14, y);
    y += 5;
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }
  const plagasList = (plagasData as any[])?.map((p) => p.plagas?.descripcion).filter(Boolean).join(", ") || "-";
  const enfList = (enfData as any[])?.map((x) => x.enfermedades?.descripcion).filter(Boolean).join(", ") || "-";
  const malezasList = (malezasData as any[])?.map((x) => x.malezas?.descripcion).filter(Boolean).join(", ") || "-";
  doc.text(`Plagas: ${plagasList}`, 14, y);
  y += 5;
  doc.text(`Enfermedades: ${enfList}`, 14, y);
  y += 5;
  doc.text(`Malezas: ${malezasList}`, 14, y);

  const safeName = (mon?.clientes?.nombre ?? "evaluacion").substring(0, 20).replace(/\s/g, "_");
  doc.save(`evaluacion_${e.fecha_evaluacion ?? "sin_fecha"}_${safeName}.pdf`);
}
