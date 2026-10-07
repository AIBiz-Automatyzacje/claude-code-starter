// Skill /dev-plan a skrypty planowania (PLAN-POPRAWY P13): szablon planu ze skilla przechodzi walidacje i generator,
// tabela builderow zgadza sie z plikami agentow, handoff niesie polecenia skryptu i zdanie dla agentow workflow.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/skill-dev-plan.test.mjs
//
// DLACZEGO: model pisze plan z `references/szablon-planu.md`, a `plan.mjs sprawdz` odrzuca plan spoza kontraktu. Szablon
// rozjechany ze skryptem to kazdy plan odrzucony przy pierwszym `sprawdz` (petla poprawek w sesji operatora), a tabela
// builderow rozjechana z frontmatterami agentow to bledne `Skills in play` i `Delegate to` w kazdym planie.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bezOgonkow, parsujPlan } from '../plan-techniczny.mjs'
import { podsumowanieBudzetu } from '../budzet-pliku.mjs'
import { BUILDERZY, sprawdzPlan } from '../walidacja-planu.mjs'
import { zadanieZPlanu } from '../zadanie.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SKILL = join(REPO, '.claude/skills/dev-plan')
const SKILL_MD = readFileSync(join(SKILL, 'SKILL.md'), 'utf8')
const SZABLON = readFileSync(join(SKILL, 'references/szablon-planu.md'), 'utf8')
const SCIEZKA_PLANU = 'docs/plans/2026-10-07-001-feat-notatki-klienta-plan.md'

/** @returns {string} plan z bloku ```markdown sekcji „Przykład planu” szablonu */
function przykladPlanu() {
  const m = /## Przykład planu[\s\S]*?\n```markdown\n([\s\S]*?)\n```\n/.exec(SZABLON)
  assert.ok(m, 'szablon bez bloku ```markdown w sekcji „Przykład planu”')
  return `${m[1]}\n`
}

/** @param {string} plan @returns {string} projekt tymczasowy z planem i plikami, ktore plan modyfikuje albo wskazuje */
function projekt(plan) {
  const korzen = mkdtempSync(join(tmpdir(), 'skill-dev-plan-'))
  const pliki = {
    [SCIEZKA_PLANU]: plan,
    'docs/DESIGN.md': '# Design\n',
    '.env.e2e': 'X=1\n',
    'src/services/klienci-service.ts': 'export const x = 1\n',
    'src/features/klienci/components/karta-klienta.tsx': 'const x = 1\n'.repeat(285),
  }
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
    writeFileSync(join(korzen, sciezka), tresc)
  }
  return korzen
}

