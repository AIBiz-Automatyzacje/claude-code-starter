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
   return { odrzucenieUzasadnione, tokenTury, watkiTury, rekomendacja, SUFIT_TUR, tabelaTury, bramkaClaudeMd, PRZYROST_CLAUDE_MD, komendaUzgodnienia, wagaWatku, KLASY_NIE_DEFEKT, czesciZTabeli, planCzesci, claudeMdCzesci, tylkoPlikiGenerowane }`,
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
  assert.match(zrodlo, /required: \['id', 'plik', 'url', 'streszczenie', 'klasa', 'uzasadnienie', 'wplywNaProjekt', 'klasaBledu', 'os', 'waga', 'naszaOdpowiedz'\]/)
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
    blad: null, czesc: 1, czesci: 2, fazy: '1–3', pliki: 93, ostatnia: false, galaz: 'feature/etap-3-cz1', doSha: B.slice(0, 12), rebaseOd: null, poprzednia: null, od: A.slice(0, 12),
  })
  assert.deepEqual(P.planCzesci(dwie, 2, 'etap-3'), {
    blad: null, czesc: 2, czesci: 2, fazy: '4–6', pliki: 101, ostatnia: true, galaz: 'feature/etap-3', doSha: null, rebaseOd: B.slice(0, 12), poprzednia: 'feature/etap-3-cz1', od: B.slice(0, 12),
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
// Pomiar rozmiaru czesci (E5-6) — drugi agent etapu start z --czesc.
const POMIAR = (/** @type {number} */ n) => ({ wynik: JSON.stringify({ baza: 'x', czubek: 'y', doRecenzji: n }) })
const START_OK = { bramka: 'OK', branch: 'feature/etap-3', prUtworzony: true, prNumer: 4, prUrl: 'u', headRefOid: 'abc' }

test('start --czesc 2 z 2: odczyt tabeli, rebase galezi zadania od 909f669 na origin/main, push z lease, tytul czesci; wynik niesie czesc', async () => {
  const { wynik, prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, POMIAR(121), PRZYG_OK, START_OK])
  assert.equal(prompty.length, 4)
  assert.match(prompty[0], /git show 'feature\/etap-3:docs\/completed\/etap-3\/etap-3-podsumowanie\.md' \| awk/)
  assert.match(prompty[2], /git switch feature\/etap-3`, `git fetch --prune origin`/)
  assert.match(prompty[2], /--head feature\/etap-3-cz1 --json number/)
  assert.match(prompty[2], /is-ancestor 909f669f0efc HEAD` kod 0 — `git rebase --onto origin\/main 909f669f0efc`/)
  assert.match(prompty[2], /\(c\) inaczej .* `git rebase origin\/main`, rebase=wykonany/)
  assert.match(prompty[2], /git push --force-with-lease --force-if-includes -u origin feature\/etap-3`/)
  assert.match(prompty[2], /5\. WALIDACJA \(tylko gdy rebase=wykonany albo juz-wykonany\): typecheck i testy/)
  assert.match(prompty[3], /tytul PR "<tytul zadania> — cz\. 2 z 2 \(fazy 4–6\)"/)
  assert.match(prompty[3], /git show 'feature\/etap-3:docs\/completed\/etap-3\/known-issues\.md'/)
  assert.deepEqual([wynik.status, wynik.czesc, wynik.czesci, wynik.fazy, wynik.prNumer], ['OK', 2, 2, '4–6', 4])
})

test('start --czesc 1: galaz -cz1 od commitu ciecia bez rebase; konflikt i zla galaz zatrzymuja przed PR; brak tabeli = STOP bez przygotowania', async () => {
  const cz1 = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, POMIAR(121), { ...PRZYG_OK, galaz: 'feature/etap-3-cz1', rebase: 'nie-dotyczy', walidacja: 'nie-dotyczy' }, START_OK])
  assert.match(cz1.prompty[2], /git fetch --prune origin`.*`git switch -c feature\/etap-3-cz1 909f669f0efc`/s)
  assert.doesNotMatch(cz1.prompty[2], /git rebase --onto/)
  assert.match(cz1.prompty[3], /kolejne części po merge'u tej/)
  assert.equal(cz1.wynik.czesc, 1)
  const konflikt = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, POMIAR(121),
    { ...PRZYG_OK, status: 'KONFLIKT', konflikty: ['e2e/etap-4-moderacja-smoke.sh'], powod: 'CONFLICT (content)', push: false, pushDetal: '' }])
  assert.equal(konflikt.prompty.length, 3, 'bez agenta tworzacego PR')
  assert.deepEqual([konflikt.wynik.status, konflikt.wynik.konflikty], ['KONFLIKT', ['e2e/etap-4-moderacja-smoke.sh']])
  assert.match(konflikt.wynik.naprawa, /git rebase --continue` \(do konca rebase.u\), potem \/dev-pr --czesc 2; albo `git rebase --abort`/)
  const zlaGalaz = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }, POMIAR(121), { ...PRZYG_OK, galaz: 'main' }])
  assert.deepEqual([zlaGalaz.wynik.status, zlaGalaz.wynik.powod, zlaGalaz.prompty.length], ['STOP', 'biezaca galaz main, oczekiwana feature/etap-3', 3])
  const bezTabeli = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: '', galazZadania: true }])
  assert.deepEqual([bezTabeli.wynik.status, bezTabeli.prompty.length], ['STOP', 1])
})

