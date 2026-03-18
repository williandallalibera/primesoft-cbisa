// Edge Function: sincroniza clientes desde VERSAT (recurso RC31).
// Misma config que productos (integraciones); mismo endpoint Polling/Data; upsert por id_versat.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PAGE_SIZE = 100;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v != null && typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Convierte valor a string si es string o number (RUC/CI a veces vienen como número). */
function toStr(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "number" && !Number.isNaN(val)) return String(val).trim() || null;
  return null;
}

/** Obtiene string probando keys explícitas y luego cualquier key que contenga alguna de las subcadenas (case-insensitive). Acepta string o number. */
function getStrFlex(r: Record<string, unknown>, explicitKeys: string[], ...substrings: string[]): string | null {
  for (const k of explicitKeys) {
    const v = toStr(r[k]);
    if (v) return v;
  }
  const lower = (s: string) => s.toLowerCase();
  for (const key of Object.keys(r)) {
    const keyLower = lower(key);
    if (substrings.some((s) => keyLower.includes(lower(s)))) {
      const v = toStr(r[key]);
      if (v) return v;
    }
  }
  return null;
}

/** Extrae solo dígitos para RUC (ej. "5020639-7 / NOVAK" → "50206397"). Si no hay 6+ dígitos, retorna null (no guardar texto como "Factura, Remision, Recibo"). */
function normalizeRuc(value: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 6 && digitsOnly.length <= 20) return digitsOnly;
  const match = trimmed.match(/\d{6,15}/);
  if (match) return match[0];
  return null;
}

