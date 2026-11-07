// Fixture smoke'a autopilota w wersji RN (IU-2.6, D17, D18). Testy `.claude/templates/smoke-autopilot/__tests__/` sprawdzają fixture web
// (Vitest, pakiet workspace, strona statyczna), więc wariant ich nie ma (`usun.txt`), a kontrakt fixture'u sprawdza ten plik na ławce.
//
// Uruchomienie: node --test stacks/expo/__tests__/smoke-fixture.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const SMOKE = join(WARIANT, '.claude/templates/smoke-autopilot')
const zLawki = (/** @type {string} */ plik) => import(pathToFileURL(join(WARIANT, plik)).href)
const { KATALOG, PLAN_TECHNICZNY, SCIEZKA_PLANU, plikiFixture } = await zLawki('.claude/templates/smoke-autopilot/generuj-fixture.mjs')
const { parsujPlan } = await zLawki('.claude/scripts/plan/plan-techniczny.mjs')
const { sprawdzPlan } = await zLawki('.claude/scripts/plan/walidacja-planu.mjs')

const MIGRACJA = 'supabase/migrations/20260101000000_start.sql'
const KATALOG_KODU = 'src/lib'
const EKRAN = 'src/app/index.tsx'
const plan = readFileSync(join(KATALOG, PLAN_TECHNICZNY), 'utf8')

/** @param {string} tresc @param {boolean} zMigracja @returns {string} podstawienie jak `podstaw` w przygotuj-kopie.sh */
function podstaw(tresc, zMigracja) {
  const kod = tresc.replaceAll('{{KATALOG_KODU}}', KATALOG_KODU).replaceAll('{{EKRAN_GLOWNY}}', EKRAN).replaceAll('{{LINIE_EKRANU}}', '1 → 4')
  return zMigracja ? kod.replaceAll('{{MIGRACJA}}', MIGRACJA) : kod.split('\n').filter((l) => !l.includes('{{MIGRACJA}}')).join('\n')
}

