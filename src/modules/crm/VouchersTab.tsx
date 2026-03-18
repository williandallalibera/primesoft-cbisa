import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { generarPdfVoucher } from "./pdfVoucher";

type SubTab = "voucher" | "movimiento";

interface VoucherRow {
  id: string;
  id_cliente: string;
  valor_total_generado: number;
  valor_total_liberado: number;
  valor_restante: number;
  cliente_nombre: string;
}

interface MovRow {
  id: string;
  fecha: string;
  cliente_nombre: string;
  valor_generado: number | null;
  valor_liberado: number | null;
  porcentaje_liberado: number | null;
  tipo: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";
const btnSmall = "inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all";

function tipoBadge(tipo: string) {
  const map: Record<string, string> = {
    generado: "bg-green-100 text-green-700",
    liberado: "bg-blue-100 text-blue-700",
    cancelado: "bg-gray-100 text-gray-500",
  };
  const cls = map[tipo] ?? "bg-gray-100 text-gray-500";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${cls} capitalize`}>{tipo}</span>;
}

export function VouchersTab() {
  const { perfil } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("voucher");
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [movRows, setMovRows] = useState<MovRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [liberarClienteId, setLiberarClienteId] = useState<string | null>(null);
  const [pctLiberar, setPctLiberar] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterNombre, setFilterNombre] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");

  const filteredVouchers = useMemo(() => {
    if (!filterNombre.trim()) return rows;
    const q = filterNombre.toLowerCase();
    return rows.filter((r) => r.cliente_nombre.toLowerCase().includes(q));
  }, [rows, filterNombre]);

  const filteredMov = useMemo(() => {
    let list = movRows;
    if (filterTipo) list = list.filter((r) => r.tipo === filterTipo);
    if (filterFechaDesde) list = list.filter((r) => r.fecha >= filterFechaDesde);
    if (filterFechaHasta) list = list.filter((r) => r.fecha.slice(0, 10) <= filterFechaHasta);
    if (filterNombre.trim()) {
      const q = filterNombre.toLowerCase();
      list = list.filter((r) => r.cliente_nombre.toLowerCase().includes(q));
    }
    return list;
  }, [movRows, filterTipo, filterFechaDesde, filterFechaHasta, filterNombre]);

  const loadVouchers = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("VouchersTab: Review Mode - Injecting mock vouchers");
      setRows([
        { id: "v-1", id_cliente: "cl-1", valor_total_generado: 25000.00, valor_total_liberado: 5000.00, valor_restante: 20000.00, cliente_nombre: "Fazenda Santa Maria" },
        { id: "v-2", id_cliente: "cl-2", valor_total_generado: 12000.00, valor_total_liberado: 0, valor_restante: 12000.00, cliente_nombre: "Agroindustrial Los Abuelos" }
      ]);
      return;
    }

    const { data, error } = await supabase.from("vouchers").select("id, id_cliente, valor_total_generado, valor_total_liberado, valor_restante").order("valor_restante", { ascending: false });

    if (!error && data && data.length > 0) {
      const ids = (data as any[]).map((d) => d.id_cliente);
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: clientes } = await supabase.from("clientes").select("id, nombre").in("id", ids);
        if (clientes) names = Object.fromEntries((clientes as any[]).map((c) => [c.id, c.nombre]));
      }
      setRows((data as any[]).map((d) => ({ id: d.id, id_cliente: d.id_cliente, valor_total_generado: d.valor_total_generado ?? 0, valor_total_liberado: d.valor_total_liberado ?? 0, valor_restante: d.valor_restante ?? 0, cliente_nombre: names[d.id_cliente] ?? "" })));
    }
  };

  const loadMovimientos = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("VouchersTab: Review Mode - Injecting mock movements");
      setMovRows([
        { id: "m-1", fecha: new Date().toISOString(), cliente_nombre: "Fazenda Santa Maria", valor_generado: 2500, valor_liberado: 0, porcentaje_liberado: 0, tipo: "generado" },
        { id: "m-2", fecha: new Date().toISOString(), cliente_nombre: "Fazenda Santa Maria", valor_generado: 0, valor_liberado: 500, porcentaje_liberado: 20, tipo: "liberado" }
      ]);
      return;
    }

    const { data, error } = await supabase.from("movimiento_vouchers").select("id, id_cliente, fecha, valor_generado, valor_liberado, porcentaje_liberado, tipo").order("fecha", { ascending: false });

    if (!error && data && data.length > 0) {
      const ids = [...new Set((data as any[]).map((d) => d.id_cliente))];
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: clientes } = await supabase.from("clientes").select("id, nombre").in("id", ids);
        if (clientes) names = Object.fromEntries((clientes as any[]).map((c) => [c.id, c.nombre]));
      }
      setMovRows((data as any[]).map((d) => ({ id: d.id, fecha: d.fecha, cliente_nombre: names[d.id_cliente] ?? "", valor_generado: d.valor_generado, valor_liberado: d.valor_liberado, porcentaje_liberado: d.porcentaje_liberado, tipo: d.tipo })));
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadVouchers(), loadMovimientos()]);
      setLoading(false);
    };
    load();
  }, []);

  const confirmLiberar = async () => {
    if (!liberarClienteId || !pctLiberar) return;
    const pct = Number(pctLiberar);
    if (pct <= 0 || pct > 100) { alert("Porcentaje entre 1 y 100."); return; }
    setSaving(true);
    const row = rows.find((r) => r.id_cliente === liberarClienteId);
    if (!row) { setSaving(false); return; }
    const valorLiberado = Number(((row.valor_restante * pct) / 100).toFixed(2));
    const nuevoRestante = Number((row.valor_restante - valorLiberado).toFixed(2));
    const nuevoLiberado = Number((row.valor_total_liberado + valorLiberado).toFixed(2));
    await supabase.from("vouchers").update({ valor_total_liberado: nuevoLiberado, valor_restante: Math.max(0, nuevoRestante) }).eq("id_cliente", liberarClienteId);
    await supabase.from("movimiento_vouchers").insert({ id_voucher: row.id, id_cliente: liberarClienteId, valor_liberado: valorLiberado, porcentaje_liberado: pct, tipo: "liberado", id_usuario: perfil?.id });
    await loadVouchers(); await loadMovimientos();
    setLiberarClienteId(null); setPctLiberar(""); setSaving(false);
  };

  const exportMovCsv = () => {
    const cols = [{ key: "fecha", header: "Fecha" }, { key: "cliente_nombre", header: "Cliente" }, { key: "tipo", header: "Tipo" }, { key: "valor_generado", header: "Valor generado" }, { key: "valor_liberado", header: "Valor liberado" }, { key: "porcentaje_liberado", header: "% liberado" }];
    const csv = cols.map((c) => c.header).join(",") + "\n" + filteredMov.map((r) => cols.map((c) => { const v = (r as any)[c.key]; return c.key === "fecha" ? new Date(v).toLocaleString("es-PY") : v ?? ""; }).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `movimiento_vouchers_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Cargando vouchers...</div>;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {(["voucher", "movimiento"] as SubTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab === t ? "bg-white text-agro-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "voucher" ? "Vouchers" : "Movimientos"}
          </button>
        ))}
      </div>

