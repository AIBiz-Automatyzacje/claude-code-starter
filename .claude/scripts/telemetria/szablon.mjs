// `run.szablon` — ktora wersja maszynerii sie wykonala (d5-telemetria-rekord.txt §8 pkt 3).
// Hash repo projektu nie mowi, co sie wykonalo (33/55 runow autopilota puscilo skrypt spoza historii szablonu), wiec
// porownujemy hash SKRYPTU z pliku harnessu z hashem, ktory sync-template zapisal dla tego pliku (.claude/.template-hashes).

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PLIK_MARKERA = join('.claude', '.template-version')
const PLIK_HASHY = join('.claude', '.template-hashes')
const KATALOG_WORKFLOWOW = join('.claude', 'workflows')

/**
 * Hash bloba gita (`git hash-object`) bez wywolania gita.
 * @param {string} tresc
 * @returns {string}
 */
export function hashBloba(tresc) {
  const bajty = Buffer.from(tresc, 'utf8')
  return createHash('sha1').update(`blob ${bajty.length}\0`).update(bajty).digest('hex')
}

/** @param {string} repo @returns {Map<string, string> | null} sciezka -> hash z ostatniego sync-template */
function hasheSzablonu(repo) {
  const plik = join(repo, PLIK_HASHY)
  if (!existsSync(plik)) return null
  const hashe = new Map()
  for (const wiersz of readFileSync(plik, 'utf8').split('\n').filter(Boolean)) {
    const [hash, sciezka] = wiersz.split('\t')
    if (hash && sciezka) hashe.set(sciezka, hash)
  }
  return hashe
}

/**
 * Workflowy-dzieci zmienione wzgledem szablonu albo nadpisane po starcie runu (plik harnessu trzyma tylko skrypt glowny).
 * @param {string} repo @param {Map<string, string>} hashe @param {string} glowny sciezka skryptu glownego @param {number | null} startMs
 */
function dzieciZmienione(repo, hashe, glowny, startMs) {
  const katalog = join(repo, KATALOG_WORKFLOWOW)
  if (!existsSync(katalog)) return false
  return readdirSync(katalog)
    .filter((n) => n.endsWith('-wf.js'))
    .map((n) => join(KATALOG_WORKFLOWOW, n))
    .filter((sciezka) => sciezka !== glowny)
    .some((sciezka) => {
      const pelna = join(repo, sciezka)
      const zmienionyPoStarcie = startMs !== null && statSync(pelna).mtimeMs > startMs
      return zmienionyPoStarcie || hashe.get(sciezka) !== hashBloba(readFileSync(pelna, 'utf8'))
    })
}

/** @typedef {{ marker: string | null, skrypt_sha: string | null, zgodny: boolean | null, dzieci_zmienione: boolean | null }} WersjaSzablonu */

/**
 * @param {{ workflowName: string | null, skrypt: string | null, startMs: number | null, repo: string | null }} we
 * @returns {WersjaSzablonu}
 */
export function wersjaSzablonu(we) {
  const skryptSha = we.skrypt === null ? null : hashBloba(we.skrypt)
  if (!we.repo) return { marker: null, skrypt_sha: skryptSha, zgodny: null, dzieci_zmienione: null }
  const plikMarkera = join(we.repo, PLIK_MARKERA)
  const marker = existsSync(plikMarkera) ? readFileSync(plikMarkera, 'utf8').trim() || null : null
  const hashe = hasheSzablonu(we.repo)
  if (!hashe || !we.workflowName) return { marker, skrypt_sha: skryptSha, zgodny: null, dzieci_zmienione: null }
  const glowny = join(KATALOG_WORKFLOWOW, `${we.workflowName}.js`)
  const hashGlownego = hashe.get(glowny)
  return {
    marker,
    skrypt_sha: skryptSha,
    zgodny: skryptSha === null || hashGlownego === undefined ? null : skryptSha === hashGlownego,
    dzieci_zmienione: dzieciZmienione(we.repo, hashe, glowny, we.startMs),
  }
}
