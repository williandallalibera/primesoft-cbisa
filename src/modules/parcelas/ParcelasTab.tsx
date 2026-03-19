import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import { formatDecimal } from "../productos/utils";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => {
          setCenter: (c: object) => void;
          setZoom: (z: number) => void;
          fitBounds: (b: any) => void;
        };
        event: { addListener: (obj: object, ev: string, fn: (p: unknown) => void) => void };
        geometry: { spherical: { computeArea: (path: any) => number } };
        drawing: {
          DrawingManager: new (opts: object) => {
            setMap: (m: any) => void;
            setDrawingMode: (mode: any) => void;
          };
          OverlayType: { POLYGON: string };
        };
        Polygon: new (opts: object) => any;
        LatLngBounds: new () => any;
        LatLng: new (lat: number, lng: number) => any;
      };
    };
    initParcelasMap?: () => void;
  }
}

interface ParcelaRow {
  id: string;
  nombre_parcela: string;
  localidad: string | null;
  area_prevista_ha: number | null;
  area_real_ha: number | null;
  estado: string;
  id_cliente: string;
  cliente_nombre: string;
  geom: any | null;
  created_at: string;
}

const PARAGUAY_CENTER = { lat: -23.4425, lng: -58.4438 };
const DEFAULT_ZOOM = 6;

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:border-agro-primary focus:ring-2 focus:ring-agro-primary/20 outline-none transition-all";
const labelCls = "block text-xs font-bold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-agro-primary text-white text-sm font-bold rounded-xl shadow shadow-agro-primary/20 hover:opacity-90 transition-all active:scale-95 touch-manipulation";
const btnSecondary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all touch-manipulation";

