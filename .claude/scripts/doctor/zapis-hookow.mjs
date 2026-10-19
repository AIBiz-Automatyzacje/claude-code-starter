#!/usr/bin/env node
// Czesc doctor.sh (P22 A2): hooki projektu nie pisza w drzewie projektu. Plik zapisany przez hook (dawniej cache tsc
// w .claude/tsc-cache/) jest nieśledzony, a bramka gotowosci i autopilot licza drzewo z --untracked-files=all i staja
// na „brudnym drzewie”. Odczyt statyczny plikow .claude/hooks/*: zapis (przekierowanie, mkdir, touch, tee, cp, mv,
// writeFileSync…) do sciezki z katalogu projektu — wprost ($CLAUDE_PROJECT_DIR, $PROJECT_DIR) albo przez zmienna
// zbudowana z niego — oraz zapis sciezka wzgledna po `cd` do projektu. Do tego pozostalosc .claude/tsc-cache/ spoza
// .gitignore. Wiersz TSV jak advisors.mjs; problem = UWAGA (hook dziala, tylko brudzi drzewo).
//
// Uzycie: node zapis-hookow.mjs <katalog-projektu>

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {{ plik: string, linia: number, cel: string }} Zapis */

const ELEMENT = 'zapis hooków'
const KATALOG_HOOKOW = '.claude/hooks'
const STARY_CACHE = '.claude/tsc-cache'
const ZMIENNE_PROJEKTU = ['CLAUDE_PROJECT_DIR', 'PROJECT_DIR']
const ROZSZERZENIA_JS = /\.[cm]?js$/

/**
 * Wyrazenie jest sciezka w katalogu projektu: zaczyna sie od skazonej zmiennej (`"$CACHE_DIR/x"`, `join(projekt, …)`,
 * `` `${projekt}/x` ``, `process.env.CLAUDE_PROJECT_DIR`). Zmienna w srodku (`$(basename "$PROJECT_DIR")`) to nie sciezka.
 * @param {string} wyrazenie @param {Set<string>} skazone @param {boolean} js @returns {boolean}
 */
