import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
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
  readOnly?: boolean;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function EvaluacionModal({ evaluacionId, monitoreo: monProp, onClose, onSaved, readOnly = false }: EvaluacionModalProps) {
  const { perfil } = useAuth();
  const [monitoreo, setMonitoreo] = useState<MonitoreoForModal | null>(monProp);
  const [fechaEvaluacion, setFechaEvaluacion] = useState("");
  const [fechaProxima, setFechaProxima] = useState("");
  const [idEtapaFenologica, setIdEtapaFenologica] = useState("");
  const [idVigor, setIdVigor] = useState("");
  const [idEstresHidrico, setIdEstresHidrico] = useState("");
  const [idFitotoxicidad, setIdFitotoxicidad] = useState("");
  const [idClimaReciente, setIdClimaReciente] = useState("");
  const [descripcionGeneral, setDescripcionGeneral] = useState("");
  const [imagen1Url, setImagen1Url] = useState("");
  const [imagen2Url, setImagen2Url] = useState("");
  const [imagen3Url, setImagen3Url] = useState("");
  const [imagen1File, setImagen1File] = useState<string | null>(null);
  const [imagen2File, setImagen2File] = useState<string | null>(null);
  const [imagen3File, setImagen3File] = useState<string | null>(null);

  const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB para fotos modernas (iPhone/Samsung/Xiaomi)
  const [etapas, setEtapas] = useState<{ id: string; descripcion: string }[]>([]);
  const [vigorList, setVigorList] = useState<{ id: string; descripcion: string }[]>([]);
  const [estresList, setEstresList] = useState<{ id: string; descripcion: string }[]>([]);
  const [fitotoxicidadList, setFitotoxicidadList] = useState<{ id: string; descripcion: string }[]>([]);
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
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        setVigorList([{ id: "v1", descripcion: "Muy bueno" }, { id: "v2", descripcion: "Bueno" }]);
        setEstresList([{ id: "s1", descripcion: "Ninguno" }, { id: "s2", descripcion: "Leve" }]);
        setFitotoxicidadList([{ id: "f1", descripcion: "Ninguna" }, { id: "f2", descripcion: "Leve" }, { id: "f3", descripcion: "Moderada" }]);
        setClimaList([{ id: "c1", descripcion: "Soleado" }, { id: "c2", descripcion: "Lluvioso" }]);
        setEtapas([{ id: "ef1", descripcion: "Vegetativo" }, { id: "ef2", descripcion: "Floración" }]);
        setPlagas([{ id: "p1", descripcion: "Oruga" }, { id: "p2", descripcion: "Chinche" }]);
        setEnfermedades([{ id: "e1", descripcion: "Roya" }, { id: "e2", descripcion: "Mancha" }]);
        setMalezas([{ id: "m1", descripcion: "Capín" }, { id: "m2", descripcion: "Maleza X" }]);
        const mockEvals: Record<string, { fecha_evaluacion: string; fecha_proxima_evaluacion: string | null; descripcion_general: string; id_fitotoxicidad?: string; imagen_1_url?: string; imagen_2_url?: string; imagen_3_url?: string }> = {
          "e-2a": { fecha_evaluacion: "2024-11-05", fecha_proxima_evaluacion: "2024-11-20", descripcion_general: "Estado general bueno. Monitoreo de plagas sin incidencias." },
          "e-2b": { fecha_evaluacion: "2024-11-25", fecha_proxima_evaluacion: "2024-12-10", descripcion_general: "Segunda evaluación. Desarrollo normal." },
          "e-3": { fecha_evaluacion: "2024-12-01", fecha_proxima_evaluacion: null, descripcion_general: "Evaluación pre-cosecha." },
          "e-4": { fecha_evaluacion: "2024-09-15", fecha_proxima_evaluacion: null, descripcion_general: "Evaluación concluída." },
        };
        const mock = mockEvals[evaluacionId];
        if (mock) {
          setFechaEvaluacion(mock.fecha_evaluacion);
          setFechaProxima(mock.fecha_proxima_evaluacion ?? "");
          setDescripcionGeneral(mock.descripcion_general);
          if (mock.id_fitotoxicidad) setIdFitotoxicidad(mock.id_fitotoxicidad);
          if (mock.imagen_1_url) setImagen1Url(mock.imagen_1_url);
          if (mock.imagen_2_url) setImagen2Url(mock.imagen_2_url);
          if (mock.imagen_3_url) setImagen3Url(mock.imagen_3_url);
        } else {
          setFechaEvaluacion(new Date().toISOString().slice(0, 10));
        }
        if (monProp) {
          setMonitoreo(monProp);
        } else {
          const mockMon: Record<string, MonitoreoForModal> = {
            "m-2": { id: "m-2", id_zafra: "z-1", cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
            "m-3": { id: "m-3", id_zafra: "z-1", cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025" },
            "m-4": { id: "m-4", id_zafra: "z-2", cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz" },
          };
          const monId = evaluacionId === "e-2a" || evaluacionId === "e-2b" ? "m-2" : evaluacionId === "e-3" ? "m-3" : evaluacionId === "e-4" ? "m-4" : "m-2";
          setMonitoreo(mockMon[monId] ?? mockMon["m-2"]);
        }
        setLoading(false);
        return;
      }
      const { data: ev } = await supabase.from("evaluaciones").select("*").eq("id", evaluacionId).single();
      if (ev) {
        const x = ev as any;
        setFechaEvaluacion(x.fecha_evaluacion ?? "");
        setFechaProxima(x.fecha_proxima_evaluacion ?? "");
        setIdEtapaFenologica(x.id_etapa_fenologica ?? "");
        setIdVigor(x.id_vigor ?? "");
        setIdEstresHidrico(x.id_estres_hidrico ?? "");
        setIdFitotoxicidad(x.id_fitotoxicidad ?? "");
        setIdClimaReciente(x.id_clima_reciente ?? "");
        setDescripcionGeneral(x.descripcion_general ?? "");
        setImagen1Url(x.imagen_1_url ?? "");
        setImagen2Url(x.imagen_2_url ?? "");
        setImagen3Url(x.imagen_3_url ?? "");
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

      const [vRes, eRes, fRes, cRes, pRes, enRes, mRes] = await Promise.all([
        supabase.from("vigor").select("id, descripcion"),
        supabase.from("estres_hidrico").select("id, descripcion"),
        supabase.from("fitotoxicidad").select("id, descripcion"),
        supabase.from("clima_reciente").select("id, descripcion"),
        supabase.from("plagas").select("id, descripcion"),
        supabase.from("enfermedades").select("id, descripcion"),
        supabase.from("malezas").select("id, descripcion"),
      ]);
      setVigorList((vRes.data as any[]) ?? []);
      setEstresList((eRes.data as any[]) ?? []);
      setFitotoxicidadList((fRes.data as any[]) ?? []);
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

  const addPlaga = (id: string) => {
    if (id && !selectedPlagas.includes(id)) setSelectedPlagas((prev) => [...prev, id]);
  };
  const addEnfermedad = (id: string) => {
    if (id && !selectedEnfermedades.includes(id)) setSelectedEnfermedades((prev) => [...prev, id]);
  };
  const addMaleza = (id: string) => {
    if (id && !selectedMalezas.includes(id)) setSelectedMalezas((prev) => [...prev, id]);
  };
  const removePlaga = (id: string) => setSelectedPlagas((prev) => prev.filter((x) => x !== id));
  const removeEnfermedad = (id: string) => setSelectedEnfermedades((prev) => prev.filter((x) => x !== id));
  const removeMaleza = (id: string) => setSelectedMalezas((prev) => prev.filter((x) => x !== id));

  const handleImageFile = (slot: 1 | 2 | 3, file: File | null) => {
    const setters = [setImagen1File, setImagen2File, setImagen3File] as const;
    if (!file) {
      setters[slot - 1](null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return; // opcional: toast "Imagen muy grande (máx 6MB)"
    }
    const reader = new FileReader();
    reader.onload = () => setters[slot - 1](reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    const isDemo = localStorage.getItem("forceAuthReview") === "true";
    if (isDemo) {
      setSaving(false);
      onSaved();
      onClose();
      return;
    }
    await supabase
      .from("evaluaciones")
      .update({
        fecha_evaluacion: fechaEvaluacion || null,
        fecha_proxima_evaluacion: fechaProxima || null,
        id_etapa_fenologica: idEtapaFenologica || null,
        id_vigor: idVigor || null,
        id_estres_hidrico: idEstresHidrico || null,
        id_fitotoxicidad: idFitotoxicidad || null,
        id_clima_reciente: idClimaReciente || null,
        descripcion_general: descripcionGeneral || null,
        imagen_1_url: imagen1Url || null,
        imagen_2_url: imagen2Url || null,
        imagen_3_url: imagen3Url || null,
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

  const handlePdf = async () => {
    setGenerandoPdf(true);
    await generarPdfEvaluacion(supabase, evaluacionId, { userName: perfil?.nombre });
    setGenerandoPdf(false);
  };

  if (loading || !monitoreo) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
        <i className="fas fa-spinner fa-spin text-agro-primary text-2xl mb-4" />
        <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Cargando...</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-clipboard-list text-sm" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight text-base">Registro de Evaluación</h3>
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
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-1">
                <label className={labelCls}>Fecha Eval.</label>
                <input type="date" className={inputCls} value={fechaEvaluacion} onChange={(e) => setFechaEvaluacion(e.target.value)} required disabled={readOnly} />
              </div>
              <div className="col-span-1">
                <label className={labelCls}>Próx. Visita</label>
                <input type="date" className={inputCls} value={fechaProxima} onChange={(e) => setFechaProxima(e.target.value)} disabled={readOnly} />
              </div>
              <div className="col-span-1">
                <label className={labelCls}>Etapa Fenológica</label>
                <select className={inputCls} value={idEtapaFenologica} onChange={(e) => setIdEtapaFenologica(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione</option>
                  {etapas.map((t) => (
                    <option key={t.id} value={t.id}>{t.descripcion}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelCls}>Vigor</label>
                <select className={inputCls} value={idVigor} onChange={(e) => setIdVigor(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione</option>
                  {vigorList.map((v) => (
                    <option key={v.id} value={v.id}>{v.descripcion}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelCls}>Estrés Hídrico</label>
                <select className={inputCls} value={idEstresHidrico} onChange={(e) => setIdEstresHidrico(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione</option>
                  {estresList.map((s) => (
                    <option key={s.id} value={s.id}>{s.descripcion}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelCls}>Clima Reciente</label>
                <select className={inputCls} value={idClimaReciente} onChange={(e) => setIdClimaReciente(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione</option>
                  {climaList.map((c) => (
                    <option key={c.id} value={c.id}>{c.descripcion}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fitotoxicidad + Plagas, Enfermedades, Malezas junto con el resto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Fitotoxicidad</label>
                <select className={inputCls} value={idFitotoxicidad} onChange={(e) => setIdFitotoxicidad(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccione</option>
                  {fitotoxicidadList.map((f) => (
                    <option key={f.id} value={f.id}>{f.descripcion}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Plagas</label>
                {!readOnly && (
                <select className={inputCls} value="" onChange={(e) => { addPlaga(e.target.value); e.target.value = ""; }}>
                  <option value="">Agregar plaga...</option>
                  {plagas.filter((p) => !selectedPlagas.includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.descripcion}</option>
                  ))}
                </select>
                )}
                <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
                  {selectedPlagas.map((id) => {
                    const p = plagas.find((x) => x.id === id);
                    return p ? (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-100 text-green-800 text-xs font-medium">
                        {p.descripcion}
                        {!readOnly && <button type="button" className="hover:text-red-600" onClick={() => removePlaga(id)} aria-label="Quitar"><i className="fas fa-times text-[10px]" /></button>}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Enfermedades</label>
                {!readOnly && (
                <select className={inputCls} value="" onChange={(e) => { addEnfermedad(e.target.value); e.target.value = ""; }}>
                  <option value="">Agregar enfermedad...</option>
                  {enfermedades.filter((e) => !selectedEnfermedades.includes(e.id)).map((e) => (
                    <option key={e.id} value={e.id}>{e.descripcion}</option>
                  ))}
                </select>
                )}
                <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
                  {selectedEnfermedades.map((id) => {
                    const en = enfermedades.find((x) => x.id === id);
                    return en ? (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                        {en.descripcion}
                        {!readOnly && <button type="button" className="hover:text-red-600" onClick={() => removeEnfermedad(id)} aria-label="Quitar"><i className="fas fa-times text-[10px]" /></button>}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Malezas</label>
                {!readOnly && (
                <select className={inputCls} value="" onChange={(e) => { addMaleza(e.target.value); e.target.value = ""; }}>
                  <option value="">Agregar maleza...</option>
                  {malezas.filter((m) => !selectedMalezas.includes(m.id)).map((m) => (
                    <option key={m.id} value={m.id}>{m.descripcion}</option>
                  ))}
                </select>
                )}
                <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
                  {selectedMalezas.map((id) => {
                    const m = malezas.find((x) => x.id === id);
                    return m ? (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 text-xs font-medium">
                        {m.descripcion}
                        {!readOnly && <button type="button" className="hover:text-red-600" onClick={() => removeMaleza(id)} aria-label="Quitar"><i className="fas fa-times text-[10px]" /></button>}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className={labelCls}>Descripción General del Cultivo</label>
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={descripcionGeneral}
                onChange={(e) => setDescripcionGeneral(e.target.value)}
                placeholder="Detalle el estado general observado..."
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-images text-[10px]" /> Imágenes (opcional, hasta 3 — archivo o cámara, máx 6 MB)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([1, 2, 3] as const).map((slot) => (
                  <div key={slot} className="space-y-1">
                    <label className={labelCls}>Imagen {slot}</label>
                    {!readOnly && (
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="block w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-agro-primary/10 file:text-agro-primary file:font-bold file:cursor-pointer hover:file:bg-agro-primary/20"
                      onChange={(e) => handleImageFile(slot, e.target.files?.[0] ?? null)}
                    />
                    )}
                    {(slot === 1 ? imagen1File : slot === 2 ? imagen2File : imagen3File) && (
                      <div className="relative mt-1 rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-50">
                        <img
                          src={slot === 1 ? imagen1File! : slot === 2 ? imagen2File! : imagen3File!}
                          alt={`Preview ${slot}`}
                          className="w-full h-full object-cover"
                        />
                        {!readOnly && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                          onClick={() => handleImageFile(slot, null)}
                        >
                          <i className="fas fa-times" />
                        </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
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
                <><i className="fas fa-spinner fa-spin" /> Generando PDF...</>
              ) : (
                <><i className="fas fa-file-pdf" /> Exportar Evaluación PDF</>
              )}
            </button>
            <div className="flex gap-3">
              <button type="button" className={btnSecondary} onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
              {!readOnly && (
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? (
                  <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                ) : (
                  <><i className="fas fa-save text-xs" /> Guardar Evaluación</>
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
