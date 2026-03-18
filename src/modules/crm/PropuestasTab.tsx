import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { generarPdfPropuesta } from "./pdfPropuesta";

interface PropuestaRow {
  id: string;
  sku: string | null;
  fecha: string;
  total_general: number | null;
  total_voucher: number | null;
  total_en_bolsas_soja: number | null;
  total_en_bolsas_maiz: number | null;
  total_en_bolsas_trigo: number | null;
  estado_codigo: string;
  tipo_codigo: string;
  cliente_nombre: string;
  vendedor_nombre: string;
  created_at: string;
}

interface CartItem {
  id_producto: string;
  id_distribuidor: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  contenido_empaque: number;
  voucher_pct: number;
  precio_minimo: number;
  precio_producto: number;
  cantidad: number;
  num_aplicaciones: number;
  dosis_ha: number;
  area_tratada: number;
  costo_ha: number;
  importe_total: number;
  distribuidor_nombre?: string;
  // composición de precio (PDF gerencial)
  precio_compra_base?: number;
  margen_base?: number;
  costo_operacional_base?: number;
  costo_financiero_base?: number;
  bonificacion_cliente_base?: number;
  bonificacion_vendedor_base?: number;
  impacto_total_costo_base?: number;
  precio_final_base?: number;
}

const toNum = (v: unknown): number => (v !== "" && v != null ? Number(v) : 0);

function calcAreaTratada(cantidad: number, contenido_empaque: number, dosis_ha: number, num_aplicaciones: number): number {
  if (!dosis_ha || !num_aplicaciones) return 0;
  const cantPedido = contenido_empaque > 0 ? cantidad * contenido_empaque : cantidad;
  return Number((cantPedido / (dosis_ha * num_aplicaciones)).toFixed(2));
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";
const btnDanger = "inline-flex items-center gap-2 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-all";
const btnGhost = "inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all";

function BadgeEstado({ codigo }: { codigo: string }) {
  return codigo === "vigente" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Vigente</span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Cancelado</span>
  );
}

