// Jedyne wywolania gita w telemetrii: pliki i linie commitow fixa (D12: status A/M per plik) oraz blame linii watku bota
// i czas commitu archiwum zadania (ucieczki, E5-20) — tylko odczyt.

import { execFileSync } from 'node:child_process'

// Skan biegnie w hooku po kazdej odpowiedzi — git nie moze go zawiesic.
const LIMIT_CZASU_GITA_MS = 5000

/** @typedef {{ plik: string, status: string }} ZmianaPliku */
/** @typedef {{ ok: true, pliki: ZmianaPliku[], linie: { plus: number, minus: number } } | { ok: false, powod: string }} ZmianyCommitow */

/** @param {string} repo @param {string[]} argumenty */
function git(repo, argumenty) {
  return execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8', timeout: LIMIT_CZASU_GITA_MS, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Zmiany wszystkich podanych commitow razem (plik zmieniony w dwoch commitach = jeden wpis, status z pierwszego).
 * Commit nieosiagalny (galaz skasowana po squash-merge'u, repo przeniesione) = { ok: false, powod }.
 * @param {string | null} repo katalog projektu (null = nieznany)
 * @param {string[]} commity hashe commitow fixa
 * @returns {ZmianyCommitow}
 */
export function zmianyCommitow(repo, commity) {
  if (!commity.length) return { ok: true, pliki: [], linie: { plus: 0, minus: 0 } }
  if (!repo) return { ok: false, powod: 'nieznany katalog projektu' }
  /** @type {Map<string, string>} */
  const pliki = new Map()
  const linie = { plus: 0, minus: 0 }
  try {
    for (const sha of commity) {
      for (const wiersz of git(repo, ['show', '--name-status', '--format=', sha]).split('\n').filter(Boolean)) {
        const pola = wiersz.split('\t')
        const plik = pola[pola.length - 1]
        if (!pliki.has(plik)) pliki.set(plik, pola[0].charAt(0))
      }
      for (const wiersz of git(repo, ['show', '--numstat', '--format=', sha]).split('\n').filter(Boolean)) {
        const [plus, minus] = wiersz.split('\t')
        linie.plus += Number(plus) || 0
        linie.minus += Number(minus) || 0
      }
    }
  } catch (e) {
    if (!(e instanceof Error)) throw e
    return { ok: false, powod: e.message.split('\n')[0] }
  }
  return { ok: true, pliki: [...pliki].map(([plik, status]) => ({ plik, status })), linie }
}

/**
 * Temat i czas commitu, ktory ostatni zmienil linie pliku na rewizji. null = linii, pliku albo rewizji nie ma
 * (watek na usunietym pliku, galaz skasowana po squash-merge'u) — watek idzie do kubelka „nieustalone”.
 * @param {string} repo @param {string} rewizja @param {string} plik @param {number} linia
 * @returns {{ temat: string, czas: number } | null}
 */
export function blameLinii(repo, rewizja, plik, linia) {
  let wynik
  try {
    wynik = git(repo, ['blame', '--porcelain', '-L', `${linia},${linia}`, rewizja, '--', plik])
  } catch (e) {
    if (e instanceof Error) return null
    throw e
  }
  const temat = wynik.match(/^summary (.*)$/m)
  const czas = wynik.match(/^committer-time (\d+)$/m)
  return temat && czas ? { temat: temat[1], czas: Number(czas[1]) } : null
}

/**
 * Czas (s) commitu archiwum zadania (`docs(<zadanie>): archiwum`, dev-docs-complete-wf) w historii rewizji; null = brak.
 * @param {string} repo @param {string} rewizja @param {string} zadanie
 * @returns {number | null}
 */
export function czasArchiwum(repo, rewizja, zadanie) {
  let wynik
  try {
    wynik = git(repo, ['log', rewizja, '-1', '--format=%ct', '--fixed-strings', `--grep=docs(${zadanie}): archiwum`]).trim()
  } catch (e) {
    if (e instanceof Error) return null
    throw e
  }
  return /^\d+$/.test(wynik) ? Number(wynik) : null
}