test('claude-md czesci 1 z 2 bez agenta; zbierz oddaje czesc do telemetrii', async () => {
  const cm = await uruchom({ etap: 'claude-md', zadanie: 'etap-3', czesc: 1, czesci: 2 }, [])
  assert.deepEqual([cm.wynik.status, cm.wynik.pominiety, cm.prompty.length], ['OK', true, 0])
  const zb = await uruchom({ etap: 'zbierz', zadanie: 'etap-3', tura: 1, czesc: 2, czesci: 2 }, [{
    watki: [], prNumer: 4, headRefOid: 'abc', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', ciZielone: true, ciDetal: 'brak CI', recenzjaAktualna: true, plikiPr: 194,
  }])
  assert.deepEqual([zb.wynik.czesc, zb.wynik.prNumer, zb.wynik.rekomendacja, zb.wynik.headRefOid], [2, 4, 'MERGUJ', 'abc'], 'czubek PR do telemetrii (ucieczki, E5-20)')
})

test('start bez --czesc przy tabeli czesci = STOP z /dev-pr --czesc 1; bez tabeli — zwykly PR', async () => {
  const z = await uruchom({ etap: 'start', zadanie: 'etap-3' }, [{ tabela: TABELA_ETAPU_3, galazZadania: true }])
  assert.deepEqual([z.wynik.status, z.prompty.length], ['STOP', 1])
  assert.match(z.wynik.powod, /zadanie ma 2 części PR .* \/dev-pr --czesc 1/)
  const jeden = await uruchom({ etap: 'start', zadanie: 'etap-3' }, [{ tabela: '', galazZadania: true }, POMIAR(140), START_OK])
  assert.deepEqual([jeden.wynik.status, jeden.prompty.length, jeden.wynik.czesc], ['OK', 3, undefined])
  assert.doesNotMatch(jeden.prompty[2], /CZESC \d/)
})

// vibersi etap 6a (2026-10-28): galaz na origin 3 commity za lokalna (smoke, poprawki P3 i krotkiego review) — bramka bez
// kroku pushu dala STOP („polecenie zabrania mi pushowania”), a PR z origin pokazalby kod bez poprawek.
test('start jednego PR: gałąź wypychana przed PR bez --force (brak zdalnej albo lokalna przed), rozjazd z origin = STOP', async () => {
  const { prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3' }, [{ tabela: '', galazZadania: true }, POMIAR(140), START_OK])
  const bramka = prompty[2]
  assert.match(bramka, /GALAZ NA GITHUBIE[\s\S]*`git push -u origin <galaz>`[\s\S]*bez --force/)
  assert.match(bramka, /zdalna ma commity, ktorych lokalna nie ma[\s\S]*STOP/)
  assert.match(bramka, /blad pushu = bramka STOP/i)
  assert.doesNotMatch(bramka, /Nie pushuj, nie mergeuj/)
  assert.ok(bramka.indexOf('GALAZ NA GITHUBIE') < bramka.indexOf('STAN PULL REQUESTA'), 'push przed odczytem i utworzeniem PR')
})

test('start --czesc: brak galezi zadania, walidacja FAIL po rebase, push false = STOP; null agentow = BLAD; zla nazwa zadania = BLAD bez agentow', async () => {
  const bezGalezi = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [{ tabela: '', galazZadania: false }])
  assert.equal(bezGalezi.wynik.powod, 'brak lokalnej gałęzi feature/etap-3 — tabela części i commity cięcia są na niej (git fetch, git switch feature/etap-3)')
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const fail = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), { ...PRZYG_OK, walidacja: 'FAIL', walidacjaDetal: 'vitest 3 failed' }])
  assert.deepEqual([fail.wynik.status, fail.wynik.powod, fail.prompty.length], ['STOP', "walidacja po rebase'ie FAIL: vitest 3 failed", 3])
  const push = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), { ...PRZYG_OK, push: false, pushDetal: 'rejected (stale info)' }])
  assert.equal(push.wynik.powod, 'push: rejected (stale info)')
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [null])).wynik.status, 'BLAD')
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), null])).wynik.status, 'BLAD')
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
    { tabela: TABELA_ETAPU_3, galazZadania: true }, POMIAR(121), KONFLIKT_INDEKSU, { status: 'OK', konflikty: [], regeneracje: 2, powod: null }, PRZYG_OK, START_OK])
  assert.equal(prompty.length, 6)
  assert.match(prompty[3], /wylacznie w plikach generowanych: docs\/learned-patterns\.md \(indeks z docs\/solutions\/\)\nalbo supabase\/migrations\.sum/)
  assert.match(prompty[3], /`git checkout --theirs -- docs\/learned-patterns\.md`, `node \.claude\/scripts\/wiedza\/wiedza\.mjs indeks --zapisz`/)
  assert.match(prompty[3], /^4\. `GIT_EDITOR=true git rebase --continue`; regeneracje \+ 1\./m)
  assert.match(prompty[3], /Plik inny niz docs\/learned-patterns\.md i supabase\/migrations\.sum na liscie = koniec: status KONFLIKT/)
  assert.match(prompty[3], /^Powtarzaj, dopoki rebase trwa/m)
  assert.match(prompty[3], /Nie zmieniasz innych plikow i nie pushujesz/)
  assert.match(prompty[3], /o zapisie mowi pole `zapisany` JSON-a, nie kod wyjscia/)
  assert.match(prompty[3], /^5\. Polecenie git z krokow 2–4 z kodem rozny od 0 bez nowego konfliktu = status STOP/m)
  assert.match(prompty[2], /Rebase w toku z konfliktami [\s\S]*? = status KONFLIKT z ta lista/)
  assert.equal(prompty[4], prompty[2], 'przygotowanie od nowa tym samym poleceniem')
  assert.deepEqual([wynik.status, wynik.czesc, wynik.prNumer], ['OK', 2, 4])
})

