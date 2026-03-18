// Edge Function: sincroniza productos e precios desde VERSAT.
// Catálogo: BP51 o RP21 (si BP51 vacío). Precios: BP71 y RP71 (mismo endpoint Polling/Data).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PAGE_SIZE = 100;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BP51Row {
  id: number;
  Descripcion_hd_cb?: string | null;
  Nombre_comercial_txt?: string | null;
  Marca_txt?: string | null;
  Presentacion_txt?: string | null;
  Fase_cultivo_txt?: string | null;
  Costo_compra_ro?: number | null;
  Costo_contable_ro?: number | null;
  Costo_gerencial_ro?: number | null;
  Producto_status?: string | null;
}

/** Parsea Presentacion_txt → contenido numérico y código de unidad. Reconoce L/Litros, KG/Kilogramos, ML/Mililitro, G/Gramo, Bolsas/Unidad→UN. */
function parsePresentacion(presentacionTxt: string | null | undefined): { contenido: number | null; unidadCodigo: string | null } {
  const t = typeof presentacionTxt === "string" ? presentacionTxt.trim().normalize("NFD").replace(/\u0307/g, "").replace(/\u0301/g, "") : "";
  if (!t) return { contenido: null, unidadCodigo: null };
  const numMatch = t.match(/\d+(?:[.,]\d+)?/);
  const contenido = numMatch ? parseFloat(numMatch[0].replace(",", ".")) : null;
  const u = t.toUpperCase().replace(/Í/g, "I").replace(/Ó/g, "O");
  let unidadCodigo: string | null = null;
  if (/\bKILOGRAMO(S)?\b|\bKG\b/.test(u)) unidadCodigo = "KG";
  else if (/\bMILILITRO(S)?\b|\bML\b/.test(u)) unidadCodigo = "ML";
  else if (/\bLITRO(S)?\b|\bL\b/.test(u)) unidadCodigo = "L";
  else if (/\bGRAMO(S)?\b|\bG\b/.test(u)) unidadCodigo = "G";
  else if (/\bBOLSA(S)?\b|\bUNIDAD(ES)?\b/.test(u)) unidadCodigo = "UN";
  return { contenido, unidadCodigo };
}

/** Normaliza texto de cultura y devuelve codigo si coincide con soja, maiz, trigo. */
function culturaCodigoFromText(txt: string | null | undefined): string | null {
  const t = typeof txt === "string" ? txt.toLowerCase().replace(/\s/g, "").replace(/í/g, "i") : "";
  if (!t) return null;
  if (t.includes("soja")) return "soja";
  if (t.includes("maiz")) return "maiz";
  if (t.includes("trigo")) return "trigo";
  return null;
}

interface BP71Row {
  Producto_id: number;
  P_normal?: number | null;
  P_minimo?: number | null;
}

