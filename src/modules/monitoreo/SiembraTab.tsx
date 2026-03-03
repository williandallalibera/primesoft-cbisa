import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { SiembraModal } from "./SiembraModal";
import { generarPdfSiembra } from "./pdfSiembra";

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
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

export function SiembraTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<SiembraRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [parcelas, setParcelas] = useState<{ id: string; nombre_parcela: string }[]>([]);
  const [zafras, setZafras] = useState<{ id: string; nombre_zafra: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterParcela, setFilterParcela] = useState("");
  const [filterZafra, setFilterZafra] = useState("");
  const [modalSiembra, setModalSiembra] = useState<{ siembraId: string; monitoreo: { id: string; id_cliente: string; id_parcela: string; id_zafra: string; hectares: number | null; cliente_nombre: string; parcela_nombre: string; zafra_nombre: string }; areaHa: number | null } | null>(null);

  const loadRows = async () => {
    setLoading(true);
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
    const { data: mon } = await supabase.from("monitoreos").select("id, id_cliente, id_parcela, id_zafra, hectares").in("id", monIds);
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

  if (loading) return <span>Cargando siembras...</span>;

  return (
    <div>
      <h5 className="mb-3">Siembra</h5>
      <div className="row mb-3">
        <div className="col-md-3">
          <label className="form-label">Cliente</label>
          <select
            className="form-control form-control-sm"
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Parcela</label>
          <select
            className="form-control form-control-sm"
            value={filterParcela}
            onChange={(e) => setFilterParcela(e.target.value)}
          >
            <option value="">Todas</option>
            {parcelas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_parcela}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Zafra</label>
          <select
            className="form-control form-control-sm"
            value={filterZafra}
            onChange={(e) => setFilterZafra(e.target.value)}
          >
            <option value="">Todas</option>
            {zafras.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre_zafra}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped">
          <thead className="thead-dark">
            <tr>
              <th>Cliente</th>
              <th>Parcela</th>
              <th>Zafra</th>
              <th>Fecha inicio</th>
              <th>Fecha término</th>
              <th>Costo total</th>
              <th>Costo/ha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.cliente_nombre}</td>
                <td>{r.parcela_nombre}</td>
                <td>{r.zafra_nombre}</td>
                <td>{r.fecha_inicio ?? "-"}</td>
                <td>{r.fecha_termino ?? "-"}</td>
                <td>{formatDecimal(r.costo_total)}</td>
                <td>{formatDecimal(r.costo_ha)}</td>
                <td>
                  <button type="button" className="btn btn-xs btn-outline-primary mr-1" onClick={() => setModalSiembra({ siembraId: r.id, monitoreo: { id: r.id_monitoreo, id_cliente: r.id_cliente, id_parcela: r.id_parcela, id_zafra: r.id_zafra, hectares: r.hectares, cliente_nombre: r.cliente_nombre, parcela_nombre: r.parcela_nombre, zafra_nombre: r.zafra_nombre }, areaHa: r.hectares })}>
                    Ver detalle
                  </button>
                  <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => generarPdfSiembra(supabase, r.id)}>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalSiembra && (
        <SiembraModal
          monitoreo={modalSiembra.monitoreo}
          siembraId={modalSiembra.siembraId}
          areaHa={modalSiembra.areaHa}
          onClose={() => setModalSiembra(null)}
          onSaved={() => { loadRows(); setModalSiembra(null); }}
        />
      )}
    </div>
  );
}
