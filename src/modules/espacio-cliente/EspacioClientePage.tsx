import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";

interface Resumen {
  parcelas: { id: string; nombre_parcela: string; localidad: string | null; area_real_ha: number | null }[];
  propuestas: { id: string; fecha: string; total_general: number | null; tipo: string }[];
  monitoreos: { id: string; parcela_nombre: string; zafra_nombre: string; concluido: boolean }[];
  evaluacionesProximas: { fecha_proxima_evaluacion: string; parcela_nombre: string }[];
}

export function EspacioClientePage() {
  const { perfil } = useAuth();
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!perfil?.id) {
        setLoading(false);
        return;
      }
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("id_usuario_auth", perfil.id)
        .maybeSingle();
      const cid = (cliente as any)?.id ?? null;
      setClienteId(cid);
      if (!cid) {
        setLoading(false);
        return;
      }
      const [parcelasRes, propuestasRes, monitoreosRes, evaluacionesRes] = await Promise.all([
        supabase.from("parcelas").select("id, nombre_parcela, localidad, area_real_ha").eq("id_cliente", cid).eq("estado", "activo").order("nombre_parcela"),
        supabase.from("propuestas").select("id, fecha, total_general, id_tipo_propuesta").eq("id_cliente", cid).order("fecha", { ascending: false }).limit(20),
        supabase.from("monitoreos").select("id, id_parcela, id_zafra, concluido").eq("id_cliente", cid).order("created_at", { ascending: false }),
        supabase.from("evaluaciones").select("id_monitoreo, fecha_proxima_evaluacion").gte("fecha_proxima_evaluacion", new Date().toISOString().slice(0, 10)).order("fecha_proxima_evaluacion").limit(20),
      ]);
      const parcelas = (parcelasRes.data ?? []) as any[];
      const propuestas = (propuestasRes.data ?? []) as any[];
      const monitoreosRaw = (monitoreosRes.data ?? []) as any[];
      const evaluacionesRaw = (evaluacionesRes.data ?? []) as any[];

      const pIds = [...new Set(monitoreosRaw.map((m) => m.id_parcela))];
      const zIds = [...new Set(monitoreosRaw.map((m) => m.id_zafra))];
      const monIds = evaluacionesRaw.map((e) => e.id_monitoreo);
      let pMap: Record<string, string> = {};
      let zMap: Record<string, string> = {};
      let monMap: Record<string, { id_parcela: string }> = {};
      if (pIds.length) {
        const { data: p } = await supabase.from("parcelas").select("id, nombre_parcela").in("id", pIds);
        if (p) pMap = Object.fromEntries((p as any[]).map((x) => [x.id, x.nombre_parcela]));
      }
      if (zIds.length) {
        const { data: z } = await supabase.from("zafras").select("id, nombre_zafra").in("id", zIds);
        if (z) zMap = Object.fromEntries((z as any[]).map((x) => [x.id, x.nombre_zafra]));
      }
      if (monIds.length) {
        const { data: mon } = await supabase.from("monitoreos").select("id, id_parcela").in("id", monIds);
        if (mon) monMap = Object.fromEntries((mon as any[]).map((m) => [m.id, { id_parcela: m.id_parcela }]));
      }

      const tipoMap: Record<string, string> = {};
      const tipoIds = [...new Set(propuestas.map((p) => p.id_tipo_propuesta).filter(Boolean))];
      if (tipoIds.length) {
        const { data: t } = await supabase.from("tipo_propuesta").select("id, codigo").in("id", tipoIds);
        if (t) Object.assign(tipoMap, Object.fromEntries((t as any[]).map((x) => [x.id, x.codigo === "venta" ? "Venta" : "Presupuesto"])));
      }

      setResumen({
        parcelas,
        propuestas: propuestas.map((p) => ({
          id: p.id,
          fecha: p.fecha,
          total_general: p.total_general,
          tipo: p.id_tipo_propuesta ? tipoMap[p.id_tipo_propuesta] ?? "" : "",
        })),
        monitoreos: monitoreosRaw.map((m) => ({
          id: m.id,
          parcela_nombre: pMap[m.id_parcela] ?? "",
          zafra_nombre: zMap[m.id_zafra] ?? "",
          concluido: m.concluido ?? false,
        })),
        evaluacionesProximas: evaluacionesRaw.map((e) => ({
          fecha_proxima_evaluacion: e.fecha_proxima_evaluacion,
          parcela_nombre: monMap[e.id_monitoreo] ? pMap[monMap[e.id_monitoreo].id_parcela] ?? "" : "",
        })),
      });
      setLoading(false);
    };
    load();
  }, [perfil?.id]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400 italic">
        <i className="fas fa-circle-notch fa-spin mr-2"></i>
        Cargando su espacio...
      </div>
    );
  }

  if (!clienteId) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center gap-3">
          <i className="fas fa-info-circle text-blue-500"></i>
          <span className="font-semibold">No se encontró un cliente asociado a su usuario. Contacte al administrador.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-6 py-4">
          <h3 className="text-lg font-bold text-white mb-0">Espacio del Cliente</h3>
        </div>

        <div className="p-6 space-y-8">
          <p className="text-gray-500 font-medium">
            Aquí puede acompañar sus parcelas, propuestas, monitoreos y próximas visitas.
          </p>

          <section>
            <h5 className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-3 mb-4 font-bold tracking-tight">
              <i className="fas fa-map text-agro-primary"></i>
              Parcelas
            </h5>
            {resumen && resumen.parcelas.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Localidad</th>
                      <th className="px-6 py-3">Área real (ha)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resumen.parcelas.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">{p.nombre_parcela}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{p.localidad ?? "-"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-agro-primary">{formatDecimal(p.area_real_ha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No tiene parcelas registradas.</p>
            )}
          </section>

          <section>
            <h5 className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-3 mb-4 font-bold tracking-tight">
              <i className="fas fa-file-invoice-dollar text-agro-primary"></i>
              Propuestas Recientes
            </h5>
            {resumen && resumen.propuestas.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3">Tipo</th>
                      <th className="px-6 py-3">Total (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resumen.propuestas.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">{p.fecha}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${p.tipo === 'Venta' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {p.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatDecimal(p.total_general)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No hay propuestas registradas.</p>
            )}
          </section>

          <section>
            <h5 className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-3 mb-4 font-bold tracking-tight">
              <i className="fas fa-seedling text-agro-primary"></i>
              Monitoreos
            </h5>
            {resumen && resumen.monitoreos.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Parcela</th>
                      <th className="px-6 py-3">Zafra</th>
                      <th className="px-6 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resumen.monitoreos.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">{m.parcela_nombre}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{m.zafra_nombre}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${m.concluido ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-agro-primary border border-agro-primary/10'
                            }`}>
                            {m.concluido ? "Concluido" : "Em Curso"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No hay monitoreos programados.</p>
            )}
          </section>

          <section>
            <h5 className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-3 mb-4 font-bold tracking-tight">
              <i className="fas fa-calendar-alt text-agro-primary"></i>
              Próximas Visitas
            </h5>
            {resumen && resumen.evaluacionesProximas.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Fecha Estimada</th>
                      <th className="px-6 py-3">Parcela</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resumen.evaluacionesProximas.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-orange-600">{e.fecha_proxima_evaluacion}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{e.parcela_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No hay próximas visitas programadas.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