async function fetchVersatPage(
  baseUrl: string,
  empresaId: number,
  user: string,
  password: string,
  recurso: string,
  page: number,
  allowNonArrayAsEmpty: boolean = false
): Promise<unknown[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/Polling/Data`);
  url.searchParams.set("recurso", recurso);
  url.searchParams.set("empresa_id", String(empresaId));
  url.searchParams.set("registros_por_pagina", String(PAGE_SIZE));
  url.searchParams.set("pagina", String(page));

  const auth = btoa(`${user}:${password}`);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VERSAT ${recurso} ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.Items)) return obj.Items as unknown[];
    const msg = obj.Message ?? obj.ExceptionMessage ?? obj.error;
    if (msg) throw new Error(`VERSAT ${recurso}: ${String(msg).slice(0, 200)}`);
  }
  if (allowNonArrayAsEmpty) return [];
  throw new Error(`VERSAT ${recurso} no devolvió un array. Respuesta: ${JSON.stringify(data).slice(0, 150)}`);
}

async function fetchAllPages(
  baseUrl: string,
  empresaId: number,
  user: string,
  password: string,
  recurso: string,
  allowNonArrayAsEmpty: boolean = false
): Promise<unknown[]> {
  const out: unknown[] = [];
  let page = 1;
  for (;;) {
    const chunk = await fetchVersatPage(baseUrl, empresaId, user, password, recurso, page, allowNonArrayAsEmpty);
    out.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    page++;
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

/** Catálogo: mismo formato que BP51 (id, Descripcion_hd_cb, Nombre_comercial_txt, Marca_txt, etc.). */
interface CatalogRow extends BP51Row {}

/** Lista de precios: Producto_id + precios (BP71 y RP71 usan el mismo esquema). */
interface PriceRow extends BP71Row {}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Parsea una fila CSV respetando comillas (valores entre comillas pueden contener separador). */
function parseCsvRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Parsea CSV completo; primera fila = cabecera. Detecta separador , o ;. */
function parseCsv(csvText: string): { headers: string[]; rows: string[][] } {
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const first = lines[0];
  const semi = (first.match(/;/g) ?? []).length;
  const comma = (first.match(/,/g) ?? []).length;
  const sep = semi >= comma ? ";" : ",";
  const headers = parseCsvRow(lines[0], sep).map((h) => h.replace(/^\uFEFF/, "").toLowerCase().replace(/^\s+|\s+$/g, ""));
  const rows: string[][] = [];
  const headerToken = (h: string) => normalizeToken(h).replace(/_/g, "");
  const expectedCols = headers.length;
  const culturasIdx = headers.findIndex((h) => headerToken(h).includes("culturas"));
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseCsvRow(lines[i], sep);
    // Caso problemático: sep="," y la columna "culturas" contiene comas sin comillas.
    // Si sobran columnas, absorbe extras dentro de "culturas" para mantener alineación.
    if (sep === "," && culturasIdx >= 0 && parsed.length > expectedCols) {
      const extra = parsed.length - expectedCols;
      const merged = parsed.slice(culturasIdx, culturasIdx + extra + 1).join(",").trim();
      const fixed = [
        ...parsed.slice(0, culturasIdx),
        merged,
        ...parsed.slice(culturasIdx + extra + 1),
      ];
      rows.push(fixed);
    } else if (parsed.length < expectedCols) {
      // Pad si falta alguna columna
      rows.push([...parsed, ...new Array(expectedCols - parsed.length).fill("")]);
    } else {
      rows.push(parsed);
    }
  }
  return { headers, rows };
}

async function fetchRecursoAll(
  baseUrl: string,
  empresaId: number,
  user: string,
  password: string,
  recurso: string,
  allowEmpty: boolean = false
): Promise<unknown[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/Polling/Data`);
  url.searchParams.set("recurso", recurso);
  url.searchParams.set("empresa_id", String(empresaId));
  const auth = btoa(`${user}:${password}`);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VERSAT ${recurso} ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.Items)) return obj.Items as unknown[];
    const msg = obj.Message ?? obj.ExceptionMessage ?? obj.error;
    if (msg) throw new Error(`VERSAT ${recurso}: ${String(msg).slice(0, 200)}`);
  }
  if (allowEmpty) return [];
  throw new Error(`VERSAT ${recurso} no devolvió array: ${JSON.stringify(data).slice(0, 150)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", detail: null }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: config, error: configErr } = await supabase
    .from("integraciones")
    .select("versat_base_url, versat_empresa_id, versat_user, versat_password")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (configErr) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Error leyendo integraciones (¿migración aplicada?)",
        detail: configErr.message,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
  if (!config) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No hay ninguna fila en integraciones. Crea una en Ajustes → Integraciones y guarda la config VERSAT.",
        detail: null,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
  if (!config.versat_base_url || config.versat_empresa_id == null || config.versat_empresa_id === undefined || !config.versat_user || !config.versat_password) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Config VERSAT incompleta. En Ajustes → Integraciones rellena URL, Empresa ID, Usuario y Contraseña, luego Actualizar Conexiones.",
        detail: `versat_base_url=${config.versat_base_url ? "ok" : "null"}, versat_empresa_id=${config.versat_empresa_id}, versat_user=${config.versat_user ? "ok" : "null"}, versat_password=${config.versat_password ? "ok" : "null"}`,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const baseUrl = String(config.versat_base_url).trim();
  const empresaId = Number(config.versat_empresa_id);
  const user = String(config.versat_user).trim();
  const password = String(config.versat_password);

  const { data: culturasRows } = await supabase.from("culturas").select("id, codigo");
  const { data: unidadesRows } = await supabase.from("unidades_medida").select("id, codigo, descripcion");
  const { data: categoriasRows } = await supabase.from("categorias_producto").select("id, codigo, descripcion");
  const culturaIdByCodigo = new Map<string, string>();
  for (const c of culturasRows ?? []) culturaIdByCodigo.set((c as { codigo: string }).codigo, (c as { id: string }).id);
  const unidadIdByCodigo = new Map<string, string>();
  for (const u of unidadesRows ?? []) {
    const row = u as { id: string; codigo: string; descripcion?: string | null };
    unidadIdByCodigo.set(row.codigo, row.id);
    unidadIdByCodigo.set(normalizeToken(row.codigo), row.id);
    if (row.descripcion) unidadIdByCodigo.set(normalizeToken(row.descripcion), row.id);
  }
  const categoriaIdByCodigo = new Map<string, string>();
  for (const k of categoriasRows ?? []) {
    const row = k as { id: string; codigo: string; descripcion?: string | null };
    categoriaIdByCodigo.set(row.codigo, row.id);
    categoriaIdByCodigo.set(normalizeToken(row.codigo), row.id);
    if (row.descripcion) categoriaIdByCodigo.set(normalizeToken(row.descripcion), row.id);
  }

  // Alias comunes desde planillas (singular / PT / ES) → codigo de la tabla
  const categoriaAliasToCodigo: Record<string, string> = {
    fungicida: "fungicidas",
    herbicida: "herbicidas",
    inseticida: "insecticidas",
    insecticida: "insecticidas",
    adjuvante: "adyuvantes",
    adyuvante: "adyuvantes",
    fertilizante: "fertilizantes",
    "fertilizante_foliar": "fertilizantes_foliares",
    "fertilizantes_foliares": "fertilizantes_foliares",
    inoculante: "inoculantes",
    biologico: "biologicos",
    biologicos: "biologicos",
    semilla: "semillas",
    semente: "semillas",
    semillas: "semillas",
    "cura_semilla": "cura_semillas",
    bioestimulante: "bioestimulantes",
  };

  let catalogRows: CatalogRow[];
  let catalogSource: "BP51" | "RP21" = "BP51";
  let totalBp51 = 0;
  let totalBp71 = 0;
  let totalRp21 = 0;
  let totalRp71 = 0;
  let diagnostic: unknown = null;

  try {
    const auth = btoa(`${user}:${password}`);

    const bp51Simple = await fetchRecursoAll(baseUrl, empresaId, user, password, "BP51", false).catch(() => [] as unknown[]);
    totalBp51 = Array.isArray(bp51Simple) ? bp51Simple.length : 0;

    if (totalBp51 > 0) {
      catalogRows = bp51Simple as CatalogRow[];
      catalogSource = "BP51";
      if (catalogRows.length >= PAGE_SIZE) {
        let page = 2;
        for (;;) {
          const chunk = await fetchVersatPage(baseUrl, empresaId, user, password, "BP51", page, false);
          catalogRows = catalogRows.concat(chunk as CatalogRow[]);
          totalBp51 = catalogRows.length;
          if (chunk.length < PAGE_SIZE) break;
          page++;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } else {
      const rp21Simple = await fetchRecursoAll(baseUrl, empresaId, user, password, "RP21", true);
      totalRp21 = Array.isArray(rp21Simple) ? rp21Simple.length : 0;
      if (totalRp21 > 0) {
        catalogRows = rp21Simple as CatalogRow[];
        catalogSource = "RP21";
        if (catalogRows.length >= PAGE_SIZE) {
          let page = 2;
          for (;;) {
            const chunk = await fetchVersatPage(baseUrl, empresaId, user, password, "RP21", page, true);
            catalogRows = catalogRows.concat(chunk as CatalogRow[]);
            totalRp21 = catalogRows.length;
            if (chunk.length < PAGE_SIZE) break;
            page++;
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      } else {
        const bp51Paginated = await fetchAllPages(baseUrl, empresaId, user, password, "BP51", false).catch(() => [] as unknown[]);
        totalBp51 = Array.isArray(bp51Paginated) ? bp51Paginated.length : 0;
        if (totalBp51 > 0) {
          catalogRows = bp51Paginated as CatalogRow[];
          catalogSource = "BP51";
        } else {
          const rp21Paginated = await fetchAllPages(baseUrl, empresaId, user, password, "RP21", true).catch(() => [] as unknown[]);
          totalRp21 = Array.isArray(rp21Paginated) ? rp21Paginated.length : 0;
          catalogRows = (totalRp21 > 0 ? rp21Paginated : bp51Paginated) as CatalogRow[];
          if (totalRp21 > 0) catalogSource = "RP21";
        }
      }
    }

    const [bp71Rows, rp71Rows] = await Promise.all([
      fetchAllPages(baseUrl, empresaId, user, password, "BP71", true),
      fetchAllPages(baseUrl, empresaId, user, password, "RP71", true),
    ]);
    totalBp71 = (bp71Rows as PriceRow[]).length;
    totalRp71 = (rp71Rows as PriceRow[]).length;

    const preciosByProducto = new Map<number, { P_normal: number | null; P_minimo: number | null }>();
    for (const r of bp71Rows as PriceRow[]) {
      const id = r.Producto_id;
      preciosByProducto.set(id, {
        P_normal: r.P_normal != null ? Number(r.P_normal) : null,
        P_minimo: r.P_minimo != null ? Number(r.P_minimo) : null,
      });
    }
    for (const r of rp71Rows as PriceRow[]) {
      const id = r.Producto_id;
      preciosByProducto.set(id, {
        P_normal: r.P_normal != null ? Number(r.P_normal) : null,
        P_minimo: r.P_minimo != null ? Number(r.P_minimo) : null,
      });
    }

    const rows: Record<string, unknown>[] = [];
    for (const p of catalogRows) {
      const idVersat = p.id;
      const nombre = p.Nombre_comercial_txt || p.Descripcion_hd_cb || "";
      const precios = preciosByProducto.get(idVersat);
      const estado = (p.Producto_status || "").toLowerCase() === "activo" ? "activo" : "inactivo";
      const costoCompra = p.Costo_compra_ro != null ? Number(p.Costo_compra_ro) : null;
      const costoGerencial = p.Costo_gerencial_ro != null ? Number(p.Costo_gerencial_ro) : null;
      const precioLista = precios?.P_normal ?? null;
      const precioVentaFinal = precioLista ?? costoCompra ?? costoGerencial;

      const presentacionTxt = (p.Presentacion_txt && String(p.Presentacion_txt).trim()) || null;
      const { contenido, unidadCodigo } = parsePresentacion(presentacionTxt ?? undefined);
      const idUnidadMedida = unidadCodigo ? unidadIdByCodigo.get(unidadCodigo) ?? null : null;

      const culturasUuids: string[] = [];
      const faseTxt = p.Fase_cultivo_txt;
      if (faseTxt && typeof faseTxt === "string") {
        const parts = faseTxt.split(/[,;\/]/).map((s) => s.trim()).filter(Boolean);
        const seen = new Set<string>();
        for (const part of parts) {
          const cod = culturaCodigoFromText(part);
          if (cod) {
            const id = culturaIdByCodigo.get(cod);
            if (id && !seen.has(id)) {
              seen.add(id);
              culturasUuids.push(id);
            }
          }
        }
      }
      if (culturasUuids.length === 0 && faseTxt) {
        const cod = culturaCodigoFromText(faseTxt);
        if (cod) {
          const id = culturaIdByCodigo.get(cod);
          if (id) culturasUuids.push(id);
        }
      }
      if (culturasUuids.length === 0) {
        const soja = culturaIdByCodigo.get("soja");
        const maiz = culturaIdByCodigo.get("maiz");
        const trigo = culturaIdByCodigo.get("trigo");
        if (soja) culturasUuids.push(soja);
        if (maiz) culturasUuids.push(maiz);
        if (trigo) culturasUuids.push(trigo);
      }

      rows.push({
        id_versat: idVersat,
        sku: `VERSAT-${idVersat}`,
        nombre: nombre.trim() || `Producto ${idVersat}`,
        fabricante: p.Marca_txt ?? null,
        precio_compra: costoCompra,
        precio_venta: precioVentaFinal,
        precio_final: precioVentaFinal,
        precio_minimo: precios?.P_minimo ?? null,
        estado,
        presentacion_txt: presentacionTxt,
        contenido_empaque: contenido,
        id_unidad_medida: idUnidadMedida,
        culturas: culturasUuids,
        updated_at: new Date().toISOString(),
      });
    }

    let upserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase
        .from("productos")
        .upsert(batch, { onConflict: "id_versat", ignoreDuplicates: false, defaultToNull: false });

      if (error) {
        errors.push(`batch ${i / 50 + 1}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }

    let complemented = 0;
    const complementErrors: string[] = [];

    try {
      const { data: csvData, error: csvErr } = await supabase.storage
        .from("empresa")
        .download("productos_complemento.csv");

      if (csvErr || !csvData) {
        if (csvErr?.message?.includes("404") || csvErr?.message?.toLowerCase().includes("not found")) {
          complementErrors.push("No se encontró productos_complemento.csv en Storage (empresa); se omite complemento.");
        } else {
          complementErrors.push(csvErr?.message ?? "Error al descargar CSV complemento.");
        }
      } else {
        const csvText = new TextDecoder("utf-8").decode(await csvData.arrayBuffer());
        const { headers, rows: csvRows } = parseCsv(csvText);
        if (headers.length === 0 || csvRows.length === 0) {
          complementErrors.push("CSV complemento vacío o sin filas.");
        } else {
          const headerToken = (h: string) => normalizeToken(h).replace(/_/g, "");
          const idx = (name: string) => {
            const wanted = normalizeToken(name).replace(/_/g, "");
            const direct = headers.findIndex((h) => headerToken(h) === wanted);
            if (direct >= 0) return direct;
            return headers.findIndex((h) => headerToken(h).includes(wanted));
          };
          const lastIdxContaining = (substr: string) => {
            const wanted = normalizeToken(substr).replace(/_/g, "");
            for (let i = headers.length - 1; i >= 0; i--) {
              if (headerToken(headers[i]).includes(wanted)) return i;
            }
            return -1;
          };
          const skuIdx = headers.indexOf("sku");
          const idVersatIdx = skuIdx >= 0 ? -1 : idx("id_versat");
          const catIdx = lastIdxContaining("categoria");
          const contIdx = idx("contenido_empaque");
          const unidIdx = idx("unidad_medida") >= 0 ? idx("unidad_medida") : idx("unidad de medida");
          const cultIdx = idx("culturas");

          const chunk = <T,>(arr: T[], size: number) => {
            const out: T[][] = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
          };

          // 1) Pre-scan CSV: guardar filas con key y recolectar claves para buscar productos solo necesarios.
          const csvItems: { rowNum: number; key: string; cells: string[] }[] = [];
          const skuKeys = new Set<string>();
          const versatIds = new Set<number>();

          for (let r = 0; r < csvRows.length; r++) {
            const cells = csvRows[r];
            const skuVal = skuIdx >= 0 && cells[skuIdx] != null ? String(cells[skuIdx]).trim() : null;
            const idVersatVal = idVersatIdx >= 0 && cells[idVersatIdx] != null ? String(cells[idVersatIdx]).trim() : null;
            let key: string | null = skuVal || null;
            if (!key && idVersatVal) {
              const n = Number(idVersatVal);
              key = !Number.isNaN(n) ? `VERSAT-${n}` : idVersatVal;
            }
            if (!key) {
              complementErrors.push(`Fila ${r + 2}: falta sku o id_versat.`);
              continue;
            }
            csvItems.push({ rowNum: r + 2, key, cells });
            skuKeys.add(key);
            if (key.startsWith("VERSAT-")) {
              const n = Number(key.slice("VERSAT-".length));
              if (!Number.isNaN(n)) versatIds.add(n);
            }
            const n2 = Number(key);
            if (!Number.isNaN(n2)) versatIds.add(n2);
          }

          // 2) Buscar productos por sku y/o id_versat en chunks.
          const productosFound: any[] = [];
          for (const part of chunk(Array.from(skuKeys), 500)) {
            const { data } = await supabase
              .from("productos")
              .select("id, sku, nombre, estado, id_versat, id_categoria, contenido_empaque, id_unidad_medida, culturas, presentacion_txt")
              .in("sku", part);
            if (data) productosFound.push(...data);
          }
          for (const part of chunk(Array.from(versatIds), 500)) {
            const { data } = await supabase
              .from("productos")
              .select("id, sku, nombre, estado, id_versat, id_categoria, contenido_empaque, id_unidad_medida, culturas, presentacion_txt")
              .in("id_versat", part);
            if (data) productosFound.push(...data);
          }

          const byKey = new Map<string, { id: string; sku: string; nombre: string; estado: string; id_versat: number | null; id_categoria: string | null; contenido_empaque: number | null; id_unidad_medida: string | null; culturas: string[] | null; presentacion_txt: string | null }>();
          for (const p of productosFound) {
            const row = p as { id: string; sku: string; nombre: string; estado: string; id_versat: number | null; id_categoria: string | null; contenido_empaque: number | null; id_unidad_medida: string | null; culturas: string[] | null; presentacion_txt: string | null };
            byKey.set(row.sku, row);
            if (row.id_versat != null) {
              byKey.set(`VERSAT-${row.id_versat}`, row);
              byKey.set(String(row.id_versat), row);
            }
          }

          // 3) Construir updates y ejecutar upsert por lotes (mucho más rápido que update 1x1).
          const updatesToApply: Record<string, unknown>[] = [];
          for (const item of csvItems) {
            const product = byKey.get(item.key);
            if (!product) {
              complementErrors.push(`Fila ${item.rowNum}: no hay producto con sku/id_versat "${item.key}".`);
              continue;
            }

            const cells = item.cells;
            // Incluimos columnas NOT NULL para evitar que el upsert termine intentando INSERT inválido.
            const updates: Record<string, unknown> = { id: product.id, sku: product.sku, nombre: product.nombre, estado: product.estado, id_versat: product.id_versat };

            if (catIdx >= 0 && cells[catIdx] != null) {
              const raw = String(cells[catIdx]).trim();
              const token = normalizeToken(raw);
              if (token && product.id_categoria == null) {
                const aliasCodigo = categoriaAliasToCodigo[token] ? normalizeToken(categoriaAliasToCodigo[token]) : null;
                const idCat =
                  (aliasCodigo ? categoriaIdByCodigo.get(aliasCodigo) : null) ??
                  categoriaIdByCodigo.get(token) ??
                  categoriaIdByCodigo.get(raw) ??
                  categoriaIdByCodigo.get(raw.toLowerCase());
                if (idCat) updates.id_categoria = idCat;
              }
            }

            if (contIdx >= 0 && cells[contIdx] != null) {
              const val = parseFloat(String(cells[contIdx]).replace(",", "."));
              if (!Number.isNaN(val) && product.contenido_empaque == null) updates.contenido_empaque = val;
            }

            if (unidIdx >= 0 && cells[unidIdx] != null) {
              const raw = String(cells[unidIdx]).trim();
              const token = normalizeToken(raw);
              // Regla: si viene unidad en la planilla, sobrescribir para productos VERSAT.
              if (token && product.id_versat != null) {
                const rawUpper = raw.toUpperCase().replace(/\s+/g, " ").trim();
                let idUn = unidadIdByCodigo.get(token) ?? unidadIdByCodigo.get(rawUpper);
                if (!idUn) {
                  const parsed = parsePresentacion(raw);
                  if (parsed.unidadCodigo) {
                    idUn = unidadIdByCodigo.get(parsed.unidadCodigo) ?? unidadIdByCodigo.get(normalizeToken(parsed.unidadCodigo));
                  }
                }
                if (idUn) {
                  updates.id_unidad_medida = idUn;
                  // Mejor visual: presentacion_txt estándar usando contenido_empaque + unidad (si disponible).
                  const parsed = parsePresentacion(raw);
                  const unidadCodigo = (parsed.unidadCodigo ?? rawUpper).replace(/\s+/g, " ").trim();
                  const contenidoFromCsv = contIdx >= 0 && cells[contIdx] != null ? parseFloat(String(cells[contIdx]).replace(",", ".")) : NaN;
                  const contenido = !Number.isNaN(contenidoFromCsv) ? contenidoFromCsv : product.contenido_empaque ?? null;
                  updates.presentacion_txt = (contenido != null && unidadCodigo)
                    ? `${contenido} ${unidadCodigo}`.replace(/\s+/g, " ").trim()
                    : (unidadCodigo || null);
                }
              }
            }

            if (cultIdx >= 0 && cells[cultIdx] != null) {
              const raw = String(cells[cultIdx]).trim();
              if (raw && (!product.culturas || product.culturas.length === 0)) {
                const codigos = raw.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
                const ids: string[] = [];
                for (const cod of codigos) {
                  const id = culturaIdByCodigo.get(cod);
                  if (id && !ids.includes(id)) ids.push(id);
                }
                if (ids.length > 0) updates.culturas = ids;
              }
            }

            if (Object.keys(updates).length > 1) {
              updates.updated_at = new Date().toISOString();
              updatesToApply.push(updates);
            }
          }

          for (const part of chunk(updatesToApply, 200)) {
            const { error: upErr } = await supabase.from("productos").upsert(part, { onConflict: "id", defaultToNull: false });
            if (upErr) complementErrors.push(upErr.message);
            else complemented += part.length;
          }
        }
      }
    } catch (complE) {
      complementErrors.push(complE instanceof Error ? complE.message : String(complE));
    }

    const payload: Record<string, unknown> = {
      ok: errors.length === 0 && rows.length > 0,
      synced: upserted,
      total: rows.length,
      complemented,
      catalog_source: catalogSource,
      total_bp51: totalBp51,
      total_bp71: totalBp71,
      total_rp21: totalRp21,
      total_rp71: totalRp71,
      errors: errors.length ? errors : undefined,
      complement_errors: complementErrors.length ? complementErrors : undefined,
    };
    if (rows.length === 0) {
      payload.ok = false;
      payload.error = "Ni BP51 ni RP21 devolvieron productos. Revisa empresa_id y acceso del usuario (BP51 Insumos / RP21 catálogo CRM).";
      payload.detail = `empresa_id=${empresaId}, URL=${baseUrl}`;
      if (diagnostic != null) payload.diagnostic = diagnostic;
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: "Error fetching VERSAT", detail: message, diagnostic }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
