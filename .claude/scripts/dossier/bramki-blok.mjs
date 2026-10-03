// Bloki z wyniku bramek domkniecia (.claude/scripts/bramki/bramki.mjs) do dossier. Zrodlo = plik, ktory domkniecie
// nadpisuje przy kazdym przebiegu bramek, wiec to zawsze OSTATNI przebieg: kod po naprawie, ktory ogladaja reviewerzy.

import { existsSync, readFileSync } from 'node:fs'

/** @typedef {import('../bramki/uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('../bramki/uruchom.mjs').Trafienie} Trafienie */

/** @param {Trafienie[] | undefined} trafienia @returns {string} */
function lista(trafienia) {
  if (!trafienia || !trafienia.length) return '- brak'
  return trafienia.map((t) => `- ${t.plik ?? '?'}${t.linia === null ? '' : `:${t.linia}`} ${t.regula} — ${t.opis}`).join('\n')
}

/**
 * @param {string | null} plik wynik JSON bramek z ostatniego przebiegu
 * @returns {string} tresc sekcji dossier
 */
export function blokBramek(plik) {
  if (!plik) return 'Brak wyniku bramek: bramki nie biegly w tej fazie albo plik wyniku zniknal — bloki ostrzezen, knipa i mutantow pominiete.'
  if (!existsSync(plik)) return `Brak wyniku bramek: plik ${plik} nie istnieje — bloki ostrzezen, knipa i mutantow pominiete.`
  /** @type {Record<string, WynikBramki>} */
  let wynik
  try {
    wynik = JSON.parse(readFileSync(plik, 'utf8'))
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return `Brak wyniku bramek: plik ${plik} nie jest JSON-em (${e.message}) — bloki pominiete.`
  }
  const statusy = Object.entries(wynik).map(([nazwa, w]) => `${nazwa} ${w.status}`).join(', ')
  return [
    `Statusy: ${statusy}`,
    '',
    '### Ostrzezenia ESLint na liniach fazy — wejscie code-quality',
    lista(wynik.eslint?.ostrzezenia),
    '',
    `### knip — martwy kod w plikach fazy (zastane poza faza: ${wynik.knip?.zastane ?? 0})`,
    lista(wynik.knip?.trafienia),
    '',
    '### Przezyte mutanty (Stryker, linie fazy) — wejscie test-coverage',
    lista(wynik.stryker?.trafienia),
  ].join('\n')
}
