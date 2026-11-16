/**
 * Loading placeholders: flat blocks in the `line` colour that pulse gently
 * (no shimmer gradients). Reduced motion turns the pulse off.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse bg-line motion-reduce:animate-none ${className}`} />
}

/** A panel-shaped placeholder with a few text lines, for a screen whose data is still loading. */
export function PanelSkeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="border border-panel-edge bg-panel">
      <div className="flex min-h-11 items-center border-b border-line-soft px-4">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-5 ${i % 3 === 2 ? 'w-2/3' : i % 3 === 1 ? 'w-5/6' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

/** Placeholder for a whole screen: a title bar and a couple of panels. */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <PanelSkeleton label={label} lines={4} />
      <PanelSkeleton label={label} lines={2} />
    </div>
  )
}