      {/* ── Vouchers ── */}
      {subTab === "voucher" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Buscar cliente</label>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input type="text" className={inputCls + " pl-8"} placeholder="Nombre del cliente..." value={filterNombre} onChange={(e) => setFilterNombre(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Total generado (USD)</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Total liberado (USD)</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Restante (USD)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredVouchers.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatDecimal(r.valor_total_generado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-600">{formatDecimal(r.valor_total_liberado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">{formatDecimal(r.valor_restante)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={btnSmall + " text-gray-600 border-gray-200 hover:bg-gray-50 mr-1"} onClick={() => generarPdfVoucher(supabase, r.id, { userName: perfil?.nombre })}>
                        <i className="fas fa-file-pdf text-xs" />Exportar PDF
                      </button>
                      {r.valor_restante > 0 && (
                        <button type="button" className={btnSmall + " text-agro-primary border-agro-primary/20 hover:bg-agro-primary/5"} onClick={() => { setLiberarClienteId(r.id_cliente); setPctLiberar(""); }}>
                          <i className="fas fa-unlock-alt text-xs" />Liberar %
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVouchers.length === 0 && (
              <div className="py-12 text-center text-gray-400"><i className="fas fa-ticket-alt mb-2 text-2xl block" />No hay vouchers.</div>
            )}
          </div>

          {/* Modal Liberar */}
          {liberarClienteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Liberar porcentaje</h3>
                  <button onClick={() => setLiberarClienteId(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
                </div>
                <div className="p-6">
                  <label className={labelCls}>Porcentaje a liberar (%)</label>
                  <input type="number" step="0.01" min="0.01" max="100" className={inputCls} value={pctLiberar} onChange={(e) => setPctLiberar(e.target.value)} placeholder="Ej: 50" />
                  <p className="text-xs text-gray-400 mt-2">Se calculará el valor equivalente del saldo restante na moeda USD com 2 casas decimais.</p>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button type="button" className={btnSecondary} onClick={() => setLiberarClienteId(null)}>Cancelar</button>
                  <button type="button" className={btnPrimary} onClick={confirmLiberar} disabled={saving || !pctLiberar}>
                    {saving ? <><i className="fas fa-spinner fa-spin text-xs" />Guardando...</> : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Movimientos ── */}
      {subTab === "movimiento" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="generado">Generado</option>
                <option value="liberado">Liberado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Desde</label>
              <input type="date" className={inputCls} value={filterFechaDesde} onChange={(e) => setFilterFechaDesde(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Hasta</label>
              <input type="date" className={inputCls} value={filterFechaHasta} onChange={(e) => setFilterFechaHasta(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls}>Buscar cliente</label>
              <input type="text" className={inputCls} placeholder="Nombre..." value={filterNombre} onChange={(e) => setFilterNombre(e.target.value)} />
            </div>
            <button type="button" className={btnSecondary} onClick={exportMovCsv}>
              <i className="fas fa-download text-xs" />CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Generado</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Liberado</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">% Lib.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMov.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.fecha).toLocaleString("es-PY")}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                    <td className="px-4 py-3">{tipoBadge(r.tipo)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatDecimal(r.valor_generado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-600">{formatDecimal(r.valor_liberado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">{formatDecimal(r.porcentaje_liberado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMov.length === 0 && (
              <div className="py-12 text-center text-gray-400"><i className="fas fa-history mb-2 text-2xl block" />No hay movimientos en el período.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
