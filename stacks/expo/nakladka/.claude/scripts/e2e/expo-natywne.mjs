// Bramka natywna (IU-2.4, A0.1 #13, #14): czy zmiany od zbudowania dev-clienta wymagają jego przebudowy. Mtime mówi tylko, że coś się
// ruszyło: checkout przestawia go bez zmiany treści, a paczka czysto JS też rusza lockfile. Dlatego rozstrzyga diff od pierwszego commita
// nowszego niż binarka, a o natywności pakietu decydują pliki na dysku, nie jego nazwa. Bez stanu, więc działa też po wznowieniu runu.
// Czego nie da się rozstrzygnąć, idzie jak natywne (fail-closed): fałszywy STOP kosztuje jedną przebudowę, przeoczenie cały run.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']
const CONFIG_DYNAMICZNY = ['app.config.js', 'app.config.ts']
const PLIKI = ['package.json', 'app.json', ...CONFIG_DYNAMICZNY, ...LOCKFILES]
const POLA_NATYWNE = ['plugins', 'ios', 'android', 'permissions', 'entitlements', 'scheme']
const SEKCJE_ZALEZNOSCI = ['dependencies', 'devDependencies']
// Hasz pustego drzewa git: punkt odniesienia, gdy pierwszy nowszy commit nie ma rodzica.
const PUSTE_DRZEWO = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** @typedef {{ wymagaRebuildu: boolean, nowe: string[], detal: string }} WynikBramki */
/** @typedef {(argumenty: string[]) => { status: number | null, stdout: string }} Git */

/** @param {string} projekt @returns {Git} */
const gitW = (projekt) => (argumenty) => {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 1 << 26 })
  return { status: w.status, stdout: w.stdout ?? '' }
}

/**
 * Stan sprzed zmian, których binarka nie zawiera. Brak nowszych commitów = HEAD, czyli sprawdzamy tylko niezacommitowane.
 * @param {Git} git @param {number} mtimeBinarki sekundy @returns {string | null}
 */
function punktOdniesienia(git, mtimeBinarki) {
  const log = git(['log', `--since=@${Math.floor(mtimeBinarki)}`, '--format=%H', '--reverse', '--', ...PLIKI])
  if (log.status !== 0) return null
  const pierwszy = log.stdout.trim().split('\n')[0]
  if (!pierwszy) return 'HEAD'
  const rodzic = git(['rev-parse', '--verify', '-q', `${pierwszy}^`])
  return rodzic.status === 0 ? rodzic.stdout.trim() : PUSTE_DRZEWO
}

/** @param {Git} git @param {string} punkt @param {string} plik @returns {unknown} */
function jsonWPunkcie(git, punkt, plik) {
  const w = git(['show', `${punkt}:${plik}`])
  if (w.status !== 0) return {}
  try {
    return JSON.parse(w.stdout)
  } catch (e) {
    if (e instanceof SyntaxError) return {}
    throw e
  }
}

/** @param {string} projekt @param {string} plik @returns {unknown} */
function jsonNaDysku(projekt, plik) {
  const sciezka = join(projekt, plik)
  return existsSync(sciezka) ? JSON.parse(readFileSync(sciezka, 'utf8')) : {}
}

/** @param {unknown} x @returns {Record<string, unknown>} */
const rekord = (x) => (x && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : {})

/** @param {unknown} przed @param {unknown} teraz @returns {string[]} pakiety dodane albo o zmienionej wersji */
export function zmienioneZaleznosci(przed, teraz) {
  const zmienione = new Set()
  for (const sekcja of SEKCJE_ZALEZNOSCI) {
    const a = rekord(rekord(przed)[sekcja])
    const b = rekord(rekord(teraz)[sekcja])
    for (const [nazwa, wersja] of Object.entries(b)) if (a[nazwa] !== wersja) zmienione.add(nazwa)
  }
  return [...zmienione]
}

