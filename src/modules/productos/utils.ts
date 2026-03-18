/**
 * Exporta filas a CSV y descarga el archivo.
 */
export function exportToCsv(
  rows: Record<string, unknown>[],
  filename: string,
  columns: { key: string; header: string }[]
): void {
  if (rows.length === 0) {
    const header = columns.map((c) => c.header).join(",");
    downloadCsv(header + "\n", filename);
    return;
  }
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(String(row[c.key] ?? ""))).join(",")
  );
  const csv = [header, ...lines].join("\n");
  downloadCsv(csv, filename);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Formato numérico con 2 decimales para USD */
export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(2);
}