export function PropuestasTab() {
  const { perfil } = useAuth();
  const isAdmin = perfil?.perfil_acceso === "admin";
  const [rows, setRows] = useState<PropuestaRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [distribuidores, setDistribuidores] = useState<{ id: string; distribuidor: string }[]>([]);
  const [tipos, setTipos] = useState<{ id: string; codigo: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewing, setViewing] = useState<PropuestaRow | null>(null);
  const [viewCart, setViewCart] = useState<CartItem[]>([]);
  const [header, setHeader] = useState({
    id_tipo_propuesta: "", id_cliente: "", id_vendedor: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [idDistribuidor, setIdDistribuidor] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [numAplicaciones, setNumAplicaciones] = useState("");
  const [dosisHa, setDosisHa] = useState("");

  // CBOT prices for total en bolsa calculation
  const [cbotPrices, setCbotPrices] = useState<{ soja: number; maiz: number; trigo: number }>({ soja: 0, maiz: 0, trigo: 0 });

  const filteredProductos = useMemo(() => {
    if (!productSearch.trim()) return productos.slice(0, 20);
    const q = productSearch.toLowerCase();
    return productos.filter((p) => p.nombre.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 20);
  }, [productos, productSearch]);

  const filteredClientes = useMemo(() => {
    if (!clientSearch.trim()) return clientes.slice(0, 30);
    const q = clientSearch.toLowerCase();
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 30);
  }, [clientes, clientSearch]);

  const selectedClienteNombre = useMemo(() => {
    if (!header.id_cliente) return "";
    return clientes.find((c) => c.id === header.id_cliente)?.nombre ?? "";
  }, [header.id_cliente, clientes]);

  const totalVoucher = useMemo(
    () => Number(cart.reduce((acc, it) => acc + it.importe_total * (it.voucher_pct / 100), 0).toFixed(2)),
    [cart]
  );
  const totalGeneral = useMemo(
    () => Number(cart.reduce((acc, it) => acc + it.importe_total, 0).toFixed(2)),
    [cart]
  );

  // Calculate total en bolsa
  const totalEnBolsas = useMemo(() => {
    const total = totalGeneral;
    return {
      soja: cbotPrices.soja > 0 ? Number((total / cbotPrices.soja).toFixed(2)) : 0,
      maiz: cbotPrices.maiz > 0 ? Number((total / cbotPrices.maiz).toFixed(2)) : 0,
      trigo: cbotPrices.trigo > 0 ? Number((total / cbotPrices.trigo).toFixed(2)) : 0,
    };
  }, [totalGeneral, cbotPrices]);

  const loadPropuestas = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("PropuestasTab: Review Mode - Injecting mock proposals");
      setRows([
        { id: "pr-1", sku: "PROP-001", fecha: new Date().toISOString().slice(0, 10), total_general: 12500.00, total_voucher: 250.00, total_en_bolsas_soja: 28.5, total_en_bolsas_maiz: 55.2, total_en_bolsas_trigo: 42.3, estado_codigo: "vigente", tipo_codigo: "venta", cliente_nombre: "Fazenda Santa Maria", vendedor_nombre: "Admin Sistema", created_at: new Date().toISOString() },
        { id: "pr-2", sku: "PROP-002", fecha: new Date().toISOString().slice(0, 10), total_general: 8400.00, total_voucher: 0, total_en_bolsas_soja: 19.1, total_en_bolsas_maiz: 37.1, total_en_bolsas_trigo: 28.5, estado_codigo: "vigente", tipo_codigo: "presupuesto", cliente_nombre: "Agroindustrial Los Abuelos", vendedor_nombre: "RTV Carlos", created_at: new Date().toISOString() }
      ]);
      return;
    }

    let q = supabase
      .from("propuestas")
      .select("id, sku, fecha, total_general, total_voucher, created_at, id_cliente, id_vendedor, id_tipo_propuesta, id_estado_propuesta, tipo_propuesta(codigo), estado_propuesta(codigo), clientes(nombre)")
      .order("created_at", { ascending: false });
    if (perfil?.perfil_acceso === "rtv") q = q.eq("id_vendedor", perfil.id);
    const { data, error } = await q;

    if (error) {
      console.error("loadPropuestas error:", error);
      setRows([]);
      return;
    }

    const list = (data ?? []) as any[];
    const vendIds = [...new Set(list.map((d) => d.id_vendedor).filter(Boolean))];
    let vendMap: Record<string, string> = {};
    if (vendIds.length > 0) {
      const { data: us } = await supabase.from("usuarios").select("id, nombre").in("id", vendIds);
      if (us) vendMap = Object.fromEntries((us as any[]).map((u) => [u.id, u.nombre ?? ""]));
    }

    setRows(list.map((d) => ({
      id: d.id,
      sku: d.sku,
      fecha: d.fecha,
      total_general: d.total_general,
      total_voucher: d.total_voucher,
      total_en_bolsas_soja: d.total_en_bolsas_soja ?? null,
      total_en_bolsas_maiz: d.total_en_bolsas_maiz ?? null,
      total_en_bolsas_trigo: d.total_en_bolsas_trigo ?? null,
      estado_codigo: d.estado_propuesta?.codigo ?? "",
      tipo_codigo: d.tipo_propuesta?.codigo ?? "",
      cliente_nombre: d.clientes?.nombre ?? "",
      vendedor_nombre: d.id_vendedor ? vendMap[d.id_vendedor] ?? "" : "",
      created_at: d.created_at,
    })));
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      await loadPropuestas();

      if (isReviewMode) {
        setClientes([
          { id: "cl-1", nombre: "Fazenda Santa Maria" },
          { id: "cl-2", nombre: "Agroindustrial Los Abuelos" }
        ]);
        setProductos([
          { id: "p-1", nombre: "Semilla de Soja RR", precio_final: 450.0, contenido_empaque: 40, voucher: 2, precio_minimo: 420.0, fabricante: "Nidera", categorias_producto: { descripcion: "Semillas" }, unidades_medida: { descripcion: "Bolsas" } },
          { id: "p-2", nombre: "Glifosato 48%", precio_final: 85.5, contenido_empaque: 20, voucher: 1, precio_minimo: 80.0, fabricante: "Monsanto", categorias_producto: { descripcion: "Herbicidas" }, unidades_medida: { descripcion: "Litros" } }
        ]);
        setDistribuidores([
          { id: "d-1", distribuidor: "AgroFértil S.A." },
          { id: "d-2", distribuidor: "Dekalpar" }
        ]);
        setTipos([
          { id: "t-1", codigo: "venta" },
          { id: "t-2", codigo: "presupuesto" }
        ]);
        setVendedores([
          { id: "mock-1", nombre: "Admin Sistema" },
          { id: "mock-2", nombre: "RTV Carlos" }
        ]);
        setCbotPrices({ soja: 438.5, maiz: 226.3, trigo: 294.7 });
        setLoading(false);
        return;
      }

      const [c, p, d, t, v] = await Promise.all([
        supabase.from("clientes").select("id, nombre").eq("estado", "activo"),
        supabase.from("productos").select("id, nombre, fabricante, precio_final, contenido_empaque, presentacion_txt, voucher, precio_minimo, precio_compra, margen, precio_venta, costo_operacional, costo_financiero, bonificacion_vendedor, bonificacion_cliente, impacto_total_costo, categorias_producto(descripcion), unidades_medida(descripcion)").eq("estado", "activo"),
        supabase.from("distribuidores").select("id, distribuidor").eq("estado", "activo"),
        supabase.from("tipo_propuesta").select("id, codigo"),
        supabase.from("usuarios").select("id, nombre").eq("estado", "activo").in("perfil_acceso", ["admin", "rtv"]),
      ]);

      if (c.data && c.data.length > 0) setClientes(c.data as any);
      if (p.data && p.data.length > 0) setProductos(p.data as any);
      if (d.data && d.data.length > 0) setDistribuidores(d.data as any);
      if (t.data && t.data.length > 0) setTipos(t.data as any);
      if (v.data && v.data.length > 0) setVendedores(v.data as any);

      // Último registro válido por cultura (CBOT alimentado por cron/yfinance)
      const culturasCodigo = ["soja", "maiz", "trigo"];
      const prices: { soja: number; maiz: number; trigo: number } = { soja: 0, maiz: 0, trigo: 0 };
      for (const codigo of culturasCodigo) {
        const { data: cbotCult } = await supabase
          .from("cbot")
          .select("precio_bolsa, culturas!inner(codigo)")
          .eq("culturas.codigo", codigo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cbotCult?.precio_bolsa != null) {
          const key = codigo as "soja" | "maiz" | "trigo";
          prices[key] = Number(cbotCult.precio_bolsa);
        }
      }
      setCbotPrices(prices);

      setLoading(false);
    };
    load();
  }, []);

  const addToCart = () => {
    if (!selectedProduct) return;
    const cant = toNum(cantidad);
    const numApl = toNum(numAplicaciones) || 1;
    const dosis = toNum(dosisHa);
    const area = calcAreaTratada(cant, selectedProduct.contenido_empaque ?? 0, dosis, numApl);
    const precio = selectedProduct.precio_final ?? 0;
    const costoHa = area > 0 ? Number((precio / area).toFixed(2)) : 0;
    const importeTotal = Number((precio * cant).toFixed(2));
    const distNombre = selectedProduct.fabricante || "";
    const pc = Number(selectedProduct.precio_compra) || 0;
    const pv = Number(selectedProduct.precio_venta) || precio;
    const margenUsd = pv - pc;
    setCart((prev) => [...prev, {
      id_producto: selectedProduct.id, id_distribuidor: "",
      nombre: selectedProduct.nombre,
      categoria: (selectedProduct as any).categorias_producto?.descripcion ?? "",
      unidad_medida: (selectedProduct as any).unidades_medida?.descripcion ?? (selectedProduct as any).presentacion_txt ?? "",
      contenido_empaque: selectedProduct.contenido_empaque ?? 0,
      voucher_pct: selectedProduct.voucher ?? 0,
      precio_minimo: selectedProduct.precio_minimo ?? 0,
      precio_producto: precio, cantidad: cant, num_aplicaciones: numApl,
      dosis_ha: dosis, area_tratada: area, costo_ha: costoHa, importe_total: importeTotal,
      distribuidor_nombre: distNombre,
      precio_compra_base: pc,
      margen_base: margenUsd,
      costo_operacional_base: Number(selectedProduct.costo_operacional) || 0,
      costo_financiero_base: Number(selectedProduct.costo_financiero) || 0,
      bonificacion_cliente_base: Number(selectedProduct.bonificacion_cliente) || 0,
      bonificacion_vendedor_base: Number(selectedProduct.bonificacion_vendedor) || 0,
      impacto_total_costo_base: Number(selectedProduct.impacto_total_costo) || 0,
      precio_final_base: pv || precio,
    }]);
    setSelectedProduct(null); setIdDistribuidor(""); setCantidad("");
    setNumAplicaciones(""); setDosisHa(""); setProductSearch("");
  };

  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));

  const updateCartImporte = (index: number, importeTotal: number) => {
    const it = cart[index];
    const minVal = Number((it.precio_minimo * it.cantidad).toFixed(2));
    const val = importeTotal < minVal ? minVal : importeTotal;
    const costoHa = it.area_tratada > 0 ? Number((val / it.area_tratada).toFixed(2)) : 0;
    setCart((prev) => prev.map((x, i) => i === index ? { ...x, importe_total: val, costo_ha: costoHa } : x));
  };

  const updateCartComposicion = (
    index: number,
    field: keyof Pick<CartItem, "precio_compra_base" | "margen_base" | "costo_operacional_base" | "costo_financiero_base" | "bonificacion_cliente_base" | "impacto_total_costo_base" | "precio_final_base">,
    value: number
  ) => {
    setCart((prev) => prev.map((x, i) => i === index ? { ...x, [field]: value } : x));
  };

  // Load items for viewing
  const handleView = async (row: PropuestaRow) => {
    setViewing(row);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setViewCart([
        { id_producto: "mock-1", id_distribuidor: "d-1", nombre: "Semilla de Soja RR", categoria: "Semillas", unidad_medida: "Bolsas", contenido_empaque: 40, voucher_pct: 2, precio_minimo: 420.0, precio_producto: 450.0, cantidad: 10, num_aplicaciones: 1, dosis_ha: 1, area_tratada: 400, costo_ha: 11.25, importe_total: 4500.0, distribuidor_nombre: "AgroFértil S.A." },
        { id_producto: "mock-2", id_distribuidor: "d-2", nombre: "Glifosato 48%", categoria: "Herbicidas", unidad_medida: "Litros", contenido_empaque: 20, voucher_pct: 1, precio_minimo: 80.0, precio_producto: 85.5, cantidad: 50, num_aplicaciones: 2, dosis_ha: 2, area_tratada: 250, costo_ha: 17.1, importe_total: 4275.0, distribuidor_nombre: "Dekalpar" }
      ]);
      return;
    }

    const { data } = await supabase
      .from("productos_propuesta")
      .select("*, productos(nombre, fabricante), distribuidores(distribuidor)")
      .eq("id_propuesta", row.id);
    if (data) {
      setViewCart(data.map((d: any) => ({
        id_producto: d.id_producto,
        id_distribuidor: d.id_distribuidor || "",
        nombre: d.productos?.nombre || "Producto",
        categoria: d.categoria || "",
        unidad_medida: d.unidad_medida || "",
        contenido_empaque: d.contenido_empaque || 0,
        voucher_pct: d.voucher || 0,
        precio_minimo: d.precio_minimo || 0,
        precio_producto: d.precio_producto || 0,
        cantidad: d.cantidad || 0,
        num_aplicaciones: d.num_aplicaciones || 0,
        dosis_ha: d.dosis_ha || 0,
        area_tratada: d.area_tratada || 0,
        costo_ha: d.costo_ha || 0,
        importe_total: d.importe_total || 0,
        distribuidor_nombre: d.productos?.fabricante || d.distribuidores?.distribuidor || "—",
        precio_compra_base: d.precio_compra_base ?? 0,
        margen_base: d.margen_base ?? 0,
        costo_operacional_base: d.costo_operacional_base ?? 0,
        costo_financiero_base: d.costo_financiero_base ?? 0,
        bonificacion_cliente_base: d.bonificacion_cliente_base ?? 0,
        impacto_total_costo_base: d.impacto_total_costo_base ?? 0,
        precio_final_base: d.precio_final_base ?? d.precio_producto ?? 0,
      })));
    }
  };

  const resetForm = () => {
    setHeader({ id_tipo_propuesta: "", id_cliente: "", id_vendedor: perfil?.id ?? "", fecha: new Date().toISOString().slice(0, 10) });
    setClientSearch("");
    setClientDropdownOpen(false);
    setCart([]);
    setShowModal(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!header.id_cliente || !header.id_tipo_propuesta || cart.length === 0) {
      alert("Complete cliente, tipo y al menos un producto.");
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const idVendedor = perfil?.id ?? header.id_vendedor;

    try {
      const tipoVenta = tipos.find((t) => t.codigo === "venta")?.id;
      const { data: estadoRow } = await supabase.from("estado_propuesta").select("id").eq("codigo", "vigente").single();
      const estadoVigente = (estadoRow as any)?.id;
      if (!estadoVigente) {
        alert("No se encontró el estado 'vigente' en el sistema. Contacte al administrador.");
        setSaving(false);
        return;
      }

      const { count } = await supabase.from("propuestas").select("*", { count: "exact", head: true }).eq("fecha", today);
      const nextNum = (count ?? 0) + 1;
      const sku = `PROP-${today.replace(/-/g, "")}-${String(nextNum).padStart(3, "0")}`;

      const insertPayload: Record<string, unknown> = {
        sku,
        id_cliente: header.id_cliente,
        id_tipo_propuesta: header.id_tipo_propuesta,
        fecha: today,
        id_vendedor: idVendedor || null,
        total_items: cart.length,
        total_voucher: header.id_tipo_propuesta === tipoVenta ? totalVoucher : 0,
        total_en_bolsas: 0,
        total_general: totalGeneral,
        id_estado_propuesta: estadoVigente,
      };
      const { data: prop, error: insertError } = await supabase
        .from("propuestas")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        alert(`Error al guardar la propuesta: ${insertError.message}`);
        setSaving(false);
        return;
      }
      if (!prop?.id) {
        alert("Error: no se devolvió el ID de la propuesta.");
        setSaving(false);
        return;
      }

      for (const it of cart) {
        const { error: itemError } = await supabase.from("productos_propuesta").insert({
          id_propuesta: prop.id,
          id_producto: it.id_producto,
          id_distribuidor: it.id_distribuidor || null,
          categoria: it.categoria,
          unidad_medida: it.unidad_medida,
          contenido_empaque: it.contenido_empaque,
          voucher: it.voucher_pct,
          precio_minimo: it.precio_minimo,
          precio_producto: it.precio_producto,
          cantidad: it.cantidad,
          num_aplicaciones: it.num_aplicaciones,
          dosis_ha: it.dosis_ha,
          area_tratada: it.area_tratada,
          costo_ha: it.costo_ha,
          importe_total: it.importe_total,
          precio_compra_base: it.precio_compra_base ?? null,
          margen_base: it.margen_base ?? null,
          costo_operacional_base: it.costo_operacional_base ?? null,
          costo_financiero_base: it.costo_financiero_base ?? null,
          bonificacion_cliente_base: it.bonificacion_cliente_base ?? null,
          bonificacion_vendedor_base: it.bonificacion_vendedor_base ?? null,
          impacto_total_costo_base: it.impacto_total_costo_base ?? null,
          precio_final_base: it.precio_final_base ?? it.precio_producto ?? null,
        });
        if (itemError) {
          alert(`Error al guardar ítem: ${itemError.message}`);
          setSaving(false);
          return;
        }
      }

      if (header.id_tipo_propuesta === tipoVenta && totalVoucher > 0) {
        const { data: vouch } = await supabase.from("vouchers").select("id, valor_total_generado, valor_restante").eq("id_cliente", header.id_cliente).maybeSingle();
        if (vouch) {
          await supabase
            .from("vouchers")
            .update({
              valor_total_generado: Number((((vouch as any).valor_total_generado ?? 0) + totalVoucher).toFixed(2)),
              valor_restante: Number((((vouch as any).valor_restante ?? 0) + totalVoucher).toFixed(2)),
            })
            .eq("id_cliente", header.id_cliente);
        } else {
          await supabase.from("vouchers").insert({
            id_cliente: header.id_cliente,
            valor_total_generado: totalVoucher,
            valor_total_liberado: 0,
            valor_restante: totalVoucher,
          });
        }
        const { data: v2 } = await supabase.from("vouchers").select("id").eq("id_cliente", header.id_cliente).single();
        if (v2) {
          await supabase.from("movimiento_vouchers").insert({
            id_voucher: (v2 as any).id,
            id_cliente: header.id_cliente,
            id_propuesta: prop.id,
            valor_generado: totalVoucher,
            tipo: "generado",
            id_usuario: perfil?.id,
          });
        }
      }

      await loadPropuestas();
      resetForm();
    } catch (err: any) {
      alert(err?.message ?? "Error inesperado al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async (row: PropuestaRow) => {
    if (row.tipo_codigo !== "venta") return;
    if (perfil?.perfil_acceso !== "admin") { alert("Solo el administrador puede cancelar propuestas tipo venta."); return; }
    const { data: prop } = await supabase.from("propuestas").select("id, total_voucher, id_cliente, created_at").eq("id", row.id).single();
    if (!prop) return;
    const { data: liberaciones } = await supabase.from("movimiento_vouchers").select("id, fecha").eq("id_cliente", (prop as any).id_cliente).eq("tipo", "liberado");
    if ((liberaciones ?? []).some((mov: { fecha: string }) => new Date(mov.fecha) > new Date((prop as any).created_at))) {
      alert("No se puede cancelar esta propuesta porque ya existió una liberación de voucher posterior."); return;
    }
    if (!confirm("¿Cancelar esta propuesta tipo venta?")) return;
    const totalVoucher = Number((prop as any).total_voucher) || 0;
    const estadoCancelado = await supabase.from("estado_propuesta").select("id").eq("codigo", "cancelado").single().then((r) => r.data?.id);

    const { error: errProp } = await supabase.from("propuestas").update({ id_estado_propuesta: estadoCancelado }).eq("id", row.id);
    if (errProp) {
      alert("Error al cancelar la propuesta: " + (errProp.message ?? ""));
      return;
    }

    if (totalVoucher > 0) {
      const { data: v } = await supabase.from("vouchers").select("id, valor_total_generado, valor_restante").eq("id_cliente", (prop as any).id_cliente).single();
      if (v) {
        const nuevoGenerado = Math.max(0, Number((((v as any).valor_total_generado ?? 0) - totalVoucher).toFixed(2)));
        const nuevoRestante = Math.max(0, Number((((v as any).valor_restante ?? 0) - totalVoucher).toFixed(2)));
        const { error: errVoucher } = await supabase
          .from("vouchers")
          .update({
            valor_total_generado: nuevoGenerado,
            valor_restante: nuevoRestante,
          })
          .eq("id", (v as any).id);
        if (errVoucher) {
          alert("Propuesta cancelada, pero error al actualizar el voucher: " + (errVoucher.message ?? ""));
        } else {
          await supabase.from("movimiento_vouchers").insert({
            id_voucher: (v as any).id,
            id_cliente: (prop as any).id_cliente,
            id_propuesta: row.id,
            valor_generado: totalVoucher,
            tipo: "cancelado",
            id_usuario: perfil?.id,
          });
        }
      }
    }

    await loadPropuestas();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Cargando propuestas...</div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-gray-500">{rows.length} propuesta(s)</p>
        <button type="button" className={btnPrimary} onClick={() => { resetForm(); setShowModal(true); }}>
          <i className="fas fa-plus text-xs" />Nueva propuesta
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Vendedor</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Tipo</th>
              <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Total (USD)</th>
              <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Voucher</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado_codigo === "cancelado" ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 text-gray-700">{new Date(r.fecha).toLocaleDateString("es-PY")}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-500">{r.vendedor_nombre || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{r.tipo_codigo === "venta" ? "Venta" : "Presupuesto"}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{formatDecimal(r.total_general)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatDecimal(r.total_voucher)}</td>
                <td className="px-4 py-3"><BadgeEstado codigo={r.estado_codigo} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" className={btnGhost} onClick={() => handleView(r)}>
                      <i className="fas fa-eye" />Ver
                    </button>
                    {r.tipo_codigo === "venta" && r.estado_codigo === "vigente" && isAdmin && (
                      <button type="button" className={btnDanger} onClick={() => handleCancelar(r)}>Cancelar</button>
                    )}
                    <button type="button" className={btnGhost} onClick={() => generarPdfPropuesta(supabase, r.id, false, { userName: perfil?.nombre })}>
                      <i className="fas fa-file-pdf" />PDF
                    </button>
                    {isAdmin && (
                      <button type="button" className={btnGhost} onClick={() => generarPdfPropuesta(supabase, r.id, true, { userName: perfil?.nombre })}>
                        <i className="fas fa-file-pdf text-emerald-600" />PDF margen
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-file-alt mb-2 text-2xl block" />No hay propuestas registradas.
          </div>
        )}
      </div>

      {/* Modal Visualizar Propuesta */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-eye text-sm" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Detalle de propuesta</h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{viewing.sku ?? "Sin SKU"} · {viewing.tipo_codigo === "venta" ? "Venta" : "Presupuesto"}</p>
                </div>
              </div>
              <button onClick={() => { setViewing(null); setViewCart([]); }} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-times" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Info resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Cliente</p>
                  <p className="text-sm font-bold text-gray-900">{viewing.cliente_nombre}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Vendedor</p>
                  <p className="text-sm font-bold text-gray-900">{viewing.vendedor_nombre || "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Fecha</p>
                  <p className="text-sm font-bold text-gray-900">{new Date(viewing.fecha).toLocaleDateString("es-PY")}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Estado</p>
                  <BadgeEstado codigo={viewing.estado_codigo} />
                </div>
              </div>

              {/* Totais */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-agro-primary/5 border border-agro-primary/20 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-agro-primary mb-0.5">Total general</p>
                  <p className="text-lg font-mono font-bold text-agro-primary">{formatDecimal(viewing.total_general)} USD</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">Total voucher</p>
                  <p className="text-lg font-mono font-bold text-emerald-600">{formatDecimal(viewing.total_voucher)} USD</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-amber-700 mb-0.5">Total en bolsa (CBOT)</p>
                  <div className="flex gap-3 text-xs font-mono font-bold">
                    <span className="text-amber-700"><i className="fas fa-leaf text-[10px] mr-1" />Soja: {viewing.total_en_bolsas_soja?.toFixed(2) ?? "—"}</span>
                    <span className="text-amber-700"><i className="fas fa-seedling text-[10px] mr-1" />Maíz: {viewing.total_en_bolsas_maiz?.toFixed(2) ?? "—"}</span>
                    <span className="text-amber-700"><i className="fas fa-wheat-awn text-[10px] mr-1" />Trigo: {viewing.total_en_bolsas_trigo?.toFixed(2) ?? "—"}</span>
                  </div>
                </div>
              </div>

              {/* Productos */}
              {viewCart.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Productos ({viewCart.length})</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2.5 font-bold text-gray-600">Producto</th>
                          <th className="text-left px-3 py-2.5 font-bold text-gray-600">Distribuidor</th>
                          <th className="text-left px-3 py-2.5 font-bold text-gray-600">Categoría</th>
                          <th className="text-left px-3 py-2.5 font-bold text-gray-600">Un. Medida</th>
                          <th className="text-right px-3 py-2.5 font-bold text-gray-600">Cont. Emp.</th>
                          <th className="text-right px-3 py-2.5 font-bold text-gray-600">P. Mínimo</th>
                          <th className="text-right px-3 py-2.5 font-bold text-gray-600">Precio Unit.</th>
                          <th className="text-center px-3 py-2.5 font-bold text-gray-600">Cant.</th>
                          <th className="text-center px-3 py-2.5 font-bold text-gray-600">Nº apl.</th>
                          <th className="text-center px-3 py-2.5 font-bold text-gray-600">Dosis/ha</th>
                          <th className="text-center px-3 py-2.5 font-bold text-gray-600">Área trat.</th>
                          <th className="text-right px-3 py-2.5 font-bold text-gray-600">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {viewCart.map((it, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{it.nombre}</td>
                            <td className="px-3 py-2.5 text-gray-600">{it.distribuidor_nombre || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-600">{it.categoria || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-600">{it.unidad_medida || "—"}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatDecimal(it.contenido_empaque)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatDecimal(it.precio_minimo)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatDecimal(it.precio_producto)}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{it.cantidad}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{it.num_aplicaciones}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{formatDecimal(it.dosis_ha)}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{formatDecimal(it.area_tratada)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">{formatDecimal(it.importe_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={() => generarPdfPropuesta(supabase, viewing.id, false, { userName: perfil?.nombre })}>
                  <i className="fas fa-file-pdf" />PDF
                </button>
                {isAdmin && (
                  <button type="button" className={btnGhost} onClick={() => generarPdfPropuesta(supabase, viewing.id, true, { userName: perfil?.nombre })}>
                    <i className="fas fa-file-pdf text-emerald-600" />PDF margen
                  </button>
                )}
              </div>
              <button type="button" className={btnSecondary} onClick={() => { setViewing(null); setViewCart([]); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Propuesta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-file-alt text-sm" />
                </div>
                <h3 className="font-bold text-gray-900">Nueva propuesta</h3>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-times" /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                {/* Header Info */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cabecera</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className={labelCls}>SKU</label>
                      <input className={inputCls + " bg-gray-50"} readOnly value="Se generará al confirmar" />
                    </div>
                    <div>
                      <label className={labelCls}>Tipo *</label>
                      <select className={inputCls} value={header.id_tipo_propuesta} onChange={(e) => setHeader({ ...header, id_tipo_propuesta: e.target.value })} required>
                        <option value="">Seleccione</option>
                        {tipos.map((t) => <option key={t.id} value={t.id}>{t.codigo === "venta" ? "Venta" : "Presupuesto"}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <label className={labelCls}>Cliente *</label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Escriba para buscar..."
                        value={header.id_cliente ? selectedClienteNombre : clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setHeader((h) => ({ ...h, id_cliente: "" }));
                          setClientDropdownOpen(true);
                        }}
                        onFocus={() => setClientDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setClientDropdownOpen(false), 200)}
                      />
                      {clientDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
                          {filteredClientes.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
                          ) : (
                            filteredClientes.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-agro-primary/10 transition-colors border-b border-gray-50 last:border-0"
                                onClick={() => {
                                  setHeader((h) => ({ ...h, id_cliente: c.id }));
                                  setClientSearch(c.nombre);
                                  setClientDropdownOpen(false);
                                }}
                              >
                                {c.nombre}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Vendedor</label>
                      <input className={inputCls + " bg-gray-50"} readOnly value={perfil?.nombre ?? "—"} />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha</label>
                      <input type="date" className={inputCls + " bg-gray-50"} readOnly value={new Date().toISOString().slice(0, 10)} />
                    </div>
                  </div>
                </div>

                {/* Totales Badge */}
                <div className="bg-gray-50 rounded-xl p-4 flex flex-wrap gap-6 text-sm">
                  <div><span className="text-gray-500">Ítems: </span><b className="text-gray-900">{cart.length}</b></div>
                  <div><span className="text-gray-500">Voucher: </span><b className="text-emerald-600">{formatDecimal(totalVoucher)} USD</b></div>
                  <div><span className="text-gray-500">Total general: </span><b className="text-gray-900">{formatDecimal(totalGeneral)} USD</b></div>
                </div>

                {/* Total en Bolsa */}
                {totalGeneral > 0 && (cbotPrices.soja > 0 || cbotPrices.maiz > 0 || cbotPrices.trigo > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-amber-700 mb-2">Total en bolsa (calculado por CBOT)</p>
                    <div className="flex flex-wrap gap-6 text-sm">
                      {cbotPrices.soja > 0 && <div><span className="text-amber-600">Soja: </span><b className="text-amber-800 font-mono">{totalEnBolsas.soja} bolsas</b></div>}
                      {cbotPrices.maiz > 0 && <div><span className="text-amber-600">Maíz: </span><b className="text-amber-800 font-mono">{totalEnBolsas.maiz} bolsas</b></div>}
                      {cbotPrices.trigo > 0 && <div><span className="text-amber-600">Trigo: </span><b className="text-amber-800 font-mono">{totalEnBolsas.trigo} bolsas</b></div>}
                    </div>
                  </div>
                )}

                {/* Buscar Producto */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Agregar producto</p>
                  <div className="relative mb-3">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    <input type="text" className={inputCls + " pl-8"} placeholder="Buscar producto por nombre..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedProduct(null); }} />
                    {productSearch && !selectedProduct && (
                      <div className="absolute z-10 w-full bg-white mt-1 rounded-xl shadow-xl border border-gray-100 max-h-52 overflow-y-auto">
                        {filteredProductos.map((p) => (
                          <button key={p.id} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-agro-primary/5 transition-colors border-b border-gray-50 last:border-0" onClick={() => { setSelectedProduct(p); setProductSearch(p.nombre); }}>
                            <span className="font-medium text-gray-900">{p.nombre}</span>
                            <span className="text-gray-400 ml-2">{formatDecimal(p.precio_final)} USD</span>
                            {p.categorias_producto?.descripcion && <span className="text-gray-300 ml-2 text-xs">· {p.categorias_producto.descripcion}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProduct && (
                    <div className="space-y-3">
                      {/* Product info summary */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-wrap gap-4 text-xs">
                        <div><span className="text-blue-500 font-bold">Categoría:</span> <span className="text-blue-800">{selectedProduct.categorias_producto?.descripcion ?? "—"}</span></div>
                        <div><span className="text-blue-500 font-bold">Un. Medida:</span> <span className="text-blue-800">{selectedProduct.unidades_medida?.descripcion ?? (selectedProduct as any).presentacion_txt ?? "—"}</span></div>
                        <div><span className="text-blue-500 font-bold">Cont. Empaque:</span> <span className="text-blue-800">{selectedProduct.contenido_empaque ?? "—"}</span></div>
                        <div><span className="text-blue-500 font-bold">Precio Mínimo:</span> <span className="text-blue-800">{formatDecimal(selectedProduct.precio_minimo)} USD</span></div>
                        <div><span className="text-blue-500 font-bold">Precio Final:</span> <span className="text-blue-800 font-mono font-bold">{formatDecimal(selectedProduct.precio_final)} USD</span></div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-agro-primary/5 p-4 rounded-xl border border-agro-primary/10">
                        <div>
                          <label className={labelCls}>Distribuidor</label>
                          <input type="text" className={inputCls + " bg-gray-50"} readOnly value={selectedProduct.fabricante || "—"} />
                        </div>
                        <div>
                          <label className={labelCls}>Cantidad</label>
                          <input type="number" step="0.001" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Nº aplicaciones</label>
                          <input type="number" min="1" className={inputCls} value={numAplicaciones} onChange={(e) => setNumAplicaciones(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Dosis/ha</label>
                          <input type="number" step="0.001" className={inputCls} value={dosisHa} onChange={(e) => setDosisHa(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                          <button type="button" className={btnPrimary + " w-full justify-center"} onClick={addToCart}>
                            <i className="fas fa-plus text-xs" />Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cart Table */}
                {cart.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Productos en la propuesta</p>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-3 py-2.5 font-bold text-gray-600">Producto</th>
                            <th className="text-left px-3 py-2.5 font-bold text-gray-600">Distribuidor</th>
                            <th className="text-right px-3 py-2.5 font-bold text-gray-600">Precio Unit.</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Cant.</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Nº apl.</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Dosis/ha</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Área trat.</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Costo/ha</th>
                            <th className="text-center px-3 py-2.5 font-bold text-gray-600">Importe</th>
                            <th className="px-3 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {cart.map((it, i) => (
                            <Fragment key={i}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-3 py-2.5 font-medium text-gray-900">{it.nombre}</td>
                                <td className="px-3 py-2.5 text-gray-600">{it.distribuidor_nombre || "—"}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatDecimal(it.precio_producto)}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{it.cantidad}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{it.num_aplicaciones}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{formatDecimal(it.dosis_ha)}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{formatDecimal(it.area_tratada)}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{formatDecimal(it.costo_ha)}</td>
                                <td className="px-3 py-2.5">
                                  <input type="number" step="0.01" className="w-24 px-2 py-1 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-agro-primary/20 outline-none" value={it.importe_total} onChange={(e) => updateCartImporte(i, toNum(e.target.value))} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <button type="button" className="text-red-400 hover:text-red-600 transition-colors" onClick={() => removeFromCart(i)}>
                                    <i className="fas fa-trash text-xs" />
                                  </button>
                                </td>
                              </tr>
                              {isAdmin && (
                                <tr className="bg-emerald-50/50 border-b border-gray-100">
                                  <td colSpan={10} className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                      <span className="font-bold text-emerald-800 mr-1">Composición (PDF gerencial):</span>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-14">P. compra</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.precio_compra_base ?? ""} onChange={(e) => updateCartComposicion(i, "precio_compra_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-12">Margen</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.margen_base ?? ""} onChange={(e) => updateCartComposicion(i, "margen_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-14">P. venta</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.precio_final_base ?? it.precio_producto ?? ""} onChange={(e) => updateCartComposicion(i, "precio_final_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-14">C. oper.</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.costo_operacional_base ?? ""} onChange={(e) => updateCartComposicion(i, "costo_operacional_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-12">C. fin.</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.costo_financiero_base ?? ""} onChange={(e) => updateCartComposicion(i, "costo_financiero_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-16">Bonif. cl.</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.bonificacion_cliente_base ?? ""} onChange={(e) => updateCartComposicion(i, "bonificacion_cliente_base", toNum(e.target.value))} /></label>
                                      <label className="flex items-center gap-1"><span className="text-gray-500 w-16">Impacto</span><input type="number" step="0.01" className="w-16 px-1.5 py-0.5 rounded border border-gray-200" value={it.impacto_total_costo_base ?? ""} onChange={(e) => updateCartComposicion(i, "impacto_total_costo_base", toNum(e.target.value))} /></label>
                                      <span className="text-gray-400 ml-1">Voucher %: {formatDecimal(it.voucher_pct)} · P. mín.: {formatDecimal(it.precio_minimo)}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button type="button" className={btnSecondary} onClick={resetForm}>Cancelar</button>
                <button type="submit" className={btnPrimary} disabled={saving || cart.length === 0}>
                  {saving ? <><i className="fas fa-spinner fa-spin text-xs" />Guardando...</> : "Confirmar propuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
