// Sloty tekstowe Expo (IU-2.5) i szablon planu: treść stacku, walidacja pliku flow (D17), kopia szablonu pilnowana porównaniem z wersją web.
// Sekcje, do których odsyła rdzeń, sprawdzają testy rdzenia biegnące na wariancie (`sloty-stacku`, `sloty-skilli`).
//
// Uruchomienie: node --test stacks/expo/__tests__/sloty-tekstowe.test.mjs

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)

/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(WARIANT, sciezka), 'utf8')
/** @param {string} sciezka */
const modul = (sciezka) => import(pathToFileURL(join(WARIANT, sciezka)).href)
const { parsujPlan } = await modul('.claude/scripts/plan/plan-techniczny.mjs')
const { sprawdzPlan } = await modul('.claude/scripts/plan/walidacja-planu.mjs')

const SLOWA_WEB = /vitest|\bvite\b|agent-browser|tailwind-react|e2e\/seeds|VITE_|5173|5174|localhost:/i
const SZABLON = '.claude/skills/dev-plan/references/szablon-planu.md'

test('sloty tekstowe bez słów stacku web', () => {
  for (const slot of ['.claude/stack/buildery.md', '.claude/stack/walidacja.md', '.claude/stack/plan-e2e.md', '.claude/stack/fix-e2e.md', '.claude/skills/dev-plan/references/stack.md', SZABLON]) {
    assert.doesNotMatch(czytaj(slot), SLOWA_WEB, slot)
  }
})

