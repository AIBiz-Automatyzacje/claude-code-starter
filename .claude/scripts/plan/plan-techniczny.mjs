// Plan techniczny z dev-plan (PLAN-POPRAWY P13): frontmatter, fazy i Implementation Units z polami, ktore generator
// przepisuje do docs/active/, a walidacja sprawdza. Linie w blokach ``` nie sa naglowkami ani polami.

import { bezPlaceholdera, jednostka, pole } from './pola-iu.mjs'

export { bezOgonkow } from './pola-iu.mjs'

const NAGLOWEK_FAZY = /^(#{2,3})\s+Faza\s+(\S+?)\s*[—–:-]\s*(.+?)\s*$/
const NAGLOWEK_IU = /^(?:(?:- \[[ x]\] )?\*\*IU-(\d+)\s*[:—–-]\s*(.+?)\*\*.*|#{3,4}\s+IU-(\d+)\s*[:—–-]\s*(.+?)\s*)$/
const NAGLOWEK_IU_LUZNY = /^(?:- \[[ x]\] \*\*|\*\*|#{2,4}\s+)IU-\d+/
const KLUCZ_FM = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/
const PLOT = /^\s*(?:```|~~~)/

/**
 * @typedef {import('./pola-iu.mjs').Jednostka} Jednostka
 * @typedef {import('./pola-iu.mjs').Linia} Linia
 * @typedef {import('./pola-iu.mjs').Plik} Plik
 * @typedef {{ numer: number, oznaczenie: string, poziom: number, nazwa: string, zalezyOd: string, rownolegleZ: string, iu: Jednostka[] }} Faza
 * @typedef {string | null | Record<string, string>} PoleFrontmattera
 * @typedef {{ frontmatter: Record<string, PoleFrontmattera>, przeglad: string, fazy: Faza[], bezFazy: Jednostka[], problemy: string[] }} Plan
 */

/** @param {string | undefined} v @returns {string | null} */
function skalar(v) {
  const t = (v ?? '').replace(/\s+#.*$/, '').trim()
  if (!t || t === 'null' || t === '~' || t === '{}') return null
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t
}

/**
 * Frontmatter planu: skalary i jednopoziomowe mapy (klucz bez wartosci, pod nim wciete `nazwa: sciezka`). Bez biblioteki YAML.
 * @param {string[]} linie
 * @returns {{ pola: Record<string, PoleFrontmattera>, koniec: number }}
 */
function frontmatter(linie) {
  /** @type {Record<string, PoleFrontmattera>} */
  const pola = {}
  const koniec = linie[0] === '---' ? linie.indexOf('---', 1) : -1
  if (koniec === -1) return { pola, koniec: 0 }
  /** @type {Record<string, string> | null} */
  let mapa = null
  linie.slice(1, koniec).forEach((linia, i, naglowek) => {
    const wciete = /^\s+([\w.-]+):\s*(.*)$/.exec(linia)
    if (wciete && mapa) {
      mapa[wciete[1]] = skalar(wciete[2]) ?? ''
      return
    }
    const k = KLUCZ_FM.exec(linia)
    if (!k) return
    const zMapa = !skalar(k[2]) && /^\s+[\w.-]+:/.test(naglowek[i + 1] ?? '')
    mapa = zMapa ? {} : null
    pola[k[1]] = mapa ?? skalar(k[2])
  })
  return { pola, koniec: koniec + 1 }
}

/** @param {Plan} plan @param {string} klucz @returns {string | null} pole tekstowe frontmattera; mapa albo brak = null */
export function poleTekstowe(plan, klucz) {
  const v = plan.frontmatter[klucz]
  return typeof v === 'string' ? v : null
}

/** @param {Plan} plan @returns {[string, string][]} ekrany figma_screens (nazwa, sciezka) */
export function ekranyFigmy(plan) {
  const v = plan.frontmatter.figma_screens
  return v && typeof v === 'object' ? Object.entries(v) : []
}

/**
 * `origin:` wskazujacy plik w repo (bez kotwicy i dopisku `(sekcja …)`); null gdy wartosc nie wyglada na sciezke .md.
 * @param {string | null} origin
 * @returns {string | null}
 */
export function sciezkaOrigin(origin) {
  const s = origin?.replace(/#.*$/, '').replace(/\s*\(sekcja.*$/, '').replace(/^\.\//, '').trim()
  return s && /\.md$/.test(s) && s.includes('/') && !/\s/.test(s) ? s : null
}

/** @param {string} md @returns {string} pierwszy akapit sekcji `## Przegląd` */
function przeglad(md) {
  const linie = md.split('\n')
  const start = linie.findIndex((l) => /^##\s+Przegl[aą]d/i.test(l))
  const akapit = []
  for (const linia of start === -1 ? [] : linie.slice(start + 1)) {
    if (/^#/.test(linia) || (!linia.trim() && akapit.length)) break
    if (linia.trim()) akapit.push(linia.trim())
  }
  return akapit.join(' ')
}

/**
 * @param {string} md tresc planu technicznego
 * @returns {Plan}
 */
export function parsujPlan(md) {
  const wszystkie = md.split('\n')
  const { pola, koniec } = frontmatter(wszystkie)
  /** @type {Faza[]} */
  const fazy = []
  /** @type {Jednostka[]} */
  const bezFazy = []
  /** @type {string[]} */
  const problemy = []
  /** @type {{ naglowek: { id: string, numer: number, nazwa: string, faza: number | null, start: number }, faza: Faza | null, linie: Linia[] } | null} */
  let iu = null
  /** @type {Faza | null} */
  let faza = null
  let kod = false
  const zamknijIu = () => {
    if (!iu) return
    const cel = iu.faza ? iu.faza.iu : bezFazy
    cel.push(jednostka(iu.naglowek, iu.linie))
    iu = null
  }
  wszystkie.slice(koniec).forEach((tekst, i) => {
    const nr = koniec + i + 1
    const plot = PLOT.test(tekst)
    if (kod || plot) {
      if (plot) kod = !kod
      if (iu) iu.linie.push({ nr, tekst, kod: true })
      return
    }
    const f = NAGLOWEK_FAZY.exec(tekst)
    const j = NAGLOWEK_IU.exec(tekst)
    if (f || j || /^## /.test(tekst)) zamknijIu()
    if (f) {
      faza = { numer: /^\d+$/.test(f[2]) ? Number(f[2]) : NaN, oznaczenie: f[2], poziom: f[1].length, nazwa: f[3], zalezyOd: '', rownolegleZ: '', iu: [] }
      fazy.push(faza)
    } else if (j) {
      const numer = Number(j[1] ?? j[3])
      iu = { naglowek: { id: `IU-${numer}`, numer, nazwa: (j[2] ?? j[4]).trim(), faza: faza?.numer ?? null, start: nr }, faza, linie: [] }
    } else if (/^## /.test(tekst)) faza = null
    else if (NAGLOWEK_IU_LUZNY.test(tekst)) problemy.push(`linia ${nr}: nagłówek jednostki nierozpoznany — zapis „- [ ] **IU-N: nazwa**”: „${tekst.slice(0, 60)}”`)
    else if (iu) iu.linie.push({ nr, tekst, kod: false })
    else if (faza) {
      const p = pole(tekst)
      if (p?.klucz === 'zalezy od') faza.zalezyOd = bezPlaceholdera(p.wartosc)
      if (p?.klucz === 'rownolegle z') faza.rownolegleZ = bezPlaceholdera(p.wartosc)
    }
  })
  zamknijIu()
  if (kod) problemy.push('niezamknięty blok kodu ``` — reszta planu nie została przeczytana')
  return { frontmatter: pola, przeglad: przeglad(md), fazy, bezFazy, problemy }
}

/**
 * Nazwa zadania = <slug> z `YYYY-MM-DD-NNN-<typ>-<slug>-plan.md`.
 * @param {string} sciezkaPlanu
 * @returns {string}
 */
export function nazwaZadania(sciezkaPlanu) {
  const plik = sciezkaPlanu.slice(sciezkaPlanu.lastIndexOf('/') + 1).replace(/\.md$/, '')
  return plik.replace(/^\d{4}-\d{2}-\d{2}-\d{3}-(?:feat|fix|refactor)-/, '').replace(/-plan$/, '')
}
