import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { exportToCsv } from "../productos/utils";

interface ClienteRow {
  id: string;
  nombre: string;
  email: string | null;
  estado: string;
  created_at: string;
  id_vendedor?: string | null;
  vendedor_nombre?: string | null;
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
  password: "",
};

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

  const loadClientes = async () => {
    let q = supabase
      .from("clientes")
      .select("id, nombre, email, estado, created_at, id_vendedor")
      .order("created_at", { ascending: false });
    if (perfil?.perfil_acceso === "rtv") {
      q = q.eq("id_vendedor", perfil.id);
    }
    const { data, error } = await q;
    if (!error && data) {
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
          email: d.email,
          estado: d.estado,
          created_at: d.created_at,
          id_vendedor: d.id_vendedor,
          vendedor_nombre: d.id_vendedor ? vendMap[d.id_vendedor] ?? null : null,
        }))
      );
    }
  };

  const loadLookups = async () => {
    const [tp, ec, vend] = await Promise.all([
      supabase.from("tipo_persona").select("id, codigo, descripcion"),
      supabase.from("estado_civil").select("id, codigo, descripcion"),
      supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("estado", "activo")
        .in("perfil_acceso", ["admin", "rtv"]),
    ]);
    if (tp.data) setTipoPersonas(tp.data as Lookup[]);
    if (ec.data) setEstadosCiviles(ec.data as Lookup[]);
    if (vend.data) setVendedores(vend.data as UsuarioOption[]);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadClientes(), loadLookups()]);
      setLoading(false);
    };
    load();
  }, []);

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

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(false);
  };

  const handleNuevo = () => {
    resetForm();
    setForm((f) => ({ ...f, id_vendedor: perfil?.id ?? "", estado: "activo" }));
    setShowModal(true);
  };

  const handleEdit = async (row: ClienteRow) => {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", row.id)
      .single();
    if (!data) return;
    const d = data as any;
    setEditing(row);
    setForm({
      id_tipo_persona: d.id_tipo_persona ?? "",
      ci: d.ci ?? "",
      ruc: d.ruc ?? "",
      nombre: d.nombre,
      fecha_nacimiento: d.fecha_nacimiento
        ? d.fecha_nacimiento.slice(0, 10)
        : "",
      id_estado_civil: d.id_estado_civil ?? "",
      telefono: d.telefono ?? "",
      direccion: d.direccion ?? "",
      email: d.email ?? "",
      nombre_contador: d.nombre_contador ?? "",
      telefono_contador: d.telefono_contador ?? "",
      fecha_inicio: d.fecha_inicio ? d.fecha_inicio.slice(0, 10) : "",
      area_propia_ha: d.area_propia_ha != null ? String(d.area_propia_ha) : "",
      area_alquilada_ha:
        d.area_alquilada_ha != null ? String(d.area_alquilada_ha) : "",
      archivo_ci_url: d.archivo_ci_url ?? "",
      estado: d.estado,
      id_vendedor: d.id_vendedor ?? "",
      password: "",
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
        area_propia_ha:
          form.area_propia_ha !== "" ? Number(form.area_propia_ha) : null,
        area_alquilada_ha:
          form.area_alquilada_ha !== ""
            ? Number(form.area_alquilada_ha)
            : null,
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
      const email = form.email.trim();
      if (!email) {
        setSaving(false);
        return;
      }
      const password = form.password.trim() || `Temp${Date.now()}!`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre: form.nombre.trim(), perfil_acceso: "cliente" },
        },
      });
      if (authError) {
        alert(
          "No se pudo crear el usuario. " +
            (authError.message || "Verifique el email y que no esté ya registrado.")
        );
        setSaving(false);
        return;
      }
      const userId = authData.user?.id;
      if (userId) {
        await supabase.from("usuarios").insert({
          id: userId,
          nombre: form.nombre.trim(),
          email,
          perfil_acceso: "cliente",
          estado: "activo",
        });
        const { data: inserted } = await supabase
          .from("clientes")
          .insert({
            id_usuario_auth: userId,
            id_vendedor: form.id_vendedor || null,
            id_tipo_persona: form.id_tipo_persona || null,
            ci: form.ci.trim() || null,
            ruc: form.ruc.trim() || null,
            nombre: form.nombre.trim(),
            fecha_nacimiento: form.fecha_nacimiento || null,
            id_estado_civil: form.id_estado_civil || null,
            telefono: form.telefono.trim() || null,
            direccion: form.direccion.trim() || null,
            email,
            nombre_contador: form.nombre_contador.trim() || null,
            telefono_contador: form.telefono_contador.trim() || null,
            fecha_inicio: form.fecha_inicio || null,
            area_propia_ha:
              form.area_propia_ha !== "" ? Number(form.area_propia_ha) : null,
            area_alquilada_ha:
              form.area_alquilada_ha !== ""
                ? Number(form.area_alquilada_ha)
                : null,
            archivo_ci_url: form.archivo_ci_url.trim() || null,
            estado: form.estado,
          })
          .select("id")
          .single();
        if (!inserted) {
          await supabase.from("usuarios").delete().eq("id", userId);
        }
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
    exportToCsv(
      toExport,
      `clientes_${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_COLUMNS
    );
  };

  if (loading) return <span>Cargando clientes...</span>;

  const isAdmin = perfil?.perfil_acceso === "admin";

  return (
    <div>
      <h5 className="mb-3">Clientes</h5>
      <div className="row mb-3">
        <div className="col-md-2">
          <label className="form-label">Estado</label>
          <select
            className="form-control form-control-sm"
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
        {isAdmin && (
          <div className="col-md-3">
            <label className="form-label">Vendedor</label>
            <select
              className="form-control form-control-sm"
              value={filterVendedor}
              onChange={(e) => setFilterVendedor(e.target.value)}
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre ?? v.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-md-4">
          <label className="form-label">Buscar</label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Nombre o email"
            value={filterBusqueda}
            onChange={(e) => setFilterBusqueda(e.target.value)}
          />
        </div>
        <div className="col-md-3 d-flex align-items-end gap-2">
          <button type="button" className="btn btn-success btn-sm" onClick={handleNuevo}>
            <i className="fas fa-plus mr-1" />
            Nuevo
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleExportCsv}
          >
            <i className="fas fa-download mr-1" />
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-hover">
          <thead className="thead-dark">
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Vendedor</th>
              <th>Estado</th>
              <th>Fecha creación</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className={r.estado === "inactivo" ? "table-secondary" : ""}>
                <td>{r.nombre}</td>
                <td>{r.email ?? "-"}</td>
                <td>{r.vendedor_nombre ?? "-"}</td>
                <td>
                  <span
                    className={`badge ${r.estado === "activo" ? "badge-success" : "badge-secondary"}`}
                  >
                    {r.estado === "activo" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-success"
                    onClick={() => handleEdit(r)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRows.length === 0 && <p className="text-muted">No hay registros.</p>}

      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  {editing ? "Editar cliente" : "Nuevo cliente"}
                </h5>
                <button
                  type="button"
                  className="close text-white"
                  onClick={resetForm}
                  aria-label="Cerrar"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Tipo de persona</label>
                        <select
                          className="form-control"
                          value={form.id_tipo_persona}
                          onChange={(e) =>
                            setForm({ ...form, id_tipo_persona: e.target.value })
                          }
                        >
                          <option value="">Seleccione</option>
                          {tipoPersonas.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.descripcion}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>CI</label>
                        <input
                          className="form-control"
                          placeholder="CI"
                          value={form.ci}
                          onChange={(e) => setForm({ ...form, ci: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>RUC</label>
                        <input
                          className="form-control"
                          placeholder="RUC"
                          value={form.ruc}
                          onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>Nombre</label>
                        <input
                          className="form-control"
                          placeholder="Nombre"
                          value={form.nombre}
                          onChange={(e) =>
                            setForm({ ...form, nombre: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="form-group">
                        <label>Fecha nacimiento</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.fecha_nacimiento}
                          onChange={(e) =>
                            setForm({ ...form, fecha_nacimiento: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="form-group">
                        <label>Estado civil</label>
                        <select
                          className="form-control"
                          value={form.id_estado_civil}
                          onChange={(e) =>
                            setForm({ ...form, id_estado_civil: e.target.value })
                          }
                        >
                          <option value="">Seleccione</option>
                          {estadosCiviles.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.descripcion}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Teléfono</label>
                        <input
                          className="form-control"
                          placeholder="Teléfono"
                          value={form.telefono}
                          onChange={(e) =>
                            setForm({ ...form, telefono: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="Email"
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          required={!editing}
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Vendedor</label>
                        <select
                          className="form-control"
                          value={form.id_vendedor}
                          onChange={(e) =>
                            setForm({ ...form, id_vendedor: e.target.value })
                          }
                        >
                          <option value="">Seleccione</option>
                          {vendedores.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.nombre ?? v.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Dirección</label>
                    <input
                      className="form-control"
                      placeholder="Dirección"
                      value={form.direccion}
                      onChange={(e) =>
                        setForm({ ...form, direccion: e.target.value })
                      }
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Nombre contador</label>
                        <input
                          className="form-control"
                          placeholder="Nombre contador"
                          value={form.nombre_contador}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nombre_contador: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Teléfono contador</label>
                        <input
                          className="form-control"
                          placeholder="Teléfono contador"
                          value={form.telefono_contador}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              telefono_contador: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Fecha inicio</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.fecha_inicio}
                          onChange={(e) =>
                            setForm({ ...form, fecha_inicio: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Área propia (Ha)</label>
                        <input
                          type="number"
                          step="0.001"
                          className="form-control"
                          placeholder="0"
                          value={form.area_propia_ha}
                          onChange={(e) =>
                            setForm({ ...form, area_propia_ha: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Área alquilada (Ha)</label>
                        <input
                          type="number"
                          step="0.001"
                          className="form-control"
                          placeholder="0"
                          value={form.area_alquilada_ha}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              area_alquilada_ha: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="form-group">
                        <label>Archivo CI (URL)</label>
                        <input
                          className="form-control"
                          placeholder="URL"
                          value={form.archivo_ci_url}
                          onChange={(e) =>
                            setForm({ ...form, archivo_ci_url: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {!editing && (
                    <div className="form-group">
                      <label>Contraseña inicial (opcional)</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="El admin puede resetear después"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Estado</label>
                    <select
                      className="form-control"
                      value={form.estado}
                      onChange={(e) =>
                        setForm({ ...form, estado: e.target.value })
                      }
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? "Guardando..." : editing ? "Alterar" : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
