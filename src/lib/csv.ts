/**
 * A small, dependency-free CSV reader/writer.
 *
 * There is no Excel (.xlsx) parser here on purpose. The well-known npm
 * package for that (SheetJS's `xlsx`) has a known prototype-pollution
 * advisory (CVE-2023-30533) that the maintainers never patched on the npm
 * registry — the fixed builds only exist on their own CDN. Pulling it in
 * would trade a real, if inconvenient, gap for a supply-chain risk. Excel,
 * Google Sheets and every spreadsheet tool save-as CSV in two clicks, so
 * that's the format this app reads.
 */

/** Parse CSV text into rows of raw string cells. Handles quoted fields,
 * embedded commas/newlines, and "" as an escaped quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Strip a leading UTF-8 BOM — Excel writes one on "CSV UTF-8" exports.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }

  // Final field/row if the file doesn't end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell !== '')) rows.push(row)
  }

  return rows
}

/** First row is headers (case-insensitive, trimmed); the rest become objects. */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    header.forEach((key, i) => {
      obj[key] = (row[i] ?? '').trim()
    })
    return obj
  })
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function objectsToCsv(rows: Record<string, string>[], columns: string[]): string {
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c] ?? '')).join(','))
  }
  return lines.join('\r\n')
}

export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