test('start --czesc 2: indeks + inny plik = KONFLIKT bez regeneracji; regeneracja trafia na inny plik = KONFLIKT z ta lista; STOP i null', async () => {
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const oba = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), { ...KONFLIKT_INDEKSU, konflikty: ['docs/learned-patterns.md', 'e2e/smoke.sh'] }])
  assert.deepEqual([oba.wynik.status, oba.prompty.length], ['KONFLIKT', 3])
  const potem = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), KONFLIKT_INDEKSU, { status: 'KONFLIKT', konflikty: ['e2e/smoke.sh'], regeneracje: 1, powod: null }])
  assert.deepEqual([potem.wynik.status, potem.wynik.konflikty, potem.prompty.length], ['KONFLIKT', ['e2e/smoke.sh'], 4])
  assert.match(potem.wynik.powod, /konflikt rebase'u w e2e\/smoke\.sh/)
  const stop = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), KONFLIKT_INDEKSU, { status: 'STOP', konflikty: [], regeneracje: 0, bramkaIndeksu: false, powod: 'git add: kod 128' }])
  assert.deepEqual([stop.wynik.status, stop.wynik.powod], ['STOP', 'regeneracja plikow generowanych: git add: kod 128'])
  assert.match(stop.wynik.naprawa, /^Rebase w toku\. `git rebase --abort` wraca stan sprzed części; .*potem \/dev-pr --czesc 2\.$/)
  // STOP przygotowania z konfliktem indeksu na liscie (np. brudne drzewo) — bez regeneracji.
  const przygStop = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), { ...KONFLIKT_INDEKSU, status: 'STOP', powod: 'brudne drzewo' }])
  assert.deepEqual([przygStop.wynik.status, przygStop.prompty.length], ['STOP', 3])
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), KONFLIKT_INDEKSU, null])).wynik.status, 'BLAD')
  // Konflikt indeksu po kazdej regeneracji: limit prob, potem KONFLIKT dla operatora (bez petli).
  const petla = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), KONFLIKT_INDEKSU, { status: 'OK', konflikty: [], regeneracje: 1, powod: null }, KONFLIKT_INDEKSU,
    { status: 'OK', konflikty: [], regeneracje: 1, powod: null }, KONFLIKT_INDEKSU])
  assert.deepEqual([petla.wynik.status, petla.prompty.length], ['KONFLIKT', 7])
  assert.equal(P.tylkoPlikiGenerowane([]), false)
})

// P23 (pilot P22 B3): po przeliczeniu indeksu rebase czesci 2 vibersi stanal na konflikcie w supabase/migrations.sum — obie
// strony dopisaly sumy nowych migracji. Suma jest scalana skryptem (wpisy obu stron), wynik `scalony: false` idzie do operatora.
const KONFLIKT_SUMY = { ...KONFLIKT_INDEKSU, konflikty: ['supabase/migrations.sum'], powod: 'CONFLICT (content): Merge conflict in supabase/migrations.sum' }

