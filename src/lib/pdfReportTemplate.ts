import { jsPDF } from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_EMPRESA = "empresa";
const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public/" + BUCKET_EMPRESA + "/";

/**
 * CONTRATO DE LAYOUT Y DATOS PARA REPORTES PDF (web y app nativo)
 * ---------------------------------------------------------------
 * Formato del documento: A4, orientación retrato (portrait). Unidades: mm.
 * Márgenes: laterales MARGIN_X = 14 mm, superior MARGIN_TOP = 18 mm.
 *
 * CABECERA (orden fijo):
 * 1. Logo (opcional): si empresa.logo_informes_url existe, imagen con altura máx. 18 mm, ancho máx. 40 mm, proporcional.
 * 2. Nombre de empresa: "Primesoft CBISA" (o nombre en BD si se agrega).
 * 3. RUC, dirección, teléfono (fuente 9 pt).
 * 4. Línea horizontal de separación.
 * 5. Título del reporte (fuente 12 pt, color verde).
 * 6. Subtítulo opcional (fuente 10 pt).
 *
 * CUERPO: a partir de startY (posición Y en mm). Cada generador dibuja su contenido desde startY usando el mismo doc.
 *
 * ESTRUCTURA DE DATOS POR TIPO DE REPORTE (para reimplementar en app nativo o API):
 * - Propuesta: cliente, fecha, SKU; tabla productos (nombre, cantidad, dosis/ha, área, costo/ha, importe; opcional margen); totales.
 * - RTE: monitoreo/cliente/parcela/zafra; costos, ingresos, resultado técnico.
 * - Siembra: fechas, productos, costos total y por ha.
 * - Aplicación: fecha, tipo, productos, costos.
 * - Evaluación: fecha, etapa fenológica, vigor, estrés hídrico, fitotoxicidad, clima, descripción, imágenes (URLs).
 * - Cosecha: fechas, resultado líquido kg, productividad bolsas/alq, humedad, costos.
 * - Voucher: cliente, valor total generado, liberado, restante; tabla movimientos (fecha, tipo, valor generado/liberado).
 * - Monitoreo (macro): cliente, parcela, zafra, ha, costo estimado; resumen Siembra, Aplicaciones, Evaluaciones, Cosecha, RTE.
 */

const MARGIN_X = 14;
const MARGIN_TOP = 18;
const LOGO_MAX_HEIGHT_MM = 22;
const LOGO_MAX_WIDTH_MM = 40;
const INFO_COLUMN_X = 58;
const PAGE_WIDTH_MM = 210;
const COMPANY_NAME_FALLBACK = "Primesoft CBISA";
const HEADER_COLOR = [46, 125, 50] as [number, number, number];

export type GeneralInfo = {
  cliente?: string;
  parcela?: string;
  zafra?: string;
};

export type ReportHeaderOptions = {
  title: string;
  subtitle?: string;
  userName?: string;
  generalInfo?: GeneralInfo;
};

