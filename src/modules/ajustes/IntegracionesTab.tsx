import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { exportToCsv } from "../productos/utils";

interface Integraciones {
  id: string;
  api_google_maps: string | null;
  api_openai: string | null;
  costo_cbot_soja: number | null;
  versat_base_url: string | null;
  versat_empresa_id: number | null;
  versat_user: string | null;
  versat_password: string | null;
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1";
const btnPrimary = "inline-flex items-center gap-2 px-8 py-3 bg-agro-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50";

export function IntegracionesTab() {
  const [record, setRecord] = useState<Integraciones | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    api_google_maps: "",
    api_openai: "",
    costo_cbot_soja: "110",
    versat_base_url: "",
    versat_empresa_id: "",
    versat_user: "",
    versat_password: ""
  });
  const [versatSyncing, setVersatSyncing] = useState(false);
  const [versatSyncMessage, setVersatSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [versatCsvLoading, setVersatCsvLoading] = useState(false);
  const [versatComplementUploading, setVersatComplementUploading] = useState(false);
  const [versatComplementUploadRef, setVersatComplementUploadRef] = useState<HTMLInputElement | null>(null);
  const [versatClientsSyncing, setVersatClientsSyncing] = useState(false);
  const [versatClientsSyncMessage, setVersatClientsSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [versatClientsCsvLoading, setVersatClientsCsvLoading] = useState(false);
  const [versatClientsLastSample, setVersatClientsLastSample] = useState<Record<string, unknown> | null>(null);
  const [versatClientsCopyHint, setVersatClientsCopyHint] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        console.log("IntegracionesTab: Review Mode - Injecting mock integrations");
        setRecord({ id: "int-1", api_google_maps: "AIzaSyMockKeyForReviewMode", api_openai: "sk-mock-openai-key" });
        setForm({
          api_google_maps: "AIzaSyMockKeyForReviewMode",
          api_openai: "sk-mock-openai-key",
          costo_cbot_soja: "110",
          versat_base_url: "",
          versat_empresa_id: "",
          versat_user: "",
          versat_password: ""
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("integraciones")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setRecord(data);
        setForm({
          api_google_maps: data.api_google_maps ?? "",
          api_openai: data.api_openai ?? "",
          costo_cbot_soja: data.costo_cbot_soja != null ? String(data.costo_cbot_soja) : "110",
          versat_base_url: data.versat_base_url ?? "",
          versat_empresa_id: data.versat_empresa_id != null ? String(data.versat_empresa_id) : "",
          versat_user: data.versat_user ?? "",
          versat_password: data.versat_password ?? ""
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (record) {
      const { data } = await supabase
        .from("integraciones")
        .update({
          api_google_maps: form.api_google_maps,
          api_openai: form.api_openai,
          costo_cbot_soja: parseFloat(form.costo_cbot_soja) || 110,
          versat_base_url: form.versat_base_url || null,
          versat_empresa_id: form.versat_empresa_id ? parseInt(form.versat_empresa_id, 10) : null,
          versat_user: form.versat_user || null,
          versat_password: form.versat_password || null
        })
        .eq("id", record.id)
        .select("*")
        .maybeSingle();
      if (data) {
        setRecord(data);
      }
    } else {
      const { data } = await supabase
        .from("integraciones")
        .insert({
          api_google_maps: form.api_google_maps,
          api_openai: form.api_openai,
          costo_cbot_soja: parseFloat(form.costo_cbot_soja) || 110,
          versat_base_url: form.versat_base_url || null,
          versat_empresa_id: form.versat_empresa_id ? parseInt(form.versat_empresa_id, 10) : null,
          versat_user: form.versat_user || null,
          versat_password: form.versat_password || null
        })
        .select("*")
        .maybeSingle();
      if (data) {
        setRecord(data);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <i className="fas fa-spinner fa-spin mr-2" />Cargando integraciones...
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-agro-primary/10 text-agro-primary rounded-2xl flex items-center justify-center">
          <i className="fas fa-plug text-lg" />
        </div>
        <div>
          <h3 className="font-black text-gray-900 uppercase tracking-tighter text-lg">Conexiones Externas</h3>
          <p className="text-sm text-gray-500">Configura las llaves de acceso para servicios de terceros.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        <div className="space-y-6">
          <div className="group">
            <label className={labelCls}>API Google Maps</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-300 group-focus-within:text-agro-primary transition-colors">
                <i className="fas fa-map-marked-alt text-sm" />
              </span>
              <input
                className={`${inputCls} pl-12`}
                placeholder="Introduzca su clave de API de Google Maps"
                value={form.api_google_maps}
                onChange={(e) =>
                  setForm({ ...form, api_google_maps: e.target.value })
                }
              />
            </div>
            <p className="mt-2 text-[10px] text-gray-400 font-medium px-1 italic">
              * Requerida para visualización de parcelas y geolocalización de campos.
            </p>
          </div>

          <div className="group">
            <label className={labelCls}>OpenAI Secret Key</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-300 group-focus-within:text-agro-primary transition-colors">
                <i className="fas fa-robot text-sm" />
              </span>
              <input
                type="password"
                className={`${inputCls} pl-12 font-mono`}
                placeholder="sk-..."
                value={form.api_openai}
                onChange={(e) => setForm({ ...form, api_openai: e.target.value })}
              />
            </div>
            <p className="mt-2 text-[10px] text-gray-400 font-medium px-1 italic">
              * Usada para análisis inteligente de cultivos y generación de informes (RTE AI).
            </p>
          </div>

          <div className="group">
            <label className={labelCls}>Costo soja CBOT (por tonelada, se resta en la fórmula)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-300 group-focus-within:text-agro-primary transition-colors">
                <i className="fas fa-calculator text-sm" />
              </span>
              <input
                type="text"
                className={`${inputCls} pl-12`}
                placeholder="ej. 110"
                value={form.costo_cbot_soja}
                onChange={(e) =>
                  setForm({ ...form, costo_cbot_soja: e.target.value })
                }
              />
            </div>
            <p className="mt-2 text-[10px] text-gray-400 font-medium px-1 italic">
              * Usado por la sincronización diaria de soja (Yahoo). Fórmula: tonelada = (bushel × 0,367454) − costo; Prec. bolsa = tonelada ÷ 16,666.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">VERSAT (Productos)</h4>
            <p className="text-xs text-gray-500 mb-4 px-1">Configuración para sincronizar catálogo y lista de precios desde el ERP VERSAT (BP51 + BP71).</p>
            <p className="text-[10px] text-gray-400 italic mb-4 px-1">Opcional: sube <strong>productos_complemento.csv</strong> al bucket <strong>empresa</strong> en Storage (Supabase) para rellenar categoría, contenido envase, culturas y unidad de medida de productos que vengan sin esos datos. Columnas: sku o id_versat, categoria, contenido_empaque, unidad_medida, culturas.</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>URL base API VERSAT</label>
                <input
                  className={inputCls}
                  placeholder="https://app.versat.ag"
                  value={form.versat_base_url}
                  onChange={(e) => setForm({ ...form, versat_base_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Empresa ID (empresa_id)</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="458"
                  value={form.versat_empresa_id}
                  onChange={(e) => setForm({ ...form, versat_empresa_id: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Usuario (Basic Auth)</label>
                <input
                  className={inputCls}
                  placeholder="usuario"
                  value={form.versat_user}
                  onChange={(e) => setForm({ ...form, versat_user: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Contraseña (Basic Auth)</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={form.versat_password}
                  onChange={(e) => setForm({ ...form, versat_password: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50"
                  disabled={versatSyncing || !form.versat_base_url || !form.versat_empresa_id || !form.versat_user || !form.versat_password}
                  onClick={async () => {
                    setVersatSyncMessage(null);
                    setVersatSyncing(true);
                    try {
                      const { data: fnData, error } = await supabase.functions.invoke("versat-sync-products", { body: {} });
                      if (error) {
                        const bodyMsg = fnData?.error
                          ? (fnData.detail ? `${fnData.error}: ${fnData.detail}` : fnData.error)
                          : (fnData?.errors?.length ? fnData.errors.join("; ") : null);
                        setVersatSyncMessage({
                          type: "error",
                          text: bodyMsg || error.message || "Error al invocar la función"
                        });
                        setVersatSyncing(false);
                        return;
                      }
                      const ok = fnData?.ok === true;
                      const synced = fnData?.synced ?? 0;
                      let detail = fnData?.detail ?? fnData?.errors?.join?.(" ") ?? "";
                      const diag = fnData?.diagnostic ?? fnData?.bp51_first_page;
                      if (diag && typeof diag === "object") {
                        detail = [detail, "Respuesta: " + JSON.stringify(diag)].filter(Boolean).join(" | ");
                      }
                      const source = fnData?.catalog_source;
                      const bp51 = fnData?.total_bp51;
                      const bp71 = fnData?.total_bp71;
                      const rp21 = fnData?.total_rp21;
                      const rp71 = fnData?.total_rp71;
                      const parts = [typeof bp51 === "number" && `BP51: ${bp51}`, typeof rp21 === "number" && `RP21: ${rp21}`, typeof bp71 === "number" && `BP71: ${bp71}`, typeof rp71 === "number" && `RP71: ${rp71}`].filter(Boolean);
                      const totalsInfo = parts.length ? ` (${parts.join(", ")}${source ? `, origen: ${source}` : ""})` : "";
                      const complemented = fnData?.complemented ?? 0;
                      const complementInfo = complemented > 0 ? ` ${complemented} complementados con planilha.` : "";
                      const complementErrs = Array.isArray(fnData?.complement_errors) && fnData.complement_errors.length
                        ? ` Complemento: ${fnData.complement_errors.slice(0, 3).join(" | ")}${fnData.complement_errors.length > 3 ? " | …" : ""}`
                        : "";
                      const errorText = ok
                        ? `Sincronizados ${synced} productos.${totalsInfo}${complementInfo}${complementErrs}`
                        : [fnData?.error, detail].filter(Boolean).join(" — ");
                      setVersatSyncMessage({
                        type: ok ? "success" : "error",
                        text: errorText || "Error en la sincronización"
                      });
                    } catch (e) {
                      setVersatSyncMessage({ type: "error", text: e instanceof Error ? e.message : "Error desconocido" });
                    } finally {
                      setVersatSyncing(false);
                    }
                  }}
                >
                  {versatSyncing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-sync-alt" />}
                  {versatSyncing ? "Sincronizando..." : "Sincronizar productos ahora"}
                </button>
                {versatSyncMessage && (
                  <span className={`text-sm font-medium ${versatSyncMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {versatSyncMessage.text}
                  </span>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50"
                  disabled={versatCsvLoading}
                  onClick={async () => {
                    setVersatCsvLoading(true);
                    try {
                      const { data: productos, error } = await supabase
                        .from("productos")
                        .select("id, sku, nombre, fabricante, presentacion_txt, contenido_empaque, precio_compra, precio_venta, precio_final, precio_minimo, estado, culturas, id_versat, categorias_producto(descripcion)")
                        .not("id_versat", "is", null)
                        .order("id_versat", { ascending: true });
                      if (error) throw error;
                      const culturaIds = [...new Set((productos ?? []).flatMap((p: any) => Array.isArray(p.culturas) ? p.culturas : []))];
                      let cultMap: Record<string, string> = {};
                      if (culturaIds.length > 0) {
                        const { data: cult } = await supabase.from("culturas").select("id, descripcion").in("id", culturaIds);
                        if (cult) cultMap = Object.fromEntries((cult as any[]).map((c) => [c.id, c.descripcion ?? ""]));
                      }
                      const toExport = (productos ?? []).map((p: any) => ({
                        sku: p.sku ?? "",
                        nombre: p.nombre ?? "",
                        categoria: Array.isArray(p.categorias_producto) ? p.categorias_producto[0]?.descripcion : p.categorias_producto?.descripcion ?? "",
                        fabricante: p.fabricante ?? "",
                        presentacion_txt: p.presentacion_txt ?? "",
                        contenido_empaque: p.contenido_empaque ?? "",
                        precio_compra: p.precio_compra ?? "",
                        precio_venta: p.precio_venta ?? "",
                        precio_final: p.precio_final ?? "",
                        precio_minimo: p.precio_minimo ?? "",
                        estado: p.estado ?? "",
                        id_versat: p.id_versat ?? "",
                        culturas: (Array.isArray(p.culturas) ? p.culturas : []).map((id: string) => cultMap[id]).filter(Boolean).join("; "),
                      }));
                      exportToCsv(
                        toExport,
                        `productos_versat_${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          { key: "sku", header: "SKU" },
                          { key: "nombre", header: "Nombre" },
                          { key: "categoria", header: "Categoría" },
                          { key: "fabricante", header: "Fabricante" },
                          { key: "presentacion_txt", header: "Presentación" },
                          { key: "contenido_empaque", header: "Contenido envase" },
                          { key: "precio_compra", header: "Precio compra (USD)" },
                          { key: "precio_venta", header: "Precio venta (USD)" },
                          { key: "precio_final", header: "Precio final (USD)" },
                          { key: "precio_minimo", header: "Precio mínimo (USD)" },
                          { key: "estado", header: "Estado" },
                          { key: "id_versat", header: "ID VERSAT" },
                          { key: "culturas", header: "Culturas" },
                        ]
                      );
                    } catch (e) {
                      setVersatSyncMessage({ type: "error", text: e instanceof Error ? e.message : "Error al generar CSV" });
                    } finally {
                      setVersatCsvLoading(false);
                    }
                  }}
                >
                  {versatCsvLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-csv" />}
                  Descargar CSV productos VERSAT
                </button>
                <input
                  type="file"
                  accept=".csv"
                  ref={setVersatComplementUploadRef}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setVersatComplementUploading(true);
                    setVersatSyncMessage(null);
                    try {
                      const { error: upErr } = await supabase.storage
                        .from("empresa")
                        .upload("productos_complemento.csv", file, { upsert: true });
                      if (upErr) setVersatSyncMessage({ type: "error", text: upErr.message || "Error al subir CSV complemento." });
                      else setVersatSyncMessage({ type: "success", text: "CSV complemento subido. En la próxima sincronización se aplicarán categoría, contenido envase, culturas y unidad de medida." });
                    } catch (err) {
                      setVersatSyncMessage({ type: "error", text: err instanceof Error ? err.message : "Error al subir." });
                    } finally {
                      setVersatComplementUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50"
                  disabled={versatComplementUploading}
                  onClick={() => versatComplementUploadRef?.click()}
                >
                  {versatComplementUploading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-upload" />}
                  Subir CSV complemento
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">VERSAT (Clientes)</h4>
            <p className="text-xs text-gray-500 mb-4 px-1">Sincronizar clientes desde el ERP VERSAT (recurso RC31).</p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50"
                disabled={versatClientsSyncing || !form.versat_base_url || !form.versat_empresa_id || !form.versat_user || !form.versat_password}
                onClick={async () => {
                  setVersatClientsSyncMessage(null);
                  setVersatClientsSyncing(true);
                  try {
                    const { data: fnData, error } = await supabase.functions.invoke("versat-sync-clients", { body: {} });
                    if (error) {
                      const bodyMsg = fnData?.detail ? `${fnData?.error ?? "Error"}: ${fnData.detail}` : fnData?.error ?? error.message;
                      setVersatClientsSyncMessage({ type: "error", text: bodyMsg || "Error al invocar la función" });
                      setVersatClientsSyncing(false);
                      return;
                    }
                    const ok = fnData?.ok === true;
                    const synced = fnData?.synced ?? 0;
                    const total = fnData?.total ?? 0;
                    const errText = fnData?.error ?? (fnData?.errors?.length ? fnData.errors.join("; ") : null);
                    const keysHint = Array.isArray(fnData?.rc31_sample_keys) ? ` Campos API: ${fnData.rc31_sample_keys.join(", ")}.` : "";
                    const text = ok
                      ? `Sincronizados ${synced} clientes (${total} de RC31).${keysHint}`
                      : (errText || "Error en la sincronización");
                    setVersatClientsSyncMessage({ type: ok ? "success" : "error", text });
                    setVersatClientsLastSample((fnData?.rc31_sample != null && typeof fnData.rc31_sample === "object") ? fnData.rc31_sample as Record<string, unknown> : null);
                  } catch (e) {
                    setVersatClientsSyncMessage({ type: "error", text: e instanceof Error ? e.message : "Error desconocido" });
                  } finally {
                    setVersatClientsSyncing(false);
                  }
                }}
              >
                {versatClientsSyncing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-sync-alt" />}
                {versatClientsSyncing ? "Sincronizando..." : "Sincronizar clientes ahora"}
              </button>
              {versatClientsSyncMessage && (
                <span className={`text-sm font-medium ${versatClientsSyncMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {versatClientsSyncMessage.text}
                </span>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50"
                disabled={versatClientsCsvLoading}
                onClick={async () => {
                  setVersatClientsCsvLoading(true);
                  try {
                    const { data: clientes, error } = await supabase
                      .from("clientes")
                      .select("id, nombre, email, telefono, direccion, ruc, ci, estado, id_versat")
                      .not("id_versat", "is", null)
                      .order("id_versat", { ascending: true });
                    if (error) throw error;
                    const toExport = (clientes ?? []).map((c: Record<string, unknown>) => ({
                      nombre: c.nombre ?? "",
                      email: c.email ?? "",
                      telefono: c.telefono ?? "",
                      direccion: c.direccion ?? "",
                      ruc: c.ruc ?? "",
                      ci: c.ci ?? "",
                      estado: c.estado ?? "",
                      id_versat: c.id_versat ?? "",
                    }));
                    exportToCsv(
                      toExport,
                      `clientes_versat_${new Date().toISOString().slice(0, 10)}.csv`,
                      [
                        { key: "nombre", header: "Nombre" },
                        { key: "email", header: "Email" },
                        { key: "telefono", header: "Teléfono" },
                        { key: "direccion", header: "Dirección" },
                        { key: "ruc", header: "RUC" },
                        { key: "ci", header: "CI" },
                        { key: "estado", header: "Estado" },
                        { key: "id_versat", header: "ID VERSAT" },
                      ]
                    );
                  } catch (e) {
                    setVersatClientsSyncMessage({ type: "error", text: e instanceof Error ? e.message : "Error al generar CSV" });
                  } finally {
                    setVersatClientsCsvLoading(false);
                  }
                }}
              >
                {versatClientsCsvLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-csv" />}
                Descargar CSV clientes VERSAT
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-800 text-sm font-bold rounded-xl hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!versatClientsLastSample}
                title="Copia un ejemplo del JSON que devuelve la API RC31 para mapear email/teléfono"
                onClick={async () => {
                  if (!versatClientsLastSample) return;
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(versatClientsLastSample, null, 2));
                    setVersatClientsCopyHint("Copiado. Pega en el chat para mapear email/teléfono.");
                    setTimeout(() => setVersatClientsCopyHint(null), 4000);
                  } catch {
                    setVersatClientsCopyHint("No se pudo copiar.");
                    setTimeout(() => setVersatClientsCopyHint(null), 3000);
                  }
                }}
              >
                <i className="fas fa-code" />
                Copiar ejemplo RC31
              </button>
              {versatClientsCopyHint && (
                <span className="text-xs text-amber-700 font-medium">{versatClientsCopyHint}</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 flex justify-end">
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? (
              <><i className="fas fa-spinner fa-spin mr-2" /> Guardando...</>
            ) : (
              <><i className="fas fa-sync-alt mr-2" /> Actualizar Conexiones</>
            )}
          </button>
        </div>
      </form>

      <div className="mt-12 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-4">
        <i className="fas fa-info-circle text-blue-400 mt-1" />
        <div>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Seguridad de Datos</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Todas las llaves de API se almacenan de forma cifrada en la base de datos de Supabase. Nunca comparta estas llaves con terceros no autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
