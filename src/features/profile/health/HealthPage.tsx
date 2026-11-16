import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { CheckIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import {
  HEALTH_METRIC_LABEL as METRIC_LABEL,
  healthSupport,
  openHealthConnectSettings,
  type HealthMetric,
  type HealthSupport,
} from '../../../lib/health/bridge'
import { RELEASES_PAGE } from '../../../lib/updates'
import { connectHealth, disconnectHealth, syncHealth, useHealthState } from '../../today/healthSync'

const linkClass = 'text-accent underline underline-offset-2 hover:text-text'

const METRICS: { id: HealthMetric; label: string; help: string; defaultOn: boolean }[] = [
  { id: 'steps', label: 'Steps', help: 'Fills in your daily steps and ticks step quests.', defaultOn: true },
  { id: 'sleep', label: 'Sleep', help: 'Minutes asleep, counted on the day you wake up.', defaultOn: true },
  {
    id: 'weight',
    label: 'Weight',
    help: 'Weigh-ins from a smart scale or another app. Off unless you turn it on.',
    defaultOn: false,
  },
]

/** The promises on the explanation screen. Keep in line with the privacy policy. */
const PROMISES = [
  'Read only. FromZero never writes to Health Connect and never reads anything else.',
  'Stored on your days like a number you type in. If you’re signed in, it syncs to your account, so the website shows it too.',
  'Never sold, never shared, never used for ads.',
  'Updated when you open the app. A number you change by hand stays until Health Connect has a new one.',
  'Turn it off here at any time, or in Android Settings → Health Connect.',
]

function MetricChoice({ checked, onChange, label, help }: { checked: boolean; onChange: (on: boolean) => void; label: string; help: string }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center border-2 ${checked ? 'border-accent bg-accent text-on-accent' : 'border-faint'}`}
      >
        {checked && <CheckIcon size={16} />}
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{help}</span>
      </span>
    </label>
  )
}

/** The explanation shown before Health Connect's permission sheet. */
function Explanation({ initial, onDone }: { initial?: HealthMetric[]; onDone: () => void }) {
  const [chosen, setChosen] = useState<HealthMetric[]>(initial ?? METRICS.filter((m) => m.defaultOn).map((m) => m.id))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const toggle = (id: HealthMetric, on: boolean) =>
    setChosen((c) => (on ? [...c.filter((m) => m !== id), id] : c.filter((m) => m !== id)))

  const connect = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const granted = await connectHealth(METRICS.map((m) => m.id).filter((m) => chosen.includes(m)))
      if (granted.length) onDone()
      else setMessage('Nothing was allowed. Try again, or allow FromZero in Health Connect’s settings.')
    } catch {
      setMessage('Health Connect didn’t answer. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="What FromZero reads">
        <p className="mb-2 text-muted">
          Let FromZero read your steps, sleep and weight from Health Connect, so they fill in by themselves from your
          phone, watch or scale.
        </p>
        <div className="divide-y divide-line-soft">
          {METRICS.map((m) => (
            <MetricChoice key={m.id} checked={chosen.includes(m.id)} onChange={(on) => toggle(m.id, on)} label={m.label} help={m.help} />
          ))}
        </div>
      </Panel>
      <Panel title="What happens to it">
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          {PROMISES.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-3">
          <Link to="/privacy" className={linkClass}>
            Read the privacy policy
          </Link>
        </p>
      </Panel>
      <div className="space-y-2">
        <Button className="w-full" disabled={busy || chosen.length === 0} onClick={() => void connect()}>
          Continue to Health Connect
        </Button>
        <p className="text-sm text-muted">Health Connect asks you next, and you can switch each one on or off there too.</p>
        {message && (
          <p role="alert" className="text-sm text-text">
            {message}
          </p>
        )}
      </div>
    </>
  )
}

/** Me → Health Connect (`/me/health`): explanation, permission, status. */
export function HealthPage() {
  const [support, setSupport] = useState<HealthSupport | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const state = useHealthState()

  useEffect(() => {
    let live = true
    void healthSupport().then((s) => live && setSupport(s))
    return () => {
      live = false
    }
  }, [])

  const recheck = () => void healthSupport().then(setSupport)

  let body
  if (support === null || state === undefined) {
    body = null
  } else if (support === 'unsupported') {
    body = (
      <Panel title="Android app only">
        <p className="text-muted">
          In the FromZero Android app, steps, sleep and weight from Health Connect fill in by themselves. On the
          website, add them on the Quests screen.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className={linkClass}>
            Get the Android app
          </a>
          <Link to="/privacy" className={linkClass}>
            Privacy policy
          </Link>
        </p>
      </Panel>
    )
  } else if (support === 'unavailable') {
    body = (
      <Panel title="Health Connect isn’t ready">
        <p className="text-muted">
          On Android 14 and newer Health Connect is built in, but it may need an update. On older phones, install
          Health Connect from the Play Store first.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void openHealthConnectSettings().catch(() => {})}>
            Open Health Connect
          </Button>
          <Button variant="secondary" onClick={recheck}>
            Check again
          </Button>
        </div>
      </Panel>
    )
  } else if (!state.connected || editing) {
    body = <Explanation initial={editing ? state.metrics : undefined} onDone={() => setEditing(false)} />
  } else {
    const missing = state.metrics.filter((m) => !state.granted.includes(m))
    const time = state.lastSyncAt
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(state.lastSyncAt)
      : null
    body = (
      <Panel title="Connected" aside={time ? `Updated ${time}` : undefined}>
        <p className="text-muted">
          Reading:{' '}
          <span className="font-semibold text-text">
            {state.granted.length ? state.granted.map((m) => METRIC_LABEL[m]).join(', ') : 'nothing yet'}
          </span>
        </p>
        {missing.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Not allowed in Health Connect: {missing.map((m) => METRIC_LABEL[m]).join(', ')}. Allow it under Manage
            permissions.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void syncHealth({ force: true })
                .catch(() => {})
                .finally(() => setBusy(false))
            }}
          >
            Update now
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Change what’s read
          </Button>
          <Button variant="secondary" onClick={() => void openHealthConnectSettings().catch(() => {})}>
            Manage permissions
          </Button>
          <Button variant="secondary" onClick={() => void disconnectHealth()}>
            Disconnect
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">
          Disconnecting stops reading; numbers already filled in stay on your days.{' '}
          <Link to="/privacy" className={linkClass}>
            Privacy policy
          </Link>
        </p>
      </Panel>
    )
  }

  return (
    <>
      <PageHeader title="Health Connect" kicker="Me" />
      <div className="space-y-4">{body}</div>
    </>
  )
}
