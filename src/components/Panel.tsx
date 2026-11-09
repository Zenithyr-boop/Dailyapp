import type { ReactNode } from 'react'

interface PanelProps {
  /** Small uppercase label in the panel header ("System window" title bar). */
  title?: string
  /** Optional content on the right of the header (a count, a link). */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Flat card with the 1px blue "System window" edge. */
export function Panel({ title, aside, className = '', children }: PanelProps) {
  return (
    <section className={`border border-panel-edge bg-panel ${className}`}>
      {(title || aside) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft px-4">
          {title && <h2 className="label">{title}</h2>}
          {aside && <div className="font-display text-sm font-semibold text-muted">{aside}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}
