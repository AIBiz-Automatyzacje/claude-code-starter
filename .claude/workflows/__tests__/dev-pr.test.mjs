// Testy dev-pr-wf.js (PLAN-POPRAWY P5, ETAP1B §4): guard uzasadnien odrzucenia, token tury, rekomendacja dla czterech stanow,
// tabela tury zlaczona po id z watki[], bramka rozmiaru CLAUDE.md i komenda zmiany pola claude_md po merge'u.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/dev-pr.test.mjs
//
// DLACZEGO: decyzje dev-pr zapadaja w JS (agenci zbieraja, naprawiaja, commituja), wiec da sie je sprawdzic bez runtime'u
// Workflow — funkcje wycinamy ze zrodla jak w start-koniec.test.mjs.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { PROG_PLIKOW_PR } from '../../scripts/pr/rozmiar.mjs'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-pr-wf.js'), 'utf8')

/**
 * Wycina fragment zrodla workflowu od kotwicy do konca (wlacznie).
 * @param {string} kotwica
 * @param {string} koniec
 * @returns {string}
 */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const P = new Function(
  `${wytnij('// ── Decyzje dev-pr (P5)', '// ── Koniec decyzji dev-pr')}
   return { odrzucenieUzasadnione, tokenTury, watkiTury, rekomendacja, SUFIT_TUR, tabelaTury, bramkaClaudeMd, PRZYROST_CLAUDE_MD, komendaUzgodnienia, wagaWatku, KLASY_NIE_DEFEKT, czesciZTabeli, planCzesci, claudeMdCzesci, tylkoIndeksWiedzy }`,
)()

// ── Guard uzasadnien odrzucenia ───────────────────────────────────────────

test('guard: sam fragment kodu w backtickach nie jest zrodlem decyzji', () => {
  assert.equal(P.odrzucenieUzasadnione('Bot nie ma racji, bo `as const` to nie asercja typu w tym miejscu kodu'), false)
})

test('guard: nazwa dokumentu decyzji + co najmniej 20 znakow uzasadnienia = odrzucenie dozwolone', () => {
  for (const u of [
    'CLAUDE.md: „Rate limit tylko na publicznych endpointach” — ten endpoint jest wewnetrzny',
    'docs/plans/plan-techniczny-x.md przesadza, ze limit 5 MB wynika z umowy z klientem',
    'docs/CONCEPTS.md definiuje oferte jako niezmienna po publikacji',
    'docs/decisions/2026-10-02-zadanie-x.md: retry tylko po stronie kolejki, nie klienta',
  ]) assert.equal(P.odrzucenieUzasadnione(u), true, u)
})

test('guard: nazwa dokumentu bez uzasadnienia (ponizej 20 znakow) albo puste pole = odrzucenie niedozwolone', () => {
  for (const u of ['CLAUDE.md', 'wg CLAUDE.md, krotko', '', undefined]) assert.equal(P.odrzucenieUzasadnione(u), false, String(u))
})

// ── Waga watku (kalibracja P5) ────────────────────────────────────────────
// Kalibracja na PR 2, 4, 16 oferty-online: 19 z 23 uwag nie-defektow (12x prog-rozmiaru) dostalo od agenta P3 zamiast 0.

/** @type {{ KLASY_BLEDOW: Record<string, { os: string }> }} */
// eslint-disable-next-line no-new-func -- ekstrakcja slownika z pliku workflowu tego repo, nie z inputu
const { KLASY_BLEDOW } = new Function(`${wytnij('const KLASY_BLEDOW = {', '\n}')}\n return { KLASY_BLEDOW }`)()

test('waga: klasa nie-defektu ze slownika = waga 0 niezaleznie od wagi agenta', () => {
  for (const klasaBledu of ['prog-rozmiaru', 'preferencja-bota', 'teza-obalona', 'odpowiedz-bota']) {
    assert.equal(P.wagaWatku({ klasaBledu, waga: 'P3' }), '0', klasaBledu)
  }
})

test('waga: klasa defektu albo konwencja-kodu = waga agenta bez zmian', () => {
  assert.equal(P.wagaWatku({ klasaBledu: 'test-niefalsyfikowalny', waga: 'P2' }), 'P2')
  assert.equal(P.wagaWatku({ klasaBledu: 'konwencja-kodu', waga: 'P3' }), 'P3')
})

test('waga: kazda klasa nie-defektu istnieje w slowniku z osia brak', () => {
  for (const k of P.KLASY_NIE_DEFEKT) assert.equal(KLASY_BLEDOW[k]?.os, 'brak', k)
})

// ── Token tury ────────────────────────────────────────────────────────────

const SHA = '0123456789abcdef0123'

test('token tury: numer tury i SHA czubka galezi, z ktorego zebrano watki', () => {
  assert.equal(P.tokenTury(2, SHA), 'tura-2@0123456789ab')
})

