import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";
import { AplicacionModal } from "./AplicacionModal";
import { CosechaModal } from "./CosechaModal";
import { EvaluacionModal } from "./EvaluacionModal";
import { generarPdfMonitoreo } from "./pdfMonitoreo";
import { RteModal } from "./RteModal";
import { SiembraModal } from "./SiembraModal";

interface MonitoreoRow {
  id: string;
  id_cliente: string;
  id_parcela: string;
  id_zafra: string;
  hectares: number | null;
  costo_estimado: number | null;
  productividad_estimada: number | null;
  tiene_siembra: boolean;
  tiene_aplicaciones: boolean;
  tiene_evaluaciones: boolean;
  tiene_cosecha: boolean;
  tiene_rte: boolean;
  concluido: boolean;
  cliente_nombre: string;
  parcela_nombre: string;
  zafra_nombre: string;
  created_at: string;
}

function EtapasBadges({ row }: { row: MonitoreoRow }) {
  const etapas: string[] = ["Planificación"];
  if (row.tiene_siembra) etapas.push("Siembra");
  if (row.tiene_aplicaciones) etapas.push("Aplicaciones");
  if (row.tiene_evaluaciones) etapas.push("Evaluaciones");
  if (row.tiene_cosecha) etapas.push("Cosecha");
  if (row.tiene_rte) etapas.push("RTE");
  if (row.concluido) etapas.push("Concluido");

  const colors: Record<string, string> = {
    Planificación: "bg-gray-100 text-gray-700",
    Siembra: "bg-amber-100 text-amber-800",
    Aplicaciones: "bg-green-100 text-green-700",
    Evaluaciones: "bg-teal-100 text-teal-700",
    Cosecha: "bg-orange-100 text-orange-700",
    RTE: "bg-agro-primary/10 text-agro-primary",
    Concluido: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="flex flex-wrap gap-1">
      {etapas.map((e) => (
        <span key={e} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[e] ?? "bg-gray-100 text-gray-600"}`}>
          {e}
        </span>
      ))}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all";

export function MonitoreoTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<MonitoreoRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [parcelas, setParcelas] = useState<{ id: string; nombre_parcela: string; id_cliente: string; area_real_ha: number | null }[]>([]);
  const [zafras, setZafras] = useState<{ id: string; nombre_zafra: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<MonitoreoRow | null>(null);
  const [form, setForm] = useState({
    id_cliente: "",
    id_parcela: "",
    id_zafra: "",
    costo_estimado: "",
    productividad_estimada: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterParcela, setFilterParcela] = useState("");
  const [siembraModal, setSiembraModal] = useState<{ monitoreo: MonitoreoRow; siembraId: string } | null>(null);
  const [aplicacionModal, setAplicacionModal] = useState<{ aplicacionId: string; monitoreo: MonitoreoRow; areaHa: number | null } | null>(null);
  const [aplicacionesList, setAplicacionesList] = useState<{ id: string; fecha_aplicacion: string | null; costo_total: number | null; costo_ha: number | null; tipo_descripcion?: string }[]>([]);
  const [cosechaModal, setCosechaModal] = useState<{ cosechaId: string; monitoreo: MonitoreoRow } | null>(null);
  const [rteModal, setRteModal] = useState<{ rteId: string; monitoreo: MonitoreoRow } | null>(null);
  const [evaluacionModal, setEvaluacionModal] = useState<{ evaluacionId: string; monitoreo: MonitoreoRow } | null>(null);
  const [evaluacionesList, setEvaluacionesList] = useState<{ id: string; fecha_evaluacion: string; fecha_proxima_evaluacion: string | null; descripcion_general?: string | null }[]>([]);

  // Accordion state
  const [expandedAplicaciones, setExpandedAplicaciones] = useState(false);
  const [expandedEvaluaciones, setExpandedEvaluaciones] = useState(false);

  // Demo: listas por monitoreo en sesión (para que aparezcan al agregar aplicación/evaluación)
  type AplicacionListItem = { id: string; fecha_aplicacion: string | null; costo_total: number | null; costo_ha: number | null; tipo_descripcion?: string };
  type EvaluacionListItem = { id: string; fecha_evaluacion: string; fecha_proxima_evaluacion: string | null; descripcion_general?: string | null };
  const [demoAplicacionesByMonitoreo, setDemoAplicacionesByMonitoreo] = useState<Record<string, AplicacionListItem[]>>({});
  const [demoEvaluacionesByMonitoreo, setDemoEvaluacionesByMonitoreo] = useState<Record<string, EvaluacionListItem[]>>({});
  const [demoCosechaIdByMonitoreo, setDemoCosechaIdByMonitoreo] = useState<Record<string, string>>({});
  const [demoRteIdByMonitoreo, setDemoRteIdByMonitoreo] = useState<Record<string, string>>({});

  const isDemoMode = localStorage.getItem("forceAuthReview") === "true";

  const MOCK_APLICACIONES: Record<string, AplicacionListItem[]> = {
    "m-2": [
      { id: "a-2a", fecha_aplicacion: "2024-11-10", costo_total: 1275, costo_ha: 15, tipo_descripcion: "Terrestre" },
      { id: "a-2b", fecha_aplicacion: "2024-11-25", costo_total: 980, costo_ha: 14, tipo_descripcion: "Terrestre" },
    ],
    "m-3": [{ id: "a-3", fecha_aplicacion: "2024-11-20", costo_total: 3600, costo_ha: 18, tipo_descripcion: "Terrestre" }],
    "m-4": [{ id: "a-4", fecha_aplicacion: "2024-10-25", costo_total: 540, costo_ha: 12, tipo_descripcion: "Terrestre" }],
  };
  const MOCK_EVALUACIONES: Record<string, EvaluacionListItem[]> = {
    "m-2": [
      { id: "e-2a", fecha_evaluacion: "2024-11-05", fecha_proxima_evaluacion: "2024-11-20", descripcion_general: "Estado general bueno. Monitoreo de plagas sin incidencias." },
      { id: "e-2b", fecha_evaluacion: "2024-11-25", fecha_proxima_evaluacion: "2024-12-10", descripcion_general: "Segunda evaluación. Desarrollo normal." },
    ],
    "m-3": [{ id: "e-3", fecha_evaluacion: "2024-12-01", fecha_proxima_evaluacion: null, descripcion_general: "Evaluación pre-cosecha." }],
    "m-4": [{ id: "e-4", fecha_evaluacion: "2024-09-15", fecha_proxima_evaluacion: null, descripcion_general: "Evaluación concluída." }],
  };

  // Dados fictícios para testar sem Supabase (localStorage forceAuthReview = true)
  const MOCK_ROWS: MonitoreoRow[] = [
    { id: "m-1", id_cliente: "cl-1", id_parcela: "pa-1", id_zafra: "z-1", hectares: 120.5, costo_estimado: 8500, productividad_estimada: 3200, tiene_siembra: false, tiene_aplicaciones: false, tiene_evaluaciones: false, tiene_cosecha: false, tiene_rte: false, concluido: false, cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Norte", zafra_nombre: "Zafra 2024/2025", created_at: new Date().toISOString() },
    { id: "m-2", id_cliente: "cl-1", id_parcela: "pa-2", id_zafra: "z-1", hectares: 85, costo_estimado: 6200, productividad_estimada: 3100, tiene_siembra: true, tiene_aplicaciones: true, tiene_evaluaciones: true, tiene_cosecha: false, tiene_rte: false, concluido: false, cliente_nombre: "Fazenda Santa María", parcela_nombre: "Lote Sur", zafra_nombre: "Zafra 2024/2025", created_at: new Date().toISOString() },
    { id: "m-3", id_cliente: "cl-2", id_parcela: "pa-3", id_zafra: "z-1", hectares: 200, costo_estimado: 18000, productividad_estimada: 3300, tiene_siembra: true, tiene_aplicaciones: true, tiene_evaluaciones: true, tiene_cosecha: true, tiene_rte: true, concluido: false, cliente_nombre: "Estancia San José", parcela_nombre: "Campo 1", zafra_nombre: "Zafra 2024/2025", created_at: new Date().toISOString() },
    { id: "m-4", id_cliente: "cl-3", id_parcela: "pa-4", id_zafra: "z-2", hectares: 45, costo_estimado: 4200, productividad_estimada: 2800, tiene_siembra: true, tiene_aplicaciones: true, tiene_evaluaciones: true, tiene_cosecha: true, tiene_rte: true, concluido: true, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025 Maíz", created_at: new Date().toISOString() },
    { id: "m-5", id_cliente: "cl-3", id_parcela: "pa-4", id_zafra: "z-1", hectares: 45, costo_estimado: 3800, productividad_estimada: 2900, tiene_siembra: false, tiene_aplicaciones: false, tiene_evaluaciones: false, tiene_cosecha: false, tiene_rte: false, concluido: false, cliente_nombre: "Agropecuaria El Progreso", parcela_nombre: "Chacra Central", zafra_nombre: "Zafra 2024/2025", created_at: new Date().toISOString() },
  ];

  const loadMonitoreos = async (): Promise<MonitoreoRow[] | void> => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setRows(MOCK_ROWS);
      return;
    }

    let q = supabase
      .from("monitoreos")
      .select("id, id_cliente, id_parcela, id_zafra, hectares, costo_estimado, productividad_estimada, tiene_siembra, tiene_aplicaciones, tiene_evaluaciones, tiene_cosecha, tiene_rte, concluido, created_at")
      .order("created_at", { ascending: false });

    if (perfil?.perfil_acceso === "rtv") {
      const { data: clientesRtv } = await supabase.from("clientes").select("id").eq("id_vendedor", perfil.id);
      const ids = (clientesRtv ?? []).map((c: { id: string }) => c.id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }
      q = q.in("id_cliente", ids);
    }
    const { data, error } = await q;
    if (error || !data) return;

    const cIds = [...new Set((data as any[]).map((d) => d.id_cliente))];
    const pIds = [...new Set((data as any[]).map((d) => d.id_parcela))];
    const zIds = [...new Set((data as any[]).map((d) => d.id_zafra))];

    let cMap: Record<string, string> = {};
    let pMap: Record<string, string> = {};
    let zMap: Record<string, string> = {};

    if (cIds.length) {
      const { data: c } = await supabase.from("clientes").select("id, nombre").in("id", cIds);
      if (c) cMap = Object.fromEntries((c as any[]).map((x) => [x.id, x.nombre]));
    }
    if (pIds.length) {
      const { data: p } = await supabase.from("parcelas").select("id, nombre_parcela").in("id", pIds);
      if (p) pMap = Object.fromEntries((p as any[]).map((x) => [x.id, x.nombre_parcela]));
    }
    if (zIds.length) {
      const { data: z } = await supabase.from("zafras").select("id, nombre_zafra").in("id", zIds);
      if (z) zMap = Object.fromEntries((z as any[]).map((x) => [x.id, x.nombre_zafra]));
    }
    const mapped = (data as any[]).map((d) => ({
      ...d,
      cliente_nombre: cMap[d.id_cliente] ?? "",
      parcela_nombre: pMap[d.id_parcela] ?? "",
      zafra_nombre: zMap[d.id_zafra] ?? "",
    }));
    setRows(mapped);
    return mapped;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      await loadMonitoreos();

      if (isReviewMode) {
        setClientes([
          { id: "cl-1", nombre: "Fazenda Santa María" },
          { id: "cl-2", nombre: "Estancia San José" },
          { id: "cl-3", nombre: "Agropecuaria El Progreso" },
        ]);
        setParcelas([
          { id: "pa-1", nombre_parcela: "Lote Norte", id_cliente: "cl-1", area_real_ha: 120.5 },
          { id: "pa-2", nombre_parcela: "Lote Sur", id_cliente: "cl-1", area_real_ha: 85 },
          { id: "pa-3", nombre_parcela: "Campo 1", id_cliente: "cl-2", area_real_ha: 200 },
          { id: "pa-4", nombre_parcela: "Chacra Central", id_cliente: "cl-3", area_real_ha: 45 },
        ]);
        setZafras([
          { id: "z-1", nombre_zafra: "Zafra 2024/2025" },
          { id: "z-2", nombre_zafra: "Zafra 2024/2025 Maíz" },
        ]);
        setLoading(false);
        return;
      }

      let clientesQ = supabase.from("clientes").select("id, nombre").eq("estado", "activo");
      if (perfil?.perfil_acceso === "rtv") {
        clientesQ = clientesQ.eq("id_vendedor", perfil.id);
      }
      const [c, p, z] = await Promise.all([
        clientesQ,
        supabase.from("parcelas").select("id, nombre_parcela, id_cliente, area_real_ha").eq("estado", "activo"),
        supabase.from("zafras").select("id, nombre_zafra").eq("estado", "activo"),
      ]);
      if (c.data) setClientes(c.data as any);
      if (p.data) setParcelas(p.data as any);
      if (z.data) setZafras(z.data as any);
      setLoading(false);
    };
    load();
  }, [perfil?.id, perfil?.perfil_acceso]);

  const parcelasByCliente = useMemo(() => {
    if (!form.id_cliente) return parcelas;
    return parcelas.filter((p) => p.id_cliente === form.id_cliente);
  }, [parcelas, form.id_cliente]);

  useEffect(() => {
    if (!showDetail?.id) {
      setAplicacionesList([]);
      setExpandedAplicaciones(false);
      return;
    }
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const staticList = MOCK_APLICACIONES[showDetail.id] ?? [];
      const sessionList = demoAplicacionesByMonitoreo[showDetail.id] ?? [];
      setAplicacionesList([...staticList, ...sessionList]);
      setExpandedAplicaciones(staticList.length + sessionList.length > 0 || showDetail.tiene_aplicaciones);
      return;
    }
    const load = async () => {
      setExpandedAplicaciones(showDetail.tiene_aplicaciones);
      const { data } = await supabase
        .from("aplicaciones")
        .select("id, fecha_aplicacion, costo_total, costo_ha, tipo_aplicacion(descripcion)")
        .eq("id_monitoreo", showDetail.id)
        .order("fecha_aplicacion", { ascending: false });
      const list = (data as any[]) ?? [];
      const mapped = list.map((a) => ({
        id: a.id,
        fecha_aplicacion: a.fecha_aplicacion,
        costo_total: a.costo_total,
        costo_ha: a.costo_ha,
        tipo_descripcion: a.tipo_aplicacion?.descripcion ?? undefined,
      }));
      setAplicacionesList(mapped);
      setExpandedAplicaciones(mapped.length > 0 || showDetail.tiene_aplicaciones);
    };
    load();
  }, [showDetail?.id, demoAplicacionesByMonitoreo]);

  useEffect(() => {
    if (!showDetail?.id) {
      setEvaluacionesList([]);
      setExpandedEvaluaciones(false);
      return;
    }
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const staticList = MOCK_EVALUACIONES[showDetail.id] ?? [];
      const sessionList = demoEvaluacionesByMonitoreo[showDetail.id] ?? [];
      setEvaluacionesList([...staticList, ...sessionList]);
      setExpandedEvaluaciones(staticList.length + sessionList.length > 0 || showDetail.tiene_evaluaciones);
      return;
    }
    const load = async () => {
      setExpandedEvaluaciones(showDetail.tiene_evaluaciones);
      const { data } = await supabase
        .from("evaluaciones")
        .select("id, fecha_evaluacion, fecha_proxima_evaluacion, descripcion_general")
        .eq("id_monitoreo", showDetail.id)
        .order("fecha_evaluacion", { ascending: false });
      const list = (data as any[]) ?? [];
      setEvaluacionesList(list);
      setExpandedEvaluaciones(list.length > 0 || showDetail.tiene_evaluaciones);
    };
    load();
  }, [showDetail?.id, demoEvaluacionesByMonitoreo]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterCliente) list = list.filter((r) => r.id_cliente === filterCliente);
    if (filterParcela) list = list.filter((r) => r.id_parcela === filterParcela);
    return list;
  }, [rows, filterCliente, filterParcela]);

  const selectedClienteNombre = useMemo(() => {
    if (!form.id_cliente) return "";
    return clientes.find((c) => c.id === form.id_cliente)?.nombre ?? "";
  }, [form.id_cliente, clientes]);

  const filteredClientes = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientes.slice(0, 50);
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(q))
      .slice(0, 50);
  }, [clientes, clientSearch]);

  const resetForm = () => {
    setForm({
      id_cliente: "",
      id_parcela: "",
      id_zafra: "",
      costo_estimado: "",
      productividad_estimada: "",
    });
    setClientSearch("");
    setClientDropdownOpen(false);
    setShowModal(false);
  };

  const handleNuevo = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parcela = parcelas.find((p) => p.id === form.id_parcela);
    const hectares = parcela?.area_real_ha ?? null;
    setSaving(true);
    await supabase.from("monitoreos").insert({
      id_cliente: form.id_cliente,
      id_parcela: form.id_parcela,
      id_zafra: form.id_zafra,
      hectares,
      costo_estimado: form.costo_estimado !== "" ? Number(form.costo_estimado) : null,
      productividad_estimada: form.productividad_estimada !== "" ? Number(form.productividad_estimada) : null,
    });
    await loadMonitoreos();
    resetForm();
    setSaving(false);
  };

  const handleIniciarSiembra = async (m: MonitoreoRow) => {
    if (m.tiene_siembra) return;
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setSiembraModal({ monitoreo: m, siembraId: "mock-siembra-id" });
      return;
    }

    const { data } = await supabase.from("siembra").insert({ id_monitoreo: m.id }).select("id").single();
    if (data) {
      await supabase.from("monitoreos").update({ tiene_siembra: true }).eq("id", m.id);
      await loadMonitoreos();
      setShowDetail((prev) => (prev?.id === m.id ? { ...prev, tiene_siembra: true } : prev));
      setSiembraModal({ monitoreo: m, siembraId: (data as any).id });
    }
  };

  const handleVerSiembra = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const mockSiembraId: Record<string, string> = { "m-2": "s-2", "m-3": "s-3", "m-4": "s-4" };
      const siembraId = mockSiembraId[m.id] ?? "mock-siembra-id";
      setSiembraModal({ monitoreo: m, siembraId });
      return;
    }
    const { data } = await supabase.from("siembra").select("id").eq("id_monitoreo", m.id).single();
    if (data) setSiembraModal({ monitoreo: m, siembraId: (data as any).id });
  };

  const handleIniciarAplicacion = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setAplicacionModal({
        aplicacionId: "mock-app-" + Date.now(),
        monitoreo: m,
        areaHa: m.hectares ?? 100,
      });
      return;
    }

    const { data } = await supabase.from("aplicaciones").insert({ id_monitoreo: m.id }).select("id").single();
    if (data) {
      await supabase.from("monitoreos").update({ tiene_aplicaciones: true }).eq("id", m.id);
      await loadMonitoreos();
      setShowDetail((prev) => (prev?.id === m.id ? { ...prev, tiene_aplicaciones: true } : prev));
      setAplicacionModal({
        aplicacionId: (data as any).id,
        monitoreo: m,
        areaHa: parcelas.find((p) => p.id === m.id_parcela)?.area_real_ha ?? m.hectares ?? null,
      });
    }
  };

  const handleVerAplicacion = (aplicacionId: string, m: MonitoreoRow) => {
    setAplicacionModal({
      aplicacionId,
      monitoreo: m,
      areaHa: parcelas.find((p) => p.id === m.id_parcela)?.area_real_ha ?? m.hectares ?? null,
    });
  };

  const handleIniciarEvaluacion = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      setEvaluacionModal({ evaluacionId: "mock-ev-" + Date.now(), monitoreo: m });
      return;
    }

    const { data } = await supabase.from("evaluaciones").insert({ id_monitoreo: m.id, fecha_evaluacion: new Date().toISOString().slice(0, 10) }).select("id").single();
    if (data) {
      await supabase.from("monitoreos").update({ tiene_evaluaciones: true }).eq("id", m.id);
      await loadMonitoreos();
      setShowDetail((prev) => (prev?.id === m.id ? { ...prev, tiene_evaluaciones: true } : prev));
      setEvaluacionModal({ evaluacionId: (data as any).id, monitoreo: m });
    }
  };

  const handleVerEvaluacion = (evaluacionId: string, m: MonitoreoRow) => {
    setEvaluacionModal({ evaluacionId, monitoreo: m });
  };

  const handleIniciarCosecha = async (m: MonitoreoRow) => {
    if (m.tiene_cosecha) return;
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const cosechaId = "mock-cosecha-" + m.id;
      setDemoCosechaIdByMonitoreo((prev) => ({ ...prev, [m.id]: cosechaId }));
      setCosechaModal({ cosechaId, monitoreo: m });
      return;
    }

    const { data } = await supabase.from("cosechas").insert({ id_monitoreo: m.id }).select("id").single();
    if (data) {
      await supabase.from("monitoreos").update({ tiene_cosecha: true }).eq("id", m.id);
      await loadMonitoreos();
      setShowDetail((prev) => (prev?.id === m.id ? { ...prev, tiene_cosecha: true } : prev));
      setCosechaModal({ cosechaId: (data as any).id, monitoreo: m });
    }
  };

  const handleVerCosecha = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const mockCosechaId: Record<string, string> = { "m-3": "c-3", "m-4": "c-4" };
      const cosechaId = demoCosechaIdByMonitoreo[m.id] ?? mockCosechaId[m.id];
      if (cosechaId) setCosechaModal({ cosechaId, monitoreo: m });
      return;
    }
    const { data } = await supabase.from("cosechas").select("id").eq("id_monitoreo", m.id).single();
    if (data) setCosechaModal({ cosechaId: (data as any).id, monitoreo: m });
  };

  const handleIniciarRte = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const rteId = "mock-rte-" + m.id;
      setDemoRteIdByMonitoreo((prev) => ({ ...prev, [m.id]: rteId }));
      setRteModal({ rteId, monitoreo: m });
      return;
    }

    const { data } = await supabase.from("rte").insert({ id_monitoreo: m.id, costo_total: 0, ingreso_total: 0, resultado_tecnico: 0 }).select("id").single();
    if (data) {
      await supabase.from("monitoreos").update({ tiene_rte: true }).eq("id", m.id);
      await loadMonitoreos();
      setShowDetail((prev) => (prev?.id === m.id ? { ...prev, tiene_rte: true } : prev));
      setRteModal({ rteId: (data as any).id, monitoreo: m });
    }
  };

  const handleVerRte = async (m: MonitoreoRow) => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      const mockRteId: Record<string, string> = { "m-3": "r-3", "m-4": "r-4" };
      const rteId = demoRteIdByMonitoreo[m.id] ?? mockRteId[m.id];
      if (rteId) setRteModal({ rteId, monitoreo: m });
      return;
    }
    const { data } = await supabase.from("rte").select("id").eq("id_monitoreo", m.id).single();
    if (data) setRteModal({ rteId: (data as any).id, monitoreo: m });
  };

  const handleConcluir = async (m: MonitoreoRow) => {
    await supabase.from("monitoreos").update({ concluido: true }).eq("id", m.id);
    await loadMonitoreos();
    setShowDetail((prev) => (prev?.id === m.id ? { ...prev, concluido: true } : null));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando monitoreos...
    </div>
  );

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="min-w-[180px]">
          <label className={labelCls}>Cliente</label>
          <select
            className={inputCls}
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
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
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={handleNuevo}>
            <i className="fas fa-plus text-xs" /> Nuevo monitoreo
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Parcela</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Zafra</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-right">Ha</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-right">Costo Est.</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Etapa</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-600">{r.parcela_nombre}</td>
                <td className="px-4 py-3 text-gray-600">{r.zafra_nombre}</td>
                <td className="px-4 py-3 text-right font-mono">{formatDecimal(r.hectares)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-agro-primary">${formatDecimal(r.costo_estimado)}</td>
                <td className="px-4 py-3">
                  <EtapasBadges row={r} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs font-bold text-gray-600 hover:underline mr-3"
                    onClick={() => generarPdfMonitoreo(supabase, r.id, { userName: perfil?.nombre })}
                  >
                    <i className="fas fa-file-pdf mr-0.5" />Exportar PDF
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-agro-primary hover:underline"
                    onClick={() => setShowDetail(r)}
                  >
                    Ver detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div className="py-12 text-center">
            <i className="fas fa-microscope mb-2 text-2xl block text-gray-400" />
            <p className="text-gray-400">No hay monitoreos registrados.</p>
          </div>
        )}
      </div>

      {/* ── Modal Novo Monitoreo ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-plus text-sm" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Novo monitoreo – Planificação</h3>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fas fa-times" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className={labelCls}>Cliente *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Escriba para buscar..."
                      value={form.id_cliente ? selectedClienteNombre : clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setForm((f) => ({ ...f, id_cliente: "", id_parcela: "" }));
                        setClientDropdownOpen(true);
                      }}
                      onFocus={() => setClientDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setClientDropdownOpen(false), 200)}
                    />
                    <input type="hidden" value={form.id_cliente} required />
                    {clientDropdownOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
                        {filteredClientes.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
                        ) : (
                          filteredClientes.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-agro-primary/10 transition-colors border-b border-gray-50 last:border-0"
                              onClick={() => {
                                setForm((f) => ({ ...f, id_cliente: c.id, id_parcela: "" }));
                                setClientSearch(c.nombre);
                                setClientDropdownOpen(false);
                              }}
                            >
                              {c.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Parcela *</label>
                  <select
                    className={inputCls}
                    value={form.id_parcela}
                    onChange={(e) => setForm({ ...form, id_parcela: e.target.value })}
                    required
                    disabled={!form.id_cliente}
                  >
                    <option value="">Seleccione</option>
                    {parcelasByCliente.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_parcela}
                        {p.area_real_ha != null ? ` (${formatDecimal(p.area_real_ha)} ha)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Zafra *</label>
                  <select
                    className={inputCls}
                    value={form.id_zafra}
                    onChange={(e) => setForm({ ...form, id_zafra: e.target.value })}
                    required
                  >
                    <option value="">Seleccione</option>
                    {zafras.map((z) => (
                      <option key={z.id} value={z.id}>{z.nombre_zafra}</option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const selParcela = parcelas.find((p) => p.id === form.id_parcela);
                  const selArea = selParcela?.area_real_ha ?? 0;
                  const costoHa = Number(form.costo_estimado) || 0;
                  const prodHa = Number(form.productividad_estimada) || 0;
                  const costoTotal = selArea > 0 && costoHa > 0 ? costoHa * selArea : 0;
                  const prodTotal = selArea > 0 && prodHa > 0 ? prodHa * selArea : 0;
                  return (
                    <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Costo est. (USD/ha)</label>
                        <input
                          type="number"
                          step="0.001"
                          className={inputCls}
                          placeholder="0.00"
                          value={form.costo_estimado}
                          onChange={(e) => setForm({ ...form, costo_estimado: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Prod. est. (kg/ha)</label>
                        <input
                          type="number"
                          step="0.001"
                          className={inputCls}
                          placeholder="0.00"
                          value={form.productividad_estimada}
                          onChange={(e) => setForm({ ...form, productividad_estimada: e.target.value })}
                        />
                      </div>
                    </div>
                    {selArea > 0 && (costoHa > 0 || prodHa > 0) && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <span className="block text-[10px] uppercase text-gray-400 font-bold">Área</span>
                          <span className="text-gray-900 font-bold font-mono text-sm">{formatDecimal(selArea)} ha</span>
                        </div>
                        {costoTotal > 0 && (
                          <div>
                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Costo total est.</span>
                            <span className="text-agro-primary font-bold font-mono text-sm">${formatDecimal(costoTotal)}</span>
                          </div>
                        )}
                        {prodTotal > 0 && (
                          <div>
                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Prod. total est.</span>
                            <span className="text-gray-900 font-bold font-mono text-sm">{formatDecimal(prodTotal)} kg</span>
                          </div>
                        )}
                      </div>
                    )}
                    </>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button type="button" className={btnSecondary} onClick={resetForm}>Cancelar</button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                  ) : "Criar monitoreo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Detalhe da Esteira (Pipeline) ── */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-eye text-sm" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">Monitoreo Detalhado</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                    {showDetail.cliente_nombre} / {showDetail.parcela_nombre} / {showDetail.zafra_nombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnSecondary + " text-xs py-1.5 px-3"}
                  onClick={() => showDetail && generarPdfMonitoreo(supabase, showDetail.id, { userName: perfil?.nombre })}
                >
                  <i className="fas fa-file-pdf mr-1" />Exportar PDF
                </button>
                <button
                  onClick={() => setShowDetail(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  type="button"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Card de Resumo Planificação */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                <div className="flex gap-6">
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-bold mb-0.5">Área</span>
                    <span className="text-gray-900 font-bold font-mono">{formatDecimal(showDetail.hectares)} ha</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-bold mb-0.5">Costo est. /ha</span>
                    <span className="text-agro-primary font-bold font-mono">${formatDecimal(showDetail.costo_estimado)}</span>
                  </div>
                  {(showDetail.costo_estimado ?? 0) > 0 && (showDetail.hectares ?? 0) > 0 && (
                    <div>
                      <span className="block text-[10px] uppercase text-gray-400 font-bold mb-0.5">Costo total est.</span>
                      <span className="text-agro-primary font-bold font-mono">${formatDecimal((showDetail.costo_estimado ?? 0) * (showDetail.hectares ?? 0))}</span>
                    </div>
                  )}
                  {(showDetail.productividad_estimada ?? 0) > 0 && (
                    <div>
                      <span className="block text-[10px] uppercase text-gray-400 font-bold mb-0.5">Prod. est. /ha</span>
                      <span className="text-gray-900 font-bold font-mono">{formatDecimal(showDetail.productividad_estimada)} kg</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Etapa:</span>
                  <EtapasBadges row={showDetail} />
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  const soloLectura = showDetail.concluido;
                  return (
                  <>
                {/* 1. Siembra (1 por monitoreo) */}
                <div className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:bg-gray-50/50 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${showDetail.tiene_siembra ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    <i className="fas fa-seedling" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-0.5">Siembra</h4>
                    <p className="text-xs text-gray-500">
                      {showDetail.tiene_siembra ? "Una siembra registrada. Editar para ver o alterar datas." : soloLectura ? "Monitoreo concluido — solo lectura." : "Registrar siembra (datas e produtos). Puede iniciar el monitoreo por aquí."}
                    </p>
                  </div>
                  <div>
                    {soloLectura ? (
                      showDetail.tiene_siembra ? (
                        <button type="button" className={btnSecondary} onClick={() => handleVerSiembra(showDetail)}>Ver</button>
                      ) : null
                    ) : !showDetail.tiene_siembra ? (
                      <button type="button" className={btnPrimary} onClick={() => handleIniciarSiembra(showDetail)}>
                        <i className="fas fa-plus text-[10px]" /> Nueva Siembra
                      </button>
                    ) : (
                      <button type="button" className={btnSecondary} onClick={() => handleVerSiembra(showDetail)}>
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Aplicaciones (N por monitoreo; puede iniciar el monitoreo por aquí) */}
                <div className="p-4 border border-gray-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-4 cursor-pointer select-none" onClick={() => (aplicacionesList.length > 0 || showDetail.tiene_aplicaciones) && setExpandedAplicaciones(!expandedAplicaciones)}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showDetail.tiene_aplicaciones ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      <i className="fas fa-spray-can" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm mb-0.5">Aplicaciones</h4>
                      <p className="text-xs text-gray-500">
                        {soloLectura ? "Solo visualización." : "Varios lançamentos. Produtos, datas, tipo, costo/ha e total. Puede iniciar el monitoreo por aquí."}
                      </p>
                    </div>
                    {(aplicacionesList.length > 0 || showDetail.tiene_aplicaciones) && (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-400">
                        <i className={`fas fa-chevron-${expandedAplicaciones ? "up" : "down"} text-xs transition-transform`} />
                      </div>
                    )}
                    {!soloLectura && (
                    <div>
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={(e) => { e.stopPropagation(); handleIniciarAplicacion(showDetail); }}
                      >
                        <i className="fas fa-plus text-[10px]" /> Nueva Aplicación
                      </button>
                    </div>
                    )}
                  </div>
                  {expandedAplicaciones && (
                    <div className="pl-14 space-y-2 mt-3 animate-fade-in">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Lançamentos:</p>
                      {aplicacionesList.length === 0 ? (
                        <p className="text-xs text-gray-500 py-3">Sin aplicaciones registradas.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="pb-2 pr-2">Fecha</th>
                                <th className="pb-2 pr-2">Tipo</th>
                                <th className="pb-2 pr-2 text-right">Costo/ha</th>
                                <th className="pb-2 text-right">Total</th>
                                <th className="pb-2 w-24" />
                              </tr>
                            </thead>
                            <tbody>
                              {aplicacionesList.map((a) => (
                                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                  <td className="py-2 pr-2 text-gray-700">{a.fecha_aplicacion ? new Date(a.fecha_aplicacion).toLocaleDateString("es-PY") : "—"}</td>
                                  <td className="py-2 pr-2 text-gray-600">{a.tipo_descripcion ?? "—"}</td>
                                  <td className="py-2 pr-2 text-right font-mono">${formatDecimal(a.costo_ha)}</td>
                                  <td className="py-2 text-right font-mono font-bold text-agro-primary">${formatDecimal(a.costo_total)}</td>
                                  <td className="py-2">
                                    <button type="button" className="text-[10px] font-bold text-agro-primary hover:underline" onClick={(e) => { e.stopPropagation(); handleVerAplicacion(a.id, showDetail); }}>
                                      Ver Detalle
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Evaluaciones (N por monitoreo; puede iniciar el monitoreo por aquí) */}
                <div className="p-4 border border-gray-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-4 cursor-pointer select-none" onClick={() => (evaluacionesList.length > 0 || showDetail.tiene_evaluaciones) && setExpandedEvaluaciones(!expandedEvaluaciones)}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showDetail.tiene_evaluaciones ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      <i className="fas fa-clipboard-check" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm mb-0.5">Evaluaciones</h4>
                      <p className="text-xs text-gray-500">
                        {soloLectura ? "Solo visualización." : "Varios lançamentos. Ver detalhes de cada evaluación. Puede iniciar el monitoreo por aquí."}
                      </p>
                    </div>
                    {(evaluacionesList.length > 0 || showDetail.tiene_evaluaciones) && (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-400">
                        <i className={`fas fa-chevron-${expandedEvaluaciones ? "up" : "down"} text-xs transition-transform`} />
                      </div>
                    )}
                    {!soloLectura && (
                    <div>
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={(e) => { e.stopPropagation(); handleIniciarEvaluacion(showDetail); }}
                      >
                        <i className="fas fa-plus text-[10px]" /> Nueva Evaluación
                      </button>
                    </div>
                    )}
                  </div>
                  {expandedEvaluaciones && (
                    <div className="pl-14 space-y-2 mt-3 animate-fade-in">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Lançamentos:</p>
                      {evaluacionesList.length === 0 ? (
                        <p className="text-xs text-gray-500 py-3">Sin evaluaciones registradas.</p>
                      ) : (
                      <div className="space-y-2">
                        {evaluacionesList.map((ev) => (
                          <div key={ev.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg group">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mb-1">
                                <span><i className="far fa-calendar text-[10px] text-gray-400" /> {ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString("es-PY") : "—"}</span>
                                {ev.fecha_proxima_evaluacion && (
                                  <span className="text-gray-500">Próx.: {new Date(ev.fecha_proxima_evaluacion).toLocaleDateString("es-PY")}</span>
                                )}
                              </div>
                              {ev.descripcion_general && (
                                <p className="text-[11px] text-gray-600 line-clamp-2">{ev.descripcion_general}</p>
                              )}
                            </div>
                            <button type="button" className="text-[10px] font-bold text-agro-primary hover:underline shrink-0" onClick={(e) => { e.stopPropagation(); handleVerEvaluacion(ev.id, showDetail); }}>
                              Ver Detalle
                            </button>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Cosecha (1 por monitoreo; habilitada si hay al menos siembra, aplicación o evaluación) */}
                {(() => {
                  const tieneAplicaciones = aplicacionesList.length >= 1 || showDetail.tiene_aplicaciones;
                  const tieneEvaluaciones = evaluacionesList.length >= 1 || showDetail.tiene_evaluaciones;
                  const puedeCosecha = showDetail.tiene_siembra && tieneAplicaciones && tieneEvaluaciones;
                  return (
                <div className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:bg-gray-50/50 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${showDetail.tiene_cosecha ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    <i className="fas fa-tractor" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-0.5">Cosecha</h4>
                    <p className="text-xs text-gray-500">
                      {showDetail.tiene_cosecha ? "Uma cosecha registrada. Editar para ver o alterar." : !puedeCosecha ? "Requiere al menos 1 siembra, 1 aplicación y 1 evaluación." : "Listo para registrar cosecha."}
                    </p>
                  </div>
                  <div>
                    {soloLectura ? (
                      showDetail.tiene_cosecha ? (
                        <button type="button" className={btnSecondary} onClick={() => handleVerCosecha(showDetail)}>Ver</button>
                      ) : null
                    ) : !showDetail.tiene_cosecha ? (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => handleIniciarCosecha(showDetail)}
                        disabled={!puedeCosecha}
                        title={!puedeCosecha ? "Requiere al menos 1 siembra, 1 aplicación y 1 evaluación" : ""}
                      >
                        <i className="fas fa-plus text-[10px]" /> Nueva Cosecha
                      </button>
                    ) : (
                      <button type="button" className={btnSecondary} onClick={() => handleVerCosecha(showDetail)}>
                        Editar
                      </button>
                    )}
                  </div>
                </div>
                  );
                })()}

                {/* 5. RTE (desbloqueado solo con cosecha) */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl rounded-t-none border-t-4 border-t-agro-primary">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${showDetail.tiene_rte ? "bg-agro-primary text-white shadow-sm" : "bg-gray-100 text-gray-400"}`}>
                    <i className="fas fa-file-invoice-dollar" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-0.5 uppercase tracking-tight">Resultado Técnico Económico (RTE)</h4>
                    <p className="text-xs text-gray-500 italic">
                      {!showDetail.tiene_cosecha ? "Requiere cosecha registrada antes." : soloLectura ? "Solo visualización." : "Liberado al tener cosecha. Costos, ingresos y rentabilidad neta."}
                    </p>
                  </div>
                  <div>
                    {soloLectura ? (
                      showDetail.tiene_rte ? (
                        <button type="button" className={btnSecondary} onClick={() => handleVerRte(showDetail)}>Ver RTE</button>
                      ) : null
                    ) : !showDetail.tiene_rte ? (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => handleIniciarRte(showDetail)}
                        disabled={!showDetail.tiene_cosecha}
                        title={!showDetail.tiene_cosecha ? "Requer cosecha registrada" : ""}
                      >
                        Generar RTE
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => handleVerRte(showDetail)}
                        disabled={!showDetail.tiene_cosecha}
                        title={!showDetail.tiene_cosecha ? "Requer cosecha" : ""}
                      >
                        Ver RTE
                      </button>
                    )}
                  </div>
                </div>
                  </>
                  );
                })()}
              </div>

              {showDetail.tiene_rte && !showDetail.concluido && (
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                    onClick={() => handleConcluir(showDetail)}
                  >
                    <i className="fas fa-check-double" />
                    Concluir Monitoreo (Archivar)
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 text-right bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setShowDetail(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Componentes */}
      {siembraModal && (
        <SiembraModal
          monitoreo={siembraModal.monitoreo}
          siembraId={siembraModal.siembraId}
          areaHa={parcelas.find((p) => p.id === siembraModal.monitoreo.id_parcela)?.area_real_ha ?? siembraModal.monitoreo.hectares ?? null}
          onClose={() => setSiembraModal(null)}
          readOnly={siembraModal.monitoreo.concluido}
          onSaved={() => {
            const id = siembraModal.monitoreo.id;
            setSiembraModal(null);
            if (isDemoMode) {
              setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tiene_siembra: true } : r)));
              setShowDetail((prev) => (prev?.id === id ? { ...prev, tiene_siembra: true } : prev));
            } else loadMonitoreos();
          }}
        />
      )}

      {aplicacionModal && (
        <AplicacionModal
          aplicacionId={aplicacionModal.aplicacionId}
          monitoreo={aplicacionModal.monitoreo}
          areaHa={aplicacionModal.areaHa}
          onClose={() => setAplicacionModal(null)}
          readOnly={aplicacionModal.monitoreo.concluido}
          onSaved={async () => {
            const monId = aplicacionModal.monitoreo.id;
            setAplicacionModal(null);
            if (isDemoMode) {
              setRows((prev) => prev.map((r) => (r.id === monId ? { ...r, tiene_aplicaciones: true } : r)));
              setShowDetail((prev) => (prev?.id === monId ? { ...prev, tiene_aplicaciones: true } : prev));
              const newItem: AplicacionListItem = { id: "demo-a-" + Date.now(), fecha_aplicacion: new Date().toISOString().slice(0, 10), costo_total: 0, costo_ha: 0, tipo_descripcion: "—" };
              setDemoAplicacionesByMonitoreo((prev) => ({ ...prev, [monId]: [...(prev[monId] ?? []), newItem] }));
            } else {
              // Refresh the list immediately, independent of loadMonitoreos
              const [{ data: aplData }, newRows] = await Promise.all([
                supabase.from("aplicaciones").select("id, fecha_aplicacion, costo_total, costo_ha, tipo_aplicacion(descripcion)").eq("id_monitoreo", monId).order("fecha_aplicacion", { ascending: false }),
                loadMonitoreos(),
              ]);
              const list = (aplData as any[]) ?? [];
              setAplicacionesList(list.map((a) => ({ id: a.id, fecha_aplicacion: a.fecha_aplicacion, costo_total: a.costo_total, costo_ha: a.costo_ha, tipo_descripcion: a.tipo_aplicacion?.descripcion })));
              setExpandedAplicaciones(true);
              if (newRows) {
                const row = newRows.find((r) => r.id === monId);
                if (row) setShowDetail((prev) => (prev?.id === monId ? { ...prev, ...row } : prev));
              } else {
                setShowDetail((prev) => (prev?.id === monId ? { ...prev, tiene_aplicaciones: true } : prev));
              }
            }
          }}
        />
      )}

      {cosechaModal && (
        <CosechaModal
          cosechaId={cosechaModal.cosechaId}
          monitoreo={cosechaModal.monitoreo}
          areaHa={parcelas.find((p) => p.id === cosechaModal.monitoreo.id_parcela)?.area_real_ha ?? cosechaModal.monitoreo.hectares ?? null}
          onClose={() => setCosechaModal(null)}
          readOnly={cosechaModal.monitoreo.concluido}
          onSaved={() => {
            const id = cosechaModal.monitoreo.id;
            setCosechaModal(null);
            if (isDemoMode) {
              setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tiene_cosecha: true } : r)));
              setShowDetail((prev) => (prev?.id === id ? { ...prev, tiene_cosecha: true } : prev));
            } else loadMonitoreos();
          }}
        />
      )}

      {rteModal && (
        <RteModal
          rteId={rteModal.rteId}
          monitoreo={rteModal.monitoreo}
          onClose={() => setRteModal(null)}
          readOnly={rteModal.monitoreo.concluido}
          onSaved={() => {
            const id = rteModal.monitoreo.id;
            setRteModal(null);
            if (isDemoMode) {
              setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tiene_rte: true } : r)));
              setShowDetail((prev) => (prev?.id === id ? { ...prev, tiene_rte: true } : prev));
            } else loadMonitoreos();
          }}
        />
      )}

      {evaluacionModal && (
        <EvaluacionModal
          evaluacionId={evaluacionModal.evaluacionId}
          monitoreo={evaluacionModal.monitoreo}
          onClose={() => setEvaluacionModal(null)}
          readOnly={evaluacionModal.monitoreo.concluido}
          onSaved={async () => {
            const monId = evaluacionModal.monitoreo.id;
            setEvaluacionModal(null);
            if (isDemoMode) {
              setRows((prev) => prev.map((r) => (r.id === monId ? { ...r, tiene_evaluaciones: true } : r)));
              setShowDetail((prev) => (prev?.id === monId ? { ...prev, tiene_evaluaciones: true } : prev));
              const newItem: EvaluacionListItem = { id: "demo-e-" + Date.now(), fecha_evaluacion: new Date().toISOString().slice(0, 10), fecha_proxima_evaluacion: null, descripcion_general: null };
              setDemoEvaluacionesByMonitoreo((prev) => ({ ...prev, [monId]: [...(prev[monId] ?? []), newItem] }));
            } else {
              // Refresh the list immediately, independent of loadMonitoreos
              const [{ data: evData }, newRows] = await Promise.all([
                supabase.from("evaluaciones").select("id, fecha_evaluacion, fecha_proxima_evaluacion, descripcion_general").eq("id_monitoreo", monId).order("fecha_evaluacion", { ascending: false }),
                loadMonitoreos(),
              ]);
              setEvaluacionesList((evData as any[]) ?? []);
              setExpandedEvaluaciones(true);
              if (newRows) {
                const row = newRows.find((r) => r.id === monId);
                if (row) setShowDetail((prev) => (prev?.id === monId ? { ...prev, ...row } : prev));
              } else {
                setShowDetail((prev) => (prev?.id === monId ? { ...prev, tiene_evaluaciones: true } : prev));
              }
            }
          }}
        />
      )}
    </div>
  );
}
