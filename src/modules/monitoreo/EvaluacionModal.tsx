import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generarPdfEvaluacion } from "./pdfEvaluacion";

export interface MonitoreoForModal {
  id: string;
  id_zafra: string;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

interface EvaluacionModalProps {
  evaluacionId: string;
  monitoreo: MonitoreoForModal | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EvaluacionModal({ evaluacionId, monitoreo: monProp, onClose, onSaved }: EvaluacionModalProps) {
  const [monitoreo, setMonitoreo] = useState<MonitoreoForModal | null>(monProp);
  const [fechaEvaluacion, setFechaEvaluacion] = useState("");
  const [fechaProxima, setFechaProxima] = useState("");
  const [idEtapaFenologica, setIdEtapaFenologica] = useState("");
  const [idVigor, setIdVigor] = useState("");
  const [idEstresHidrico, setIdEstresHidrico] = useState("");
  const [idClimaReciente, setIdClimaReciente] = useState("");
  const [descripcionGeneral, setDescripcionGeneral] = useState("");
  const [etapas, setEtapas] = useState<{ id: string; descripcion: string }[]>([]);
  const [vigorList, setVigorList] = useState<{ id: string; descripcion: string }[]>([]);
  const [estresList, setEstresList] = useState<{ id: string; descripcion: string }[]>([]);
  const [climaList, setClimaList] = useState<{ id: string; descripcion: string }[]>([]);
  const [plagas, setPlagas] = useState<{ id: string; descripcion: string }[]>([]);
  const [enfermedades, setEnfermedades] = useState<{ id: string; descripcion: string }[]>([]);
  const [malezas, setMalezas] = useState<{ id: string; descripcion: string }[]>([]);
  const [selectedPlagas, setSelectedPlagas] = useState<string[]>([]);
  const [selectedEnfermedades, setSelectedEnfermedades] = useState<string[]>([]);
  const [selectedMalezas, setSelectedMalezas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase.from("evaluaciones").select("*").eq("id", evaluacionId).single();
      if (ev) {
        const x = ev as any;
        setFechaEvaluacion(x.fecha_evaluacion ?? "");
        setFechaProxima(x.fecha_proxima_evaluacion ?? "");
        setIdEtapaFenologica(x.id_etapa_fenologica ?? "");
        setIdVigor(x.id_vigor ?? "");
        setIdEstresHidrico(x.id_estres_hidrico ?? "");
        setIdClimaReciente(x.id_clima_reciente ?? "");
        setDescripcionGeneral(x.descripcion_general ?? "");
      }

      if (!monProp && ev) {
        const { data: mon } = await supabase.from("monitoreos").select("id, id_zafra, clientes(nombre), parcelas(nombre_parcela), zafras(nombre_zafra)").eq("id", (ev as any).id_monitoreo).single();
        if (mon) {
          const m = mon as any;
          setMonitoreo({
            id: m.id,
            id_zafra: m.id_zafra,
            cliente_nombre: m.clientes?.nombre ?? "",
            parcela_nombre: m.parcelas?.nombre_parcela ?? "",
            zafra_nombre: m.zafras?.nombre_zafra ?? "",
          });
        }
      } else if (monProp) setMonitoreo(monProp);

      let idZafra = monProp?.id_zafra;
      if (!idZafra && ev) {
        const { data: mz } = await supabase.from("monitoreos").select("id_zafra").eq("id", (ev as any).id_monitoreo).single();
        idZafra = (mz as any)?.id_zafra;
      }
      if (idZafra) {
        const { data: zafra } = await supabase.from("zafras").select("id_cultura").eq("id", idZafra).single();
        const idCultura = (zafra as any)?.id_cultura;
        if (idCultura) {
          const { data: etapasData } = await supabase.from("etapas_fenologicas").select("id, descripcion").eq("id_cultura", idCultura);
          setEtapas((etapasData as any[]) ?? []);
        }
      }

      const [vRes, eRes, cRes, pRes, enRes, mRes] = await Promise.all([
        supabase.from("vigor").select("id, descripcion"),
        supabase.from("estres_hidrico").select("id, descripcion"),
        supabase.from("clima_reciente").select("id, descripcion"),
        supabase.from("plagas").select("id, descripcion"),
        supabase.from("enfermedades").select("id, descripcion"),
        supabase.from("malezas").select("id, descripcion"),
      ]);
      setVigorList((vRes.data as any[]) ?? []);
      setEstresList((eRes.data as any[]) ?? []);
      setClimaList((cRes.data as any[]) ?? []);
      setPlagas((pRes.data as any[]) ?? []);
      setEnfermedades((enRes.data as any[]) ?? []);
      setMalezas((mRes.data as any[]) ?? []);

      const [pEval, eEval, mMval] = await Promise.all([
        supabase.from("evaluacion_plagas").select("id_plaga").eq("id_evaluacion", evaluacionId),
        supabase.from("evaluacion_enfermedades").select("id_enfermedad").eq("id_evaluacion", evaluacionId),
        supabase.from("evaluacion_malezas").select("id_maleza").eq("id_evaluacion", evaluacionId),
      ]);
      setSelectedPlagas((pEval.data as any[])?.map((x) => x.id_plaga) ?? []);
      setSelectedEnfermedades((eEval.data as any[])?.map((x) => x.id_enfermedad) ?? []);
      setSelectedMalezas((mMval.data as any[])?.map((x) => x.id_maleza) ?? []);

      setLoading(false);
    };
    load();
  }, [evaluacionId, monProp?.id]);

