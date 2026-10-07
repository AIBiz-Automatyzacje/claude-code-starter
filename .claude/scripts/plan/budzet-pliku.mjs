// Budzet pliku z tabeli plikow IU (PLAN-POPRAWY P13, 6a pkt 8): linie = wyzwalacz pytania o wymiary, wymiary = werdykt.
// Linie liczone jak ESLint max-lines (bez pustych linii i komentarzy): prog 300 + tolerancja 20% = 360 = prog ESLint i bota PR.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { bezOgonkow } from './pola-iu.mjs'

/**
 * @typedef {import('./pola-iu.mjs').Jednostka} Jednostka
 * @typedef {import('./pola-iu.mjs').Plik} Plik
 * @typedef {{ bledy: string[], uwagi: string[] }} Wynik
 */

export const PROG_PYTANIA = 300
export const PROG_ESLINT = 360
const PLIK_KODU = /\.[cm]?[jt]sx?$/
const TOLERANCJA = { procent: 0.2, linie: 10 }

/** @param {Plik} p @returns {string} akcja bez ogonkow, malymi literami */
export const akcja = (p) => bezOgonkow(p.akcja).toLowerCase()

/** @param {string} komorka @returns {boolean} */
const pusta = (komorka) => !komorka.replace(/[—–\-\s]/g, '')

/**
 * Linie kodu jak ESLint `max-lines` z `skipBlankLines` i `skipComments`: bez pustych i bez linii samego komentarza.
 * @param {string} tresc
 * @returns {number}
 */
export function liczLinieKodu(tresc) {
  let blok = false
  let n = 0
  for (const surowa of tresc.split('\n')) {
    let l = surowa.trim()
    if (blok) {
      const koniec = l.indexOf('*/')
      if (koniec === -1) continue
      blok = false
      l = l.slice(koniec + 2).trim()
    }
    if (l.startsWith('/*')) {
      const koniec = l.indexOf('*/', 2)
      if (koniec === -1) {
        blok = true
        continue
      }
      l = l.slice(koniec + 2).trim()
    }
    if (l && !l.startsWith('//')) n++
  }
  return n
}

/** @param {number} a @param {number} b @returns {boolean} rozjazd ponad tolerancje (20% i 10 linii) */
const rozjazd = (a, b) => Math.abs(a - b) > TOLERANCJA.linie && Math.abs(a - b) > Math.max(a, b) * TOLERANCJA.procent

/**
 * @param {string} id @param {Plik} p @param {Wynik} w
 */
function progi(id, p, w) {
  if (p.po === null) return
  if (p.po > PROG_ESLINT) {
    w.bledy.push(`${id}: \`${p.sciezka}\` po zmianie ${p.po} linii > ${PROG_ESLINT} (próg ESLint max-lines) — zaplanuj wydzielenie `
      + 'modułu: werdykt „wydziel …”, wiersz Stwórz nowego modułu i długość po wydzieleniu')
  } else if (p.po > PROG_PYTANIA && pusta(p.wymiary)) {
    w.bledy.push(`${id}: \`${p.sciezka}\` po zmianie ${p.po} linii > ${PROG_PYTANIA} — oceń wymiary (powody zmiany, eksporty między `
      + 'warstwami, importy z wielu domen, test-lustro, reguła 5 s)')
  }
}

/**
 * Budzet plikow w kolejnosci jednostek. Plik utworzony albo zmieniony przez wczesniejsza jednostke planu ma "dzis" = jej "po";
 * pierwsze wystapienie sciezki porownuje sie z repo (tylko gdy `wzgledemRepo` — bramka po fazie 1 widzi juz zmieniony kod).
 * @param {Jednostka[]} jednostki w kolejnosci numerow
 * @param {string} projekt
 * @param {Wynik} w
 * @param {boolean} wzgledemRepo
 */
export function sprawdzBudzet(jednostki, projekt, w, wzgledemRepo) {
  /** @type {Map<string, number | null>} */
  const wPlanie = new Map()
  for (const iu of jednostki.filter((j) => j.tabelaPlikow)) {
    for (const p of iu.pliki) {
      const plik = join(projekt, p.sciezka)
      const zPlanu = wPlanie.get(p.sciezka)
      if (wzgledemRepo && akcja(p) === 'modyfikuj' && !wPlanie.has(p.sciezka) && !existsSync(plik)) {
        w.bledy.push(`${iu.id}: Modyfikuj \`${p.sciezka}\` — pliku nie ma w repo ani we wcześniejszej jednostce planu`)
      }
      if (PLIK_KODU.test(p.sciezka) && p.dzis !== null && akcja(p) !== 'stworz') {
        if (zPlanu !== undefined && zPlanu !== null && rozjazd(zPlanu, p.dzis)) {
          w.bledy.push(`${iu.id}: \`${p.sciezka}\` — tabela podaje dziś ${p.dzis}, a wcześniejsza jednostka planu kończy na ${zPlanu}`)
        } else if (zPlanu === undefined && wzgledemRepo && existsSync(plik) && statSync(plik).isFile()) {
          const faktycznie = liczLinieKodu(readFileSync(plik, 'utf8'))
          if (rozjazd(faktycznie, p.dzis)) {
            w.bledy.push(`${iu.id}: \`${p.sciezka}\` ma ${faktycznie} linii kodu (bez pustych i komentarzy, jak ESLint), tabela podaje ${p.dzis}`)
          }
        }
      }
      if (PLIK_KODU.test(p.sciezka)) progi(iu.id, p, w)
      wPlanie.set(p.sciezka, p.po)
    }
  }
}

/**
 * Podsumowanie budzetu planu dla telemetrii (rekord skill, pole artefakty): ile IU ma ocenione wymiary pliku i ile wydzielen.
 * @param {Jednostka[]} jednostki
 * @returns {{ iu_z_wymiarami: number, wydzielenia: number }}
 */
export function podsumowanieBudzetu(jednostki) {
  const pliki = jednostki.flatMap((iu) => iu.pliki)
  return {
    iu_z_wymiarami: jednostki.filter((iu) => iu.pliki.some((p) => !pusta(p.wymiary))).length,
    wydzielenia: pliki.filter((p) => /^wydziel/i.test(p.werdykt.trim())).length,
  }
}
