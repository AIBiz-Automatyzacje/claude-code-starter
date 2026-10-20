// Punkty wizualne smoke'u operatora (P24 IU-1): linie checkboxow z makieta `visual-diff/<ekran>-figma.png`, z ekranami,
// trasa, viewportem, statusem i identyfikatorem. Checklista jest jedynym zrodlem stanu punktu — status liczony z checkboxa
// i pierwszej adnotacji `*(…)*` zaraz po nim (najnowsza stoi pierwsza). Ekrany, trase i viewport czytamy tylko z tresci,
// nigdy z adnotacji: adnotacje niosa sciezki typu `/p/<slug>` i zablokowane adresy API.
//
// Identyfikator = `p-` + 8 znakow hex SHA-1 tresci (bez checkboxa i adnotacji): sesja dopisuje adnotacje i sekcje, wiec numer
// linii sie przesuwa, a tresc nie. Modul bez `node:` — skrot liczy funkcja z wywolujacego (serwer: `skrotSha1` z zapis-linii.mjs).

export const ZNACZNIK_BLEDU = 'błąd zgłoszony'
export const ZNACZNIK_POPRAWKI = 'poprawione'
export const ZNACZNIK_ODSTEPSTWA = '— zatwierdzone'

const CHECKBOX = /^- \[([ xX])\] (.*)$/
const MAKIETA = /visual-diff\/([A-Za-z0-9][\w.-]*?)-figma\.png/g
const VIEWPORT = /viewport:?\s*(\d+)\s*[×x]\s*(\d+)\s*(?:px)?/i
const VIEWPORT_R11 = /\(viewport \d+×\d+\)/
const DATA_ADNOTACJI = /^\d{4}-\d{2}-\d{2}[^:]*:\s*/
const FIZYCZNE = '**[fizyczne urządzenie]**'
const DLUGOSC_ID = 8

/**
 * @typedef {'otwarty' | 'zgodny' | 'odstepstwo' | 'blad' | 'poprawione'} Status
 * @typedef {{ checkbox: ' ' | 'x', adnotacje: string[], tresc: string }} Linia
 * @typedef {{ szerokosc: number, wysokosc: number }} Wymiary
 * @typedef {{ id: string, linia: number, tekst: string, checkbox: ' ' | 'x', adnotacje: string[], tresc: string, status: Status,
 *   ekrany: string[], trasa: string | null, trasaStartowa: string, viewport: Wymiary | null, niejednoznaczny: boolean }} Punkt
 * @typedef {{ linia: number, powod: string }} Problem
 * @typedef {(tekst: string) => string} Skrot funkcja skrotu hex (SHA-1)
 */

/**
 * Rozbior linii checkboxa: checkbox, adnotacje `*(…)*` na poczatku (najnowsza pierwsza) i tresc. Adnotacja konczy sie na `)*`
 * przed spacja albo koncem linii — w srodku bywaja nawiasy i backticki z gwiazdka.
 * @param {string} linia bez konca linii
 * @returns {Linia | null} null dla linii spoza checkboxa w kolumnie 0
 */
export function rozbierzLinie(linia) {
  const m = CHECKBOX.exec(linia)
  if (!m) return null
  /** @type {string[]} */
  const adnotacje = []
  let reszta = m[2]
  while (reszta.startsWith('*(')) {
    const koniec = /\)\*(?=\s|$)/.exec(reszta)
    if (!koniec) break
    adnotacje.push(reszta.slice(2, koniec.index))
    reszta = reszta.slice(koniec.index + 2).trimStart()
  }
  return { checkbox: m[1] === ' ' ? ' ' : 'x', adnotacje, tresc: reszta.trim() }
}

/** @param {Linia} l @returns {Status} */
export function statusLinii(l) {
  const pierwsza = (l.adnotacje[0] ?? '').trim()
  if (l.checkbox === 'x') return pierwsza.endsWith(ZNACZNIK_ODSTEPSTWA) ? 'odstepstwo' : 'zgodny'
  const bezDaty = pierwsza.replace(DATA_ADNOTACJI, '')
  if (bezDaty.startsWith(ZNACZNIK_BLEDU)) return 'blad'
  if (bezDaty.startsWith(ZNACZNIK_POPRAWKI)) return 'poprawione'
  return 'otwarty'
}

/** @param {string} tresc @returns {string[]} nazwy ekranow makiet w kolejnosci, bez powtorzen */
function ekranyTresci(tresc) {
  return [...new Set([...tresc.matchAll(MAKIETA)].map((m) => m[1]))]
}

/** @param {string} fragment @returns {boolean} trasa aplikacji, nie wzorzec blokady, RPC ani adres API */
const czyTrasa = (fragment) => fragment.startsWith('/') && !fragment.startsWith('//') && !fragment.includes('*') && !/(^|\/)(?:rpc|api)\//.test(fragment)

/**
 * Trasa: pierwszy fragment w backtickach zaczynajacy sie od `/` przed pierwszym „obok” (bez „obok” — przed pierwsza makieta).
 * @param {string} tresc
 * @returns {string | null}
 */