/** @param {string} plan @returns {{ bledy: string[], uwagi: string[] }} */
function sprawdz(plan) {
  const korzen = projekt(plan)
  try {
    return sprawdzPlan(parsujPlan(plan), korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('przykład planu ze szablonu przechodzi plan.mjs sprawdz bez błędów', () => {
  const w = sprawdz(przykladPlanu())
  assert.deepEqual(w.bledy, [])
  assert.deepEqual(w.uwagi, [`frontmatter: origin docs/brainstorms/YYYY-MM-DD-notatki-klienta-requirements.md — plik nie istnieje (popraw origin)`])
})

test('przykład planu: generator daje zadanie z dwiema fazami, scenariuszem E2E i pozycją operatora', () => {
  const korzen = projekt(przykladPlanu())
  try {
    const z = zadanieZPlanu(korzen, SCIEZKA_PLANU, { data: '2026-10-07' })
    assert.deepEqual(z.bledyBilansu, [])
    assert.equal(z.nazwa, 'notatki-klienta')
    assert.deepEqual(z.liczniki, { fazy: 2, iu: 2, implementacyjne: 9, testy: 4, weryfikacje: 3, e2e: 1, operator: 1 })
    const jednostki = parsujPlan(przykladPlanu()).fazy.flatMap((f) => f.iu)
    assert.deepEqual(podsumowanieBudzetu(jednostki), { iu_z_wymiarami: 1, wydzielenia: 1 })
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

test('przykład planu: bez wiersza Stwórz wydzielanego modułu i z plikiem ponad 360 linii walidacja odrzuca plan', () => {
  const plan = przykladPlanu()
  const bezStworz = plan.replace(/^\| Stwórz \| `src\/features\/klienci\/components\/kontakt-klienta\.tsx`.*\n/m, '')
    .replace(/^\| Stwórz \| `src\/features\/klienci\/components\/notatki-klienta\.tsx`.*\n/m, '')
  assert.notEqual(bezStworz, plan)
  assert.match(sprawdz(bezStworz).bledy.join('\n'), /IU-2: werdykt „wydziel” bez wiersza Stwórz/)
  const zaDuzy = plan.replace('| 285 → 260 |', '| 285 → 380 |')
  assert.notEqual(zaDuzy, plan)
  assert.match(sprawdz(zaDuzy).bledy.join('\n'), /karta-klienta\.tsx` po zmianie 380 linii > 360/)
})

test('tabela builderów w SKILL.md: bazowe nazwy z walidacji i Skills in play = skills: z frontmattera agenta', () => {
  const wiersze = [...SKILL_MD.matchAll(/^\|[^|]+\| `(feature-builder-[\w-]+)` \| ([^|]+) \|$/gm)]
  assert.deepEqual(wiersze.map((w) => w[1]).sort(), [...BUILDERZY].sort())
  for (const [, builder, skille] of wiersze) {
    const agent = readFileSync(join(REPO, '.claude/agents', `${builder}.md`), 'utf8')
    const frontmatter = /^skills:\s*\[([^\]]*)\]/m.exec(agent)?.[1] ?? ''
    assert.deepEqual(skille.split(',').map((s) => s.trim()), frontmatter.split(',').map((s) => s.trim()), builder)
  }
})

test('SKILL.md: końcówka prowadzi przez sprawdz, generuj --zapisz i gotowosc w tej kolejności', () => {
  const kolejnosc = ['plan.mjs sprawdz', 'git checkout -b feature/<zadanie>', 'plan.mjs generuj', 'docs: inicjalizacja planu dla <zadanie>',
    'plan.mjs gotowosc', 'Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js"']
  const pozycje = kolejnosc.map((fraza) => SKILL_MD.indexOf(fraza, SKILL_MD.indexOf('### Faza 6')))
  assert.ok(pozycje.every((p) => p > 0), kolejnosc.filter((_, i) => pozycje[i] <= 0).join(', '))
  assert.deepEqual([...pozycje].sort((a, b) => a - b), pozycje)
  assert.match(SKILL_MD, /generuj <docs\/plans\/plik-planu\.md> --zapisz/)
})

test('SKILL.md: handoff ma zdanie dla agentów workflow z opisu autopilota', () => {
  const autopilot = readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8')
  const zdanie = /(Do agentow workflow: [^']+)'/.exec(autopilot)?.[1]
  assert.ok(zdanie, 'opis autopilota bez zdania dla agentów workflow')
  const handoff = SKILL_MD.slice(SKILL_MD.indexOf('## Format wyjściowy'))
  assert.ok(bezOgonkow(handoff).includes(zdanie), zdanie)
})

test('SKILL.md: wskazane pliki references/ istnieją', () => {
  const pliki = [...new Set([...SKILL_MD.matchAll(/`(references\/[\w.-]+)`/g)].map((m) => m[1]))]
  assert.deepEqual(pliki.sort(), ['references/kontekst-designerski.md', 'references/przygotowanie-operatora.md', 'references/szablon-planu.md'])
  for (const p of pliki) assert.ok(existsSync(join(SKILL, p)), p)
})

/** @param {string} z @param {string} na @returns {string} przyklad planu z jedna podmiana (podmiana musi trafic) */
function mutacja(z, na) {
  const plan = przykladPlanu()
  assert.ok(plan.includes(z), `przykład nie zawiera: ${z}`)
  return plan.replace(z, na)
}

test('kolumna linii: szacunek z tyldą albo bez strzałki to błąd zapisu, a plik kodu bez liczby „po” omija budżet — błąd', () => {
  const tylda = sprawdz(mutacja('| 0 → 70 |', '| 0 → ~400 |')).bledy.join('\n')
  assert.match(tylda, /IU-1: linia \d+: kolumna linii „0 → ~400” — zapis „dziś → po” liczbami całkowitymi/)
  const slowa = sprawdz(mutacja('| 0 → 70 |', '| 120 do 140 |')).bledy.join('\n')
  assert.match(slowa, /kolumna linii „120 do 140”/)
  assert.match(sprawdz(mutacja('| 0 → 70 |', '| 0 → — |')).bledy.join('\n'), /notatki-service\.ts` — brak liczby linii po zmianie/)
})

test('Weryfikacja z runnerem e2e/*.sh bez znacznika [E2E] jest odrzucona — scribe uruchomiłby go bez środowiska e2e', () => {
  const w = sprawdz(mutacja('- `pnpm vitest run src/features/klienci` przechodzi', '- `bash e2e/run-all.sh` przechodzi'))
  assert.match(w.bledy.join('\n'), /IU-2: Weryfikacja „`bash e2e\/run-all\.sh` przechodzi” uruchamia runner E2E bez znacznika \[E2E\]/)
})

test('wymaganie ze „Śledzenia wymagań” bez IU dostaje uwagę (autopilot pominąłby je po cichu)', () => {
  const w = sprawdz(mutacja('- R2. Karta klienta pokazuje notatki od najnowszej.', '- R2. Karta klienta pokazuje notatki od najnowszej.\n- R3. Eksport notatek do CSV.'))
  assert.deepEqual(w.bledy, [])
  assert.ok(w.uwagi.includes('R3: wymaganie ze „Śledzenia wymagań” bez IU (pole Wymagania żadnej jednostki go nie wymienia)'), w.uwagi.join('\n'))
})

test('Delegate to: wariant -figma tylko dla ui i fullstack', () => {
  assert.deepEqual(sprawdz(mutacja('**Delegate to:** feature-builder-fullstack', '**Delegate to:** feature-builder-fullstack-figma')).bledy, [])
  assert.match(sprawdz(mutacja('**Delegate to:** feature-builder-data', '**Delegate to:** feature-builder-data-figma')).bledy.join('\n'),
    /IU-1: Delegate to „feature-builder-data-figma”/)
})
