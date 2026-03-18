import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { AplicacionModal } from "./AplicacionModal";
import { generarPdfAplicacion } from "./pdfAplicacion";
import { SearchSelect } from "../common/SearchSelect";

interface AplicacionRow {
  id: string;
  id_monitoreo: string;
  id_cliente: string;
  concluido: boolean;
  fecha_aplicacion: string | null;
  costo_total: number | null;
  costo_ha: number | null;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function AplicacionesTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<AplicacionRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState("");
  const [getingPdf, setGettingPdf] = useState<string | null>(null);
  const [modalAplicacion, setModalAplicacion] = useState<{ aplicacionId: string; concluido: boolean } | null>(null);

  const loadRows = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setRows([
        { id: "a-2a", id_monitoreo: "m-2", id_cliente: "cl-1", concluido: false, fecha_aplicacion: "2024-11-10", costo_total: 1275, costo_ha: 15, cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
        { id: "a-2b", id_monitoreo: "m-2", id_cliente: "cl-1", concluido: false, fecha_aplicacion: "2024-11-25", costo_total: 980, costo_ha: 14, cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
        { id: "a-3", id_monitoreo: "m-3", id_cliente: "cl-2", concluido: false, fecha_aplicacion: "2024-11-20", costo_total: 3600, costo_ha: 18, cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025" },
        { id: "a-4", id_monitoreo: "m-4", id_cliente: "cl-3", concluido: false, fecha_aplicacion: "2024-10-25", costo_total: 540, costo_ha: 12, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz" },
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
      .from("aplicaciones")
      .select("id, fecha_aplicacion, costo_total, costo_ha, id_monitoreo")
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
        id_monitoreo: d.id_monitoreo,
        id_cliente: m?.id_cliente ?? "",
        concluido: m?.concluido ?? false,
        fecha_aplicacion: d.fecha_aplicacion,
        costo_total: d.costo_total,
        costo_ha: d.costo_ha,
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
    await generarPdfAplicacion(supabase, id, { userName: perfil?.nombre });
    setGettingPdf(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando aplicaciones...
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
            allLabel="Todos los clientes"
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
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-right">Costo Total</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-right">Costo/ha</th>
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
                  {r.fecha_aplicacion ? new Date(r.fecha_aplicacion).toLocaleDateString("es-PY") : "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-agro-primary">${formatDecimal(r.costo_total)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">${formatDecimal(r.costo_ha)}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    className="text-xs font-bold text-agro-primary hover:underline"
                    onClick={() => setModalAplicacion({ aplicacionId: r.id, concluido: r.concluido })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    onClick={() => handlePdf(r.id)}
                    disabled={getingPdf === r.id}
                  >
                    {getingPdf === r.id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-pdf" />} PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-spray-can mb-2 text-2xl block" />
            No hay aplicaciones registradas.
          </div>
        )}
      </div>

      {modalAplicacion && (
        <AplicacionModal
          aplicacionId={modalAplicacion.aplicacionId}
          monitoreo={null}
          areaHa={null}
          onClose={() => setModalAplicacion(null)}
          readOnly={modalAplicacion.concluido}
          onSaved={() => { loadRows(); setModalAplicacion(null); }}
        />
      )}
    </div>
  );
}
