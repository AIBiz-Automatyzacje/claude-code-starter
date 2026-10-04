// Test: findingi z przerwanego review NIE przepadaja, gdy faza jest reviewowana ponownie.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/findingi-po-stopie.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
//
// DLACZEGO TEN TEST ISTNIEJE (audyt powdrozeniowy 2026-09-06, znalezisko N2):
// przy blokerze srodowiska i przy padzie testera E2E `faza.review` CELOWO zostaje `pending` — findingi
// E2E powstaly na zepsutym srodowisku i po naprawie wymagaja powtorki. Ale powtorka nadpisywala
// `faza.otwarteFindingi` wynikiem nowego review, wiec przepadal caly dorobek reviewerow o KODZIE,
// ktory z awaria srodowiska nie mial nic wspolnego.
//
// Dowod z produkcji (oferty-online, faza 6):
//   przed STOP:  20 findingow, raport 21 096 B (5x P2 KOD/TEST, 2x P2 OPERATOR, 13x P3)
//   po powtorce:  5 findingow, raport  8 457 B (5x P2, 0x P3, 0x OPERATOR)
// Jedenascie P3 typu KOD/TEST zniknelo bezpowrotnie — dokladnie ta klasa, ktora plan B1 wlasnie
// zaczal naprawiac. Koszt zdarzenia: 79k tokenow powtorzonego review plus utrata pracy.
//
// Zasada, ktora ten test przypina: powtarzamy OCENE srodowiska, nie ocene kodu.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

// Ekstrakcja ze zrodla — workflowy sa skryptami runtime'u Workflow, `import()` ich nie zaladuje.
// `new Function` z interpolacja jest tu bezpieczny: wklejamy fragment z pliku w tym repo, nie z inputu.
/**
 * @param {string} kotwica
 * @param {string} koniec
 * @param {string} opis
 * @returns {string}
 */
