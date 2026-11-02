// Strażnik słów stacku (plan szablonu mobile z rdzenia, IU-1.5). Rdzeń szablonu nie zakłada stacku web: słowo stacku
// poza slotem przechodzi tylko z jawnym wyjątkiem w `stacks/straznik.json`, a wyjątek, który niczego już nie pokrywa,
// zatrzymuje CI, dopóki ktoś go nie usunie. Drugi strażnik: każde odesłanie rdzenia do slotu trafia w slot z rejestru,
// który ma wariant web — inaczej nakładka stacku nie dostałaby pliku do podmiany, a rdzeń odsyłałby donikąd.
//
// Uruchomienie: node --test stacks/__tests__/straznik.test.mjs

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { odeslaniaDoSlotow, plikiRdzenia, skanuj, wczytajSloty, wczytajStraznik } from '../straznik.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Repo-zabawka z podanymi plikami (ścieżka → treść).
 * @param {Record<string, string>} pliki @returns {string}
 */
function repo(pliki) {
  const katalog = mkdtempSync(join(tmpdir(), 'straznik-'))
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(katalog, sciezka)), { recursive: true })
    writeFileSync(join(katalog, sciezka), tresc)
  }
  return katalog
}

const SLOWA = [{ nazwa: 'vite', wzor: '\\bvite', flagi: 'i' }, { nazwa: 'agent-browser', wzor: 'agent-browser' }, { nazwa: 'DOM', wzor: '\\bDOM\\b' }]
/** @param {import('../straznik.mjs').Wyjatek[]} wyjatki @returns {import('../straznik.mjs').Straznik} */
const straznik = (wyjatki) => ({ opis: 'test', slowa: SLOWA, wyjatki })

test('słowo stacku w pliku rdzenia bez wyjątku to naruszenie z plikiem, linią i słowem', (t) => {
  const k = repo({ '.claude/workflows/a.js': 'const p = `uruchom testy`\nconst q = `npx vitest run`\n' })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const { naruszenia } = skanuj(k, straznik([]), [])
  assert.deepEqual(naruszenia, [{ plik: '.claude/workflows/a.js', linia: 2, slowo: 'vite', tresc: 'const q = `npx vitest run`' }])
})

test('granice słów: „invite” i polskie „dom” to nie słowa stacku', (t) => {
  const k = repo({ '.claude/a.md': 'scripts/inbox/invite.mjs\nwracam do dom.\n' })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  assert.deepEqual(skanuj(k, straznik([]), []).naruszenia, [])
})

test('poza skanem: sloty z rejestru, testy i fixture\'y, worktrees, settings.local.json; output-styles w skanie', (t) => {
  const k = repo({
    '.claude/stack/walidacja.md': 'vitest',
    '.claude/scripts/x/__tests__/fixtures/f.md': 'vitest',
    '.claude/worktrees/w/.claude/a.md': 'vitest',
    '.claude/settings.local.json': '{"vite": 1}',
    'output-styles/styl.md': 'agent-browser',
  })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  assert.deepEqual(plikiRdzenia(k), ['.claude/stack/walidacja.md', 'output-styles/styl.md'])
  assert.deepEqual(skanuj(k, straznik([]), ['.claude/stack/walidacja.md']).naruszenia.map((n) => n.plik), ['output-styles/styl.md'])
})

test('wyjątek z liniami pokrywa tylko te linie i tylko swoje słowa', (t) => {
  const k = repo({ '.claude/workflows/a.js': "// historia: vite.config\nlabel: 'warmup:vitest'\nagent-browser open\nvite build\n" })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const wynik = skanuj(k, straznik([
    { plik: '.claude/workflows/a.js', rodzaj: 'staly', slowa: ['vite'], linie: ['// historia', "'warmup:vitest'"], powod: 'test' },
  ]), [])
  assert.deepEqual(wynik.naruszenia.map((n) => `${n.linia}:${n.slowo}`), ['3:agent-browser', '4:vite'])
  assert.deepEqual(wynik.nieaktualne, [])
})

