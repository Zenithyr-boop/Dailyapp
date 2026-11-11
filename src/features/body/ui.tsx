/** Small pieces shared by the Body screens. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from '../../components/icons'

/** Square segmented control (radio-like buttons with aria-pressed). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap border border-line">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-touch min-w-11 flex-1 px-2.5 font-display text-sm font-bold uppercase tracking-wider ${
            value === o.id ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A full-width link row with a chevron, for lists inside panels. */
export function NavRow({ to, title, sub }: { to: string; title: string; sub?: ReactNode }) {
  return (
    <Link to={to} className="group flex min-h-touch items-center gap-3 py-2.5">
      <span className="flex-1">
        <span className="block font-display text-lg font-semibold uppercase tracking-wider group-hover:text-accent">{title}</span>
        {sub && <span className="block text-sm text-muted">{sub}</span>}
      </span>
      <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
    </Link>
  )
}

/** Back link at the top of a Body sub-screen. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="label -ml-1 mb-2 inline-flex min-h-touch items-center gap-1 px-1 hover:text-accent">
      <ChevronRightIcon size={16} className="rotate-180" />
      {children}
    </Link>
  )
}

/** Shown wherever photos appear: they never leave the device. */
export function PhotoPrivacyNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <p className="text-sm text-muted">Stored only on this device. Never uploaded, and they don’t sync to your other devices yet.</p>
  }
  return (
    <div className="border border-panel-edge bg-panel p-4">
      <h2 className="label text-text">Your photos stay on this device</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Photos are saved only in this browser or app on this device. They are never uploaded, not even when you’re signed in.</li>
        <li>They don’t sync between your devices yet: photos taken on your phone won’t show on your laptop.</li>
        <li>Clearing this site’s data, or uninstalling the app, deletes them. Nobody can get them back for you.</li>
      </ul>
    </div>
  )
}
