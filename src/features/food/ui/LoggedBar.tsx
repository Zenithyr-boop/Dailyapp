import type { Profile } from '../../../lib/db'
import type { Logged } from '../logActions'
import { formatKcal, mealName } from '../nutrition'

const linkClass = 'inline-flex min-h-touch items-center px-2 font-display font-bold uppercase tracking-wider text-accent hover:text-text'

/**
 * Right after logging: what was logged and where, with Undo, and "Add macros"
 * (no macros) or "Adjust amount" (logged from a food).
 */
export function LoggedBar({
  logged,
  undone,
  profile,
  onUndo,
  onAddMacros,
  onAdjust,
}: {
  logged?: Logged
  undone?: boolean
  profile?: Pick<Profile, 'mealNames'>
  onUndo: () => void
  onAddMacros: (entryId: string) => void
  onAdjust: (entryId: string) => void
}) {
  const single = logged?.entryIds.length === 1 ? logged.entryIds[0] : undefined
  return (
    <div role="status" className={logged ? 'border border-panel-edge bg-panel px-4 py-2' : 'sr-only'}>
      {logged && (
        <div className="flex flex-wrap items-center gap-x-2">
          <p className="min-w-0 flex-1 py-2">
            {undone ? (
              <>Removed {logged.name}.</>
            ) : (
              <>
                Logged <strong className="font-semibold">{logged.name}</strong> · {formatKcal(logged.kcal)} kcal to {mealName(logged.meal, profile)}.
              </>
            )}
          </p>
          {!undone && (
            <span className="-mx-2 flex flex-wrap">
              <button type="button" className={linkClass} onClick={onUndo}>
                Undo
              </button>
              {single && logged.noMacros && (
                <button type="button" className={linkClass} onClick={() => onAddMacros(single)}>
                  Add macros
                </button>
              )}
              {single && logged.fromFood && (
                <button type="button" className={linkClass} onClick={() => onAdjust(single)}>
                  Adjust amount
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