/** @param {string} diff @returns {string[]} pakiety z dodanymi wersjami w package-lock.json */
function pakietyNpm(diff) {
  const pakiety = new Set()
  let ostatni = ''
  for (const linia of diff.split('\n')) {
    const klucz = /^[ +-]\s*"(?:.*\/)?node_modules\/((?:@[^/"]+\/)?[^/"]+)":\s*\{/.exec(linia)
    if (klucz) ostatni = klucz[1]
    else if (/^\+\s*"version":/.test(linia)) pakiety.add(ostatni || '?')
  }
  return [...pakiety]
}

const WZORY_BLOKADY = /** @type {Record<string, RegExp>} */ ({
  'pnpm-lock.yaml': /^\+\s+'?(@?[^@\s']+)@\d[^:]*'?:/,
  'yarn.lock': /^\+"?(@?[^@"\s]+)@[^:]*:$/,
  'bun.lock': /^\+\s*"(@?[^"]+)":\s*\[/,
})

/**
 * Pakiety z diffu lockfile'a. Pusta lista przy zmienionym pliku oznacza format, którego nie rozumiemy.
 * @param {string} plik @param {string} diff @returns {string[]}
 */
export function pakietyZLockfile(plik, diff) {
  if (plik === 'package-lock.json') return pakietyNpm(diff)
  const wzor = WZORY_BLOKADY[plik]
  if (!wzor) return []
  return [...new Set(diff.split('\n').map((l) => wzor.exec(l)?.[1]).filter((n) => n !== undefined))]
}

/** @param {string} projekt @param {string} nazwa @returns {string | null} katalog pakietu, także w układzie pnpm */
function katalogPakietu(projekt, nazwa) {
  const bezposredni = join(projekt, 'node_modules', nazwa)
  if (existsSync(bezposredni)) return bezposredni
  const pnpm = join(projekt, 'node_modules/.pnpm')
  if (existsSync(pnpm)) {
    const wpis = readdirSync(pnpm).find((k) => k.startsWith(`${nazwa.replace('/', '+')}@`))
    if (wpis) return join(pnpm, wpis, 'node_modules', nazwa)
  }
  return zagniezdzony(join(projekt, 'node_modules'), nazwa)
}

/**
 * Pilot mobile W24 (run 2): npm zagnieżdża paczkę w innej wersji pod rodzicem (`node_modules/expo/node_modules/@expo/cli`),
 * a bramka szukała tylko na najwyższym poziomie i zgłaszała `@expo/cli` i `@expo/router-server` jako natywne „bez katalogu”.
 * Szuka jeden poziom rodzica w głąb, także pod scope (`node_modules/@scope/rodzic/node_modules/<nazwa>`).
 * @param {string} korzen katalog node_modules @param {string} nazwa @returns {string | null}
 */
function zagniezdzony(korzen, nazwa) {
  if (!existsSync(korzen)) return null
  for (const w of readdirSync(korzen, { withFileTypes: true })) {
    if (!w.isDirectory() || w.name.startsWith('.')) continue
    const rodzice = w.name.startsWith('@') ? readdirSync(join(korzen, w.name)).map((n) => join(korzen, w.name, n)) : [join(korzen, w.name)]
    for (const rodzic of rodzice) {
      const kandydat = join(rodzic, 'node_modules', nazwa)
      if (existsSync(kandydat)) return kandydat
    }
  }
  return null
}

/** @param {string} katalog @param {number} glebokosc @returns {boolean} */
function maPlikNatywny(katalog, glebokosc) {
  return readdirSync(katalog, { withFileTypes: true }).some((w) => {
    if (w.isFile()) return w.name.endsWith('.podspec') || w.name === 'build.gradle'
    return w.isDirectory() && w.name !== 'node_modules' && glebokosc > 1 && maPlikNatywny(join(katalog, w.name), glebokosc - 1)
  })
}

/**
 * Znacznik kodu natywnego pakietu albo null dla pakietu czysto JS.
 * @param {string} projekt @param {string} nazwa @returns {string | null}
 */
