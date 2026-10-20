// Zrodla makiet smoke'u (P24 IU-2): dla pliku smoke'u katalog zadania, plan techniczny, PNG i wymiary kazdego ekranu oraz
// ekrany SPEC bez punktu. Zadanie z nazwy `<RRRR-MM-DD>-<zadanie>-smoke.md`; katalog `docs/completed/<zadanie>/` (po archiwizacji),
// bez niego `docs/active/<zadanie>/`. Plan z linii „Plan techniczny:” w `<zadanie>-plan.md` katalogu — trasy ekranu nie ma ani
// w planie, ani w SPEC, wiec jedynym jej zrodlem zostaje punkt checklisty.
//
// PNG: najpierw wycinek `visual-diff/<ekran>-figma.png` katalogu zadania (ten sam, ktory widzial tester), potem plik z
// `figma_screens`. Kazda sciezka sprawdzona realpath w obrebie projektu — serwer narzedzia podaje te pliki przegladarce.
// Sesja przy zgloszeniu czyta SPEC ekranu (`ekrany/<ekran>.md`), nie PNG (P22 D2), wiec ekran niesie tez sciezke SPEC.

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, isAbsolute, join, posix, relative, sep } from 'node:path'

import { KATALOG_EKRANOW } from '../plan/makiety.mjs'
import { ekranyFigmy, parsujPlan, poleTekstowe } from '../plan/plan-techniczny.mjs'

const NAZWA_SMOKE = /^\d{4}-\d{2}-\d{2}-(.+)-smoke\.md$/
const LINIA_PLANU = /^\s*(?:-\s+)?Plan techniczny:\s*`([^`]+)`/m
const WYMIARY = /^(\d+)\s*[×x]\s*(\d+)\s*(?:px)?$/
const WYMIARY_NAGLOWKA = /(\d+)\s*×\s*(\d+)\s*px/

/**
 * @typedef {import('./punkty.mjs').Punkt} Punkt
 * @typedef {import('./punkty.mjs').Wymiary} Wymiary
 * @typedef {{ punkt: string, ekran: string, makieta: string | null, spec: string | null, wymiary: Wymiary | null }} EkranPunktu
 * @typedef {{ smoke: string, zadanie: string, katalogZadania: string, plan: string | null, ekrany: EkranPunktu[], pominiete: string[] }} Zrodla
 */

export class BladZrodel extends Error {
  /** @param {'nazwa-smoke' | 'brak-zadania'} kod @param {string} komunikat */
  constructor(kod, komunikat) {
    super(komunikat)
    this.name = 'BladZrodel'
    this.kod = kod
  }
}

/** @param {string} s @returns {string} sciezka bez wiodacego `./` */
const bezKropki = (s) => s.replace(/^\.\//, '')

/**
 * Sciezka wzgledem projektu, jesli plik istnieje i po realpath zostaje w projekcie (`../`, dowiazanie na zewnatrz = null).
 * @param {string} projekt
 * @param {string} sciezka wzgledem projektu
 * @returns {string | null}
 */
function wProjekcie(projekt, sciezka) {
  const pelna = join(projekt, sciezka)
  if (!existsSync(pelna)) return null
  const korzen = realpathSync(projekt)
  const prawdziwa = realpathSync(pelna)
  return prawdziwa.startsWith(korzen + sep) ? relative(korzen, prawdziwa).split(sep).join('/') : null
}

/** @param {string} projekt @param {string} zadanie @returns {string} katalog zadania wzgledem projektu */
function katalogZadania(projekt, zadanie) {
  const kandydaci = [`docs/completed/${zadanie}`, `docs/active/${zadanie}`]
  const znaleziony = kandydaci.find((k) => wProjekcie(projekt, k) !== null)
  if (!znaleziony) throw new BladZrodel('brak-zadania', `brak katalogu zadania „${zadanie}”: ani ${kandydaci[0]}/, ani ${kandydaci[1]}/`)
  return znaleziony
}

/** @param {string} projekt @param {string} katalog @param {string} zadanie @returns {string | null} plan techniczny wzgledem projektu */
function planTechniczny(projekt, katalog, zadanie) {
  const plik = wProjekcie(projekt, `${katalog}/${zadanie}-plan.md`)
  const m = plik ? LINIA_PLANU.exec(readFileSync(join(projekt, plik), 'utf8')) : null
  return m ? wProjekcie(projekt, bezKropki(m[1])) : null
}

/**
 * Wymiary ekranu z wiersza tabeli SPEC.md (pierwsza komorka = nazwa ekranu, komorka `<W>×<H>px`).
 * @param {string} spec tresc SPEC.md
 * @param {string} ekran
 * @returns {Wymiary | null}
 */
function wymiaryZTabeli(spec, ekran) {
  for (const linia of spec.split('\n')) {
    const komorki = linia.split('|').slice(1, -1).map((k) => k.trim().replace(/^`|`$/g, ''))
    if (komorki[0] !== ekran) continue
    const m = komorki.map((k) => WYMIARY.exec(k)).find(Boolean)
    if (m) return { szerokosc: Number(m[1]), wysokosc: Number(m[2]) }
  }
  return null
}

/** @param {string} md tresc ekrany/<ekran>.md @returns {Wymiary | null} wymiary z naglowka `# <ekran> (…) — <W>×<H>px` */
function wymiaryZNaglowka(md) {
  const m = WYMIARY_NAGLOWKA.exec(md.split('\n').find((l) => l.startsWith('# ')) ?? '')
  return m ? { szerokosc: Number(m[1]), wysokosc: Number(m[2]) } : null
}

