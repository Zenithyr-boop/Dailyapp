import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import type { LinkSource, QuestFields, QuestKind } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { useUnits } from '../profile/units'
import { defaultTitle, inputUnit, LINK_SOURCES, sourceInfo, targetForInput, targetFromInput } from './links'
import { clampQuestXp, DIFFICULTIES, difficultyForXp, QUEST_XP_MAX, QUEST_XP_MIN } from '../../lib/xp'

interface QuestFormProps {
  initial?: QuestFields
  submitLabel: string
  onSubmit: (fields: QuestFields) => void
  onCancel: () => void
}

const inputClass =
  'mt-1 block min-h-touch w-full border border-line bg-bg px-3 text-text placeholder:text-faint focus:border-accent focus:outline-none'

type FormType = QuestKind | 'auto'

function autoTitle(source: LinkSource, value: string, units: UnitSystem): string {
  const n = Number(value)
  return defaultTitle({ source, target: Number.isFinite(n) && value !== '' ? targetFromInput(source, n, units) : undefined }, units)
}

/** Create or edit a quest: title, type (checkbox, number target, automatic), its numbers, difficulty / XP. */
export function QuestForm({ initial, submitLabel, onSubmit, onCancel }: QuestFormProps) {
  const id = useId()
  const units = useUnits()
  const [title, setTitle] = useState(initial?.title ?? '')
  // A new quest's title follows the automatic source until the user types their own.
  const [titleTouched, setTitleTouched] = useState(!!initial)
  const [kind, setKind] = useState<FormType>(initial?.link ? 'auto' : (initial?.kind ?? 'check'))
  const [source, setSource] = useState<LinkSource>(initial?.link?.source ?? 'steps')
  const [linkValue, setLinkValue] = useState(() => targetForInput(initial?.link ?? { source: 'steps' }, units))
  const info = sourceInfo(source)

  function chooseKind(next: FormType) {
    setKind(next)
    if (next === 'auto' && !titleTouched) setTitle(autoTitle(source, linkValue, units))
  }

  function chooseSource(next: LinkSource) {
    const value = targetForInput({ source: next }, units)
    setSource(next)
    setLinkValue(value)
    if (!titleTouched) setTitle(autoTitle(next, value, units))
  }

  function changeLinkValue(value: string) {
    setLinkValue(value)
    if (!titleTouched) setTitle(autoTitle(source, value, units))
  }
  const [target, setTarget] = useState(String(initial?.target ?? ''))
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [step, setStep] = useState(String(initial?.step ?? '1'))
  const [xp, setXp] = useState(String(initial?.xp ?? 40))

  const xpNumber = Number(xp)
  const matched = difficultyForXp(xpNumber)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (kind === 'auto') {
      const n = Number(linkValue)
      onSubmit({
        title,
        kind: 'check',
        xp: clampQuestXp(xpNumber),
        link: { source, ...(info.target && linkValue !== '' && Number.isFinite(n) ? { target: targetFromInput(source, n, units) } : {}) },
      })
      return
    }
    onSubmit({
      title,
      kind,
      xp: clampQuestXp(xpNumber),
      ...(kind === 'count' ? { target: Number(target), unit, step: Number(step) } : {}),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor={`${id}-title`} className="label">
          Quest
        </label>
        <input
          id={`${id}-title`}
          required
          maxLength={60}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleTouched(true)
          }}
          placeholder="e.g. Drink water"
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="label">Type</legend>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(
            [
              ['check', 'Checkbox'],
              ['count', 'Number target'],
              ['auto', 'Automatic'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-touch cursor-pointer items-center justify-center border font-display font-semibold uppercase tracking-wider has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                kind === value ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:text-text'
              }`}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={value}
                checked={kind === value}
                onChange={() => chooseKind(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'auto' && (
        <div className="space-y-3">
          <fieldset>
            <legend className="label">Ticks itself from</legend>
            <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
              {LINK_SOURCES.map((s) => (
                <label
                  key={s.id}
                  className={`flex min-h-touch cursor-pointer items-center justify-center border px-2 text-center font-display text-sm font-semibold uppercase tracking-wider has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                    source === s.id ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:text-text'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-source`}
                    value={s.id}
                    checked={source === s.id}
                    onChange={() => chooseSource(s.id)}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">{info.help} It can’t be ticked by hand.</p>
          </fieldset>
          {info.target && (
            <div>
              <label htmlFor={`${id}-link`} className="label">
                {info.target.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${id}-link`}
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="any"
                  value={linkValue}
                  onChange={(e) => changeLinkValue(e.target.value)}
                  className={`${inputClass} max-w-40`}
                />
                <span className="label mt-1">{inputUnit(source, units)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {kind === 'count' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor={`${id}-target`} className="label">
              Target
            </label>
            <input
              id={`${id}-target`}
              type="number"
              inputMode="decimal"
              required
              min="0.01"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="3"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-unit`} className="label">
              Unit
            </label>
            <input
              id={`${id}-unit`}
              maxLength={12}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="L"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-step`} className="label">
              + adds
            </label>
            <input
              id={`${id}-step`}
              type="number"
              inputMode="decimal"
              required
              min="0.01"
              step="any"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <fieldset>
        <legend className="label">How hard is this for you?</legend>
        <div className="mt-1 grid grid-cols-3 gap-1 sm:grid-cols-5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={matched?.id === d.id}
              onClick={() => setXp(String(d.xp))}
              className={`flex min-h-touch flex-col items-center justify-center border px-1 leading-tight ${
                matched?.id === d.id ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:text-text'
              }`}
            >
              <span className="font-display text-sm font-semibold uppercase tracking-wide">{d.label}</span>
              <span className="text-xs">{d.xp} XP</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="w-28">
            <label htmlFor={`${id}-xp`} className="label">
              XP
            </label>
            <input
              id={`${id}-xp`}
              type="number"
              inputMode="numeric"
              required
              min={QUEST_XP_MIN}
              max={QUEST_XP_MAX}
              step={5}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
              className={inputClass}
            />
          </div>
          <p className="pb-3 text-xs text-muted">
            {matched ? matched.label : 'Custom'} · fine-tune from {QUEST_XP_MIN} to {QUEST_XP_MAX}
          </p>
        </div>
      </fieldset>

      <div className="flex gap-2 pt-1">
        <Button type="submit">{submitLabel}</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
