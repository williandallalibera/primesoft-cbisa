import { useEffect, useState } from "react";
import { supabase, supabaseUrl, supabaseAnonKeyExport } from "../../lib/supabaseClient";
import { exportToCsv } from "../productos/utils";

interface CbotRow {
  id: string;
  created_at: string;
  vencimiento: string | null;
  ctr: string | null;
  cierre: number | null;
  simulacion: number | null;
  variacion: number | null;
  alto: number | null;
  bajo: number | null;
  apertura: number | null;
  costo: number | null;
  precio_bolsa_simulacion: number | null;
  precio_bolsa: number | null;
  cultura: string;
}

const tableThCls = "text-left px-4 py-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider";
const tableTdCls = "px-4 py-3 text-sm text-gray-700 font-medium";
const inputCls = "px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1";

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

interface CulturaOption {
  id: string;
  codigo: string;
}

export function CbotTab() {
  const [rows, setRows] = useState<CbotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(thirtyDaysAgo);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [culturasManual, setCulturasManual] = useState<CulturaOption[]>([]);
  const [manualCulturaId, setManualCulturaId] = useState("");
  const [manualFecha, setManualFecha] = useState(today);
  const [manualPrecioBolsa, setManualPrecioBolsa] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [costoSoja, setCostoSoja] = useState("110");
  const [integracionesId, setIntegracionesId] = useState<string | null>(null);
  const [savingCosto, setSavingCosto] = useState(false);
  const [syncingSoja, setSyncingSoja] = useState(false);
  const [syncSojaError, setSyncSojaError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("CbotTab: Review Mode - Injecting mock cbot data");
      setRows([
        { id: "cb-1", created_at: new Date().toISOString(), vencimiento: "MAR 26", ctr: "123", cierre: 420.5, simulacion: 425.0, variacion: 1.5, alto: 422.0, bajo: 418.0, apertura: 419.0, costo: 15.0, precio_bolsa_simulacion: 410.0, precio_bolsa: 405.0, cultura: "SOJA" },
        { id: "cb-2", created_at: new Date(Date.now() - 86400000).toISOString(), vencimiento: "MAY 26", ctr: "124", cierre: 430.0, simulacion: 432.0, variacion: -0.5, alto: 435.0, bajo: 428.0, apertura: 431.0, costo: 15.0, precio_bolsa_simulacion: 420.0, precio_bolsa: 415.0, cultura: "MAIZ" }
      ]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("cbot")
      .select(
        "id, created_at, vencimiento, ctr, cierre, simulacion, variacion, alto, bajo, apertura, costo, precio_bolsa_simulacion, precio_bolsa, culturas(codigo)"
      )
      .order("created_at", { ascending: false });

    if (fechaDesde) {
      query = query.gte("created_at", fechaDesde);
    }
    if (fechaHasta) {
      query = query.lte("created_at", fechaHasta + "T23:59:59");
    }

    const { data, error } = await query.limit(500);

    if (!error && data) {
      const mapped: CbotRow[] = data.map((d: any) => ({
        id: d.id,
        created_at: d.created_at,
        vencimiento: d.vencimiento,
        ctr: d.ctr,
        cierre: d.cierre,
        simulacion: d.simulacion,
        variacion: d.variacion,
        alto: d.alto,
        bajo: d.bajo,
        apertura: d.apertura,
        costo: d.costo,
        precio_bolsa_simulacion: d.precio_bolsa_simulacion,
        precio_bolsa: d.precio_bolsa,
        cultura: d.culturas?.codigo ?? ""
      }));
      setRows(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("culturas")
        .select("id, codigo")
        .in("codigo", ["maiz", "trigo"]);
      if (data?.length) {
        setCulturasManual(data as CulturaOption[]);
        if (!manualCulturaId && data[0]) setManualCulturaId((data[0] as CulturaOption).id);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("integraciones")
        .select("id, costo_cbot_soja")
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        setIntegracionesId(data.id);
        setCostoSoja(data.costo_cbot_soja != null ? String(data.costo_cbot_soja) : "110");
      }
    })();
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError("");
    const precioBolsa = parsePrecioInput(manualPrecioBolsa);
    if (!manualCulturaId || !manualFecha || precioBolsa === null || Number.isNaN(precioBolsa)) {
      setManualError("Complete Cultura, Fecha y Precio bolsa (ej. 20000 o 20.000).");
      return;
    }
    setSavingManual(true);
    const { error } = await supabase.from("cbot").insert({
      id_cultura: manualCulturaId,
      vencimiento: manualFecha,
      cierre: precioBolsa,
      precio_bolsa: precioBolsa,
      precio_bolsa_simulacion: precioBolsa,
      variacion: 0,
      alto: precioBolsa,
      bajo: precioBolsa,
      apertura: precioBolsa,
    });
    setSavingManual(false);
    if (error) {
      setManualError(error.message);
      return;
    }
    setManualPrecioBolsa("");
    load();
  };

  const handleSaveCosto = async () => {
    const val = parsePrecioInput(costoSoja);
    const num = typeof val === "number" ? val : 110;
    setSavingCosto(true);
    if (integracionesId) {
      await supabase.from("integraciones").update({ costo_cbot_soja: num }).eq("id", integracionesId);
    } else {
      const { data } = await supabase.from("integraciones").insert({ costo_cbot_soja: num }).select("id").maybeSingle();
      if (data?.id) setIntegracionesId(data.id);
    }
    setSavingCosto(false);
  };

  const handleSyncSoja = async () => {
    setSyncSojaError(null);
    setSyncingSoja(true);
    let msg = "Error al sincronizar";
    try {
      const url = `${supabaseUrl}/functions/v1/cbot-sync`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseAnonKeyExport}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok) {
        msg = data?.error || data?.detail || `Error ${res.status}`;
        setSyncSojaError(msg);
        return;
      }
      if (data?.ok !== true) {
        setSyncSojaError(data?.error || "Sin datos de Yahoo");
        return;
      }
      load();
    } catch (e) {
      setSyncSojaError(e instanceof Error ? e.message : msg);
    } finally {
      setSyncingSoja(false);
    }
  };

  const handleExportCsv = () => {
    const columns = [
      { key: "fecha", header: "Fecha" },
      { key: "cultura", header: "Cultura" },
      { key: "vencimiento", header: "Vencimiento" },
      { key: "cierre", header: "Cierre" },
      { key: "variacion", header: "Variación" },
      { key: "precio_bolsa", header: "Precio Bolsa" }
    ];
    const data = rows.map(r => ({
      fecha: new Date(r.created_at).toLocaleDateString(),
      cultura: r.cultura,
      vencimiento: r.vencimiento || "-",
      cierre: r.cierre?.toFixed(3) || "-",
      variacion: r.variacion?.toFixed(3) || "-",
      precio_bolsa: r.precio_bolsa?.toFixed(3) || "-"
    }));
    exportToCsv(data, `cbot_mkt_${fechaDesde}_${fechaHasta}.csv`, columns);
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-chart-line" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight">Mercado de Chicago (CBOT)</h3>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Histórico de Cotizaciones</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Desde</label>
            <input type="date" className={inputCls} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input type="date" className={inputCls} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all"
          >
            <i className="fas fa-download text-xs" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="mb-6 p-6 rounded-2xl border border-blue-100 bg-blue-50/50">
        <h4 className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
          <i className="fas fa-sync-alt" /> Soja
        </h4>
        <p className="text-[10px] text-blue-600 uppercase tracking-widest font-black mb-3">Fórmula: tonelada = (bushel × 0,367454) − costo; Prec. bolsa = tonelada ÷ 16,666. El costo se guarda y lo usa el cron automático.</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelCls}>Costo por tonelada (se resta)</label>
            <input
              type="text"
              className={inputCls}
              value={costoSoja}
              onChange={(e) => setCostoSoja(e.target.value)}
              placeholder="ej. 110"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveCosto}
            disabled={savingCosto}
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-all"
          >
            {savingCosto ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
            Guardar costo
          </button>
          <button
            type="button"
            onClick={handleSyncSoja}
            disabled={syncingSoja}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {syncingSoja ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-download-alt" />}
            Sincronizar soja ahora
          </button>
        </div>
        {syncSojaError && <p className="mt-2 text-sm text-red-600">{syncSojaError}</p>}
      </div>

      <div className="mb-8 p-6 rounded-2xl border border-amber-100 bg-amber-50/50">
        <h4 className="text-sm font-bold text-amber-800 mb-1 flex items-center gap-2">
          <i className="fas fa-edit" /> Cotización manual (mercado local)
        </h4>
        <p className="text-[10px] text-amber-600 uppercase tracking-widest font-black mb-4">Milho e Trigo — inserção manual</p>
        <form onSubmit={handleManualSubmit} className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelCls}>Cultura</label>
            <select
              className={inputCls}
              value={manualCulturaId}
              onChange={(e) => setManualCulturaId(e.target.value)}
              required
            >
              <option value="">Seleccionar</option>
              {culturasManual.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <input type="date" className={inputCls} value={manualFecha} onChange={(e) => setManualFecha(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Precio bolsa</label>
            <input
              type="text"
              className={inputCls}
              value={manualPrecioBolsa}
              onChange={(e) => setManualPrecioBolsa(e.target.value)}
              placeholder="USD ej. 20.5 o 20000"
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingManual}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-all"
          >
            {savingManual ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
            Guardar
          </button>
        </form>
        {manualError && <p className="mt-2 text-sm text-red-600">{manualError}</p>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="p-20 text-center text-gray-400">
            <i className="fas fa-spinner fa-spin mr-2" />Cargando cotizaciones...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className={tableThCls}>Fecha</th>
                <th className={tableThCls}>Cultura</th>
                <th className={tableThCls}>Vencs.</th>
                <th className={`${tableThCls} text-right`}>Cierre</th>
                <th className={`${tableThCls} text-right`}>Simul.</th>
                <th className={`${tableThCls} text-right`}>Variación</th>
                <th className={`${tableThCls} text-right`}>Alto</th>
                <th className={`${tableThCls} text-right`}>Bajo</th>
                <th className={`${tableThCls} text-right`}>Precio Bolsa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className={tableTdCls}>
                    <div className="font-bold text-gray-900">{new Date(r.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-black">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className={tableTdCls}>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">{r.cultura}</span>
                    {(r.cultura === "maiz" || r.cultura === "trigo") && (
                      <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Manual</span>
                    )}
                  </td>
                  <td className={tableTdCls}>
                    <div className="text-xs text-gray-500 font-bold uppercase">{formatVencimiento(r.vencimiento, r.cultura)}</div>
                    <div className="text-[10px] text-gray-400">CTR: {r.ctr ?? "-"}</div>
                  </td>
                  <td className={`${tableTdCls} text-right font-mono text-gray-900 font-bold tracking-tighter`}>{formatPrecioUsd(r.cierre)}</td>
                  <td className={`${tableTdCls} text-right font-mono text-gray-400`}>{formatPrecioUsd(r.simulacion)}</td>
                  <td className={`${tableTdCls} text-right font-mono font-bold ${(r.variacion ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {(r.variacion ?? 0) > 0 ? '+' : ''}{formatPrecioUsd(r.variacion)}
                  </td>
                  <td className={`${tableTdCls} text-right font-mono text-xs text-gray-400`}>{formatPrecioUsd(r.alto)}</td>
                  <td className={`${tableTdCls} text-right font-mono text-xs text-gray-400`}>{formatPrecioUsd(r.bajo)}</td>
                  <td className={`${tableTdCls} text-right font-mono text-blue-600 font-black`}>${formatPrecioUsd(r.precio_bolsa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-20 text-center text-gray-300">
            <i className="fas fa-layer-group text-3xl mb-3 block opacity-20" />
            No hay datos de mercado disponibles para este período.
          </div>
        )}
      </div>
    </div>
  );
}

function formatNum(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "-";
  return v.toFixed(3);
}

/** Formato USD: hasta 3 decimales sin ceros a la derecha (20.5 no 20.500). */
function formatPrecioUsd(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "-";
  return parseFloat(Number(v).toFixed(3)).toString();
}

/** Parsea precio en USD: si hay coma = formato Latam (20.000 → 20000, 1,5 → 1.5); si no, punto = decimal (20.5 → 20.5). */
function parsePrecioInput(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  if (t.includes(",")) {
    const sinMiles = t.replace(/\./g, "");
    const conDecimal = sinMiles.replace(",", ".");
    const n = parseFloat(conDecimal);
    return Number.isNaN(n) ? null : n;
  }
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function formatVencimiento(vencimiento: string | null, cultura: string): string {
  if (!vencimiento) return "-";
  const d = vencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) {
    const year = parseInt(d[1], 10);
    if (cultura === "soja" && d[2] === "07") return `Soja ${year}/${year + 1} (Safrinha)`;
    if (cultura === "soja" && d[2] === "05") return "Soja Safra normal";
    return new Date(vencimiento).toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
  }
  return vencimiento;
}
