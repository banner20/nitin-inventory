import { useRef, useState } from 'react'
import { csvToObjects, downloadTextFile, objectsToCsv } from '@/lib/csv'
import {
  planImport,
  runImport,
  type ImportPlanLine,
  type ImportRow,
  type ImportSummary,
} from '@/lib/txns'
import type { Category, ItemAvailability } from '@/lib/types'

const TEMPLATE_COLUMNS = [
  'name',
  'category',
  'kind',
  'unit',
  'pack_size',
  'pack_label',
  'sku',
  'min_stock',
  'aliases',
  'alt_packs',
  'expiry_date',
]

const TEMPLATE_ROWS: Record<string, string>[] = [
  {
    name: 'Gin - London Dry',
    category: 'Spirits',
    kind: 'consumable',
    unit: 'ml',
    pack_size: '750',
    pack_label: 'bottle',
    sku: 'SPR-GIN-LD',
    min_stock: '3000',
    aliases: 'gin;london dry;dry gin',
    alt_packs: '',
    expiry_date: '',
  },
  {
    name: 'Highball Glass',
    category: 'Glassware',
    kind: 'returnable',
    unit: 'pcs',
    pack_size: '25',
    pack_label: 'crate',
    sku: 'GLS-HIG-01',
    min_stock: '200',
    aliases: 'highball;tall glass',
    alt_packs: '',
    expiry_date: '',
  },
  {
    name: 'Hazelnut Syrup',
    category: 'Syrups & Sweeteners',
    kind: 'consumable',
    unit: 'ml',
    pack_size: '250',
    pack_label: 'bottle',
    sku: 'SYR-HAZ-01',
    min_stock: '1000',
    aliases: 'hazelnut',
    alt_packs: '1000:jug',
    expiry_date: '2026-12-01',
  },
]

/**
 * Bulk-load or update the master sheet from a spreadsheet.
 *
 * Only reads CSV — see the note in lib/csv.ts for why .xlsx isn't parsed
 * directly. Excel, Google Sheets and every spreadsheet tool export CSV in two
 * clicks (File → Save As → CSV), so this asks for that instead of adding a
 * dependency with a known security advisory.
 *
 * Nothing is written until the admin reviews a plan and confirms — a bulk
 * import is exactly the kind of action that shouldn't happen sight-unseen.
 */
export default function ImportItems({
  categories,
  existingItems,
  onImported,
  onClose,
}: {
  categories: Category[]
  existingItems: ItemAvailability[]
  onImported: () => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlanLine[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportSummary | null>(null)

  async function onFile(file: File) {
    setError(null)
    setResult(null)
    if (!/\.csv$/i.test(file.name)) {
      setError(
        'That doesn’t look like a CSV file. In Excel or Google Sheets, use File → Save As / Download → CSV, then upload that.',
      )
      return
    }
    const text = await file.text()
    const rows = csvToObjects(text) as unknown as ImportRow[]
    if (rows.length === 0) {
      setError('That file has no rows to import.')
      return
    }
    setFileName(file.name)
    setPlan(planImport(rows, existingItems))
  }

  async function confirm() {
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      const summary = await runImport(plan, categories)
      setResult(summary)
      setPlan(null)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const valid = plan?.filter((l) => l.errors.length === 0) ?? []
  const invalid = plan?.filter((l) => l.errors.length > 0) ?? []
  const toCreate = valid.filter((l) => l.action === 'create')
  const toUpdate = valid.filter((l) => l.action === 'update')

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Import from spreadsheet</h2>
          <p className="text-sm text-fg-muted">
            Add many items at once, or update ones you already have. Reads CSV —
            save your Excel or Google Sheet as CSV first.
          </p>
        </div>
        <button className="btn btn-ghost h-9 min-h-9 text-sm px-3" onClick={onClose}>
          Close
        </button>
      </div>

      <button
        className="btn btn-ghost text-sm"
        onClick={() =>
          downloadTextFile('item-import-template.csv', objectsToCsv(TEMPLATE_ROWS, TEMPLATE_COLUMNS))
        }
      >
        Download a template
      </button>

      {!plan && !result && (
        <label className="block">
          <span className="text-sm text-fg-muted">Choose a CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="input mt-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
            }}
          />
        </label>
      )}

      {error && <p className="text-sm text-bad-600">{error}</p>}

      {result && (
        <div className="space-y-2">
          <div
            className={
              'rounded-lg border p-3 text-sm space-y-1 ' +
              (result.failed.length > 0
                ? 'border-warn-200 bg-warn-50'
                : 'border-good-200 bg-good-50')
            }
          >
            <p
              className={
                'font-medium ' +
                (result.failed.length > 0 ? 'text-warn-700' : 'text-good-700')
              }
            >
              {result.failed.length > 0 ? 'Import finished with problems.' : 'Import complete.'}
            </p>
            <p className="text-fg">
              {result.created} new item{result.created === 1 ? '' : 's'}, {result.updated} updated
              {result.categoriesCreated > 0 &&
                `, ${result.categoriesCreated} new categor${result.categoriesCreated === 1 ? 'y' : 'ies'}`}
              {result.skipped > 0 && `, ${result.skipped} skipped for errors`}.
            </p>
          </div>

          {/* Name every row the database refused. A count alone tells you
              something went wrong without telling you what to re-enter. */}
          {result.failed.length > 0 && (
            <div className="rounded-lg border border-bad-200 bg-bad-50 p-3 text-sm space-y-1.5">
              <p className="text-bad-700 font-medium">
                {result.failed.length} row{result.failed.length === 1 ? '' : 's'} didn't save:
              </p>
              <ul className="space-y-1">
                {result.failed.map((f, i) => (
                  <li key={i} className="text-xs text-fg">
                    <span className="font-medium">{f.name || '(no name)'}</span>
                    <span className="text-fg-muted"> — {f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {plan && (
        <div className="space-y-3">
          <p className="text-sm text-fg">
            <span className="text-fg font-medium">{fileName}</span> — {toCreate.length} new,{' '}
            {toUpdate.length} to update
            {invalid.length > 0 && (
              <span className="text-bad-600"> · {invalid.length} with errors, will be skipped</span>
            )}
            . Nothing has been saved yet.
          </p>

          <div className="max-h-80 overflow-y-auto card divide-y divide-line">
            {plan.map((line, i) => (
              <div key={i} className="p-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-sm truncate">{line.row.name || '(no name)'}</span>
                {line.errors.length > 0 ? (
                  <span className="text-bad-600 text-xs shrink-0">{line.errors.join('; ')}</span>
                ) : (
                  <span
                    className={
                      line.action === 'create'
                        ? 'text-good-600 text-xs shrink-0'
                        : 'text-brand-600 text-xs shrink-0'
                    }
                  >
                    {line.action === 'create' ? 'New' : 'Update existing'}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void confirm()}
              disabled={busy || valid.length === 0}
            >
              {busy ? 'Importing…' : `Import ${valid.length} row${valid.length === 1 ? '' : 's'}`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setPlan(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
