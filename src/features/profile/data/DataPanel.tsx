import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { Panel } from '../../../components/Panel'
import { SYNCED_TABLES } from '../../../lib/db'
import { isNativeApp } from '../../../lib/platform'
import { useAuth } from '../useAuth'
import { exportCsvZip, exportJson, importData, type ExportResult } from './dataTransfer'
import { describeCount, ImportError, parseExport, type ParsedImport } from './exportFormat'
import { eraseDevice } from './eraseDevice'
import { saveExport } from './saveFile'

type Notice = { kind: 'ok' | 'error'; text: string }

/** Me → Your data: export (JSON, CSV), import a JSON export, erase this device. */
export function DataPanel() {
  const auth = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'json' | 'csv' | 'read' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, setPending] = useState<ParsedImport | null>(null)
  const [erasing, setErasing] = useState(false)

  async function runExport(kind: 'json' | 'csv', make: () => Promise<ExportResult>) {
    setBusy(kind)
    setNotice(null)
    try {
      const file = await make()
      const how = await saveExport(file)
      setNotice({ kind: 'ok', text: how === 'shared' ? `${file.name} is ready.` : `Downloaded ${file.name}.` })
    } catch {
      setNotice({ kind: 'error', text: 'The export didn’t work. Try again, and if it keeps failing, send feedback from About.' })
    } finally {
      setBusy(null)
    }
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // choosing the same file again still fires
    if (!file) return
    setBusy('read')
    setNotice(null)
    try {
      setPending(parseExport(await file.text()))
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof ImportError ? err.message : 'That file couldn’t be read. Choose the .json file from Export JSON.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel title="Your data">
      <div className="space-y-4">
        <p className="text-muted">
          Everything you’ve logged, in a file you keep. JSON can be imported again; CSV opens in a spreadsheet.
          Progress photos stay on this device and aren’t included.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void runExport('json', () => exportJson())}>
            {busy === 'json' ? 'Exporting…' : 'Export JSON'}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => void runExport('csv', () => exportCsvZip())}>
            {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            {busy === 'read' ? 'Reading…' : 'Import JSON'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void chooseFile(e)}
          />
        </div>
        {isNativeApp() && <p className="text-sm text-muted">Exports open the share sheet: save them to Files or Drive.</p>}
        <div role="status" aria-live="polite">
          {notice && (
            <p className={`border-l-2 pl-3 text-text ${notice.kind === 'error' ? 'border-rank' : 'border-accent'}`}>{notice.text}</p>
          )}
        </div>
        <div className="border-t border-line-soft pt-4">
          <p className="text-muted">
            {auth.status === 'signed-in'
              ? 'To delete your account and its cloud copy, use Delete my account under Account.'
              : 'Not signed in: your data lives only on this device.'}
          </p>
          {auth.status !== 'signed-in' && (
            <button
              type="button"
              onClick={() => setErasing(true)}
              className="mt-1 min-h-touch text-left text-muted underline underline-offset-4 hover:text-text"
            >
              Erase everything on this device
            </button>
          )}
        </div>
      </div>

      {pending && (
        <ImportDialog
          parsed={pending}
          onClose={() => setPending(null)}
          onDone={(text) => {
            setPending(null)
            setNotice({ kind: 'ok', text })
          }}
        />
      )}
      {erasing && <EraseDialog onClose={() => setErasing(false)} />}
    </Panel>
  )
}

function ImportDialog({ parsed, onClose, onDone }: { parsed: ParsedImport; onClose: () => void; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exported = parsed.file.exportedAt ? new Date(parsed.file.exportedAt) : null

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const r = await importData(parsed)
      onDone(
        r.added + r.updated === 0
          ? 'Imported. Everything in the file was already on this device.'
          : `Imported: ${r.added.toLocaleString('en-GB')} added, ${r.updated.toLocaleString('en-GB')} updated.`,
      )
    } catch {
      setError('The import stopped before it finished. Nothing was deleted; try again.')
      setBusy(false)
    }
  }

  return (
    <Dialog title="Import data" onClose={onClose} busy={busy}>
      <p className="text-text">
        {exported && !Number.isNaN(exported.getTime())
          ? `Export from ${exported.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'This export'}{' '}
        holds:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        {SYNCED_TABLES.filter((t) => parsed.counts[t]).map((t) => (
          <li key={t}>{describeCount(t, parsed.counts[t] ?? 0)}</li>
        ))}
      </ul>
      {parsed.skipped > 0 && (
        <p className="text-sm text-muted">
          {parsed.skipped} damaged {parsed.skipped === 1 ? 'record' : 'records'} will be skipped.
        </p>
      )}
      <p className="text-sm text-muted">
        Adds what’s missing and merges the rest; nothing on this device is deleted. Settings and quests come from the file.
        Ticks from both are kept.
      </p>
      {error && (
        <p role="alert" className="border-l-2 border-rank pl-3 text-text">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </Dialog>
  )
}

function EraseDialog({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = confirm.trim().toUpperCase() === 'ERASE'

  async function run() {
    setBusy(true)
    await eraseDevice()
    window.location.assign('/welcome')
  }

  return (
    <Dialog title="Erase this device" onClose={onClose} busy={busy}>
      <p className="text-text">
        This deletes everything FromZero stores on this device: quests, history, workouts, food, body data and progress
        photos. It can’t be undone. Export first if you want a copy.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="erase-confirm" className="label block">
          Type ERASE to confirm
        </label>
        <input
          id="erase-confirm"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="min-h-touch w-full border border-line bg-bg px-3 text-text outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void run()} disabled={!ready || busy}>
          {busy ? 'Erasing…' : 'Erase'}
        </Button>
      </div>
    </Dialog>
  )
}