/** @param {boolean} zMigracja @returns {{ bledy: string[], uwagi: string[] }} */
function walidacjaWKopii(zMigracja) {
  const tresc = podstaw(plan, zMigracja)
  const korzen = mkdtempSync(join(tmpdir(), 'fixture-rn-kopia-'))
  try {
    const pliki = { [SCIEZKA_PLANU]: tresc, '.env.e2e': '', [EKRAN]: 'export default function E() { return null }\n', ...(zMigracja ? { [MIGRACJA]: 'create table t (id int);\n' } : {}) }
    for (const [sciezka, t] of Object.entries(pliki)) {
      mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
      writeFileSync(join(korzen, sciezka), t)
    }
    return sprawdzPlan(parsujPlan(tresc), korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('wariant bez testów, pakietu i wstawiania pakietu fixture\'u web', () => {
  for (const plik of ['__tests__', 'pakiet', 'wstaw-pakiet.mjs']) assert.equal(existsSync(join(SMOKE, plik)), false, plik)
})

test('plan fixture\'u po podstawieniu przechodzi sprawdzanie planu: z migracją i bez, flow w polu Pliki (D17)', () => {
  assert.deepEqual(walidacjaWKopii(true), { bledy: [], uwagi: [] })
  assert.deepEqual(walidacjaWKopii(false).bledy, [])
})

test('pliki zadania fixture\'u = wynik generatora na wariancie', () => {
  for (const [plik, tresc] of Object.entries(plikiFixture())) assert.equal(readFileSync(join(KATALOG, plik), 'utf8'), tresc, `${plik} różni się od generatora`)
})

test('zadania fixture\'u: dwie fazy, cztery testy [Unit], [Manual] operatora w fazie 1, po jednym [E2E] w fazie', () => {
  const zadania = readFileSync(join(KATALOG, 'smoke-autopilot-zadania.md'), 'utf8')
  assert.deepEqual([...zadania.matchAll(/^## Faza (\d+) /gm)].map((m) => m[1]), ['1', '2'])
  assert.equal(zadania.match(/^- \[ \] Test: \[Unit\]/gm)?.length, 4)
  assert.match(zadania, /^## Operator checklist faza 1\n\n- \[ \] \[Manual\] .*\(IU-1\)$/m)
  const faza = (/** @type {number} */ n) => zadania.slice(zadania.indexOf(`## Faza ${n} `), n === 1 ? zadania.indexOf('## Faza 2 ') : undefined)
  assert.deepEqual([...faza(1).matchAll(/^- \[ \] Test: \[E2E\] `([^`]+)`/gm)].map((m) => m[1]), ['smoke-strona'])
  assert.deepEqual([...faza(2).matchAll(/^- \[ \] Test: \[E2E\] `([^`]+)`/gm)].map((m) => m[1]), ['smoke-strona-faza-2'])
  assert.match(readFileSync(join(KATALOG, 'smoke-autopilot-plan.md'), 'utf8'), /^Branch: `feature\/smoke-autopilot`$/m)
})

test('plan fixture\'u: jeden ekran i flow Maestro, wejście przez stopApp i openLink, bez śladów web', () => {
  assert.match(plan, /\| Stwórz \(e2e flow\) \| `\.maestro\/smoke-strona\.yaml` \|/)
  assert.match(plan, /\| Stwórz \(e2e flow\) \| `\.maestro\/smoke-strona-faza-2\.yaml` \|/)
  assert.match(plan, /testID="smoke-wynik"/)
  assert.match(plan, /- stopApp\n\s*- openLink: "\$\{APP_SCHEME\}:\/\/expo-development-client\/\?url=\$\{METRO_URL\}"/)
  assert.doesNotMatch(plan, /launchApp|\.html|data-testid|KATALOG_STRONY|vitest/i)
})

/** @param {{ lockfile?: string, ekran?: string | null, src?: boolean, migracja?: boolean }} o @returns {string} */
function zrodlo({ lockfile = 'package-lock.json', ekran = EKRAN, src = true, migracja = false }) {
  const k = mkdtempSync(join(tmpdir(), 'smoke-rn-zrodlo-'))
  after(() => rmSync(k, { recursive: true, force: true }))
  const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', k, ...a])
  git(['init', '-q'])
  git(['config', 'user.email', 't@t'])
  git(['config', 'user.name', 't'])
  const pliki = { 'package.json': '{}\n', [lockfile]: '', ...(ekran ? { [ekran]: 'x\n' } : {}), ...(src ? { 'src/hooks/a.ts': 'x\n' } : { 'hooks/a.ts': 'x\n' }), ...(migracja ? { [MIGRACJA]: 'select 1;\n' } : {}) }
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  git(['add', '.'])
  git(['commit', '-q', '-m', 'start'])
  return k
}

const uruchom = (/** @type {string} */ z) => spawnSync('bash', [join(SMOKE, 'przygotuj-kopie.sh'), z, join(tmpdir(), `smoke-rn-${process.pid}-${Math.random()}`), '--dry-run'], { encoding: 'utf8' })

test('przygotuj-kopie: składnia bash; kod w src/lib, ekran główny, menedżer z lockfile, kolejność fixture → doctor → bramki', () => {
  assert.equal(spawnSync('bash', ['-n', join(SMOKE, 'przygotuj-kopie.sh')], { encoding: 'utf8' }).status, 0)
  const w = uruchom(zrodlo({ migracja: true }))
  assert.equal(w.status, 0, w.stdout + w.stderr)
  assert.match(w.stdout, /^Kod zadania: src\/lib$/m)
  assert.match(w.stdout, /^Ekran główny: src\/app\/index\.tsx$/m)
  assert.match(w.stdout, /^Menedżer pakietów: npm$/m)
  assert.match(w.stdout, /^Migracja defektu: supabase\/migrations\/20260101000000_start\.sql$/m)
  assert.doesNotMatch(w.stdout, /pnpm|wstaw-pakiet|Vite/)
  const kroki = w.stdout.split('\n')
  const miejsce = (/** @type {string} */ f) => kroki.findIndex((l) => l.includes(f))
  assert.ok(miejsce('test(smoke): fixture') < miejsce('doctor.sh') && miejsce('doctor.sh') < miejsce('bazowe bramki'), w.stdout)
  assert.match(w.stdout, /npx expo customize tsconfig\.json/)
})

test('przygotuj-kopie: pnpm z lockfile, katalog lib i app w korzeniu, najpłytszy index z grup tras', () => {
  const pnpm = uruchom(zrodlo({ lockfile: 'pnpm-lock.yaml' }))
  assert.match(pnpm.stdout, /^Menedżer pakietów: pnpm$/m)
  assert.match(pnpm.stdout, /pnpm exec expo customize tsconfig\.json/)
  const bezSrc = uruchom(zrodlo({ src: false, ekran: 'app/(tabs)/index.tsx' }))
  assert.equal(bezSrc.status, 0, bezSrc.stdout + bezSrc.stderr)
  assert.match(bezSrc.stdout, /^Kod zadania: lib$/m)
  assert.match(bezSrc.stdout, /^Ekran główny: app\/\(tabs\)\/index\.tsx$/m)
})

test('przygotuj-kopie: projekt bez ekranu głównego = błąd z przyczyną, bez żadnego kroku', () => {
  const w = uruchom(zrodlo({ ekran: null }))
  assert.equal(w.status, 5)
  assert.match(w.stderr, /index\.tsx/)
  assert.doesNotMatch(w.stdout, /^\+ /m)
})

test('README fixture\'u: dev-client jako warunek, Metro zamiast serwera web, oba przebiegi', () => {
  const r = readFileSync(join(SMOKE, 'README.md'), 'utf8')
  assert.match(r, /dev-client/)
  assert.match(r, /`node \.claude\/scripts\/e2e\/e2e\.mjs stop`/)
  assert.match(r, /`smoke-strona-faza-2`/)
  assert.doesNotMatch(r, /Vite|agent-browser|smoke-autopilot\.html|vitest|wstaw-pakiet/i)
})