test('start --czesc 2: konflikt w sumie migracji (sam albo z indeksem) → bramki.mjs --scal-sume, rebase --continue, przygotowanie od nowa', async () => {
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  for (const konflikty of [['supabase/migrations.sum'], ['docs/learned-patterns.md', 'supabase/migrations.sum']]) {
    const { wynik, prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [
      tab, POMIAR(121), { ...KONFLIKT_SUMY, konflikty }, { status: 'OK', konflikty: [], regeneracje: 1, bramkaIndeksu: false, powod: null }, PRZYG_OK, START_OK])
    assert.equal(prompty.length, 6)
    assert.match(prompty[3], /^2\. supabase\/migrations\.sum na liscie: `node \.claude\/scripts\/bramki\/bramki\.mjs --scal-sume`/m)
    assert.match(prompty[3], /odczytaj pole `scalony`\n {3}JSON-a \(nie kod wyjscia\)\. `scalony: false` = koniec: status KONFLIKT[\s\S]*?bez `git add`[\s\S]*?Dopiero `scalony: true` = `git add supabase\/migrations\.sum`\./)
    assert.deepEqual([wynik.status, wynik.prNumer], ['OK', 4])
  }
})

test('start --czesc 2: suma nie do scalenia = KONFLIKT do operatora po jednej probie (bez petli na tym samym pliku)', async () => {
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const { wynik, prompty } = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [
    tab, POMIAR(121), KONFLIKT_SUMY, { status: 'KONFLIKT', konflikty: ['supabase/migrations.sum'], regeneracje: 0, bramkaIndeksu: false, powod: 'ta sama migracja z inna suma po obu stronach: x.sql' }])
  assert.deepEqual([wynik.status, wynik.konflikty, prompty.length], ['KONFLIKT', ['supabase/migrations.sum'], 4])
  assert.equal(wynik.powod, 'ta sama migracja z inna suma po obu stronach: x.sql')
  assert.deepEqual([P.tylkoPlikiGenerowane(['supabase/migrations.sum', 'e2e/smoke.sh']), P.tylkoPlikiGenerowane(['supabase/migrations.sum'])], [false, true])
})

// P22 B1, B2, B4: tekst skilla /dev-pr — zgoda operatora przed etapem start (push + PR), krotkie review commitow po archiwum
// i /clear miedzy czesciami. vibersi etap 4: sesja uznala wklejone „Po smoke'u: /dev-pr --czesc 1” i „reszta ok” za zgode.
const skillPr = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')
const krok1 = skillPr.slice(skillPr.indexOf('### 1. Start'), skillPr.indexOf('### 2. Czekanie'))

