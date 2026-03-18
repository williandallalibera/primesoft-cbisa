import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { generarPdfCosecha } from "./pdfCosecha";

export interface MonitoreoForModal {
  id: string;
  hectares: number | null;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

interface CosechaModalProps {
  cosechaId: string;
  monitoreo: MonitoreoForModal;
  areaHa: number | null;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function CosechaModal({ cosechaId, monitoreo, areaHa, onClose, onSaved, readOnly = false }: CosechaModalProps) {
  const { perfil } = useAuth();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTermino, setFechaTermino] = useState("");
  const [resultadoLiquidoKgHa, setResultadoLiquidoKgHa] = useState("");
  const [humedad, setHumedad] = useState("");
  const [costoBolsa, setCostoBolsa] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [destinos, setDestinos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const currentArea = areaHa ?? monitoreo.hectares ?? 0;

  const calculated = useMemo(() => {
    const kgHa = Number(resultadoLiquidoKgHa) || 0;
    const area = currentArea;
    const cBolsa = Number(costoBolsa) || 0;

    const resultadoTotal = area > 0 ? kgHa * area : 0;
    const totalBolsas = resultadoTotal / 60;
    const productividadBolsasAlq = kgHa > 0 ? (kgHa / 60) * 2.42 : 0;
    const costoTotal = totalBolsas > 0 && cBolsa > 0 ? totalBolsas * cBolsa : 0;

    return { kgHa, resultadoTotal, totalBolsas, productividadBolsasAlq, costoTotal };
  }, [resultadoLiquidoKgHa, currentArea, costoBolsa]);

  useEffect(() => {
    const load = async () => {
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        setDestinos([{ id: "d-1", nombre: "Cargill" }, { id: "d-2", nombre: "ADM" }, { id: "d-3", nombre: "Lar" }]);
        const mockCosechas: Record<string, { fecha_inicio: string; fecha_termino: string; resultado_liquido_kg: number; productividad_bolsas_alq: number; humedad: number; costo_bolsa: number; costo_total: number }> = {
          "c-3": { fecha_inicio: "2025-02-10", fecha_termino: "2025-02-25", resultado_liquido_kg: 660000, productividad_bolsas_alq: 2662, humedad: 13.5, costo_bolsa: 95, costo_total: 252890 },
          "c-4": { fecha_inicio: "2025-01-15", fecha_termino: "2025-01-28", resultado_liquido_kg: 126000, productividad_bolsas_alq: 508.2, humedad: 14, costo_bolsa: 92, costo_total: 46754.4 },
        };
        const mock = mockCosechas[cosechaId];
        if (mock) {
          setFechaInicio(mock.fecha_inicio);
          setFechaTermino(mock.fecha_termino);
          setResultadoLiquidoKgHa(String(mock.resultado_liquido_kg));
          setHumedad(String(mock.humedad));
          setCostoBolsa(String(mock.costo_bolsa));
        } else {
          setFechaInicio(new Date().toISOString().slice(0, 10));
        }
        setLoading(false);
        return;
      }
      const { data: c } = await supabase.from("cosechas").select("*").eq("id", cosechaId).single();
      if (c) {
        const x = c as any;
        setFechaInicio(x.fecha_inicio ?? "");
        setFechaTermino(x.fecha_termino ?? "");
        setResultadoLiquidoKgHa(String(x.resultado_liquido_kg ?? ""));
        setHumedad(String(x.humedad ?? ""));
        setCostoBolsa(String(x.costo_bolsa ?? ""));
        setIdDestino(x.id_destino ?? "");
      }
      const { data: d } = await supabase.from("destinos").select("id, nombre");
      setDestinos((d as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, [cosechaId]);

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
    await supabase
      .from("cosechas")
      .update({
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
        resultado_liquido_kg: calculated.resultadoTotal > 0 ? calculated.resultadoTotal : (resultadoLiquidoKgHa !== "" ? Number(resultadoLiquidoKgHa) : null),
        productividad_bolsas_alq: calculated.productividadBolsasAlq > 0 ? calculated.productividadBolsasAlq : null,
        humedad: humedad !== "" ? Number(humedad) : null,
        costo_bolsa: costoBolsa !== "" ? Number(costoBolsa) : null,
        costo_total: calculated.costoTotal > 0 ? calculated.costoTotal : null,
        id_destino: idDestino || null,
      })
      .eq("id", cosechaId);
    setSaving(false);
    onSaved();
    onClose();
  };

  const handlePdf = async () => {
    setGenerandoPdf(true);
    await generarPdfCosecha(supabase, cosechaId, { userName: perfil?.nombre });
    setGenerandoPdf(false);
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
        <i className="fas fa-spinner fa-spin text-agro-primary text-2xl mb-4" />
        <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Cargando...</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-tractor text-sm" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight text-base">Registro de Cosecha</h3>
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
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fecha Inicio</label>
                <input type="date" className={inputCls} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>Fecha Término</label>
                <input type="date" className={inputCls} value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>Área real (ha)</label>
                <input type="text" readOnly className={`${inputCls} bg-gray-50 font-mono cursor-default`} value={currentArea > 0 ? formatDecimal(currentArea) : "-"} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Resultado Líquido (kg/ha)</label>
                <input type="number" step="0.001" className={inputCls} value={resultadoLiquidoKgHa} onChange={(e) => setResultadoLiquidoKgHa(e.target.value)} placeholder="0.000" disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>Humedad (%)</label>
                <input type="number" step="0.001" className={inputCls} value={humedad} onChange={(e) => setHumedad(e.target.value)} placeholder="0.0" disabled={readOnly} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Costo/Bolsa (USD)</label>
                <input type="number" step="0.001" className={inputCls} value={costoBolsa} onChange={(e) => setCostoBolsa(e.target.value)} placeholder="0.00" disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>Destino</label>
                <select className={inputCls} value={idDestino} onChange={(e) => setIdDestino(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione el destino</option>
                  {destinos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resumen calculado */}
            {calculated.kgHa > 0 && currentArea > 0 && (
              <div className="p-5 border border-amber-100 rounded-2xl bg-amber-50/30 space-y-3">
                <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-calculator text-[10px]" /> Resumen de Cosecha
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border border-amber-100 px-4 py-3 text-center">
                    <div className="text-lg font-black text-amber-700">{formatDecimal(calculated.resultadoTotal)}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">kg total</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{formatDecimal(calculated.kgHa)} kg/ha × {formatDecimal(currentArea)} ha</div>
                  </div>
                  <div className="bg-white rounded-xl border border-amber-100 px-4 py-3 text-center">
                    <div className="text-lg font-black text-amber-700">{formatDecimal(calculated.totalBolsas)}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bolsas (60 kg)</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{formatDecimal(calculated.resultadoTotal)} / 60</div>
                  </div>
                  <div className="bg-white rounded-xl border border-amber-100 px-4 py-3 text-center">
                    <div className="text-lg font-black text-amber-700">{formatDecimal(calculated.productividadBolsasAlq)}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bolsas/alq</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">(kg/ha / 60) × 2.42</div>
                  </div>
                  {calculated.costoTotal > 0 && (
                    <div className="bg-white rounded-xl border border-green-200 px-4 py-3 text-center">
                      <div className="text-lg font-black text-agro-primary">${formatDecimal(calculated.costoTotal)}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor cosecha</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{formatDecimal(calculated.totalBolsas)} bolsas × ${formatDecimal(Number(costoBolsa) || 0)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-blue-600 text-sm font-bold transition-all"
              onClick={handlePdf}
              disabled={generandoPdf}
            >
              {generandoPdf ? (
                <><i className="fas fa-spinner fa-spin" /> Generando PDF...</>
              ) : (
                <><i className="fas fa-file-pdf" /> Exportar PDF Cosecha</>
              )}
            </button>
            <div className="flex gap-3">
              <button type="button" className={btnSecondary} onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
              {!readOnly && (
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? (
                  <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                ) : (
                  <><i className="fas fa-save text-xs" /> Guardar Cosecha</>
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