/**
 * Makiety planu: SPEC.md, katalog SPEC ekranow i PNG z figma_screens.
 * @param {string} projekt
 * @param {string | null} plan
 * @returns {{ spec: string | null, katalogEkranow: string | null, png: Map<string, string> }}
 */
function makietyPlanu(projekt, plan) {
  if (!plan) return { spec: null, katalogEkranow: null, png: new Map() }
  const p = parsujPlan(readFileSync(join(projekt, plan), 'utf8'))
  const figmaSpec = poleTekstowe(p, 'figma_spec')
  const spec = figmaSpec ? wProjekcie(projekt, bezKropki(figmaSpec)) : null
  return {
    spec, katalogEkranow: figmaSpec ? posix.join(posix.dirname(bezKropki(figmaSpec)), KATALOG_EKRANOW) : null,
    png: new Map(ekranyFigmy(p).map(([nazwa, sciezka]) => [nazwa, bezKropki(sciezka)])),
  }
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} smoke plik smoke'u (wzgledem projektu albo bezwzgledny)
 * @param {Punkt[]} punkty punkty wizualne smoke'u (punkty.mjs)
 * @returns {Zrodla}
 */
export function zrodlaMakiet(projekt, smoke, punkty) {
  const nazwa = NAZWA_SMOKE.exec(basename(smoke))
  if (!nazwa) throw new BladZrodel('nazwa-smoke', `plik smoke'u „${basename(smoke)}” nie ma nazwy <RRRR-MM-DD>-<zadanie>-smoke.md — z niej narzędzie bierze zadanie`)
  const zadanie = nazwa[1]
  const katalog = katalogZadania(projekt, zadanie)
  const plan = planTechniczny(projekt, katalog, zadanie)
  const makiety = makietyPlanu(projekt, plan)
  const tekstSpec = makiety.spec ? readFileSync(join(projekt, makiety.spec), 'utf8') : ''
  const ekrany = punkty.flatMap((p) => p.ekrany.map((ekran) => {
    const specEkranu = makiety.katalogEkranow ? wProjekcie(projekt, `${makiety.katalogEkranow}/${ekran}.md`) : null
    const zFigmy = makiety.png.get(ekran)
    const wymiary = p.viewport ?? wymiaryZTabeli(tekstSpec, ekran) ?? (specEkranu ? wymiaryZNaglowka(readFileSync(join(projekt, specEkranu), 'utf8')) : null)
    return {
      punkt: p.id, ekran,
      makieta: wProjekcie(projekt, `${katalog}/visual-diff/${ekran}-figma.png`) ?? (zFigmy ? wProjekcie(projekt, zFigmy) : null),
      spec: specEkranu ?? makiety.spec, wymiary,
    }
  }))
  const zPunktami = new Set(punkty.flatMap((p) => p.ekrany))
  return {
    smoke: isAbsolute(smoke) ? relative(projekt, smoke).split(sep).join('/') : smoke, zadanie, katalogZadania: katalog, plan, ekrany,
    pominiete: [...makiety.png.keys()].filter((n) => !zPunktami.has(n)),
  }
}