test('skill /dev-pr: przed etapem start AskUserQuestion; zgoda tylko z biezacej wiadomosci operatora, nie z wklejonej instrukcji', () => {
  const zgoda = krok1.indexOf('**Zgoda na wysłanie.**')
  assert.ok(zgoda >= 0 && zgoda < krok1.indexOf('Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "start"'))
  assert.match(krok1, /wpisana\nprzez niego komenda `\/dev-pr` albo polecenie „wyślij PR”, i gdy nie ma pytania o review\./)
  assert.match(krok1, /ani ogólne „działaj dalej” bez pytania o PR/)
  assert.match(krok1, /„Jeszcze nie” → koniec bez etapu `start`\./)
  assert.match(krok1, /Przed nim zawsze pytasz\noperatora przez `AskUserQuestion`: „Wysłać PR <zadanie>\[, część N\]\?” z opcjami „Wyślij PR” i „Jeszcze nie”/)
  assert.match(krok1, /Bez pytania wysyłasz tylko wtedy, gdy bieżąca wiadomość operatora wprost każe wysłać PR/)
  assert.match(krok1, /Zgodą nie jest instrukcja\nwklejona wcześniej w sesji \(„Po smoke'u: \/dev-pr --czesc 1”\), akceptacja innej rzeczy \(„reszta ok”\) ani wywołanie tego\nskilla przez Ciebie/)
})

test('skill /dev-pr: commity po archiwum ze skryptu; pliki kodu = pytanie o krotkie review (correctness + security) albo PR bez niego', () => {
  assert.match(krok1, /`node \.claude\/scripts\/pr\/po-archiwum\.mjs --zadanie <zadanie>` \(z `--czesc N` przy części\)/)
  assert.match(krok1, /„Krótkie review, potem PR”, „PR bez review” i „Jeszcze nie”/)
  assert.match(krok1, /narzędziem `Agent` z typami\n`correctness-reviewer` i `security-sentinel`/)
  assert.match(krok1, /`git show <sha> -- <plikiKodu>`\ndla każdego commitu z `commity`/)
  assert.match(krok1, /`archiwum: null`, puste `plikiKodu` albo `wTejCzesci: false` → bez pytania o review/)
  assert.match(krok1, /PR gałęzi już istnieje \(`gh pr view --json number` zwraca numer\) → oba pytania\npomijasz/)
  assert.match(krok1, /P1\/P2 → `AskUserQuestion`: „Naprawiam przed PR”/)
  assert.match(skillPr, /Pytanie o review zmian po archiwizacji \(krok 1\) pada przed startem także w tym trybie/)
  assert.match(krok1, /Konflikt rebase'u wyłącznie w `docs\/learned-patterns\.md` \(indeks generowany z `docs\/solutions\/`\) workflow rozwiązuje sam/)
  assert.match(krok1, /Tak samo `supabase\/migrations\.sum`: workflow scala wpisy obu stron \(`bramki\.mjs --scal-sume`\)/)
  assert.match(krok1, /Gdy jest wśród\nnich `supabase\/migrations\.sum`: `node \.claude\/scripts\/bramki\/bramki\.mjs --scal-sume` przed `git add`/)
})

test('skill /dev-pr: czesc nieostatnia konczy sie linia „Następny krok: /clear, potem /dev-pr --czesc <N+1>” bez startu kolejnej', () => {
  assert.match(skillPr, /którego ostatnia linia to „Następny krok: \/clear, potem \/dev-pr --czesc <N\+1>”\. Kolejnej części nie uruchamiasz w tej sesji/)
  assert.match(skillPr, /Przy części nieostatniej raport kończy linia „Następny krok: \/clear, potem \/dev-pr --czesc <N\+1>”\./)
  assert.doesNotMatch(skillPr, /dalej: \/dev-pr --czesc N\+1\]/)
})

// E5-6 (vibersi etap 5, cz. 3): tabela czesci liczy pliki przy archiwizacji (122), commity smoke'u po archiwum doszly do
// ostatniej czesci (152 > limit bota) — bot pominal recenzje, a poprawka Turnstile nie weszla na main. Start przelicza
// rozmiar czubka czesci skryptem przed przygotowaniem galezi; >= progu = STOP z liczba i dwiema drogami.

test('start --czesc: rozmiar czubka czesci przeliczany rozmiar.mjs przed przygotowaniem; >= 150 = STOP z liczba i dwiema drogami', async () => {
  const tab = { tabela: tabela([['1–3', A, B, 93], ['4–6', B, E, 122]]), galazZadania: true }
  const duza = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, POMIAR(152)])
  assert.equal(duza.prompty.length, 2, 'bez przygotowania galezi i bez PR')
  assert.match(duza.prompty[1], /node \.claude\/scripts\/pr\/rozmiar\.mjs --baza <BAZA> --czubek feature\/etap-5`/)
  assert.match(duza.prompty[1], new RegExp(`git merge-base --is-ancestor ${B.slice(0, 12)} feature/etap-5\` kod 0 -> BAZA=${B.slice(0, 12)}`))
  assert.deepEqual([duza.wynik.status, duza.wynik.czesc, duza.wynik.rozmiar], ['STOP', 2, { pliki: 152, tabela: 122, prog: 150 }])
  assert.match(duza.wynik.powod, /^część 2 ma 152 plików do recenzji \(tabela przy archiwizacji: 122, limit bota 150\)/)
  assert.match(duza.wynik.powod, /Dodatkowa część z cięciem na commicie archiwizacji .*wiersz części 2 kończy się na nim, nowy wiersz 3 od niego do czubka gałęzi.*\/dev-pr --czesc 2$/s)
  assert.doesNotMatch(duza.wynik.powod, /osobnym PR/, 'droga bez mechaniki w pipeline (recenzja P2-3)')
  const cz1 = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 1 }, [tab, POMIAR(93)])
  assert.match(cz1.prompty[1], new RegExp(`--czubek ${B.slice(0, 12)}\``), 'czesc nieostatnia: czubek = commit ciecia')
  const ok = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, POMIAR(149), { ...PRZYG_OK, galaz: 'feature/etap-5' }, START_OK])
  assert.deepEqual([ok.wynik.status, ok.prompty.length], ['OK', 4])
  const granica = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, POMIAR(150)])
  assert.deepEqual([granica.wynik.status, granica.prompty.length], ['STOP', 2], 'próg ≥ 150')
  const zLogiem = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, { wynik: `ostrzezenie\n${POMIAR(152).wynik}` }])
  assert.equal(zLogiem.wynik.rozmiar.pliki, 152, 'ostatnia linia stdout')
  assert.match(duza.prompty[1], /inaczej BAZA = stdout `git merge-base origin\/main feature\/etap-5`\./)
  for (const zly of [{ wynik: '{"wyjatek":"nie ma commita feature/etap-5"}' }, { wynik: '' }]) {
    const r = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, zly])
    assert.deepEqual([r.wynik.status, r.prompty.length], ['STOP', 2])
    assert.match(r.wynik.powod, /pomiar rozmiaru części 2 nieczytelny/)
  }
  const tekst = await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, { wynik: '{"doRecenzji":"152"}' }])
  assert.match(tekst.wynik.powod, /brak liczbowego pola doRecenzji/)
  // Czesc srodkowa (N > 1, nieostatnia): czubek = commit ciecia, nie galaz zadania.
  const trzy = { tabela: tabela([['1–3', A, B, 93], ['4', B, D, 40], ['5–6', D, E, 70]]), galazZadania: true }
  const srodek = await uruchom({ etap: 'start', zadanie: 'z', czesc: 2 }, [trzy, POMIAR(160)])
  assert.match(srodek.prompty[1], new RegExp(`--czubek ${D.slice(0, 12)}\``))
  assert.equal((await uruchom({ etap: 'start', zadanie: 'etap-5', czesc: 2 }, [tab, null])).wynik.status, 'BLAD')
})