export function dowodNatywnosci(projekt, nazwa) {
  const katalog = katalogPakietu(projekt, nazwa)
  if (!katalog || !existsSync(katalog)) return `brak node_modules/${nazwa}, potraktowany jak natywny`
  for (const znacznik of ['expo-module.config.json', 'ios', 'android', 'app.plugin.js']) {
    if (existsSync(join(katalog, znacznik))) return znacznik
  }
  if ('expo' in rekord(jsonNaDysku(katalog, 'package.json'))) return 'pole expo w package.json'
  return maPlikNatywny(katalog, 2) ? 'podspec albo build.gradle' : null
}

/** @param {Git} git @param {string} punkt @param {string} projekt @returns {string[]} zmienione pola natywne app.json */
function zmianyAppJson(git, punkt, projekt) {
  const przed = rekord(rekord(jsonWPunkcie(git, punkt, 'app.json')).expo)
  const teraz = rekord(rekord(jsonNaDysku(projekt, 'app.json')).expo)
  return POLA_NATYWNE.filter((p) => JSON.stringify(przed[p]) !== JSON.stringify(teraz[p])).map((p) => `app.json:${p}`)
}

/**
 * Pakiety do oceny z package.json i lockfile'i; lockfile, którego nie da się odczytać, wraca jako powód przebudowy.
 * @param {Git} git @param {string} punkt @param {string} projekt @param {string[]} zmienione
 * @returns {{ pakiety: Set<string>, nieczytelne: string[] }}
 */
function pakietyDoOceny(git, punkt, projekt, zmienione) {
  const pakiety = new Set(zmienione.includes('package.json') ? zmienioneZaleznosci(jsonWPunkcie(git, punkt, 'package.json'), jsonNaDysku(projekt, 'package.json')) : [])
  const nieczytelne = []
  for (const plik of zmienione.filter((p) => LOCKFILES.includes(p))) {
    const z = pakietyZLockfile(plik, git(['diff', '-U5', punkt, '--', plik]).stdout)
    if (z.length && !z.includes('?')) z.forEach((n) => pakiety.add(n))
    else nieczytelne.push(`${plik}: nie rozstrzygnięto`)
  }
  return { pakiety, nieczytelne }
}

/**
 * @param {string} projekt @param {number} mtimeBinarki sekundy @param {{ git?: Git }} [opcje]
 * @returns {WynikBramki}
 */
export function zmianyNatywne(projekt, mtimeBinarki, { git = gitW(projekt) } = {}) {
  const punkt = punktOdniesienia(git, mtimeBinarki)
  if (!punkt) return { wymagaRebuildu: true, nowe: [], detal: 'nie odczytano historii git, potraktowane jak zmiana natywna' }
  const diff = git(['diff', '--name-only', punkt, '--', ...PLIKI])
  if (diff.status !== 0) return { wymagaRebuildu: true, nowe: [], detal: `git diff ${punkt} nie przeszedł, potraktowane jak zmiana natywna` }
  const zmienione = diff.stdout.split('\n').filter(Boolean)
  if (!zmienione.length) return { wymagaRebuildu: false, nowe: [], detal: 'treść konfiguracji bez zmian od builda' }
  const { pakiety, nieczytelne } = pakietyDoOceny(git, punkt, projekt, zmienione)
  const nowe = [
    ...nieczytelne,
    ...zmienione.filter((p) => CONFIG_DYNAMICZNY.includes(p)).map((p) => `${p}: zmiana konfiguracji`),
    ...(zmienione.includes('app.json') ? zmianyAppJson(git, punkt, projekt) : []),
    ...[...pakiety].flatMap((n) => {
      const dowod = dowodNatywnosci(projekt, n)
      return dowod ? [`${n} (${dowod})`] : []
    }),
  ]
  if (nowe.length) return { wymagaRebuildu: true, nowe, detal: nowe.join(', ') }
  return { wymagaRebuildu: false, nowe: [], detal: `zmiany bez kodu natywnego: ${[...pakiety].join(', ') || zmienione.join(', ')}` }
}
