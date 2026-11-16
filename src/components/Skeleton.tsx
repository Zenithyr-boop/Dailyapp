/**
 * Loading placeholders: flat blocks in the `line` colour that pulse gently
 * (no shimmer gradients). Reduced motion turns the pulse off. Each placeholder
 * that stands alone is a `status` region named by `label`, so screen readers
 * hear "Loading quests" instead of nothing.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse bg-line motion-reduce:animate-none ${className}`} />
}

const WIDTHS = ['w-full', 'w-5/6', 'w-2/3']

function Lines({ lines }: { lines: number }) {
  return (
    <>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-5 ${WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </>
  )
}

/** Rows inside a panel that's already on screen (a list still loading). */
export function ListSkeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-1">
      <Lines lines={lines} />
    </div>
  )
}

/** A panel-shaped placeholder. `label` null = part of a bigger placeholder. */
export function PanelSkeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string | null }) {
  return (
    <div
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className="border border-panel-edge bg-panel"
    >
      <div className="flex min-h-11 items-center border-b border-line-soft px-4">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-3 p-4">
        <Lines lines={lines} />
      </div>
    </div>
  )
}

/** Placeholder for a whole screen: a title and a couple of panels. */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <PanelSkeleton label={null} lines={4} />
      <PanelSkeleton label={null} lines={2} />
    </div>
  )
}
