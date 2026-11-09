import { Panel } from './Panel'

interface ComingSoonProps {
  /** What this screen will do, one item per line. */
  items: string[]
}

/** Placeholder body for screens that aren't built yet. */
export function ComingSoon({ items }: ComingSoonProps) {
  return (
    <Panel title="Not built yet" aside="Planned">
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-muted">
            <span className="mt-2 size-1.5 shrink-0 bg-accent" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
