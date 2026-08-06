import { downloadTextFile, objectsToCsv } from '@/lib/csv'
import { formatQty, type EventCostLine, type EventRecord } from '@/lib/types'

/**
 * The accounts report, in one place so the screen and the spreadsheet can
 * never disagree about what an event cost.
 *
 * Damaged is reported but not billed — it's still owned, just not usable yet,
 * so charging for it here would double-count once it's repaired or written
 * off. "Used up" is everything the company genuinely no longer has: served,
 * spilled, or never came back.
 */
export interface EventTotals {
  /** Cost of stock the company no longer has. The bill. */
  costUsed: number
  /** Cost of everything that left the store — exposure, not spend. */
  costTakenOut: number
  /** Value of what hasn't come back yet, at today's prices. */
  costStillOut: number
  itemCount: number
  /** Items with no price on file. Their quantities are real; their cost isn't
   * known, so they're excluded from the money and counted here instead. */
  unpriced: number
  linesStillOut: number
}

export function summarise(lines: EventCostLine[]): EventTotals {
  return {
    costUsed: lines.reduce((s, l) => s + Number(l.cost_used ?? 0), 0),
    costTakenOut: lines.reduce((s, l) => s + Number(l.cost_taken_out ?? 0), 0),
    costStillOut: lines.reduce(
      (s, l) => s + (l.unit_cost == null ? 0 : Number(l.still_out) * Number(l.unit_cost)),
      0,
    ),
    itemCount: lines.length,
    unpriced: lines.filter((l) => l.unit_cost == null).length,
    linesStillOut: lines.filter((l) => Number(l.still_out) > 0).length,
  }
}

/**
 * Two kinds of column on purpose: plain numbers in the item's base unit, which
 * a spreadsheet can total and multiply, and a readable version beside them for
 * the person checking it against what actually happened.
 */
const REPORT_COLUMNS = [
  'Item',
  'Category',
  'Unit',
  'Pack',
  'Taken out',
  'Taken out (readable)',
  'Brought back',
  'Served',
  'Spilled',
  'Missing',
  'Damaged',
  'Still out',
  'Used up',
  'Used up (readable)',
  'Price per unit',
  'Cost of stock used',
]

export function buildReportCsv(lines: EventCostLine[]): string {
  const num = (n: number | null | undefined) => (n == null ? '' : String(Number(n)))

  const rows: Record<string, string>[] = lines.map((l) => ({
    Item: l.item_name,
    Category: l.category_name ?? '',
    Unit: l.unit,
    Pack: l.pack_label ? `${l.pack_size} ${l.unit} per ${l.pack_label}` : '',
    'Taken out': num(l.qty_out),
    'Taken out (readable)': formatQty(l.qty_out, l),
    'Brought back': num(l.qty_returned),
    Served: num(l.qty_consumed),
    Spilled: num(l.qty_wasted),
    Missing: num(l.qty_lost),
    Damaged: num(l.qty_damaged),
    'Still out': num(l.still_out),
    'Used up': num(l.qty_used),
    'Used up (readable)': formatQty(l.qty_used, l),
    'Price per unit': l.unit_cost == null ? '' : String(Number(l.unit_cost)),
    'Cost of stock used': l.cost_used == null ? '' : String(Number(l.cost_used)),
  }))

  const totals = summarise(lines)
  const blank = Object.fromEntries(REPORT_COLUMNS.map((c) => [c, '']))

  rows.push({
    ...blank,
    Item: 'TOTAL',
    'Cost of stock used': String(Number(totals.costUsed.toFixed(2))),
  })

  // A bill that silently omits what it couldn't price is worse than one that
  // says so.
  if (totals.unpriced > 0) {
    rows.push({
      ...blank,
      Item: `Note: ${totals.unpriced} item${totals.unpriced === 1 ? '' : 's'} had no price on file and are not included in the total.`,
    })
  }

  return objectsToCsv(rows, REPORT_COLUMNS)
}

export function reportFilename(event: EventRecord): string {
  const safeName = event.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const date = new Date(event.starts_at).toISOString().slice(0, 10)
  return `${date}-${safeName}-accounts.csv`
}

export function downloadReport(event: EventRecord, lines: EventCostLine[]): void {
  downloadTextFile(reportFilename(event), buildReportCsv(lines))
}