test('wyjątek katalogowy usun/podmiana pokrywa wszystkie słowa w katalogu', (t) => {
  const k = repo({ '.claude/skills/web/SKILL.md': 'agent-browser\nvite\nDOM', '.claude/skills/webby.md': 'vite' })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const wynik = skanuj(k, straznik([{ plik: '.claude/skills/web/', rodzaj: 'usun', iu: 'IU-2.7', powod: 'test' }]), [])
  assert.deepEqual(wynik.naruszenia.map((n) => n.plik), ['.claude/skills/webby.md'])
  assert.deepEqual(wynik.nieaktualne, [])
})

test('wyjątek z liniami ma pierwszeństwo przed plikowym — plikowy bez innych trafień jest nieaktualny', (t) => {
  const k = repo({ '.claude/a.mjs': '// Vite: historia\nconst x = 1\n' })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const wynik = skanuj(k, straznik([
    { plik: '.claude/a.mjs', rodzaj: 'przejsciowy', iu: 'IU-1.7', slowa: ['vite'], powod: 'test' },
    { plik: '.claude/a.mjs', rodzaj: 'staly', slowa: ['vite'], linie: ['historia'], powod: 'test' },
  ]), [])
  assert.deepEqual(wynik.naruszenia, [])
  assert.deepEqual(wynik.nieaktualne, ['.claude/a.mjs (przejsciowy): wyjątek niczego nie pokrywa'])
})

test('nieaktualny wyjątek: brak pliku, słowa albo linii', (t) => {
  const k = repo({ '.claude/a.md': 'vite\n', '.claude/b.md': 'vite build\n' })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const wynik = skanuj(k, straznik([
    { plik: '.claude/a.md', rodzaj: 'staly', slowa: ['vite', 'DOM'], powod: 'test' },
    { plik: '.claude/b.md', rodzaj: 'staly', slowa: ['vite'], linie: ['vite build', 'vite preview'], powod: 'test' },
    { plik: '.claude/brak/', rodzaj: 'usun', iu: 'IU-2.7', powod: 'test' },
  ]), [])
  assert.deepEqual(wynik.naruszenia, [])
  assert.deepEqual(wynik.nieaktualne.sort(), [
    '.claude/a.md (staly): słowo DOM już nie występuje',
    '.claude/b.md (staly): brak linii z „vite preview”',
    '.claude/brak/ (usun): wyjątek niczego nie pokrywa',
  ])
})

test('odesłania do slotów: pełne ścieżki, references/stack.md skilla, import adaptera', (t) => {
  const k = repo({
    '.claude/workflows/a.js': 'wg `.claude/stack/walidacja.md`, sekcja „Zimny runner”; `.claude/skills/dev-prep/references/stack.md`',
    '.claude/skills/dev-plan/SKILL.md': 'Przykłady: `references/stack.md`, sekcja „Klucze”.',
    '.claude/scripts/e2e/start.mjs': "import { a } from './adapter.mjs'\nimport { b } from './inny.mjs'\n",
    '.claude/scripts/doctor/d.mjs': "import { a } from '../e2e/adapter.mjs'\n",
  })
  t.after(() => rmSync(k, { recursive: true, force: true }))
  const odeslania = odeslaniaDoSlotow(k, ['.claude/scripts/e2e/adapter.mjs'])
  assert.deepEqual(odeslania.map((o) => `${o.plik} → ${o.slot}`).sort(), [
    '.claude/scripts/doctor/d.mjs → .claude/scripts/e2e/adapter.mjs',
    '.claude/scripts/e2e/start.mjs → .claude/scripts/e2e/adapter.mjs',
    '.claude/skills/dev-plan/SKILL.md → .claude/skills/dev-plan/references/stack.md',
    '.claude/workflows/a.js → .claude/skills/dev-prep/references/stack.md',
    '.claude/workflows/a.js → .claude/stack/walidacja.md',
  ])
})

// --- repo szablonu ---

const lista = wczytajStraznik(KORZEN)
const sloty = wczytajSloty(KORZEN)
const NAZWY_SLOW = lista.slowa.map((s) => s.nazwa)

test('lista strażnika: słowa z planu i A0.5, każdy wzorzec kompiluje się', () => {
  for (const nazwa of ['vite', 'agent-browser', 'tailwind', 'shadcn', 'port-dev', 'pnpm-dev', 'React.lazy', 'size-limit', 'SITE_URL', 'DOM']) {
    assert.ok(NAZWY_SLOW.includes(nazwa), `brak słowa ${nazwa}`)
  }
  assert.equal(new Set(NAZWY_SLOW).size, NAZWY_SLOW.length, 'zdublowane słowo')
  for (const s of lista.slowa) assert.doesNotThrow(() => new RegExp(s.wzor, s.flagi ?? ''), s.nazwa)
})

