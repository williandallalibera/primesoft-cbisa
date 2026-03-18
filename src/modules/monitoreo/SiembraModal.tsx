import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { SearchSelect } from "../common/SearchSelect";
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
  readOnly?: boolean;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function SiembraModal({ monitoreo, siembraId, areaHa, onClose, onSaved, readOnly = false }: SiembraModalProps) {
  const { perfil } = useAuth();
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
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        setProductos([
          { id: "mock-p1", nombre: "Semilla Soja 1", contenido_empaque: 40, precio_venta: 450, culturas: [] },
          { id: "mock-p2", nombre: "Semilla Maiz 2", contenido_empaque: 20, precio_venta: 120, culturas: [] }
        ]);
        const mockSiembras: Record<string, { fecha_inicio: string; fecha_termino: string; lines?: { nombre: string; dosis_ha: string; cantidad: number; importe_total: number }[] }> = {
          "s-2": { fecha_inicio: "2024-10-05", fecha_termino: "2024-10-20", lines: [{ nombre: "Semilla Soja 1", dosis_ha: "120.5", cantidad: 255, importe_total: 10200 }] },
          "s-3": { fecha_inicio: "2024-09-15", fecha_termino: "2024-10-01" },
          "s-4": { fecha_inicio: "2024-08-20", fecha_termino: "2024-09-05" },
        };
        const mock = mockSiembras[siembraId];
        if (mock) {
          setFechaInicio(mock.fecha_inicio);
          setFechaTermino(mock.fecha_termino);
          if (mock.lines?.length) setLines(mock.lines.map((l) => ({ id_producto: "mock-p1", nombre: l.nombre, dosis_ha: l.dosis_ha, cantidad: l.cantidad, importe_total: l.importe_total, costo_ha: areaValid ? l.importe_total / area : 0, contenido_empaque: 40, precio_venta: 450 })));
        } else {
          setFechaInicio(new Date().toISOString().slice(0, 10));
        }
        setLoading(false);
        return;
      }

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
      const { data: prodsRaw } = await supabase
        .from("productos")
        .select("id, nombre, contenido_empaque, precio_venta, culturas")
        .eq("estado", "activo");
      const allProds = (prodsRaw as ProductoOption[] | null) ?? [];
      const prods = idCultura
        ? allProds.filter((p) => !(p.culturas && p.culturas.length > 0) || p.culturas!.includes(idCultura))
        : allProds;
      setProductos(prods);

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
    const quantidade = (area * dosis) / contenido;
    const precio = Number(prod.precio_venta) || 0;
    const importe_total = quantidade * precio;
    const costo_ha = area > 0 ? importe_total / area : 0;
    if (lines.some((l) => l.id_producto === prod.id)) return;
    setLines((prev) => [
      ...prev,
      {
        id_producto: prod.id,
        nombre: prod.nombre,
        dosis_ha: dosisAdd,
        cantidad: quantidade,
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
        const quantidade = (area * dosis) / contenido;
        const importe_total = quantidade * (l.precio_venta ?? 0);
        const costo_ha = areaValid ? importe_total / area : 0;
        return {
          ...l,
          dosis_ha: dosisHa,
          cantidad: quantidade,
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
    if (readOnly) return;
    setSaving(true);
    if (localStorage.getItem("forceAuthReview") === "true") {
      setSaving(false);
      onSaved();
      onClose();
      return;
    }
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
    await generarPdfSiembra(supabase, siembraId, { userName: perfil?.nombre });
    setGenerandoPdf(false);
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
        <i className="fas fa-spinner fa-spin text-agro-primary text-2xl mb-4" />
        <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Cargando...</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-seedling text-sm" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight text-base">Registro de Siembra</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                {monitoreo.cliente_nombre} / {monitoreo.parcela_nombre} / {monitoreo.zafra_nombre}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6">
            {!areaValid && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs flex items-center gap-3">
                <i className="fas fa-exclamation-triangle text-amber-500" />
                Configure el área (ha) de la parcela o del monitoreo para calcular cantidades.
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fecha inicio</label>
                <input
                  type="date"
                  className={inputCls}
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className={labelCls}>Fecha término</label>
                <input
                  type="date"
                  className={inputCls}
                  value={fechaTermino}
                  onChange={(e) => setFechaTermino(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className={labelCls}>Área (ha)</label>
                <input
                  type="text"
                  className={`${inputCls} bg-gray-50 font-mono`}
                  value={formatDecimal(area) || "-"}
                  readOnly
                />
              </div>
            </div>

            {/* Insumos Section */}
            <div className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 space-y-4">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-vial text-[10px]" /> {readOnly ? "Insumos" : "Agregar Insumos"}
              </h4>
              {!readOnly && (
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 md:col-span-7">
                  <label className={labelCls}>Producto (Filtrado por Cultura)</label>
                  <SearchSelect
                    items={productos
                      .filter((p) => !lines.some((l) => l.id_producto === p.id))
                      .map((p) => ({ id: p.id, label: p.nombre }))}
                    value={productoAdd}
                    onChange={setProductoAdd}
                    allLabel="Seleccione un producto"
                    className={inputCls}
                    placeholder="Buscar producto..."
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className={labelCls}>Dosis/ha (3 dec.)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className={inputCls}
                    placeholder="0.000"
                    value={dosisAdd}
                    onChange={(e) => setDosisAdd(e.target.value)}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl shadow shadow-green-200 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    onClick={addLine}
                    disabled={!productoAdd || !dosisAdd.trim() || !areaValid}
                  >
                    <i className="fas fa-plus text-xs" /> Agregar
                  </button>
                </div>
              </div>
              )}

              {/* Tabela de Linhas */}
              {lines.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2.5 font-bold text-gray-500">Producto</th>
                        <th className="text-left px-3 py-2.5 font-bold text-gray-500 w-24">Dosis/ha</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500">Quantidade</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500">Costo/ha</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500">Total USD</th>
                        {!readOnly && <th className="w-10 px-3 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((l) => (
                        <tr key={l.id_producto} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2 font-bold text-gray-800">{l.nombre}</td>
                          <td className="px-3 py-2">
                            {readOnly ? (
                              <span className="font-mono text-gray-600">{l.dosis_ha}</span>
                            ) : (
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white focus:border-agro-primary outline-none transition-all"
                                value={l.dosis_ha}
                                onChange={(e) => updateDosis(l.id_producto, e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600">{formatDecimal(l.cantidad)}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600">${formatDecimal(l.costo_ha)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-agro-primary">${formatDecimal(l.importe_total)}</td>
                          {!readOnly && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              onClick={() => removeLine(l.id_producto)}
                            >
                              <i className="fas fa-trash-alt text-[10px]" />
                            </button>
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/80 font-black border-t-2 border-gray-200">
                        <td colSpan={3} className="px-3 py-3 text-right uppercase tracking-wider text-[10px] text-gray-400">Totales Siembra (Estimado):</td>
                        <td className="px-3 py-3 text-right font-mono text-agro-primary underline decoration-2 underline-offset-4">${formatDecimal(totals.costoHa)}/ha</td>
                        <td className="px-3 py-3 text-right font-mono text-lg text-agro-primary">${formatDecimal(totals.total)}</td>
                        {!readOnly && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-blue-600 text-sm font-bold transition-all"
              onClick={handlePdf}
              disabled={generandoPdf}
            >
              {generandoPdf ? (
                <><i className="fas fa-spinner fa-spin" /> Generando PDF...</>
              ) : (
                <><i className="fas fa-file-pdf" /> Exportar detalle PDF</>
              )}
            </button>
            <div className="flex gap-3">
              <button type="button" className={btnSecondary} onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
              {!readOnly && (
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? (
                  <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                ) : (
                  <><i className="fas fa-save text-xs" /> Guardar Cambios</>
                )}
              </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
