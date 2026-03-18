import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { exportToCsv, formatDecimal } from "./utils";

interface ProductoRow {
  id: string;
  sku: string;
  nombre: string;
  fabricante: string | null;
  estado: string;
  created_at: string;
  categoria_desc?: string;
  precio_final: number | null;
  culturas_desc?: string;
  contenido_empaque?: number | null;
  presentacion_txt?: string | null;
  id_versat?: number | null;
}

interface Lookup {
  id: string;
  codigo?: string;
  descripcion: string;
}

interface DistribuidorOption {
  id: string;
  fabricante: string;
  distribuidor: string;
  estado: string;
}

function calcPrecioFinal(form: {
  precio_compra: number;
  margen: number;
  costo_operacional: number;
  costo_financiero: number;
  bonificacion_vendedor: number;
  bonificacion_cliente: number;
  voucher: number;
}): {
  precio_venta: number;
  impacto_total: number;
  precio_final: number;
  costo_operacional_usd: number;
  costo_financiero_usd: number;
  bonificacion_vendedor_usd: number;
  bonificacion_cliente_usd: number;
  voucher_usd: number;
  margen_usd: number;
} {
  const pc = form.precio_compra || 0;
  const margenPct = (form.margen || 0) / 100;
  const margen_usd = Number((pc * margenPct).toFixed(2));
  const precio_venta = pc + margen_usd;

  const pv = precio_venta;
  const calcVoucher = pv * ((form.voucher || 0) / 100);
  const calcCostoOp = pv * ((form.costo_operacional || 0) / 100);
  const calcCostoFin = pv * ((form.costo_financiero || 0) / 100);
  const calcBonifVend = pv * ((form.bonificacion_vendedor || 0) / 100);
  const calcBonifCliente = pv * ((form.bonificacion_cliente || 0) / 100);
  const impacto_total =
    calcVoucher + calcCostoOp + calcCostoFin + calcBonifVend + calcBonifCliente;
  const precio_final = precio_venta + impacto_total;

  return {
    precio_venta: Number(precio_venta.toFixed(2)),
    impacto_total: Number(impacto_total.toFixed(2)),
    precio_final: Number(precio_final.toFixed(2)),
    costo_operacional_usd: Number(calcCostoOp.toFixed(2)),
    costo_financiero_usd: Number(calcCostoFin.toFixed(2)),
    bonificacion_vendedor_usd: Number(calcBonifVend.toFixed(2)),
    bonificacion_cliente_usd: Number(calcBonifCliente.toFixed(2)),
    voucher_usd: Number(calcVoucher.toFixed(2)),
    margen_usd,
  };
}

