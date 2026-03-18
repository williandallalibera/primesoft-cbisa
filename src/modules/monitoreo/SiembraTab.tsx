import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { SiembraModal } from "./SiembraModal";
import { generarPdfSiembra } from "./pdfSiembra";
import { SearchSelect } from "../common/SearchSelect";

interface SiembraRow {
  id: string;
  id_monitoreo: string;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  costo_total: number | null;
  costo_ha: number | null;
  id_cliente: string;
  id_parcela: string;
  id_zafra: string;
  hectares: number | null;
  concluido: boolean;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function SiembraTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<SiembraRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [parcelas, setParcelas] = useState<{ id: string; nombre_parcela: string }[]>([]);
  const [zafras, setZafras] = useState<{ id: string; nombre_zafra: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterParcela, setFilterParcela] = useState("");
  const [getingPdf, setGettingPdf] = useState<string | null>(null);
  const [filterZafra, setFilterZafra] = useState("");
  const [modalSiembra, setModalSiembra] = useState<{ siembraId: string; monitoreo: { id: string; id_cliente: string; id_parcela: string; id_zafra: string; hectares: number | null; concluido: boolean; cliente_nombre: string; parcela_nombre: string; zafra_nombre: string }; areaHa: number | null } | null>(null);

  const loadRows = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setRows([
        { id: "s-2", id_monitoreo: "m-2", fecha_inicio: "2024-10-05", fecha_termino: "2024-10-20", costo_total: 10200, costo_ha: 120, id_cliente: "cl-1", id_parcela: "pa-2", id_zafra: "z-1", hectares: 85, concluido: false, cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025" },
        { id: "s-3", id_monitoreo: "m-3", fecha_inicio: "2024-09-15", fecha_termino: "2024-10-01", costo_total: 24000, costo_ha: 120, id_cliente: "cl-2", id_parcela: "pa-3", id_zafra: "z-1", hectares: 200, concluido: false, cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025" },
        { id: "s-4", id_monitoreo: "m-4", fecha_inicio: "2024-08-20", fecha_termino: "2024-09-05", costo_total: 5400, costo_ha: 120, id_cliente: "cl-3", id_parcela: "pa-4", id_zafra: "z-2", hectares: 45, concluido: false, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz" },
      ]);
      setClientes([
        { id: "cl-1", nombre: "Fazenda Santa María" },
        { id: "cl-2", nombre: "Estancia San José" },
        { id: "cl-3", nombre: "Agropecuaria El Progreso" },
      ]);
      setParcelas([
        { id: "pa-1", nombre_parcela: "Lote Norte" },
        { id: "pa-2", nombre_parcela: "Lote Sur" },
        { id: "pa-3", nombre_parcela: "Campo 1" },
        { id: "pa-4", nombre_parcela: "Chacra Central" },
      ]);
      setZafras([
        { id: "z-1", nombre_zafra: "Zafra 2024/2025" },
        { id: "z-2", nombre_zafra: "Zafra 2024/2025 Maíz" },
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
      .from("siembra")
      .select("id, fecha_inicio, fecha_termino, costo_total, costo_ha, id_monitoreo")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }
    const monIds = (data as any[]).map((d) => d.id_monitoreo);
    const { data: mon } = await supabase.from("monitoreos").select("id, id_cliente, id_parcela, id_zafra, hectares, concluido").in("id", monIds);
    if (!mon?.length) {
      setLoading(false);
      return;
    }
    const cIds = [...new Set((mon as any[]).map((m) => m.id_cliente))];
    const pIds = [...new Set((mon as any[]).map((m) => m.id_parcela))];
    const zIds = [...new Set((mon as any[]).map((m) => m.id_zafra))];

    const [cRes, pRes, zRes] = await Promise.all([
      supabase.from("clientes").select("id, nombre").in("id", cIds),
      supabase.from("parcelas").select("id, nombre_parcela").in("id", pIds),
      supabase.from("zafras").select("id, nombre_zafra").in("id", zIds),
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
        fecha_inicio: d.fecha_inicio,
        fecha_termino: d.fecha_termino,
        costo_total: d.costo_total,
        costo_ha: d.costo_ha,
        id_cliente: m?.id_cliente ?? "",
        id_parcela: m?.id_parcela ?? "",
        id_zafra: m?.id_zafra ?? "",
        hectares: m?.hectares ?? null,
        concluido: m?.concluido ?? false,
        cliente_nombre: m ? cMap[m.id_cliente] ?? "" : "",
        parcela_nombre: m ? pMap[m.id_parcela] ?? "" : "",
        zafra_nombre: m ? zMap[m.id_zafra] ?? "" : "",
      };
    });

    if (rtvClientIds.length > 0) {
      list = list.filter((r) => r.id_cliente && rtvClientIds.includes(r.id_cliente));
      setClientes(((cRes.data as any[]) ?? []).filter((c: { id: string }) => rtvClientIds.includes(c.id)));
    } else if (cRes.data) setClientes(cRes.data as any);

    const [pR, zR] = await Promise.all([
      supabase.from("parcelas").select("id, nombre_parcela"),
      supabase.from("zafras").select("id, nombre_zafra"),
    ]);
    if (pR.data) setParcelas(pR.data as any);
    if (zR.data) setZafras(zR.data as any);
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, [perfil?.id, perfil?.perfil_acceso]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterCliente) list = list.filter((r) => r.id_cliente === filterCliente);
    if (filterParcela) list = list.filter((r) => r.id_parcela === filterParcela);
    if (filterZafra) list = list.filter((r) => r.id_zafra === filterZafra);
    return list;
  }, [rows, filterCliente, filterParcela, filterZafra]);

