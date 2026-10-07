// Linie scenariuszy [E2E] w pliku zadan (kontrakt docs/active/): wspolne zrodlo dla liczenia (start autopilota, dossier,
// completion-gate), ksiegowania po testerze i listy pozycji przeniesionych do recznego sprawdzenia.
//
// Scenariusz = niewciety checkbox z markerem [E2E], bez kopii `Operator:` z Operator checklist i bez pozycji findingow
// `[P1]/[P2]/[P3]` z „Do poprawy”. Identyfikator flow = pierwszy backtick linii; linia bez backticka (starszy format)
// dopasowuje sie po znormalizowanej tresci.

/** Suffix wyniku dopisany do linii scenariusza przez ksiegowanie albo fix: SKIP, FAIL, MANUAL (zawsze ostatni w linii). */
const SUFFIX = /\s\((?:SKIP —|FAIL[:)]|MANUAL —)/
const SUFFIX_MANUAL = /\s\(MANUAL — ([a-z-]+): (.*)\)$/
const NAGLOWEK = /^(#{1,6})\s/

/**
 * @typedef {{ indeks: number, faza: number | null, zaznaczona: boolean, tresc: string, flow: string | null, klucz: string }} LiniaScenariusza
 */

/** @param {string} linia @returns {boolean} niewciety checkbox [E2E] (zaznaczony albo nie), ktory jest scenariuszem fazy */
export function czyScenariusz(linia) {
  return /^- \[[ xX]\] .*\[E2E\]/.test(linia) && !/Operator:|\[P[123]\]/.test(linia)
}

/**
 * Niezaznaczone scenariusze [E2E] — ten sam warunek co dawny grep `^- \[ \].*\[E2E\]` bez `Operator:|\[P[123]\]`.
 * @param {string} tekst plik zadan albo sekcja fazy
 * @returns {number}
 */
export function liczE2e(tekst) {
  return tekst.split('\n').filter((l) => /^- \[ \]/.test(l) && czyScenariusz(l)).length
}

/** @param {string} tresc linia bez `- [ ] ` @returns {string} tresc bez koncowego suffixu wyniku */
export function bezSuffixu(tresc) {
  const m = SUFFIX.exec(tresc)
  return m && tresc.trimEnd().endsWith(')') ? tresc.slice(0, m.index) : tresc
}

/** @param {string} tresc @returns {string | null} pierwszy backtick linii */
export function flowLinii(tresc) {
  return /`([^`]+)`/.exec(tresc)?.[1] ?? null
}

/** @param {string} tresc @returns {string} tresc do dopasowania: bez checkboxa, suffixu, markera i bialych znakow */
export function normalizuj(tresc) {
  return bezSuffixu(tresc.replace(/^- \[[ xX]\]\s*/, '')).replace(/\[(?:E2E|Manual)\]/g, '').replace(/\s+/g, '').toLowerCase()
}

/** @param {string} linia @returns {number | null} numer fazy z naglowka `Faza N` dowolnego poziomu (jak dossier) */
function numerFazy(linia) {
  const m = /^#{1,6}\s+Faza\s+(\d+)\b/.exec(linia)
  return m ? Number(m[1]) : null
}

/** @param {string} linia @returns {number} poziom naglowka markdown (Infinity, gdy linia nie jest naglowkiem) */
const poziom = (linia) => NAGLOWEK.exec(linia)?.[1].length ?? Infinity

/**
 * Zakres linii sekcji fazy: od naglowka `Faza N` do nastepnego naglowka tego samego albo wyzszego poziomu (w formacie
 * generatora `## Operator checklist faza N` i „## Do poprawy” to osobne sekcje).
 * @param {string[]} linie
 * @param {number} faza
 * @returns {{ od: number, do: number } | null}
 */
export function zakresFazy(linie, faza) {
  const od = linie.findIndex((l) => numerFazy(l) === faza)
  if (od === -1) return null
  const nastepny = linie.findIndex((l, i) => i > od && poziom(l) <= poziom(linie[od]))
  return { od, do: nastepny === -1 ? linie.length : nastepny }
}

/** @param {string} linia @param {number} indeks @param {number | null} faza @returns {LiniaScenariusza} */
function opisLinii(linia, indeks, faza) {
  const tresc = linia.replace(/^- \[[ xX]\] /, '')
  const flow = flowLinii(tresc)
  return { indeks, faza, zaznaczona: /^- \[[xX]\]/.test(linia), tresc, flow, klucz: flow ? `flow:${flow}` : `tresc:${normalizuj(tresc)}` }
}

/**
 * Scenariusze [E2E] sekcji fazy (zaznaczone i nie), w kolejnosci pliku.
 * @param {string} tekst plik zadan
 * @param {number} faza
 * @returns {LiniaScenariusza[]}
 */
export function scenariuszeFazy(tekst, faza) {
  const linie = tekst.split('\n')
  const zakres = zakresFazy(linie, faza)
  if (!zakres) return []
  return linie.slice(zakres.od, zakres.do).flatMap((l, i) => (czyScenariusz(l) ? [opisLinii(l, zakres.od + i, faza)] : []))
}

/**
 * Pozycje przeniesione w runie z [E2E] na [Manual] (suffix `(MANUAL — <przyczyna>: <powod>)`) — wejscie smoke'u operatora.
 * @param {string} tekst plik zadan
 * @returns {{ faza: number | null, tresc: string, przyczyna: string, powod: string }[]}
 */
export function listaManual(tekst) {
  let faza = /** @type {number | null} */ (null)
  return tekst.split('\n').flatMap((l) => {
    faza = numerFazy(l) ?? faza
    const m = /^- \[ \] .*\[Manual\]/.test(l) && !/Operator:/.test(l) ? SUFFIX_MANUAL.exec(l) : null
    return m ? [{ faza, tresc: bezSuffixu(l.replace(/^- \[ \] /, '')), przyczyna: m[1], powod: m[2] }] : []
  })
}
