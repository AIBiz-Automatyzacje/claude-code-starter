// Ksiegowanie scenariuszy [E2E] fazy po przebiegu testera (P14, PANEL-WEJSCIE §2 pkt 6). Jedyny wlasciciel odznaczania linii [E2E]
// w review; fix uzywa go do przeniesienia pojedynczego flow na [Manual], gdy srodowisko padlo w trakcie runu.
//
// Wynik flow (zbior wpisow wszystkich jego linii): FAIL przed SKIP, oba przed PASS. Dla SKIP decyduje przyczyna:
//   manual — srodowisko, limit zewnetrzny, harness, pad testera: linia [E2E] -> [Manual] z suffixem (MANUAL — przyczyna: powod),
//            run idzie dalej, pozycja trafia do smoke'u operatora;
//   fix    — brak seeda, niewykonalny opis scenariusza: [E2E] zostaje z (SKIP — powod) + kopia w Operator checklist (jak dotad),
//            finding P2 typu E2E idzie do fixa;
//   skip   — przyczyna nieznana albo brak wpisu testera: jak fix — completion-gate zatrzyma zadanie, nic nie znika po cichu.

import { bezSuffixu, flowLinii, normalizuj, scenariuszeFazy, zakresFazy } from './scenariusze.mjs'

/** Przyczyny SKIP z wpisu testera -> co dzieje sie ze scenariuszem. Kopia w dev-docs-review-wf.js (test rownosci). */
export const PRZYCZYNY_SKIP = Object.freeze({
  srodowisko: 'manual', 'limit-zewnetrzny': 'manual', harness: 'manual', 'tester-padl': 'manual',
  'brak-seeda': 'fix', 'scenariusz-niewykonalny': 'fix',
})
const DLUGOSC_POWODU = 160
const POWOD_BRAKU_WPISU = 'brak wpisu testera'

/**
 * @typedef {{ checkbox?: string, flow?: string, wynik: string, przyczyna?: string, dowod?: string }} Przebieg
 * @typedef {{ przyczyna: string, powod: string }} BrakWpisu
 * @typedef {{ wynik: 'PASS' | 'FAIL' | 'SKIP' | 'BRAK', przyczyna?: string, powod?: string }} Werdykt
 * @typedef {{ faza: number, flow: string | null, przyczyna: string, powod: string, linia: string }} PozycjaManual
 * @typedef {{ pass: string[], fail: string[], skip: string[], manual: PozycjaManual[], bezWpisu: string[] }} Zmiany
 * @typedef {import('./scenariusze.mjs').LiniaScenariusza} LiniaScenariusza
 */

/** @param {string | undefined} przyczyna @returns {'manual' | 'fix' | 'skip'} */
export function rodzajPrzyczyny(przyczyna) {
  return przyczyna && Object.hasOwn(PRZYCZYNY_SKIP, przyczyna) ? /** @type {'manual' | 'fix'} */ (PRZYCZYNY_SKIP[/** @type {keyof typeof PRZYCZYNY_SKIP} */ (przyczyna)]) : 'skip'
}

/** @param {string | undefined} dowod @returns {string} jedna linia bez nawiasow okraglych (suffix konczy sie nawiasem) */
function powodZDowodu(dowod) {
  const powod = String(dowod ?? '').replace(/\s+/g, ' ').replace(/\(/g, '[').replace(/\)/g, ']').trim().slice(0, DLUGOSC_POWODU)
  return powod || 'brak powodu w przebiegu testera'
}

/** @param {Przebieg} wpis @param {LiniaScenariusza} linia @returns {boolean} */
function pasuje(wpis, linia) {
  return (linia.flow !== null && wpis.flow === linia.flow) || (!!wpis.checkbox && normalizuj(wpis.checkbox) === normalizuj(linia.tresc))
}

/** @param {Przebieg[]} wpisy @param {BrakWpisu | undefined} brakWpisu @returns {Werdykt} */
function werdykt(wpisy, brakWpisu) {
  if (!wpisy.length) return brakWpisu ? { wynik: 'SKIP', przyczyna: brakWpisu.przyczyna, powod: powodZDowodu(brakWpisu.powod) } : { wynik: 'BRAK' }
  if (wpisy.some((w) => w.wynik === 'FAIL')) return { wynik: 'FAIL' }
  const skipy = wpisy.filter((w) => w.wynik === 'SKIP')
  if (!skipy.length) return { wynik: 'PASS' }
  const rozstrzygajacy = skipy.find((s) => rodzajPrzyczyny(s.przyczyna) === 'fix') ?? skipy.find((s) => rodzajPrzyczyny(s.przyczyna) === 'skip') ?? skipy[0]
  return { wynik: 'SKIP', przyczyna: rozstrzygajacy.przyczyna, powod: powodZDowodu(rozstrzygajacy.dowod) }
}

/** @param {string} tresc @returns {string} tresc linii jako reczna (marker [Manual], bez suffixu) */
const jakoReczna = (tresc) => bezSuffixu(tresc).replaceAll('[E2E]', '[Manual]')

/**
 * @param {LiniaScenariusza} linia
 * @param {Werdykt} w
 * @returns {{ tekst: string, rodzaj: 'pass' | 'fail' | 'skip' | 'manual' | 'bezWpisu' }}
 */
