# Contrato de layout y datos para reportes PDF

Este documento describe el estándar de los reportes PDF (template unificado) para que la **app web** y una eventual **app nativa** (o una API que genere PDF) puedan producir el mismo formato.

## Formato del documento

- **Tamaño:** A4 (210 × 297 mm).
- **Orientación:** Retrato (portrait).
- **Unidades:** Milímetros (mm).
- **Márgenes:** Laterales 14 mm (`MARGIN_X`), superior 18 mm (`MARGIN_TOP`). Exportados desde `src/lib/pdfReportTemplate.ts`.

## Cabecera (orden fijo)

- **Dos columnas:** A la izquierda el **logo** (opcional; si existe `logo_informes_url`, altura máx. 22 mm, ancho máx. 40 mm). A la derecha el bloque **INFORMACIÓN GENERAL** (fuente 9 pt):
  - Empresa: Primesoft CBISA
  - RUC, Teléfono
  - Cliente, Parcela, Zafra (cuando aplique al tipo de reporte)
- **Generado:** Fecha y hora de generación (formato local).
- **Usuario:** Nombre del usuario que generó el reporte (o "Sistema" si no se envía).
- **Línea horizontal** de separación.
- **Título del reporte** (ej. "Siembra", "Propuesta", "RTE") en fuente 12 pt, color verde.
- **Subtítulo opcional** (ej. "con composición de precio") en fuente 10 pt.

## Cuerpo del reporte

El contenido específico de cada reporte comienza en la posición **startY** (en mm), devuelta por `createReportPdf()`. Cada generador dibuja a partir de esa Y usando el mismo documento.

En reportes de **Siembra** (y opcionalmente otros de monitoreo) se usa la estructura: **2. DETALLES DE LA OPERACIÓN** (área, fechas; con imagen pequeña de parcela si existe `parcelas.thumbnail_url`), **3. DETALLE DE INSUMOS** (tabla de productos), **4. RESUMEN FINANCIERO (USD)** (costo/ha, costo total). Al final, **Notas:** con texto oficial por tipo de reporte.

## Estructura de datos por tipo de reporte

Para reimplementar el mismo layout en app nativo o en una API que devuelva PDF:

| Tipo       | Datos principales |
|-----------|--------------------|
| **Propuesta** | Cliente, fecha, SKU; tabla de productos (nombre, cantidad, dosis/ha, área, costo/ha, importe; opcional margen y precio compra); totales general y voucher. |
| **RTE**   | Monitoreo / cliente / parcela / zafra; costos, ingresos, resultado técnico. |
| **Siembra** | Fechas inicio/fin, productos, costo total y por ha. |
| **Aplicación** | Fecha, tipo, productos, costos total y por ha. |
| **Evaluación** | Fecha, etapa fenológica, vigor, estrés hídrico, fitotoxicidad, clima, descripción; URLs de imágenes. |
| **Cosecha** | Fechas, resultado líquido (kg), productividad (bolsas/alq), humedad, costos. |
| **Voucher** | Cliente; valor total generado, liberado, restante; tabla de movimientos (fecha, tipo, valor generado/liberado). |
| **Monitoreo (macro)** | Cliente, parcela, zafra, hectáreas, costo estimado; resumen de Siembra, Aplicaciones, Evaluaciones, Cosecha y RTE asociados. |

## Implementación en web

- **Template:** `src/lib/pdfReportTemplate.ts` — `createReportPdf(supabase, { title, subtitle? })` → `{ doc, startY }`.
- **Generadores:** Cada módulo tiene su `pdf*.ts` (ej. `src/modules/crm/pdfPropuesta.ts`, `src/modules/monitoreo/pdfRte.ts`, etc.) que usa el template y dibuja el cuerpo.

## Uso en app nativo

- **Opción A:** API (Edge Function o backend) que reciba tipo de reporte + id, genere el PDF con la misma lógica (p. ej. jsPDF en Node o librería equivalente) y devuelva el archivo. Web y móvil consumen la misma API.
- **Opción B:** El app nativo implementa el mismo layout (logo, cabecera, título, cuerpo) con su librería de PDF, usando este contrato de datos y medidas.
