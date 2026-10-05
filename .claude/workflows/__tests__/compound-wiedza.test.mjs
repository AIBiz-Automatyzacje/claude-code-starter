// Testy compoundu z wiedza projektu (PLAN-POPRAWY P10, hunki H46, H47 jako tresc, PA-14): pola wiedzy sprawdzane skryptem
// przed commitem, szczebel kod/lint → propozycjeBramek, do indeksu docs/learned-patterns.md tylko szczebel regula.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/compound-wiedza.test.mjs
//
// DLACZEGO: compound pisal kazda lekcje tekstem do .claude/rules/learned-patterns.md (eager w kazdym agencie, ~47k zn
// w oferty-online). Teraz solution niesie pola wiedzy, skrypt je waliduje (odmowa = brak zapisu), indeks generuje skrypt.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodloCompound = readFileSync(resolve(KATALOG, '../dev-compound-wf.js'), 'utf8')
const zrodloPr = readFileSync(resolve(KATALOG, '../dev-pr-wf.js'), 'utf8')

/**
 * @param {string} zrodlo
 * @param {string} kotwica
 * @param {string} koniec
 * @returns {string}
 */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca po "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @typedef {{ plik: string, klasa: string, regula: string, szczebel: string, szczebelPowod: string }} WpisCompoundu */
