import { FormEvent, useEffect, useMemo, useState } from "react";
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
  estado_codigo: string;
  tipo_codigo: string;
  cliente_nombre: string;
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
  precio_compra_base?: number;
  margen_base?: number;
  precio_final_base?: number;
}

const toNum = (v: unknown): number => (v !== "" && v != null ? Number(v) : 0);

function calcAreaTratada(
  cantidad: number,
  contenido_empaque: number,
  dosis_ha: number,
  num_aplicaciones: number
): number {
  if (!dosis_ha || !num_aplicaciones) return 0;
  const cantPedido = contenido_empaque > 0 ? cantidad * contenido_empaque : cantidad;
  return Number((cantPedido / (dosis_ha * num_aplicaciones)).toFixed(3));
}

export function PropuestasTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<PropuestaRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [productos, setProductos] = useState<
    { id: string; nombre: string; precio_final: number; contenido_empaque: number; categorias_producto?: { descripcion: string }; unidades_medida?: { descripcion: string }; voucher: number; precio_minimo: number }[]
  >([]);
  const [distribuidores, setDistribuidores] = useState<{ id: string; distribuidor: string }[]>([]);
  const [tipos, setTipos] = useState<{ id: string; codigo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [header, setHeader] = useState({
    sku: "",
    id_tipo_propuesta: "",
    id_cliente: "",
    id_vendedor: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<typeof productos[0] | null>(null);
  const [idDistribuidor, setIdDistribuidor] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [numAplicaciones, setNumAplicaciones] = useState("");
  const [dosisHa, setDosisHa] = useState("");

  const loadPropuestas = async () => {
    let q = supabase
      .from("propuestas")
      .select(
        "id, sku, fecha, total_general, total_voucher, created_at, id_cliente, id_tipo_propuesta, id_estado_propuesta, tipo_propuesta(codigo), estado_propuesta(codigo), clientes(nombre)"
      )
      .order("created_at", { ascending: false });
    if (perfil?.perfil_acceso === "rtv") {
      q = q.eq("id_vendedor", perfil.id);
    }
    const { data, error } = await q;
    if (!error && data) {
      setRows(
        (data as any[]).map((d) => ({
          id: d.id,
          sku: d.sku,
          fecha: d.fecha,
          total_general: d.total_general,
          total_voucher: d.total_voucher,
          estado_codigo: d.estado_propuesta?.codigo ?? "",
          tipo_codigo: d.tipo_propuesta?.codigo ?? "",
          cliente_nombre: d.clientes?.nombre ?? "",
          created_at: d.created_at,
        }))
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadPropuestas();
      const [c, p, d, t] = await Promise.all([
        supabase.from("clientes").select("id, nombre").eq("estado", "activo"),
        supabase
          .from("productos")
          .select(
            "id, nombre, precio_final, contenido_empaque, voucher, precio_minimo, id_categoria, id_unidad_medida, categorias_producto(descripcion), unidades_medida(descripcion)"
          )
          .eq("estado", "activo"),
        supabase.from("distribuidores").select("id, distribuidor").eq("estado", "activo"),
        supabase.from("tipo_propuesta").select("id, codigo"),
      ]);
      if (c.data) setClientes(c.data as any);
      if (p.data) setProductos(p.data as any);
      if (d.data) setDistribuidores(d.data as any);
      if (t.data) setTipos(t.data as any);
      setLoading(false);
    };
    load();
  }, []);

  const totalItems = useMemo(() => cart.length, [cart]);
  const totalVoucher = useMemo(
    () =>
      Number(
        cart
          .reduce(
            (acc, it) =>
              acc + (it.importe_total * (it.voucher_pct / 100)),
            0
          )
          .toFixed(3)
      ),
    [cart]
  );
  const totalGeneral = useMemo(
    () => Number(cart.reduce((acc, it) => acc + it.importe_total, 0).toFixed(3)),
    [cart]
  );

  const filteredProductos = useMemo(() => {
    if (!productSearch.trim()) return productos.slice(0, 20);
    const q = productSearch.toLowerCase();
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [productos, productSearch]);

  const addToCart = () => {
    if (!selectedProduct) return;
    const cant = toNum(cantidad);
    const numApl = toNum(numAplicaciones) || 1;
    const dosis = toNum(dosisHa);
    const area = calcAreaTratada(cant, selectedProduct.contenido_empaque ?? 0, dosis, numApl);
    const precio = selectedProduct.precio_final ?? 0;
    const costoHa = area > 0 ? Number((precio / area).toFixed(3)) : 0;
    const importeTotal = Number((precio * cant).toFixed(3));
    const item: CartItem = {
      id_producto: selectedProduct.id,
      id_distribuidor: idDistribuidor,
      nombre: selectedProduct.nombre,
      categoria: (selectedProduct as any).categorias_producto?.descripcion ?? "",
      unidad_medida: (selectedProduct as any).unidades_medida?.descripcion ?? "",
      contenido_empaque: selectedProduct.contenido_empaque ?? 0,
      voucher_pct: selectedProduct.voucher ?? 0,
      precio_minimo: selectedProduct.precio_minimo ?? 0,
      precio_producto: precio,
      cantidad: cant,
      num_aplicaciones: numApl,
      dosis_ha: dosis,
      area_tratada: area,
      costo_ha: costoHa,
      importe_total: importeTotal,
    };
    setCart((prev) => [...prev, item]);
    setSelectedProduct(null);
    setIdDistribuidor("");
    setCantidad("");
    setNumAplicaciones("");
    setDosisHa("");
    setProductSearch("");
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCartImporte = (index: number, importeTotal: number) => {
    const it = cart[index];
    const minVal = Number((it.precio_minimo * it.cantidad).toFixed(3));
    const val = importeTotal < minVal ? minVal : importeTotal;
    const costoHa = it.area_tratada > 0 ? Number((val / it.area_tratada).toFixed(3)) : 0;
    setCart((prev) =>
      prev.map((x, i) =>
        i === index ? { ...x, importe_total: val, costo_ha: costoHa } : x
      )
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setHeader({
      sku: "",
      id_tipo_propuesta: "",
      id_cliente: "",
      id_vendedor: perfil?.id ?? "",
      fecha: new Date().toISOString().slice(0, 10),
    });
    setCart([]);
    setShowModal(false);
  };

  const handleNuevo = () => {
    resetForm();
    setHeader((h) => ({ ...h, id_vendedor: perfil?.id ?? "" }));
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!header.id_cliente || !header.id_tipo_propuesta || cart.length === 0) {
      alert("Complete cliente, tipo y al menos un producto.");
      return;
    }
    setSaving(true);
    const tipoVenta = tipos.find((t) => t.codigo === "venta")?.id;
    const estadoVigente = await supabase
      .from("estado_propuesta")
      .select("id")
      .eq("codigo", "vigente")
      .single()
      .then((r) => r.data?.id);

    const { data: prop } = await supabase
      .from("propuestas")
      .insert({
        sku: header.sku || null,
        id_cliente: header.id_cliente,
        id_tipo_propuesta: header.id_tipo_propuesta,
        fecha: header.fecha,
        id_vendedor: header.id_vendedor || perfil?.id,
        total_items: cart.length,
        total_voucher: header.id_tipo_propuesta === tipoVenta ? totalVoucher : 0,
        total_en_bolsas: 0,
        total_general: totalGeneral,
        id_estado_propuesta: estadoVigente,
      })
      .select("id")
      .single();

    if (!prop?.id) {
      setSaving(false);
      return;
    }

    for (const it of cart) {
      await supabase.from("productos_propuesta").insert({
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
      });
    }

    if (header.id_tipo_propuesta === tipoVenta && totalVoucher > 0) {
      const { data: vouch } = await supabase
        .from("vouchers")
        .select("id, valor_total_generado, valor_restante")
        .eq("id_cliente", header.id_cliente)
        .maybeSingle();
      if (vouch) {
        const gen = (vouch as any).valor_total_generado ?? 0;
        const rest = (vouch as any).valor_restante ?? 0;
        await supabase
          .from("vouchers")
          .update({
            valor_total_generado: Number((gen + totalVoucher).toFixed(3)),
            valor_restante: Number((rest + totalVoucher).toFixed(3)),
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
      const { data: v2 } = await supabase
        .from("vouchers")
        .select("id")
        .eq("id_cliente", header.id_cliente)
        .single();
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
    setSaving(false);
  };

  const handleCancelar = async (row: PropuestaRow) => {
    if (row.tipo_codigo !== "venta") return;
    if (perfil?.perfil_acceso !== "admin") {
      alert("Solo el administrador puede cancelar propuestas tipo venta.");
      return;
    }
    const { data: prop } = await supabase
      .from("propuestas")
      .select("id, total_voucher, id_cliente, created_at")
      .eq("id", row.id)
      .single();
    if (!prop) return;
    const propCreatedAt = (prop as any).created_at;
    const { data: liberaciones } = await supabase
      .from("movimiento_vouchers")
      .select("id, fecha")
      .eq("id_cliente", (prop as any).id_cliente)
      .eq("tipo", "liberado");
    const hayLiberacionPosterior = (liberaciones ?? []).some(
      (mov: { fecha: string }) => new Date(mov.fecha) > new Date(propCreatedAt)
    );
    if (hayLiberacionPosterior) {
      alert(
        "No se puede cancelar esta propuesta tipo venta porque ya existió una liberación de voucher con fecha posterior a la creación de esta propuesta."
      );
      return;
    }
    if (!confirm("¿Cancelar esta propuesta tipo venta? Se cancelará el voucher asociado."))
      return;
    const estadoCancelado = await supabase
      .from("estado_propuesta")
      .select("id")
      .eq("codigo", "cancelado")
      .single()
      .then((r) => r.data?.id);
    await supabase
      .from("propuestas")
      .update({ id_estado_propuesta: estadoCancelado })
      .eq("id", row.id);
    const { data: v } = await supabase
      .from("vouchers")
      .select("id, valor_restante, valor_total_generado")
      .eq("id_cliente", (prop as any).id_cliente)
      .single();
    if (v) {
      const rest = Number(((v as any).valor_restante - ((prop as any).total_voucher || 0)).toFixed(3));
      await supabase
        .from("vouchers")
        .update({ valor_restante: Math.max(0, rest) })
        .eq("id", (v as any).id);
      await supabase.from("movimiento_vouchers").insert({
        id_voucher: (v as any).id,
        id_cliente: (prop as any).id_cliente,
        id_propuesta: row.id,
        valor_liberado: (prop as any).total_voucher,
        tipo: "cancelado",
        id_usuario: perfil?.id,
      });
    }
    await loadPropuestas();
  };

  if (loading) return <span>Cargando propuestas...</span>;

  return (
    <div>
      <h5 className="mb-3">Propuestas</h5>
      <div className="mb-3">
        <button type="button" className="btn btn-success btn-sm" onClick={handleNuevo}>
          <i className="fas fa-plus mr-1" />
          Nueva propuesta
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-hover">
          <thead className="thead-dark">
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Total (USD)</th>
              <th>Total voucher</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.fecha).toLocaleDateString("es-PY")}</td>
                <td>{r.cliente_nombre}</td>
                <td>{r.tipo_codigo === "venta" ? "Venta" : "Presupuesto"}</td>
                <td>{formatDecimal(r.total_general)}</td>
                <td>{formatDecimal(r.total_voucher)}</td>
                <td>
                  <span
                    className={`badge ${r.estado_codigo === "vigente" ? "badge-success" : "badge-secondary"}`}
                  >
                    {r.estado_codigo === "vigente" ? "Vigente" : "Cancelado"}
                  </span>
                </td>
                <td>
                  {r.tipo_codigo === "venta" && r.estado_codigo === "vigente" && perfil?.perfil_acceso === "admin" && (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-danger mr-1"
                      onClick={() => handleCancelar(r)}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-secondary mr-1"
                    onClick={() => generarPdfPropuesta(supabase, r.id, false)}
                  >
                    PDF
                  </button>
                  {perfil?.perfil_acceso === "admin" && (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-secondary"
                      onClick={() => generarPdfPropuesta(supabase, r.id, true)}
                    >
                      PDF margen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">Nueva propuesta</h5>
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
                  <div className="row mb-3">
                    <div className="col-md-2">
                      <label className="form-label">SKU</label>
                      <input
                        className="form-control form-control-sm"
                        value={header.sku}
                        onChange={(e) => setHeader({ ...header, sku: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Tipo</label>
                      <select
                        className="form-control form-control-sm"
                        value={header.id_tipo_propuesta}
                        onChange={(e) =>
                          setHeader({ ...header, id_tipo_propuesta: e.target.value })
                        }
                        required
                      >
                        <option value="">Seleccione</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.codigo === "venta" ? "Venta" : "Presupuesto"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Cliente</label>
                      <select
                        className="form-control form-control-sm"
                        value={header.id_cliente}
                        onChange={(e) =>
                          setHeader({ ...header, id_cliente: e.target.value })
                        }
                        required
                      >
                        <option value="">Seleccione</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Fecha</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={header.fecha}
                        onChange={(e) => setHeader({ ...header, fecha: e.target.value })}
                        max={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                  </div>
                  <p className="small text-muted">
                    Total ítems: {totalItems} | Total voucher: {formatDecimal(totalVoucher)} USD |
                    Total general: {formatDecimal(totalGeneral)} USD
                  </p>

                  <h6 className="mt-3">Agregar producto</h6>
                  <div className="row mb-2">
                    <div className="col-md-5">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Buscar producto"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                      {productSearch && (
                        <ul className="list-group list-group-flush small">
                          {filteredProductos.map((p) => (
                            <li
                              key={p.id}
                              className="list-group-item list-group-item-action"
                              onClick={() => setSelectedProduct(p)}
                            >
                              {p.nombre} – {formatDecimal(p.precio_final)} USD
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {selectedProduct && (
                      <>
                        <div className="col-md-2">
                          <label className="form-label">Distribuidor</label>
                          <select
                            className="form-control form-control-sm"
                            value={idDistribuidor}
                            onChange={(e) => setIdDistribuidor(e.target.value)}
                          >
                            <option value="">-</option>
                            {distribuidores.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.distribuidor}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-1">
                          <label className="form-label">Cant.</label>
                          <input
                            type="number"
                            step="0.001"
                            className="form-control form-control-sm"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                          />
                        </div>
                        <div className="col-md-1">
                          <label className="form-label">Nº apl.</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            value={numAplicaciones}
                            onChange={(e) => setNumAplicaciones(e.target.value)}
                          />
                        </div>
                        <div className="col-md-1">
                          <label className="form-label">Dosis/ha</label>
                          <input
                            type="number"
                            step="0.001"
                            className="form-control form-control-sm"
                            value={dosisHa}
                            onChange={(e) => setDosisHa(e.target.value)}
                          />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={addToCart}
                          >
                            Agregar
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <h6 className="mt-3">Productos adicionados</h6>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Nº apl.</th>
                          <th>Dosis/ha</th>
                          <th>Área tratada</th>
                          <th>Costo/ha</th>
                          <th>Importe total</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((it, i) => (
                          <tr key={i}>
                            <td>{it.nombre}</td>
                            <td>{it.cantidad}</td>
                            <td>{it.num_aplicaciones}</td>
                            <td>{formatDecimal(it.dosis_ha)}</td>
                            <td>{formatDecimal(it.area_tratada)}</td>
                            <td>{formatDecimal(it.costo_ha)}</td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="form-control form-control-sm"
                                value={it.importe_total}
                                onChange={(e) =>
                                  updateCartImporte(i, toNum(e.target.value))
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-danger"
                                onClick={() => removeFromCart(i)}
                              >
                                <i className="fas fa-trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success" disabled={saving || cart.length === 0}>
                    {saving ? "Guardando..." : "Confirmar"}
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
