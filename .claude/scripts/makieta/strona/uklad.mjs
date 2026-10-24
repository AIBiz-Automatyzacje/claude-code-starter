// Uklad strony narzedzia makiet (P28 pilot etapu 5): rozdzielacz miedzy aplikacja a makieta — udzial kolumny aplikacji
// w procentach (20–80), przeciaganiem albo klawiatura, pamietany w localStorage (z try/catch; bez niego — do przeladowania).

export const MIN_UDZIAL = 20
export const MAX_UDZIAL = 80
const DOMYSLNY_UDZIAL = 55
const KROK_KLAWISZA = 5
const KLUCZ_UDZIALU = 'makieta.udzial'

/** @param {number} u @returns {number} */
const wGranicach = (u) => Math.min(MAX_UDZIAL, Math.max(MIN_UDZIAL, Math.round(u)))

/**
 * @param {number} x polozenie wskaznika (clientX)
 * @param {{ left: number, width: number }} uklad prostokat calego ukladu
 * @returns {number | null} udzial aplikacji w procentach albo null (uklad bez szerokosci)
 */
export function udzialZPozycji(x, { left, width }) {
  return width > 0 ? wGranicach(((x - left) / width) * 100) : null
}

/** @param {number} udzial @param {string} klawisz @returns {number | null} nowy udzial albo null (klawisz bez znaczenia) */
export function udzialPoKlawiszu(udzial, klawisz) {
  if (klawisz === 'ArrowLeft') return wGranicach(udzial - KROK_KLAWISZA)
  if (klawisz === 'ArrowRight') return wGranicach(udzial + KROK_KLAWISZA)
  if (klawisz === 'Home') return MIN_UDZIAL
  if (klawisz === 'End') return MAX_UDZIAL
  return null
}

/** @returns {number} */
function zapisanyUdzial() {
  try {
    const u = Number(localStorage.getItem(KLUCZ_UDZIALU))
    return u >= MIN_UDZIAL && u <= MAX_UDZIAL ? u : DOMYSLNY_UDZIAL
  } catch {
    // localStorage niedostepny (prywatne okno) — udzial domyslny.
    return DOMYSLNY_UDZIAL
  }
}

/**
 * Podpina rozdzielacz: przeciaganie (z przechwyceniem wskaznika — ramki iframe nie zabieraja ruchu) i klawiatura.
 * @param {{ uklad: HTMLElement, rozdzielacz: HTMLElement, poZmianie: () => void }} o poZmianie: np. nowa skala ramek
 */
export function podepnijRozdzielacz({ uklad, rozdzielacz, poZmianie }) {
  /** @param {number} u */
  const ustaw = (u) => {
    uklad.style.setProperty('--udzial-aplikacji', `${u}%`)
    rozdzielacz.setAttribute('aria-valuenow', String(u))
    try {
      localStorage.setItem(KLUCZ_UDZIALU, String(u))
    } catch {
      // Bez localStorage udzial dziala do przeladowania strony — tylko wygoda operatora.
    }
    poZmianie()
  }
  ustaw(zapisanyUdzial())
  let przeciagany = false
  rozdzielacz.addEventListener('pointerdown', (z) => {
    if (z.button !== 0) return
    przeciagany = true
    rozdzielacz.setPointerCapture(z.pointerId)
    uklad.classList.add('uklad--przeciagany')
  })
  rozdzielacz.addEventListener('pointermove', (z) => {
    const u = przeciagany ? udzialZPozycji(z.clientX, uklad.getBoundingClientRect()) : null
    if (u !== null) ustaw(u)
  })
  const koniec = () => {
    przeciagany = false
    uklad.classList.remove('uklad--przeciagany')
  }
  rozdzielacz.addEventListener('pointerup', koniec)
  rozdzielacz.addEventListener('pointercancel', koniec)
  rozdzielacz.addEventListener('keydown', (z) => {
    const u = udzialPoKlawiszu(Number(rozdzielacz.getAttribute('aria-valuenow')), z.key)
    if (u === null) return
    z.preventDefault()
    ustaw(u)
  })
}
