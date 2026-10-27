// Zrzut do zgloszenia bledu (P27 S3 poz. 27, P29(1)): operator wkleja obraz (Cmd+V) albo wybiera plik, zaznacza prostokat
// na podgladzie, a zgloszenie wysyla przyciety fragment jako PNG do `api/zrzut`. Podglad rysuje canvas z `createImageBitmap` —
// CSP strony narzedzia (`img-src 'self' data:`) nie wpuszcza adresow `blob:`.

const MIN_ZAZNACZENIE_PX = 8
const MAKS_SZEROKOSC_PODGLADU_PX = 560

/**
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Zaznaczenie piksele podgladu
 * @typedef {{ x: number, y: number, szerokosc: number, wysokosc: number }} Kadr piksele obrazu
 */

/** @param {number} v @param {number} max */
const wGranicach = (v, max) => Math.min(Math.max(v, 0), max)

/**
 * @param {Zaznaczenie | null} z
 * @param {number} skala piksele obrazu na piksel podgladu
 * @param {{ szerokosc: number, wysokosc: number }} obraz
 * @returns {Kadr} fragment obrazu; brak albo zaznaczenie ponizej 8 px podgladu (przypadkowy klik) = caly obraz
 */
export function kadrZrzutu(z, skala, obraz) {
  const caly = { x: 0, y: 0, szerokosc: obraz.szerokosc, wysokosc: obraz.wysokosc }
  if (!z || Math.abs(z.x1 - z.x0) < MIN_ZAZNACZENIE_PX || Math.abs(z.y1 - z.y0) < MIN_ZAZNACZENIE_PX) return caly
  const x = wGranicach(Math.round(Math.min(z.x0, z.x1) * skala), obraz.szerokosc)
  const y = wGranicach(Math.round(Math.min(z.y0, z.y1) * skala), obraz.wysokosc)
  const x1 = wGranicach(Math.round(Math.max(z.x0, z.x1) * skala), obraz.szerokosc)
  const y1 = wGranicach(Math.round(Math.max(z.y0, z.y1) * skala), obraz.wysokosc)
  return x1 > x && y1 > y ? { x, y, szerokosc: x1 - x, wysokosc: y1 - y } : caly
}

/**
 * @param {{ formularz: HTMLFormElement, pole: HTMLInputElement, podglad: HTMLCanvasElement, usun: HTMLButtonElement, komunikat: (t: string) => void }} e
 * @returns {{ png: () => Promise<Blob | null>, wyczysc: () => void }} png — przyciety zrzut albo null (bez zrzutu)
 */
export function podepnijZrzut(e) {
  /** @type {ImageBitmap | null} */
  let obraz = null
  /** @type {Zaznaczenie | null} */
  let zaznaczenie = null
  let skala = 1
  /** @type {{ x: number, y: number } | null} */
  let start = null

  const rysuj = () => {
    const kontekst = e.podglad.getContext('2d')
    if (!obraz || !kontekst) return
    kontekst.drawImage(obraz, 0, 0, e.podglad.width, e.podglad.height)
    if (!zaznaczenie) return
    const k = kadrZrzutu(zaznaczenie, 1, { szerokosc: e.podglad.width, wysokosc: e.podglad.height })
    kontekst.fillStyle = 'rgb(0 0 0 / 0.45)'
    kontekst.fillRect(0, 0, e.podglad.width, e.podglad.height)
    kontekst.drawImage(obraz, k.x * skala, k.y * skala, k.szerokosc * skala, k.wysokosc * skala, k.x, k.y, k.szerokosc, k.wysokosc)
    kontekst.strokeStyle = '#e11d48'
    kontekst.lineWidth = 2
    kontekst.strokeRect(k.x, k.y, k.szerokosc, k.wysokosc)
  }

  const wyczysc = () => {
    obraz?.close()
    obraz = null
    zaznaczenie = null
    e.pole.value = ''
    e.podglad.hidden = true
    e.usun.hidden = true
  }

  /** @param {Blob} plik */
  const wczytaj = async (plik) => {
    try {
      const nowy = await createImageBitmap(plik)
      wyczysc()
      obraz = nowy
    } catch {
      // Plik, ktorego przegladarka nie odczyta jako obrazu — zgloszenie idzie bez zrzutu.
      e.komunikat('Tego pliku nie da się odczytać jako obrazu — wklej zrzut ekranu albo wybierz PNG/JPG.')
      return
    }
    skala = Math.max(1, obraz.width / Math.min(MAKS_SZEROKOSC_PODGLADU_PX, e.formularz.clientWidth || MAKS_SZEROKOSC_PODGLADU_PX))
    e.podglad.width = Math.round(obraz.width / skala)
    e.podglad.height = Math.round(obraz.height / skala)
    e.podglad.hidden = false
    e.usun.hidden = false
    rysuj()
  }

  e.pole.addEventListener('change', () => { const plik = e.pole.files?.[0]; if (plik) void wczytaj(plik) })
  e.usun.addEventListener('click', wyczysc)
  // Cmd+V dziala, gdy formularz bledu jest otwarty; wklejony tekst do opisu przechodzi bez zmian.
  document.addEventListener('paste', (z) => {
    const plik = [...(z.clipboardData?.items ?? [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
    if (e.formularz.hidden || !plik) return
    z.preventDefault()
    void wczytaj(plik)
  })
  /** @param {PointerEvent} z */
  const punkt = (z) => {
    const r = e.podglad.getBoundingClientRect()
    return { x: (z.clientX - r.left) * (e.podglad.width / (r.width || 1)), y: (z.clientY - r.top) * (e.podglad.height / (r.height || 1)) }
  }
  e.podglad.addEventListener('pointerdown', (z) => {
    start = punkt(z)
    e.podglad.setPointerCapture(z.pointerId)
  })
  e.podglad.addEventListener('pointermove', (z) => {
    if (!start) return
    const p = punkt(z)
    zaznaczenie = { x0: start.x, y0: start.y, x1: p.x, y1: p.y }
    rysuj()
  })
  e.podglad.addEventListener('pointerup', () => { start = null })

  const png = async () => {
    if (!obraz) return null
    const k = kadrZrzutu(zaznaczenie, skala, { szerokosc: obraz.width, wysokosc: obraz.height })
    const plotno = document.createElement('canvas')
    plotno.width = k.szerokosc
    plotno.height = k.wysokosc
    plotno.getContext('2d')?.drawImage(obraz, k.x, k.y, k.szerokosc, k.wysokosc, 0, 0, k.szerokosc, k.wysokosc)
    return new Promise((ok) => plotno.toBlob(ok, 'image/png'))
  }
  return { png, wyczysc }
}
