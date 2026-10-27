// Test ucieczek do bota (E5-20): skad pochodzi watek bota — review fazy go mial, kod fixa, tura PR, smoke albo nowy.
// Pierwowzor: docs/reviews/2026-09-19-analiza-pipeline/skrypty/ucieczki_bota.py (analiza etapu 5 vibersi, liczona recznie).

import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import { findingiRaportow, kubelekWatku, oznaczUcieczki, pochodzenieKodu } from '../ucieczki.mjs'

/** @type {{ zadanie: string, czasArchiwum: number, watki: Array<{ id: string, plik: string, os: string | null, severity: string | null, blame: { temat: string, czas: number } }>, raporty: Array<{ nazwa: string, tresc: string }> }} */
const ETAP5 = JSON.parse(readFileSync(new URL('./fixtures/ucieczki-vibersi-etap5.json', import.meta.url), 'utf8'))
const ZADANIE = 'etap-5-interakcje-i-profil'

test('findingi z naglowkow review fazy i linii known-issues (stary [P3] bez osi, nowy [P3/<os>])', () => {
  const f = findingiRaportow([
    { nazwa: 'review-faza-4.md', tresc: '### P2 · KOD · `server/a.ts:82`\n\nopis\n### OPERATOR · `docs/x.md`\n### P3 · TEST · `server/a.test.ts:7`' },
    { nazwa: 'known-issues.md', tresc: '- 🟡 [P3] src/b.ts:12 — stary\n- 🟡 [P3/correctness] src/c.ts:5 — nowy\n- zwykla linia' },
  ])
  assert.deepEqual(f, [
    { zrodlo: 'review-faza-4.md', waga: 'P2', os: null, plik: 'server/a.ts', linia: 82 },
    { zrodlo: 'review-faza-4.md', waga: 'P3', os: null, plik: 'server/a.test.ts', linia: 7 },
    { zrodlo: 'known-issues.md', waga: 'P3', os: null, plik: 'src/b.ts', linia: 12 },
    { zrodlo: 'known-issues.md', waga: 'P3', os: 'correctness', plik: 'src/c.ts', linia: 5 },
  ])
})

test('pochodzenie kodu z tematu commitu linii: fix fazy, kontrola fixa, tura PR, build, smoke (po archiwum), sprzed zadania', () => {
  const ARCHIWUM = 1000
  /** @param {string} temat @param {number} [czas] */
  const p = (temat, czas = 500) => pochodzenieKodu({ temat, czas }, ZADANIE, ARCHIWUM)
  assert.equal(p(`fix(${ZADANIE}): poprawki po review fazy 5`), 'kod-fixa')
  assert.equal(p(`fix(${ZADANIE}): kontrola diffu naprawczego fazy 2`), 'kod-fixa')
  assert.equal(p('fix(pr): tura 2 — poprawki po review bota', 2000), 'kod-tury-PR')
  assert.equal(p(`feat(${ZADANIE}): komentarze (faza 4)`), 'kod-buildu')
  assert.equal(p('fix(aplikacja): przeładowanie po wdrożeniu', 1500), 'kod-smoke')
  assert.equal(p(`test(${ZADANIE}): e2e`), 'kod-buildu')
  assert.equal(p('feat(etap-4): inne zadanie'), 'sprzed-zadania')
  assert.equal(pochodzenieKodu({ temat: 'fix(app): cos', czas: 1500 }, ZADANIE, null), 'sprzed-zadania', 'bez commitu archiwum nie ma smoke\'u')
  assert.equal(pochodzenieKodu({ temat: 'feat(etap-5xinterakcje-i-profil): obce', czas: 1 }, 'etap-5.interakcje-i-profil', null), 'sprzed-zadania', 'kropka w nazwie zadania to znak, nie dowolny znak')
})