test('buildery: routing po src/app, trzy role, każdy skill z tabeli istnieje w wariancie', () => {
  const b = czytaj('.claude/stack/buildery.md')
  assert.match(b, /`src\/app\/` albo `app\/`/)
  const wiersze = [...b.matchAll(/^\|[^|]+\| `(feature-builder-[\w-]+)` \| ([^|]+) \|$/gm)]
  assert.deepEqual(wiersze.map((w) => w[1]), ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack'])
  for (const [, builder, skille] of wiersze) {
    for (const s of skille.split(',').map((x) => x.trim())) assert.ok(existsSync(join(WARIANT, `.claude/skills/${s}/SKILL.md`)), `${builder}: ${s}`)
  }
})

test('walidacja: konfiguracja Jest z tabeli spike\'a, krok build bez eas, typy na czystym checkoucie', () => {
  const w = czytaj('.claude/stack/walidacja.md')
  const blok = /```json\n([\s\S]*?)\n```/.exec(w)
  assert.ok(blok, 'brak bloku konfiguracji Jest')
  const jest = JSON.parse(blok[1])
  assert.equal(jest.preset, 'jest-expo')
  assert.equal(jest.resolver, 'react-native-reanimated/jest/resolver')
  assert.deepEqual(jest.testPathIgnorePatterns, ['/node_modules/', '<rootDir>/.claude/'])
  for (const paczka of ['standard-navigation', 'uniwind']) assert.ok(jest.transformIgnorePatterns[0].includes(paczka), paczka)
  assert.deepEqual(Object.keys(jest.moduleNameMapper), ['\\.css$', '^@/assets/(.*)$'])
  assert.match(w, /`npx expo export --platform ios --platform android --output-dir \.expo\/export-walidacja`/)
  assert.match(w, /`eas build` nie jest krokiem walidacji/)
  assert.match(w, /`npx expo customize tsconfig\.json`/)
  assert.match(w, /`src\/uniwind-types\.d\.ts`[^\n]*\n?[^\n]*commitujesz/)
  assert.match(w, /`Jest worker encountered`/)
  assert.match(w, /<View><Text>warmup<\/Text><\/View>/)
})

test('plan-e2e: identyfikator flow i plik jako deliverable, seedy i runner w .maestro, granica natywnych powierzchni', () => {
  const p = czytaj('.claude/stack/plan-e2e.md')
  assert.match(p, /- \[E2E\] \\`<flow>\\`\[ \(seed: \.maestro\/<x>-seed\.sql\)\]/)
  assert.match(p, /`Stwórz \(e2e flow\)` z\s+`\.maestro\/<flow>\.yaml`/)
  assert.match(p, /`Modyfikuj \(e2e flow\)`/)
  assert.match(p, /`Stwórz \(e2e seed\)` z `\.maestro\/<flow>-seed\.sql`/)
  assert.match(p, /`\.maestro\/<etap>-run-all\.sh`/)
  assert.match(p, /picker zdjęć/)
  assert.match(p, /`runScript: \.maestro\/inject-\*\.js`/)
  assert.deepEqual(JSON.parse(czytaj('.claude/stack/profil.json')).e2e.plikFlow, '.maestro/<flow>.yaml')
})

test('fix-e2e: ponowne odegranie przez Maestro i pisanie brakującego flow; poprawka wizualna przez hierarchy', () => {
  const f = czytaj('.claude/stack/fix-e2e.md')
  assert.match(f, /`node \.claude\/scripts\/e2e\/expo-flow\.mjs --zadanie <folder> --flow <flow>`/)
  assert.match(f, /„brak flow”, najpierw piszesz `\.maestro\/<flow>\.yaml`/)
  assert.match(f, /`maestro hierarchy --compact`/)
})

// Kopia szablonu planu: wersja Expo = wersja web po tych zmianach. Zmiana web bez przeniesienia zatrzymuje test.
const ZMIANY_SZABLONU = [
  ['akcje `Stwórz`, `Modyfikuj`, `Usuń`, `Test (unit)`, `Stwórz (e2e seed)` |', 'akcje `Stwórz`, `Modyfikuj`, `Usuń`, `Test (unit)`, `Stwórz (e2e flow)`, `Modyfikuj (e2e flow)`, `Stwórz (e2e seed)` |'],
  ['`- [E2E] \\`e2e/<runner>.sh\\` — <stan>` dla runnera', '`- [E2E] \\`.maestro/<runner>.sh\\` — <stan>` dla runnera'],
  ['- `pnpm vitest run src/services/notatki-service.test.ts` przechodzi', '- `npx jest src/services/notatki-service.test.ts --watchAll=false` przechodzi'],
  ['- `pnpm typecheck` przechodzi bez błędów', '- `npx tsc --noEmit` przechodzi bez błędów'],
  ['| Stwórz (e2e seed) | `e2e/seeds/notatki-klienta-seed.sql` | 0 → 25 | — | nowy |', '| Stwórz (e2e flow) | `.maestro/notatki-klienta.yaml` | 0 → 15 | — | nowy |\n| Stwórz (e2e seed) | `.maestro/notatki-klienta-seed.sql` | 0 → 25 | — | nowy |'],
  ['**Skills in play:** tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration', '**Skills in play:** rn-expo-guidelines, ux-ui-guidelines-mobile, uniwind, supabase-dev-guidelines, security, sentry-integration'],
  ['- [E2E] `notatki-klienta` (seed: e2e/seeds/notatki-klienta-seed.sql) — otwórz /klienci/<id klienta z seeda>, wpisz notatkę, kliknij „Dodaj notatkę”, zrób screenshot → notatka jest pierwsza na liście', '- [E2E] `notatki-klienta` (seed: .maestro/notatki-klienta-seed.sql) — openLink na /klienci/<id klienta z seeda>, inputText z notatką, tapOn „Dodaj notatkę”, takeScreenshot → notatka jest pierwsza na liście'],
  ['- `pnpm vitest run src/features/klienci` przechodzi', '- `npx jest src/features/klienci --watchAll=false` przechodzi'],
  ['Seed `notatki-klienta-seed.sql` powstaje w tej samej IU co scenariusz, który go używa.', 'Plik flow `.maestro/notatki-klienta.yaml` i seed `notatki-klienta-seed.sql` powstają w tej samej IU co scenariusz, który ich używa.'],
]

test('szablon planu: kopia Expo to wersja web plus nazwane zmiany', () => {
  let oczekiwany = readFileSync(join(KORZEN, SZABLON), 'utf8')
  for (const [z, na] of ZMIANY_SZABLONU) {
    assert.ok(oczekiwany.includes(z), `w wersji web nie ma: ${z}`)
    oczekiwany = oczekiwany.replace(z, na)
  }
  assert.equal(czytaj(SZABLON), oczekiwany)
})

/** @param {string} plan @param {Record<string, string>} [dodatkowe] @returns {string[]} błędy walidacji w projekcie z plikami przykładu */
function bledy(plan, dodatkowe = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'expo-plan-'))
  const pliki = { 'docs/DESIGN.md': '#\n', '.env.e2e': 'X=1\n', 'src/services/klienci-service.ts': 'export const x = 1\n', 'src/features/klienci/components/karta-klienta.tsx': 'const x = 1\n'.repeat(285), ...dodatkowe }
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
    writeFileSync(join(projekt, sciezka), tresc)
  }
  return sprawdzPlan(parsujPlan(plan), projekt).bledy
}

