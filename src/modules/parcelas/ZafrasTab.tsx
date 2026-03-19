import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { exportToCsv } from "../productos/utils";

interface ZafraRow {
  id: string;
  nombre_zafra: string;
  ciclo: number | null;
  id_cultura: string | null;
  cultura_desc: string;
  estado: string;
  created_at: string;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const CSV_COLUMNS = [
  { key: "nombre_zafra", header: "Nombre Zafra" },
  { key: "ciclo", header: "Ciclo" },
  { key: "cultura_desc", header: "Cultura" },
  { key: "estado", header: "Estado" },
  { key: "created_at", header: "Fecha criação" },
];

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 touch-manipulation";
const btnSecondary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all touch-manipulation";

export function ZafrasTab() {
  const { perfil } = useAuth();
  const isAdmin = perfil?.perfil_acceso === "admin";
  const [rows, setRows] = useState<ZafraRow[]>([]);
  const [culturas, setCulturas] = useState<{ id: string; descripcion: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ZafraRow | null>(null);
  const [form, setForm] = useState({
    nombre_zafra: "",
    ciclo: "",
    id_cultura: "",
    estado: "activo",
  });
  const [filterEstado, setFilterEstado] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        console.log("ZafrasTab: Review Mode - Injecting mock data");
        setRows([
          { id: "z-1", nombre_zafra: "Zafra 2025/2026", ciclo: 2025, id_cultura: "cl-1", cultura_desc: "Soja", estado: "activo", created_at: new Date().toISOString() },
          { id: "z-2", nombre_zafra: "Zafriña 2025", ciclo: 2025, id_cultura: "cl-2", cultura_desc: "Maíz", estado: "activo", created_at: new Date().toISOString() }
        ]);
        setCulturas([
          { id: "cl-1", descripcion: "Soja" }, { id: "cl-2", descripcion: "Maíz" }
        ]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("zafras")
        .select("id, nombre_zafra, ciclo, id_cultura, estado, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const cultIds = [...new Set((data as any[]).map((d) => d.id_cultura).filter(Boolean))];
        let cultMap: Record<string, string> = {};
        if (cultIds.length > 0) {
          const { data: c } = await supabase
            .from("culturas")
            .select("id, descripcion")
            .in("id", cultIds);
          if (c) cultMap = Object.fromEntries((c as any[]).map((x) => [x.id, x.descripcion]));
        }
        setRows(
          (data as any[]).map((d) => ({
            id: d.id,
            nombre_zafra: d.nombre_zafra,
            ciclo: d.ciclo,
            id_cultura: d.id_cultura ?? null,
            cultura_desc: d.id_cultura ? cultMap[d.id_cultura] ?? "" : "",
            estado: d.estado,
            created_at: d.created_at,
          }))
        );
      } else if (error) {
        console.error("Error loading zafras:", error.message);
        setRows([]);
      }
      const { data: cult } = await supabase.from("culturas").select("id, descripcion");
      if (cult) setCulturas(cult as any);
    } catch (err) {
      console.error("ZafrasTab load error:", err);
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!filterEstado) return rows;
    return rows.filter((r) => r.estado === filterEstado);
  }, [rows, filterEstado]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      nombre_zafra: "",
      ciclo: "",
      id_cultura: "",
      estado: "activo",
    });
    setShowModal(false);
  };

  const handleNuevo = () => {
    if (!isAdmin) return;
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (row: ZafraRow) => {
    if (!isAdmin) return;
    setEditing(row);
    setForm({
      nombre_zafra: row.nombre_zafra,
      ciclo: row.ciclo != null ? String(row.ciclo) : "",
      id_cultura: row.id_cultura ?? "",
      estado: row.estado,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre_zafra: form.nombre_zafra.trim(),
      ciclo: form.ciclo !== "" ? parseInt(form.ciclo, 10) : null,
      id_cultura: form.id_cultura || null,
      estado: form.estado,
    };
    if (editing) {
      await supabase.from("zafras").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("zafras").insert(payload);
    }
    await load();
    resetForm();
    setSaving(false);
  };

  const handleExportCsv = () => {
    const toExport = filtered.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toLocaleDateString("es-PY"),
    }));
    exportToCsv(
      toExport,
      `zafras_${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_COLUMNS
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando zafras...
    </div>
  );

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-5 items-end">
        <div className="w-full sm:min-w-[140px]">
          <label className={labelCls}>Estado</label>
          <select
            className={`${inputCls} min-h-[44px]`}
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            {ESTADOS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {isAdmin && (
            <button type="button" className={btnPrimary} onClick={handleNuevo}>
              <i className="fas fa-plus text-xs" /> Nuevo
            </button>
          )}
          <button type="button" className={btnSecondary} onClick={handleExportCsv}>
            <i className="fas fa-download text-xs" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Nombre Zafra</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Ciclo</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cultura</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha creación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === "inactivo" ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.nombre_zafra}</td>
                <td className="px-4 py-3 text-gray-600">{r.ciclo ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{r.cultura_desc || "—"}</td>
                <td className="px-4 py-3">
                  {r.estado === "activo" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td className="px-3 py-3 text-right">
                  {isAdmin && (
                    <button
                      type="button"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-agro-primary hover:bg-agro-primary/10 rounded-lg transition-colors touch-manipulation"
                      onClick={() => handleEdit(r)}
                    >
                      <i className="fas fa-edit" /> <span className="sm:inline">Editar</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-calendar-alt mb-2 text-2xl block" />
            No hay registros.
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center shrink-0">
                  <i className="fas fa-calendar-check text-sm" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                  {editing ? "Editar zafra" : "Nueva zafra"}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation shrink-0"
              >
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className={labelCls}>Nombre Zafra *</label>
                  <input
                    className={`${inputCls} min-h-[44px]`}
                    placeholder="Nombre de la zafra"
                    value={form.nombre_zafra}
                    onChange={(e) => setForm({ ...form, nombre_zafra: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Ciclo (año)</label>
                  <input
                    type="number"
                    className={`${inputCls} min-h-[44px]`}
                    placeholder="Ej: 2025"
                    value={form.ciclo}
                    onChange={(e) => setForm({ ...form, ciclo: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Cultura</label>
                  <select
                    className={`${inputCls} min-h-[44px]`}
                    value={form.id_cultura}
                    onChange={(e) => setForm({ ...form, id_cultura: e.target.value })}
                  >
                    <option value="">Seleccione</option>
                    {culturas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select
                    className={`${inputCls} min-h-[44px]`}
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-100">
                <button type="button" className={btnSecondary} onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                  ) : editing ? (
                    "Guardar cambios"
                  ) : (
                    "Crear zafra"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
