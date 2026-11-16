import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { ChevronLeftIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import type { Nutrient, Serving } from '../../lib/db'
import { IconButton, inputClass, NumberField } from '../train/workouts/fields'
import {
  applyFixToEntries,
  BRAND_MAX,
  createCustomFood,
  DEFAULT_SERVING_LABEL,
  deleteCustomFood,
  FOOD_NAME_MAX,
  getCustomFood,
  getFood,
  MAX_SERVINGS,
  NOMINAL_GRAMS,
  PER100_MAX,
  SERVING_LABEL_MAX,
  updateCustomFood,
} from './foodsRepo'
import { formatKcal, kcalFromMacros, MACROS, missingText, NUTRIENT_LABELS, type Macro } from './nutrition'
import { cleanBarcode } from './off'

type Values = Record<Nutrient, number | undefined>

interface Draft {
  name: string
  brand: string
  barcode: string
  /** The serving the values are for ("1 plate", "100 g"). */
  servingLabel: string
  /** Its weight; empty = not known (the food is logged by servings only). */
  servingGrams: number | undefined
  values: Values
  /** More servings (only for foods with a weight). */
  servings: { key: string; label: string; grams: number | undefined }[]
  basedOn?: string
  /** What Open Food Facts was missing (when completing a product). */
  missing?: Nutrient[]
  /** Show "More details" open (editing a detailed food, completing a product). */
  details: boolean
}

const blank = (): Draft => ({
  name: '',
  brand: '',
  barcode: '',
  servingLabel: DEFAULT_SERVING_LABEL,
  servingGrams: undefined,
  values: { kcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined },
  servings: [],
  details: false,
})

const key = () => crypto.randomUUID()
const scale = (v: number | undefined, f: number) => (v === undefined ? undefined : Math.round(v * f * 10) / 10)

/**
 * Create or edit your own food. Only a name and calories are needed ("Mom's lasagna,
 * 1 plate, 650"); weight, macros, brand, barcode and more servings sit under "More
 * details". `?from=off-…` completes a packaged food whose nutrition is incomplete.
 */
export function CustomFoodFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ids = useId()
  const [draft, setDraft] = useState<Draft>()
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const from = params.get('from')
  useEffect(() => {
    let cancelled = false
    async function load(): Promise<Draft | undefined> {
      if (id) {
        const c = await getCustomFood(id)
        if (!c) return undefined
        const first = c.servings[0]
        const missing = new Set(c.missing ?? [])
        const per = (f: number): Values => ({
          kcal: scale(c.per100.kcal, f),
          proteinG: missing.has('proteinG') ? undefined : scale(c.per100.proteinG, f),
          carbsG: missing.has('carbsG') ? undefined : scale(c.per100.carbsG, f),
          fatG: missing.has('fatG') ? undefined : scale(c.per100.fatG, f),
        })
        const base = { name: c.name, brand: c.brand ?? '', barcode: c.barcode ?? '', basedOn: c.basedOn }
        if (first?.nominal) {
          return { ...base, servingLabel: first.label, servingGrams: undefined, values: per(1), servings: [], details: missing.size < 3 }
        }
        if (first) {
          return {
            ...base,
            servingLabel: first.label,
            servingGrams: first.grams,
            values: per(first.grams / 100),
            servings: c.servings.slice(1).map((s) => ({ key: key(), ...s })),
            details: true,
          }
        }
        return { ...base, servingLabel: '100 g', servingGrams: 100, values: per(1), servings: [], details: true }
      }
      const d = blank()
      d.name = params.get('name')?.slice(0, FOOD_NAME_MAX) ?? ''
      d.barcode = cleanBarcode(params.get('barcode') ?? '') ?? ''
      if (d.barcode) d.details = true
      if (from) {
        const food = await getFood(from)
        if (food) {
          d.name = food.name
          d.brand = food.brand ?? ''
          d.basedOn = food.barcode
          d.missing = food.missing
          d.servingLabel = '100 g'
          d.servingGrams = 100
          d.values = {
            kcal: food.missing?.includes('kcal') ? undefined : food.per100.kcal,
            proteinG: food.missing?.includes('proteinG') ? undefined : food.per100.proteinG,
            carbsG: food.missing?.includes('carbsG') ? undefined : food.per100.carbsG,
            fatG: food.missing?.includes('fatG') ? undefined : food.per100.fatG,
          }
          d.servings = food.servings.map((s) => ({ key: key(), ...s }))
          d.details = true
        }
      }
      return d
    }
    void load().then((d) => {
      if (cancelled) return
      if (d) setDraft(d)
      else setNotFound(true)
    })
    return () => {
      cancelled = true
    }
  }, [id, from, params])

  if (notFound) {
    return (
      <>
        <PageHeader title="Food not found" />
        <p className="text-muted">It may have been deleted.</p>
        <Link to="/food/foods" className="mt-3 inline-block text-accent underline">
          My foods
        </Link>
      </>
    )
  }
  if (!draft) return <p className="text-muted">Loading…</p>

  const set = (changes: Partial<Draft>) => setDraft({ ...draft, ...changes })
  const setValue = (n: Nutrient, v: number | undefined) => setDraft({ ...draft, values: { ...draft.values, [n]: v } })

  const macroKcal = kcalFromMacros({ proteinG: draft.values.proteinG ?? 0, carbsG: draft.values.carbsG ?? 0, fatG: draft.values.fatG ?? 0 })
  const kcal = draft.values.kcal ?? (macroKcal > 0 ? macroKcal : undefined)
  const grams = draft.servingGrams
  // Values per 100 g; without a weight, "per 100 g" holds the values per serving.
  const factor = grams ? 100 / grams : 1
  const per100 = {
    kcal: (kcal ?? 0) * factor,
    proteinG: (draft.values.proteinG ?? 0) * factor,
    carbsG: (draft.values.carbsG ?? 0) * factor,
    fatG: (draft.values.fatG ?? 0) * factor,
  }
  const tooHigh = grams ? (['kcal', ...MACROS] as const).filter((n) => per100[n] > PER100_MAX[n]) : []
  const valid = draft.name.trim() !== '' && kcal !== undefined && tooHigh.length === 0
  const label = draft.servingLabel.trim() || DEFAULT_SERVING_LABEL

  function servingsToSave(): Serving[] {
    if (!grams) return [{ label, grams: NOMINAL_GRAMS, nominal: true }]
    const extra = draft!.servings.filter((s) => s.label.trim() && s.grams).map((s) => ({ label: s.label, grams: s.grams! }))
    // "100 g" needs no serving of its own: grams are always offered.
    return /^100 ?g$/i.test(label) && grams === 100 ? extra : [{ label, grams }, ...extra]
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || !draft) return
    const missing: Nutrient[] = MACROS.filter((m) => draft.values[m] === undefined)
    const fields = { name: draft.name, brand: draft.brand, barcode: draft.barcode, per100, servings: servingsToSave(), basedOn: draft.basedOn, missing }
    if (id) {
      await updateCustomFood(id, fields)
    } else {
      const newId = await createCustomFood(fields)
      if (draft.basedOn) await applyFixToEntries(draft.basedOn, newId)
    }
    navigate(-1)
  }

  async function remove() {
    if (!id) return
    await deleteCustomFood(id)
    navigate('/food/foods', { replace: true })
  }

  const macroField = (n: Macro) => (
    <div key={n}>
      <label htmlFor={`${ids}-${n}`} className="label">
        {NUTRIENT_LABELS[n]} (g)
      </label>
      <NumberField
        id={`${ids}-${n}`}
        className={`mt-1 ${draft.missing?.includes(n) && draft.values[n] === undefined ? 'border-accent' : ''}`}
        value={draft.values[n]}
        onChange={(v) => setValue(n, v)}
        min={0}
        max={1000}
        precision={1}
        optional
        placeholder="?"
      />
      {draft.missing?.includes(n) && draft.values[n] === undefined && <p className="mt-1 text-xs text-accent">Missing</p>}
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        Back
      </button>
      <PageHeader title={id ? 'Edit food' : draft.basedOn ? 'Complete product' : 'New food'} />

      <form onSubmit={(e) => void save(e)} className="space-y-4">
        {draft.missing?.length ? (
          <p className="border border-panel-edge bg-panel p-4" role="note">
            Open Food Facts is missing the <strong>{missingText(draft.missing)}</strong>. Fill {draft.missing.length > 1 ? 'them' : 'it'} in from the label. This copy
            is yours: it syncs to your account and is used whenever you scan this barcode.
          </p>
        ) : null}

        <Panel title="Food">
          <div className="space-y-4">
            <div>
              <label htmlFor={`${ids}-name`} className="label">
                Name
              </label>
              <input
                id={`${ids}-name`}
                required
                className={`${inputClass} mt-1`}
                value={draft.name}
                maxLength={FOOD_NAME_MAX}
                placeholder="e.g. Mom’s lasagna"
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
              <div>
                <label htmlFor={`${ids}-serving`} className="label">
                  Serving
                </label>
                <input
                  id={`${ids}-serving`}
                  className={`${inputClass} mt-1`}
                  value={draft.servingLabel}
                  maxLength={SERVING_LABEL_MAX}
                  placeholder="e.g. 1 plate"
                  onChange={(e) => set({ servingLabel: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`${ids}-kcal`} className="label">
                  Calories
                </label>
                <NumberField
                  id={`${ids}-kcal`}
                  className={`mt-1 ${draft.missing?.includes('kcal') && draft.values.kcal === undefined ? 'border-accent' : ''}`}
                  value={draft.values.kcal}
                  onChange={(v) => setValue('kcal', v)}
                  min={0}
                  max={10000}
                  optional
                  placeholder={macroKcal > 0 ? String(macroKcal) : 'kcal'}
                />
              </div>
            </div>
            {draft.values.kcal === undefined && macroKcal > 0 && <p className="text-sm text-muted">{formatKcal(macroKcal)} kcal worked out from the macros.</p>}
          </div>
        </Panel>

        <details open={draft.details} onToggle={(e) => set({ details: (e.target as HTMLDetailsElement).open })} className="border border-panel-edge bg-panel">
          <summary className="flex min-h-touch cursor-pointer items-center px-4 font-display text-lg font-bold uppercase tracking-wider hover:text-accent">
            More details
            <span className="ml-2 font-body text-sm font-normal normal-case tracking-normal text-muted">weight, macros, brand, barcode</span>
          </summary>
          <div className="space-y-4 border-t border-line-soft p-4">
            <div>
              <label htmlFor={`${ids}-grams`} className="label">
                Weight of {label} (g)
              </label>
              <NumberField
                id={`${ids}-grams`}
                className="mt-1 w-32"
                value={draft.servingGrams}
                onChange={(v) => set({ servingGrams: v })}
                min={1}
                max={5000}
                precision={1}
                optional
                placeholder="?"
              />
              <p className="mt-1 text-sm text-muted">Leave empty if you don’t know: you’ll log it by servings. Copying a label? Set the serving to “100 g”.</p>
            </div>

            <fieldset>
              <legend className="label">Macros per {label} (optional)</legend>
              <div className="mt-1 grid grid-cols-3 gap-2">{MACROS.map(macroField)}</div>
              {tooHigh.length > 0 && (
                <p role="alert" className="mt-2 text-sm">
                  That’s more than {grams} g can hold. Check the weight.
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${ids}-brand`} className="label">
                  Brand (optional)
                </label>
                <input id={`${ids}-brand`} className={`${inputClass} mt-1`} value={draft.brand} maxLength={BRAND_MAX} onChange={(e) => set({ brand: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${ids}-barcode`} className="label">
                  Barcode (optional)
                </label>
                <input
                  id={`${ids}-barcode`}
                  className={`${inputClass} mt-1 tabular-nums`}
                  inputMode="numeric"
                  value={draft.basedOn ?? draft.barcode}
                  disabled={!!draft.basedOn}
                  maxLength={20}
                  onChange={(e) => set({ barcode: e.target.value })}
                />
                {draft.barcode && !draft.basedOn && !cleanBarcode(draft.barcode) && <p className="mt-1 text-sm text-muted">A barcode is 8 to 14 digits.</p>}
              </div>
            </div>

            {grams ? (
              <div>
                <p className="label">
                  More servings ({draft.servings.length} / {MAX_SERVINGS - 1})
                </p>
                <p className="text-sm text-muted">Optional: other portions you log often, like “1 bar = 45 g”.</p>
                <ul className="mt-3 space-y-2">
                  {draft.servings.map((s, i) => (
                    <li key={s.key} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`${ids}-sl-${s.key}`} className="label">
                          Serving {i + 2}
                        </label>
                        <input
                          id={`${ids}-sl-${s.key}`}
                          className={`${inputClass} mt-1`}
                          placeholder="e.g. 1 bar"
                          maxLength={SERVING_LABEL_MAX}
                          value={s.label}
                          onChange={(e) => set({ servings: draft.servings.map((x) => (x.key === s.key ? { ...x, label: e.target.value } : x)) })}
                        />
                      </div>
                      <div className="w-24">
                        <label htmlFor={`${ids}-sg-${s.key}`} className="label">
                          Grams
                        </label>
                        <NumberField
                          id={`${ids}-sg-${s.key}`}
                          className="mt-1"
                          value={s.grams}
                          onChange={(v) => set({ servings: draft.servings.map((x) => (x.key === s.key ? { ...x, grams: v } : x)) })}
                          min={0.1}
                          max={5000}
                          precision={1}
                          optional
                        />
                      </div>
                      <IconButton label={`Remove serving ${i + 2}`} onClick={() => set({ servings: draft.servings.filter((x) => x.key !== s.key) })}>
                        <TrashIcon size={18} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                {draft.servings.length < MAX_SERVINGS - 1 && (
                  <Button variant="secondary" className="mt-3" onClick={() => set({ servings: [...draft.servings, { key: key(), label: '', grams: undefined }] })}>
                    <PlusIcon size={18} />
                    Add serving
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!valid} className="flex-1 sm:flex-none">
            Save food
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          {id && (
            <Button variant="secondary" className="sm:ml-auto" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
        {!valid && draft.name.trim() !== '' && kcal === undefined && <p className="text-sm text-muted">Add the calories to save.</p>}
      </form>

      {confirmDelete && (
        <Dialog title="Delete this food?" onClose={() => setConfirmDelete(false)}>
          <p>Food you already logged keeps its numbers. Favourites and saved meals keep their copy too.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