test('skill /dev-pr: STOP rozmiaru czesci = pytanie operatora o droge (osobny PR commitow po archiwum albo dodatkowa czesc)', () => {
  assert.match(krok1, /`status: "STOP"` z polem `rozmiar`/)
  assert.match(krok1, /opcjami „Dodatkowa część” i „Jeszcze nie”/)
  assert.match(krok1, /cięcie na commicie archiwizacji \(pole `archiwum`\nz `po-archiwum\.mjs`\)/)
  assert.doesNotMatch(krok1, /osobnym PR/, 'droga bez mechaniki w pipeline (recenzja P2-3)')
  // P3-6: P3 krotkiego review w sekcji liczonej przy czesci ostatniej (filtr czesci czyta sekcje, nie caly plik).
  assert.match(krok1, /w sekcji `## P3 po archiwizacji`/)
  assert.match(krok1, /przy części\nostatniej, sekcja `## P3 po archiwizacji`/)
})

// E5-5 (vibersi PR #9): watek „Major” odlozony „do cz. 3” zostal otwarty na zmergowanym PR — sufit tur i odlozenie do
// kolejnej czesci nie mialy nosnika. Start czesci N > 1 zbiera nierozwiazane watki PR czesci 1..N-1 (opis PR i wynik),
// compound zapisuje odlozone watki do known-issues.md zadania z linkiem.
test('start --czesc 2: krok „otwarte watki czesci 1” (isResolved:false na PR feature/<zadanie>-cz1) w opisie PR i w wyniku; czesc 1 bez kroku', async () => {
  const tab = { tabela: TABELA_ETAPU_3, galazZadania: true }
  const watek = { pr: 3, plik: 'src/a.ts:10', streszczenie: 'brak limitu', url: 'https://github.com/o/r/pull/3#discussion_r1' }
  const cz2 = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 2 }, [tab, POMIAR(121), PRZYG_OK, { ...START_OK, otwarteWatkiPoprzednich: [watek] }])
  assert.match(cz2.prompty[3], /OTWARTE WATKI POPRZEDNICH CZESCI/)
  assert.match(cz2.prompty[3], /gh pr list --state merged --head feature\/etap-3-cz1 --json number,url/)
  assert.match(cz2.prompty[3], /isResolved:false/)
  assert.match(cz2.prompty[3], /## Otwarte wątki poprzednich części/)
  assert.deepEqual(cz2.wynik.otwarteWatkiPoprzednich, [watek])
  const cz1 = await uruchom({ etap: 'start', zadanie: 'etap-3', czesc: 1 }, [tab, POMIAR(93), { ...PRZYG_OK, galaz: 'feature/etap-3-cz1', rebase: 'nie-dotyczy', walidacja: 'nie-dotyczy' }, START_OK])
  assert.doesNotMatch(cz1.prompty[3], /OTWARTE WATKI POPRZEDNICH CZESCI/)
})

