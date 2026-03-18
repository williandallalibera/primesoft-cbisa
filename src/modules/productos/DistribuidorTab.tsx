import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { exportToCsv } from "./utils";

interface DistribuidorRow {
  id: string;
  fabricante: string;
  distribuidor: string;
  estado: string;
  created_at: string;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const CSV_COLUMNS = [
  { key: "fabricante", header: "Fabricante" },
  { key: "distribuidor", header: "Distribuidor" },
  { key: "estado", header: "Estado" },
  { key: "created_at", header: "Fecha creación" },
];

export function DistribuidorTab() {
  const { perfil } = useAuth();
  const isAdmin = perfil?.perfil_acceso === "admin";
  const [rows, setRows] = useState<DistribuidorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DistribuidorRow | null>(null);
  const [form, setForm] = useState({
    fabricante: "",
    distribuidor: "",
    estado: "activo",
  });
  const [filterEstado, setFilterEstado] = useState("");
  const [filterBusqueda, setFilterBusqueda] = useState("");

  const load = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("DistribuidorTab: Review Mode - Injecting mock distribuidores");
      setRows([
        { id: "d-1", fabricante: "Monsanto", distribuidor: "AgroDistribuidora Sul", estado: "activo", created_at: new Date().toISOString() },
        { id: "d-2", fabricante: "Syngenta", distribuidor: "Paraná Insumos", estado: "activo", created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: "d-3", fabricante: "Bayer", distribuidor: "AgroDistribuidora Sul", estado: "inactivo", created_at: new Date(Date.now() - 86400000 * 2).toISOString() }
      ]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("distribuidores")
      .select("id, fabricante, distribuidor, estado, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setRows(data as DistribuidorRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterEstado) {
      list = list.filter((r) => r.estado === filterEstado);
    }
    if (filterBusqueda.trim()) {
      const q = filterBusqueda.toLowerCase();
      list = list.filter(
        (r) =>
          r.fabricante.toLowerCase().includes(q) ||
          r.distribuidor.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filterEstado, filterBusqueda]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      fabricante: "",
      distribuidor: "",
      estado: "activo",
    });
    setShowModal(false);
  };

  const handleNuevo = () => {
    if (!isAdmin) return;
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (row: DistribuidorRow) => {
    if (!isAdmin) return;
    setEditing(row);
    setForm({
      fabricante: row.fabricante,
      distribuidor: row.distribuidor,
      estado: row.estado,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    if (editing) {
      await supabase
        .from("distribuidores")
        .update({
          fabricante: form.fabricante.trim(),
          distribuidor: form.distribuidor.trim(),
          estado: form.estado,
        })
        .eq("id", editing.id);
    } else {
      await supabase.from("distribuidores").insert({
        fabricante: form.fabricante.trim(),
        distribuidor: form.distribuidor.trim(),
        estado: form.estado,
      });
    }
    await load();
    resetForm();
    setShowModal(false);
    setSaving(false);
  };

  const handleExportCsv = () => {
    const toExport = filteredRows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toLocaleDateString("es-PY"),
    }));
    exportToCsv(
      toExport,
      `distribuidores_${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_COLUMNS
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <i className="fas fa-spinner fa-spin mr-2" />Cargando distribuidores...
      </div>
    );
  }

  return (
    <div>
      {/* — Filtros — */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="min-w-[140px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Estado</label>
          <select
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            {ESTADOS.map((o) => (<option key={o.value || "all"} value={o.value}>{o.label}</option>))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Buscar</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              className="w-full pl-8 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
              placeholder="Fabricante o distribuidor..."
              value={filterBusqueda}
              onChange={(e) => setFilterBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button type="button" className="inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95" onClick={handleNuevo}>
              <i className="fas fa-plus text-xs" />Nuevo
            </button>
          )}
          <button type="button" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all" onClick={handleExportCsv}>
            <i className="fas fa-download text-xs" />CSV
          </button>
        </div>
      </div>

      {/* — Tabla — */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fabricante</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Distribuidor</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === "inactivo" ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.fabricante}</td>
                <td className="px-4 py-3 text-gray-600">{r.distribuidor}</td>
                <td className="px-4 py-3">
                  {r.estado === "activo"
                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Activo</span>
                    : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <button type="button" className="text-xs font-bold text-agro-primary hover:underline" onClick={() => handleEdit(r)}>Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-truck mb-2 text-2xl block" />No hay distribuidores registrados.
          </div>
        )}
      </div>

      {/* — Modal — */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-truck text-sm" />
                </div>
                <h3 className="font-bold text-gray-900">{editing ? "Editar distribuidor" : "Nuevo distribuidor"}</h3>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-times" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Fabricante *</label>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
                    placeholder="Fabricante"
                    value={form.fabricante}
                    onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Distribuidor *</label>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
                    placeholder="Distribuidor"
                    value={form.distribuidor}
                    onChange={(e) => setForm({ ...form, distribuidor: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Estado</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button type="button" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all" onClick={resetForm}>Cancelar</button>
                <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95" disabled={saving}>
                  {saving ? <><i className="fas fa-spinner fa-spin text-xs" />Guardando...</> : editing ? "Guardar cambios" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
