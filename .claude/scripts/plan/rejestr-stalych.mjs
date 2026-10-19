// Rejestr stalych planu technicznego (P20 A6): tabela `## Rejestr stałych` i uwaga, gdy stala powstaje w fazie wczesniejszej
// niz wszyscy jej konsumenci. vibersi etap 3: plan dal stale `src/config/konto.ts` do IU-1 (faza 1), konsumenci byli w fazach
// 2–5 — knip w domknieciu fazy 1 zglosil 8 eksportow bez konsumenta, builder je usunal, a IU-3–IU-8 dopisaly je ponownie.
// P22 C1: kolumna IU-zrodlo (`| Stała | Wartość | Plik | IU-źródło | Konsumenci |`). vibersi etap 4: zgadywanie IU-zrodla
// (pierwsza IU z plikiem, ktorej opis wymienia stala) wskazalo IU-2, ktora tworzy plik i zapowiada „… dopisuje IU-5”, a stale
// dopisywaly IU-5 i IU-10 — falszywa uwaga. Plan bez kolumny (sprzed P22) = stara heurystyka.

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {{ stala: string, zrodlo: string, konsumenci: number[], iuZrodlo: number | null, kolumnaIu: boolean }} StalaRejestru
 *   iuZrodlo null przy kolumnaIu = stala juz jest w repo (w kolumnie „—”), zadna IU jej nie tworzy
 */

const SEKCJA = /^##\s+Rejestr sta[lł]ych\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m