/** @type {{ compoundPrompt: (sciezka: string | null) => string, propozycjeBramek: (wpisy: WpisCompoundu[]) => Array<Record<string, string>> }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const C = new Function(`${wytnij(zrodloCompound, 'function propozycjeBramek(', '\n}')}
  ${wytnij(zrodloCompound, 'function compoundPrompt(', '\n}')}
  return { compoundPrompt, propozycjeBramek }`)()

const promptZadania = C.compoundPrompt('docs/active/x')

test('compound-wf: material z plikow zadania i historii gita, bez rozmowy sesji (H46, PA-14)', () => {
  assert.doesNotMatch(zrodloCompound, /wyciagnij z sesji|Wyciagnij kontekst z sesji/)
  assert.match(promptZadania, /Nie widzisz rozmowy sesji glownej/)
  assert.match(promptZadania, /docs\/active\/x\/review-faza-\*\.md/)
  assert.match(promptZadania, /docs\/active\/x\/known-issues\.md/)
  assert.match(promptZadania, /## Dziennik/)
  assert.match(promptZadania, /commitow `fix\(`/)
  assert.match(C.compoundPrompt(null), /historii gita biezacej galezi/)
})

test('compound-wf: data z `date +%F`, nie z roku wpisanego w prompt (H47)', () => {
  assert.match(promptZadania, /data z `date \+%F`/)
  assert.doesNotMatch(promptZadania, /rok 2026/)
})

test('compound-wf: pola wiedzy sprawdza skrypt przed commitem — odmowa = plik usuniety, plik=null', () => {
  assert.match(promptZadania, /node \.claude\/scripts\/wiedza\/wiedza\.mjs sprawdz <plik>/)
  assert.match(promptZadania, /usun plik \(solution bez poprawnych pol wiedzy nie zostaje w bazie\), zwroc plik=null/)
  assert.match(zrodloCompound, /required: \['plik', 'wiedza', 'odmowa', 'indeks', 'commit'\]/)
})

test('compound-wf: do indeksu tylko szczebel regula, indeks generuje skrypt, whitelista bez .claude/rules', () => {
  assert.match(promptZadania, /Szczebel regula: `node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz`/)
  assert.match(promptZadania, /Szczebel kod albo lint -> indeksu nie ruszasz/)
  assert.match(promptZadania, /`git add docs\/solutions\/ docs\/CONCEPTS\.md docs\/learned-patterns\.md`/)
  assert.doesNotMatch(zrodloCompound, /\.claude\/rules\/learned-patterns/)
})

test('propozycjeBramek: szczebel kod i lint ida do operatora, regula nie', () => {
  const wpis = { plik: 'docs/solutions/a/x.md', klasa: 'zaufanie-danym-klienta', regula: 'Naglowek czytaj w jednym miejscu.', szczebelPowod: 'no-restricted-syntax' }
  assert.deepEqual(C.propozycjeBramek([
    { ...wpis, szczebel: 'lint' },
    { ...wpis, szczebel: 'regula', plik: 'docs/solutions/a/y.md' },
    { ...wpis, szczebel: 'kod', plik: 'docs/solutions/a/z.md' },
  ]), [
    { szczebel: 'lint', klasa: 'zaufanie-danym-klienta', propozycja: 'Naglowek czytaj w jednym miejscu.', powod: 'no-restricted-syntax', solution: 'docs/solutions/a/x.md' },
    { szczebel: 'kod', klasa: 'zaufanie-danym-klienta', propozycja: 'Naglowek czytaj w jednym miejscu.', powod: 'no-restricted-syntax', solution: 'docs/solutions/a/z.md' },
  ])
  assert.deepEqual(C.propozycjeBramek([]), [])
})

// ── Etap compound dev-pr-wf ───────────────────────────────────────────────
const etapPr = wytnij(zrodloPr, "if (etap === 'compound') {", "return { status: 'OK', etap, ...wynik, propozycjeBramek")

test('dev-pr compound: kopia propozycjeBramek zgodna z dev-compound-wf', () => {
  assert.equal(wytnij(zrodloPr, 'function propozycjeBramek(', '\n}'), wytnij(zrodloCompound, 'function propozycjeBramek(', '\n}'))
})

test('dev-pr compound: pola wiedzy przez sprawdz, indeks skryptem, propozycje bramek z wpisow (JS)', () => {
  assert.match(etapPr, /node \.claude\/scripts\/wiedza\/wiedza\.mjs sprawdz/)
  assert.match(etapPr, /node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz/)
  assert.match(etapPr, /propozycjeBramek\(wynik\.wpisy\)/)
  assert.match(zrodloPr, /required: \['wpisy', 'odmowy', 'indeks', 'propozycjeDoReviewerow', 'plikPropozycji'\]/)
  assert.match(etapPr, /docs\/learned-patterns\.md/)
  assert.doesNotMatch(zrodloPr, /\.claude\/rules\/learned-patterns|rule-worthy|limit ~50/)
})

// ── Skill dev-compound ────────────────────────────────────────────────────
const skill = readFileSync(resolve(KATALOG, '../../skills/dev-compound/SKILL.md'), 'utf8')

test('skill dev-compound: data z `date +%F` (H29), pola wiedzy w szablonie frontmattera', () => {
  assert.match(skill, /Datę do dokumentów bierz z `date \+%F`\./)
  assert.doesNotMatch(skill, /Aktualny rok to/)
  const start = skill.indexOf('```markdown\n---\ntitle:')
  assert.notEqual(start, -1, 'brak szablonu frontmattera w skillu')
  const frontmatter = skill.slice(start, skill.indexOf('\n---\n', start + '```markdown\n---\n'.length))
  for (const pole of ['klasa', 'regula', 'paths', 'waga', 'szczebel', 'szczebel_powod', 'zrodlo', 'ucieczki']) {
    assert.match(frontmatter, new RegExp(`\\n${pole}:`), `brak pola ${pole} w szablonie`)
  }
})

test('skill dev-compound: szczebel kod → lint → regula z powodem, sprawdz przed zostawieniem pliku, indeks skryptem', () => {
  assert.match(skill, /## Pola wiedzy/)
  assert.match(skill, /`kod`.*`lint`.*`regula`/s)
  assert.match(skill, /node \.claude\/scripts\/wiedza\/wiedza\.mjs sprawdz <plik>/)
  assert.match(skill, /node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz/)
  assert.match(skill, /Propozycja bramki/)
  assert.doesNotMatch(skill, /\.claude\/rules\/learned-patterns|rule-count|rule-worthy/)
})

test('autopilot: wynik runu niesie pola wiedzy compoundu i propozycje bramek, bez starego statusu reguly', () => {
  const zrodloAutopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
  const wynikRunu = zrodloAutopilot.slice(zrodloAutopilot.lastIndexOf("return {\n  status: 'OK',"))
  assert.match(wynikRunu, /propozycjeBramek: \(compound && compound\.propozycjeBramek\) \|\| \[\],/)
  assert.match(wynikRunu, /indeks: compound && compound\.indeks,/)
  assert.doesNotMatch(wynikRunu, /compound\.regula/)
})

test('skill dev-pr: raport pokazuje indeks, odmowy i propozycje bramek z compoundu', () => {
  const skillPr = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')
  assert.match(skillPr, /`propozycjeBramek\[\]`/)
  assert.match(skillPr, /📚 Baza wiedzy: <N wpisów w docs\/solutions\/>, indeks: <indeks>, odmowy: <odmowy albo „brak”>/)
  assert.match(skillPr, /🧱 Propozycje bramek \(do Twojej decyzji, NIE wdrożone/)
  assert.doesNotMatch(skillPr, /learned-patterns: <status>|rule-worthy/)
})

// ── Skill dev-compound-refresh ────────────────────────────────────────────
const refresh = readFileSync(resolve(KATALOG, '../../skills/dev-compound-refresh/SKILL.md'), 'utf8')

test('skill dev-compound-refresh: generuje indeks skryptem po akcjach, bramka indeksu porzadkowana w solutions (H30)', () => {
  assert.match(refresh, /Datę do dokumentów bierz z `date \+%F`\./)
  assert.match(refresh, /node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz/)
  assert.match(refresh, /koszyk „zawsze”/)
  assert.doesNotMatch(refresh, /\.claude\/rules\/learned-patterns|rule-count|limit ~50/)
})

test('skill dev-compound-refresh: badanie i dokument zastepczy w jednym watku, pomocnicze tylko przy szerokim przegladzie (PA-41)', () => {
  assert.doesNotMatch(refresh, /## Strategia subagentów|Równoległe subagenty|Każde zastępstwo pisane jest przez subagenta/)
  assert.match(refresh, /Dokument zastępczy piszesz sam/)
})

test('skill dev-compound-refresh: tryb konwersji — przygotuj, klasa od tego samego wykonawcy, zastosuj, odrzuty dla operatora', () => {
  const konwersja = refresh.slice(refresh.indexOf('## Tryb konwersji'))
  assert.match(konwersja, /wiedza\.mjs konwersja przygotuj/)
  assert.match(konwersja, /wiedza\.mjs konwersja zastosuj --propozycje/)
  assert.match(konwersja, /"nr", "klasa", "regula", "paths", "solution", "waga"/)
  assert.match(konwersja, /docs\/archiwum\/learned-patterns-odrzuty-/)
  assert.match(konwersja, /CLAUDE\.md projektu nie edytujesz/)
})
