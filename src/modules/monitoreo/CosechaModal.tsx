import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDecimal } from "../productos/utils";
import { generarPdfCosecha } from "./pdfCosecha";

export interface MonitoreoForModal {
  id: string;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

interface CosechaModalProps {
  cosechaId: string;
  monitoreo: MonitoreoForModal;
  onClose: () => void;
  onSaved: () => void;
}

export function CosechaModal({ cosechaId, monitoreo, onClose, onSaved }: CosechaModalProps) {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTermino, setFechaTermino] = useState("");
  const [resultadoLiquidoKg, setResultadoLiquidoKg] = useState("");
  const [productividadBolsasAlq, setProductividadBolsasAlq] = useState("");
  const [humedad, setHumedad] = useState("");
  const [costoBolsa, setCostoBolsa] = useState("");
  const [costoTotal, setCostoTotal] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [destinos, setDestinos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("cosechas").select("*").eq("id", cosechaId).single();
      if (c) {
        const x = c as any;
        setFechaInicio(x.fecha_inicio ?? "");
        setFechaTermino(x.fecha_termino ?? "");
        setResultadoLiquidoKg(String(x.resultado_liquido_kg ?? ""));
        setProductividadBolsasAlq(String(x.productividad_bolsas_alq ?? ""));
        setHumedad(String(x.humedad ?? ""));
        setCostoBolsa(String(x.costo_bolsa ?? ""));
        setCostoTotal(String(x.costo_total ?? ""));
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
    setSaving(true);
    await supabase
      .from("cosechas")
      .update({
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
        resultado_liquido_kg: resultadoLiquidoKg !== "" ? Number(resultadoLiquidoKg) : null,
        productividad_bolsas_alq: productividadBolsasAlq !== "" ? Number(productividadBolsasAlq) : null,
        humedad: humedad !== "" ? Number(humedad) : null,
        costo_bolsa: costoBolsa !== "" ? Number(costoBolsa) : null,
        costo_total: costoTotal !== "" ? Number(costoTotal) : null,
        id_destino: idDestino || null,
      })
      .eq("id", cosechaId);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (loading) {
    return (
      <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-body text-center py-5">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              Cosecha – {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
            </h5>
            <button type="button" className="close text-white" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row mb-2">
                <div className="col-md-3">
                  <label className="form-label">Fecha inicio</label>
                  <input type="date" className="form-control form-control-sm" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha término</label>
                  <input type="date" className="form-control form-control-sm" value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Resultado líquido (kg)</label>
                  <input type="number" step="0.001" className="form-control form-control-sm" value={resultadoLiquidoKg} onChange={(e) => setResultadoLiquidoKg(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Productividad (bolsas/alq)</label>
                  <input type="number" step="0.001" className="form-control form-control-sm" value={productividadBolsasAlq} onChange={(e) => setProductividadBolsasAlq(e.target.value)} />
                </div>
              </div>
              <div className="row mb-2">
                <div className="col-md-3">
                  <label className="form-label">Humedad</label>
                  <input type="number" step="0.001" className="form-control form-control-sm" value={humedad} onChange={(e) => setHumedad(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Costo/bolsa</label>
                  <input type="number" step="0.001" className="form-control form-control-sm" value={costoBolsa} onChange={(e) => setCostoBolsa(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Costo total (USD)</label>
                  <input type="number" step="0.001" className="form-control form-control-sm" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Destino</label>
                  <select className="form-control form-control-sm" value={idDestino} onChange={(e) => setIdDestino(e.target.value)}>
                    <option value="">Seleccione</option>
                    {destinos.map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button type="button" className="btn btn-info" onClick={() => generarPdfCosecha(supabase, cosechaId)} disabled={generandoPdf}>
                {generandoPdf ? "Generando..." : "Generar PDF"}
              </button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
