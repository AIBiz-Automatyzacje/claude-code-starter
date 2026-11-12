// Importerzy plikow z akcja „Usuń” (znaleziska szablonu 2026-11-02, pkt 33): dashboard E2, run wf_2e0ed17c-f7b, faza 6 — IU-19
// usuwala urgency-badge.tsx, a importowal go invite-status-section.tsx usuwany dopiero w IU-32. Builder nie usunal pliku z zywym
// importem, execute zwrocil partial i autopilot stanal po okolo 7 godzinach. Skan linii importu jest heurystyka (alias sciezki,
// import zlozony z fragmentow), wiec wynik to uwaga, nie blad: blad zatrzymalby `generuj` na falszywym trafieniu.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'

import { akcja } from './budzet-pliku.mjs'

/** @typedef {import('./pola-iu.mjs').Jednostka} Jednostka */

const PLIK_KODU = /\.[cm]?[jt]sx?$/
const LINIA_IMPORTU = /(?:^|[^\w$.])(?:import|from|require)\b/
// Weryfikacja partii, punkt 55 (33): `import(` albo `require(` na koncu linii, specyfikator w nastepnej (formatowanie Prettiera
// przy dlugiej sciezce). Skan idzie po liniach grepa, wiec linie samego specyfikatora sprawdza drugie przejscie po pliku.
const OTWARTY_IMPORT = /(?:^|[^\w$.])(?:import|require)\s*\(\s*$/
const SPECYFIKATOR = /(['"`])([^'"`\s]+)\1/g
// Pierwszy segment, ktory na pewno jest aliasem sciezki, nie paczka (`@/x`, `~/x`, `#x/y`).
const ALIAS = /^(?:@|~|#.*)$/
const BUFOR_GREPA = 64 * 1024 * 1024
const BEZ_REPO = 128

/** @param {string} sciezka @returns {string} sciezka modulu: bez rozszerzenia kodu i bez koncowego /index */
const modul = (sciezka) => sciezka.replace(PLIK_KODU, '').replace(/\/index$/, '')

/**
 * @param {string} specyfikator tekst z cudzyslowu linii importu
 * @param {string} importer plik z ta linia
 * @param {string} cel usuwany plik jako sciezka modulu
 * @returns {boolean}
 */
function wskazuje(specyfikator, importer, cel) {
  const s = modul(specyfikator)
  if (s.startsWith('.')) return posix.join(posix.dirname(importer), s) === cel
  // Sciezka z aliasem albo od katalogu bazowego: koncowka sciezki celu. Sam ostatni segment wystarcza tylko po pewnym aliasie —
  // `lodash/debounce` nie jest importem `src/utils/debounce.ts`.
  const [pierwszy, ...reszta] = s.split('/')
  return reszta.length >= (ALIAS.test(pierwszy) ? 1 : 2) && `/${cel}`.endsWith(`/${reszta.join('/')}`)
}

/** @param {string} plik @param {string} usuwany @returns {boolean} test usuwanego pliku: obok niego albo w jego __tests__/ */
function testPliku(plik, usuwany) {
  const katalog = posix.dirname(usuwany)
  const nazwa = /^(.+)\.(?:test|spec)$/.exec(posix.basename(plik).replace(PLIK_KODU, ''))?.[1]
  return nazwa === posix.basename(usuwany).replace(PLIK_KODU, '') && [katalog, posix.join(katalog, '__tests__')].includes(posix.dirname(plik))
}

/**
 * @param {string} projekt @param {string} plik @param {string} linia linia ze specyfikatorem (wynik grepa)
 * @returns {boolean} poprzednia niepusta linia pliku konczy sie na `import(` albo `require(`
 */
function poOtwartymImporcie(projekt, plik, linia) {
  let linie
  try {
    linie = readFileSync(join(projekt, plik), 'utf8').split('\n')
  } catch {
    return false
  }
  return linie.some((l, i) => {
    if (l !== linia) return false
    for (let j = i - 1; j >= 0; j--) if ((linie[j] ?? '').trim()) return OTWARTY_IMPORT.test(linie[j] ?? '')
    return false
  })
}

/**
 * Sledzone pliki kodu z linia importu (`import`, `from`, `require`) wskazujaca usuwany plik: sciezka wzgledna rozwiazana od
 * importera albo koncowka sciezki po aliasie. Sam plik i jego test sa pominiete.
 * @param {string} projekt
 * @param {string} usuwany sciezka wzgledem projektu
 * @returns {string[]} importerzy posortowani; pusta lista takze wtedy, gdy projekt nie jest repo gita
 */
export function importerzyPliku(projekt, usuwany) {
  const cel = modul(usuwany)
  let trafienia
  try {
    trafienia = execFileSync('git', ['-C', projekt, 'grep', '-I', '-F', '-z', '-e', posix.basename(cel), '--', '.'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: BUFOR_GREPA })
  } catch (e) {
    // git grep konczy kodem 1 bez trafien, a kodem 128 poza repo gita (skanu wtedy nie ma). Inna awaria to wyjatek skryptu.
    if (e instanceof Error && 'status' in e && (e.status === 1 || e.status === BEZ_REPO)) return []
    throw e
  }
  /** @type {Set<string>} */
  const importerzy = new Set()
  for (const rekord of trafienia.split('\n')) {
    const koniec = rekord.indexOf('\0')
    const plik = rekord.slice(0, Math.max(koniec, 0))
    const linia = rekord.slice(koniec + 1)
    if (!PLIK_KODU.test(plik) || plik === usuwany || testPliku(plik, usuwany)) continue
    if (![...linia.matchAll(SPECYFIKATOR)].some((m) => wskazuje(m[2], plik, cel))) continue
    if (LINIA_IMPORTU.test(linia) || poOtwartymImporcie(projekt, plik, linia)) importerzy.add(plik)
  }
  return [...importerzy].sort()
}

/**
 * Uwaga na kazdy wiersz „Usuń”, ktorego plik ma importera bez wiersza w tabeli plikow tej samej albo wczesniejszej jednostki.
 * Plik, ktorego juz nie ma na dysku, jest pominiety: bramka gotowosci sprawdza plan takze po wykonanych fazach.
 * @param {Jednostka[]} jednostki w kolejnosci planu
 * @param {string} projekt
 * @returns {string[]}
 */
export function uwagiImporterow(jednostki, projekt) {
  /** @type {Map<string, number>} sciezka → indeks pierwszej jednostki, ktora ma ten plik w tabeli plikow */
  const pierwszaZmiana = new Map()
  jednostki.forEach((iu, i) => {
    for (const p of iu.pliki) if (!pierwszaZmiana.has(p.sciezka)) pierwszaZmiana.set(p.sciezka, i)
  })
  return jednostki.flatMap((iu, i) => iu.pliki.filter((p) => /^usun/.test(akcja(p)) && existsSync(join(projekt, p.sciezka))).flatMap((p) => {
    const zalegli = importerzyPliku(projekt, p.sciezka).filter((plik) => (pierwszaZmiana.get(plik) ?? Infinity) > i)
    if (!zalegli.length) return []
    const opis = zalegli.map((plik) => {
      const pozniej = pierwszaZmiana.get(plik)
      return `\`${plik}\` (${pozniej === undefined ? 'plan nie zmienia go w żadnej IU' : `plan zmienia go dopiero w ${jednostki[pozniej].id}`})`
    })
    return [`${iu.id}: Usuń \`${p.sciezka}\` — importerzy, których plan nie zmienia do tej IU: ${opis.join(', ')}. Builder nie usunie`
      + ' pliku z żywym importem i faza skończy się jako częściowa: importer ma wiersz Usuń albo Modyfikuj w tej samej albo'
      + ' wcześniejszej IU (skan importów jest heurystyką — fałszywe trafienie pomiń)']
  }))
}
