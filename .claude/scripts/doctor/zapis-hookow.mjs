#!/usr/bin/env node
// Czesc doctor.sh (P22 A2): hooki projektu nie pisza w drzewie projektu. Plik zapisany przez hook (dawniej cache tsc
// w .claude/tsc-cache/) jest nieśledzony, a bramka gotowosci i autopilot licza drzewo z --untracked-files=all i staja
// na „brudnym drzewie”. Odczyt statyczny plikow .claude/hooks/*: zapis (przekierowanie, mkdir, touch, tee, cp, mv,
// writeFileSync…) do sciezki z katalogu projektu — wprost ($CLAUDE_PROJECT_DIR, $PROJECT_DIR, process.cwd()) albo przez
// zmienna zbudowana z niego — oraz zapis sciezka wzgledna (hook biegnie w katalogu projektu, chyba ze zrobil `cd` gdzie indziej). Do tego pozostalosc .claude/tsc-cache/ spoza
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
const ROZSZERZENIA_JS = /\.[cm]?[jt]s$/
const ROZSZERZENIA_POWLOKI = /(\.(sh|bash)|^[^.]+)$/
const BEZ_KODU = /\.(md|json|txt|ya?ml|lock)$/
const POLECENIA_ZAPISU = /(?:^|[;&|(]|\$\()\s*(?:sudo\s+)?(mkdir|touch|tee|cp|mv|rsync|install|ln)\b([^;|&)]*)/g
const FUNKCJE_ZAPISU_JS = /\b(writeFileSync|appendFileSync|mkdirSync|createWriteStream|writeFile|appendFile|mkdir|copyFileSync|renameSync|cpSync|rename|copyFile|cp)\(([^)]*)/g
const FUNKCJE_Z_CELEM_DRUGIM = new Set(['copyFileSync', 'renameSync', 'cpSync', 'rename', 'copyFile', 'cp'])

/**
 * Wyrazenie jest sciezka w katalogu projektu: zaczyna sie od skazonej zmiennej (`"$CACHE_DIR/x"`, `join(projekt, …)`,
 * `` `${projekt}/x` ``, `process.env.CLAUDE_PROJECT_DIR`, `process.cwd()`). Zmienna w srodku (`$(basename "$PROJECT_DIR")`)
 * to nie sciezka.
 * @param {string} wyrazenie @param {Set<string>} skazone @param {boolean} js @returns {boolean}
 */
function zaczynaSieOdSkazonej(wyrazenie, skazone, js) {
  if (!js) {
    const poczatek = wyrazenie.trim().replace(/^["']/, '')
    return [...skazone].some((n) => new RegExp(`^\\$\\{?${n}\\b`).test(poczatek))
  }
  const poczatek = wyrazenie.trim().replace(/^(?:path\.)?(?:join|resolve)\(\s*/, '').replace(/^`\$\{\s*/, '')
    .replace(/^process\.env\[["'](\w+)["']\]/, 'process.env.$1').replace(/^process\.env\./, '')
  return /^process\.cwd\(/.test(poczatek) || [...skazone].some((n) => new RegExp(`^${n}\\b`).test(poczatek))
}

/**
 * Zmienne zbudowane ze sciezki projektu (do punktu stalego): `CACHE_DIR="$PROJECT_DIR/…"`, `const katalog = join(projekt, …)`
 * gdzie `projekt = process.env.CLAUDE_PROJECT_DIR`.
 * @param {string[]} linie @param {boolean} js @returns {Set<string>}
 */
function skazoneZmienne(linie, js) {
  const skazone = new Set(ZMIENNE_PROJEKTU)
  const przypisanie = js ? /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/ : /^\s*(?:local\s+|export\s+|readonly\s+|declare\s+(?:-\w+\s+)?)?([A-Za-z_]\w*)=(.*)$/
  for (let rozmiar = -1; rozmiar !== skazone.size;) {
    rozmiar = skazone.size
    for (const l of linie) {
      const m = przypisanie.exec(l)
      if (m?.[1] && zaczynaSieOdSkazonej(m[2] ?? '', skazone, js)) skazone.add(m[1])
    }
  }
  return skazone
}

/** @param {string} slowo @returns {boolean} cel wzgledny — hook biegnie w katalogu projektu, wiec to plik w drzewie */
function wzgledny(slowo) {
  return slowo !== '' && !/^["'`]?[/$~&(<-]/.test(slowo)
}

/** @param {string} linia @returns {string} linia z trescia cudzyslowow, $((…)), ((…)) i [[…]] zamieniona na spacje */
function zamaskuj(linia) {
  let wynik = ''
  let otwarty = ''
  for (let i = 0; i < linia.length; i++) {
    const z = linia[i] ?? ''
    if (otwarty) {
      if (z === otwarty && linia[i - 1] !== '\\') otwarty = ''
      wynik += z === otwarty || !otwarty ? z : ' '
    } else {
      if (z === '"' || z === "'") otwarty = z
      wynik += z
    }
  }
  return wynik.replace(/\(\([^)]*\)\)|\[\[.*?\]\]/g, (m) => ' '.repeat(m.length))
}

/**
 * Cele zapisu w linii powloki. Operator w cudzyslowie, w arytmetyce albo w [[…]] to tekst, nie zapis; cel bierzemy
 * z linii oryginalnej (w cudzyslowie), dopasowanie — z zamaskowanej.
 * @param {string} linia @returns {string[]}
 */
function celePowloki(linia) {
  const maska = zamaskuj(linia)
  const koniec = maska.search(/(^|\s)#/)
  const oryginal = koniec === -1 ? linia : linia.slice(0, koniec)
  const zamaskowana = koniec === -1 ? maska : maska.slice(0, koniec)
  const cel = (/** @type {number} */ od) => /^\s*("[^"]*"|'[^']*'|[^\s;|&)]+)/.exec(oryginal.slice(od))?.[1] ?? ''
  const cele = [...zamaskowana.matchAll(/(?<![<>])(?:&|\d)?>{1,2}\|?/g)].map((m) => cel((m.index ?? 0) + m[0].length))
  for (const m of zamaskowana.matchAll(POLECENIA_ZAPISU)) {
    const start = (m.index ?? 0) + m[0].length - (m[2] ?? '').length
    const argumenty = oryginal.slice(start, start + (m[2] ?? '').length).trim().split(/\s+/)
    const docelowy = argumenty.indexOf('-t')
    const bezOpcji = argumenty.filter((a) => a && !a.startsWith('-') && !/^(\d|&)?>/.test(a))
    if (docelowy !== -1) cele.push(argumenty[docelowy + 1] ?? '')
    else cele.push(...(['mkdir', 'touch', 'tee'].includes(m[1] ?? '') ? bezOpcji : bezOpcji.slice(-1)))
  }
  return cele.filter((c) => !c.startsWith('&'))
}

/** @param {string} argumenty @returns {string[]} argumenty wywolania rozdzielone przecinkami najwyzszego poziomu */
function rozdziel(argumenty) {
  /** @type {string[]} */
  const czesci = ['']
  let glebokosc = 0
  for (const z of argumenty) {
    if ('([{'.includes(z)) glebokosc++
    if (')]}'.includes(z)) glebokosc--
    if (z === ',' && glebokosc === 0) czesci.push('')
    else czesci[czesci.length - 1] += z
  }
  return czesci.map((c) => c.trim())
}

/** @param {string} linia @returns {string[]} cele funkcji zapisu fs w linii JS/TS (copy/rename — drugi argument) */
function celeJs(linia) {
  return [...linia.matchAll(FUNKCJE_ZAPISU_JS)].map((m) => rozdziel(m[2] ?? '')[FUNKCJE_Z_CELEM_DRUGIM.has(m[1] ?? '') ? 1 : 0] ?? '')
}

/** @param {string} cel @returns {boolean} literal tekstowy JS ze sciezka wzgledna (`'.cache/x'`) */
function literalWzgledny(cel) {
  return /^["'`]/.test(cel) && !cel.startsWith('`${') && wzgledny(cel.slice(1))
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
  // Hook biegnie w katalogu projektu; `cd` gdzie indziej przenosi zapisy wzgledne poza drzewo.
  let wProjekcie = true
  let heredoc = ''
  linie.forEach((l, i) => {
    if (heredoc) {
      if (l.trim() === heredoc) heredoc = ''
      return
    }
    if (js) {
      for (const cel of celeJs(l)) {
        if (zaczynaSieOdSkazonej(cel, skazone, true) || literalWzgledny(cel)) zapisy.push({ plik, linia: i + 1, cel })
      }
      return
    }
    const cd = /^\s*cd\s+(\S+)/.exec(zamaskuj(l)) && /^\s*cd\s+("[^"]*"|'[^']*'|\S+)/.exec(l)
    if (cd) wProjekcie = zaczynaSieOdSkazonej(cd[1] ?? '', skazone, false)
    for (const cel of celePowloki(l)) {
      if (zaczynaSieOdSkazonej(cel, skazone, false) || (wProjekcie && wzgledny(cel))) zapisy.push({ plik, linia: i + 1, cel: cel.trim() })
    }
    heredoc = /<<-?\s*["']?(\w+)["']?/.exec(l)?.[1] ?? ''
  })
  return zapisy
}

/** @param {string} projekt @returns {boolean} nieśledzony i nieignorowany .claude/tsc-cache/ (projekt bez gita — nie dotyczy) */
function pozostaloscCache(projekt) {
  if (!existsSync(join(projekt, STARY_CACHE))) return false
  try {
    const status = execFileSync('git', ['-C', projekt, 'status', '--porcelain', '--untracked-files=all', '--', STARY_CACHE], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return status.split('\n').some((l) => l.startsWith('??'))
  } catch {
    // projekt bez gita: brudnego drzewa nie ma czym liczyc
    return false
  }
}

/**
 * @param {string} projekt
 * @returns {[string, string, string, string]}
 */
export function wierszZapisu(projekt) {
  const katalog = join(projekt, KATALOG_HOOKOW)
  const pliki = existsSync(katalog) ? readdirSync(katalog).filter((n) => statSync(join(katalog, n)).isFile()).sort() : []
  const czytane = pliki.filter((n) => ROZSZERZENIA_JS.test(n) || ROZSZERZENIA_POWLOKI.test(n))
  const zapisy = czytane.flatMap((n) => zapisyWDrzewie(`${KATALOG_HOOKOW}/${n}`, readFileSync(join(katalog, n), 'utf8')))
  const problemy = zapisy.map((z) => `${z.plik}:${z.linia} pisze do ${z.cel}`)
  const pominiete = pliki.filter((n) => !czytane.includes(n) && !BEZ_KODU.test(n))
  const naprawy = zapisy.length ? ['zapis hooka przenieś do katalogu tymczasowego (${TMPDIR:-/tmp})'] : []
  if (pozostaloscCache(projekt)) {
    problemy.push(`${STARY_CACHE}/ spoza .gitignore (pozostałość starego hooka Stop)`)
    naprawy.push(`usuń katalog ${STARY_CACHE}/ — cache hooka jest teraz w katalogu tymczasowym`)
  }
  if (!pliki.length && !problemy.length) return [ELEMENT, 'nie dotyczy', `brak ${KATALOG_HOOKOW}/`, '—']
  const bezOdczytu = pominiete.length ? `; nie sprawdzono (rozszerzenie): ${pominiete.join(', ')}` : ''
  if (!problemy.length) return [ELEMENT, 'OK', `${czytane.length} plików w ${KATALOG_HOOKOW}/ bez zapisu w drzewie projektu${bezOdczytu}`, '—']
  return [ELEMENT, 'UWAGA', `${problemy.join('; ')} — plik spoza .gitignore brudzi drzewo i zatrzyma bramkę gotowości i autopilota${bezOdczytu}`, naprawy.join('; ')]
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
