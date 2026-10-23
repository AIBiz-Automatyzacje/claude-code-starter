// Zrodla makiet smoke'u (P24 IU-2): dla pliku smoke'u katalog zadania, plan techniczny, PNG i wymiary kazdego ekranu oraz
// ekrany SPEC bez punktu. Zadanie z nazwy `<RRRR-MM-DD>-<zadanie>-smoke.md`; katalog `docs/completed/<zadanie>/` (po archiwizacji),
// bez niego `docs/active/<zadanie>/`. Plan z linii „Plan techniczny:” w `<zadanie>-plan.md` katalogu — trasy ekranu nie ma ani
// w planie, ani w SPEC, wiec jedynym jej zrodlem zostaje punkt checklisty.
//
// PNG: najpierw wycinek `visual-diff/<ekran>-figma.png` katalogu zadania (ten sam, ktory widzial tester), potem plik z
// `figma_screens`. Kazda sciezka sprawdzona realpath w obrebie projektu — serwer narzedzia podaje te pliki przegladarce.
// Sesja przy zgloszeniu czyta SPEC ekranu (`ekrany/<ekran>.md`), nie PNG (P22 D2), wiec ekran niesie tez sciezke SPEC.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path'

import { KATALOG_EKRANOW } from '../plan/makiety.mjs'
import { ekranyFigmy, parsujPlan, poleTekstowe } from '../plan/plan-techniczny.mjs'

const NAZWA_SMOKE = /^\d{4}-\d{2}-\d{2}-([A-Za-z0-9][\w-]*)-smoke\.md$/
const LINIA_PLANU = /^\s*(?:-\s+)?Plan techniczny:\s*`([^`]+)`/m
const WYMIARY = /^(\d+)\s*[×x]\s*(\d+)\s*(?:px)?$/
const WYMIARY_NAGLOWKA = /(\d+)\s*[×x]\s*(\d+)\s*(?:px)?/

/**
 * @typedef {import('./punkty.mjs').Punkt} Punkt
 * @typedef {import('./punkty.mjs').Wymiary} Wymiary
 * @typedef {{ punkt: string, ekran: string, makieta: string | null, spec: string | null, wymiary: Wymiary | null }} EkranPunktu
 * @typedef {{ smoke: string, zadanie: string, katalogZadania: string, plan: string | null, ekrany: EkranPunktu[], pominiete: string[],
 *   ostrzezenia: string[] }} Zrodla
 */

export class BladZrodel extends Error {
  /** @param {'nazwa-smoke' | 'smoke-poza-projektem' | 'brak-zadania'} kod @param {string} komunikat */
  constructor(kod, komunikat) {
    super(komunikat)
    this.name = 'BladZrodel'
    this.kod = kod
  }
}

/** @param {string} s @returns {string} sciezka bez wiodacego `./` */
const bezKropki = (s) => s.replace(/^\.\//, '')

/** @param {string} korzen realpath projektu @param {string} prawdziwa realpath sciezki @returns {string | null} */
const wzgledna = (korzen, prawdziwa) => prawdziwa.startsWith(korzen + sep) ? relative(korzen, prawdziwa).split(sep).join('/') : null

/**
 * Sciezka wzgledem projektu, jesli istnieje, ma oczekiwany typ i po realpath zostaje w projekcie (`../`, dowiazanie na zewnatrz = null).
 * @param {string} projekt
 * @param {string} sciezka wzgledem projektu
 * @param {'plik' | 'katalog'} [typ]
 * @returns {string | null}
 */
function wProjekcie(projekt, sciezka, typ = 'plik') {
  const pelna = join(projekt, sciezka)
  if (!existsSync(pelna)) return null
  const prawdziwa = realpathSync(pelna)
  const s = statSync(prawdziwa)
  if (typ === 'plik' ? !s.isFile() : !s.isDirectory()) return null
  return wzgledna(realpathSync(projekt), prawdziwa)
}

/**
 * Smoke wzgledem projektu (realpath katalogu smoke'u: /var i /private/var na macOS); smoke poza projektem = blad — narzedzie do niego pisze.
 * @param {string} projekt
 * @param {string} smoke wzgledny albo bezwzgledny
 * @returns {string}
 */
function smokeWProjekcie(projekt, smoke) {
  const pelna = resolve(projekt, smoke)
  const katalog = existsSync(dirname(pelna)) ? realpathSync(dirname(pelna)) : dirname(pelna)
  const wynik = wzgledna(realpathSync(projekt), join(katalog, basename(pelna)))
  if (!wynik) throw new BladZrodel('smoke-poza-projektem', `plik smoke'u ${smoke} leży poza projektem ${projekt}`)
  return wynik
}

