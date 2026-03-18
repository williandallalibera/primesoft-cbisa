import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { exportToCsv } from "../productos/utils";

interface ClienteRow {
  id: string;
  nombre: string;
  email: string | null;
  ruc: string | null;
  telefono: string | null;
  estado: string;
  created_at: string;
  id_vendedor?: string | null;
  vendedor_nombre?: string | null;
  id_versat?: number | null;
}

interface Lookup {
  id: string;
  codigo: string;
  descripcion: string;
}

interface UsuarioOption {
  id: string;
  nombre: string | null;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const CSV_COLUMNS = [
  { key: "nombre", header: "Nombre" },
  { key: "email", header: "Email" },
  { key: "ruc", header: "RUC" },
  { key: "telefono", header: "Teléfono" },
  { key: "vendedor_nombre", header: "Vendedor" },
  { key: "estado", header: "Estado" },
  { key: "created_at", header: "Fecha creación" },
];

const emptyForm = {
  id_tipo_persona: "",
  ci: "",
  ruc: "",
  nombre: "",
  fecha_nacimiento: "",
  id_estado_civil: "",
  telefono: "",
  direccion: "",
  email: "",
  nombre_contador: "",
  telefono_contador: "",
  fecha_inicio: "",
  area_propia_ha: "",
  area_alquilada_ha: "",
  archivo_ci_url: "",
  estado: "activo",
  id_vendedor: "",
};

// ──────────────────────────────────────────────
// Shared input / button classes
// ──────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";

const labelCls = "block text-xs font-bold text-gray-600 mb-1";

const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";

const btnSecondary =
  "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

const btnDanger =
  "inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 transition-all";

function Badge({ estado }: { estado: string }) {
  return estado === "activo" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
      Inactivo
    </span>
  );
}

