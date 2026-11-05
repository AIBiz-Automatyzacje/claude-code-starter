// Budowa wariantu szablonu (plan szablonu mobile z rdzenia, IU-2.0): rdzeń `.claude/` + `output-styles/` → usunięcia z
// `stacks/<stack>/usun.txt` → podmiany i dodatki z `stacks/<stack>/nakladka/` → deep-merge `settings.patch.json` →
// `.claude/.rdzen-version` (SHA rdzenia). Nakładka podmienia tylko całe pliki, nigdy nie łata.
//
// Uruchomienie: node stacks/zbuduj.mjs <stack> <katalog> [--zastap]
// Katalog z istniejącym `.claude/` albo `output-styles/` wymaga `--zastap`: build usuwa oba, żeby wycofane pliki zniknęły,
// a pomyłka w ścieżce nie może skasować `.claude/` prawdziwego projektu. Reszty katalogu (README, docs) build nie dotyka.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { KATALOGI_RDZENIA } from './straznik.mjs'

const PLIK_USTAWIEN = '.claude/settings.json'
const PLIK_WERSJI = '.claude/.rdzen-version'
const POMIJANE_NAZWY = new Set(['.DS_Store', 'settings.local.json'])

export class BladWariantu extends Error {
  /** @param {string} kod @param {string} komunikat */
  constructor(kod, komunikat) {
    super(komunikat)
    this.name = 'BladWariantu'
    this.kod = kod
  }
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const czyObiekt = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Deep-merge ustawień: obiekty scalane rekurencyjnie, tablice dostają brakujące elementy na końcu (hooki, `deny`), wartość
 * proste nadpisuje patch, `null` usuwa klucz (plugin web, którego stack nie chce).
 * @param {Record<string, unknown>} baza @param {Record<string, unknown>} patch @returns {Record<string, unknown>}
 */
export function scalUstawienia(baza, patch) {
  const wynik = { ...baza }
  for (const [klucz, wartosc] of Object.entries(patch)) {
    const obecna = wynik[klucz]
    if (wartosc === null) delete wynik[klucz]
    else if (czyObiekt(obecna) && czyObiekt(wartosc)) wynik[klucz] = scalUstawienia(obecna, wartosc)
    else if (Array.isArray(obecna) && Array.isArray(wartosc)) {
      const znane = new Set(obecna.map((e) => JSON.stringify(e)))
      wynik[klucz] = [...obecna, ...wartosc.filter((e) => !znane.has(JSON.stringify(e)))]
    } else wynik[klucz] = wartosc
  }
  return wynik
}

/** @param {string} sciezka @returns {boolean} */
const wRdzeniu = (sciezka) =>
  !isAbsolute(sciezka) && !sciezka.split('/').includes('..') && KATALOGI_RDZENIA.some((k) => sciezka.startsWith(`${k}/`))

/**
 * Pliki rdzenia z gita: śledzone i nowe nieignorowane, bez usuniętych. Build powtarza to, co widzi `sync-template` (`ls-files`).
 * @param {string} korzen @returns {string[]}
 */
function plikiZrodla(korzen) {
  const wyjscie = execFileSync('git', ['-C', korzen, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...KATALOGI_RDZENIA], { encoding: 'utf8' })
  return wyjscie.split('\0').filter((p) => {
    if (!p || p.startsWith('.claude/worktrees/') || POMIJANE_NAZWY.has(posix.basename(p))) return false
    const pelna = join(korzen, p)
    return existsSync(pelna) && statSync(pelna).isFile()
  })
}

/**
 * Wpisy `usun.txt`: jedna ścieżka w linii, `/` na końcu = katalog, `#` = komentarz.
 * @param {string} katalogStacku @returns {string[]}
 */
function wpisyUsuniec(katalogStacku) {
  const plik = join(katalogStacku, 'usun.txt')
  if (!existsSync(plik)) return []
  const wpisy = readFileSync(plik, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  for (const wpis of wpisy) {
    if (!wRdzeniu(wpis)) throw new BladWariantu('usun-poza-rdzeniem', `usun.txt: ścieżka spoza rdzenia: ${wpis}`)
  }
  return wpisy
}

/**
 * Pliki rdzenia po usunięciach. Wpis bez pliku jest nieaktualny: rdzeń zmienił nazwę, a wariant po cichu dostałby stary plik.
 * @param {string[]} pliki @param {string[]} wpisy @returns {string[]}
 */
function poUsunieciach(pliki, wpisy) {
  const usuniete = new Set()
  for (const wpis of wpisy) {
    const trafione = pliki.filter((p) => (wpis.endsWith('/') ? p.startsWith(wpis) : p === wpis))
    if (!trafione.length) throw new BladWariantu('usun-nieaktualny', `usun.txt: wpis niczego nie usuwa: ${wpis}`)
    for (const p of trafione) usuniete.add(p)
  }
  return pliki.filter((p) => !usuniete.has(p))
}

/**
 * Pliki nakładki względem jej korzenia, po sprawdzeniu kontraktu: tylko katalogi rdzenia, bez testów (te w `stacks/<stack>/__tests__/`)
 * i bez `settings.json` (ten scala `settings.patch.json`).
 * @param {string} katalogNakladki @returns {string[]}
 */
function plikiNakladki(katalogNakladki) {
  if (!existsSync(katalogNakladki)) return []
  /** @type {string[]} */
  const wynik = []
  /** @param {string} wzgledny */
  const przejdz = (wzgledny) => {
    for (const wpis of readdirSync(join(katalogNakladki, wzgledny), { withFileTypes: true })) {
      if (POMIJANE_NAZWY.has(wpis.name)) continue
      const sciezka = posix.join(wzgledny, wpis.name)
      if (wpis.isDirectory()) przejdz(sciezka)
      else wynik.push(sciezka)
    }
  }
  przejdz('')
  for (const p of wynik) {
    if (!wRdzeniu(p)) throw new BladWariantu('nakladka-poza-rdzeniem', `nakładka: plik spoza rdzenia: ${p}`)
    if (p.split('/').includes('__tests__')) throw new BladWariantu('nakladka-testy', `nakładka: testy należą do stacks/<stack>/__tests__/: ${p}`)
    if (p === PLIK_USTAWIEN) throw new BladWariantu('nakladka-ustawienia', `nakładka: ${p} scala settings.patch.json, nie podmiana`)
  }
  return wynik.sort()
}

/** @param {string} korzen @param {string} katalogStacku @returns {string} */
function ustawieniaWariantu(korzen, katalogStacku) {
  const baza = JSON.parse(readFileSync(join(korzen, PLIK_USTAWIEN), 'utf8'))
  const plikPatcha = join(katalogStacku, 'settings.patch.json')
  const patch = existsSync(plikPatcha) ? JSON.parse(readFileSync(plikPatcha, 'utf8')) : {}
  return `${JSON.stringify(scalUstawienia(baza, patch), null, 2)}\n`
}

/**
 * SHA rdzenia; `-dirty` przy niezacommitowanych zmianach, żeby ręczna publikacja nie podała SHA, którego wariant nie odpowiada.
 * @param {string} korzen @returns {string}
 */
function wersjaRdzenia(korzen) {
  const git = (/** @type {string[]} */ ...argumenty) => execFileSync('git', ['-C', korzen, ...argumenty], { encoding: 'utf8' }).trim()
  const sha = git('rev-parse', 'HEAD')
  return git('status', '--porcelain', '--', ...KATALOGI_RDZENIA, 'stacks') ? `${sha}-dirty` : sha
}

/** @param {string} korzen @param {string} katalog @param {boolean} zastap */
function sprawdzCel(korzen, katalog, zastap) {
  const wzgledna = relative(korzen, katalog)
  if (!wzgledna || (!wzgledna.startsWith('..') && !isAbsolute(wzgledna))) {
    throw new BladWariantu('cel-w-repo', `katalog wyjściowy leży w repo szablonu: ${katalog}`)
  }
  const zajete = KATALOGI_RDZENIA.filter((k) => existsSync(join(katalog, k)))
  if (zajete.length && !zastap) {
    throw new BladWariantu('cel-zajety', `${katalog} ma już ${zajete.join(', ')}; build je usuwa, więc wymaga --zastap`)
  }
}

/**
 * Buduje wariant. Najpierw komplet walidacji, zapis na końcu: błąd kontraktu nie zostawia katalogu wyjściowego w połowie.
 * @param {{ korzen: string, stack: string, katalog: string, zastap?: boolean }} opcje
 * @returns {{ wersja: string, pliki: number, usuniete: number, podmienione: string[], dodane: string[] }}
 */
export function zbuduj({ korzen, stack, katalog, zastap = false }) {
  if (!/^[a-z0-9-]+$/.test(stack)) throw new BladWariantu('stack-nazwa', `niepoprawna nazwa stacku: ${stack}`)
  const katalogStacku = join(korzen, 'stacks', stack)
  if (!existsSync(katalogStacku)) throw new BladWariantu('stack-brak', `brak katalogu stacks/${stack}`)
  const cel = resolve(katalog)
  sprawdzCel(resolve(korzen), cel, zastap)

  const zrodlo = plikiZrodla(korzen)
  const wpisy = wpisyUsuniec(katalogStacku)
  const pozostale = poUsunieciach(zrodlo, wpisy)
  const katalogNakladki = join(katalogStacku, 'nakladka')
  const nakladka = plikiNakladki(katalogNakladki)
  const sprzeczne = nakladka.filter((p) => wpisy.includes(p))
  if (sprzeczne.length) throw new BladWariantu('nakladka-usun', `plik w nakładce i w usun.txt: ${sprzeczne.join(', ')}`)
  const ustawienia = ustawieniaWariantu(korzen, katalogStacku)
  const wersja = wersjaRdzenia(korzen)

  for (const k of KATALOGI_RDZENIA) rmSync(join(cel, k), { recursive: true, force: true })
  /** @param {string} zrodloPliku @param {string} sciezka */
  const kopiuj = (zrodloPliku, sciezka) => {
    mkdirSync(dirname(join(cel, sciezka)), { recursive: true })
    copyFileSync(zrodloPliku, join(cel, sciezka))
  }
  for (const p of pozostale) kopiuj(join(korzen, p), p)
  for (const p of nakladka) kopiuj(join(katalogNakladki, p), p)
  writeFileSync(join(cel, PLIK_USTAWIEN), ustawienia)
  writeFileSync(join(cel, PLIK_WERSJI), `${wersja}\n`)

  const zRdzenia = new Set(pozostale)
  return {
    wersja,
    pliki: new Set([...pozostale, ...nakladka]).size,
    usuniete: zrodlo.length - pozostale.length,
    podmienione: nakladka.filter((p) => zRdzenia.has(p)),
    dodane: nakladka.filter((p) => !zRdzenia.has(p)),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumenty = process.argv.slice(2)
  const pozycyjne = argumenty.filter((a) => !a.startsWith('--'))
  if (pozycyjne.length !== 2 || argumenty.some((a) => a.startsWith('--') && a !== '--zastap')) {
    console.error('Użycie: node stacks/zbuduj.mjs <stack> <katalog> [--zastap]')
    process.exit(2)
  }
  const korzen = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const wynik = zbuduj({ korzen, stack: pozycyjne[0], katalog: pozycyjne[1], zastap: argumenty.includes('--zastap') })
    console.log(JSON.stringify(wynik, null, 2))
  } catch (blad) {
    if (!(blad instanceof BladWariantu)) throw blad
    console.error(`${blad.kod}: ${blad.message}`)
    process.exit(1)
  }
}