function getPolygonSvgUrl(geom: any): string | null {
  if (!geom || geom.type !== "Polygon" || !geom.coordinates?.[0]?.length) return null;
  const coords = geom.coordinates[0] as [number, number][];
  if (coords.length < 3) return null;

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const pad = 6;
  const sz = 48;
  const inner = sz - pad * 2;
  const dLng = maxLng - minLng || 0.0001;
  const dLat = maxLat - minLat || 0.0001;
  const scale = Math.min(inner / dLng, inner / dLat);
  const oX = pad + (inner - dLng * scale) / 2;
  const oY = pad + (inner - dLat * scale) / 2;

  const points = coords
    .map(([lng, lat]) => `${(oX + (lng - minLng) * scale).toFixed(1)},${(oY + (maxLat - lat) * scale).toFixed(1)}`)
    .join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><rect width="${sz}" height="${sz}" rx="6" fill="%23f0fdf4"/><polygon points="${points}" fill="rgba(34%2C197%2C94%2C0.25)" stroke="%2316a34a" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml,${svg}`;
}

export function ParcelasTab() {
  const { perfil } = useAuth();
  const [rows, setRows] = useState<ParcelaRow[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ParcelaRow | null>(null);
  const [form, setForm] = useState({
    id_cliente: "",
    nombre_parcela: "",
    localidad: "",
    area_prevista_ha: "",
    area_real_ha: "",
    estado: "activo",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [filterEstado, setFilterEstado] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterBusqueda, setFilterBusqueda] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const polygonRef = useRef<unknown>(null);
  const drawingManagerRef = useRef<unknown>(null);
  const [historyState, setHistoryState] = useState({ list: [] as (any[] | null)[], step: -1 });
  const [viewPolygon, setViewPolygon] = useState<ParcelaRow | null>(null);
  const viewMapRef = useRef<HTMLDivElement>(null);
  const isRedrawing = useRef(false);
  const saveTimeout = useRef<any>(null);
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

  const saveHistoryStateRef = useRef<any>(null);
  const updateAreaDisplayRef = useRef<any>(null);

  useEffect(() => {
    saveHistoryStateRef.current = saveHistoryState;
    updateAreaDisplayRef.current = updateAreaDisplay;
  });

  const loadParcelas = async () => {
    const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
    if (isReviewMode) {
      console.log("ParcelasTab: Review Mode - Injecting mock parcelas");
      setRows([{
        id: "pa-1", nombre_parcela: "Lote 1", localidad: "San Alberto", area_prevista_ha: 105, area_real_ha: 100, estado: "activo", id_cliente: "cl-1", cliente_nombre: "Fazenda Santa Maria", geom: null, created_at: new Date().toISOString()
      }]);
      return;
    }

    let q = supabase
      .from("parcelas")
      .select("id, nombre_parcela, localidad, area_prevista_ha, area_real_ha, estado, id_cliente, geom, created_at")
      .order("created_at", { ascending: false });

    if (perfil?.perfil_acceso === "rtv") {
      const { data: clientesRtv } = await supabase
        .from("clientes")
        .select("id")
        .eq("id_vendedor", perfil.id);
      const ids = (clientesRtv ?? []).map((c: { id: string }) => c.id);
      if (!ids.length) {
        setRows([]);
        return;
      }
      q = q.in("id_cliente", ids);
    }

    const { data, error } = await q;

    if (!error && data) {
      const ids = [...new Set((data as any[]).map((d) => d.id_cliente))];
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: c } = await supabase.from("clientes").select("id, nombre").in("id", ids);
        if (c) names = Object.fromEntries((c as any[]).map((x) => [x.id, x.nombre]));
      }
      setRows(
        (data as any[]).map((d) => ({
          id: d.id,
          nombre_parcela: d.nombre_parcela,
          localidad: d.localidad,
          area_prevista_ha: d.area_prevista_ha,
          area_real_ha: d.area_real_ha,
          estado: d.estado,
          id_cliente: d.id_cliente,
          cliente_nombre: names[d.id_cliente] ?? "",
          geom: d.geom,
          created_at: d.created_at,
        }))
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isReviewMode = localStorage.getItem("forceAuthReview") === "true";
      await loadParcelas();

      const envKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY ?? null;

      if (isReviewMode) {
        setClientes([{ id: "cl-1", nombre: "Fazenda Santa Maria" }]);
        setApiKey(envKey || "AIzaSyBiZxljlMaoLLgpqN1qkMLhawWlF0nkQh4");
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("clientes").select("id, nombre").eq("estado", "activo");
      if (data) setClientes(data as any);

      const { data: int } = await supabase.from("integraciones").select("api_google_maps").limit(1).maybeSingle();
      const dbKey = (int as any)?.api_google_maps ?? null;
      setApiKey(dbKey || envKey || "AIzaSyBiZxljlMaoLLgpqN1qkMLhawWlF0nkQh4");
      setLoading(false);
    };
    load();
  }, []);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterEstado) list = list.filter((r) => r.estado === filterEstado);
    if (filterCliente) list = list.filter((r) => r.id_cliente === filterCliente);
    if (filterBusqueda.trim()) {
      const q = filterBusqueda.toLowerCase();
      list = list.filter(
        (r) =>
          r.nombre_parcela.toLowerCase().includes(q) ||
          (r.localidad && r.localidad.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, filterEstado, filterCliente, filterBusqueda]);

  useEffect(() => {
    if (!showModal || !apiKey || !mapRef.current) return;
    if (window.google?.maps) {
      initMap();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initParcelasMap`;
    script.async = true;
    script.onerror = () => {
      console.error("Google Maps failed to load. Check your API Key.");
      setLoading(false);
    };
    window.initParcelasMap = () => {
      setMapReady(true);
    };
    document.head.appendChild(script);
    return () => {
      window.initParcelasMap = undefined;
    };
  }, [showModal, apiKey]);

  useEffect(() => {
    if (mapReady && mapRef.current && window.google && !mapInstanceRef.current) {
      initMap();
    }
  }, [mapReady]);

  function initMap() {
    const g = window.google;
    if (!mapRef.current || !g) return;

    const map = new g.maps.Map(mapRef.current, {
      center: PARAGUAY_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: 'satellite',
      draggableCursor: 'crosshair',
      draggingCursor: 'crosshair',
    });
    mapRef.current.style.cursor = "crosshair";
    mapInstanceRef.current = map;

    const polygonOptions = {
      fillColor: "rgba(100, 180, 255, 0.4)",
      strokeColor: "#64b4ff",
      strokeWeight: 2,
      clickable: true,
      editable: true,
    };

    // Removemos o DrawingManager para assumir o controle ponto a ponto.

    if (editing?.geom && editing.geom.type === "Polygon") {
      const coords = editing.geom.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] }));
      const poly = new g.maps.Polygon({
        paths: coords,
        ...polygonOptions
      });
      poly.setMap(map);
      polygonRef.current = poly;

      const path = poly.getPath();
      g.maps.event.addListener(path, "insert_at", () => {
        console.log("Map: insert_at");
        saveHistoryStateRef.current?.(poly);
      });
      g.maps.event.addListener(path, "remove_at", () => {
        console.log("Map: remove_at");
        saveHistoryStateRef.current?.(poly);
      });
      g.maps.event.addListener(path, "set_at", () => {
        console.log("Map: set_at");
        saveHistoryStateRef.current?.(poly);
      });

      // Initial state
      const initialCoords = coords.map((c: any) => ({ lat: c.lat, lng: c.lng }));
      setHistoryState({ list: [initialCoords], step: 0 });

      const bounds = new g.maps.LatLngBounds();
      coords.forEach((c: any) => bounds.extend(c));
      map.fitBounds(bounds);
    }

    // Controle customizado para desenho e edição Ponto-a-Ponto (Undo dinâmico)
    g.maps.event.addListener(map, "click", (e: any) => {
      let p = polygonRef.current as any;

      if (!p) {
        // Inicia um novo polígono com o primeiro ponto
        p = new g.maps.Polygon({
          paths: [e.latLng],
          ...polygonOptions
        });
        p.setMap(map);
        polygonRef.current = p;

        const path = p.getPath();
        g.maps.event.addListener(path, "insert_at", () => {
          saveHistoryStateRef.current?.(p);
        });
        g.maps.event.addListener(path, "remove_at", () => {
          saveHistoryStateRef.current?.(p);
        });
        g.maps.event.addListener(path, "set_at", () => {
          saveHistoryStateRef.current?.(p);
        });

        // Salva imediatamente o estado contendo o 1º ponto
        saveHistoryStateRef.current?.(p, true);
      } else {
        // Se já existe, apenas adiciona o ponto no final (dispara insert_at e salva no histórico)
        const path = p.getPath();
        path.push(e.latLng);
      }
    });
  }

  // Saving state for undo/redo
  const saveHistoryState = (poly: any, immediate = false) => {
    if (isRedrawing.current) return;

    const save = () => {
      console.log("saveHistoryState: executing save...");
      // poly might be null if we are saving an empty state (clear)
      let currentCoords: any[] | null = null;
      if (poly) {
        const path = poly.getPath();
        currentCoords = [];
        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          currentCoords.push({ lat: pt.lat(), lng: pt.lng() });
        }
      }

      setHistoryState(prev => {
        const last = prev.list[prev.step];
        if (last && currentCoords && JSON.stringify(last) === JSON.stringify(currentCoords)) {
          console.log("saveHistoryState: identical state, ignoring");
          return prev;
        }

        const newList = prev.list.slice(0, prev.step + 1);
        newList.push(currentCoords);
        console.log("saveHistoryState: saved. new step =", newList.length - 1, newList);
        return { list: newList, step: newList.length - 1 };
      });
      if (poly) updateAreaDisplayRef.current?.(poly);
      else setForm(f => ({ ...f, area_prevista_ha: "" }));
    };

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (immediate) {
      save();
    } else {
      saveTimeout.current = setTimeout(save, 500);
    }
  };

  const updateAreaDisplay = (poly: any) => {
    const g = window.google;
    if (!g) return;
    const areaM2 = g.maps.geometry.spherical.computeArea(poly.getPath());
    const areaHa = Number((areaM2 / 10000).toFixed(3));
    setForm((f) => ({ ...f, area_prevista_ha: String(areaHa) }));
  }

  const handleUndo = () => {
    console.log("handleUndo: current step", historyState.step);
    if (historyState.step >= 0) {
      const newStep = historyState.step - 1;
      setHistoryState(prev => ({ ...prev, step: newStep }));
      const coords = newStep >= 0 ? historyState.list[newStep] : null;
      if (!coords) {
        clearMap(false); // clear map but don't reset history list
      } else {
        redrawPolygon(coords);
      }
    }
  };

  const handleRedo = () => {
    if (historyState.step < historyState.list.length - 1) {
      const newStep = historyState.step + 1;
      setHistoryState(prev => ({ ...prev, step: newStep }));

      // Se estava vazio e vai refazer o primeiro, precisa garantir que o polígono existe
      // (caso o usuário tenha limpado o mapa via Undo)
      const coords = historyState.list[newStep];
      if (!coords) return;

      if (!polygonRef.current) {
        reconstructPolygon(coords);
      } else {
        redrawPolygon(coords);
      }
    }
  };

  const reconstructPolygon = (coords: any[] | null) => {
    if (!coords) return;
    const g = window.google;
    if (!g || !mapInstanceRef.current) return;
    const poly = new g.maps.Polygon({
      paths: coords,
      fillColor: "rgba(100, 180, 255, 0.4)",
      strokeColor: "#64b4ff",
      strokeWeight: 2,
      clickable: true,
      editable: true,
    });
    poly.setMap(mapInstanceRef.current as any);
    polygonRef.current = poly;

    const path = poly.getPath();
    g.maps.event.addListener(path, "insert_at", () => saveHistoryStateRef.current?.(poly));
    g.maps.event.addListener(path, "remove_at", () => saveHistoryStateRef.current?.(poly));
    g.maps.event.addListener(path, "set_at", () => saveHistoryStateRef.current?.(poly));

    updateAreaDisplayRef.current?.(poly);
  };

  const redrawPolygon = (coords: any[] | null) => {
    const p = polygonRef.current as any;
    if (!p || !coords) return;
    isRedrawing.current = true;

    // Evita resetar toda a MVCArray usando setPath (pois destrói os listeners). 
    // Em vez disso, limpamos a path e repovoamos.
    const path = p.getPath();
    const g = window.google;
    if (!g) return;

    path.clear();
    coords.forEach((c: any) => {
      const isLatLng = typeof c.lat === "function";
      path.push(isLatLng ? c : new g.maps.LatLng(c.lat, c.lng));
    });

    updateAreaDisplay(p);
    setTimeout(() => {
      isRedrawing.current = false;
    }, 100);
  };

  const clearMap = (resetHistory = true) => {
    const p = polygonRef.current as { setMap: (m: null) => void } | null;
    if (p) {
      p.setMap(null);
      polygonRef.current = null;
    }
    if (resetHistory) {
      setHistoryState({ list: [], step: -1 });
    }
    setForm((f) => ({ ...f, area_prevista_ha: "" }));
  };

  const handleManualClear = () => {
    saveHistoryState(null, true); // save an empty state in history
    clearMap(false); // clear map but keep history list
  };

  const centerMapAt = (lat: number, lng: number, zoom = 14) => {
    const m = mapInstanceRef.current as { setCenter: (c: object) => void; setZoom: (z: number) => void } | null;
    if (m) {
      m.setCenter({ lat, lng });
      m.setZoom(zoom);
    }
  };

  const centerOnParaguay = () => {
    centerMapAt(PARAGUAY_CENTER.lat, PARAGUAY_CENTER.lng, 8);
    setGeoMessage(null);
  };

  const miraMap = () => {
    if (!mapInstanceRef.current || geoLoading) return;
    if (!navigator.geolocation) {
      setGeoMessage({ type: "error", text: "Este navegador no soporta geolocalización." });
      return;
    }

    const mapErrorMessage = (code: number) => {
      if (code === 1) return "Permiso de ubicación denegado. Habilite la ubicación para este sitio.";
      if (code === 2) return "No se pudo determinar la ubicación actual. Use «Centrar en Paraguay» para volver al mapa.";
      if (code === 3) return "Tiempo de espera agotado. Use «Centrar en Paraguay» para volver al mapa.";
      return "No se pudo obtener la ubicación. Use «Centrar en Paraguay» si desea volver al mapa.";
    };

    const requestPosition = (options?: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const run = async () => {
      setGeoLoading(true);
      setGeoMessage(null);
      try {
        const attempts: PositionOptions[] = [
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        ];

        let lastErrorCode = 0;
        let located = false;

        for (const options of attempts) {
          try {
            const pos = await requestPosition(options);
            centerMapAt(pos.coords.latitude, pos.coords.longitude, 14);
            located = true;
            break;
          } catch (err: any) {
            lastErrorCode = err?.code ?? 0;
            if (lastErrorCode === 1) break;
          }
        }

        if (!located && (lastErrorCode === 2 || lastErrorCode === 3)) {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 7000);
            const res = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
            clearTimeout(t);
            const data = await res.json();
            const lat = data?.latitude;
            const lng = data?.longitude;
            if (typeof lat === "number" && typeof lng === "number") {
              centerMapAt(lat, lng, 14);
              setGeoMessage({ type: "info", text: "Ubicación aproximada por red." });
              located = true;
            }
          } catch (_) {
            // fallback IP falhou; manter mensagem de erro
          }
        }

        if (!located) {
          setGeoMessage({ type: "error", text: mapErrorMessage(lastErrorCode) });
        }
      } finally {
        setGeoLoading(false);
      }
    };
    run();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      id_cliente: "",
      nombre_parcela: "",
      localidad: "",
      area_prevista_ha: "",
      area_real_ha: "",
      estado: "activo",
    });
    setClientSearch("");
    setClientDropdownOpen(false);
    if (mapInstanceRef.current) {
      const p = polygonRef.current as { setMap: (m: null) => void } | null;
      if (p) {
        p.setMap(null);
        polygonRef.current = null;
      }
      mapInstanceRef.current = null;
      const dm = drawingManagerRef.current as { setMap: (m: null) => void } | null;
      if (dm) dm.setMap(null);
      drawingManagerRef.current = null;
    }
    setHistoryState({ list: [], step: -1 });
    setMapReady(false);
    setShowModal(false);
  };

  const handleNuevo = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (row: ParcelaRow) => {
    setEditing(row);
    setForm({
      id_cliente: row.id_cliente,
      nombre_parcela: row.nombre_parcela,
      localidad: row.localidad ?? "",
      area_prevista_ha: row.area_prevista_ha != null ? String(row.area_prevista_ha) : "",
      area_real_ha: row.area_real_ha != null ? String(row.area_real_ha) : "",
      estado: row.estado,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.area_real_ha === "" || Number(form.area_real_ha) <= 0) {
      setGeoMessage({ type: "error", text: "Área real (ha) es obligatoria y debe ser mayor a 0." });
      return;
    }
    setSaving(true);
    let geom: object | null = null;
    const poly = polygonRef.current as { getPath: () => { getLength: () => number; getAt: (i: number) => { lat: () => number; lng: () => number } } } | null;
    if (poly) {
      const path = poly.getPath();
      const coords: [number, number][] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const pt = path.getAt(i);
        coords.push([pt.lng(), pt.lat()]);
      }
      // Close the ring for GeoJSON standard
      if (coords.length > 2) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push([first[0], first[1]]);
        }
      }
      geom = { type: "Polygon", coordinates: [coords] };
    }
    const payload = {
      id_cliente: form.id_cliente,
      nombre_parcela: form.nombre_parcela.trim(),
      localidad: form.localidad.trim() || null,
      area_prevista_ha: form.area_prevista_ha !== "" ? Number(form.area_prevista_ha) : null,
      area_real_ha: form.area_real_ha !== "" ? Number(form.area_real_ha) : null,
      estado: form.estado,
      geom: geom ?? undefined,
    };
    if (editing) {
      await supabase.from("parcelas").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("parcelas").insert(payload);
    }
    await loadParcelas();
    resetForm();
    setSaving(false);
  };

  useEffect(() => {
    if (!viewPolygon || !viewMapRef.current || !apiKey) return;
    const tryInit = () => {
      const g = window.google;
      if (!g || !viewMapRef.current) return;
      const map = new g.maps.Map(viewMapRef.current, {
        center: PARAGUAY_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        zoomControl: true,
      });
      if (viewPolygon.geom?.type === "Polygon" && viewPolygon.geom.coordinates[0]) {
        const coords = viewPolygon.geom.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] }));
        const poly = new g.maps.Polygon({
          paths: coords,
          fillColor: "rgba(160, 120, 255, 0.35)",
          strokeColor: "#7c3aed",
          strokeWeight: 2,
          clickable: false,
          editable: false,
        });
        poly.setMap(map);
        const bounds = new g.maps.LatLngBounds();
        coords.forEach((c: any) => bounds.extend(c));
        map.fitBounds(bounds);
      }
    };
    if (window.google?.maps) {
      setTimeout(tryInit, 50);
    } else if (apiKey) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry`;
      script.async = true;
      script.onload = () => setTimeout(tryInit, 50);
      document.head.appendChild(script);
    }
  }, [viewPolygon, apiKey]);

  const exportCsv = () => {
    const cols = [
      { key: "nombre_parcela", header: "Nombre parcela" },
      { key: "cliente_nombre", header: "Cliente" },
      { key: "localidad", header: "Localidad" },
      { key: "area_prevista_ha", header: "Área prevista (ha)" },
      { key: "area_real_ha", header: "Área real (ha)" },
      { key: "estado", header: "Estado" },
      { key: "created_at", header: "Fecha criação" },
    ];
    const csv =
      cols.map((c) => c.header).join(",") +
      "\n" +
      filteredRows
        .map((r) =>
          cols
            .map((c) => {
              const v = (r as any)[c.key];
              if (c.key === "created_at") return new Date(v).toLocaleDateString("es-PY");
              return v ?? "";
            })
            .join(",")
        )
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parcelas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2" />Cargando parcelas...
    </div>
  );

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-5 items-end">
        <div className="w-full sm:min-w-[140px]">
          <label className={labelCls}>Estado</label>
          <select
            className={`${inputCls} min-h-[44px]`}
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            {ESTADOS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:min-w-[180px]">
          <label className={labelCls}>Cliente</label>
          <select
            className={`${inputCls} min-h-[44px]`}
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
        <div className="w-full lg:flex-1 lg:min-w-[200px]">
          <label className={labelCls}>Buscar</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              className={`${inputCls} pl-8 min-h-[44px]`}
              placeholder="Nombre o localidade..."
              value={filterBusqueda}
              onChange={(e) => setFilterBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <button type="button" className={btnPrimary} onClick={handleNuevo}>
            <i className="fas fa-plus text-xs" /> Nuevo
          </button>
          <button type="button" className={btnSecondary} onClick={exportCsv}>
            <i className="fas fa-download text-xs" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Mapa</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Nombre parcela</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Localidad</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Área prev (ha)</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Área real (ha)</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === "inactivo" ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden shadow-sm">
                    {getPolygonSvgUrl(r.geom) ? (
                      <img src={getPolygonSvgUrl(r.geom)!} alt="Polígono" className="w-full h-full" />
                    ) : (
                      <i className="fas fa-map-marked-alt text-gray-300 text-lg" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.nombre_parcela}</td>
                <td className="px-4 py-3 text-gray-600">{r.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-500">{r.localidad ?? "—"}</td>
                <td className="px-4 py-3 text-gray-900 font-mono">{formatDecimal(r.area_prevista_ha)}</td>
                <td className="px-4 py-3 text-gray-900 font-mono">{formatDecimal(r.area_real_ha)}</td>
                <td className="px-4 py-3">
                  {r.estado === "activo" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("es-PY")}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.geom && (
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-violet-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors touch-manipulation"
                        onClick={() => setViewPolygon(r)}
                      >
                        <i className="fas fa-eye" /> <span className="sm:inline">Ver</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-agro-primary hover:bg-agro-primary/10 rounded-lg transition-colors touch-manipulation"
                      onClick={() => handleEdit(r)}
                    >
                      <i className="fas fa-edit" /> <span className="sm:inline">Editar</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <i className="fas fa-map-marked-alt mb-2 text-2xl block" />
            No hay parcelas registradas.
          </div>
        )}
      </div>

      {/* ── Modal Ver Polígono (solo lectura) ── */}
      {viewPolygon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center shrink-0">
                  <i className="fas fa-eye text-sm" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 leading-tight text-sm sm:text-base truncate">Polígono de Parcela</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold truncate">
                    {viewPolygon.cliente_nombre} / {viewPolygon.nombre_parcela}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setViewPolygon(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation shrink-0">
                <i className="fas fa-times text-lg" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-4 text-xs">
                {viewPolygon.localidad && (
                  <div><span className="font-bold text-gray-400 uppercase">Localidad:</span> <span className="text-gray-700">{viewPolygon.localidad}</span></div>
                )}
                {viewPolygon.area_prevista_ha != null && (
                  <div><span className="font-bold text-gray-400 uppercase">Área prevista:</span> <span className="text-gray-700 font-mono">{formatDecimal(viewPolygon.area_prevista_ha)} ha</span></div>
                )}
                {viewPolygon.area_real_ha != null && (
                  <div><span className="font-bold text-gray-400 uppercase">Área real:</span> <span className="text-gray-700 font-mono">{formatDecimal(viewPolygon.area_real_ha)} ha</span></div>
                )}
              </div>
              <div className="rounded-2xl overflow-hidden border border-violet-200 shadow-sm">
                <div ref={viewMapRef} style={{ height: "400px", width: "100%", background: "#f8f9fa" }} />
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex-shrink-0 text-right bg-gray-50 rounded-b-xl sm:rounded-b-2xl">
              <button type="button" className={btnSecondary} onClick={() => setViewPolygon(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-agro-primary/10 text-agro-primary rounded-lg flex items-center justify-center shrink-0">
                  <i className="fas fa-map-marker-alt text-sm" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                  {editing ? "Editar parcela" : "Nueva parcela"}
                </h3>
              </div>
              <button type="button" onClick={resetForm} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors touch-manipulation shrink-0">
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                {!apiKey && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                    <i className="fas fa-exclamation-triangle text-amber-500" />
                    Configure la API de Google Maps en Ajustes &gt; Integraciones para usar el mapa.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={labelCls}>Cliente *</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Escriba para buscar..."
                        value={form.id_cliente ? selectedClienteNombre : clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setForm((f) => ({ ...f, id_cliente: "" }));
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
                                  setForm((f) => ({ ...f, id_cliente: c.id }));
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
                    <label className={labelCls}>Nombre parcela *</label>
                    <input
                      className={inputCls}
                      placeholder="Nombre de la parcela"
                      value={form.nombre_parcela}
                      onChange={(e) => setForm({ ...form, nombre_parcela: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Localidad</label>
                    <input
                      className={inputCls}
                      placeholder="Localidad"
                      value={form.localidad}
                      onChange={(e) => setForm({ ...form, localidad: e.target.value })}
                    />
                  </div>
                </div>

                {apiKey && (
                  <div className="space-y-2">
                    <label className={labelCls}>Mapa – dibuje el polígono en el mapa</label>
                    {geoMessage && (
                      <div
                        className={`px-3 py-2 rounded-lg text-xs border ${
                          geoMessage.type === "error"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-blue-50 border-blue-200 text-blue-800"
                        }`}
                      >
                        {geoMessage.text}
                      </div>
                    )}
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                      <div
                        ref={mapRef}
                        style={{ height: "400px", width: "100%", background: "#f8f9fa" }}
                      />
                      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 z-10">
                        <button type="button" className={`min-h-[44px] px-3 py-2 bg-white shadow-md rounded-xl text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border border-gray-100 transition-all touch-manipulation ${historyState.step >= 0 ? "text-gray-700" : "text-gray-300 cursor-not-allowed"}`} onClick={handleUndo} disabled={historyState.step < 0}>
                          <i className="fas fa-undo" /> Deshacer
                        </button>
                        <button type="button" className={`min-h-[44px] px-3 py-2 bg-white shadow-md rounded-xl text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border border-gray-100 transition-all touch-manipulation ${historyState.step < historyState.list.length - 1 ? "text-gray-700" : "text-gray-300 cursor-not-allowed"}`} onClick={handleRedo} disabled={historyState.step >= historyState.list.length - 1}>
                          <i className="fas fa-redo" /> Rehacer
                        </button>
                        <button
                          type="button"
                          className={`min-h-[44px] px-3 py-2 bg-white shadow-md rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 border border-gray-100 touch-manipulation ${geoLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          onClick={miraMap}
                          disabled={geoLoading}
                        >
                          {geoLoading ? <i className="fas fa-spinner fa-spin text-agro-primary" /> : <i className="fas fa-location-arrow text-agro-primary" />}
                          <span className="whitespace-nowrap">{geoLoading ? " Localizando..." : " Mi ubicación"}</span>
                        </button>
                        <button type="button" className="min-h-[44px] px-3 py-2 bg-white shadow-md rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 border border-gray-100 touch-manipulation whitespace-nowrap" onClick={centerOnParaguay}>
                          <i className="fas fa-map-marker-alt text-agro-primary" /> Centrar Paraguay
                        </button>
                        <button type="button" className="min-h-[44px] px-3 py-2 bg-white shadow-md rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 border border-gray-100 touch-manipulation" onClick={handleManualClear}>
                          <i className="fas fa-trash-alt text-red-500" /> Limpiar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Área prevista (ha)</label>
                    <input
                      type="text"
                      className={`${inputCls} bg-gray-50 font-mono`}
                      readOnly
                      value={form.area_prevista_ha}
                      placeholder="Automático (mapa)"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Área real (ha) *</label>
                    <input
                      type="number"
                      step="0.001"
                      className={inputCls}
                      placeholder="0.000"
                      value={form.area_real_ha}
                      onChange={(e) => setForm({ ...form, area_real_ha: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select
                      className={inputCls}
                      value={form.estado}
                      onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <button type="button" className={btnSecondary} onClick={resetForm}>Cancelar</button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin text-xs" /> Guardando...</>
                  ) : editing ? "Guardar cambios" : "Crear parcela"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}