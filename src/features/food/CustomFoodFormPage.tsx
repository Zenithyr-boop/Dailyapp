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
  deleteCustomFood,
  FOOD_NAME_MAX,
  getCustomFood,
  getFood,
  MAX_SERVINGS,
  PER100_MAX,
  SERVING_LABEL_MAX,
  updateCustomFood,
} from './foodsRepo'
import { formatKcal, kcalFromMacros, missingText, NUTRIENT_LABELS, NUTRIENTS } from './nutrition'
import { cleanBarcode } from './off'

type Values = Record<Nutrient, number | undefined>

interface Draft {
  name: string
  brand: string
  barcode: string
  /** The label's values are per this many grams (100, or a serving). */
  basis: number
  values: Values
  servings: { key: string; label: string; grams: number | undefined }[]
  basedOn?: string
  /** What Open Food Facts was missing (when completing a product). */
  missing?: Nutrient[]
}

const blank = (): Draft => ({
  name: '',
  brand: '',
  barcode: '',
  basis: 100,
  values: { kcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined },
  servings: [],
})

const key = () => crypto.randomUUID()

/** Create or edit your own food. `?from=off-…` completes a packaged food whose nutrition is incomplete. */
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
        return {
          name: c.name,
          brand: c.brand ?? '',
          barcode: c.barcode ?? '',
          basis: 100,
          values: { ...c.per100 },
          servings: c.servings.map((s) => ({ key: key(), ...s })),
          basedOn: c.basedOn,
        }
      }
      const d = blank()
      d.name = params.get('name')?.slice(0, FOOD_NAME_MAX) ?? ''
      d.barcode = cleanBarcode(params.get('barcode') ?? '') ?? ''
      if (from) {
        const food = await getFood(from)
        if (food) {
          d.name = food.name
          d.brand = food.brand ?? ''
          d.basedOn = food.barcode
          d.missing = food.missing
          for (const n of NUTRIENTS) d.values[n] = food.missing?.includes(n) ? undefined : food.per100[n]
          d.servings = food.servings.map((s) => ({ key: key(), ...s }))
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

  const factor = 100 / (draft.basis || 100)
  const macroKcal = kcalFromMacros({ proteinG: draft.values.proteinG ?? 0, carbsG: draft.values.carbsG ?? 0, fatG: draft.values.fatG ?? 0 })
  const kcal = draft.values.kcal ?? (macroKcal > 0 ? macroKcal : undefined)
  const per100 = {
    kcal: (kcal ?? 0) * factor,
    proteinG: (draft.values.proteinG ?? 0) * factor,
    carbsG: (draft.values.carbsG ?? 0) * factor,
    fatG: (draft.values.fatG ?? 0) * factor,
  }
  const tooHigh = NUTRIENTS.filter((n) => per100[n] > PER100_MAX[n])
  const valid = draft.name.trim() !== '' && kcal !== undefined && tooHigh.length === 0
  const servings: Serving[] = draft.servings.filter((s) => s.label.trim() && s.grams).map((s) => ({ label: s.label, grams: s.grams! }))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || !draft) return
    const fields = { name: draft.name, brand: draft.brand, barcode: draft.barcode, per100, servings, basedOn: draft.basedOn }
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
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
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
          </div>
        </Panel>

        <Panel title="Nutrition">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${ids}-basis`}>Values per</label>
            <NumberField id={`${ids}-basis`} className="w-24" value={draft.basis} onChange={(v) => set({ basis: v ?? 100 })} min={1} max={1000} />
            <span>g</span>
          </div>
          <p className="mt-1 text-sm text-muted">Copy the label’s “per 100 g” column, or set this to the serving size the label uses.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUTRIENTS.map((n) => (
              <div key={n}>
                <label htmlFor={`${ids}-${n}`} className="label">
                  {NUTRIENT_LABELS[n]} {n === 'kcal' ? '(kcal)' : '(g)'}
                </label>
                <NumberField
                  id={`${ids}-${n}`}
                  className={`mt-1 ${draft.missing?.includes(n) && draft.values[n] === undefined ? 'border-accent' : ''}`}
                  value={draft.values[n]}
                  onChange={(v) => setValue(n, v)}
                  min={0}
                  max={n === 'kcal' ? 10000 : 1000}
                  precision={n === 'kcal' ? 0 : 1}
                  optional
                  placeholder={n === 'kcal' && macroKcal > 0 ? String(macroKcal) : undefined}
                />
                {draft.missing?.includes(n) && draft.values[n] === undefined && <p className="mt-1 text-xs text-accent">Missing</p>}
              </div>
            ))}
          </div>
          {draft.values.kcal === undefined && macroKcal > 0 && <p className="mt-2 text-sm text-muted">{formatKcal(macroKcal)} kcal worked out from the macros.</p>}
          {tooHigh.length > 0 && (
            <p role="alert" className="mt-2 text-sm">
              That’s more than 100 g can hold. Check the “values per” amount.
            </p>
          )}
        </Panel>

        <Panel title="Servings" aside={`${draft.servings.length} / ${MAX_SERVINGS}`}>
          <p className="text-sm text-muted">Optional: portions you can log with one tap, like “1 bar = 45 g”.</p>
          <ul className="mt-3 space-y-2">
            {draft.servings.map((s, i) => (
              <li key={s.key} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${ids}-sl-${s.key}`} className="label">
                    Serving {i + 1}
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
                <IconButton label={`Remove serving ${i + 1}`} onClick={() => set({ servings: draft.servings.filter((x) => x.key !== s.key) })}>
                  <TrashIcon size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
          {draft.servings.length < MAX_SERVINGS && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => set({ servings: [...draft.servings, { key: key(), label: '', grams: undefined }] })}
            >
              <PlusIcon size={18} />
              Add serving
            </Button>
          )}
        </Panel>

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
        {!valid && draft.name.trim() !== '' && kcal === undefined && <p className="text-sm text-muted">Add the calories (or the macros) to save.</p>}
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