  const handlePdf = async (id: string) => {
    setGettingPdf(id);
    await generarPdfSiembra(supabase, id, { userName: perfil?.nombre });
    setGettingPdf(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando siembras...
    </div>
  );

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="min-w-[150px]">
          <label className={labelCls}>Cliente</label>
          <SearchSelect
            items={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
            value={filterCliente}
            onChange={setFilterCliente}
            allLabel="Todos"
            className={inputCls}
            placeholder="Buscar cliente..."
          />
        </div>
        <div className="min-w-[150px]">
          <label className={labelCls}>Parcela</label>
          <select
            className={inputCls}
            value={filterParcela}
            onChange={(e) => setFilterParcela(e.target.value)}
          >
            <option value="">Todas</option>
            {parcelas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_parcela}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className={labelCls}>Zafra</label>
          <select
            className={inputCls}
            value={filterZafra}
            onChange={(e) => setFilterZafra(e.target.value)}
          >
            <option value="">Todas</option>
            {zafras.map((z) => (
              <option key={z.id} value={z.id}>{z.nombre_zafra}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente / Parcela</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Zafra</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fechas</th>
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
                <td className="px-4 py-3">
                  <div className="text-[10px] text-gray-500"><span className="font-bold">INICIO:</span> {r.fecha_inicio ?? "-"}</div>
                  <div className="text-[10px] text-gray-500"><span className="font-bold">FIN:</span> {r.fecha_termino ?? "-"}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-agro-primary">${formatDecimal(r.costo_total)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">${formatDecimal(r.costo_ha)}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    className="text-xs font-bold text-agro-primary hover:underline"
                    onClick={() => setModalSiembra({ siembraId: r.id, monitoreo: { id: r.id_monitoreo, id_cliente: r.id_cliente, id_parcela: r.id_parcela, id_zafra: r.id_zafra, hectares: r.hectares, concluido: r.concluido, cliente_nombre: r.cliente_nombre, parcela_nombre: r.parcela_nombre, zafra_nombre: r.zafra_nombre }, areaHa: r.hectares })}
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
            <i className="fas fa-seedling mb-2 text-2xl block" />
            No hay siembras registradas.
          </div>
        )}
      </div>

      {modalSiembra && (
        <SiembraModal
          monitoreo={modalSiembra.monitoreo}
          siembraId={modalSiembra.siembraId}
          areaHa={modalSiembra.areaHa}
          onClose={() => setModalSiembra(null)}
          readOnly={modalSiembra.monitoreo.concluido}
          onSaved={() => { loadRows(); setModalSiembra(null); }}
        />
      )}
    </div>
  );
}
