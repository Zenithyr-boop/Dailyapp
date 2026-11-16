/**
 * CSV writing for "Your data" exports. RFC 4180: comma separated, CRLF line ends,
 * fields with commas, quotes or line breaks are quoted (quotes doubled).
 * Cells that start with = + - @ get a leading apostrophe so spreadsheets never
 * run them as formulas (a food called "=HYPERLINK(…)" stays text). Numbers are
 * written as they are, so negative values stay numbers.
 */

export type CsvCell = string | number | boolean | null | undefined

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  let s = value
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A CSV file: header row, then one line per row. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