function blobToDataUrl(blob: Blob): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  const mime = blob.type || "image/png";
  const format = mime.includes("png") ? "PNG" : "JPEG";
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      resolve(data ? { data, format } : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Carga la imagen de la logo desde URL. Si la URL es de Supabase Storage (bucket empresa),
 * usa el cliente Supabase para descargar y evitar CORS; si no, hace fetch directo.
 */
async function loadLogoImage(
  supabase: SupabaseClient,
  url: string
): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;

  try {
    const idx = trimmed.indexOf(STORAGE_PUBLIC_PREFIX);
    if (idx !== -1) {
      const path = trimmed.slice(idx + STORAGE_PUBLIC_PREFIX.length).split("?")[0];
      if (path) {
        const { data: blob, error } = await supabase.storage.from(BUCKET_EMPRESA).download(path);
        if (!error && blob) return blobToDataUrl(blob);
      }
    }

    const res = await fetch(trimmed, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Crea un documento PDF A4 estándar con cabecera: logo a la izquierda, INFORMACIÓN GENERAL a la derecha
 * (Empresa, RUC, Teléfono, y opcionalmente Cliente, Parcela, Zafra), fecha/hora de generación y usuario.
 * Devuelve { doc, startY } para que el generador dibuje el cuerpo desde startY.
 */
export async function createReportPdf(
  supabase: SupabaseClient,
  options: ReportHeaderOptions
): Promise<{ doc: jsPDF; startY: number }> {
  const { data: emp } = await supabase
    .from("empresa")
    .select("ruc, direccion, telefono, logo_informes_url")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresa = emp as {
    ruc?: string;
    direccion?: string;
    telefono?: string;
    logo_informes_url?: string | null;
  } | null;

  let yLeft = MARGIN_TOP;
  let yRight = MARGIN_TOP;

  // Columna izquierda: logo (vía Storage o URL pública para evitar CORS)
  if (empresa?.logo_informes_url) {
    const img = await loadLogoImage(supabase, empresa.logo_informes_url);
    if (img) {
      try {
        const dims = doc.getImageProperties(img.data);
        const aspect = dims.height / dims.width;
        let wMm = LOGO_MAX_WIDTH_MM;
        let hMm = wMm * aspect;
        if (hMm > LOGO_MAX_HEIGHT_MM) {
          hMm = LOGO_MAX_HEIGHT_MM;
          wMm = hMm / aspect;
        }
        doc.addImage(img.data, img.format, MARGIN_X, yLeft, wMm, hMm);
        yLeft += hMm + 2;
      } catch {
        yLeft += 2;
      }
    }
  }

  // Columna derecha: INFORMACIÓN GENERAL
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...HEADER_COLOR);
  doc.text("INFORMACIÓN GENERAL", INFO_COLUMN_X, yRight);
  yRight += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Empresa: ${COMPANY_NAME_FALLBACK}`, INFO_COLUMN_X, yRight);
  yRight += 5;
  if (empresa?.ruc) {
    doc.text(`RUC: ${empresa.ruc}`, INFO_COLUMN_X, yRight);
    yRight += 5;
  }
  if (empresa?.telefono) {
    doc.text(`Teléfono: ${empresa.telefono}`, INFO_COLUMN_X, yRight);
    yRight += 5;
  }
  const gi = options.generalInfo;
  if (gi?.cliente) {
    doc.text(`Cliente: ${gi.cliente}`, INFO_COLUMN_X, yRight);
    yRight += 5;
  }
  if (gi?.parcela) {
    doc.text(`Parcela: ${gi.parcela}`, INFO_COLUMN_X, yRight);
    yRight += 5;
  }
  if (gi?.zafra) {
    doc.text(`Zafra: ${gi.zafra}`, INFO_COLUMN_X, yRight);
    yRight += 5;
  }

  let y = Math.max(yLeft, yRight) + 6;

  // Fecha/hora de generación y usuario
  const now = new Date();
  const fechaHora = now.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generado: ${fechaHora}`, MARGIN_X, y);
  doc.text(`Usuario: ${options.userName ?? "Sistema"}`, MARGIN_X, y + 5);
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_X, y, PAGE_WIDTH_MM - MARGIN_X, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(options.title, MARGIN_X, y);
  y += 7;
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(options.subtitle, MARGIN_X, y);
    y += 7;
  }
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  return { doc, startY: y };
}

/**
 * Carga una imagen desde URL y la dibuja en el documento. Útil para miniatura de parcela en "Detalles de la operación".
 */
export async function addReportImage(
  supabase: SupabaseClient,
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  wMm: number,
  hMm: number
): Promise<boolean> {
  const img = await loadLogoImage(supabase, url);
  if (!img) return false;
  try {
    const dims = doc.getImageProperties(img.data);
    const aspect = dims.height / dims.width;
    let w = wMm;
    let h = w * aspect;
    if (h > hMm) {
      h = hMm;
      w = h / aspect;
    }
    doc.addImage(img.data, img.format, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

const NOTAS_BY_TYPE: Record<string, string> = {
  Siembra: "Este documento es un reporte oficial de las actividades de siembra registradas en el sistema.",
  Aplicación: "Este documento es un reporte oficial de las actividades de aplicación registradas en el sistema.",
  Evaluación: "Este documento es un reporte oficial de las evaluaciones registradas en el sistema.",
  Cosecha: "Este documento es un reporte oficial de las actividades de cosecha registradas en el sistema.",
  RTE: "Este documento es un reporte oficial del Resultado Técnico Económico registrado en el sistema.",
  Monitoreo: "Este documento es un reporte oficial del monitoreo registrado en el sistema.",
  Propuesta: "Este documento es un reporte oficial de la propuesta comercial registrada en el sistema.",
  Voucher: "Este documento es un reporte oficial del voucher y movimientos registrados en el sistema.",
};

export function getDefaultNotas(reportType: string): string {
  return NOTAS_BY_TYPE[reportType] ?? "Este documento es un reporte oficial generado por el sistema.";
}

export { MARGIN_X, PAGE_WIDTH_MM, INFO_COLUMN_X };
