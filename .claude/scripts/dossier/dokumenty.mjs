// Wycinki dokumentow zadania do dossier fazy. Formaty: plan techniczny z dev-plan (`### Faza N — nazwa`, "Sledzenie
// wymagan" jako lista `- R1.`), plik zadan i kontekstu z generatora planu (`## Faza N`, `## Designerski kontekst`), smoke (`## Faza N:`).

const NAGLOWEK = /^(#{1,6})\s/

/**
 * Sekcja od naglowka do nastepnego naglowka tego samego albo wyzszego poziomu (bez koncowych pustych linii).
 * @param {string[]} linie
 * @param {number} start indeks linii naglowka
 * @returns {string}
 */
function odNaglowka(linie, start) {
  const poziom = (NAGLOWEK.exec(linie[start]) ?? ['', '#'])[1].length
  let koniec = start + 1
  while (koniec < linie.length) {
    const n = NAGLOWEK.exec(linie[koniec])
    if (n && n[1].length <= poziom) break
    koniec++
  }
  return linie.slice(start, koniec).join('\n').trimEnd()
}

/**
 * Pierwsza sekcja, ktorej naglowek pasuje do wzorca; null gdy brak.
 * @param {string} md
 * @param {RegExp} wzorzec dopasowany do calej linii naglowka
 * @returns {string | null}
 */
function sekcja(md, wzorzec) {
  const linie = md.split('\n')
  const start = linie.findIndex((l) => NAGLOWEK.test(l) && wzorzec.test(l))
  return start === -1 ? null : odNaglowka(linie, start)
}

/**
 * Sekcja fazy N (`Faza N` na dowolnym poziomie naglowka; `Faza 1` nie lapie `Faza 10`).
 * @param {string} md
 * @param {number} faza
 * @returns {string | null}
 */
export function sekcjaFazy(md, faza) {
  return sekcja(md, new RegExp(`^#{1,6}\\s+Faza\\s+${faza}(?!\\d)`))
}

/**
 * Wiersze "Sledzenie wymagan" z ID (R1, R2, ...) przywolanymi w sekcji fazy; tabela zachowuje naglowek.
 * @param {string} plan plan techniczny
 * @param {string} sekcjaFazyPlanu
 * @returns {string | null} null gdy plan nie ma sekcji albo faza nie przywoluje zadnego ID
 */
export function wierszeWymagan(plan, sekcjaFazyPlanu) {
  const sledzenie = sekcja(plan, /^#{1,6}\s+[ŚS]ledzenie wymaga[ńn]/i)
  const id = new Set(sekcjaFazyPlanu.match(/\bR\d+\b/g) ?? [])
  if (!sledzenie || !id.size) return null
  const wiersze = sledzenie.split('\n').slice(1).filter((l) => {
    const wiersz = /^\s*(?:[-*]|\|)\s*(R\d+)\b/.exec(l)
    return wiersz ? id.has(wiersz[1]) : /^\s*\|/.test(l) && !/\|\s*R\d+\b/.test(l)
  })
  return wiersze.some((l) => /\bR\d+\b/.test(l)) ? wiersze.join('\n') : null
}

/**
 * Niezaznaczone checkboxy [E2E] (prefiksy Test: i Weryfikacja:) — praca testera przegladarkowego. Ten sam grep co precheck
 * autopilota i completion-gate (`^- \[ \].*\[E2E\]` bez `Operator:|\[P[123]\]`): wciety checkbox jest dla nich niewidoczny,
 * kopie `Operator:` i pozycje findingow `[P1]/[P2]/[P3]` nie sa scenariuszami fazy.
 * @param {string} sekcjaZadan sekcja fazy z pliku zadan (albo caly plik)
 * @returns {number}
 */
export function liczE2e(sekcjaZadan) {
  return sekcjaZadan.split('\n')
    .filter((l) => /^- \[ \].*\[E2E\]/.test(l) && !/Operator:|\[P[123]\]/.test(l))
    .length
}

/**
 * @param {string} kontekstMd plik kontekstu zadania
 * @returns {string | null}
 */
export function sekcjaDesignerska(kontekstMd) {
  return sekcja(kontekstMd, /^#{1,6}\s+Designerski kontekst/i)
}

/**
 * Makiety do visual diffu testera: co najmniej jedna sciezka obrazu w sekcji (lista "Screeny referencyjne").
 * @param {string | null} sekcjaDesign
 * @returns {boolean}
 */
export function czyFigmaScreens(sekcjaDesign) {
  return !!sekcjaDesign && /\.(png|jpe?g|webp|gif)\b/i.test(sekcjaDesign)
}

/**
 * Sciezka planu technicznego z linii `Plan techniczny:` (plan, zadania albo kontekst zadania).
 * @param {string} md
 * @returns {string | null}
 */
export function sciezkaPlanu(md) {
  return /Plan techniczny:\**\s*`?([^\s`]+\.md)/.exec(md)?.[1] ?? null
}