/** @param {string} komorka @returns {string} tresc komorki bez backtickow */
const bezBacktickow = (komorka) => komorka.replace(/`/g, '').trim()

/** @param {string} komorka @returns {string} nazwa kolumny bez diakrytykow, malymi literami */
const nazwaKolumny = (komorka) => bezBacktickow(komorka).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')

/**
 * Kolumny z naglowka tabeli. Plan sprzed P22: `| Stała | Wartość | Źródło | Konsumenci |` (bez IU-zrodla).
 * @param {string[]} naglowek @returns {{ plik: number, iuZrodlo: number, konsumenci: number }}
 */
function kolumny(naglowek) {
  const nazwy = naglowek.map(nazwaKolumny)
  const iuZrodlo = nazwy.findIndex((n) => /^iu[-\s]?zrodlo$/.test(n))
  const plik = nazwy.findIndex((n) => n === 'plik' || n === 'zrodlo')
  const konsumenci = nazwy.findIndex((n) => n === 'konsumenci')
  return { plik: plik === -1 ? 2 : plik, iuZrodlo, konsumenci: konsumenci === -1 ? 3 : konsumenci }
}

/** @param {string} komorka @returns {number[]} numery IU spoza nawiasow (dopiski i wpisy spoza planu pomijane) */
const numeryIu = (komorka) => [...komorka.replace(/\([^)]*\)/g, '').matchAll(/\bIU-(\d+)\b/g)].map((m) => Number(m[1]))

/**
 * Wiersze tabeli `| Stała | Wartość | Plik | IU-źródło | Konsumenci |` (kolumny po naglowku; plan sprzed P22 — `| Stała |
 * Wartość | Źródło | Konsumenci |`, iuZrodlo null). Konsumenci = numery IU z kolumny (dopiski w nawiasach i wpisy spoza planu,
 * np. „szablony maili”, pomijane).
 * @param {string} md tresc planu
 * @returns {StalaRejestru[]}
 */
export function rejestrStalych(md) {
  const sekcja = SEKCJA.exec(md)?.[1] ?? ''
  /** @type {StalaRejestru[]} */
  const wiersze = []
  let k = kolumny([])
  for (const linia of sekcja.split('\n')) {
    if (!/^\s*\|/.test(linia) || /^\s*\|\s*:?-{3,}/.test(linia)) continue
    const komorki = linia.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/)
    if (/^\s*Sta[lł]a\s*$/i.test(komorki[0] ?? '')) {
      k = kolumny(komorki)
      continue
    }
    if (komorki.length < 4) continue
    const iu = k.iuZrodlo === -1 ? [] : numeryIu(komorki[k.iuZrodlo] ?? '')
    wiersze.push({
      stala: bezBacktickow(komorki[0] ?? ''), zrodlo: bezBacktickow(komorki[k.plik] ?? ''), konsumenci: numeryIu(komorki[k.konsumenci] ?? ''),
      iuZrodlo: iu[0] ?? null, kolumnaIu: k.iuZrodlo !== -1,
    })
  }
  return wiersze
}

/**
 * IU-zrodlo stalej: jawna z kolumny IU-źródło; plan bez kolumny — pierwsza IU z plikiem zrodla w tabeli plikow, ktorej opis
 * (Cel, Podejscie) wymienia stala, a bez takiej pierwsza IU z tym plikiem. Kolumna z „—” = stala juz w repo, bez IU-zrodla.
 * @param {StalaRejestru} stala @param {Jednostka[]} jednostki @returns {Jednostka | undefined}
 */
function iuZrodla({ stala, zrodlo, iuZrodlo, kolumnaIu }, jednostki) {
  if (kolumnaIu) return iuZrodlo === null ? undefined : jednostki.find((iu) => iu.numer === iuZrodlo)
  const zPlikiem = jednostki.filter((iu) => iu.pliki.some((p) => p.sciezka === zrodlo))
  return zPlikiem.find((iu) => iu.opis.includes(stala)) ?? zPlikiem[0]
}

/**
 * Uwagi rejestru: stala, ktorej IU-zrodlo jest w fazie wczesniejszej niz wszyscy konsumenci (IU-zrodlo na liscie konsumentow =
 * konsument w jej fazie, wiec bez uwagi) — jedna uwaga na IU-zrodlo, z lista stalych i najwczesniejszym konsumentem; jawna
 * IU-zrodlo spoza planu albo bez pliku stalej w tabeli plikow.
 * @param {Plan} plan
 * @param {Jednostka[]} jednostki IU planu w kolejnosci pliku
 * @returns {string[]}
 */
export function uwagiRejestru(plan, jednostki) {
  const faza = new Map(jednostki.map((iu) => [iu.numer, iu.faza]))
  /** @type {string[]} */
  const jawne = []
  /** @type {Map<Jednostka, { stale: string[], pierwszy: number }>} */
  const zaWczesnie = new Map()
  for (const wiersz of plan.rejestr) {
    const { stala, zrodlo, konsumenci, iuZrodlo } = wiersz
    const iu = iuZrodla(wiersz, jednostki)
    if (iuZrodlo !== null && !iu) jawne.push(`rejestr stałych: ${stala} — IU-źródło IU-${iuZrodlo} nie ma w planie`)
    if (iuZrodlo !== null && iu && !iu.pliki.some((p) => p.sciezka === zrodlo)) {
      jawne.push(`rejestr stałych: ${stala} — ${iu.id} (IU-źródło) nie ma ${zrodlo} w tabeli plików`)
    }
    // `TRASY.potwierdz` to pole obiektu, nie eksport — knip nie zglasza nieuzywanych pol, a sam obiekt ma juz konsumentow.
    if (stala.includes('.')) continue
    const fazyKonsumentow = konsumenci.map((n) => faza.get(n)).filter((f) => typeof f === 'number')
    if (!iu || iu.faza === null || !fazyKonsumentow.length) continue
    const pierwsza = Math.min(...fazyKonsumentow)
    if (pierwsza <= iu.faza) continue
    const wpis = zaWczesnie.get(iu) ?? { stale: [], pierwszy: pierwsza }
    wpis.stale.push(stala)
    wpis.pierwszy = Math.min(wpis.pierwszy, pierwsza)
    zaWczesnie.set(iu, wpis)
  }
  return [...jawne, ...[...zaWczesnie].map(([iu, { stale, pierwszy }]) => `${iu.id} (faza ${iu.faza}) definiuje stałe z rejestru ${stale.join(', ')},`
    + ` a ich konsumenci zaczynają się w fazie ${pierwszy} — knip w domknięciu fazy ${iu.faza} zgłosi eksporty bez konsumenta;`
    + ' stała powstaje w IU pierwszego konsumenta (kolumna IU-źródło i wiersz pliku w jej tabeli plików)')]
}