/** Genera SKU único */
function generateSku(): string {
  return `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const CSV_COLUMNS = [
  { key: "sku", header: "SKU" },
  { key: "nombre", header: "Nombre" },
  { key: "categoria_desc", header: "Categoría" },
  { key: "fabricante", header: "Distribuidor" },
  { key: "precio_final", header: "Precio final (USD)" },
  { key: "estado", header: "Estado" },
  { key: "created_at", header: "Fecha creación" },
];

export function ProductoTab() {
  const { perfil } = useAuth();
  const isAdmin = perfil?.perfil_acceso === "admin";
  const [rows, setRows] = useState<ProductoRow[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [unidades, setUnidades] = useState<Lookup[]>([]);
  const [culturas, setCulturas] = useState<Lookup[]>([]);
  const [distribuidores, setDistribuidores] = useState<DistribuidorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductoRow | null>(null);
  const [form, setForm] = useState({
    sku: "",
    id_categoria: "",
    nombre: "",
    id_distribuidor: "",
    fabricante: "",
    culturas: [] as string[],
    composicion: "",
    id_unidad_medida: "",
    contenido_empaque: "",
    estado: "activo",
    precio_compra: "",
    margen: "",
    costo_operacional: "",
    costo_financiero: "",
    bonificacion_vendedor: "",
    bonificacion_cliente: "",
    voucher: "",
    precio_minimo: "",
  });
  const [filterEstado, setFilterEstado] = useState("");
  const [filterBusqueda, setFilterBusqueda] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");

  const loadProductos = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("ProductoTab: Review Mode - Injecting mock products");
      setRows([
        { id: "p-1", sku: "PROD-001", nombre: "Semilla de Soja RR", fabricante: "Nidera", estado: "activo", created_at: new Date().toISOString(), precio_final: 450.00, categoria_desc: "Semillas" },
        { id: "p-2", sku: "PROD-002", nombre: "Glifosato 48%", fabricante: "Monsanto", estado: "activo", created_at: new Date().toISOString(), precio_final: 85.50, categoria_desc: "Herbicidas" },
        { id: "p-3", sku: "PROD-003", nombre: "Fertilizante NPK", fabricante: "Yara", estado: "activo", created_at: new Date().toISOString(), precio_final: 620.00, categoria_desc: "Fertilizantes" },
        { id: "p-4", sku: "PROD-004", nombre: "Fungicida Systemic", fabricante: "Syngenta", estado: "inactivo", created_at: new Date().toISOString(), precio_final: 120.00, categoria_desc: "Fungicidas" }
      ]);
      return;
    }

    const { data, error } = await supabase
      .from("productos")
      .select(
        "id, sku, nombre, fabricante, estado, created_at, precio_final, id_categoria, contenido_empaque, presentacion_txt, culturas, id_versat, categorias_producto(descripcion)"
      )
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const raw = data as any[];
      const culturaIds = [...new Set(raw.flatMap((d) => (Array.isArray(d.culturas) ? d.culturas : [])))];
      let cultMap: Record<string, string> = {};
      if (culturaIds.length > 0) {
        const { data: cult } = await supabase.from("culturas").select("id, descripcion").in("id", culturaIds);
        if (cult) cultMap = Object.fromEntries((cult as any[]).map((c) => [c.id, c.descripcion ?? ""]));
      }
      setRows(
        raw.map((d) => ({
          id: d.id,
          sku: d.sku,
          nombre: d.nombre,
          fabricante: d.fabricante,
          estado: d.estado,
          created_at: d.created_at,
          precio_final: d.precio_final,
          categoria_desc: Array.isArray(d.categorias_producto)
            ? d.categorias_producto[0]?.descripcion ?? "-"
            : d.categorias_producto?.descripcion ?? "-",
          contenido_empaque: d.contenido_empaque ?? null,
          presentacion_txt: d.presentacion_txt ?? null,
          id_versat: d.id_versat ?? null,
          culturas_desc: (Array.isArray(d.culturas) ? d.culturas : [])
            .map((id: string) => cultMap[id])
            .filter(Boolean)
            .join(", ") || "—",
        }))
      );
    }
  };

  const loadLookups = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setCategorias([
        { id: "c-1", descripcion: "Semillas" },
        { id: "c-2", descripcion: "Herbicidas" },
        { id: "c-3", descripcion: "Fertilizantes" },
        { id: "c-4", descripcion: "Fungicidas" }
      ]);
      setUnidades([
        { id: "u-1", descripcion: "Litros" },
        { id: "u-2", descripcion: "Kilogramos" },
        { id: "u-3", descripcion: "Bolsas" }
      ]);
      setCulturas([
        { id: "cl-1", descripcion: "Soja" },
        { id: "cl-2", descripcion: "Maíz" },
        { id: "cl-3", descripcion: "Trigo" }
      ]);
      setDistribuidores([
        { id: "d-1", fabricante: "Monsanto", distribuidor: "AgroDistribuidora", estado: "activo" },
        { id: "d-2", fabricante: "Syngenta", distribuidor: "Paraná Insumos", estado: "activo" },
      ]);
      return;
    }

    const [cat, un, cul, dist] = await Promise.all([
      supabase.from("categorias_producto").select("id, codigo, descripcion"),
      supabase.from("unidades_medida").select("id, codigo, descripcion"),
      supabase.from("culturas").select("id, codigo, descripcion"),
      supabase.from("distribuidores").select("id, fabricante, distribuidor, estado").eq("estado", "activo"),
    ]);

    if (cat.data && cat.data.length > 0) setCategorias(cat.data as Lookup[]);
    if (un.data && un.data.length > 0) setUnidades(un.data as Lookup[]);
    if (cul.data && cul.data.length > 0) setCulturas(cul.data as Lookup[]);
    if (dist.data && dist.data.length > 0) setDistribuidores(dist.data as DistribuidorOption[]);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadProductos(), loadLookups()]);
      setLoading(false);
    };
    load();
  }, []);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterEstado) list = list.filter((r) => r.estado === filterEstado);
    if (filterCategoria)
      list = list.filter((r) => r.categoria_desc === filterCategoria);
    if (filterBusqueda.trim()) {
      const q = filterBusqueda.toLowerCase();
      list = list.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          r.nombre.toLowerCase().includes(q) ||
          (r.fabricante && r.fabricante.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, filterEstado, filterCategoria, filterBusqueda]);

  const computed = useMemo(
    () =>
      calcPrecioFinal({
        precio_compra: Number(form.precio_compra) || 0,
        margen: Number(form.margen) || 0,
        costo_operacional: Number(form.costo_operacional) || 0,
        costo_financiero: Number(form.costo_financiero) || 0,
        bonificacion_vendedor: Number(form.bonificacion_vendedor) || 0,
        bonificacion_cliente: Number(form.bonificacion_cliente) || 0,
        voucher: Number(form.voucher) || 0,
      }),
    [
      form.precio_compra,
      form.margen,
      form.costo_operacional,
      form.costo_financiero,
      form.bonificacion_vendedor,
      form.bonificacion_cliente,
      form.voucher,
    ]
  );

  const resetForm = () => {
    setEditing(null);
    setForm({
      sku: "",
      id_categoria: "",
      nombre: "",
      id_distribuidor: "",
      fabricante: "",
      culturas: [],
      composicion: "",
      id_unidad_medida: "",
      contenido_empaque: "",
      estado: "activo",
      precio_compra: "",
      margen: "",
      costo_operacional: "",
      costo_financiero: "",
      bonificacion_vendedor: "",
      bonificacion_cliente: "",
      voucher: "",
      precio_minimo: "",
    });
    setShowModal(false);
  };

  const handleNuevo = () => {
    if (!isAdmin) return;
    resetForm();
    setForm((f) => ({ ...f, sku: generateSku(), estado: "activo" }));
    setShowModal(true);
  };

  const handleEdit = async (row: ProductoRow) => {
    if (!isAdmin) return;
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setEditing(row);
      setForm({
        sku: row.sku,
        id_categoria: "",
        nombre: row.nombre,
        id_distribuidor: "",
        fabricante: row.fabricante ?? "",
        culturas: [],
        composicion: "",
        id_unidad_medida: "",
        contenido_empaque: "",
        estado: row.estado,
        precio_compra: "",
        margen: "",
        costo_operacional: "",
        costo_financiero: "",
        bonificacion_vendedor: "",
        bonificacion_cliente: "",
        voucher: "",
        precio_minimo: "",
      });
      setShowModal(true);
      return;
    }

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("id", row.id)
      .single();
    if (!data) return;
    const d = data as any;
    setEditing(row);
    const selectedDist = distribuidores.find(
      (x) => `${x.fabricante} – ${x.distribuidor}` === d.fabricante || x.distribuidor === d.fabricante
    );
    const pv = Number(d.precio_venta) || 0;
    const toPct = (usd: number | null) =>
      pv > 0 && usd != null ? String(Number((usd / pv) * 100).toFixed(2)) : "";
    setForm({
      sku: d.sku,
      id_categoria: d.id_categoria ?? "",
      nombre: d.nombre,
      id_distribuidor: selectedDist?.id ?? "",
      fabricante: d.fabricante ?? "",
      culturas: Array.isArray(d.culturas) ? d.culturas : [],
      composicion: d.composicion ?? "",
      id_unidad_medida: d.id_unidad_medida ?? "",
      contenido_empaque: d.contenido_empaque != null ? String(d.contenido_empaque) : "",
      estado: d.estado,
      precio_compra: d.precio_compra != null ? String(d.precio_compra) : "",
      margen: d.margen != null ? String(d.margen) : "",
      costo_operacional: toPct(d.costo_operacional),
      costo_financiero: toPct(d.costo_financiero),
      bonificacion_vendedor: toPct(d.bonificacion_vendedor),
      bonificacion_cliente: toPct(d.bonificacion_cliente),
      voucher: d.voucher != null ? String(d.voucher) : "",
      precio_minimo: d.precio_minimo != null ? String(d.precio_minimo) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const distLabel = form.id_distribuidor
      ? distribuidores.find((d) => d.id === form.id_distribuidor)
      : null;
    const fabricanteVal = distLabel
      ? `${distLabel.fabricante} – ${distLabel.distribuidor}`
      : form.fabricante.trim() || null;
    const payload = {
      sku: form.sku.trim(),
      id_categoria: form.id_categoria || null,
      nombre: form.nombre.trim(),
      fabricante: fabricanteVal,
      culturas: form.culturas,
      composicion: form.composicion.trim() || null,
      id_unidad_medida: form.id_unidad_medida || null,
      contenido_empaque:
        form.contenido_empaque !== "" ? Number(form.contenido_empaque) : null,
      estado: form.estado,
      precio_compra:
        form.precio_compra !== "" ? Number(form.precio_compra) : null,
      margen: form.margen !== "" ? Number(form.margen) : null,
      precio_venta: computed.precio_venta,
      costo_operacional: computed.costo_operacional_usd,
      costo_financiero: computed.costo_financiero_usd,
      bonificacion_vendedor: computed.bonificacion_vendedor_usd,
      bonificacion_cliente: computed.bonificacion_cliente_usd,
      voucher: form.voucher !== "" ? Number(form.voucher) : null,
      impacto_total_costo: computed.impacto_total,
      precio_final: computed.precio_final,
      precio_minimo:
        form.precio_minimo !== "" ? Number(form.precio_minimo) : null,
    };

    if (editing) {
      await supabase.from("productos").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("productos").insert(payload);
    }
    await loadProductos();
    resetForm();
    setSaving(false);
  };

  const toggleCultura = (id: string) => {
    setForm((f) => ({
      ...f,
      culturas: f.culturas.includes(id)
        ? f.culturas.filter((x) => x !== id)
        : [...f.culturas, id],
    }));
  };

  const handleExportCsv = () => {
    const toExport = filteredRows.map((r) => ({
      ...r,
      precio_final: formatDecimal(r.precio_final),
      created_at: new Date(r.created_at).toLocaleDateString("es-PY"),
    }));
    exportToCsv(
      toExport,
      `productos_${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_COLUMNS
    );
  };

  const categoriasUnicas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.categoria_desc).filter(Boolean))),
    [rows]
  );

  if (loading) {
    return <span>Cargando productos...</span>;
  }

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="min-w-[120px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Estado</label>
          <select
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            {ESTADOS.map((o) => (<option key={o.value || "all"} value={o.value}>{o.label}</option>))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Categoría</label>
          <select
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
          >
            <option value="">Todas</option>
            {categoriasUnicas.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1">Buscar</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              className="w-full pl-8 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
              placeholder="SKU, nombre o distribuidor"
              value={filterBusqueda}
              onChange={(e) => setFilterBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95"
              onClick={handleNuevo}
            >
              <i className="fas fa-plus text-xs" />
              Nuevo
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all"
            onClick={handleExportCsv}
          >
            <i className="fas fa-download text-xs" />
            CSV
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">SKU</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Origen</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Categoría</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fabricante</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Culturas</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Presentación</th>
              <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Contenido envase</th>
              <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Precio final (USD)</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === "inactivo" ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.sku}</td>
                <td className="px-4 py-3">
                  {r.id_versat != null ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">VERSAT</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{r.categoria_desc}</td>
                <td className="px-4 py-3 text-gray-500">{r.fabricante ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.culturas_desc ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.presentacion_txt ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{formatDecimal(r.contenido_empaque ?? null)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{formatDecimal(r.precio_final)}</td>
                <td className="px-4 py-3">
                  {r.estado === "activo"
                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Activo</span>
                    : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td className="px-4 py-3 text-right">
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
            <i className="fas fa-box mb-2 text-2xl block" />No hay registros.
          </div>
        )}
      </div>

      {/* ── Modal Producto ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[93vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-box text-sm" />
                </div>
                <h3 className="font-bold text-gray-900">{editing ? "Editar producto" : "Nuevo producto"}</h3>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-times" /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                {/* Info general */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Información general</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">SKU</label>
                      <input className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none" value={form.sku} readOnly placeholder="Se generará al guardar" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Categoría</label>
                      <select className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" value={form.id_categoria} onChange={(e) => setForm({ ...form, id_categoria: e.target.value })}>
                        <option value="">Seleccione</option>
                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nombre *</label>
                      <input className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="Nombre del producto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Distribuidor</label>
                      <select
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all"
                        value={form.id_distribuidor}
                        onChange={(e) => {
                          const id = e.target.value;
                          const d = distribuidores.find((x) => x.id === id);
                          setForm({
                            ...form,
                            id_distribuidor: id,
                            fabricante: d ? `${d.fabricante} – ${d.distribuidor}` : "",
                          });
                        }}
                      >
                        <option value="">Seleccione distribuidor</option>
                        {distribuidores.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fabricante} – {d.distribuidor}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Unidad de medida</label>
                      <select className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" value={form.id_unidad_medida} onChange={(e) => setForm({ ...form, id_unidad_medida: e.target.value })}>
                        <option value="">Seleccione</option>
                        {unidades.map((u) => <option key={u.id} value={u.id}>{u.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Contenido empaque</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.contenido_empaque} onChange={(e) => setForm({ ...form, contenido_empaque: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Composición</label>
                      <input className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="Composición" value={form.composicion} onChange={(e) => setForm({ ...form, composicion: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Estado</label>
                      <select className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Culturas */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Culturas indicadas</p>
                  <div className="flex flex-wrap gap-2">
                    {culturas.map((c) => {
                      const isActive = form.culturas.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCultura(c.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isActive
                            ? "bg-agro-primary border-agro-primary text-white shadow-md shadow-agro-primary/20"
                            : "bg-white border-gray-200 text-gray-500 hover:border-agro-primary"
                            }`}
                        >
                          {isActive && <i className="fas fa-check mr-2" />}
                          {c.descripcion}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Composición de precio */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Composición de precio</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Precio compra (USD)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.precio_compra} onChange={(e) => setForm({ ...form, precio_compra: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Margen (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.margen} onChange={(e) => setForm({ ...form, margen: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Precio venta (USD)</label>
                      <input type="text" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-100 bg-gray-50 outline-none font-mono font-bold" readOnly value={formatDecimal(computed.precio_venta)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Costo operacional (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.costo_operacional} onChange={(e) => setForm({ ...form, costo_operacional: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Costo financiero (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.costo_financiero} onChange={(e) => setForm({ ...form, costo_financiero: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bonif. vendedor (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.bonificacion_vendedor} onChange={(e) => setForm({ ...form, bonificacion_vendedor: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bonif. cliente (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.bonificacion_cliente} onChange={(e) => setForm({ ...form, bonificacion_cliente: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Voucher (%)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.voucher} onChange={(e) => setForm({ ...form, voucher: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Precio mínimo (USD)</label>
                      <input type="number" step="0.01" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all" placeholder="0.00" value={form.precio_minimo} onChange={(e) => setForm({ ...form, precio_minimo: e.target.value })} />
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Impacto total en el costo</p>
                      <p className="font-mono font-bold text-gray-900">{formatDecimal(computed.impacto_total)} USD</p>
                    </div>
                    <div className="bg-agro-primary/5 border border-agro-primary/20 rounded-xl p-3">
                      <p className="text-xs text-agro-primary mb-1">Precio final</p>
                      <p className="font-mono font-bold text-agro-primary text-lg">{formatDecimal(computed.precio_final)} USD</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button type="button" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all" onClick={resetForm}>Cancelar</button>
                <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95" disabled={saving}>
                  {saving ? <><i className="fas fa-spinner fa-spin text-xs" />Guardando...</> : editing ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
