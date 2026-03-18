import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { RteModal } from "./RteModal";
import { SearchSelect } from "../common/SearchSelect";
import { generarPdfRte } from "./pdfRte";

interface RteRow {
    id: string;
    id_monitoreo: string;
    id_cliente: string;
    concluido: boolean;
    costo_total: number | null;
    ingreso_total: number | null;
    resultado_tecnico: number | null;
    cliente_nombre: string;
    parcela_nombre: string;
    zafra_nombre: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";

export function RteTab() {
    const { perfil } = useAuth();
    const [rows, setRows] = useState<RteRow[]>([]);
    const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCliente, setFilterCliente] = useState("");
    const [gettingPdf, setGettingPdf] = useState<string | null>(null);
    const [modalRte, setModalRte] = useState<{ rteId: string; monitoreo: { id: string; id_cliente: string; id_parcela: string; id_zafra: string; hectares: number | null; concluido: boolean; cliente_nombre: string; parcela_nombre: string; zafra_nombre: string } } | null>(null);

    const loadRows = async () => {
        setLoading(true);
        const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
        if (isReviewMode) {
            setRows([
                { id: "r-3", id_monitoreo: "m-3", id_cliente: "cl-2", concluido: false, costo_total: 288600, ingreso_total: 252890, resultado_tecnico: -35710, cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025" },
                { id: "r-4", id_monitoreo: "m-4", id_cliente: "cl-3", concluido: false, costo_total: 52154.4, ingreso_total: 46754.4, resultado_tecnico: -5400, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz" },
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
            .from("rte")
            .select("id, costo_total, ingreso_total, resultado_tecnico, id_monitoreo")
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
                concluido: m?.concluido ?? false,
                costo_total: d.costo_total,
                ingreso_total: d.ingreso_total,
                resultado_tecnico: d.resultado_tecnico,
                id_cliente: m?.id_cliente ?? "",
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
        await generarPdfRte(supabase, id, { userName: perfil?.nombre });
        setGettingPdf(null);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16 text-gray-400">
            <i className="fas fa-spinner fa-spin mr-2" />Cargando resultados...
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
                            <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Costo Total</th>
                            <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Ingreso Total</th>
                            <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">RTE</th>
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
                                <td className="px-4 py-3 text-right font-mono text-red-600">-${formatDecimal(r.costo_total)}</td>
                                <td className="px-4 py-3 text-right font-mono text-emerald-600">+${formatDecimal(r.ingreso_total)}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">${formatDecimal(r.resultado_tecnico)}</td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button
                                        type="button"
                                        className="text-xs font-bold text-agro-primary hover:underline"
                                        onClick={() => setModalRte({ rteId: r.id, monitoreo: { id: r.id_monitoreo, id_cliente: r.id_cliente, id_parcela: "", id_zafra: "", hectares: null, concluido: r.concluido, cliente_nombre: r.cliente_nombre, parcela_nombre: r.parcela_nombre, zafra_nombre: r.zafra_nombre } })}
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
                        <i className="fas fa-file-invoice-dollar mb-2 text-2xl block" />
                        No hay registros técnicos.
                    </div>
                )}
            </div>

            {modalRte && (
                <RteModal
                    rteId={modalRte.rteId}
                    monitoreo={modalRte.monitoreo}
                    onClose={() => setModalRte(null)}
                    readOnly={modalRte.monitoreo.concluido}
                    onSaved={() => { loadRows(); setModalRte(null); }}
                />
            )}
        </div>
    );
}
