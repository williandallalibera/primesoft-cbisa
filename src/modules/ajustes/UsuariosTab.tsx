import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface UsuarioRow {
  id: string;
  nombre: string | null;
  ci: string | null;
  telefono: string | null;
  email: string | null;
  perfil_acceso: string;
  estado: string;
}

interface ClienteSinUsuario {
  id: string;
  nombre: string;
  email: string | null;
}

// Perfiles de acceso (rol en el sistema), no confundir con "perfil de usuario" en Auth
const PERFILES_ACCESO = [
  { value: "admin", label: "Administrador", icon: "fa-user-shield" },
  { value: "rtv", label: "Consultor RTV", icon: "fa-user-tie" },
  { value: "cliente", label: "Productor / Cliente", icon: "fa-user" },
];

const inputCls = "w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelCls = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1";
const btnPrimary = "inline-flex items-center gap-2 px-6 py-2.5 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50";

type TipoNuevoUsuario = "sistema" | "cliente";

export function UsuariosTab() {
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tipoNuevoUsuario, setTipoNuevoUsuario] = useState<TipoNuevoUsuario>("sistema");
  const [clientesSinUsuario, setClientesSinUsuario] = useState<ClienteSinUsuario[]>([]);
  const [idClienteSeleccionado, setIdClienteSeleccionado] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    ci: "",
    telefono: "",
    email: "",
    perfil_acceso: "rtv",
    estado: "activo",
    password: "",
    nuevaContraseña: ""
  });

  const load = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";

    if (isReviewMode) {
      console.log("UsuariosTab: Review Mode - Injecting mock data");
      setRows([
        { id: "mock-1", nombre: "Admin Sistema", ci: "1.000.001", telefono: "0981 111 222", email: "admin@cbisa.com", perfil_acceso: "admin", estado: "activo" },
        { id: "mock-2", nombre: "RTV Carlos", ci: "2.000.002", telefono: "0982 222 333", email: "carlos@cbisa.com", perfil_acceso: "rtv", estado: "activo" },
        { id: "mock-3", nombre: "Productor Juan", ci: "3.000.003", telefono: "0983 333 444", email: "juan@agromail.com", perfil_acceso: "cliente", estado: "activo" },
        { id: "mock-4", nombre: "Usuario Inactivo", ci: "4.000.004", telefono: "0984 444 555", email: "old@test.com", perfil_acceso: "rtv", estado: "inactivo" }
      ]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, ci, telefono, email, perfil_acceso, estado")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      setRows(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tipoNuevoUsuario !== "cliente" || editing) return;
    const isReview = localStorage.getItem("forceAuthReview") === "true";
    if (isReview) {
      setClientesSinUsuario([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, email")
        .is("id_usuario_auth", null)
        .eq("estado", "activo");
      setClientesSinUsuario((data as ClienteSinUsuario[]) ?? []);
    })();
  }, [tipoNuevoUsuario, editing]);

  const resetForm = () => {
    setSubmitError(null);
    setEditing(null);
    setTipoNuevoUsuario("sistema");
    setIdClienteSeleccionado("");
    setForm({
      nombre: "",
      ci: "",
      telefono: "",
      email: "",
      perfil_acceso: "rtv",
      estado: "activo",
      password: "",
      nuevaContraseña: ""
    });
  };

  const handleEdit = (u: UsuarioRow) => {
    setEditing(u);
    setForm({
      nombre: u.nombre ?? "",
      ci: u.ci ?? "",
      telefono: u.telefono ?? "",
      email: u.email ?? "",
      perfil_acceso: u.perfil_acceso,
      estado: u.estado,
      password: "",
      nuevaContraseña: ""
    });
  };

  const clienteSeleccionado = clientesSinUsuario.find((c) => c.id === idClienteSeleccionado);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSaving(true);

    const payload = {
      nombre: form.nombre,
      ci: form.ci,
      telefono: form.telefono,
      email: form.email,
      perfil_acceso: form.perfil_acceso,
      estado: form.estado
    };

    if (editing) {
      const { error } = await supabase.from("usuarios").update(payload).eq("id", editing.id);
      if (error) {
        setSubmitError(error.message);
        setSaving(false);
        return;
      }
      if (form.nuevaContraseña?.trim()) {
        const { data: pwData, error: pwError } = await supabase.functions.invoke("update-user-password", {
          body: { user_id: editing.id, new_password: form.nuevaContraseña.trim() },
        });
        if (pwError) {
          setSubmitError(pwError.message || "Error al actualizar contraseña.");
          setSaving(false);
          return;
        }
        const res = pwData as { success?: boolean; error?: string } | null;
        if (res && (res.error || res.success === false)) {
          setSubmitError(res.error || "Error al actualizar contraseña.");
          setSaving(false);
          return;
        }
      }
    } else {
      if (tipoNuevoUsuario === "cliente") {
        if (!idClienteSeleccionado || !clienteSeleccionado) {
          setSubmitError("Seleccione un cliente para vincular.");
          setSaving(false);
          return;
        }
        if (!form.password?.trim()) {
          setSubmitError("La contraseña es obligatoria para el usuario cliente.");
          setSaving(false);
          return;
        }
        if (!clienteSeleccionado.email?.trim()) {
          setSubmitError("El cliente seleccionado no tiene email. Edite el cliente en CRM para agregar email.");
          setSaving(false);
          return;
        }
        const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
          body: {
            email: clienteSeleccionado.email.trim(),
            password: form.password.trim(),
            nombre: clienteSeleccionado.nombre,
            perfil_acceso: "cliente",
            estado: form.estado,
            id_cliente: idClienteSeleccionado,
          },
        });
        if (fnError) {
          setSubmitError(fnError.message || "Error al crear usuario. Despliegue la función create-user en Supabase.");
          setSaving(false);
          return;
        }
        const err = (fnData as { error?: string })?.error;
        if (err) {
          setSubmitError(err);
          setSaving(false);
          return;
        }
      } else {
        if (!form.password?.trim()) {
          setSubmitError("La contraseña es obligatoria para nuevo usuario.");
          setSaving(false);
          return;
        }
        const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
          body: {
            email: form.email.trim(),
            password: form.password,
            nombre: form.nombre.trim(),
            perfil_acceso: form.perfil_acceso,
            ci: form.ci.trim() || undefined,
            telefono: form.telefono.trim() || undefined,
            estado: form.estado,
          },
        });
        if (fnError) {
          setSubmitError(fnError.message || "Error al crear usuario. Despliegue la función create-user en Supabase.");
          setSaving(false);
          return;
        }
        const err = (fnData as { error?: string })?.error;
        if (err) {
          setSubmitError(err);
          setSaving(false);
          return;
        }
      }
    }

    await load();
    resetForm();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <i className="fas fa-spinner fa-spin mr-2" />Cargando usuarios...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      {/* ── Listagem ── */}
      <div className="p-8 border-r border-gray-50 bg-gray-50/30">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-list text-[10px] text-agro-primary" /> Usuarios Registrados
          </h3>
          <span className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-400 uppercase">
            {rows.length} Total
          </span>
        </div>

        <div className="space-y-3">
          {rows.map((u) => (
            <div
              key={u.id}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between shadow-sm ${editing?.id === u.id
                ? "bg-white border-agro-primary ring-2 ring-agro-primary/10"
                : "bg-white border-gray-100 hover:border-agro-primary"
                }`}
              onClick={() => handleEdit(u)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${editing?.id === u.id ? "bg-agro-primary text-white" : "bg-gray-50 text-gray-400 group-hover:bg-agro-primary/10 group-hover:text-agro-primary"
                  }`}>
                  {u.nombre?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900 group-hover:text-agro-primary transition-colors">{u.nombre}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mb-1">
                    {u.ci && <span className="mr-2">CI: {u.ci}</span>}
                    {u.telefono && <span>TEL: {u.telefono}</span>}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">{u.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-gray-300">
                      {PERFILES_ACCESO.find((p) => p.value === u.perfil_acceso)?.label || u.perfil_acceso}
                    </span>
                    <div className={`w-1 h-1 rounded-full ${u.estado === 'activo' ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${u.estado === 'activo' ? 'text-green-600' : 'text-gray-400'}`}>
                      {u.estado}
                    </span>
                  </div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-200 group-hover:text-agro-primary group-hover:translate-x-1 transition-all" />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-20 text-center text-gray-400">
              <i className="fas fa-users-slash text-2xl mb-2 block opacity-20" />
              No hay usuarios disponíveis.
            </div>
          )}
        </div>
      </div>

      {/* ── Formulário ── */}
      <div className="p-8">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-8">
          <i className={`fas ${editing ? 'fa-user-edit' : 'fa-user-plus'} text-[10px] text-agro-primary`} />
          {editing ? "Editar Datos de Usuario" : "Configurar Nuevo Usuario"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle" />
              {submitError}
            </div>
          )}
          <div className="space-y-4">
            {!editing && (
              <div>
                <label className={labelCls}>Tipo de usuario</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoNuevo"
                      checked={tipoNuevoUsuario === "sistema"}
                      onChange={() => { setTipoNuevoUsuario("sistema"); setIdClienteSeleccionado(""); setForm((f) => ({ ...f, nombre: "", email: "" })); }}
                    />
                    <span>Usuario del sistema (admin / RTV)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoNuevo"
                      checked={tipoNuevoUsuario === "cliente"}
                      onChange={() => { setTipoNuevoUsuario("cliente"); setIdClienteSeleccionado(""); setForm((f) => ({ ...f, nombre: "", email: "" })); }}
                    />
                    <span>Cliente</span>
                  </label>
                </div>
              </div>
            )}

            {!editing && tipoNuevoUsuario === "cliente" && (
              <>
                <div>
                  <label className={labelCls}>Vincular a cliente</label>
                  <select
                    className={inputCls}
                    value={idClienteSeleccionado}
                    onChange={(e) => {
                      const id = e.target.value;
                      setIdClienteSeleccionado(id);
                      const c = clientesSinUsuario.find((x) => x.id === id);
                      if (c) setForm((f) => ({ ...f, nombre: c.nombre, email: c.email ?? "" }));
                    }}
                    required
                  >
                    <option value="">Seleccione un cliente (sin usuario aún)</option>
                    {clientesSinUsuario.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} {c.email ? `(${c.email})` : ""}</option>
                    ))}
                  </select>
                  {clientesSinUsuario.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-0.5">No hay clientes activos sin usuario. Cree clientes en CRM primero.</p>
                  )}
                </div>
                {clienteSeleccionado && (
                  <>
                    <div>
                      <label className={labelCls}>Nombre (del cliente)</label>
                      <input className={inputCls} value={form.nombre} readOnly disabled />
                    </div>
                    <div>
                      <label className={labelCls}>Email (del cliente)</label>
                      <input type="email" className={inputCls} value={form.email} readOnly disabled />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>Contraseña</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-400"><i className="fas fa-lock text-xs" /></span>
                    <input
                      type="password"
                      className={`${inputCls} pl-10`}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Contraseña para el acceso del cliente"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Estado Cuenta</label>
                  <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </>
            )}

            {(!editing && tipoNuevoUsuario === "sistema") && (
              <>
                <div>
                  <label className={labelCls}>Nombre Completo</label>
                  <input
                    className={inputCls}
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>CI (Documento)</label>
                    <input
                      className={inputCls}
                      value={form.ci}
                      onChange={(e) => setForm({ ...form, ci: e.target.value })}
                      placeholder="Ej: 1.234.567"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input
                      className={inputCls}
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="Ej: +595 981 000000"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Dirección de Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="juan@empresa.com"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Contraseña Inicial</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-400"><i className="fas fa-lock text-xs" /></span>
                    <input
                      type="password"
                      className={`${inputCls} pl-10`}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Contraseña segura"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Perfil de acceso (rol)</label>
                    <select
                      className={inputCls}
                      value={form.perfil_acceso}
                      onChange={(e) => setForm({ ...form, perfil_acceso: e.target.value })}
                    >
                      {PERFILES_ACCESO.filter((p) => p.value !== "cliente").map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-0.5">Rol del usuario en el sistema</p>
                  </div>
                  <div>
                    <label className={labelCls}>Estado Cuenta</label>
                    <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {editing && (
              <>
                <div>
                  <label className={labelCls}>Nombre Completo</label>
                  <input
                    className={inputCls}
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>CI (Documento)</label>
                    <input
                      className={inputCls}
                      value={form.ci}
                      onChange={(e) => setForm({ ...form, ci: e.target.value })}
                      placeholder="Ej: 1.234.567"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input
                      className={inputCls}
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="Ej: +595 981 000000"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Dirección de Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="juan@empresa.com"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Nueva contraseña</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-400"><i className="fas fa-lock text-xs" /></span>
                    <input
                      type="password"
                      className={`${inputCls} pl-10`}
                      value={form.nuevaContraseña}
                      onChange={(e) => setForm({ ...form, nuevaContraseña: e.target.value })}
                      placeholder="Dejar en blanco para no cambiar"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Perfil de acceso (rol)</label>
                    <select
                      className={inputCls}
                      value={form.perfil_acceso}
                      onChange={(e) => setForm({ ...form, perfil_acceso: e.target.value })}
                    >
                      {PERFILES_ACCESO.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Estado Cuenta</label>
                    <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? (
                <><i className="fas fa-spinner fa-spin" /> Guardando...</>
              ) : (
                <><i className="fas fa-save" /> {editing ? "Guardar Cambios" : "Crear Usuario"}</>
              )}
            </button>
            {(editing || form.nombre !== "") && (
              <button
                type="button"
                className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
