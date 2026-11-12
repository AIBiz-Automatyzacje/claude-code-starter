// Zapis przegladu spojnosci planu (punkt 41, kroki 3 i 5). /dev-plan (krok 6.2b) puszcza agenta `spojnosc-planu` na kazda faze,
// operator rozstrzyga znaleziska, sesja poprawia plan i powtarza przeglad do zera otwartych pozycji, potem zapisuje wynik obok
// planu: `docs/plans/<plan>.spojnosc.json` z odciskiem planu. Bramka gotowosci jest czerwona bez zapisu, przy innym odcisku
// (plan zmieniony po przegladzie), przy otwartych pozycjach albo przy fazie bez przegladu.
//
// Odcisk liczymy bez stanu checkboxow: execute odhacza scenariusze i weryfikacje w planie technicznym po kazdej fazie
// (dev-docs-execute-wf, domkniecie pkt 4), wiec odcisk calego pliku zmienialby sie po fazie 1 i bramka po wznowieniu bylaby
// czerwona na stale. Zmiana tresci planu (Podejscie, Teksty, Granice, nowa pozycja) zmienia odcisk.
//
// Weryfikacja partii 26–45, punkt 53: domkniecie fazy dopisywalo do planu decyzje korygujace i bramka po wznowieniu robila sie
// czerwona bez winy operatora; odcisk zmienialy tez odhaczenia w listach `1.`/`+`/cytacie, spacje koncowe, koncowe `\n` i BOM.
// Decyzje z realizacji ida teraz do osobnej sekcji SEKCJA_REALIZACJI, ktorej odcisk nie liczy (do nastepnego `## ` albo konca
// pliku). Odciski zapisane przed ta zmiana przestaja pasowac; zaden projekt nie mial jeszcze zapisow (punkt 41 nie byl
// synchronizowany), wiec migracji nie ma.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Sekcja planu, do ktorej domkniecie fazy pisze decyzje korygujace plan; odcisk jej nie liczy. */
export const SEKCJA_REALIZACJI = '## Decyzje z realizacji'
const NAZWA_SEKCJI_REALIZACJI = /^decyzje z realizacji:?$/i

/**
 * @param {string} tresc plan techniczny
 * @returns {string} sha256 tresci bez sekcji realizacji, stanu checkboxow, BOM, roznic konca linii i bialych znakow na koncach
 */
export function odciskPlanu(tresc) {
  const linie = tresc.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')
  // Walidacja 51–55, punkt 61: sekcje pisze agent domkniecia, wiec naglowek bywa o poziom nizej (`###`), z dwukropkiem albo
  // inna wielkoscia liter — taka sekcja tez nie wchodzi do odcisku. Konczy ja naglowek tego samego albo wyzszego poziomu.
  let poziomSekcji = 0
  const bezSekcji = linie.filter((l) => {
    const naglowek = /^(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(l)
    if (naglowek) {
      const poziom = (naglowek[1] ?? '').length
      if ((poziom === 2 || poziom === 3) && NAZWA_SEKCJI_REALIZACJI.test(naglowek[2] ?? '')) poziomSekcji = poziom
      else if (poziomSekcji && poziom <= poziomSekcji) poziomSekcji = 0
    }
    return !poziomSekcji
  })
  const znormalizowany = bezSekcji.join('\n')
    // Checkbox w komorce tabeli (znalezisko 53 go wymienialo): odhaczenie nie zmienia odcisku, jak w listach.
    .replace(/(\|[ \t]*)\[[xX]\](?=[ \t]*\|)/g, '$1[ ]')
    .replace(/^([ \t]*(?:>[ \t]*)*(?:[-*+]|\d+[.)])[ \t]+)\[[xX]\]/gm, '$1[ ]')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '')
  return createHash('sha256').update(znormalizowany).digest('hex')
}

/** @param {string} planRel sciezka planu wzgledem projektu @returns {string} sciezka zapisu przegladu obok planu */
export function plikPrzegladu(planRel) {
  return planRel.replace(/\.md$/, '') + '.spojnosc.json'
}

/**
 * @param {string} projekt
 * @param {string} planRel
 * @param {{ fazy: string[], otwarte: number, data: string }} o
 * @returns {{ plik: string, odcisk: string }}
 */
export function zapiszPrzeglad(projekt, planRel, { fazy, otwarte, data }) {
  const odcisk = odciskPlanu(readFileSync(join(projekt, planRel), 'utf8'))
  const plik = plikPrzegladu(planRel)
  const zapis = { plan: planRel, odcisk, data, fazy: [...new Set(fazy)], otwarte }
  writeFileSync(join(projekt, plik), `${JSON.stringify(zapis, null, 2)}\n`)
  return { plik, odcisk }
}

/**
 * @typedef {{ ok: boolean, plik: string | null, odcisk: string | null, zapisany: string | null, otwarte: number | null,
 *   fazyBez: string[], powod: string }} StanPrzegladu
 */

/**
 * @param {string} projekt
 * @param {string | null} planRel
 * @param {string[]} fazyPlanu oznaczenia faz planu (`1`, `2a`; kazda wymaga przegladu)
 * @returns {StanPrzegladu}
 */
export function stanPrzegladu(projekt, planRel, fazyPlanu) {
  const pusty = { plik: null, odcisk: null, zapisany: null, otwarte: null, fazyBez: [] }
  if (!planRel || !existsSync(join(projekt, planRel))) return { ok: false, ...pusty, powod: 'brak planu technicznego — przegląd spójności niemożliwy' }
  const plik = plikPrzegladu(planRel)
  const odcisk = odciskPlanu(readFileSync(join(projekt, planRel), 'utf8'))
  const naprawa = `/dev-plan krok 6.2b: przegląd spójności każdej fazy, potem plan.mjs spojnosc ${planRel} --zapisz --fazy <numery> --otwarte 0`
  if (!existsSync(join(projekt, plik))) return { ok: false, ...pusty, plik, odcisk, fazyBez: fazyPlanu, powod: `brak zapisu przeglądu spójności planu → ${naprawa}` }
  /** @type {{ odcisk?: unknown, fazy?: unknown, otwarte?: unknown }} */
  let zapis
  try {
    zapis = JSON.parse(readFileSync(join(projekt, plik), 'utf8'))
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return { ok: false, ...pusty, plik, odcisk, fazyBez: fazyPlanu, powod: `zapis przeglądu nie jest JSON-em → ${naprawa}` }
  }
  const zapisany = typeof zapis.odcisk === 'string' ? zapis.odcisk : null
  const otwarte = typeof zapis.otwarte === 'number' ? zapis.otwarte : null
  const przejrzane = Array.isArray(zapis.fazy) ? zapis.fazy.map(String) : []
  const fazyBez = fazyPlanu.filter((f) => !przejrzane.includes(f))
  const powod = zapisany !== odcisk ? `plan zmieniony po przeglądzie spójności (odcisk inny niż w ${plik}) → ${naprawa}`
    : otwarte !== 0 ? `przegląd spójności ma otwarte pozycje (${otwarte ?? 'brak liczby'}) → rozstrzygnij je z operatorem, popraw plan i powtórz przegląd`
      : fazyBez.length ? `fazy bez przeglądu spójności: ${fazyBez.join(', ')} → ${naprawa}`
        : ''
  return { ok: !powod, plik, odcisk, zapisany, otwarte, fazyBez, powod }
}
