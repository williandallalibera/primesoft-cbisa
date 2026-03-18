import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { isSupabaseConfigured } from "../../lib/supabaseClient";

const BUCKET_EMPRESA = "empresa";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPT_LOGOS = "image/png,image/jpeg,image/jpg,application/pdf";

interface Empresa {
  id: string;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  logo_url: string | null;
  logo_informes_url: string | null;
  updated_at?: string | null;
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50";
const labelCls = "text-sm font-bold text-gray-700 block mb-2";
const btnPrimary = "px-8 py-3 bg-agro-primary text-white font-bold rounded-xl shadow-lg shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50";

function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : ".png";
}

export function EmpresaTab() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<"sistema" | "informes" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoPreviewKey, setLogoPreviewKey] = useState(0);
  const [form, setForm] = useState({
    ruc: "",
    direccion: "",
    telefono: "",
    logo_url: "",
    logo_informes_url: ""
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";

      if (isReviewMode) {
        const mockData = {
          id: "mock-empresa-id",
          ruc: "80012345-6",
          direccion: "Av. Mariscal López 1234, Asunción",
          telefono: "+595 21 600 000",
          logo_url: "https://cbisa.com.py/logo.png",
          logo_informes_url: ""
        };
        setEmpresa(mockData as Empresa);
        setForm({
          ruc: mockData.ruc,
          direccion: mockData.direccion,
          telefono: mockData.telefono,
          logo_url: mockData.logo_url,
          logo_informes_url: mockData.logo_informes_url ?? ""
        });
        setLoading(false);
        return;
      }

      // Orden determinística por id (siempre la misma fila; evita ver otra al recargar o cambiar de pestaña)
      setLoadError(null);
      const { data, error } = await supabase
        .from("empresa")
        .select("*")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        setLoadError("Error al cargar datos de la empresa: " + error.message + ". Compruebe las políticas RLS (SELECT).");
      } else if (data) {
        const d = data as Empresa;
        setEmpresa(d);
        setForm({
          ruc: d.ruc ?? "",
          direccion: d.direccion ?? "",
          telefono: d.telefono ?? "",
          logo_url: d.logo_url ?? "",
          logo_informes_url: d.logo_informes_url ?? ""
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleLogoUpload = async (campo: "logo_url" | "logo_informes_url", file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setSaveError(null);

    if (localStorage.getItem("forceAuthReview") === "true") {
      setUploadError("Modo demostración: los cambios no se guardan en la base de datos.");
      return;
    }

    const ext = getExtension(file.name);
    if (![".png", ".jpg", ".jpeg", ".pdf"].includes(ext)) {
      setUploadError("Formato no permitido. Use PNG, JPEG o PDF.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`Tamaño máximo 50 MB. El archivo tiene ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
      return;
    }

    setUploadingLogo(campo === "logo_url" ? "sistema" : "informes");

    if (!isSupabaseConfigured) {
      setUploadError("Configure Supabase para subir archivos.");
      setUploadingLogo(null);
      return;
    }

    const path = campo === "logo_url" ? "logo_sistema" : "logo_informes";
    const fileName = path + ext;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_EMPRESA)
      .upload(fileName, file, { upsert: true });

    if (uploadErr) {
      setUploadError(uploadErr.message || "Error al subir. Cree el bucket 'empresa' en Storage (Supabase).");
      setUploadingLogo(null);
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET_EMPRESA).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    setForm((prev) => ({ ...prev, [campo]: publicUrl }));
    setLogoPreviewKey((k) => k + 1);

    if (empresa?.id) {
      const logoUrl = campo === "logo_url" ? publicUrl : (form.logo_url || null);
      const logoInformesUrl = campo === "logo_informes_url" ? publicUrl : (form.logo_informes_url || null);
      const { data: updatedRows, error: updateErr } = await supabase.rpc("update_empresa_datos", {
        p_id: empresa.id,
        p_ruc: form.ruc || null,
        p_direccion: form.direccion || null,
        p_telefono: form.telefono || null,
        p_logo_url: logoUrl,
        p_logo_informes_url: logoInformesUrl
      });
      const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      const rpcNotFound = updateErr && /function|does not exist|not found/i.test(updateErr.message);

      if (updateErr && rpcNotFound) {
        const updatePayload = { logo_url: logoUrl, logo_informes_url: logoInformesUrl, updated_at: new Date().toISOString() };
        const { data: directUpdated, error: directErr } = await supabase
          .from("empresa")
          .update(updatePayload)
          .eq("id", empresa.id)
          .select("*")
          .maybeSingle();
        if (!directErr && directUpdated) {
          setEmpresa(directUpdated as Empresa);
          setUploadSuccess(campo === "logo_informes_url" ? "Logo de informes/PDF actualizado." : "Logo del sistema actualizado.");
          setTimeout(() => setUploadSuccess(null), 4000);
          setUploadError("Para mayor fiabilidad, ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase.");
          window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
        } else {
          setUploadError("Ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase (función update_empresa_datos no existe).");
        }
      } else if (updateErr) {
        setUploadError("Logo subido pero no se pudo guardar: " + updateErr.message);
      } else if (!updated) {
        setUploadError("No se pudo guardar. Ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase.");
      } else {
        setEmpresa(updated as Empresa);
        setUploadSuccess(campo === "logo_informes_url" ? "Logo de informes/PDF actualizado." : "Logo del sistema actualizado.");
        setTimeout(() => setUploadSuccess(null), 4000);
        window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
      }
    } else {
      const insertPayload = {
        p_ruc: form.ruc || null,
        p_direccion: form.direccion || null,
        p_telefono: form.telefono || null,
        p_logo_url: campo === "logo_url" ? publicUrl : form.logo_url || null,
        p_logo_informes_url: campo === "logo_informes_url" ? publicUrl : form.logo_informes_url || null
      };
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("insert_empresa_datos", insertPayload);
      const insertedRpc = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!rpcErr && insertedRpc) {
        setEmpresa(insertedRpc as Empresa);
        setUploadSuccess(campo === "logo_informes_url" ? "Logo de informes/PDF guardado." : "Logo del sistema guardado.");
        setTimeout(() => setUploadSuccess(null), 4000);
        window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
      } else {
        const insertPayloadDirect = {
          ruc: form.ruc || null,
          direccion: form.direccion || null,
          telefono: form.telefono || null,
          logo_url: campo === "logo_url" ? publicUrl : form.logo_url || null,
          logo_informes_url: campo === "logo_informes_url" ? publicUrl : form.logo_informes_url || null
        };
        const { data: inserted, error: insertErr } = await supabase
          .from("empresa")
          .insert(insertPayloadDirect)
          .select("*")
          .maybeSingle();
        if (insertErr) {
          setUploadError("Logo subido pero no se pudo guardar (crear empresa): " + insertErr.message);
        } else if (!inserted) {
          setUploadError("No se pudo crear el registro. Compruebe RLS o ejecute la migración 20260312140000_empresa_insert_rpc.sql.");
        } else {
          setEmpresa(inserted as Empresa);
          setUploadSuccess(campo === "logo_informes_url" ? "Logo de informes/PDF guardado." : "Logo del sistema guardado.");
          setTimeout(() => setUploadSuccess(null), 4000);
          window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
        }
      }
    }

    setUploadingLogo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    if (localStorage.getItem("forceAuthReview") === "true") {
      setSaveError("Modo demostración: los cambios no se guardan.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = {
      ruc: form.ruc || null,
      direccion: form.direccion || null,
      telefono: form.telefono || null,
      logo_url: form.logo_url || null,
      logo_informes_url: form.logo_informes_url || null
    };
    if (empresa?.id) {
      const { data: updatedRows, error } = await supabase.rpc("update_empresa_datos", {
        p_id: empresa.id,
        p_ruc: payload.ruc,
        p_direccion: payload.direccion,
        p_telefono: payload.telefono,
        p_logo_url: payload.logo_url,
        p_logo_informes_url: payload.logo_informes_url
      });
      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      const rpcNotFound = error && /function|does not exist|not found/i.test(error.message);

      if (error && rpcNotFound) {
        const { data: directUpdated, error: directErr } = await supabase
          .from("empresa")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", empresa.id)
          .select("*")
          .maybeSingle();
        if (!directErr && directUpdated) {
          const r = directUpdated as Empresa;
          setEmpresa(r);
          setForm({
            ruc: r.ruc ?? "",
            direccion: r.direccion ?? "",
            telefono: r.telefono ?? "",
            logo_url: r.logo_url ?? "",
            logo_informes_url: r.logo_informes_url ?? ""
          });
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 5000);
          setSaveError("Guardado con UPDATE directo. Para mayor fiabilidad, ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase.");
          window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
        } else {
          setSaveError("Ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase (función update_empresa_datos no existe).");
        }
      } else if (error) {
        setSaveError("No se pudieron guardar los cambios: " + error.message);
      } else if (!updatedRow) {
        setSaveError("No se actualizó ningún registro. Ejecute la migración 20260312130000_empresa_update_rpc.sql en Supabase.");
      } else {
        const r = updatedRow as Empresa;
        setEmpresa(r);
        setForm({
          ruc: r.ruc ?? "",
          direccion: r.direccion ?? "",
          telefono: r.telefono ?? "",
          logo_url: r.logo_url ?? "",
          logo_informes_url: r.logo_informes_url ?? ""
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
        window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
      }
    } else {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("insert_empresa_datos", {
        p_ruc: payload.ruc,
        p_direccion: payload.direccion,
        p_telefono: payload.telefono,
        p_logo_url: payload.logo_url,
        p_logo_informes_url: payload.logo_informes_url
      });
      const insertedRpc = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!rpcErr && insertedRpc) {
        setEmpresa(insertedRpc as Empresa);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
        window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
      } else {
        const { data, error } = await supabase
          .from("empresa")
          .insert(payload)
          .select("*")
          .maybeSingle();
        if (error) {
          setSaveError("No se pudo crear el registro de empresa: " + error.message);
        } else if (!data) {
          setSaveError("No se pudo crear el registro. Compruebe las políticas RLS (INSERT en empresa) o ejecute la migración 20260312140000_empresa_insert_rpc.sql.");
        } else {
          setEmpresa(data as Empresa);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 5000);
          window.dispatchEvent(new CustomEvent("empresa-logo-updated"));
        }
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <i className="fas fa-spinner fa-spin mr-2" />Cargando datos de la empresa...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <i className="fas fa-building text-agro-primary"></i>
        Datos de la Empresa
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {loadError && (
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-sm flex items-center gap-2 font-medium">
            <i className="fas fa-exclamation-triangle flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        {(uploadError || saveError) && (
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-800 text-sm flex items-center gap-2 font-medium">
            <i className="fas fa-exclamation-circle flex-shrink-0" />
            <span>{uploadError ?? saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-green-50 border-2 border-green-300 text-green-800 text-sm flex items-center gap-2 font-medium">
            <i className="fas fa-check-circle flex-shrink-0" />
            <span>Datos guardados correctamente.</span>
          </div>
        )}
        {uploadSuccess && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle" />
            {uploadSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>RUC</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej: 80000000-0"
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej: +595 900 000000"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Dirección Fiscal</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Calle, Ciudad, Departamento"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-6">
          <div className="space-y-3">
            <label id="logo-sistema-label" className={labelCls}>Logo del sistema</label>
            <p className="text-xs text-gray-500 mb-1">PNG, JPEG o PDF. Máx. 50 MB. Se usa en la interfaz.</p>
            <label htmlFor="file-logo-sistema" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-agro-primary/50 hover:bg-agro-primary/5 cursor-pointer transition-all text-sm font-bold text-gray-600 hover:text-agro-primary">
              <i className="fas fa-upload" />
              {uploadingLogo === "sistema" ? "Subiendo..." : "Elegir archivo"}
            </label>
            <input
              id="file-logo-sistema"
              type="file"
              accept={ACCEPT_LOGOS}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload("logo_url", f);
                e.target.value = "";
              }}
              disabled={uploadingLogo !== null}
            />
            {uploadingLogo === "sistema" && (
              <span className="text-xs text-agro-primary block"><i className="fas fa-spinner fa-spin mr-1" /> Subiendo...</span>
            )}
            {form.logo_url && (
              <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 mb-2">Vista previa (logo del sistema)</p>
                {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(form.logo_url) ? (
                  <a href={`${form.logo_url}${form.logo_url.includes("?") ? "&" : "?"}t=${empresa?.updated_at ?? logoPreviewKey}`} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={`${form.logo_url}${form.logo_url.includes("?") ? "&" : "?"}t=${empresa?.updated_at ?? logoPreviewKey}`} alt="Logo sistema" className="max-h-24 w-auto object-contain rounded-lg bg-white" referrerPolicy="no-referrer" />
                  </a>
                ) : (
                  <a href={form.logo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-agro-primary hover:underline">
                    <i className="fas fa-file-pdf" /> Ver archivo (PDF)
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label id="logo-informes-label" className={labelCls}>Logo para informes y PDFs</label>
            <p className="text-xs text-gray-500 mb-1">PNG, JPEG o PDF. Máx. 50 MB. Se usa en reportes y exportación PDF.</p>
            <label htmlFor="file-logo-informes" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-agro-primary/50 hover:bg-agro-primary/5 cursor-pointer transition-all text-sm font-bold text-gray-600 hover:text-agro-primary">
              <i className="fas fa-upload" />
              {uploadingLogo === "informes" ? "Subiendo..." : "Elegir archivo"}
            </label>
            <input
              id="file-logo-informes"
              type="file"
              accept={ACCEPT_LOGOS}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload("logo_informes_url", f);
                e.target.value = "";
              }}
              disabled={uploadingLogo !== null}
            />
            {uploadingLogo === "informes" && (
              <span className="text-xs text-agro-primary block"><i className="fas fa-spinner fa-spin mr-1" /> Subiendo...</span>
            )}
            {form.logo_informes_url && (
              <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 mb-2">Vista previa (logo informes/PDFs)</p>
                {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(form.logo_informes_url) ? (
                  <a href={`${form.logo_informes_url}${form.logo_informes_url.includes("?") ? "&" : "?"}t=${empresa?.updated_at ?? logoPreviewKey}`} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={`${form.logo_informes_url}${form.logo_informes_url.includes("?") ? "&" : "?"}t=${empresa?.updated_at ?? logoPreviewKey}`} alt="Logo informes" className="max-h-24 w-auto object-contain rounded-lg bg-white" referrerPolicy="no-referrer" />
                  </a>
                ) : (
                  <a href={form.logo_informes_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-agro-primary hover:underline">
                    <i className="fas fa-file-pdf" /> Ver archivo (PDF)
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            className={btnPrimary}
            disabled={saving}
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin mr-2" /> Guardando...</>
            ) : (
              <><i className="fas fa-save mr-2" /> Guardar Cambios</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