  const togglePlaga = (id: string) => {
    setSelectedPlagas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleEnfermedad = (id: string) => {
    setSelectedEnfermedades((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleMaleza = (id: string) => {
    setSelectedMalezas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("evaluaciones")
      .update({
        fecha_evaluacion: fechaEvaluacion || null,
        fecha_proxima_evaluacion: fechaProxima || null,
        id_etapa_fenologica: idEtapaFenologica || null,
        id_vigor: idVigor || null,
        id_estres_hidrico: idEstresHidrico || null,
        id_clima_reciente: idClimaReciente || null,
        descripcion_general: descripcionGeneral || null,
      })
      .eq("id", evaluacionId);

    await supabase.from("evaluacion_plagas").delete().eq("id_evaluacion", evaluacionId);
    await supabase.from("evaluacion_enfermedades").delete().eq("id_evaluacion", evaluacionId);
    await supabase.from("evaluacion_malezas").delete().eq("id_evaluacion", evaluacionId);
    if (selectedPlagas.length) await supabase.from("evaluacion_plagas").insert(selectedPlagas.map((id_plaga) => ({ id_evaluacion: evaluacionId, id_plaga })));
    if (selectedEnfermedades.length) await supabase.from("evaluacion_enfermedades").insert(selectedEnfermedades.map((id_enfermedad) => ({ id_evaluacion: evaluacionId, id_enfermedad })));
    if (selectedMalezas.length) await supabase.from("evaluacion_malezas").insert(selectedMalezas.map((id_maleza) => ({ id_evaluacion: evaluacionId, id_maleza })));

    setSaving(false);
    onSaved();
    onClose();
  };

  if (loading || !monitoreo) {
    return (
      <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-body text-center py-5">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              Evaluación – {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
            </h5>
            <button type="button" className="close text-white" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row mb-2">
                <div className="col-md-2">
                  <label className="form-label">Fecha evaluación</label>
                  <input type="date" className="form-control form-control-sm" value={fechaEvaluacion} onChange={(e) => setFechaEvaluacion(e.target.value)} required />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Próx. evaluación</label>
                  <input type="date" className="form-control form-control-sm" value={fechaProxima} onChange={(e) => setFechaProxima(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Etapa fenológica</label>
                  <select className="form-control form-control-sm" value={idEtapaFenologica} onChange={(e) => setIdEtapaFenologica(e.target.value)}>
                    <option value="">Seleccione</option>
                    {etapas.map((t) => (
                      <option key={t.id} value={t.id}>{t.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Vigor</label>
                  <select className="form-control form-control-sm" value={idVigor} onChange={(e) => setIdVigor(e.target.value)}>
                    <option value="">Seleccione</option>
                    {vigorList.map((v) => (
                      <option key={v.id} value={v.id}>{v.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Estrés hídrico</label>
                  <select className="form-control form-control-sm" value={idEstresHidrico} onChange={(e) => setIdEstresHidrico(e.target.value)}>
                    <option value="">Seleccione</option>
                    {estresList.map((s) => (
                      <option key={s.id} value={s.id}>{s.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Clima reciente</label>
                  <select className="form-control form-control-sm" value={idClimaReciente} onChange={(e) => setIdClimaReciente(e.target.value)}>
                    <option value="">Seleccione</option>
                    {climaList.map((c) => (
                      <option key={c.id} value={c.id}>{c.descripcion}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción general</label>
                <textarea className="form-control form-control-sm" rows={2} value={descripcionGeneral} onChange={(e) => setDescripcionGeneral(e.target.value)} />
              </div>
              <div className="row">
                <div className="col-md-4">
                  <label className="form-label">Plagas</label>
                  <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                    {plagas.map((p) => (
                      <div key={p.id} className="form-check">
                        <input type="checkbox" className="form-check-input" id={`plaga-${p.id}`} checked={selectedPlagas.includes(p.id)} onChange={() => togglePlaga(p.id)} />
                        <label className="form-check-label small" htmlFor={`plaga-${p.id}`}>{p.descripcion}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Enfermedades</label>
                  <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                    {enfermedades.map((e) => (
                      <div key={e.id} className="form-check">
                        <input type="checkbox" className="form-check-input" id={`enf-${e.id}`} checked={selectedEnfermedades.includes(e.id)} onChange={() => toggleEnfermedad(e.id)} />
                        <label className="form-check-label small" htmlFor={`enf-${e.id}`}>{e.descripcion}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Malezas</label>
                  <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                    {malezas.map((m) => (
                      <div key={m.id} className="form-check">
                        <input type="checkbox" className="form-check-input" id={`mal-${m.id}`} checked={selectedMalezas.includes(m.id)} onChange={() => toggleMaleza(m.id)} />
                        <label className="form-check-label small" htmlFor={`mal-${m.id}`}>{m.descripcion}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button type="button" className="btn btn-info" onClick={() => generarPdfEvaluacion(supabase, evaluacionId)} disabled={generandoPdf}>
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
