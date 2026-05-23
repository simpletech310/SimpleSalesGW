/**
 * Tiny RFC 4180 CSV encoder — no dependency.
 * Quotes any cell that contains `"`, `,`, `\r`, `\n`, or starts/ends with whitespace.
 * Escapes embedded `"` by doubling it.
 */

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]|^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(cells: ReadonlyArray<unknown>): string {
  return cells.map(csvCell).join(",");
}

/** Build a full CSV string from rows. First row should be headers. */
export function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map(csvRow).join("\r\n");
}

/** Format a Date or string-Date for CSV. Returns ISO 8601. */
export function csvDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString();
}
