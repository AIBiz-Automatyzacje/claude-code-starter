// Presety urzadzen narzedzia makiet (P24 IU-7) — modul czysty, wspolny dla testow i strony (serwer podaje go pod
// `/__makieta/urzadzenia.mjs`). Domyslnie ramki urzadzen o szerokosci w granicach ±24 px od makiety; zadne nie pasuje
// (komponent 358, 480, 520, 1104) — ramka „wymiar makiety W×H” plus desktop-1440 (makieta >= 600 px albo punkt „Komputer”)
// albo iphone-15. Makieta nizsza niz polowa najnizszego z presetow pasujacych szerokoscia to komponent (arkusz 358×234 obok
// iphone-se 375×667), nie ekran — wtedy zaden preset nie pasuje (plan wymienia 358 jako „bez trafienia”, choc 375 − 358 < 24);
// decyzja zapada dla calej makiety, nie per preset.

export const PRESETY = Object.freeze([
  { id: 'iphone-se', nazwa: 'iPhone SE', szerokosc: 375, wysokosc: 667 },
  { id: 'iphone-15', nazwa: 'iPhone 15', szerokosc: 393, wysokosc: 852 },
  { id: 'pixel-8', nazwa: 'Pixel 8', szerokosc: 412, wysokosc: 915 },
  { id: 'ipad-mini', nazwa: 'iPad mini', szerokosc: 768, wysokosc: 1024 },
  { id: 'ipad-11', nazwa: 'iPad 11″', szerokosc: 834, wysokosc: 1194 },
  { id: 'laptop-1280', nazwa: 'Laptop 1280', szerokosc: 1280, wysokosc: 800 },
  { id: 'desktop-1440', nazwa: 'Komputer 1440', szerokosc: 1440, wysokosc: 900 },
])
const TOLERANCJA_PX = 24
const PROG_KOMPUTERA_PX = 600
const MAKS_WYMIAR = 10_000

/**
 * @typedef {{ id: string, nazwa: string, szerokosc: number, wysokosc: number }} Urzadzenie
 * @typedef {{ szerokosc: number, wysokosc: number }} Wymiary
 */

/** @param {string} id @returns {Urzadzenie} */
const preset = (id) => /** @type {Urzadzenie} */ (PRESETY.find((p) => p.id === id))

/**
 * @param {Wymiary | null} makieta wymiary makiety ekranu (null = nieznane)
 * @param {string} etykieta tresc punktu (zaczyna sie od urzadzenia: „Telefon…”, „Komputer…”)
 * @returns {Urzadzenie[]}
 */
export function domyslneUrzadzenia(makieta, etykieta) {
  const { szerokosc: w, wysokosc: h } = makieta ?? { szerokosc: 0, wysokosc: 0 }
  if (!makieta || !(w >= 1 && h >= 1 && w <= MAKS_WYMIAR && h <= MAKS_WYMIAR)) return [preset('iphone-15'), preset('desktop-1440')]
  const poSzerokosci = PRESETY.filter((p) => Math.abs(p.szerokosc - w) <= TOLERANCJA_PX)
  const komponent = poSzerokosci.length > 0 && h * 2 < Math.min(...poSzerokosci.map((p) => p.wysokosc))
  if (poSzerokosci.length && !komponent) return poSzerokosci
  const komputer = w >= PROG_KOMPUTERA_PX || /^komputer/i.test(etykieta.trim())
  return [{ id: `makieta-${w}x${h}`, nazwa: `wymiar makiety ${w}×${h}`, szerokosc: w, wysokosc: h }, preset(komputer ? 'desktop-1440' : 'iphone-15')]
}

/** @param {string} tekst wymiar wpisany przez operatora, np. „390×844” albo „1200 x 700” @returns {Urzadzenie | null} */
export function urzadzenieZWymiaru(tekst) {
  const m = /^\s*(\d+)\s*[×x]\s*(\d+)\s*$/i.exec(tekst)
  if (!m) return null
  const [w, h] = [Number(m[1]), Number(m[2])]
  if (w < 1 || h < 1 || w > MAKS_WYMIAR || h > MAKS_WYMIAR) return null
  return { id: `wlasny-${w}x${h}`, nazwa: `własny ${w}×${h}`, szerokosc: w, wysokosc: h }
}
