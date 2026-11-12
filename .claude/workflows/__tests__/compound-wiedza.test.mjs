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

/**
 * Blok bramek z wpisow compoundu: prompt o mechanizmie, ksztalt pola i obie funkcje podzialu (punkt 43).
 * @param {string} zrodlo
 * @returns {string}
 */
function blokBramek(zrodlo) {
  const start = zrodlo.indexOf('const MECHANIZM_W_KODZIE = `')
  const ostatnia = zrodlo.indexOf('function bramkiWdrozone(', start)
  assert.ok(start !== -1 && ostatnia !== -1, 'brak bloku bramek z wpisow compoundu — kotwica testu wymaga aktualizacji')
  return zrodlo.slice(start, zrodlo.indexOf('\n}', ostatnia) + 2)
}

/** @typedef {{ plik: string, klasa: string, regula: string, szczebel: string, szczebelPowod: string, mechanizm?: unknown }} WpisCompoundu */
/** @type {{ compoundPrompt: (sciezka: string | null) => string, propozycjeBramek: (wpisy: WpisCompoundu[]) => Array<Record<string, string>>, bramkiWdrozone: (wpisy: WpisCompoundu[]) => Array<Record<string, string>> }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const C = new Function(`${blokBramek(zrodloCompound)}
  ${wytnij(zrodloCompound, 'function compoundPrompt(', '\n}')}
  return { compoundPrompt, propozycjeBramek, bramkiWdrozone }`)()

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

test('compound-wf: indeks po kazdym zapisanym solution (regula i kod/lint bez wdrozonej bramki), whitelista bez .claude/rules', () => {
  assert.match(promptZadania, /Indeks po kazdym zapisanym solution: `node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz`/)
  assert.match(promptZadania, /szczebel regula oraz kod\/lint bez pola bramka — do wdrozenia bramki lekcja dziala jak regula/)
  assert.match(promptZadania, /Pola bramka nie ustawiasz/)
  assert.doesNotMatch(promptZadania, /indeksu nie ruszasz/)
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

// Punkt 43 (piszemy_wirale PR #9, compound 7b7d6d7): raport podal „do Twojej decyzji, nie wdrozone” unie PurchaseSessionMatch
// i reportAfterCommit, ktore poprawki tur 1 i 2 juz wprowadzily (apply-purchase.ts:50, stripe-webhook.ts:171). Wpis z miejscem
// mechanizmu (plik:linia) wraca jako wdrozony; do operatora idzie tylko mechanizm, ktorego w kodzie nie ma.
test('bramki z wpisow: mechanizm plik:linia = wdrozone bez propozycji; null, brak pola i zly ksztalt = propozycja', () => {
  const baza = { klasa: 'stan-flagami', szczebelPowod: 'typ wyklucza zly stan' }
  const unia = { ...baza, plik: 'docs/solutions/a/unia.md', regula: 'Dopasowanie sesji opisz unia PurchaseSessionMatch.', szczebel: 'kod', mechanizm: 'supabase/functions/_shared/apply-purchase.ts:50' }
  const raport = { ...baza, plik: 'docs/solutions/a/raport.md', regula: 'Kanaly raportu w reportAfterCommit, kazdy z wlasnym try/catch.', szczebel: 'kod', mechanizm: ' stripe-webhook.ts:171 ' }
  const lint = { ...baza, plik: 'docs/solutions/a/lint.md', regula: 'Naglowek czytaj w jednym miejscu.', szczebel: 'lint', mechanizm: null }
  const wpisy = [unia, raport, lint, { ...unia, plik: 'docs/solutions/a/regula.md', szczebel: 'regula' }]
  assert.deepEqual(C.bramkiWdrozone(wpisy), [
    { szczebel: 'kod', klasa: 'stan-flagami', regula: unia.regula, mechanizm: 'supabase/functions/_shared/apply-purchase.ts:50', solution: 'docs/solutions/a/unia.md' },
    { szczebel: 'kod', klasa: 'stan-flagami', regula: raport.regula, mechanizm: 'stripe-webhook.ts:171', solution: 'docs/solutions/a/raport.md' },
  ])
  assert.deepEqual(C.propozycjeBramek(wpisy).map((p) => p.solution), ['docs/solutions/a/lint.md'], 'do operatora tylko mechanizm, ktorego nie ma w kodzie')
  // Ksztalt liczy JS: opis, sam hash, commit, zakres linii, linia 0, sciezka bezwzgledna i nie-tekst to brak mechanizmu.
  // Punkt 55 (43): dokument i test to nie mechanizm w kodzie.
  for (const zly of ['wprowadzone w turze 1', '63bc1f2', 'commit 63bc1f2 (apply-purchase.ts:50)', 'src/a.ts', 'src/a.ts:', 'src/a.ts:0', 'src/a.ts:10-20', 'src/a.ts:50 unia', '/Users/x/src/a.ts:50', ':50', '', 50, undefined,
    'docs/solutions/a/unia.md:12', 'src/__tests__/apply.ts:5', 'src/apply-purchase.test.ts:50', 'e2e/zakup.spec.ts:7']) {
    const w = [{ ...unia, mechanizm: zly }]
    assert.deepEqual(C.bramkiWdrozone(w), [], `wdrozone: ${String(zly)}`)
    assert.equal(C.propozycjeBramek(w).length, 1, `propozycja: ${String(zly)}`)
  }
  // Poprawny ksztalt poza docs/ i testami przechodzi (takze plik o nazwie z „test” bez kropki-rozszerzenia testu).
  for (const dobry of ['src/testing/helpers.ts:3', 'docsy/a.ts:1', 'supabase/functions/_shared/apply-purchase.ts:50']) assert.equal(C.bramkiWdrozone([{ ...unia, mechanizm: dobry }]).length, 1, dobry)
  const { mechanizm: _bez, ...bezPola } = unia
  assert.equal(C.propozycjeBramek([bezPola]).length, 1, 'wpis bez pola (wynik sprzed zmiany schematu) zostaje propozycja')
  assert.deepEqual(C.bramkiWdrozone([]), [])
})

test('compound (oba workflowy): pole mechanizm w schemacie wpisu, wypelniane po grepie na biezacym drzewie, bez commita', () => {
  for (const [nazwa, zrodlo] of /** @type {[string, string][]} */ ([['dev-compound-wf', zrodloCompound], ['dev-pr-wf', zrodloPr]])) {
    const schemat = wytnij(zrodlo, 'const WPIS_WIEDZY = {', '\n}')
    assert.match(schemat, /additionalProperties: false/, nazwa)
    assert.match(schemat, /mechanizm: \{ type: \['string', 'null'\], description: 'plik:linia na biezacym drzewie/, nazwa)
    assert.match(schemat, /required: \['plik', 'klasa', 'regula', 'szczebel', 'szczebelPowod', 'mechanizm'\]/, nazwa)
  }
  assert.match(promptZadania, /^6a\. MECHANIZM JUZ W KODZIE \(pole mechanizm wpisu; tylko szczebel kod albo lint, przy szczeblu regula null\):/m)
  assert.match(promptZadania, /`git grep -n "<nazwa typu, funkcji albo reguly>"`, potem przeczytaj trafiona linie\. Mechanizm tam stoi =>\n {3}mechanizm = "<sciezka od korzenia repo>:<numer linii>"/)
  assert.match(promptZadania, /mechanizm dopiero do napisania => mechanizm null\. Nie podawaj commita: po squashu\n {3}z --delete-branch commitow galezi nie ma w historii glownej/)
  assert.match(promptZadania, /bez sprawdzenia grepem zostaw null\./)
  assert.match(zrodloCompound, /return \{ \.\.\.wynik, propozycjeBramek: bramki, bramkiWdrozone: wdrozone \}/)
})

