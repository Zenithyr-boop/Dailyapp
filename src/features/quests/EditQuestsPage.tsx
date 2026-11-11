import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, EditIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import type { QuestDef } from '../../lib/db'
import { difficultyForXp } from '../../lib/xp'
import type { UnitSystem } from '../../lib/units'
import { useUnits } from '../profile/units'
import { linkSummary } from './links'
import { QuestForm } from './QuestForm'
import { addQuest, deleteQuest, ensureSetup, listQuestDefs, moveQuest, updateQuest } from './questsRepo'

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

function summary(q: QuestDef, units: UnitSystem): string {
  if (q.link) return `Auto · ${linkSummary(q.link, units)} · ${difficultyForXp(q.xp)?.label ?? 'Custom'}`
  const type = q.kind === 'count' ? `Target ${fmt.format(q.target ?? 1)}${q.unit ? ` ${q.unit}` : ''}` : 'Checkbox'
  return `${type} · ${difficultyForXp(q.xp)?.label ?? 'Custom'}`
}

/** Add, edit, reorder and delete quests. Changes apply to today right away. */
export function EditQuestsPage() {
  useEffect(() => {
    ensureSetup()
  }, [])

  const quests = useLiveQuery(listQuestDefs, [])
  const units = useUnits()
  /** Quest id being edited, 'new' for the add form, or null. */
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Edit quests"
        kicker="Changes apply from today"
        aside={
          <Link
            to="/quests"
            className="inline-flex min-h-touch items-center gap-1 pr-1 font-display font-bold uppercase tracking-wider text-accent"
          >
            <ChevronLeftIcon size={20} />
            Done
          </Link>
        }
      />

      <div className="space-y-4">
        <Panel title="Your quests" aside={quests ? `${quests.length} quests` : undefined}>
          {!quests ? (
            <p className="text-muted">Loading…</p>
          ) : quests.length === 0 ? (
            <p className="text-muted">No quests yet. Add one below.</p>
          ) : (
            <ol className="-my-2">
              {quests.map((q, i) => (
                <li key={q.id} className="border-b border-line-soft py-2 last:border-b-0">
                  {editing === q.id ? (
                    <div className="py-2">
                      <QuestForm
                        initial={q}
                        submitLabel="Save"
                        onSubmit={async (fields) => {
                          await updateQuest(q.id, fields)
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  ) : confirmDelete === q.id ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                      <p>
                        Delete <strong>{q.title}</strong>? Past days keep it.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            await deleteQuest(q.id)
                            setConfirmDelete(null)
                          }}
                        >
                          Delete
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-x-2">
                      <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{q.title}</p>
                          <p className="text-xs text-muted">{summary(q, units)}</p>
                        </div>
                        <span className="mr-1 font-display font-semibold tabular-nums text-accent">+{q.xp}</span>
                      </div>
                      <div className="flex">{/* row actions */}
                      <IconButton label={`Move ${q.title} up`} disabled={i === 0} onClick={() => moveQuest(q.id, -1)}>
                        <ArrowUpIcon size={18} />
                      </IconButton>
                      <IconButton
                        label={`Move ${q.title} down`}
                        disabled={i === quests.length - 1}
                        onClick={() => moveQuest(q.id, 1)}
                      >
                        <ArrowDownIcon size={18} />
                      </IconButton>
                      <IconButton label={`Edit ${q.title}`} onClick={() => setEditing(q.id)}>
                        <EditIcon size={18} />
                      </IconButton>
                      <IconButton label={`Delete ${q.title}`} onClick={() => setConfirmDelete(q.id)}>
                        <TrashIcon size={18} />
                      </IconButton>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {editing === 'new' ? (
          <Panel title="New quest">
            <QuestForm
              submitLabel="Add quest"
              onSubmit={async (fields) => {
                await addQuest(fields)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          </Panel>
        ) : (
          <Button onClick={() => setEditing('new')} className="w-full">
            <PlusIcon size={20} />
            Add quest
          </Button>
        )}
      </div>
    </>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-touch shrink-0 place-items-center text-muted hover:text-accent disabled:opacity-30 disabled:hover:text-muted"
    >
      {children}
    </button>
  )
}