function zaczynaSieOdSkazonej(wyrazenie, skazone, js) {
  const poczatek = js
    ? wyrazenie.trim().replace(/^(?:path\.)?(?:join|resolve)\(\s*/, '').replace(/^`\$\{\s*/, '').replace(/^process\.env\./, '')
    : wyrazenie.trim().replace(/^["']/, '')
  return [...skazone].some((n) => (js ? new RegExp(`^${n}\\b`) : new RegExp(`^\\$\\{?${n}\\b`)).test(poczatek))
}

/**
 * Zmienne zbudowane ze sciezki projektu (do punktu stalego): `CACHE_DIR="$PROJECT_DIR/…"`, `const katalog = join(projekt, …)`
 * gdzie `projekt = process.env.CLAUDE_PROJECT_DIR`.
 * @param {string[]} linie @param {boolean} js @returns {Set<string>}
 */
function skazoneZmienne(linie, js) {
  const skazone = new Set(ZMIENNE_PROJEKTU)
  const przypisanie = js ? /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/ : /^\s*(?:local\s+|export\s+)?([A-Za-z_]\w*)=(.*)$/
  for (let rozmiar = -1; rozmiar !== skazone.size;) {
    rozmiar = skazone.size
    for (const l of linie) {
      const m = przypisanie.exec(l)
      if (m?.[1] && zaczynaSieOdSkazonej(m[2] ?? '', skazone, js)) skazone.add(m[1])
    }
  }
  return skazone
}

/** @param {string} slowo @returns {boolean} cel wzgledny (po `cd` do projektu = plik w drzewie) */
function wzgledny(slowo) {
  return slowo !== '' && !/^["']?[/$~&(-]/.test(slowo)
}

/** @param {string} linia @returns {boolean[]} dla kazdego znaku: czy lezy w cudzyslowie */
function wCudzyslowie(linia) {
  /** @type {boolean[]} */
  const maska = []
  let otwarty = ''
  for (let i = 0; i < linia.length; i++) {
    const z = linia[i] ?? ''
    if (otwarty) {
      maska.push(true)
      if (z === otwarty && linia[i - 1] !== '\\') otwarty = ''
    } else {
      if (z === '"' || z === "'") otwarty = z
      maska.push(false)
    }
  }
  return maska
}

/** @param {string} linia @returns {string[]} cele zapisu w linii powloki (operatory w cudzyslowie — tekst, nie zapis) */
function celePowloki(linia) {
  const bezKomentarza = linia.replace(/(^|\s)#.*$/, '')
  const maska = wCudzyslowie(bezKomentarza)
  const poza = (/** @type {RegExpMatchArray} */ m) => !maska[m.index ?? 0]
  const cele = [...bezKomentarza.matchAll(/(?<![0-9&<>])>>?\s*("[^"]*"|'[^']*'|[^\s;|&)]+)/g)].filter(poza).map((m) => m[1] ?? '')
  for (const m of [...bezKomentarza.matchAll(/\b(mkdir|touch|tee|cp|mv|rsync|install|ln)\b([^;|&)]*)/g)].filter(poza)) {
    const argumenty = (m[2] ?? '').trim().split(/\s+/).filter((a) => a && !a.startsWith('-'))
    cele.push(...(['mkdir', 'touch', 'tee'].includes(m[1] ?? '') ? argumenty : argumenty.slice(-1)))
  }
  return cele
}

/** @param {string} linia @returns {string[]} pierwsze argumenty funkcji zapisu fs w linii JS */
function celeJs(linia) {
  return [...linia.matchAll(/\b(?:writeFileSync|appendFileSync|mkdirSync|createWriteStream|writeFile|appendFile|mkdir|copyFileSync|renameSync)\(([^,)]*)/g)].map((m) => m[1] ?? '')
}

/**
 * @param {string} plik sciezka wzgledna hooka
 * @param {string} tresc
 * @returns {Zapis[]}
 */
export function zapisyWDrzewie(plik, tresc) {
  const js = ROZSZERZENIA_JS.test(plik)
  const linie = tresc.split('\n')
  const skazone = skazoneZmienne(linie, js)
  /** @type {Zapis[]} */
  const zapisy = []
  let poCd = false
  linie.forEach((l, i) => {
    if (!js && /^\s*cd\s+["']?\$\{?(CLAUDE_PROJECT_DIR|PROJECT_DIR)\b/.test(l)) poCd = true
    for (const cel of js ? celeJs(l) : celePowloki(l)) {
      if (zaczynaSieOdSkazonej(cel, skazone, js) || (poCd && wzgledny(cel))) zapisy.push({ plik, linia: i + 1, cel: cel.trim() })
    }
  })
  return zapisy
}

/** @param {string} projekt @returns {boolean} */
function pozostaloscCache(projekt) {
  if (!existsSync(join(projekt, STARY_CACHE))) return false
  try {
    execFileSync('git', ['-C', projekt, 'check-ignore', '-q', `${STARY_CACHE}/`], { stdio: 'ignore' })
    return false
  } catch {
    // kod 1 = sciezka nie jest ignorowana (albo projekt bez gita) — katalog brudzi drzewo
    return true
  }
}

/**
 * @param {string} projekt
 * @returns {[string, string, string, string]}
 */
export function wierszZapisu(projekt) {
  const katalog = join(projekt, KATALOG_HOOKOW)
  const pliki = existsSync(katalog) ? readdirSync(katalog).filter((n) => statSync(join(katalog, n)).isFile()).sort() : []
  const zapisy = pliki.flatMap((n) => zapisyWDrzewie(`${KATALOG_HOOKOW}/${n}`, readFileSync(join(katalog, n), 'utf8')))
  const problemy = zapisy.map((z) => `${z.plik}:${z.linia} pisze do ${z.cel}`)
  const naprawy = zapisy.length ? ['zapis hooka przenieś do katalogu tymczasowego (${TMPDIR:-/tmp})'] : []
  if (pozostaloscCache(projekt)) {
    problemy.push(`${STARY_CACHE}/ spoza .gitignore (pozostałość starego hooka Stop)`)
    naprawy.push(`usuń katalog ${STARY_CACHE}/ — cache hooka jest teraz w katalogu tymczasowym`)
  }
  if (!pliki.length && !problemy.length) return [ELEMENT, 'nie dotyczy', `brak ${KATALOG_HOOKOW}/`, '—']
  if (!problemy.length) return [ELEMENT, 'OK', `${pliki.length} plików w ${KATALOG_HOOKOW}/ bez zapisu w drzewie projektu`, '—']
  return [ELEMENT, 'UWAGA', `${problemy.join('; ')} — brudne drzewo zatrzyma bramkę gotowości i autopilota`, naprawy.join('; ')]
}

// realpath: katalog tymczasowy macOS (/var → /private/var) daje rozne zapisy tej samej sciezki.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projekt = process.argv[2]
  if (!projekt) {
    process.stderr.write('Użycie: node zapis-hookow.mjs <katalog-projektu>\n')
    process.exit(2)
  }
  process.stdout.write(`${wierszZapisu(projekt).join('\t')}\n`)
}
