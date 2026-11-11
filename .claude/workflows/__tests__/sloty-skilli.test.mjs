// Szwy stackowe w skillach (plan szablonu mobile z rdzenia, IU-1.4). Tekst zależny od stacku w skillach rdzenia
// (dev-plan, dev-docs-complete, dev-smoke, dev-prep, dev-compound, weryfikacja-setup) leży w `references/stack.md` skilla (D20) albo
// w slocie `.claude/stack/*.md` współdzielonym z workflowami; SKILL.md odsyła do nazwanej sekcji. Wariant web slotów
// niesie dawną treść skilli, nakładka stacku podmienia pliki w całości.
//
// Uruchomienie: node --test .claude/workflows/__tests__/sloty-skilli.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLAUDE = resolve(KATALOG, '..', '..')
const KORZEN = resolve(CLAUDE, '..')
/** @param {string} sciezka wzgledem korzenia repo */
const czytaj = (sciezka) => readFileSync(join(KORZEN, sciezka), 'utf8')

const SKILLE = ['dev-plan', 'dev-docs-complete', 'dev-smoke', 'dev-prep', 'dev-compound', 'weryfikacja-setup']
// Pliki rdzenia skilli. Poza listą: dev-plan/references/szablon-planu.md — przykładowy plan z ścieżkami web
// (wyjątek strażnika słów stacku, IU-1.5).
const PLIKI_RDZENIA = [...SKILLE.map((s) => `.claude/skills/${s}/SKILL.md`), '.claude/skills/dev-plan/references/przygotowanie-operatora.md']
const SLOWA_STACKU = ['agent-browser', 'Vite', 'vitest run', 'Tailwind', '5173', '5174', 'src/components/', 'src/pages/', 'src/lib/',
  'src/assets/', 'public/', 'VITE_', 'localhost:']

test('pliki rdzenia skilli nie zawierają słów stacku web', () => {
  for (const plik of PLIKI_RDZENIA) {
    const tresc = czytaj(plik)
    assert.deepEqual(SLOWA_STACKU.filter((s) => tresc.includes(s)), [], `${plik}: słowa stacku poza slotem`)
  }
})

/** @type {{ sloty: Array<{ plik: string }> }} */
const rejestr = JSON.parse(czytaj('stacks/sloty.json'))
const zarejestrowane = rejestr.sloty.map((s) => s.plik)

test('każdy skill odsyła do swojego references/stack.md, plik istnieje i jest w rejestrze slotów', () => {
  for (const skill of SKILLE) {
    const plik = `.claude/skills/${skill}/references/stack.md`
    assert.ok(existsSync(join(KORZEN, plik)), `brak ${plik}`)
    assert.ok(zarejestrowane.includes(plik), `${plik} poza stacks/sloty.json`)
    assert.match(czytaj(`.claude/skills/${skill}/SKILL.md`), /references\/stack\.md/, `${skill}: SKILL.md nie odsyła do slotu`)
  }
})

/**
 * Odesłania „<plik slotu>, sekcja „<nazwa>”” (także „sekcje „A” i „B””) z pliku rdzenia.
 * @param {string} tresc @returns {Array<{ slot: string, sekcja: string }>}
 */
function odeslania(tresc) {
  const wynik = []
  for (const m of tresc.matchAll(/`?((?:\.claude\/stack\/[a-z0-9-]+|references\/stack)\.md)`?,?\s+sekcj[aeię] ((?:„[^”]+”(?:,| i| oraz)? ?)+)/g)) {
    for (const s of m[2].matchAll(/„([^”]+)”/g)) wynik.push({ slot: m[1], sekcja: s[1] })
  }
  return wynik
}

test('każda sekcja slotu, do której odsyła skill, jest nagłówkiem ## w wariancie web', () => {
  let liczba = 0
  for (const plik of [...PLIKI_RDZENIA, '.claude/workflows/dev-docs-complete-wf.js']) {
    const katalogSkilla = plik.startsWith('.claude/skills/') ? plik.split('/').slice(0, 3).join('/') : '.claude/skills/dev-docs-complete'
    for (const { slot, sekcja } of odeslania(czytaj(plik))) {
      const sciezka = slot.startsWith('.claude/') ? slot : `${katalogSkilla}/${slot}`
      assert.match(czytaj(sciezka), new RegExp(`^## ${sekcja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${plik} → ${sciezka}: brak sekcji „${sekcja}”`)
      liczba++
    }
  }
  assert.ok(liczba >= 10, `za mało odesłań do sekcji (${liczba}) — wzorzec testu wymaga aktualizacji`)
})

test('dev-plan: tabela builderów, ścieżki warstw i scenariusze E2E ze slotów współdzielonych', () => {
  const plan = czytaj('.claude/skills/dev-plan/SKILL.md')
  const cele = odeslania(plan).map((o) => `${o.slot}#${o.sekcja}`)
  for (const cel of ['.claude/stack/buildery.md#Tabela builderów', '.claude/stack/buildery.md#Ścieżki warstw',
    '.claude/stack/plan-e2e.md#Linia scenariusza', '.claude/stack/plan-e2e.md#Seedy', '.claude/stack/plan-e2e.md#Granice narzędzia jazdy',
    '.claude/stack/plan-e2e.md#Serwer aplikacji w scenariuszu']) {
    assert.ok(cele.includes(cel), `dev-plan nie odsyła do ${cel}`)
  }
  // Zasady wspólne 3.4b zostają w rdzeniu.
  assert.match(plan, /Jeden flow = jedna linia w całym planie/)
  assert.match(plan, /Seed jest idempotentny/)
  assert.match(plan, /Realtime: jeden klient/)
})

test('smoke operatora w workflowie: start aplikacji ze slotu skilla dev-docs-complete', () => {
  const wf = czytaj('.claude/workflows/dev-docs-complete-wf.js')
  assert.match(wf, /\.claude\/skills\/dev-docs-complete\/references\/stack\.md/)
  assert.doesNotMatch(wf, /aplikacja wstaje \(dev server\)/)
})

test('szkielet skilla weryfikacji: komendy narzędzia jazdy z adaptera E2E', async () => {
  const kod = czytaj('.claude/scripts/e2e/szkielet.mjs').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  assert.doesNotMatch(kod, /agent-browser/)
  assert.match(kod, /SZKIELET_WERYFIKACJI/)
  const { SZKIELET_WERYFIKACJI } = await import(join(CLAUDE, 'scripts/e2e/adapter.mjs'))
  for (const pole of ['doctor', 'drive', 'evidence', 'cleanup', 'domyslneParametry']) {
    assert.equal(typeof SZKIELET_WERYFIKACJI[pole], 'string', `SZKIELET_WERYFIKACJI.${pole}`)
  }
  assert.equal(typeof SZKIELET_WERYFIKACJI.selektory, 'function')
})