/** Último recurso: busca en todo el objeto un valor string que parezca email (contiene @). */
function findEmailInObject(r: Record<string, unknown>): string | null {
  for (const key of Object.keys(r)) {
    const v = r[key];
    if (typeof v === "string" && v.includes("@") && v.length < 200) return v.trim();
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const nested = findEmailInObject(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

/** Último recurso: busca en todo el objeto un valor string/number que parezca RUC o documento (solo dígitos, longitud típica). */
function findRucInObject(r: Record<string, unknown>): string | null {
  for (const key of Object.keys(r)) {
    const v = r[key];
    const s = toStr(v);
    if (s && /^\d{6,15}$/.test(s.replace(/\s/g, ""))) return s;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const nested = findRucInObject(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

/** Último recurso: busca valor que parezca teléfono (dígitos, posiblemente con espacios/guiones, longitud 7-20). */
function findPhoneInObject(r: Record<string, unknown>): string | null {
  for (const key of Object.keys(r)) {
    const v = r[key];
    const s = toStr(v);
    if (s && s.length >= 7 && s.length <= 20 && /^[\d\s\-+()]+$/.test(s) && (s.replace(/\D/g, "").length >= 6)) return s;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const nested = findPhoneInObject(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function getNum(r: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (v != null) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

/** Aplana un ítem: fusiona objeto raíz con subobjetos típicos (Contacto, Cliente, Datos, etc.) para buscar campos en cualquier nivel. */
function flattenItem(r: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const nestedKeys = ["Contacto", "Cliente", "Datos", "Data", "Info", "ClienteInfo", "DatosCliente", "Extra", "Extended"];
  for (const key of nestedKeys) {
    const val = r[key];
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(flat, val as Record<string, unknown>);
    }
  }
  Object.assign(flat, r);
  return flat;
}

async function fetchVersatPage(
  baseUrl: string,
  empresaId: number,
  user: string,
  password: string,
  recurso: string,
  page: number,
  allowNonArrayAsEmpty: boolean = false,
  detalleClass?: string
): Promise<unknown[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/Polling/Data`);
  url.searchParams.set("recurso", recurso);
  url.searchParams.set("empresa_id", String(empresaId));
  url.searchParams.set("registros_por_pagina", String(PAGE_SIZE));
  url.searchParams.set("pagina", String(page));
  if (recurso === "RC31" && detalleClass) url.searchParams.set("detalle", detalleClass);

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
  allowNonArrayAsEmpty: boolean = false,
  detalleClass?: string
): Promise<unknown[]> {
  const out: unknown[] = [];
  let page = 1;
  for (;;) {
    const chunk = await fetchVersatPage(baseUrl, empresaId, user, password, recurso, page, allowNonArrayAsEmpty, detalleClass);
    out.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    page++;
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
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
        error: "No hay ninguna fila en integraciones. Configura VERSAT en Ajustes → Integraciones.",
        detail: null,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
  if (!config.versat_base_url || config.versat_empresa_id == null || config.versat_empresa_id === undefined || !config.versat_user || !config.versat_password) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Config VERSAT incompleta. Rellena URL, Empresa ID, Usuario y Contraseña en Integraciones.",
        detail: null,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const baseUrl = String(config.versat_base_url).trim();
  const empresaId = Number(config.versat_empresa_id);
  const user = String(config.versat_user).trim();
  const password = String(config.versat_password);

  const { data: tiposPersonaRows } = await supabase.from("tipo_persona").select("id, codigo");
  const tipoPersonaByCodigo: Record<string, string> = {};
  if (tiposPersonaRows) {
    for (const row of tiposPersonaRows as { id: string; codigo: string }[]) {
      if (row.codigo) tipoPersonaByCodigo[row.codigo.toLowerCase()] = row.id;
    }
  }

  let rows: Record<string, unknown>[];
  let firstRawItem: Record<string, unknown> | null = null;
  try {
    let raw: unknown[];
    try {
      raw = await fetchAllPages(baseUrl, empresaId, user, password, "RC31", true, "Contacto");
    } catch {
      raw = await fetchAllPages(baseUrl, empresaId, user, password, "RC31", true);
    }
    if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null) {
      firstRawItem = raw[0] as Record<string, unknown>;
    }
    rows = (raw as Record<string, unknown>[]).map((r) => {
      const flat = flattenItem(r);
      const idVersat = getNum(flat, "id", "Id", "ID", "Cliente_id", "ClienteId", "ClienteId_id", "Codigo", "Codigo_id");
      if (idVersat == null) return null;
      const nombre = getStrFlex(flat, ["Descripcion_cb", "Nombre", "Razon_social", "nombre", "Nombre_txt", "RazonSocial", "Denominacion", "Descripcion", "Name", "Descripcion_hd_cb"], "nombre", "razon", "denominacion", "descripcion", "name") || `Cliente ${idVersat}`;
      const rucFromId = toStr(flat.Ruc_id);
      const rucRaw = rucFromId || getStrFlex(flat, ["Ruc", "RUC", "ruc", "Ruc_txt", "Documento", "documento", "Nro_documento", "Numero_documento", "Nit", "NIT", "Documento_txt", "Identificacion_fiscal", "Cuit", "Rut", "Codigo_fiscal", "Nro_ruc", "Ruc_hd_cb", "Documento_hd_cb"], "ruc", "documento", "nit", "fiscal", "cuit", "rut", "nro_doc", "numero_doc", "doc") || findRucInObject(r);
      const ciFormatted = getStrFlex(flat, ["CI_uk", "Ci", "CI", "ci", "Cedula", "cedula", "Cedula_identidad"], "ci", "cedula");
      const rucNormalized = rucFromId || normalizeRuc(rucRaw);
      const ruc = rucNormalized || (ciFormatted ? normalizeRuc(ciFormatted) : null);
      const ci = ciFormatted || null;
      const telefono = getStrFlex(flat, ["Telefono", "telefono", "Telefono_txt", "Phone", "Celular", "Movil", "Fono", "Tel", "Movil_txt", "Celular_txt", "Telefono_hd_cb", "Fono_txt", "Contacto_tel", "Telefono_contacto", "Contacto_telefono", "Numero_telefono"], "telefono", "phone", "celular", "movil", "fono", "tel", "contacto", "fone") || findPhoneInObject(r);
      const direccion = getStrFlex(flat, ["Direccion", "direccion", "Direccion_txt", "Address", "Domicilio", "Direccion_fiscal", "Direccion_hd_cb"], "direccion", "address", "domicilio");
      const email = getStrFlex(flat, ["Email", "email", "Email_txt", "Mail", "Correo", "E_mail", "Correo_electronico", "Mail_txt", "Email_principal", "Contacto_email", "E_mail_txt", "Email_hd_cb", "Mail_hd_cb"], "email", "mail", "correo", "electronico", "e_mail", "electronic") || findEmailInObject(r);
      const estadoRaw = getStr(flat, "Entidad_status", "Estado", "estado", "Estado_txt", "Activo", "activo");
      const estado = estadoRaw && (estadoRaw.toLowerCase() === "inactivo" || estadoRaw === "0") ? "inactivo" : "activo";

      const personaRaw = getStr(flat, "Persona", "Persona_txt", "Tipo_persona", "Tipo_persona_txt");
      const personaLower = personaRaw ? personaRaw.toLowerCase().normalize("NFD").replace(/\u0301/g, "") : "";
      const idTipoPersona = personaLower.includes("juridica") ? tipoPersonaByCodigo["juridica"] : personaLower.includes("fisica") ? tipoPersonaByCodigo["fisica"] : null;

      return {
        id_versat: idVersat,
        id_tipo_persona: idTipoPersona ?? null,
        nombre,
        ruc,
        ci,
        telefono,
        direccion,
        email,
        estado,
        updated_at: new Date().toISOString(),
      };
    }).filter((x): x is Record<string, unknown> => x != null);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: "Error fetching VERSAT RC31", detail: message }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let upserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("clientes")
      .upsert(batch, { onConflict: "id_versat", ignoreDuplicates: false });

    if (error) {
      errors.push(`batch ${i / 50 + 1}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  const payload: Record<string, unknown> = {
    ok: errors.length === 0,
    synced: upserted,
    total: rows.length,
    errors: errors.length ? errors : undefined,
  };
  if (rows.length === 0) {
    payload.error = "RC31 no devolvió clientes. Revisa empresa_id y acceso del usuario al recurso RC31.";
    payload.detail = `empresa_id=${empresaId}, URL=${baseUrl}`;
  }
  if (firstRawItem) {
    payload.rc31_sample = firstRawItem;
    payload.rc31_sample_keys = Object.keys(firstRawItem);
  }
  return new Response(JSON.stringify(payload), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});