/** @param {string} projekt @param {string} zadanie @returns {string} katalog zadania wzgledem projektu */
function katalogZadania(projekt, zadanie) {
  const kandydaci = [`docs/completed/${zadanie}`, `docs/active/${zadanie}`]
  const znaleziony = kandydaci.find((k) => wProjekcie(projekt, k, 'katalog') !== null)
  if (!znaleziony) throw new BladZrodel('brak-zadania', `brak katalogu zadania „${zadanie}”: ani ${kandydaci[0]}/, ani ${kandydaci[1]}/`)
  return znaleziony
}

/**
 * @param {string} projekt
 * @param {string} katalog
 * @param {string} zadanie
 * @returns {{ plan: string | null, ostrzezenie: string | null }} plan techniczny wzgledem projektu; wskazany, a nieczytelny = ostrzezenie
 */
function planTechniczny(projekt, katalog, zadanie) {
  const plik = wProjekcie(projekt, `${katalog}/${zadanie}-plan.md`)
  const m = plik ? LINIA_PLANU.exec(readFileSync(join(projekt, plik), 'utf8')) : null
  if (!m) return { plan: null, ostrzezenie: null }
  const plan = wProjekcie(projekt, bezKropki(m[1]))
  return { plan, ostrzezenie: plan ? null : `plan techniczny ${m[1]} z ${katalog}/${zadanie}-plan.md nie istnieje albo leży poza projektem — makiety tylko z visual-diff/` }
}

/** @param {string} linia wiersz tabeli markdown (z kreskami na brzegach albo bez) @returns {string[]} komorki bez backtickow, `**` i `./` */
function komorki(linia) {
  const czesci = linia.split('|').map((k) => k.trim().replace(/^\*\*|\*\*$/g, '').replace(/^`|`$/g, '').replace(/^\.\//, ''))
  return czesci.slice(czesci[0] === '' ? 1 : 0, czesci.at(-1) === '' ? -1 : undefined)
}

/**
 * Wymiary ekranu z wiersza tabeli SPEC.md: wiersz z nazwa ekranu albo plikiem `<ekran>.png` / plikiem z figma_screens
 * (SPEC etapu 3 vibersi ma w pierwszej kolumnie opis dla ludzi), komorka `<W>×<H>px`.
 * @param {string} spec tresc SPEC.md
 * @param {string} ekran
 * @param {string | undefined} plikFigmy sciezka PNG z figma_screens
 * @returns {Wymiary | null}
 */
function wymiaryZTabeli(spec, ekran, plikFigmy) {
  const nazwy = new Set([ekran, `${ekran}.png`, ...(plikFigmy ? [basename(plikFigmy)] : [])])
  for (const linia of spec.split('\n')) {
    if (!linia.includes('|')) continue
    const k = komorki(linia)
    if (!k.some((x) => nazwy.has(x))) continue
    const m = k.map((x) => WYMIARY.exec(x)).find(Boolean)
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
  const sciezkaSmoke = smokeWProjekcie(projekt, smoke)
  const zadanie = nazwa[1]
  const katalog = katalogZadania(projekt, zadanie)
  const { plan, ostrzezenie } = planTechniczny(projekt, katalog, zadanie)
  const makiety = makietyPlanu(projekt, plan)
  const tekstSpec = makiety.spec ? readFileSync(join(projekt, makiety.spec), 'utf8') : ''
  const ekrany = punkty.flatMap((p) => p.ekrany.map((ekran) => {
    const specEkranu = makiety.katalogEkranow ? wProjekcie(projekt, `${makiety.katalogEkranow}/${ekran}.md`) : null
    const zFigmy = makiety.png.get(ekran)
    const zeSpec = wymiaryZTabeli(tekstSpec, ekran, zFigmy) ?? (specEkranu ? wymiaryZNaglowka(readFileSync(join(projekt, specEkranu), 'utf8')) : null)
    // Jeden viewport punktu z kilkoma makietami (komputer i telefon) nie pasuje do kazdej — tam SPEC ma pierwszenstwo.
    const wymiary = p.ekrany.length > 1 ? zeSpec ?? p.viewport : p.viewport ?? zeSpec
    return {
      punkt: p.id, ekran,
      makieta: wProjekcie(projekt, `${katalog}/visual-diff/${ekran}-figma.png`) ?? (zFigmy ? wProjekcie(projekt, zFigmy) : null),
      spec: specEkranu ?? makiety.spec, wymiary,
    }
  }))
  // Ekran z punktem spoza narzedzia ([fizyczne urzadzenie], stary zapis bez visual-diff/) nie jest „bez punktu” — liczy sie wzmianka w smoke'u.
  const tekstSmoke = readFileSync(join(projekt, sciezkaSmoke), 'utf8')
  const zPunktami = new Set(punkty.flatMap((p) => p.ekrany))
  return {
    smoke: sciezkaSmoke, zadanie, katalogZadania: katalog, plan, ekrany,
    pominiete: [...makiety.png.keys()].filter((n) => !zPunktami.has(n) && !tekstSmoke.includes(`${n}-figma.png`)),
    ostrzezenia: ostrzezenie ? [ostrzezenie] : [],
  }
}