test('etap 5 vibersi: 13 watkow — P1/P2 znane z review 1, z kodu fixa 2, z tur PR 3, ze smoke 0 (jak w analizie)', () => {
  const findingi = findingiRaportow(ETAP5.raporty)
  const klasy = ETAP5.watki.map((w) => ({ id: w.id, plik: w.plik, os: w.os, severity: w.severity }))
  const blame = new Map(ETAP5.watki.map((w) => [w.plik, w.blame]))
  const oznaczone = oznaczUcieczki(klasy, { zadanie: ZADANIE, czasArchiwum: ETAP5.czasArchiwum, findingi, blame: (plik, linia) => blame.get(`${plik}:${linia}`) ?? null })
  /** @type {Record<string, { razem: number, p1p2: number }>} */
  const licz = {}
  for (const k of oznaczone) {
    const kub = k.ucieczka?.kubelek ?? 'brak'
    licz[kub] ??= { razem: 0, p1p2: 0 }
    licz[kub].razem++
    if (k.severity === 'P1' || k.severity === 'P2') licz[kub].p1p2++
  }
  assert.deepEqual(licz, {
    nowy: { razem: 4, p1p2: 1 },
    'review-P3': { razem: 2, p1p2: 1 },
    'kod-tury-PR': { razem: 5, p1p2: 3 },
    'kod-fixa': { razem: 2, p1p2: 2 },
  })
  const powiadomienia = oznaczone.find((k) => k.plik === 'src/hooks/interakcje/use-powiadomienia.ts:139')
  assert.equal(powiadomienia?.ucieczka?.znane, 'known-issues.md P3/correctness src/hooks/interakcje/use-powiadomienia.ts:105', 'linia przesunieta poza okno — dopasowanie po pliku i osi')
  assert.equal(oznaczone.find((k) => k.plik === 'server/komentarze.ts:25')?.ucieczka?.znane, 'review-faza-4.md P3 server/komentarze.ts:25')
})

test('kubelek: finding w oknie linii bez osi pasuje; inna znana os w oknie nie; P1/P2 z review = wrocil; kod spoza buildu nie jest „znany”', () => {
  const zBuildu = { temat: `feat(${ZADANIE}): x`, czas: 1 }
  const findingi = findingiRaportow([
    { nazwa: 'review-faza-2.md', tresc: '### P2 · KOD · `src/a.ts:50`' },
    { nazwa: 'known-issues.md', tresc: '- 🟡 [P3/performance] src/b.ts:10 — render' },
  ])
  /** @param {string} plik @param {string | null} os @param {{ temat: string, czas: number } | null} [blame] */
  const k = (plik, os, blame = zBuildu) => kubelekWatku({ plik, os }, blame, { findingi, zadanie: ZADANIE, czasArchiwum: null })
  assert.equal(k('src/a.ts:58', 'correctness').kubelek, 'review-P1P2')
  assert.equal(k('src/a.ts:61', 'correctness').kubelek, 'nowy', 'poza oknem 10 linii, finding bez osi')
  assert.equal(k('src/b.ts:12', 'correctness').kubelek, 'nowy', 'w oknie, ale finding innej osi')
  assert.equal(k('src/b.ts:90', 'performance').kubelek, 'review-P3', 'ten plik i ta sama os')
  assert.equal(k('src/a.ts:50', 'correctness', { temat: 'fix(pr): tura 1 — poprawki', czas: 1 }).kubelek, 'kod-tury-PR', 'linia przepisana w turze PR to nowy kod')
  assert.deepEqual(k('(recenzja ogolna)', 'spec', null), { kubelek: 'nieustalone', pochodzenie: 'nieustalone', znane: null })
  assert.equal(k('src/c.ts:3', 'spec', null).kubelek, 'nieustalone', 'linia bez blame (plik usuniety, commit nieosiagalny)')
  assert.equal(k('src/c.ts:3', 'spec', { temat: 'chore: stare', czas: 1 }).kubelek, 'sprzed-zadania')
})
