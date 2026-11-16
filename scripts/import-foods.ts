/**
 * Builds the bundled food list from USDA FoodData Central (public domain).
 *
 *   npm run import:foods                    (FDC API; set FDC_API_KEY or it uses DEMO_KEY)
 *   npm run import:foods -- --file <path> --file <path> …
 *       (the JSON downloads instead of the API: SR Legacy, Foundation and FNDDS "survey"
 *        from https://fdc.nal.usda.gov/download-datasets — pass all three)
 *
 * Reads `foodList.ts` + `dishList.ts` in `src/features/food/library/` (the coach's
 * lists: ids, names, groups, serving overrides) and writes `foods.json` next to them
 * with kcal, protein, carbs, fat and fibre per 100 g and up to four household servings.
 * Fails if any id is unknown or misses calories or a macro, so the list stays honest.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { FOOD_LIST, SERVING_OVERRIDES } from '../src/features/food/library/foodList.ts'
import type { UsdaJsonEntry } from '../src/features/food/library/types.ts'

const outPath = fileURLToPath(new URL('../src/features/food/library/foods.json', import.meta.url))

interface FdcNutrient {
  nutrient: { number: string }
  amount?: number
}
interface FdcPortion {
  amount?: number
  measureUnit?: { name?: string }
  modifier?: string
  portionDescription?: string
  gramWeight: number
  sequenceNumber?: number
}
interface FdcFood {
  fdcId: number
  description: string
  foodNutrients: FdcNutrient[]
  foodPortions?: FdcPortion[]
}

async function fromApi(ids: number[]): Promise<FdcFood[]> {
  const key = process.env.FDC_API_KEY || 'DEMO_KEY'
  const out: FdcFood[] = []
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const url = `https://api.nal.usda.gov/fdc/v1/foods?api_key=${key}&format=full&fdcIds=${chunk.join(',')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`FDC API ${res.status} ${res.statusText} (rate limited? set FDC_API_KEY or use --file)`)
    out.push(...((await res.json()) as FdcFood[]))
  }
  return out
}

async function fromFile(path: string): Promise<FdcFood[]> {
  const data = JSON.parse(await readFile(path, 'utf8')) as { SRLegacyFoods?: FdcFood[]; FoundationFoods?: FdcFood[]; SurveyFoods?: FdcFood[] }
  return [...(data.SRLegacyFoods ?? []), ...(data.FoundationFoods ?? []), ...(data.SurveyFoods ?? [])]
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

const FRACTIONS: Record<string, string> = { '0.5': '½', '0.25': '¼', '0.33': '⅓', '0.75': '¾' }

/** Portions that aren't useful as servings (weights we already offer, whole packages, recipe yields). */
const SKIP = /^(oz|lb|g|kg|fl oz|ounces?)\b|package|yield|quart|pint|gallon|bunch|\bhead\b|loaf|roast\b|cubic inch|\bbag\b|^\d/i

/** Everyday portions first: a medium banana before a cup of mashed banana. */
const PREFERRED = [/\bmedium\b/i, /\blarge\b/i, /\bsmall\b/i, /serving|slice|piece|fillet|breast|link|patty|scoop/i, /tbsp|tsp/i, /cup/i]
const rank = (text: string) => {
  const i = PREFERRED.findIndex((re) => re.test(text))
  // "extra large" / "extra small" after the plain sizes.
  return (i === -1 ? PREFERRED.length : i) + (/\bextra\b/i.test(text) ? 3 : 0)
}

/**
 * FNDDS (survey) portions already read "1 cup", "1 sandwich", "1 medium"; their
 * `modifier` is a code. SR Legacy portions are an amount + a modifier ("large").
 */
const isSurvey = (p: FdcPortion) => /^\d+$/.test(p.modifier ?? '')
const SURVEY_SKIP = /quantity not specified|^1 (oz|fl oz|g|lb)\b|guideline amount|^\d+(\.\d+)? (oz|fl oz|g)\b/i
const portionText = (p: FdcPortion) => (isSurvey(p) ? p.portionDescription : p.modifier || p.portionDescription) || ''

/** USDA portions → clean serving labels ("1 large", "1 cup, chopped"), at most four. */
function servingsFrom(portions: FdcPortion[] = []): [string, number][] {
  const seen = new Set<string>()
  const out: [string, number][] = []
  const sorted = [...portions].sort(
    (a, b) => rank(portionText(a)) - rank(portionText(b)) || (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0),
  )
  for (const p of sorted) {
    if (!(p.gramWeight > 0) || p.gramWeight > 1000) continue
    if (isSurvey(p)) {
      const text = (p.portionDescription ?? '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim()
      if (!text || SURVEY_SKIP.test(text)) continue
      const label = text.slice(0, 40)
      if (seen.has(label.toLowerCase())) continue
      seen.add(label.toLowerCase())
      out.push([label, round(p.gramWeight, 1)])
      if (out.length === 4) break
      continue
    }
    const raw = (p.modifier || p.portionDescription || '').trim()
    if (!raw || SKIP.test(raw)) continue
    const text = raw
      .replace(/\([^)]*\)/g, '')
      .replace(/NLEA serving/i, 'serving')
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/[,\s]+$/, '')
      .trim()
    if (!text) continue
    const amount = p.amount ?? 1
    const amountText = FRACTIONS[String(round(amount))] ?? String(round(amount))
    const label = `${amountText} ${text}`.slice(0, 40)
    if (seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push([label, round(p.gramWeight, 1)])
    if (out.length === 4) break
  }
  return out
}

function nutrient(f: FdcFood, number: string): number | undefined {
  return f.foodNutrients.find((n) => n.nutrient.number === number)?.amount
}

const files = process.argv.flatMap((a, i) => (a === '--file' && process.argv[i + 1] ? [process.argv[i + 1]!] : []))
const ids = FOOD_LIST.map((f) => f.fdcId)
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupes.length) throw new Error(`Listed twice in foodList.ts: ${dupes.join(', ')}`)

const source = files.length ? (await Promise.all(files.map(fromFile))).flat() : await fromApi(ids)
const byId = new Map(source.map((f) => [f.fdcId, f]))

const problems: string[] = []
const entries: UsdaJsonEntry[] = []
for (const item of FOOD_LIST) {
  const f = byId.get(item.fdcId)
  if (!f) {
    problems.push(`${item.fdcId} (${item.name}): not found in USDA data`)
    continue
  }
  const kj = nutrient(f, '268')
  const kcal = nutrient(f, '208') ?? (kj !== undefined ? kj / 4.184 : undefined)
  const values = [kcal, nutrient(f, '203'), nutrient(f, '205'), nutrient(f, '204')]
  if (values.some((v) => v === undefined)) {
    problems.push(`${item.fdcId} (${item.name}): missing calories or a macro`)
    continue
  }
  const override = SERVING_OVERRIDES[item.fdcId]
  const fiber = nutrient(f, '291')
  const n = values.map((v) => round(v!)) as number[]
  if (fiber !== undefined) n.push(round(fiber, 1))
  entries.push({
    id: item.fdcId,
    name: item.name,
    group: item.group,
    n: n as UsdaJsonEntry['n'],
    s: override ? override.map(([l, g]) => [l, g]) : servingsFrom(f.foodPortions),
  })
}
if (problems.length) throw new Error(`foodList.ts has problems:\n  ${problems.join('\n  ')}`)

await writeFile(outPath, JSON.stringify(entries) + '\n')
console.log(`Wrote ${entries.length} foods to foods.json`)