function wytnij(kotwica, koniec, opis) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu (${opis}) wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca ${opis}`)
  return zrodlo.slice(start, stop + koniec.length)
}

// `log` jest globalna runtime'u Workflow — w Node jej nie ma, wiec podstawiamy szpiega. Przy okazji
// mozemy sprawdzic, ze operator w ogole dostaje informacje o przeniesieniu (cicha naprawa jest gorsza
// od zadnej: nikt by nie wiedzial, skad na liscie fixa wziely sie findingi sprzed STOP-u).
/** @type {string[]} */
const logi = []
/** @typedef {import('./typy.mjs').Finding} Finding */
/** @type {{ otwartePoReview: (findings: Finding[]) => Finding[], polaczFindingiPoPowtorce: (nowe: Finding[], poprzednie: Finding[] | null) => Finding[] }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { otwartePoReview, polaczFindingiPoPowtorce } = new Function(
  'log',
  `${wytnij('function otwartePoReview(', '\n}', 'otwartePoReview')}
   ${wytnij('function polaczFindingiPoPowtorce(', '\n}', 'polaczFindingiPoPowtorce')}
   return { otwartePoReview, polaczFindingiPoPowtorce }`,
)((/** @type {string} */ m) => logi.push(m))

/** @type {(severity: string, typ: string, plik: string, opis: string) => Finding} */
const f = (severity, typ, plik, opis) => ({ severity, typ, plik, opis })

test('normalna sciezka: brak poprzednich findingow nie zmienia wyniku review', () => {
  const nowe = [f('P2', 'KOD', 'a.ts:10', 'cos'), f('P3', 'TEST', 'b.ts:2', 'nit')]
  assert.deepEqual(polaczFindingiPoPowtorce(nowe, []), nowe)
  assert.deepEqual(polaczFindingiPoPowtorce(nowe, null), nowe)
})

test('finding o KODZIE z przerwanego review przezywa powtorke', () => {
  const poprzednie = [f('P3', 'KOD', 'texts.ts:121', 'brak kodu rate_limited w mapie etykiet')]
  const nowe = [f('P2', 'KOD', 'c.js:151', 'galaz oferta_wygasla gasi komunikat')]
  const wynik = polaczFindingiPoPowtorce(nowe, poprzednie)

  assert.equal(wynik.length, 2, 'finding P3 o kodzie nie mial powodu zniknac — awaria dotyczyla srodowiska, nie tego pliku')
  const przeniesiony = wynik.find((x) => x.plik === 'texts.ts:121')
  assert.ok(przeniesiony, 'finding z poprzedniego review przepadl')
  assert.equal(przeniesiony.severity, 'P3', 'severity ma zostac nietkniete')
  assert.match(przeniesiony.opis, /przerwanego review/i, 'przeniesiony finding ma byc oznaczony, zeby fix i raport wiedzialy skad pochodzi')
  assert.match(przeniesiony.opis, /rate_limited/, 'oryginalna tresc findingu musi zostac zachowana')
})

test('findingi E2E z przerwanego review NIE wracaja — powstaly na zepsutym srodowisku', () => {
  const poprzednie = [
    f('P2', 'E2E', 'zadania.md:366', 'scenariusz dashboard-dlug-regresja nieodegrany'),
    f('P2', 'KOD', 'main.tsx:75', 'dynamiczny import rozbija bundle'),
  ]
  const wynik = polaczFindingiPoPowtorce([], poprzednie)
  assert.equal(wynik.length, 1, 'ma wrocic wylacznie finding o kodzie')
  assert.equal(wynik[0].typ, 'KOD')
  // To jest cala przeslanka, dla ktorej review zostaje `pending`: ocena E2E jest niewazna,
  // bo powstala na srodowisku, ktore wlasnie naprawiono. Ponowny tester wystawi swiezy werdykt.
})

test('ten sam finding wykryty ponownie nie jest dublowany — wygrywa swiezsza wersja', () => {
  const opis = 'brak kodu rate_limited w mapie etykiet WEBHOOK_ERROR_CODE_LABELS'
  const poprzednie = [f('P3', 'KOD', 'texts.ts:121', opis)]
  const nowe = [f('P2', 'KOD', 'texts.ts:121', opis)]
  const wynik = polaczFindingiPoPowtorce(nowe, poprzednie)

  assert.equal(wynik.length, 1, 'ten sam plik + ta sama tresc nie moze dac dwoch pozycji na liscie fixa')
  assert.equal(wynik[0].severity, 'P2', 'swiezsza ocena wygrywa — reviewer widzial ten kod pozniej')
  assert.ok(!wynik[0].opis.startsWith('['), 'skoro biezacy przebieg to potwierdzil, nie oznaczamy go jako przeniesiony')
})

// SWIADOMA DECYZJA (audyt 2026-09-06): dedup jest KONSERWATYWNY — kluczem jest plik ORAZ tresc.
// Przy samym pliku jako kluczu nie da sie odroznic "ten sam defekt opisany innymi slowami" od
// "inny defekt w tym samym pliku", a te dwa przypadki wymagaja przeciwnych zachowan. Rozstrzyga
// asymetria ryzyka:
//   falszywy dedup    = trwala utrata findingu — dokladnie szkoda, ktora ta zmiana naprawia,
//   falszywy duplikat = agent fixa dostaje ten sam defekt dwa razy, naprawia raz, koszt marginalny
//                       (a przeniesiony niesie prefiks "potwierdz, czy nadal aktualny").
// W razie watpliwosci ZACHOWUJEMY finding.
test('rozne opisy w tym samym pliku zostaja oba — dedup nie zgaduje semantyki', () => {
  const poprzednie = [f('P3', 'KOD', 'app.tsx:57', 'ErrorBoundary nie obejmuje sciezki logowania')]
  const nowe = [f('P2', 'KOD', 'app.tsx:57', 'zupelnie inny problem w tym samym pliku')]
  const wynik = polaczFindingiPoPowtorce(nowe, poprzednie)
  assert.equal(wynik.length, 2, 'dedup po samym pliku gubilby findingi — w jednym pliku moze byc wiele defektow')
})

test('nowe findingi ida PRZED przeniesionymi — kolejnosc na liscie fixa', () => {
  const wynik = polaczFindingiPoPowtorce(
    [f('P1', 'KOD', 'nowy.ts:1', 'swiezy')],
    [f('P3', 'KOD', 'stary.ts:1', 'przeniesiony')],
  )
  assert.equal(wynik[0].plik, 'nowy.ts:1')
})

test('przeniesienie zostawia slad w logu runu', () => {
  logi.length = 0
  polaczFindingiPoPowtorce([], [f('P2', 'KOD', 'a.ts:1', 'cos')])
  assert.equal(logi.length, 1, 'operator ma zobaczyc, ze findingi wrocily z przerwanego podejscia')
  assert.match(logi[0], /przenosze 1 finding/i)

  logi.length = 0
  polaczFindingiPoPowtorce([f('P2', 'KOD', 'a.ts:1', 'cos')], [])
  assert.equal(logi.length, 0, 'normalna sciezka nie ma zasmiecac logu')
})

// Zmiana kontraktu (P8): otwartePoReview nie przepuszcza P3, wiec finding wejsciowy to P2 (asercja bez zmian).
test('kontrakt z otwartePoReview: przeniesione findingi maja ksztalt FINDING_OTWARTY', () => {
  const poprzednie = otwartePoReview([
    { severity: 'P2', typ: 'KOD', plik: 'x.ts:1', opis: 'defekt', _zrodlo: 'code-quality' },
  ])
  const wynik = polaczFindingiPoPowtorce([], poprzednie)
  assert.deepEqual(
    Object.keys(wynik[0]).sort(), ['opis', 'plik', 'severity', 'typ'],
    'stan ma additionalProperties: false — kazde nadmiarowe pole zostaloby wymazane przy zapisie',
  )
})