// ── Etap compound dev-pr-wf ───────────────────────────────────────────────
const etapPr = wytnij(zrodloPr, "if (etap === 'compound') {", "return { status: 'OK', etap, ...wynik, propozycjeBramek")

test('dev-pr compound: kopia propozycjeBramek zgodna z dev-compound-wf', () => {
  assert.equal(wytnij(zrodloPr, 'function propozycjeBramek(', '\n}'), wytnij(zrodloCompound, 'function propozycjeBramek(', '\n}'))
  // Punkt 43: caly blok (prompt o mechanizmie, ksztalt pola, propozycje i wdrozone) jest kopia — compound autopilota i /dev-pr dziela wpisy tak samo.
  assert.equal(blokBramek(zrodloPr), blokBramek(zrodloCompound))
  for (const f of ['function miejsceMechanizmu(', 'function propozycjeBramek(', 'function bramkiWdrozone(']) assert.ok(blokBramek(zrodloPr).includes(f), f)
})

test('dev-pr compound: pola wiedzy przez sprawdz, indeks skryptem, propozycje bramek z wpisow (JS)', () => {
  assert.match(etapPr, /node \.claude\/scripts\/wiedza\/wiedza\.mjs sprawdz/)
  assert.match(etapPr, /node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz/)
  assert.match(etapPr, /propozycjeBramek\(wynik\.wpisy\)/)
  assert.match(etapPr, /bramkiWdrozone\(wynik\.wpisy\)/)
  assert.match(etapPr, /Pola bramka nie ustawiasz\.\n2a\. \$\{MECHANIZM_W_KODZIE\}\n/)
  assert.match(zrodloPr, /return \{ status: 'OK', etap, \.\.\.wynik, propozycjeBramek: bramki, bramkiWdrozone: wdrozone, /)
  assert.match(zrodloPr, /required: \['wpisy', 'odmowy', 'indeks', 'propozycjeDoReviewerow', 'plikPropozycji', 'commit', 'ciGlownej', 'push', 'pushDetal'\]/)
  assert.match(etapPr, /docs\/learned-patterns\.md/)
  assert.match(etapPr, /Po zapisie wpisow: \\`node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz\\` \(wpisy regula oraz kod\/lint bez pola bramka/)
  assert.doesNotMatch(etapPr, /Wpisy kod i lint do indeksu nie ida/)
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
  assert.match(wynikRunu, /bramkiWdrozone: \(compound && compound\.bramkiWdrozone\) \|\| \[\],/)
  assert.match(wynikRunu, /indeks: compound && compound\.indeks,/)
  assert.doesNotMatch(wynikRunu, /compound\.regula/)
})

test('skill dev-pr: raport pokazuje indeks, odmowy i propozycje bramek z compoundu', () => {
  const skillPr = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')
  assert.match(skillPr, /`propozycjeBramek\[\]`/)
  assert.match(skillPr, /📚 Baza wiedzy: <N wpisów w docs\/solutions\/>, indeks: <indeks>, odmowy: <odmowy albo „brak”>/)
  assert.match(skillPr, /🧱 Propozycje bramek \(do Twojej decyzji, NIE wdrożone/)
  // Punkt 43: mechanizm juz w kodzie raport podaje jako wdrozony, bez pytania; pole bramka w solution zostaje nieustawione.
  assert.match(skillPr, /`propozycjeBramek\[\]` \(mechanizmu nie ma w kodzie\) albo `bramkiWdrozone\[\]` \(poprawka już go wprowadziła,\npole `mechanizm` = `plik:linia`\)/)
  assert.match(skillPr, /W raporcie podajesz je jako „wdrożone w `<plik:linia>`” i o nic nie pytasz\. Pola `bramka`\nw solution compound przy tym nie ustawia/)
  assert.match(skillPr, /\n {3}Już w kodzie \(z `bramkiWdrozone`, bez decyzji\):\n {3}- \[<szczebel>\] <klasa>: <regula> — wdrożone w <mechanizm> \(<solution>\)\n/)
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

test('whitelisty bazy wiedzy: refresh autopilota, dodatkowy pathspec archiwum i siatka complete-wf z indeksem w docs/', () => {
  const zrodloAutopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
  const zrodloComplete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')
  assert.match(zrodloAutopilot, /Staguj po whiteliscie: \\`git add docs\/solutions\/ docs\/CONCEPTS\.md docs\/learned-patterns\.md\\`/)
  assert.match(zrodloAutopilot, /\? \['docs\/solutions', 'docs\/CONCEPTS\.md', 'docs\/learned-patterns\.md'\]/)
  assert.match(zrodloAutopilot, /Indeks wiedzy: \\`node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz\\`/)
  assert.match(zrodloComplete, /artefakty bazy wiedzy — docs\/solutions\/, docs\/CONCEPTS\.md, docs\/learned-patterns\.md/)
})

test('skill dev-compound: kod/lint do wdrozenia bramki w indeksie jak regula; pole bramka ustawia wdrozenie (6a pkt 60 g3b)', () => {
  const sekcja = skill.slice(skill.indexOf('### Pola wiedzy'), skill.indexOf('### Krok 5'))
  assert.match(sekcja, /- `bramka` — tylko przy szczeblu `kod` albo `lint`/)
  assert.match(sekcja, /Po każdym zapisanym solution: `node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz`/)
  // Punkt 43: mechanizm juz w kodzie = „Bramka wdrożona w plik:linia” zamiast propozycji; pola bramka compound nadal nie ustawia.
  assert.match(sekcja, /sprawdź grepem, czy mechanizm z pola `regula` już stoi w kodzie/)
  assert.match(sekcja, /Stoi → w podsumowaniu \*\*Bramka wdrożona w `<plik:linia>`\*\*, bez pytania do operatora; pola `bramka` nie\n {3}ustawiasz\. Nie stoi → w podsumowaniu \*\*Propozycja bramki\*\*/)
  assert.match(sekcja, /Dopisuje je ten, kto wdraża bramkę, nie compound\./)
  assert.match(skill, /Bramka wdrożona \(zamiast propozycji, gdy mechanizm już stoi w kodzie\): \[kod\|lint\] \[klasa\] — \[reguła\], w \[plik:linia\]/)
  assert.doesNotMatch(skill, /indeksu nie ruszasz|Do indeksu idzie tylko/)
})

// E5-15(b): compound zapisuje regule skrocona do linii wycinka (≤ 160 zn); walidacja: walidacja.test.mjs.
test('compound: pole regula_krotka w szablonie frontmattera skilla, w liscie pol skilla i w kroku 4 workflowu', () => {
  const start = skill.indexOf('```markdown\n---\ntitle:')
  const frontmatter = skill.slice(start, skill.indexOf('\n---\n', start + '```markdown\n---\n'.length))
  assert.match(frontmatter, /\nregula_krotka: /)
  assert.match(skill, /- `regula_krotka` — [^\n]*160 zn/)
  assert.match(zrodloCompound, /\(klasa, regula, regula_krotka, paths,/)
})

// E5-15(d)(e): refresh czyta doScalenia i doBramki z wyniku indeksu — scala reguly jednej klasy w jedna, a klasie
// z ≥ 3 ucieczkami proponuje bramke mechaniczna zamiast kolejnej linii; compound podaje doBramki w podsumowaniu.
test('skill dev-compound-refresh: doScalenia → jedna regula klasy (Replace), doBramki → propozycja bramki mechanicznej; raport z obu', () => {
  const faza = refresh.slice(refresh.indexOf('## Faza 1.7: Indeks wiedzy'), refresh.indexOf('## Jeden wątek'))
  assert.match(faza, /`doScalenia`[^\n]*(\n[^\n]+)*?Replace jednym następcą/)
  assert.match(faza, /`regula_krotka`/)
  assert.match(faza, /`doBramki`[^\n]*(\n[^\n]+)*?(lint|ast-grep)/)
  const raport = refresh.slice(refresh.indexOf('### Indeks wiedzy (docs/learned-patterns.md)'))
  assert.match(raport, /Do scalenia: /)
  assert.match(raport, /Do bramki: /)
  assert.match(skill, /`doBramki`/)
})