const WIERSZ_FLOW = '| Stwórz (e2e flow) | `.maestro/notatki-klienta.yaml` | 0 → 15 | — | nowy |\n'
const BLAD_FLOW = 'IU-2: flow `notatki-klienta` — pliku .maestro/notatki-klienta.yaml nie ma w polu Pliki (Stwórz (e2e flow)) ani w repo'

test('walidacja planu (D17): [E2E] bez pliku flow to błąd; plik w polu Pliki albo w repo przechodzi', () => {
  const plan = `${/```markdown\n([\s\S]*?)\n```\n/.exec(czytaj(SZABLON))?.[1]}\n`
  assert.ok(plan.includes(WIERSZ_FLOW))
  assert.deepEqual(bledy(plan), [])
  const bezWiersza = plan.replace(WIERSZ_FLOW, '')
  assert.deepEqual(bledy(bezWiersza), [BLAD_FLOW])
  assert.deepEqual(bledy(bezWiersza, { '.maestro/notatki-klienta.yaml': 'appId: x\n' }), [])
  assert.deepEqual(bledy(plan.replace(WIERSZ_FLOW, WIERSZ_FLOW.replace('Stwórz', 'Modyfikuj'))), [])
})

test('dev-plan: przygotowanie operatora z kluczami EXPO_PUBLIC_*, assetami i canary', () => {
  const s = czytaj('.claude/skills/dev-plan/references/stack.md')
  assert.match(s, /^## Przygotowanie operatora$/m)
  assert.match(s, /`EXPO_PUBLIC_\*`/)
  assert.match(s, /e2e\.mjs start` kończy się statusem `gotowe`/)
})

test('smoke: kontrola świeżości dev-clienta przed zapisem startu aplikacji', () => {
  assert.match(czytaj('.claude/skills/dev-docs-complete/references/stack.md'), /`node \.claude\/scripts\/e2e\/expo-swiezosc\.mjs`/)
  assert.ok(existsSync(join(WARIANT, '.claude/scripts/e2e/expo-swiezosc.mjs')))
})

test('wyłączone urządzenie to nie przebudowa: slot po-fazie i pozycja smoke\'u bez prebuild', () => {
  const poFazie = czytaj('.claude/stack/po-fazie.md')
  assert.match(poFazie, /^- Brak działającego urządzenia to nie przebudowa: wystarczy je włączyć\./m)
  const smoke = czytaj('.claude/skills/dev-docs-complete/references/stack.md')
  const pozycja = smoke.match(/- \[ \] Włącz urządzenie i sprawdź dev-client[^\n]*/)
  assert.ok(pozycja, 'brak pozycji sekcji 0 dla wyłączonego urządzenia')
  assert.doesNotMatch(pozycja[0], /prebuild/)
})
