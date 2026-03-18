import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { generarPdfRte } from "./pdfRte";

export interface MonitoreoForModal {
  id: string;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
  hectares?: number | null;
}

interface RteModalProps {
  rteId: string;
  monitoreo: MonitoreoForModal;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function RteModal({ rteId, monitoreo, onClose, onSaved, readOnly = false }: RteModalProps) {
  const { perfil } = useAuth();
  // Costos (siembra y aplicaciones vienen de BD; cosecha y otros son editables)
  const [costoSiembra, setCostoSiembra] = useState(0);
  const [costoAplicaciones, setCostoAplicaciones] = useState(0);
  const [costoCosecha, setCostoCosecha] = useState(0);
  const [otrosCostos, setOtrosCostos] = useState("0");

  // Producción (rendimiento viene de cosecha, precio de CBOT; usuario puede editar)
  const [rendimientoActual, setRendimientoActual] = useState("0");
  const [precioVenta, setPrecioVenta] = useState("0");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Cálculos Automáticos
  const inversionTotal = useMemo(() => {
    return costoSiembra + costoAplicaciones + costoCosecha + (Number(otrosCostos) || 0);
  }, [costoSiembra, costoAplicaciones, costoCosecha, otrosCostos]);

  // Ingreso = (rendimiento kg / 60 bolsa) × precio USD/bolsa → USD
  const ingresoTotal = useMemo(() => {
    const kg = Number(rendimientoActual) || 0;
    const precioBolsa = Number(precioVenta) || 0;
    return kg > 0 && precioBolsa > 0 ? (kg / 60) * precioBolsa : 0;
  }, [rendimientoActual, precioVenta]);

  const resultadoRte = useMemo(() => {
    return ingresoTotal - inversionTotal;
  }, [ingresoTotal, inversionTotal]);

  useEffect(() => {
    const load = async () => {
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";

      if (isReviewMode) {
        setCostoSiembra(4500);
        setCostoAplicaciones(3200);
        setOtrosCostos("1500");
        setRendimientoActual("150");
        setPrecioVenta("95");
        setLoading(false);
        return;
      }

      try {
        // 1. Datos guardados del RTE (otros_costos, rendimiento, precio)
        const { data: rteData } = await supabase
          .from("rte")
          .select("*")
          .eq("id", rteId)
          .single();

        if (rteData) {
          const x = rteData as any;
          if (x.otros_costos != null) setOtrosCostos(String(x.otros_costos));
          if (x.rendimiento_actual != null) setRendimientoActual(String(x.rendimiento_actual));
          if (x.precio_venta != null) setPrecioVenta(String(x.precio_venta));
        }

        // 2. Costo Siembra: total desde tabla siembra (un registro por monitoreo)
        const { data: siembraRow } = await supabase
          .from("siembra")
          .select("costo_total")
          .eq("id_monitoreo", monitoreo.id)
          .maybeSingle();
        setCostoSiembra(Number((siembraRow as any)?.costo_total) || 0);

        // 3. Costo Aplicaciones: suma de importe_total de aplicacion_productos
        const { data: apps } = await supabase
          .from("aplicaciones")
          .select("id")
          .eq("id_monitoreo", monitoreo.id);
        if (apps && apps.length > 0) {
          const appIds = apps.map((a: { id: string }) => a.id);
          const { data: prods } = await supabase
            .from("aplicacion_productos")
            .select("importe_total")
            .in("id_aplicacion", appIds);
          const totalApps = (prods ?? []).reduce((acc: number, curr: any) => acc + (Number(curr?.importe_total) || 0), 0);
          setCostoAplicaciones(totalApps);
        }

        // 4. Cosecha: costo_total y resultado_liquido_kg (rendimiento)
        const { data: cosechaRow } = await supabase
          .from("cosechas")
          .select("costo_total, resultado_liquido_kg")
          .eq("id_monitoreo", monitoreo.id)
          .maybeSingle();
        if (cosechaRow) {
          const c = cosechaRow as any;
          setCostoCosecha(Number(c.costo_total) || 0);
          if (c.resultado_liquido_kg != null && !rteData?.rendimiento_actual) setRendimientoActual(String(c.resultado_liquido_kg));
        }

        // 5. Precio venta desde CBOT (cultura de la zafra del monitoreo)
        const { data: monRow } = await supabase.from("monitoreos").select("id_zafra").eq("id", monitoreo.id).single();
        const idZafra = (monRow as any)?.id_zafra;
        if (idZafra && !rteData?.precio_venta) {
          const { data: zafraRow } = await supabase.from("zafras").select("id_cultura").eq("id", idZafra).single();
          const idCultura = (zafraRow as any)?.id_cultura;
          if (idCultura) {
            const { data: cbotRow } = await supabase
              .from("cbot")
              .select("precio_bolsa")
              .eq("id_cultura", idCultura)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if ((cbotRow as any)?.precio_bolsa != null) setPrecioVenta(String((cbotRow as any).precio_bolsa));
          }
        }

      } catch (err) {
        console.error("Error loading RTE data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rteId, monitoreo.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    if (localStorage.getItem("forceAuthReview") === "true") {
      setSaving(false);
      onSaved();
      onClose();
      return;
    }
    // Intentamos actualizar con los nuevos campos por si existen en la tabla
    // Si no existen, Supabase simplemente ignorará o dará error (manejamos con cuidado)
    const updatePayload = {
      costo_total: inversionTotal,
      ingreso_total: ingresoTotal,
      resultado_tecnico: resultadoRte,
      otros_costos: Number(otrosCostos) || 0,
      rendimiento_actual: Number(rendimientoActual) || 0,
      precio_venta: Number(precioVenta) || 0,
    };

    const { error } = await supabase
      .from("rte")
      .update(updatePayload)
      .eq("id", rteId);

    if (error) {
      console.error("Error guardando RTE:", error);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handlePdf = async () => {
    setGenerandoPdf(true);
    await generarPdfRte(supabase, rteId, { userName: perfil?.nombre });
    setGenerandoPdf(false);
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
        <i className="fas fa-spinner fa-spin text-agro-primary text-2xl mb-4" />
        <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Calculando resultados...</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-sm" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight text-base">Resultado Técnico Económico</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6 bg-gray-50/30">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Card 1: Inversión (Costos) */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-file-invoice-dollar" /> Inversión Total
                </h4>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Siembra</span>
                    <span className="font-mono font-bold text-gray-700">${formatDecimal(costoSiembra)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Aplicaciones</span>
                    <span className="font-mono font-bold text-gray-700">${formatDecimal(costoAplicaciones)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Cosecha</span>
                    <span className="font-mono font-bold text-gray-700">${formatDecimal(costoCosecha)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-50">
                    <label className={labelCls}>Otros Costos (Maq/Mano Obra)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 font-bold text-xs">USD</span>
                      <input
                        type="number"
                        className={`${inputCls} pl-12 font-mono text-right`}
                        value={otrosCostos}
                        onChange={(e) => setOtrosCostos(e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Total Costos</span>
                  <span className="text-lg font-black text-red-600 font-mono">${formatDecimal(inversionTotal)}</span>
                </div>
              </div>

              {/* Card 2: Producción (Ingresos) */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-agro-primary uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-seedling" /> Producción Obtenida
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Rendimiento (kg)</label>
                    <div className="relative">
                      <i className="fas fa-weight-hanging absolute left-3 top-3 text-gray-300 text-xs" />
                      <input
                        type="number"
                        className={`${inputCls} pl-8 font-mono text-right`}
                        placeholder="0.00"
                        value={rendimientoActual}
                        onChange={(e) => setRendimientoActual(e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Precio de Venta (USD/bolsa)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 font-bold text-xs">USD</span>
                      <input
                        type="number"
                        className={`${inputCls} pl-12 font-mono text-right`}
                        placeholder="0.00"
                        value={precioVenta}
                        onChange={(e) => setPrecioVenta(e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Total Ingresos</span>
                  <span className="text-lg font-black text-agro-primary font-mono">${formatDecimal(ingresoTotal)}</span>
                </div>
              </div>

              {/* Card 3: Resultado Final */}
              <div className={`p-5 rounded-2xl border-2 shadow-sm flex flex-col justify-between ${resultadoRte >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${resultadoRte >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <i className="fas fa-balance-scale" /> Margen del Lote
                </h4>

                <div className="text-center py-6">
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Resultado Neto por Lote</span>
                  <span className={`text-3xl font-black font-mono ${resultadoRte >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ${formatDecimal(resultadoRte)}
                  </span>
                </div>

                <div className={`mt-2 p-3 rounded-xl text-center ${resultadoRte >= 0 ? 'bg-green-100/50 text-green-800' : 'bg-red-100/50 text-red-800'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wide italic">
                    {resultadoRte >= 0 ? '¡Resultado Positivo! Rentabilidad asegurada.' : 'Atención: Los costos superan los ingresos.'}
                  </span>
                </div>
              </div>

            </div>

          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-blue-600 text-sm font-bold transition-all"
              onClick={handlePdf}
              disabled={generandoPdf}
            >
              {generandoPdf ? (
                <><i className="fas fa-spinner fa-spin" /> Generando...</>
              ) : (
                <><i className="fas fa-file-pdf" /> Exportar Informe Completo</>
              )}
            </button>
            <div className="flex gap-3">
              <button type="button" className={btnSecondary} onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
              {!readOnly && (
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? (
                  <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                ) : (
                  <><i className="fas fa-save text-xs" /> Confirmar y Guardar</>
                )}
              </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