function nowaLinia(linia, w) {
  if (w.wynik === 'PASS') return { tekst: `- [x] ${bezSuffixu(linia.tresc)}`, rodzaj: 'pass' }
  if (w.wynik === 'FAIL') return { tekst: `- [ ] ${/\s\(FAIL[:)]/.test(linia.tresc) ? linia.tresc : bezSuffixu(linia.tresc)}`, rodzaj: 'fail' }
  if (w.wynik === 'BRAK') return { tekst: `- [ ] ${bezSuffixu(linia.tresc)} (SKIP — ${POWOD_BRAKU_WPISU})`, rodzaj: 'bezWpisu' }
  if (rodzajPrzyczyny(w.przyczyna) === 'manual') return { tekst: `- [ ] ${jakoReczna(linia.tresc)} (MANUAL — ${w.przyczyna}: ${w.powod})`, rodzaj: 'manual' }
  return { tekst: `- [ ] ${bezSuffixu(linia.tresc)} (SKIP — ${w.powod})`, rodzaj: 'skip' }
}

/** @param {string} linia @param {LiniaScenariusza} wzor @returns {boolean} kopia scenariusza w Operator checklist (format ksiegowania i scribe'a) */
function czyKopia(linia, wzor) {
  const m = /^- \[[ xX]\] Operator: (.*\[Manual\].*?) — Operator action:.*$/.exec(linia)
  if (!m) return false
  return wzor.flow !== null ? flowLinii(m[1]) === wzor.flow : normalizuj(m[1]) === normalizuj(wzor.tresc)
}

/**
 * Kopie w „## Operator checklist faza N”: usuwa stare kopie flow i dopisuje nowa (SKIP bez [Manual] w linii zrodlowej).
 * @param {string[]} linie
 * @param {number} faza
 * @param {{ wzor: LiniaScenariusza, kopia: string | null }[]} operacje
 * @returns {string[]}
 */
function uzgodnijKopie(linie, faza, operacje) {
  if (!operacje.length) return linie
  const naglowek = new RegExp(`^## Operator checklist faza ${faza}\\b`, 'i')
  let wynik = linie
  let od = wynik.findIndex((l) => naglowek.test(l))
  if (od !== -1) {
    const koniec = wynik.findIndex((l, i) => i > od && /^## /.test(l))
    const doKonca = koniec === -1 ? wynik.length : koniec
    wynik = wynik.filter((l, i) => i <= od || i >= doKonca || !operacje.some((o) => czyKopia(l, o.wzor)))
  }
  const nowe = operacje.flatMap((o) => (o.kopia ? [o.kopia] : []))
  if (!nowe.length) return wynik
  od = wynik.findIndex((l) => naglowek.test(l))
  if (od === -1) {
    const zakres = /** @type {{ od: number, do: number }} */ (zakresFazy(wynik, faza))
    let wstaw = zakres.do
    while (wstaw > zakres.od + 1 && wynik[wstaw - 1] === '') wstaw -= 1
    const blok = ['', `## Operator checklist faza ${faza}`, '', ...nowe, ...(zakres.do < wynik.length ? [''] : [])]
    return [...wynik.slice(0, wstaw), ...blok, ...wynik.slice(zakres.do)]
  }
  const koniec = wynik.findIndex((l, i) => i > od && /^## /.test(l))
  let wstaw = koniec === -1 ? wynik.length : koniec
  while (wstaw > od + 1 && wynik[wstaw - 1] === '') wstaw -= 1
  return [...wynik.slice(0, wstaw), ...nowe, ...wynik.slice(wstaw)]
}

/**
 * Ksieguje niezaznaczone scenariusze [E2E] fazy wedlug przebiegow testera.
 * @param {string} tekst plik zadan
 * @param {number} faza
 * @param {Przebieg[]} przebiegi wpisy testera (albo pojedynczy wpis od fixa)
 * @param {{ brakWpisu?: BrakWpisu, tylkoZWpisem?: boolean }} [opcje] brakWpisu: przyczyna dla flow bez wpisu (pad testera);
 *   tylkoZWpisem: flow bez wpisu zostaja nietkniete
 * @returns {{ tekst: string, zmiany: Zmiany }}
 */
export function zaksiegujFaze(tekst, faza, przebiegi, opcje = {}) {
  const linie = tekst.split('\n')
  /** @type {Map<string, LiniaScenariusza[]>} */
  const grupy = new Map()
  for (const l of scenariuszeFazy(tekst, faza).filter((s) => !s.zaznaczona)) grupy.set(l.klucz, [...(grupy.get(l.klucz) ?? []), l])
  /** @type {Zmiany} */
  const zmiany = { pass: [], fail: [], skip: [], manual: [], bezWpisu: [] }
  /** @type {{ wzor: LiniaScenariusza, kopia: string | null }[]} */
  const operacje = []
  for (const czlonkowie of grupy.values()) {
    const wpisy = przebiegi.filter((w) => czlonkowie.some((l) => pasuje(w, l)))
    if (!wpisy.length && opcje.tylkoZWpisem) continue
    const w = werdykt(wpisy, opcje.brakWpisu)
    let rodzajGrupy = ''
    for (const l of czlonkowie) {
      const { tekst: nowa, rodzaj } = nowaLinia(l, w)
      linie[l.indeks] = nowa
      rodzajGrupy = rodzaj
      if (rodzaj === 'manual') zmiany.manual.push({ faza, flow: l.flow, przyczyna: /** @type {string} */ (w.przyczyna), powod: /** @type {string} */ (w.powod), linia: nowa })
      else zmiany[rodzaj].push(nowa)
    }
    const powod = w.wynik === 'BRAK' ? POWOD_BRAKU_WPISU : w.powod
    const kopia = rodzajGrupy === 'skip' || rodzajGrupy === 'bezWpisu' ? `- [ ] Operator: ${jakoReczna(czlonkowie[0].tresc)} — Operator action: ${powod}` : null
    if (rodzajGrupy !== 'fail') operacje.push({ wzor: czlonkowie[0], kopia })
  }
  return { tekst: uzgodnijKopie(linie, faza, operacje).join('\n'), zmiany }
}
