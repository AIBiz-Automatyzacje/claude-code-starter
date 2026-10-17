// Rejestr stalych planu technicznego (P20 A6): tabela `## Rejestr stałych` i uwaga, gdy stala powstaje w fazie wczesniejszej
// niz wszyscy jej konsumenci. vibersi etap 3: plan dal stale `src/config/konto.ts` do IU-1 (faza 1), konsumenci byli w fazach
// 2–5 — knip w domknieciu fazy 1 zglosil 8 eksportow bez konsumenta, builder je usunal, a IU-3–IU-8 dopisaly je ponownie.

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {{ stala: string, zrodlo: string, konsumenci: number[] }} StalaRejestru
 */

const SEKCJA = /^##\s+Rejestr sta[lł]ych\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m

/** @param {string} komorka @returns {string} tresc komorki bez backtickow */
const bezBacktickow = (komorka) => komorka.replace(/`/g, '').trim()

/**
 * Wiersze tabeli `| Stała | Wartość | Źródło | Konsumenci |`. Konsumenci = numery IU z kolumny (dopiski w nawiasach i wpisy
 * spoza planu, np. „szablony maili”, pomijane).
 * @param {string} md tresc planu
 * @returns {StalaRejestru[]}
 */
export function rejestrStalych(md) {
  const sekcja = SEKCJA.exec(md)?.[1] ?? ''
  /** @type {StalaRejestru[]} */
  const wiersze = []
  for (const linia of sekcja.split('\n')) {
    if (!/^\s*\|/.test(linia) || /^\s*\|\s*:?-{3,}/.test(linia)) continue
    const komorki = linia.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/)
    if (komorki.length < 4 || /^\s*Sta[lł]a\s*$/i.test(komorki[0])) continue
    const konsumenci = [...komorki[3].replace(/\([^)]*\)/g, '').matchAll(/\bIU-(\d+)\b/g)].map((m) => Number(m[1]))
    wiersze.push({ stala: bezBacktickow(komorki[0]), zrodlo: bezBacktickow(komorki[2]), konsumenci })
  }
  return wiersze
}

/**
 * Stala, ktorej IU-zrodlo jest w fazie wczesniejszej niz wszyscy konsumenci (IU-zrodlo na liscie konsumentow = konsument
 * w jej fazie, wiec bez uwagi). IU-zrodlo = pierwsza IU z plikiem zrodla w tabeli plikow, ktorej opis (Cel, Podejscie) wymienia stala;
 * bez takiej — pierwsza IU z tym plikiem. Jedna uwaga na IU-zrodlo, z lista stalych i najwczesniejszym konsumentem.
 * @param {Plan} plan
 * @param {Jednostka[]} jednostki IU planu w kolejnosci pliku
 * @returns {string[]}
 */
export function uwagiRejestru(plan, jednostki) {
  const faza = new Map(jednostki.map((iu) => [iu.numer, iu.faza]))
  /** @type {Map<Jednostka, { stale: string[], pierwszy: number }>} */
  const zaWczesnie = new Map()
  for (const { stala, zrodlo, konsumenci } of plan.rejestr) {
    // `TRASY.potwierdz` to pole obiektu, nie eksport — knip nie zglasza nieuzywanych pol, a sam obiekt ma juz konsumentow.
    if (stala.includes('.')) continue
    const zPlikiem = jednostki.filter((iu) => iu.pliki.some((p) => p.sciezka === zrodlo))
    const iuZrodlo = zPlikiem.find((iu) => iu.opis.includes(stala)) ?? zPlikiem[0]
    const fazyKonsumentow = konsumenci.map((n) => faza.get(n)).filter((f) => typeof f === 'number')
    if (!iuZrodlo || iuZrodlo.faza === null || !fazyKonsumentow.length) continue
    const pierwsza = Math.min(...fazyKonsumentow)
    if (pierwsza <= iuZrodlo.faza) continue
    const wpis = zaWczesnie.get(iuZrodlo) ?? { stale: [], pierwszy: pierwsza }
    wpis.stale.push(stala)
    wpis.pierwszy = Math.min(wpis.pierwszy, pierwsza)
    zaWczesnie.set(iuZrodlo, wpis)
  }
  return [...zaWczesnie].map(([iu, { stale, pierwszy }]) => `${iu.id} (faza ${iu.faza}) definiuje stałe z rejestru ${stale.join(', ')},`
    + ` a ich konsumenci zaczynają się w fazie ${pierwszy} — knip w domknięciu fazy ${iu.faza} zgłosi eksporty bez konsumenta;`
    + ' stała powstaje w IU pierwszego konsumenta (wiersz pliku źródła w jej tabeli plików)')
}