export function ClientesTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [tipoPersonas, setTipoPersonas] = useState<Lookup[]>([]);
  const [estadosCiviles, setEstadosCiviles] = useState<Lookup[]>([]);
  const [vendedores, setVendedores] = useState<UsuarioOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterEstado, setFilterEstado] = useState("");
  const [filterBusqueda, setFilterBusqueda] = useState("");
  const [filterVendedor, setFilterVendedor] = useState("");

  const isAdmin = perfil?.perfil_acceso === "admin";

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterEstado) list = list.filter((r) => r.estado === filterEstado);
    if (filterVendedor) {
      list = list.filter((r) => (r as ClienteRow & { id_vendedor?: string }).id_vendedor === filterVendedor);
    }
    if (filterBusqueda.trim()) {
      const q = filterBusqueda.toLowerCase();
      list = list.filter(
        (r) =>
          r.nombre.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, filterEstado, filterVendedor, filterBusqueda]);

  const loadClientes = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("ClientesTab: Review Mode - Injecting mock clients");
      setRows([
        { id: "cl-1", nombre: "Fazenda Santa Maria", email: "contato@santamaria.com", ruc: "80012345-6", telefono: "021 123 456", estado: "activo", created_at: new Date().toISOString(), vendedor_nombre: "Admin Sistema" },
        { id: "cl-2", nombre: "Agroindustrial Los Abuelos", email: "info@losabuelos.com.py", ruc: null, telefono: "0981 111 222", estado: "activo", created_at: new Date().toISOString(), vendedor_nombre: "RTV Carlos" },
        { id: "cl-3", nombre: "Cooperativa Multiactiva Ltda", email: "administracao@coop.com", ruc: "80099999-1", telefono: null, estado: "activo", created_at: new Date().toISOString(), vendedor_nombre: "Admin Sistema" },
        { id: "cl-4", nombre: "Estancia El Rodeo", email: "rodeo@ranch.com", ruc: null, telefono: null, estado: "inactivo", created_at: new Date().toISOString(), vendedor_nombre: "RTV Carlos" }
      ] as ClienteRow[]);
      return;
    }

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, email, ruc, telefono, estado, created_at, id_vendedor, id_versat")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const vendIds = [...new Set((data as any[]).map((d) => d.id_vendedor).filter(Boolean))];
      let vendMap: Record<string, string> = {};
      if (vendIds.length > 0) {
        const { data: us } = await supabase
          .from("usuarios")
          .select("id, nombre")
          .in("id", vendIds);
        if (us) vendMap = Object.fromEntries((us as any[]).map((u) => [u.id, u.nombre ?? ""]));
      }
      setRows(
        (data as any[]).map((d) => ({
          id: d.id,
          nombre: d.nombre,
          email: d.email ?? null,
          ruc: d.ruc ?? null,
          telefono: d.telefono ?? null,
          estado: d.estado,
          created_at: d.created_at,
          id_vendedor: d.id_vendedor,
          vendedor_nombre: d.id_vendedor ? vendMap[d.id_vendedor] ?? null : null,
          id_versat: d.id_versat ?? null,
        }))
      );
    }
  };

  const loadLookups = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setTipoPersonas([
        { id: "tp-1", codigo: "F", descripcion: "Física" },
        { id: "tp-2", codigo: "J", descripcion: "Jurídica" }
      ]);
      setEstadosCiviles([
        { id: "ec-1", codigo: "S", descripcion: "Soltero/a" },
        { id: "ec-2", codigo: "C", descripcion: "Casado/a" },
        { id: "ec-3", codigo: "D", descripcion: "Divorciado/a" }
      ]);
      setVendedores([
        { id: "mock-1", nombre: "Admin Sistema" },
        { id: "mock-2", nombre: "RTV Carlos" }
      ]);
      return;
    }

    const [tp, ec, vend] = await Promise.all([
      supabase.from("tipo_persona").select("id, codigo, descripcion"),
      supabase.from("estado_civil").select("id, codigo, descripcion"),
      supabase.from("usuarios").select("id, nombre").eq("estado", "activo").in("perfil_acceso", ["admin", "rtv"]),
    ]);

    if (tp.data && tp.data.length > 0) setTipoPersonas(tp.data as Lookup[]);
    if (ec.data && ec.data.length > 0) setEstadosCiviles(ec.data as Lookup[]);
    if (vend.data && vend.data.length > 0) setVendedores(vend.data as UsuarioOption[]);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadClientes(), loadLookups()]);
      setLoading(false);
    };
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(false);
  };

  const handleNuevo = () => {
    if (!isAdmin) return;
    resetForm();
    setForm((f) => ({ ...f, id_vendedor: perfil?.id ?? "", estado: "activo" }));
    setShowModal(true);
  };

  const handleEdit = async (row: ClienteRow) => {
    if (!isAdmin) return;
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setEditing(row);
      setForm({
        id_tipo_persona: "",
        ci: "",
        ruc: "",
        nombre: row.nombre,
        fecha_nacimiento: "",
        id_estado_civil: "",
        telefono: "",
        direccion: "",
        email: row.email ?? "",
        nombre_contador: "",
        telefono_contador: "",
        fecha_inicio: "",
        area_propia_ha: "",
        area_alquilada_ha: "",
        archivo_ci_url: "",
        estado: row.estado,
        id_vendedor: row.id_vendedor ?? "",
      });
      setShowModal(true);
      return;
    }

    const { data } = await supabase.from("clientes").select("*").eq("id", row.id).single();
    if (!data) return;
    const d = data as any;
    setEditing(row);
    setForm({
      id_tipo_persona: d.id_tipo_persona ?? "",
      ci: d.ci ?? "",
      ruc: d.ruc ?? "",
      nombre: d.nombre,
      fecha_nacimiento: d.fecha_nacimiento ? d.fecha_nacimiento.slice(0, 10) : "",
      id_estado_civil: d.id_estado_civil ?? "",
      telefono: d.telefono ?? "",
      direccion: d.direccion ?? "",
      email: d.email ?? "",
      nombre_contador: d.nombre_contador ?? "",
      telefono_contador: d.telefono_contador ?? "",
      fecha_inicio: d.fecha_inicio ? d.fecha_inicio.slice(0, 10) : "",
      area_propia_ha: d.area_propia_ha != null ? String(d.area_propia_ha) : "",
      area_alquilada_ha: d.area_alquilada_ha != null ? String(d.area_alquilada_ha) : "",
      archivo_ci_url: d.archivo_ci_url ?? "",
      estado: d.estado,
      id_vendedor: d.id_vendedor ?? "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editing) {
      const payload = {
        id_tipo_persona: form.id_tipo_persona || null,
        ci: form.ci.trim() || null,
        ruc: form.ruc.trim() || null,
        nombre: form.nombre.trim(),
        fecha_nacimiento: form.fecha_nacimiento || null,
        id_estado_civil: form.id_estado_civil || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        email: form.email.trim() || null,
        nombre_contador: form.nombre_contador.trim() || null,
        telefono_contador: form.telefono_contador.trim() || null,
        fecha_inicio: form.fecha_inicio || null,
        area_propia_ha: form.area_propia_ha !== "" ? Number(form.area_propia_ha) : null,
        area_alquilada_ha: form.area_alquilada_ha !== "" ? Number(form.area_alquilada_ha) : null,
        archivo_ci_url: form.archivo_ci_url.trim() || null,
        estado: form.estado,
        id_vendedor: form.id_vendedor || null,
      };
      await supabase.from("clientes").update(payload).eq("id", editing.id);

      if (form.estado === "inactivo") {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id_usuario_auth")
          .eq("id", editing.id)
          .single();
        if (cliente?.id_usuario_auth) {
          await supabase
            .from("usuarios")
            .update({ estado: "inactivo" })
            .eq("id", (cliente as any).id_usuario_auth);
        }
      }
    } else {
      const { error: insertError } = await supabase.from("clientes").insert({
        id_usuario_auth: null,
        id_vendedor: form.id_vendedor || null,
        id_tipo_persona: form.id_tipo_persona || null,
        ci: form.ci.trim() || null,
        ruc: form.ruc.trim() || null,
        nombre: form.nombre.trim(),
        fecha_nacimiento: form.fecha_nacimiento || null,
        id_estado_civil: form.id_estado_civil || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        email: form.email.trim() || null,
        nombre_contador: form.nombre_contador.trim() || null,
        telefono_contador: form.telefono_contador.trim() || null,
        fecha_inicio: form.fecha_inicio || null,
        area_propia_ha: form.area_propia_ha !== "" ? Number(form.area_propia_ha) : null,
        area_alquilada_ha: form.area_alquilada_ha !== "" ? Number(form.area_alquilada_ha) : null,
        archivo_ci_url: form.archivo_ci_url.trim() || null,
        estado: form.estado,
      });
      if (insertError) {
        alert("Error al crear cliente: " + (insertError.message ?? ""));
        setSaving(false);
        return;
      }
    }

    await loadClientes();
    resetForm();
    setSaving(false);
  };

  const handleExportCsv = () => {
    const toExport = filteredRows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toLocaleDateString("es-PY"),
    }));
    exportToCsv(toExport, `clientes_${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <i className="fas fa-spinner fa-spin mr-2" />
        Cargando clientes...
      </div>
    );
  }

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className={labelCls}>Estado</label>
          <select className={inputCls} value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            {ESTADOS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div className="flex-1 min-w-[160px]">
            <label className={labelCls}>Vendedor</label>
            <select className={inputCls} value={filterVendedor} onChange={(e) => setFilterVendedor(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre ?? v.id}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-[2] min-w-[200px]">
          <label className={labelCls}>Buscar</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              className={inputCls + " pl-8"}
              placeholder="Nombre o email..."
              value={filterBusqueda}
              onChange={(e) => setFilterBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <button type="button" className={btnPrimary} onClick={handleNuevo}>
              <i className="fas fa-plus text-xs" />
              Nuevo
            </button>
          )}
          <button type="button" className={btnSecondary} onClick={handleExportCsv}>
            <i className="fas fa-download text-xs" />
            CSV
          </button>
        </div>
      </div>

      {/* ── Tabla (scroll horizontal; columna Acciones fija a la derecha) ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Origen</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">RUC</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Tel</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Vendedor</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="sticky right-0 z-10 min-w-[100px] px-4 py-3 text-right font-bold text-gray-600 text-xs uppercase tracking-wide bg-gray-50 border-l border-gray-200 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map((r) => (
              <tr
                key={r.id}
                className={`group hover:bg-gray-50 transition-colors ${r.estado === "inactivo" ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  {r.id_versat != null ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">VERSAT</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{r.email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.ruc ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{r.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{r.vendedor_nombre ?? "—"}</td>
                <td className="px-4 py-3"><Badge estado={r.estado} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td className="sticky right-0 z-10 px-4 py-3 text-right bg-white group-hover:bg-gray-50 border-l border-gray-100 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                  {isAdmin && r.id_versat == null && (
                    <button
                      type="button"
                      className="text-xs font-bold text-agro-primary hover:underline"
                      onClick={() => handleEdit(r)}
                    >
                      Editar
                    </button>
                  )}
                  {isAdmin && r.id_versat != null && (
                    <span className="text-xs text-gray-400" title="Sincronizado con VERSAT; solo lectura">Solo lectura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-users mb-2 text-2xl block" />
            No hay clientes registrados.
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-user text-sm" />
                </div>
                <h3 className="font-bold text-gray-900">{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                {/* Identificación */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Identificación</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Tipo de persona</label>
                      <select className={inputCls} value={form.id_tipo_persona} onChange={(e) => setForm({ ...form, id_tipo_persona: e.target.value })}>
                        <option value="">Seleccione</option>
                        {tipoPersonas.map((t) => <option key={t.id} value={t.id}>{t.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>CI</label>
                      <input className={inputCls} placeholder="CI" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>RUC</label>
                      <input className={inputCls} placeholder="RUC" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Datos personales */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datos personales</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Nombre *</label>
                      <input className={inputCls} placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha de nacimiento</label>
                      <input type="date" className={inputCls} value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Estado civil</label>
                      <select className={inputCls} value={form.id_estado_civil} onChange={(e) => setForm({ ...form, id_estado_civil: e.target.value })}>
                        <option value="">Seleccione</option>
                        {estadosCiviles.map((e) => <option key={e.id} value={e.id}>{e.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Teléfono</label>
                      <input className={inputCls} placeholder="+595 900 000000" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Dirección</label>
                      <input className={inputCls} placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Acceso */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Acceso al sistema</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Email {!editing && "*"}</label>
                      <input type="email" className={inputCls} placeholder="email@ejemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!editing} />
                    </div>
                    <div>
                      <label className={labelCls}>Vendedor asignado</label>
                      <select className={inputCls} value={form.id_vendedor} onChange={(e) => setForm({ ...form, id_vendedor: e.target.value })}>
                        <option value="">Seleccione</option>
                        {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre ?? v.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Estado</label>
                      <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Datos agrícolas */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datos agrícolas</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Fecha inicio</label>
                      <input type="date" className={inputCls} value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Área propia (Ha)</label>
                      <input type="number" step="0.001" className={inputCls} placeholder="0" value={form.area_propia_ha} onChange={(e) => setForm({ ...form, area_propia_ha: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Área alquilada (Ha)</label>
                      <input type="number" step="0.001" className={inputCls} placeholder="0" value={form.area_alquilada_ha} onChange={(e) => setForm({ ...form, area_alquilada_ha: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Contador */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contador</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Nombre contador</label>
                      <input className={inputCls} placeholder="Nombre del contador" value={form.nombre_contador} onChange={(e) => setForm({ ...form, nombre_contador: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Teléfono contador</label>
                      <input className={inputCls} placeholder="Teléfono" value={form.telefono_contador} onChange={(e) => setForm({ ...form, telefono_contador: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button type="button" className={btnSecondary} onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                  ) : editing ? "Guardar cambios" : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
