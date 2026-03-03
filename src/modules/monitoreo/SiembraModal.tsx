import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDecimal } from "../productos/utils";
import { generarPdfSiembra } from "./pdfSiembra";

export interface MonitoreoRow {
  id: string;
  id_cliente: string;
  id_parcela: string;
  id_zafra: string;
  hectares: number | null;
  parcela_nombre: string;
  zafra_nombre: string;
  cliente_nombre: string;
}

interface ProductoOption {
  id: string;
  nombre: string;
  contenido_empaque: number | null;
  precio_venta: number | null;
  culturas: string[] | null;
}

interface SiembraLine {
  id_producto: string;
  nombre: string;
  dosis_ha: string;
  cantidad: number;
  importe_total: number;
  costo_ha: number;
  contenido_empaque: number | null;
  precio_venta: number | null;
}

interface SiembraModalProps {
  monitoreo: MonitoreoRow;
  siembraId: string;
  areaHa: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SiembraModal({ monitoreo, siembraId, areaHa, onClose, onSaved }: SiembraModalProps) {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTermino, setFechaTermino] = useState("");
  const [productos, setProductos] = useState<ProductoOption[]>([]);
  const [lines, setLines] = useState<SiembraLine[]>([]);
  const [productoAdd, setProductoAdd] = useState("");
  const [dosisAdd, setDosisAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const area = areaHa ?? 0;
  const areaValid = area > 0;

  useEffect(() => {
    const load = async () => {
      const { data: siembra } = await supabase
        .from("siembra")
        .select("fecha_inicio, fecha_termino")
        .eq("id", siembraId)
        .single();

      if (siembra) {
        setFechaInicio((siembra as any).fecha_inicio ?? "");
        setFechaTermino((siembra as any).fecha_termino ?? "");
      }

      const { data: zafra } = await supabase
        .from("zafras")
        .select("id_cultura")
        .eq("id", monitoreo.id_zafra)
        .single();

      const idCultura = (zafra as any)?.id_cultura as string | null;
      let productosQ = supabase
        .from("productos")
        .select("id, nombre, contenido_empaque, precio_venta, culturas")
        .eq("estado", "activo");
      if (idCultura) {
        productosQ = productosQ.contains("culturas", [idCultura]);
      }
      const { data: prods } = await productosQ;
      setProductos((prods as ProductoOption[]) ?? []);

      const { data: items } = await supabase
        .from("siembra_productos")
        .select("*, productos(nombre, contenido_empaque, precio_venta)")
        .eq("id_siembra", siembraId)
        .order("created_at", { ascending: true });

      if (items?.length) {
        setLines(
          (items as any[]).map((it) => {
            const p = it.productos ?? {};
            const cant = Number(it.cantidad) || 0;
            const imp = Number(it.importe_total) || 0;
            const costoHa = areaValid ? imp / area : 0;
            return {
              id_producto: it.id_producto,
              nombre: p.nombre ?? "-",
              dosis_ha: String(it.dosis_ha ?? ""),
              cantidad: cant,
              importe_total: imp,
              costo_ha: costoHa,
              contenido_empaque: p.contenido_empaque ?? null,
              precio_venta: p.precio_venta ?? null,
            };
          })
        );
      }
      setLoading(false);
    };
    load();
  }, [monitoreo.id_zafra, siembraId]);

  const addLine = () => {
    const prod = productos.find((p) => p.id === productoAdd);
    if (!prod || !dosisAdd.trim() || !areaValid) return;
    const dosis = Number(dosisAdd.replace(",", ".")) || 0;
    const contenido = Number(prod.contenido_empaque) || 1;
    const cantidad = (area * dosis) / contenido;
    const precio = Number(prod.precio_venta) || 0;
    const importe_total = cantidad * precio;
    const costo_ha = area > 0 ? importe_total / area : 0;
    if (lines.some((l) => l.id_producto === prod.id)) return;
    setLines((prev) => [
      ...prev,
      {
        id_producto: prod.id,
        nombre: prod.nombre,
        dosis_ha: dosisAdd,
        cantidad,
        importe_total,
        costo_ha,
        contenido_empaque: prod.contenido_empaque,
        precio_venta: prod.precio_venta,
      },
    ]);
    setProductoAdd("");
    setDosisAdd("");
  };

  const removeLine = (idProducto: string) => {
    setLines((prev) => prev.filter((l) => l.id_producto !== idProducto));
  };

  const updateDosis = (idProducto: string, dosisHa: string) => {
    const dosis = Number(dosisHa.replace(",", ".")) || 0;
    setLines((prev) =>
      prev.map((l) => {
        if (l.id_producto !== idProducto) return l;
        const contenido = l.contenido_empaque ?? 1;
        const cantidad = (area * dosis) / contenido;
        const importe_total = cantidad * (l.precio_venta ?? 0);
        const costo_ha = areaValid ? importe_total / area : 0;
        return {
          ...l,
          dosis_ha: dosisHa,
          cantidad,
          importe_total,
          costo_ha,
        };
      })
    );
  };

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + l.importe_total, 0);
    const costoHa = areaValid && total > 0 ? total / area : 0;
    return { total, costoHa };
  }, [lines, area, areaValid]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("siembra")
      .update({
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
        costo_total: totals.total,
        costo_ha: totals.costoHa,
      })
      .eq("id", siembraId);

    await supabase.from("siembra_productos").delete().eq("id_siembra", siembraId);
    if (lines.length > 0) {
      await supabase.from("siembra_productos").insert(
        lines.map((l) => ({
          id_siembra: siembraId,
          id_producto: l.id_producto,
          categoria: null,
          cantidad: l.cantidad,
          dosis_ha: Number(l.dosis_ha.replace(",", ".")) || 0,
          importe_total: l.importe_total,
          costo_ha: l.costo_ha,
        }))
      );
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handlePdf = async () => {
    setGenerandoPdf(true);
    await generarPdfSiembra(supabase, siembraId);
    setGenerandoPdf(false);
  };

  if (loading) {
    return (
      <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-body text-center py-5">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              Siembra – {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
            </h5>
            <button type="button" className="close text-white" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {!areaValid && (
                <div className="alert alert-warning">
                  Configure el área (ha) de la parcela o del monitoreo para calcular cantidades.
                </div>
              )}
              <div className="row mb-3">
                <div className="col-md-3">
                  <label className="form-label">Fecha inicio</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha término</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fechaTermino}
                    onChange={(e) => setFechaTermino(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Área (ha)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={formatDecimal(area) || "-"}
                    readOnly
                  />
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header py-2">Agregar producto (filtrado por cultura de la zafra)</div>
                <div className="card-body py-2">
                  <div className="row align-items-end">
                    <div className="col-md-5">
                      <label className="form-label small">Producto</label>
                      <select
                        className="form-control form-control-sm"
                        value={productoAdd}
                        onChange={(e) => setProductoAdd(e.target.value)}
                      >
                        <option value="">Seleccione</option>
                        {productos
                          .filter((p) => !lines.some((l) => l.id_producto === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small">Dosis/ha</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="0"
                        value={dosisAdd}
                        onChange={(e) => setDosisAdd(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={addLine}
                        disabled={!productoAdd || !dosisAdd.trim() || !areaValid}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead className="thead-light">
                    <tr>
                      <th>Producto</th>
                      <th>Dosis/ha</th>
                      <th>Cantidad</th>
                      <th>Costo/ha (USD)</th>
                      <th>Importe total (USD)</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id_producto}>
                        <td>{l.nombre}</td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={l.dosis_ha}
                            onChange={(e) => updateDosis(l.id_producto, e.target.value)}
                          />
                        </td>
                        <td>{formatDecimal(l.cantidad)}</td>
                        <td>{formatDecimal(l.costo_ha)}</td>
                        <td>{formatDecimal(l.importe_total)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeLine(l.id_producto)}
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lines.length > 0 && (
                <div className="row mt-2">
                  <div className="col-md-6">
                    <strong>Costo total siembra (USD):</strong> {formatDecimal(totals.total)}
                  </div>
                  <div className="col-md-6">
                    <strong>Costo/ha (USD):</strong> {formatDecimal(totals.costoHa)}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-info"
                onClick={handlePdf}
                disabled={generandoPdf}
              >
                {generandoPdf ? "Generando..." : "Generar PDF"}
              </button>
              <button type="submit" className="btn btn-success" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
