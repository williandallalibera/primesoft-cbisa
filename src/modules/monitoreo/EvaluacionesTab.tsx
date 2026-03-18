import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { EvaluacionModal } from "./EvaluacionModal";
import { generarPdfEvaluacion } from "./pdfEvaluacion";
import { SearchSelect } from "../common/SearchSelect";

interface EvalRow {
  id: string;
  id_cliente: string;
  concluido: boolean;
  fecha_evaluacion: string;
  fecha_proxima_evaluacion: string | null;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";

export function EvaluacionesTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState("");
  const [gettingPdf, setGettingPdf] = useState<string | null>(null);
  const [modalEvaluacion, setModalEvaluacion] = useState<{ evaluacionId: string; concluido: boolean } | null>(null);

  const loadRows = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setRows([
        { id: "e-2a", id_cliente: "cl-1", concluido: false, fecha_evaluacion: "2024-11-05", fecha_proxima_evaluacion: "2024-11-20", cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
        { id: "e-2b", id_cliente: "cl-1", concluido: false, fecha_evaluacion: "2024-11-25", fecha_proxima_evaluacion: "2024-12-10", cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
        { id: "e-3", id_cliente: "cl-2", concluido: false, fecha_evaluacion: "2024-12-01", fecha_proxima_evaluacion: null, cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025" },
        { id: "e-4", id_cliente: "cl-3", concluido: false, fecha_evaluacion: "2024-09-15", fecha_proxima_evaluacion: null, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz" },
      ]);
      setClientes([
        { id: "cl-1", nombre: "Fazenda Santa María" },
        { id: "cl-2", nombre: "Estancia San José" },
        { id: "cl-3", nombre: "Agropecuaria El Progreso" },
      ]);
      setLoading(false);
      return;
    }

    let rtvClientIds: string[] = [];
    if (perfil?.perfil_acceso === "rtv") {
      const { data: clientesRtv } = await supabase.from("clientes").select("id").eq("id_vendedor", perfil.id);
      rtvClientIds = (clientesRtv ?? []).map((c: { id: string }) => c.id);
      if (rtvClientIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
    }
    const { data, error } = await supabase
      .from("evaluaciones")
      .select("id, fecha_evaluacion, fecha_proxima_evaluacion, id_monitoreo")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }
    const monIds = (data as any[]).map((d) => d.id_monitoreo);
    const { data: mon } = await supabase.from("monitoreos").select("id, id_cliente, id_parcela, id_zafra, concluido").in("id", monIds);
    if (!mon?.length) {
      setLoading(false);
      return;
    }
    const cIds = [...new Set((mon as any[]).map((m) => m.id_cliente))];
    const [cRes, pRes, zRes] = await Promise.all([
      supabase.from("clientes").select("id, nombre").in("id", cIds),
      supabase.from("parcelas").select("id, nombre_parcela").in("id", (mon as any[]).map((m) => m.id_parcela)),
      supabase.from("zafras").select("id, nombre_zafra").in("id", (mon as any[]).map((m) => m.id_zafra)),
    ]);

    const cMap: Record<string, string> = Object.fromEntries((cRes.data as any[])?.map((x) => [x.id, x.nombre]) ?? []);
    const pMap: Record<string, string> = Object.fromEntries((pRes.data as any[])?.map((x) => [x.id, x.nombre_parcela]) ?? []);
    const zMap: Record<string, string> = Object.fromEntries((zRes.data as any[])?.map((x) => [x.id, x.nombre_zafra]) ?? []);
    const monMap: Record<string, any> = Object.fromEntries((mon as any[]).map((m) => [m.id, m]));

    let list = (data as any[]).map((d) => {
      const m = monMap[d.id_monitoreo];
      return {
        id: d.id,
        id_cliente: m?.id_cliente ?? "",
        concluido: m?.concluido ?? false,
        fecha_evaluacion: d.fecha_evaluacion,
        fecha_proxima_evaluacion: d.fecha_proxima_evaluacion,
        cliente_nombre: m ? cMap[m.id_cliente] ?? "" : "",
        parcela_nombre: m ? pMap[m.id_parcela] ?? "" : "",
        zafra_nombre: m ? zMap[m.id_zafra] ?? "" : "",
      };
    });

    if (rtvClientIds.length > 0) {
      list = list.filter((r) => r.id_cliente && rtvClientIds.includes(r.id_cliente));
      setClientes(((cRes.data as any[]) ?? []).filter((c: { id: string }) => rtvClientIds.includes(c.id)));
    } else if (cRes.data) setClientes(cRes.data as any);

    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, [perfil?.id, perfil?.perfil_acceso]);

  const filtered = useMemo(() => {
    if (!filterCliente) return rows;
    return rows.filter((r) => r.id_cliente === filterCliente);
  }, [rows, filterCliente]);

  const handlePdf = async (id: string) => {
    setGettingPdf(id);
    await generarPdfEvaluacion(supabase, id, { userName: perfil?.nombre });
    setGettingPdf(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando evaluaciones...
    </div>
  );

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="min-w-[200px]">
          <label className={labelCls}>Filtrar por Cliente</label>
          <SearchSelect
            items={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
            value={filterCliente}
            onChange={setFilterCliente}
            allLabel="Todos os clientes"
            className={inputCls}
            placeholder="Buscar cliente..."
          />
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente / Parcela</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Zafra</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Evaluación</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Próxima Visita</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{r.cliente_nombre}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{r.parcela_nombre}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.zafra_nombre}</td>
                <td className="px-4 py-3 text-gray-500 font-medium">
                  {r.fecha_evaluacion ? new Date(r.fecha_evaluacion).toLocaleDateString("es-PY") : "-"}
                </td>
                <td className="px-4 py-3 text-agro-primary font-bold">
                  {r.fecha_proxima_evaluacion ? new Date(r.fecha_proxima_evaluacion).toLocaleDateString("es-PY") : "-"}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    className="text-xs font-bold text-agro-primary hover:underline"
                    onClick={() => setModalEvaluacion({ evaluacionId: r.id, concluido: r.concluido })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    onClick={() => handlePdf(r.id)}
                    disabled={gettingPdf === r.id}
                  >
                    {gettingPdf === r.id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-pdf" />} PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-clipboard-check mb-2 text-2xl block" />
            No hay evaluaciones registradas.
          </div>
        )}
      </div>

      {modalEvaluacion && (
        <EvaluacionModal
          evaluacionId={modalEvaluacion.evaluacionId}
          monitoreo={null}
          onClose={() => setModalEvaluacion(null)}
          readOnly={modalEvaluacion.concluido}
          onSaved={() => { loadRows(); setModalEvaluacion(null); }}
        />
      )}
    </div>
  );
}