test('lista strażnika: każdy wyjątek ma rodzaj, powód, IU tam, gdzie zmiana jest zaplanowana, i istniejącą ścieżkę spoza slotów', () => {
  const IU = /^(IU-\d\.\d+|Etap \d)$/
  for (const w of lista.wyjatki) {
    const opis = `${w.plik} (${w.rodzaj})`
    assert.ok(['usun', 'podmiana', 'przejsciowy', 'staly'].includes(w.rodzaj), `${opis}: nieznany rodzaj`)
    assert.ok(w.powod.trim().length > 0, `${opis}: brak powodu`)
    assert.ok(existsSync(join(KORZEN, w.plik)), `${opis}: ścieżka nie istnieje`)
    assert.ok(!sloty.includes(w.plik), `${opis}: slot nie potrzebuje wyjątku`)
    if (w.rodzaj === 'staly') assert.equal(w.iu, undefined, `${opis}: stały wyjątek nie ma IU`)
    else assert.match(w.iu ?? '', IU, `${opis}: IU, które usunie słowa`)
    if (w.rodzaj === 'usun' || w.rodzaj === 'podmiana') {
      assert.equal(w.slowa, undefined, `${opis}: plik spoza rdzenia nie wymienia słów`)
      assert.equal(w.linie, undefined, `${opis}: plik spoza rdzenia nie wymienia linii`)
    } else {
      assert.ok(w.slowa?.length && w.slowa.every((s) => NAZWY_SLOW.includes(s)), `${opis}: słowa z listy strażnika`)
    }
  }
})

test('rdzeń szablonu nie zawiera słów stacku web poza slotami i wyjątkami, a każdy wyjątek coś pokrywa', () => {
  const { naruszenia, nieaktualne } = skanuj(KORZEN, lista, sloty)
  assert.deepEqual(naruszenia.map((n) => `${n.plik}:${n.linia} [${n.slowo}] ${n.tresc.slice(0, 120)}`), [],
    'słowo stacku w rdzeniu: przenieś tekst do slotu (stacks/sloty.json) albo dopisz wyjątek do stacks/straznik.json')
  assert.deepEqual(nieaktualne, [], 'wyjątek w stacks/straznik.json już niczego nie pokrywa — usuń go albo zawęź')
})

test('wyjątki stałe z planu: klasyfikator „Weryfikacja:”, przykładowy plan, etykieta warmup:vitest', () => {
  const stale = lista.wyjatki.filter((w) => w.rodzaj === 'staly')
  const ma = (/** @type {string} */ plik, /** @type {string} */ linia) => stale.some((w) => w.plik === plik && (w.linie ?? []).some((l) => l.includes(linia)))
  assert.ok(ma('.claude/workflows/dev-docs-review-wf.js', 'agent-browser'))
  assert.ok(stale.some((w) => w.plik === '.claude/skills/dev-plan/references/szablon-planu.md'))
  assert.ok(ma('.claude/workflows/dev-autopilot-wf.js', "'warmup:vitest'"))
})

test('każde odesłanie rdzenia do slotu trafia w zarejestrowany slot z wariantem web', () => {
  const odeslania = odeslaniaDoSlotow(KORZEN, sloty)
  assert.ok(odeslania.length >= 20, `za mało odesłań (${odeslania.length}) — wzorce strażnika wymagają aktualizacji`)
  for (const { plik, slot } of odeslania) {
    assert.ok(sloty.includes(slot), `${plik} odsyła do ${slot} spoza stacks/sloty.json`)
    assert.ok(existsSync(join(KORZEN, slot)), `${plik} odsyła do ${slot}, którego nie ma w wariancie web`)
  }
})

test('każdy slot z rejestru ma odesłanie w rdzeniu', () => {
  const uzywane = new Set(odeslaniaDoSlotow(KORZEN, sloty).filter((o) => o.plik !== o.slot).map((o) => o.slot))
  assert.deepEqual(sloty.filter((s) => !uzywane.has(s)), [], 'slot bez odesłania — nakładka podmieniałaby plik, którego nikt nie czyta')
})
