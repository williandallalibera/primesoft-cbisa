import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";

interface EvalRow {
  id: string;
  fecha_evaluacion: string;
  fecha_proxima_evaluacion: string | null;
  cliente_nombre: string;
  parcela_nombre: string;
}

const today = new Date().toISOString().slice(0, 10);

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function VisitasTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      if (isReviewMode) {
        console.log("VisitasTab: Review Mode - Injecting mock visitas");
        setRows([
          { id: "v-1", fecha_evaluacion: today, fecha_proxima_evaluacion: today, cliente_nombre: "Fazenda Boa Vista", parcela_nombre: "Lote 2" },
          { id: "v-2", fecha_evaluacion: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10), fecha_proxima_evaluacion: new Date(Date.now() + 86400000).toISOString().slice(0, 10), cliente_nombre: "Agropecuaria Central", parcela_nombre: "Pivot 1" }
        ]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("evaluaciones")
        .select("id, fecha_evaluacion, fecha_proxima_evaluacion, id_monitoreo")
        .order("fecha_proxima_evaluacion", { ascending: true });

      if (error || !data) { setLoading(false); return; }

      let monIds = [...new Set((data as any[]).map((d) => d.id_monitoreo).filter(Boolean))];

      let monMap: Record<string, { id_cliente: string; id_parcela: string }> = {};
      if (monIds.length > 0) {
        let monQuery = supabase.from("monitoreos").select("id, id_cliente, id_parcela");

        if (perfil?.perfil_acceso === "rtv") {
          const { data: clientesRtv } = await supabase
            .from("clientes")
            .select("id")
            .eq("id_vendedor", perfil.id);
          const clienteIds = (clientesRtv ?? []).map((c: { id: string }) => c.id);
          if (!clienteIds.length) {
            setRows([]);
            setLoading(false);
            return;
          }
          monQuery = monQuery.in("id_cliente", clienteIds);
        }

        const { data: mon } = await monQuery.in("id", monIds);
        if (mon) monMap = Object.fromEntries((mon as any[]).map((m) => [m.id, { id_cliente: m.id_cliente, id_parcela: m.id_parcela }]));
      }

      const clienteIds = [...new Set(Object.values(monMap).map((v) => v.id_cliente))];
      const parcelaIds = [...new Set(Object.values(monMap).map((v) => v.id_parcela))];
      let clientes: Record<string, string> = {};
      let parcelas: Record<string, string> = {};

      if (clienteIds.length > 0) {
        const { data: c } = await supabase.from("clientes").select("id, nombre").in("id", clienteIds);
        if (c) clientes = Object.fromEntries((c as any[]).map((x) => [x.id, x.nombre]));
      }
      if (parcelaIds.length > 0) {
        const { data: p } = await supabase.from("parcelas").select("id, nombre_parcela").in("id", parcelaIds);
        if (p) parcelas = Object.fromEntries((p as any[]).map((x) => [x.id, x.nombre_parcela]));
      }

      setRows(
        (data as any[]).map((d) => {
          const m = monMap[d.id_monitoreo];
          return {
            id: d.id, fecha_evaluacion: d.fecha_evaluacion,
            fecha_proxima_evaluacion: d.fecha_proxima_evaluacion,
            cliente_nombre: m ? clientes[m.id_cliente] ?? "" : "",
            parcela_nombre: m ? parcelas[m.id_parcela] ?? "" : "",
          };
        })
      );
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const prox = r.fecha_proxima_evaluacion ?? "";
      return prox >= fechaDesde && prox <= fechaHasta;
    });
  }, [rows, fechaDesde, fechaHasta]);

  const isToday = (d: string) => d === today;
  const isPast = (d: string) => d < today;

  const exportCsv = () => {
    const csv = "Fecha evaluación,Fecha próxima,Cliente,Parcela\n" + filtered.map((r) => `${r.fecha_evaluacion},${r.fecha_proxima_evaluacion ?? ""},${r.cliente_nombre},${r.parcela_nombre}`).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `visitas_${fechaDesde}_${fechaHasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando evaluaciones...
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div>
          <label className={labelCls}>Desde</label>
          <input type="date" className={inputCls} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Hasta</label>
          <input type="date" className={inputCls} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <button type="button" className={btnSecondary} onClick={exportCsv}>
          <i className="fas fa-download text-xs" />CSV
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        <i className="fas fa-info-circle mr-1" />
        Muestra evaluaciones cuya próxima visita cae en el período seleccionado.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha evaluación</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Próxima visita</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Parcela</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => {
              const prox = r.fecha_proxima_evaluacion ?? "";
              const rowCls = isPast(prox) ? "bg-red-50/50" : isToday(prox) ? "bg-amber-50/50" : "";
              return (
                <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${rowCls}`}>
                  <td className="px-4 py-3 text-gray-700">{r.fecha_evaluacion}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isPast(prox) ? "text-red-600" : isToday(prox) ? "text-amber-600" : "text-gray-700"}`}>
                      {prox || "—"}
                      {isPast(prox) && <span className="ml-2 text-xs text-red-400">(vencida)</span>}
                      {isToday(prox) && <span className="ml-2 text-xs text-amber-500">(hoy)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{r.parcela_nombre}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-calendar-times mb-2 text-2xl block" />No hay evaluaciones en el período seleccionado.
          </div>
        )}
      </div>
    </div>
  );
}