test('compound: odlozone watki (sufit, „do czesci N+1”) → known-issues.md zadania z linkiem watku; skill przekazuje odlozone i pyta z lista przy --czesc N+1', async () => {
  const odl = [{ plik: 'src/a.ts:10', streszczenie: 'Major: brak limitu', url: 'https://github.com/o/r/pull/9#discussion_r2' }]
  const { prompty } = await uruchom({ etap: 'compound', zadanie: 'etap-5', watki: [], odlozone: odl }, [{ wpisy: [], odmowy: [], indeks: 'bez zmian', propozycjeDoReviewerow: [], plikPropozycji: null, commit: null, push: false, pushDetal: 'brak commita' }])
  assert.match(prompty[0], /docs\/completed\/etap-5\/known-issues\.md/)
  assert.match(prompty[0], /pull\/9#discussion_r2/)
  const bez = await uruchom({ etap: 'compound', zadanie: 'etap-5', watki: [] }, [{ wpisy: [], odmowy: [], indeks: 'bez zmian', propozycjeDoReviewerow: [], plikPropozycji: null, commit: null, push: false, pushDetal: 'brak commita' }])
  assert.doesNotMatch(bez.prompty[0], /WATKI ODLOZONE/)
  assert.match(skillPr, /odlozone: <wątki otwarte po suficie albo odłożone do kolejnej części/)
  assert.match(krok1, /`--czesc N` > 1: przed pytaniem o zgodę .*isResolved:false/s)
})

// E5-9 (vibersi etap 5): 3 P3 z krotkiego review commitow po archiwum trafily tylko do opisu PR — etap 6 ich nie widzi.
test('skill /dev-pr: P3 krotkiego review → known-issues.md zadania i commit artefaktu przed etapem start', () => {
  const krotkie = krok1.slice(krok1.indexOf('**Krótkie review**'), krok1.indexOf('Workflow({scriptPath'))
  assert.match(krotkie, /P3 \(i findingi zostawione przy „PR z findingami w opisie”\) dopisujesz do\n?\s*`docs\/completed\/<zadanie>\/known-issues\.md`/)
  assert.match(krotkie, /commit tego pliku jawną ścieżką przed etapem `start`/)
})

// E5-2(b) (vibersi etapy 3–5): P3 z realnym scenariuszem wracal od bota jako P2 (≥ 1 na etap). Przed PR operator widzi
// P3 osi correctness/security z known-issues faz tej czesci i decyduje o naprawie — bez auto-naprawy (P8 bez zmian).
test('skill /dev-pr: przed zgoda P3 osi correctness/security z known-issues faz czesci → pytanie „Naprawić przed PR (N)” z lista', () => {
  const p3 = krok1.slice(krok1.indexOf('**P3 z realnym scenariuszem.**'), krok1.indexOf('**Zgoda na wysłanie.**'))
  assert.ok(p3.length > 0, 'akapit przed zgoda')
  assert.match(p3, /grep -E '\^- 🟡 \\\[P3\/\(correctness\|security\)\\\]'/)
  assert.match(p3, /sekcje `## P3 faza K` dla faz tej części/)
  assert.match(p3, /„Naprawić przed PR \(N\)”/)
  assert.match(p3, /Bez wyboru operatora niczego nie naprawiasz/)
})

// E5-4(b) (vibersi PR #9): seedy w 4 rundach — „szerzej” poprawialo zarzut w plikach PR, nie regule na wszystkich plikach
// klasy; kazda runda bota znajdowala kolejny plik. Naprawa szerzej = lista kontrolna calej reguly na wszystkich plikach
// klasy w repo (glob), a odpowiedz w watku wymienia sprawdzone pliki.
test('napraw: napraw-szerzej = cala regula klasy na WSZYSTKICH plikach klasy w repo (glob), odpowiedz wymienia sprawdzone pliki', async () => {
  const token = P.tokenTury(1, SHA)
  const watek = { id: 'T1', token, klasa: 'napraw-szerzej', plik: 'e2e/seeds/a-seed.sql:4', streszczenie: 'seed bez kolumny', uzasadnienie: 'glob e2e/seeds/*-seed.sql', klaster: null }
  const { prompty } = await uruchom({ etap: 'napraw', zadanie: 'etap-5', tura: 1, token, watki: [watek] }, [
    { naprawione: ['T1'], odrzucone: [], nieruszone: [], walidacja: 'PASS', walidacjaDetal: 'ok', odpowiedziWyslane: 1, commit: 'abc', push: true, plikiBinarne: [] }])
  assert.match(prompty[0], /wszystkie pliki klasy w repo/)
  assert.match(prompty[0], /git ls-files '<glob>'/)
  assert.match(prompty[0], /lista kontrolna calej reguly/)
  assert.match(prompty[0], /odpowiedz w watku wymienia sprawdzone pliki/)
  const klasyfikacja = wytnij('| \\`napraw-szerzej\\` |', '|\n')
  assert.match(klasyfikacja, /glob plikow klasy/)
})

// E5-8 (vibersi etap 5): `test:scripts` i runnery shell poza walidacja — 2 testy padly poza PR. Walidacja = `test` i kazdy
// `test:*` bez `e2e` w nazwie, w dev-pr (naprawa, rebase czesci) i w walidacji koncowej autopilota.
test('walidacja: test i kazdy test:* bez e2e w nazwie — blok komend dev-pr i walidacja koncowa autopilota', () => {
  const blok = wytnij('const BLOK_KOMEND_PROJEKTU = `', '=== KONIEC BLOKU KOMEND ===`')
  const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
  const koncowa = autopilot.slice(autopilot.indexOf('function finalValidationPrompt('), autopilot.indexOf('KROK 3 — AUDYT TESTOW'))
  for (const [nazwa, tekst] of [['dev-pr', blok], ['autopilot', koncowa]]) {
    assert.match(tekst, /skrypt \\`test\\` ORAZ kazdy skrypt \\`test:\*\\` bez \\`e2e\\` w nazwie/, nazwa)
    assert.match(tekst, /test:scripts/, nazwa)
  }
})

// E5-10 (vibersi etap 5): CLAUDE.md opisal zmienna wymagana warunkowo (tryb produkcyjny) jako opcjonalna — etap claude-md
// przepisal fakt z pliku decyzji bez sprawdzenia walidatora konfiguracji.
test('claude-md: fakt o zmiennej srodowiska — wymagalnosc z walidatora konfiguracji (plik:linia) z warunkiem trybu', async () => {
  const { prompty } = await uruchom({ etap: 'claude-md', zadanie: 'etap-5' }, [null])
  const krok5 = prompty[0].slice(prompty[0].indexOf('5. Gdy fakty[]'), prompty[0].indexOf('6. znPo'))
  assert.match(krok5, /zmiennej srodowiska/)
  assert.match(krok5, /walidatora konfiguracji \(plik:linia\)/)
  assert.match(krok5, /wymagana warunkowo/)
})

// Recenzja S1 (P2-2, P3-1, P3-2 i przezyte mutanty): jeden PR bez tabeli czesci tez ma bramke rozmiaru (smoke po archiwum
// przesuwa go ponad limit tak samo); watki poprzednich czesci tylko z --czesc; url watku w zapytaniu i schemacie.
test('start bez --czesc: rozmiar HEAD od merge-base z origin/main; >= 150 = STOP z podzialem na dwie czesci, bez PR', async () => {
  const duzy = await uruchom({ etap: 'start', zadanie: 'etap-5' }, [{ tabela: '', galazZadania: true }, POMIAR(152)])
  assert.deepEqual([duzy.wynik.status, duzy.prompty.length, duzy.wynik.rozmiar], ['STOP', 2, { pliki: 152, tabela: null, prog: 150 }])
  assert.match(duzy.prompty[1], /BAZA = stdout `git merge-base origin\/main HEAD`\./)
  assert.match(duzy.prompty[1], /rozmiar\.mjs --baza <BAZA> --czubek HEAD`/)
  assert.match(duzy.wynik.powod, /^PR ma 152 plików do recenzji \(limit bota 150\).*część 1 od bazy do niego, część 2 od niego do czubka gałęzi.*\/dev-pr --czesc 1$/s)
})

test('start bez --czesc: otwarteWatkiPoprzednich od agenta nie wywraca etapu (log tylko przy czesci)', async () => {
  const w = await uruchom({ etap: 'start', zadanie: 'etap-5' }, [{ tabela: '', galazZadania: true }, POMIAR(10),
    { ...START_OK, otwarteWatkiPoprzednich: [{ pr: 1, plik: 'a', streszczenie: 'b', url: 'c' }] }])
  assert.equal(w.wynik.status, 'OK')
})

test('start --czesc 3: watki PR obu poprzednich czesci; czesc srodkowa tez je zbiera; url w zapytaniu GraphQL i w schemacie watku', async () => {
  const trzy = { tabela: tabela([['1–3', A, B, 93], ['4', B, D, 40], ['5–6', D, E, 70]]), galazZadania: true }
  const cz3 = await uruchom({ etap: 'start', zadanie: 'z', czesc: 3 }, [trzy, POMIAR(70), { ...PRZYG_OK, galaz: 'feature/z' }, START_OK])
  assert.match(cz3.prompty[3], /--head feature\/z-cz1 --json number,url/)
  assert.match(cz3.prompty[3], /--head feature\/z-cz2 --json number,url/)
  const cz2 = await uruchom({ etap: 'start', zadanie: 'z', czesc: 2 }, [trzy, POMIAR(40), { ...PRZYG_OK, galaz: 'feature/z-cz2' }, START_OK])
  assert.match(cz2.prompty[3], /OTWARTE WATKI POPRZEDNICH CZESCI: .*--head feature\/z-cz1 /)
  assert.match(zrodlo, /comments\(first:20\) \{ nodes \{ author \{ login \} body createdAt url \} \}/)
  const zebrane = wytnij('const ZEBRANE = {', '\n}\n')
  assert.match(zebrane, /url: \{ type: 'string'/)
  assert.match(zebrane, /required: \['id', 'plik', 'url',/)
})

test('compound z odlozonymi: known-issues.md zadania w pathspec commitu (inaczej dopisane watki zostaja poza commitem)', async () => {
  const { prompty } = await uruchom({ etap: 'compound', zadanie: 'etap-5', watki: [], odlozone: [{ plik: 'a', streszczenie: 'b', url: 'c' }] },
    [{ wpisy: [], odmowy: [], indeks: 'bez zmian', propozycjeDoReviewerow: [], plikPropozycji: null, commit: null, push: false, pushDetal: 'brak commita' }])
  const krok5 = prompty[0].slice(prompty[0].indexOf('5. Zacommituj'), prompty[0].indexOf('6. '))
  assert.match(krok5, /docs\/completed\/etap-5\/known-issues\.md/)
  assert.match(prompty[0], /Gdy katalog docs\/completed\/etap-5\/ istnieje w drzewie/)
})
