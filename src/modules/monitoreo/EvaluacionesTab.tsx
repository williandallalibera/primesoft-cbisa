import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { EvaluacionModal } from "./EvaluacionModal";
import { generarPdfEvaluacion } from "./pdfEvaluacion";

interface EvalRow {
  id: string;
  id_cliente: string;
  fecha_evaluacion: string;
  fecha_proxima_evaluacion: string | null;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
}

export function EvaluacionesTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState("");
  const [modalEvaluacionId, setModalEvaluacionId] = useState<string | null>(null);

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
        .from("evaluaciones")
        .select("id, fecha_evaluacion, fecha_proxima_evaluacion, id_monitoreo")
        .order("created_at", { ascending: false });
      if (error || !data) {
        setLoading(false);
        return;
      }
      const monIds = (data as any[]).map((d) => d.id_monitoreo);
      const { data: mon } = await supabase.from("monitoreos").select("id, id_cliente, id_parcela, id_zafra").in("id", monIds);
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
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, [perfil?.id, perfil?.perfil_acceso]);

  const filtered = useMemo(() => {
    if (!filterCliente) return rows;
    return rows.filter((r) => r.id_cliente === filterCliente);
  }, [rows, filterCliente]);

  if (loading) return <span>Cargando evaluaciones...</span>;

  return (
    <div>
      <h5 className="mb-3">Evaluaciones</h5>
      <div className="row mb-3">
        <div className="col-md-4">
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
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped">
          <thead className="thead-dark">
            <tr>
              <th>Cliente</th>
              <th>Parcela</th>
              <th>Zafra</th>
              <th>Fecha evaluación</th>
              <th>Fecha próxima</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.cliente_nombre}</td>
                <td>{r.parcela_nombre}</td>
                <td>{r.zafra_nombre}</td>
                <td>{r.fecha_evaluacion}</td>
                <td>{r.fecha_proxima_evaluacion ?? "-"}</td>
                <td>
                  <button type="button" className="btn btn-xs btn-outline-primary mr-1" onClick={() => setModalEvaluacionId(r.id)}>
                    Ver detalle
                  </button>
                  <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => generarPdfEvaluacion(supabase, r.id)}>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalEvaluacionId && (
        <EvaluacionModal
          evaluacionId={modalEvaluacionId}
          monitoreo={null}
          onClose={() => setModalEvaluacionId(null)}
          onSaved={() => { loadRows(); setModalEvaluacionId(null); }}
        />
      )}
    </div>
  );
}
