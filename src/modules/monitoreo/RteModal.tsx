import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDecimal } from "../productos/utils";
import { generarPdfRte } from "./pdfRte";

export interface MonitoreoForModal {
  id: string;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

interface RteModalProps {
  rteId: string;
  monitoreo: MonitoreoForModal;
  onClose: () => void;
  onSaved: () => void;
}

export function RteModal({ rteId, monitoreo, onClose, onSaved }: RteModalProps) {
  const [costoTotal, setCostoTotal] = useState("");
  const [ingresoTotal, setIngresoTotal] = useState("");
  const [resultadoTecnico, setResultadoTecnico] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const resultadoCalculado = useMemo(() => {
    const ing = Number(ingresoTotal);
    const cost = Number(costoTotal);
    if (Number.isNaN(ing) || Number.isNaN(cost)) return null;
    return ing - cost;
  }, [ingresoTotal, costoTotal]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("rte").select("costo_total, ingreso_total, resultado_tecnico").eq("id", rteId).single();
      if (data) {
        const x = data as any;
        setCostoTotal(String(x.costo_total ?? ""));
        setIngresoTotal(String(x.ingreso_total ?? ""));
        setResultadoTecnico(String(x.resultado_tecnico ?? ""));
      }
      setLoading(false);
    };
    load();
  }, [rteId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const resultado = resultadoCalculado ?? Number(resultadoTecnico);
    setSaving(true);
    await supabase
      .from("rte")
      .update({
        costo_total: costoTotal !== "" ? Number(costoTotal) : null,
        ingreso_total: ingresoTotal !== "" ? Number(ingresoTotal) : null,
        resultado_tecnico: Number.isNaN(resultado) ? null : resultado,
      })
      .eq("id", rteId);
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
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              RTE – {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
            </h5>
            <button type="button" className="close text-white" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Costo total (USD)</label>
                <input type="number" step="0.001" className="form-control" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ingreso total (USD)</label>
                <input type="number" step="0.001" className="form-control" value={ingresoTotal} onChange={(e) => setIngresoTotal(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Resultado técnico (USD) {resultadoCalculado != null ? `= ${formatDecimal(resultadoCalculado)}` : ""}</label>
                <input type="number" step="0.001" className="form-control" value={resultadoTecnico} onChange={(e) => setResultadoTecnico(e.target.value)} placeholder="Ingreso - Costo" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button type="button" className="btn btn-info" onClick={() => generarPdfRte(supabase, rteId)} disabled={generandoPdf}>
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
