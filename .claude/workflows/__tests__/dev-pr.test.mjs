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
   return { odrzucenieUzasadnione, tokenTury, watkiTury, rekomendacja, SUFIT_TUR, tabelaTury, bramkaClaudeMd, PRZYROST_CLAUDE_MD, komendaUzgodnienia }`,
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
