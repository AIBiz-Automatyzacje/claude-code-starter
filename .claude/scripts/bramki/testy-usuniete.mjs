// Testy usuniete w fazie (pole telemetrii testy_usuniete): definicje it(/test( zniknete z plikow testow wzgledem bazy, ktorych
// nazwy nie ma w zadnym obecnym pliku testow fazy (przeniesienie = nie usuniecie). Zmiana nazwy testu tez trafia na liste.
// Bramka informacyjna — domkniecie uzasadnia kazda pozycje (coding-rules, sekcja Testowanie: test usuwa sie
// razem z funkcja albo jako zielony test niefalsyfikowalny z wpisem w raporcie fazy).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PLIK_TESTOW = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const DEFINICJA_TESTU = /^\s*(?:it|test)(?:\.(?:only|skip|concurrent|todo|fails))*\(\s*(['"`])(.+?)\1/

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */

/** @param {string} tekst @returns {{ nazwa: string, linia: number }[]} definicje it(/test( w tekscie z numerem linii */
export function definicjeTestow(tekst) {
  return tekst.split('\n').flatMap((l, i) => {
    const m = DEFINICJA_TESTU.exec(l)
    return m ? [{ nazwa: m[2], linia: i + 1 }] : []
  })
}

/**
 * @param {string} diffU0 `git diff -U0` bazy fazy
 * @param {Set<string>} nazwyObecne nazwy testow w obecnych plikach testow fazy
 * @returns {Trafienie[]}
 */
export function usunieteTesty(diffU0, nazwyObecne) {
  /** @type {Trafienie[]} */
  const wynik = []
  /** @type {string | null} */
  let plik = null
  let liniaStara = 0
  // Naglowki `---` tylko miedzy `diff --git` a pierwszym `@@` — usunieta linia "-- komentarz" wyglada tak samo.
  let wNaglowku = false
  for (const l of diffU0.split('\n')) {
    if (l.startsWith('diff --git ')) {
      wNaglowku = true
      continue
    }
    if (wNaglowku && l.startsWith('--- ')) {
      plik = l.startsWith('--- a/') && PLIK_TESTOW.test(l) ? l.slice(6) : null
      continue
    }
    const hunk = /^@@ -(\d+)/.exec(l)
    if (hunk) {
      wNaglowku = false
      liniaStara = Number(hunk[1])
      continue
    }
    if (!plik || !l.startsWith('-')) continue
    const m = DEFINICJA_TESTU.exec(l.slice(1))
    if (m && !nazwyObecne.has(m[2])) wynik.push({ plik, linia: liniaStara, regula: 'test-usuniety', opis: m[2] })
    liniaStara++
  }
  return wynik
}

/**
 * @param {string} projekt
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {WynikBramki}
 */
export function bramkaTestyUsuniete(projekt, zmiany) {
  const obecne = zmiany.pliki.filter((p) => PLIK_TESTOW.test(p) && existsSync(join(projekt, p)))
  const nazwyObecne = new Set(obecne.flatMap((p) => definicjeTestow(readFileSync(join(projekt, p), 'utf8')).map((d) => d.nazwa)))
  return { status: 'ok', sekundy: null, trafienia: usunieteTesty(zmiany.diffU0, nazwyObecne) }
}