function trasaTresci(tresc) {
  const obok = /(^|\s)obok\s/.exec(tresc)
  const makieta = tresc.indexOf('visual-diff/')
  const granica = obok ? obok.index : makieta === -1 ? tresc.length : makieta
  const fragmenty = [...tresc.slice(0, granica).matchAll(/`([^`]+)`/g)].map((m) => m[1])
  return fragmenty.find(czyTrasa) ?? null
}

/**
 * Trasa startowa ramek: trasa z placeholderem `<…>` obcieta do segmentu przed nim (query z placeholderem znika cale).
 * @param {string | null} trasa
 * @returns {string}
 */
function trasaStartowa(trasa) {
  if (trasa === null) return '/'
  const i = trasa.indexOf('<')
  if (i === -1) return trasa
  const przed = trasa.slice(0, i)
  const bezCzesci = przed.includes('?') ? przed.slice(0, przed.indexOf('?')) : przed.slice(0, przed.lastIndexOf('/') + 1)
  return bezCzesci.replace(/\/+$/, '') || '/'
}

/** @param {string} tresc @returns {Wymiary | null} */
function viewportTresci(tresc) {
  const m = VIEWPORT.exec(tresc)
  return m ? { szerokosc: Number(m[1]), wysokosc: Number(m[2]) } : null
}

/** @param {string} md @returns {{ nr: number, tekst: string, rozbior: Linia }[]} linie checkboxow z makieta (bez fizycznych urzadzen) */
function linieZMakieta(md) {
  return md.split('\n').flatMap((surowa, i) => {
    const tekst = surowa.replace(/\r$/, '')
    const rozbior = rozbierzLinie(tekst)
    return rozbior && /-figma\.png/.test(rozbior.tresc) && !rozbior.tresc.includes(FIZYCZNE) ? [{ nr: i + 1, tekst, rozbior }] : []
  })
}

/**
 * @param {string} md tresc smoke'u
 * @param {Skrot} skrot
 * @returns {Punkt[]} punkty z co najmniej jednym ekranem `visual-diff/<ekran>-figma.png`
 */
export function punktyWizualne(md, skrot) {
  const linie = linieZMakieta(md).filter((l) => ekranyTresci(l.rozbior.tresc).length)
  /** @type {Map<string, number>} */
  const wystapienia = new Map()
  for (const l of linie) wystapienia.set(l.rozbior.tresc, (wystapienia.get(l.rozbior.tresc) ?? 0) + 1)
  return linie.map(({ nr, tekst, rozbior }) => {
    const trasa = trasaTresci(rozbior.tresc)
    return {
      id: `p-${skrot(rozbior.tresc).slice(0, DLUGOSC_ID)}`, linia: nr, tekst, checkbox: rozbior.checkbox, adnotacje: rozbior.adnotacje,
      tresc: rozbior.tresc, status: statusLinii(rozbior), ekrany: ekranyTresci(rozbior.tresc), trasa, trasaStartowa: trasaStartowa(trasa),
      viewport: viewportTresci(rozbior.tresc), niejednoznaczny: (wystapienia.get(rozbior.tresc) ?? 0) > 1,
    }
  })
}

/**
 * Uwagi formatu R11 punktu wizualnego: `- [ ] <Urzadzenie>: \`<trasa>\` obok \`visual-diff/<ekran>-figma.png\` (viewport WxH) → <wynik>`.
 * @param {string} tresc
 * @param {string[]} ekrany
 * @returns {string[]}
 */
function uwagiFormatu(tresc, ekrany) {
  if (!ekrany.length) return ['makieta bez ścieżki `visual-diff/<ekran>-figma.png` — narzędzie nie znajdzie ekranu']
  /** @type {string[]} */
  const uwagi = []
  if (ekrany.length > 1) uwagi.push(`kilka makiet w jednym punkcie (${ekrany.join(', ')}) — jedna makieta na punkt`)
  if (!new RegExp(`obok \`visual-diff/${ekrany[0].replace(/[.]/g, '\\.')}-figma\\.png\``).test(tresc)) uwagi.push('makieta nie stoi po „obok” w backtickach (zapis: `<trasa>` obok `visual-diff/<ekran>-figma.png`)')
  if (!VIEWPORT_R11.test(tresc)) uwagi.push('brak „(viewport <W>×<H>)” bez dwukropka i sufiksu')
  if (!tresc.includes('→')) uwagi.push('brak „→ <oczekiwany wynik>”')
  return uwagi
}

/**
 * Kontrola formatu smoke'u (fail-closed, z numerem linii): punkty z makieta spoza formatu R11, bez ekranu albo niejednoznaczne.
 * @param {string} md
 * @param {Skrot} skrot
 * @returns {Problem[]}
 */
export function sprawdzFormat(md, skrot) {
  const niejednoznaczne = new Set(punktyWizualne(md, skrot).filter((p) => p.niejednoznaczny).map((p) => p.linia))
  return linieZMakieta(md).flatMap(({ nr, rozbior }) => {
    const uwagi = uwagiFormatu(rozbior.tresc, ekranyTresci(rozbior.tresc))
    if (niejednoznaczne.has(nr)) uwagi.push('ta sama treść punktu stoi w checkliście kilka razy — narzędzie nie zapisze decyzji')
    return uwagi.map((powod) => ({ linia: nr, powod }))
  })
}