test('napraw: watki zebrane w tej turze przechodza, watki z poprzedniej tury albo bez tokenu sa odrzucone', () => {
  const token = P.tokenTury(2, SHA)
  const watki = [
    { id: 'T1', token },
    { id: 'T2', token: P.tokenTury(1, SHA) },
    { id: 'T3' },
  ]
  const r = P.watkiTury(watki, token, 2)
  assert.equal(r.blad, null)
  assert.deepEqual(r.watki.map((/** @type {{id: string}} */ w) => w.id), ['T1'])
  assert.deepEqual(r.bezTokenu, ['T2', 'T3'])
})

test('napraw: brak tokenu albo token innej tury = blad z poleceniem zbierz w tej turze, zaden watek nie przechodzi', () => {
  const watki = [{ id: 'T1', token: P.tokenTury(1, SHA) }]
  for (const [token, tura] of [[undefined, 2], [P.tokenTury(1, SHA), 2]]) {
    const r = P.watkiTury(watki, token, tura)
    assert.match(r.blad ?? '', /zbierz/)
    assert.deepEqual(r.watki, [])
    assert.deepEqual(r.bezTokenu, ['T1'])
  }
})

// ── Rekomendacja ──────────────────────────────────────────────────────────

const CZYSTY = { mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', ciZielone: true, ciDetal: 'build: SUCCESS', watkiNapraw: 0, watkiDoOperatora: 0 }

test('rekomendacja: wszystko zielone i zero watkow = MERGUJ', () => {
  assert.equal(P.rekomendacja(CZYSTY, 1), 'MERGUJ')
})

test('rekomendacja: watki do naprawy i tury w zapasie = KOLEJNA TURA z numerem tury i sufitem', () => {
  assert.equal(P.SUFIT_TUR, 3)
  const r = P.rekomendacja({ ...CZYSTY, watkiNapraw: 2, ciZielone: false, ciDetal: 'test: FAILURE' }, 1)
  assert.match(r, /^KOLEJNA TURA — 2 /)
  assert.match(r, /tura 2 z 3/)
})

test('rekomendacja: watki do naprawy po wyczerpaniu sufitu tur = DECYZJA OPERATORA, nie czwarta tura', () => {
  assert.match(P.rekomendacja({ ...CZYSTY, watkiNapraw: 1 }, 3), /^DECYZJA OPERATORA — sufit 3 tur/)
})

test('rekomendacja: watek do-operatora wygrywa z kolejna tura', () => {
  assert.match(P.rekomendacja({ ...CZYSTY, watkiNapraw: 4, watkiDoOperatora: 1 }, 1), /^DECYZJA OPERATORA — 1 /)
})

test('rekomendacja: zero watkow, ale CI czerwone, konflikt albo galaz w tyle = NIE MERGUJ z warunkiem i wartoscia', () => {
  const r = P.rekomendacja({ ...CZYSTY, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', ciZielone: false, ciDetal: 'test: FAILURE' }, 2)
  assert.match(r, /^NIE MERGUJ — /)
  for (const s of ['CONFLICTING', 'DIRTY', 'test: FAILURE']) assert.ok(r.includes(s), `brak ${s} w: ${r}`)
})

// P19 (vibersi PR #2): `zbierz` dal MERGUJ przy watku `odrzuc` bez naszej odpowiedzi, a bramka merge'a policzyla go jako
// `napraw` — merge odblokowala dopiero tura z sama odpowiedzia. Teraz zbierz rekomenduje te ture wprost.
test('rekomendacja: odrzuc bez naszej odpowiedzi = KOLEJNA TURA (tylko odpowiedzi), nie MERGUJ; po sufitcie DECYZJA OPERATORA; napraw i do-operatora wygrywaja', () => {
  const r = P.rekomendacja({ ...CZYSTY, watkiOdrzucBezOdpowiedzi: 1 }, 1)
  assert.equal(r, "KOLEJNA TURA (tylko odpowiedzi) — 1 watkow odrzuc bez naszej odpowiedzi; bramka merge'a liczy je jako napraw (tura 2 z 3)")
  assert.ok(r.startsWith('KOLEJNA TURA'), 'skill idzie do tury, nie do domkniecia')
  assert.match(P.rekomendacja({ ...CZYSTY, watkiOdrzucBezOdpowiedzi: 2 }, 3), /^DECYZJA OPERATORA — sufit 3 tur wyczerpany, 2 watkow odrzuc bez naszej odpowiedzi/)
  assert.match(P.rekomendacja({ ...CZYSTY, watkiNapraw: 1, watkiOdrzucBezOdpowiedzi: 1 }, 1), /^KOLEJNA TURA — 1 watkow do naprawy/)
  assert.match(P.rekomendacja({ ...CZYSTY, watkiDoOperatora: 1, watkiOdrzucBezOdpowiedzi: 1 }, 1), /^DECYZJA OPERATORA — 1 /)
  assert.equal(P.rekomendacja({ ...CZYSTY, watkiOdrzucBezOdpowiedzi: 0 }, 1), 'MERGUJ')
  assert.equal(P.rekomendacja(CZYSTY, 1), 'MERGUJ', 'etap merge nie liczy pola — bez zmian')
})

test('zbierz: watkiOdrzucBezOdpowiedzi z pola naszaOdpowiedz watkow odrzuc (po przeklasyfikowaniu bez cytatu); pole wymagane w schemacie', () => {
  const zbierz = wytnij("if (etap === 'zbierz') {", '\n}\n')
  assert.match(zbierz, /watkiOdrzucBezOdpowiedzi: watki\.filter\(\(w\) => w\.klasa === 'odrzuc' && w\.naszaOdpowiedz !== true\)\.length/)
  assert.ok(zbierz.indexOf('odrzuconeBezCytatu.length') < zbierz.indexOf('watkiOdrzucBezOdpowiedzi'))
  assert.match(zbierz, /\\`naszaOdpowiedz\\` = true, gdy w watku po pierwszym komentarzu bota jest komentarz autora innego niz bot/)
  assert.match(zrodlo, /required: \['id', 'plik', 'streszczenie', 'klasa', 'uzasadnienie', 'wplywNaProjekt', 'klasaBledu', 'os', 'waga', 'naszaOdpowiedz'\]/)
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')
  assert.match(skill, /Wyjątek: tura bez commita \(sama odpowiedź w wątkach\s+`odrzuć`, np\. `KOLEJNA TURA \(tylko odpowiedzi\)`\) nie ma czego recenzować — przechodzisz od razu do kroku 3\./)
  assert.match(wytnij("if (etap === 'napraw') {", '\n}\n'), /const doOdrzucenia = zTury\.watki\.filter\(\(w\) => w\.klasa === 'odrzuc' && w\.naszaOdpowiedz !== true && !doNaprawy\.includes\(w\)\)/)
  assert.match(skill, /`KOLEJNA TURA \(tylko odpowiedzi\)` → wątki `odrzuć` czekają na naszą odpowiedź[\s\S]*do kroku 5 z `wybor: \[\]`: tura wysyła odpowiedzi/)
})

// ── Raport tury ───────────────────────────────────────────────────────────

test('tabela tury: wiersz na watek z decyzja z wyniku naprawy zlaczona po id, nie po kolejnosci', () => {
  const watki = [
    { id: 'A', plik: 'src/a.ts:10', streszczenie: 'brak limitu czasu', klasa: 'napraw', uzasadnienie: 'fetch bez AbortSignal' },
    { id: 'B', plik: 'src/b.ts:5', streszczenie: 'as const to asercja', klasa: 'odrzuc', uzasadnienie: 'CLAUDE.md: as const nie jest asercja typu w projekcie' },
    { id: 'C', plik: 'src/c.ts:7', streszczenie: 'zmiana cennika', klasa: 'do-operatora', uzasadnienie: 'decyzja produktowa' },
    { id: 'D', plik: 'src/d.ts:1', streszczenie: 'nazwa zmiennej', klasa: 'napraw', uzasadnienie: 'drobiazg' },
  ]
  const naprawa = { naprawione: ['A'], odrzucone: ['B'], nieruszone: ['D'] }
  /** @type {string[]} */
  const linie = P.tabelaTury(2, watki, naprawa).split('\n')
  assert.equal(linie[0], '| Tura 2: plik:linia | zarzut | decyzja | uzasadnienie |')
  /** @param {string} id @returns {string} */
  const wiersz = (id) => linie.find((l) => l.includes(watki.find((w) => w.id === id)?.plik ?? '?')) ?? ''
  assert.match(wiersz('A'), /\| naprawiony \|/)
  assert.match(wiersz('B'), /\| odrzucony \| CLAUDE\.md/)
  assert.match(wiersz('C'), /\| do operatora \|/)
  assert.match(wiersz('D'), /\| nieruszony \|/)
  assert.equal(linie.length, 2 + watki.length)
})

test('tabela tury: watek spoza wyboru operatora = pominiety; pionowa kreska i nowa linia w tresci nie lamia tabeli', () => {
  const watki = [{ id: 'A', plik: 'src/a.ts:1', streszczenie: 'a | b\nc', klasa: 'napraw', uzasadnienie: 'x' }]
  const t = P.tabelaTury(1, watki, { naprawione: [], odrzucone: [], nieruszone: [] })
  assert.ok(t.includes('a \\| b c'), t)
  assert.match(t, /\| pominiety \|/)
})

// ── Krok CLAUDE.md po merge'u ─────────────────────────────────────────────

test('bramka CLAUDE.md: przyrost do 2000 znakow albo skrocenie = bez uwagi', () => {
  assert.equal(P.PRZYROST_CLAUDE_MD, 2000)
  assert.equal(P.bramkaClaudeMd(21000, 23000), null)
  assert.equal(P.bramkaClaudeMd(21000, 18000), null)
})

test('bramka CLAUDE.md: przyrost ponad 2000 znakow = blad z rozmiarami i przyrostem', () => {
  const b = P.bramkaClaudeMd(21000, 23001)
  assert.match(b ?? '', /2001/)
  assert.match(b ?? '', /21000 -> 23001/)
  assert.match(b ?? '', /2000/)
})

test('bramka CLAUDE.md: brak pomiaru (agent nie podal liczb) = blad, nie ciche przejscie', () => {
  assert.match(P.bramkaClaudeMd(null, 23000) ?? '', /pomiar/)
})

/**
 * Uruchamia komende z workflowu w katalogu tymczasowym z plikiem decyzji o podanej tresci.
 * @param {string} tresc
 * @returns {{ kod: number, tresc: string }}
 */
function uruchomUzgodnienie(tresc) {
  const katalog = mkdtempSync(join(tmpdir(), 'dev-pr-'))
  const plik = 'docs/decisions/2026-10-02-zadanie-x.md'
  mkdirSync(join(katalog, 'docs/decisions'), { recursive: true })
  writeFileSync(join(katalog, plik), tresc)
  const komenda = P.komendaUzgodnienia(plik)
  assert.ok(komenda, 'poprawna sciezka daje komende')
  let kod = 0
  try {
    execFileSync('/bin/bash', ['-c', komenda], { cwd: katalog, stdio: 'pipe', env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` } })
  } catch (e) {
    kod = /** @type {{ status: number }} */ (e).status
  }
  return { kod, tresc: readFileSync(join(katalog, plik), 'utf8') }
}

const DECYZJA = '---\nzadanie: zadanie-x\ndata: 2026-10-02\nclaude_md: do-uzgodnienia\n---\n\n# Decyzje — zadanie-x\n\n## Do CLAUDE.md po merge\'u\n- brak\n'

test('pole claude_md: komenda zmienia do-uzgodnienia na uzgodniono we frontmatterze, reszta pliku bez zmian', () => {
  const r = uruchomUzgodnienie(DECYZJA)
  assert.equal(r.kod, 0)
  assert.equal(r.tresc, DECYZJA.replace('claude_md: do-uzgodnienia', 'claude_md: uzgodniono'))
})

test('pole claude_md: plik bez pola do-uzgodnienia = kod 3 i plik nietkniety', () => {
  const bez = DECYZJA.replace('claude_md: do-uzgodnienia', 'claude_md: uzgodniono')
  const r = uruchomUzgodnienie(bez)
  assert.equal(r.kod, 3)
  assert.equal(r.tresc, bez)
})

test('pole claude_md: sciezka spoza docs/decisions albo ze znakami powloki = brak komendy', () => {
  for (const p of ['CLAUDE.md', 'docs/decisions/x.md; rm -rf ~', 'docs/decisions/../../a.md', "docs/decisions/a'b.md"]) {
    assert.equal(P.komendaUzgodnienia(p), null, p)
  }
})

// ── Push commita compoundu (P20 A4) ───────────────────────────────────────
// vibersi PR #3 i #4: compound po `gh pr merge --delete-branch` commitowal na lokalnym main bez pusha (b207793, 6d46eb9) —
// PR2 wiozl commit compoundu PR1, a krok claude-md (`git pull --ff-only`) dawal STOP na rozjechanym main.

test('compound: krok push w prompcie (to samo brzmienie co claude-md), pola push w schemacie, UWAGA w logu bez pusha', () => {
  const compound = wytnij("if (etap === 'compound') {", "\n}\n")
  const claudeMd = wytnij("if (etap === 'claude-md') {", "\n}\n")
  assert.match(compound, /\n6\. \$\{KROK_PUSH\}/, 'compound pushuje swoj commit')
  assert.match(claudeMd, /\n4\. \$\{KROK_PUSH\}/, 'claude-md uzywa tego samego kroku push')
  assert.match(wytnij('const KROK_PUSH = `', '"OK".`'), /bez --force i bez innej galezi/)
  assert.match(compound, /commit null, push false, pushDetal "brak commita"/)
  assert.match(compound, /if \(wynik\.commit && !wynik\.push\) log\(`\/dev-pr compound: UWAGA — commit \$\{wynik\.commit\} bez pusha/)
  // eslint-disable-next-line no-new-func -- ekstrakcja schematu z pliku workflowu tego repo, nie z inputu
  const schemat = new Function('WPIS_WIEDZY', `${wytnij('const COMPOUND_PR = {', '\n}\n')} return COMPOUND_PR`)({})
  for (const pole of ['commit', 'push', 'pushDetal']) assert.ok(schemat.required.includes(pole), `COMPOUND_PR.required: ${pole}`)
})

// ── PR wieloczesciowy (P20 S2) ────────────────────────────────────────────
// vibersi etap 3: PR #3 z galezi feature/etap-3-cz1 od 909f669 (93 pliki), PR #4 po rebase --onto origin/main 909f669 (121);
// compound PR #3 zostal na lokalnym main, a krok CLAUDE.md po PR #3 dal STOP „brak pliku decyzji” (plik jechal w PR #4).

const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')
const archiwum = complete.slice(complete.indexOf('// ── Archiwum (P4)'), complete.indexOf('// ── Koniec archiwum'))
// eslint-disable-next-line no-new-func -- jw.
const C = new Function(`${archiwum}\nreturn { czesciPr }`)()
const A = '6ada855e2f76cd1fcc61bba55e21ccf548962145'
const B = '909f669f0efce8a340f5e541573fa3ea43259f11'
const D = '7c9c87ce0e24043b274a12da67bef8eece1a998e'
const E = '08e5584634418dfb79b302d6284666327bff3bdd'
/** @param {[string, string, string, number][]} czesci fazy, od, do, pliki @returns {string} tabela tak, jak archiwizacja zapisuje ja w podsumowaniu */
const tabela = (czesci) => C.czesciPr({ ok: true, zrodlo: 'pomiar', uwaga: null, czesci: czesci.map(([fazy, od, doSha, pliki], i) => ({ czesc: i + 1, fazy, od, do: doSha, doRecenzji: pliki })) }, 'z').sekcja

test('czesci: tabela z archiwizacji (complete-wf) czytana w dev-pr — commity ciecia pelne 12 znakow, ostatnia do czubka', () => {
  assert.deepEqual(P.czesciZTabeli(tabela([['1–3', A, B, 93], ['4–6', B, E, 101]])), [
    { czesc: 1, fazy: '1–3', od: A.slice(0, 12), do: B.slice(0, 12), pliki: 93 },
    { czesc: 2, fazy: '4–6', od: B.slice(0, 12), do: null, pliki: 101 },
  ])
})

test('czesci: jedna czesc, numeracja nie po kolei, od rozne od konca poprzedniej, brak czubka albo SHA ze znakami powloki = null', () => {
  const dobra = tabela([['1–3', A, B, 93], ['4–6', B, E, 101]])
  for (const [z, na] of [
    ['| 2 | 4–6 |', '| 3 | 4–6 |'], [`| 2 | 4–6 | ${B.slice(0, 12)}`, `| 2 | 4–6 | ${D.slice(0, 12)}`], ['czubek gałęzi', E.slice(0, 12)],
    [`| 1 | 1–3 | ${A.slice(0, 12)}`, '| 1 | 1–3 | $(rm -rf ~)'],
  ]) {
    assert.ok(dobra.includes(z), z)
    assert.equal(P.czesciZTabeli(dobra.replace(z, na)), null, na)
  }
  assert.equal(P.czesciZTabeli('| Część | Fazy | Od | Do | Plików do recenzji |\n|---|---|---|---|---|\n| 1 | 1–6 | 6ada855e2f76 | czubek gałęzi | 172 |'), null)
  assert.equal(P.czesciZTabeli(''), null)
})

test('plan czesci: nieostatnia = galaz <feature>-czN na koncu czesci (od 2 rebase od poczatku), ostatnia = rebase galezi zadania od ciecia', () => {
  const dwie = P.czesciZTabeli(tabela([['1–3', A, B, 93], ['4–6', B, E, 101]]))
  assert.deepEqual(P.planCzesci(dwie, 1, 'etap-3'), {
    blad: null, czesc: 1, czesci: 2, fazy: '1–3', pliki: 93, ostatnia: false, galaz: 'feature/etap-3-cz1', doSha: B.slice(0, 12), rebaseOd: null, poprzednia: null,
  })
  assert.deepEqual(P.planCzesci(dwie, 2, 'etap-3'), {
    blad: null, czesc: 2, czesci: 2, fazy: '4–6', pliki: 101, ostatnia: true, galaz: 'feature/etap-3', doSha: null, rebaseOd: B.slice(0, 12), poprzednia: 'feature/etap-3-cz1',
  })
  const trzy = P.czesciZTabeli(tabela([['1–3', A, B, 93], ['4', B, D, 40], ['5–6', D, E, 70]]))
  assert.deepEqual([P.planCzesci(trzy, 2, 'z').galaz, P.planCzesci(trzy, 2, 'z').doSha, P.planCzesci(trzy, 2, 'z').rebaseOd, P.planCzesci(trzy, 2, 'z').poprzednia],
    ['feature/z-cz2', D.slice(0, 12), B.slice(0, 12), 'feature/z-cz1'])
  assert.equal(P.planCzesci(trzy, 3, 'z').rebaseOd, D.slice(0, 12))
  assert.equal(P.planCzesci(dwie, 3, 'z').blad, 'część 3 spoza tabeli (części 1–2)')
  assert.match(P.planCzesci(null, 1, 'z').blad, /^brak tabeli „## Części PR” w podsumowaniu zadania na gałęzi feature\/z .*\/dev-pr bez --czesc$/)
})

test('czesci: krok CLAUDE.md pominiety po czesci nieostatniej (JS przed agentem), po ostatniej i bez czesci normalnie', () => {
  assert.equal(P.claudeMdCzesci(1, 2), 'część 1 z 2 — CLAUDE.md uzgadnia się po merge\'u ostatniej części (plik decyzji jest w niej)')
  assert.equal(P.claudeMdCzesci(2, 2), null)
  assert.equal(P.claudeMdCzesci(null, null), null)
  const etap = zrodlo.slice(zrodlo.indexOf("if (etap === 'claude-md') {"))
  assert.ok(etap.indexOf('claudeMdCzesci(czesc, czesci)') < etap.indexOf('await agent('), 'guard przed pierwszym agentem etapu')
})

test('czesci: przygotowanie galezi — rebase --onto origin/main od ciecia, konflikt bez abort, walidacja przed pushem, push z lease; zbierz oddaje czesc', () => {
  const start = zrodlo.slice(zrodlo.indexOf("if (etap === 'start') {"), zrodlo.indexOf("// ── Etap: zbierz"))
  assert.match(start, /is-ancestor origin\/main HEAD\\` kod 0 — rebase=juz-wykonany/)
  assert.match(start, /is-ancestor \$\{cz\.rebaseOd\} HEAD\\` kod 0 — \\`git rebase --onto origin\/main \$\{cz\.rebaseOd\}\\`/)
  assert.equal(start.split('3. ${rebase}').length - 1, 2, 'ten sam krok rebase w czesci ostatniej i srodkowej')
  assert.match(start, /git switch -c \$\{cz\.galaz\} \$\{cz\.doSha\}/)
  assert.match(start, /NIE rozwiazuj go i NIE rob \\`git rebase --abort\\`/)
  assert.ok(start.indexOf('5. WALIDACJA') < start.indexOf('6. PUSH'))
  assert.match(start, /git push --force-with-lease --force-if-includes -u origin \$\{cz\.galaz\}/)
  assert.match(start, /status: 'KONFLIKT', etap, czesc: cz\.czesc/)
  assert.match(start, /gh pr list --state merged --head \$\{cz\.poprzednia\}/)
  assert.match(start, /\.\.\.\(cz \? \{ czesc: cz\.czesc, czesci: cz\.czesci, fazy: cz\.fazy \} : \{\}\)/)
  assert.match(zrodlo, /prNumer: wynik\.prNumer \?\? null, czesc, uwagi/)
})

// Przebieg etapow z atrapa agent(): JS liczy galaz i rebase z tabeli, agent dostaje gotowe komendy.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
/**
 * @param {Record<string, unknown>} args
 * @param {unknown[]} odpowiedzi kolejne wyniki agent()
 * @returns {Promise<{ wynik: Record<string, any>, prompty: string[] }>}
 */
async function uruchom(args, odpowiedzi) {
  /** @type {string[]} */
  const prompty = []
  const agent = async (/** @type {string} */ p) => {
    prompty.push(p)
    return odpowiedzi.shift() ?? null
  }
  const wynik = await new AsyncFunction('args', 'agent', 'log', 'phase', zrodlo.replace(/^export const meta = /m, 'const meta = '))(args, agent, () => {}, () => {})
  return { wynik, prompty }
}
const TABELA_ETAPU_3 = tabela([['1–3', A, B, 93], ['4–6', B, E, 121]])
const PRZYG_OK = { status: 'OK', galaz: 'feature/etap-3', konflikty: [], rebase: 'wykonany', walidacja: 'PASS', walidacjaDetal: 'tsc, vitest', push: true, pushDetal: 'OK' }
const START_OK = { bramka: 'OK', branch: 'feature/etap-3', prUtworzony: true, prNumer: 4, prUrl: 'u', headRefOid: 'abc' }

test('start --czesc 2 z 2: odczyt tabeli, rebase galezi zadania od 909f669 na origin/main, push z lease, tytul czesci; wynik niesie czesc', async () => {
  const { wynik, prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, PRZYG_OK, START_OK])
  assert.equal(prompty.length, 3)
  assert.match(prompty[0], /git show 'feature\/etap-3:docs\/completed\/etap-3\/etap-3-podsumowanie\.md' \| awk/)
  assert.match(prompty[1], /git switch feature\/etap-3`, `git fetch --prune origin`/)
  assert.match(prompty[1], /--head feature\/etap-3-cz1 --json number/)
  assert.match(prompty[1], /is-ancestor 909f669f0efc HEAD` kod 0 — `git rebase --onto origin\/main 909f669f0efc`/)
  assert.match(prompty[1], /\(c\) inaczej .* `git rebase origin\/main`, rebase=wykonany/)
  assert.match(prompty[1], /git push --force-with-lease --force-if-includes -u origin feature\/etap-3`/)
  assert.match(prompty[1], /5\. WALIDACJA \(tylko gdy rebase=wykonany albo juz-wykonany\): typecheck i testy/)
  assert.match(prompty[2], /tytul PR "<tytul zadania> — cz\. 2 z 2 \(fazy 4–6\)"/)
  assert.match(prompty[2], /git show 'feature\/etap-3:docs\/completed\/etap-3\/known-issues\.md'/)
  assert.deepEqual([wynik.status, wynik.czesc, wynik.czesci, wynik.fazy, wynik.prNumer], ['OK', 2, 2, '4–6', 4])
})

test('start --czesc 1: galaz -cz1 od commitu ciecia bez rebase; konflikt i zla galaz zatrzymuja przed PR; brak tabeli = STOP bez przygotowania', async () => {
  const cz1 = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, { ...PRZYG_OK, galaz: 'feature/etap-3-cz1', rebase: 'nie-dotyczy', walidacja: 'nie-dotyczy' }, START_OK])
  assert.match(cz1.prompty[1], /git fetch --prune origin`.*`git switch -c feature\/etap-3-cz1 909f669f0efc`/s)
  assert.doesNotMatch(cz1.prompty[1], /git rebase --onto/)
  assert.match(cz1.prompty[2], /kolejne części po merge'u tej/)
  assert.equal(cz1.wynik.czesc, 1)
  const konflikt = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true },
    { ...PRZYG_OK, status: 'KONFLIKT', konflikty: ['e2e/etap-4-moderacja-smoke.sh'], powod: 'CONFLICT (content)', push: false, pushDetal: '' }])
  assert.equal(konflikt.prompty.length, 2, 'bez agenta tworzacego PR')
  assert.deepEqual([konflikt.wynik.status, konflikt.wynik.konflikty], ['KONFLIKT', ['e2e/etap-4-moderacja-smoke.sh']])
  assert.match(konflikt.wynik.naprawa, /git rebase --continue` \(do konca rebase.u\), potem \/dev-pr --czesc 2; albo `git rebase --abort`/)
  const zlaGalaz = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, { ...PRZYG_OK, galaz: 'main' }])
  assert.deepEqual([zlaGalaz.wynik.status, zlaGalaz.wynik.powod, zlaGalaz.prompty.length], ['STOP', 'biezaca galaz main, oczekiwana feature/etap-3', 2])
  const bezTabeli = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: '', galazZadania: true }])
  assert.deepEqual([bezTabeli.wynik.status, bezTabeli.prompty.length], ['STOP', 1])
})

test('claude-md czesci 1 z 2 bez agenta; zbierz oddaje czesc do telemetrii', async () => {
  const cm = await uruchom({ etap: 'claude-md', zadanie: 'etap-3', czesc: 1, czesci: 2 }, [])
  assert.deepEqual([cm.wynik.status, cm.wynik.pominiety, cm.prompty.length], ['OK', true, 0])
  const zb = await uruchom({ etap: 'zbierz', zadanie: 'etap-3', tura: 1, czesc: 2, czesci: 2 }, [{
    watki: [], prNumer: 4, headRefOid: 'abc', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', ciZielone: true, ciDetal: 'brak CI', recenzjaAktualna: true, plikiPr: 194,
  }])
  assert.deepEqual([zb.wynik.czesc, zb.wynik.prNumer, zb.wynik.rekomendacja], [2, 4, 'MERGUJ'])
})

test('start bez --czesc przy tabeli czesci = STOP z /dev-pr --czesc 1; bez tabeli — zwykly PR', async () => {
  const z = await uruchom({ etap: 'start', zadanie: 'etap-3' }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }])
  assert.deepEqual([z.wynik.status, z.prompty.length], ['STOP', 1])
  assert.match(z.wynik.powod, /zadanie ma 2 części PR .* \/dev-pr --czesc 1/)
  const jeden = await uruchom({ etap: 'start', zadanie: 'etap-3' }, [{ tabela: '', galazZadania: true }, START_OK])
  assert.deepEqual([jeden.wynik.status, jeden.prompty.length, jeden.wynik.czesc], ['OK', 2, undefined])
  assert.doesNotMatch(jeden.prompty[1], /CZESC \d/)
})

test('start --czesc: brak galezi zadania, walidacja FAIL po rebase, push false = STOP; null agentow = BLAD; zla nazwa zadania = BLAD bez agentow', async () => {
  const bezGalezi = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: '', galazZadania: false }])
  assert.equal(bezGalezi.wynik.powod, 'brak lokalnej gałęzi feature/etap-3 — tabela części i commity cięcia są na niej (git fetch, git switch feature/etap-3)')
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const fail = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, { ...PRZYG_OK, walidacja: 'FAIL', walidacjaDetal: 'vitest 3 failed' }])
  assert.deepEqual([fail.wynik.status, fail.wynik.powod, fail.prompty.length], ['STOP', "walidacja po rebase'ie FAIL: vitest 3 failed", 2])
  const push = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, { ...PRZYG_OK, push: false, pushDetal: 'rejected (stale info)' }])
  assert.equal(push.wynik.powod, 'push: rejected (stale info)')
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [null])).wynik.status, 'BLAD')
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, null])).wynik.status, 'BLAD')
  const zla = await uruchom({ etap: 'start', zadanie: "x'; rm -rf ~", czesc: 1 }, [])
  assert.deepEqual([zla.wynik.status, zla.prompty.length], ['BLAD', 0])
})

test('tabela czesci: fazy i pliki tylko liczbami (trafiaja do tytulu PR), SHA w backtickach z recznej tabeli czytelne', () => {
  const dobra = tabela([['1–3', A, B, 93], ['4–6', B, E, 101]])
  assert.equal(P.czesciZTabeli(dobra.replace('| 1–3 |', '| 1–3" && curl x |')), null)
  assert.equal(P.czesciZTabeli(dobra.replace('| 93 |', '| dużo |')), null)
  const reczna = dobra.replace(`| ${A.slice(0, 12)} |`, `| \`${A.slice(0, 12)}\` |`).replace('| 1–3 |', '| **1–3** |')
  assert.deepEqual(P.czesciZTabeli(reczna)?.[0], { czesc: 1, fazy: '1–3', od: A.slice(0, 12), do: B.slice(0, 12), pliki: 93 })
})

test('prog czesci w dev-pr-wf = PROG_PLIKOW_PR z rozmiar.mjs (workflow self-contained)', () => {
  assert.ok(zrodlo.includes(`const PROG_CZESCI = ${PROG_PLIKOW_PR}`))
})

// P22 B3: vibersi etap 4 — rebase czesci 2 stanal na konflikcie tylko w docs/learned-patterns.md (compound czesci 1 na glownej
// i compound zadania), drugi start po recznej regeneracji indeksu przeszedl. Indeks jest generowany — workflow sam go przelicza.
const KONFLIKT_INDEKSU = { ...PRZYG_OK, status: 'KONFLIKT', konflikty: ['docs/learned-patterns.md'], powod: 'CONFLICT (content): Merge conflict in docs/learned-patterns.md', push: false, pushDetal: '' }

test('start --czesc 2: konflikt tylko w indeksie wiedzy → regeneracja (wiedza.mjs indeks, rebase --continue), przygotowanie od nowa, PR', async () => {
  const { wynik, prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [
    { tabela: TABELA_ETAPU_3, galazZadania: true }, KONFLIKT_INDEKSU, { status: 'OK', konflikty: [], regeneracje: 2, powod: null }, PRZYG_OK, START_OK])
  assert.equal(prompty.length, 5)
  assert.match(prompty[2], /wylacznie w docs\/learned-patterns\.md/)
  assert.match(prompty[2], /`git checkout --theirs -- docs\/learned-patterns\.md`, `node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz`/)
  assert.match(prompty[2], /`GIT_EDITOR=true git rebase --continue`/)
  assert.match(prompty[2], /Plik inny niz docs\/learned-patterns\.md na liscie = koniec: status KONFLIKT/)
  assert.equal(prompty[3], prompty[1], 'przygotowanie od nowa tym samym poleceniem')
  assert.deepEqual([wynik.status, wynik.czesc, wynik.prNumer], ['OK', 2, 4])
})

test('start --czesc 2: indeks + inny plik = KONFLIKT bez regeneracji; regeneracja trafia na inny plik = KONFLIKT z ta lista; STOP i null', async () => {
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const oba = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, { ...KONFLIKT_INDEKSU, konflikty: ['docs/learned-patterns.md', 'e2e/smoke.sh'] }])
  assert.deepEqual([oba.wynik.status, oba.prompty.length], ['KONFLIKT', 2])
  const potem = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, KONFLIKT_INDEKSU, { status: 'KONFLIKT', konflikty: ['e2e/smoke.sh'], regeneracje: 1, powod: null }])
  assert.deepEqual([potem.wynik.status, potem.wynik.konflikty, potem.prompty.length], ['KONFLIKT', ['e2e/smoke.sh'], 3])
  assert.match(potem.wynik.powod, /konflikt rebase'u w e2e\/smoke\.sh/)
  const stop = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, KONFLIKT_INDEKSU, { status: 'STOP', konflikty: [], regeneracje: 0, powod: 'wiedza.mjs: kod 1' }])
  assert.deepEqual([stop.wynik.status, stop.wynik.powod], ['STOP', 'regeneracja indeksu wiedzy: wiedza.mjs: kod 1'])
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, KONFLIKT_INDEKSU, null])).wynik.status, 'BLAD')
  // Konflikt indeksu po kazdej regeneracji: limit prob, potem KONFLIKT dla operatora (bez petli).
  const petla = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, KONFLIKT_INDEKSU, { status: 'OK', konflikty: [], regeneracje: 1, powod: null }, KONFLIKT_INDEKSU,
    { status: 'OK', konflikty: [], regeneracje: 1, powod: null }, KONFLIKT_INDEKSU])
  assert.deepEqual([petla.wynik.status, petla.prompty.length], ['KONFLIKT', 6])
  assert.equal(P.tylkoIndeksWiedzy([]), false)
})

// P22 B2: vibersi etap 4 — smoke i oba PR w jednej sesji (4,49 M wobec 1,42 M runow PR). Czesc nieostatnia konczy sie /clear.
const skillPr = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')

test('skill /dev-pr: czesc nieostatnia konczy sie linia „Następny krok: /clear, potem /dev-pr --czesc <N+1>” bez startu kolejnej', () => {
  assert.match(skillPr, /którego ostatnia linia to „Następny krok: \/clear, potem \/dev-pr --czesc <N\+1>”\. Kolejnej części nie uruchamiasz w tej sesji/)
  assert.match(skillPr, /Przy części nieostatniej raport kończy linia „Następny krok: \/clear, potem \/dev-pr --czesc <N\+1>”\./)
  assert.doesNotMatch(skillPr, /dalej: \/dev-pr --czesc N\+1\]/)
})
