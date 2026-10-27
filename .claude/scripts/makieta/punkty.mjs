// Punkty wizualne smoke'u operatora (P24 IU-1): linie checkboxow z makieta `visual-diff/<ekran>-figma.png`, z ekranami,
// trasa, viewportem, statusem i identyfikatorem. Checklista jest jedynym zrodlem stanu punktu — status liczony z checkboxa
// i pierwszej adnotacji `*(…)*` zaraz po nim (najnowsza stoi pierwsza). Ekrany, trase i viewport czytamy tylko z tresci,
// nigdy z adnotacji: adnotacje niosa sciezki typu `/p/<slug>` i zablokowane adresy API. Adnotacja konczy sie na pierwszym
// „)*” przed spacja — „)*” ze spacja wpisane w srodek adnotacji recznie ja przetnie (notatki narzedzia go nie maja).
// Linie w blokach ``` nie sa punktami.
//
// Identyfikator = `p-` + 8 znakow hex SHA-1 tresci (bez checkboxa i adnotacji): sesja dopisuje adnotacje i sekcje, wiec numer
// linii sie przesuwa, a tresc nie. Modul bez `node:` — skrot liczy funkcja z wywolujacego (serwer: `skrotSha1` z zapis-linii.mjs).

export const ZNACZNIK_BLEDU = 'błąd zgłoszony'
export const ZNACZNIK_POPRAWKI = 'poprawione'
export const ZNACZNIK_ODSTEPSTWA = '— zatwierdzone'
// Zrzut operatora do zgloszenia (P27 S3): sciezka PNG na koncu adnotacji bledu.
export const ZNACZNIK_ZRZUTU = ' · zrzut: '

const CHECKBOX = /^- \[([ xX])\] (.*)$/
const MAKIETA = /visual-diff\/([A-Za-z0-9][\w.-]*?)-figma\.png/g
const VIEWPORT = /viewport:?\s*(\d+)\s*[×x]\s*(\d+)\s*(?:px)?/i
// Dopisek po srednik w tym samym nawiasie (P28, smoke etapu 5: „(viewport 1440×1153; zrzut z konta e2e…)”) nie psuje zapisu.
const VIEWPORT_R11 = /\(viewport (\d+)×(\d+)(?:\)|; )/
const PLOT = /^\s*(?:```|~~~)/
const DATA_ADNOTACJI = /^\d{4}-\d{2}-\d{2}[^:]*:\s*/
// Bez polskich znakow tez — agent smoke'u pisal znacznik z prompta workflowu w ASCII.
const FIZYCZNE = /\*\*\[fizyczne urz[aą]dzenie\]\*\*/
const DLUGOSC_ID = 8
// Trzy pola punktu dla czlowieka po „→” (P27 S3 poz. 28, P29(3)): jak wejsc, co porownac, stany i jak je wywolac.
// Bez polskich znakow tez (agent smoke'u pisal juz znaczniki w ASCII).
const POLA = /^Wej[sś]cie:\s*(.+?)\s+Por[oó]wnaj:\s*(.+?)\s+Stany:\s*(.+)$/
const NAZWY_POL = /** @type {const} */ ([['Wejście', /Wej[sś]cie:/], ['Porównaj', /Por[oó]wnaj:/], ['Stany', /Stany:/]])

/**
 * @typedef {'otwarty' | 'zgodny' | 'odstepstwo' | 'blad' | 'poprawione'} Status
 * @typedef {{ checkbox: ' ' | 'x', adnotacje: string[], tresc: string }} Linia
 * @typedef {{ szerokosc: number, wysokosc: number }} Wymiary
 * @typedef {{ id: string, linia: number, tekst: string, checkbox: ' ' | 'x', adnotacje: string[], tresc: string, status: Status,
 *   ekrany: string[], trasa: string | null, trasaStartowa: string, viewport: Wymiary | null, niejednoznaczny: boolean, opis: Opis | null }} Punkt
 * @typedef {{ co: string, wejscie?: string, stany: string | null, sprawdz: string }} Opis tresc punktu dla operatora (bez sciezek makiet
 *   i wymiaru); `wejscie` tylko w formacie trzech pol
 * @typedef {{ linia: number, powod: string }} Problem
 * @typedef {(tekst: string) => string} Skrot funkcja skrotu hex (SHA-1)
 */

/**
 * Rozbior linii checkboxa: checkbox, adnotacje `*(…)*` na poczatku (najnowsza pierwsza) i tresc. Adnotacja konczy sie na `)*`
 * przed spacja albo koncem linii — w srodku bywaja nawiasy i backticki z gwiazdka.
 * @param {string} linia (koncowe `\r` zdejmowane)
 * @returns {Linia | null} null dla linii spoza checkboxa w kolumnie 0
 */
export function rozbierzLinie(linia) {
  const m = CHECKBOX.exec(linia.replace(/\r$/, ''))
  if (!m) return null
  /** @type {string[]} */
  const adnotacje = []
  let reszta = m[2].trimStart()
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

/** @param {string} fragment @returns {boolean} trasa aplikacji, nie wzorzec blokady, RPC, adres API ani adres bez schematu (`//host`) */
const czyTrasa = (fragment) => fragment.startsWith('/') && !fragment.startsWith('//') && !fragment.includes('\\') && !fragment.includes('*') && !/(^|\/)(?:rpc|api)\//.test(fragment)

/**
 * Trasa: pierwszy fragment w backtickach zaczynajacy sie od `/` przed pierwsza makieta. Granica „przed pierwszym obok” gubila
 * trase, gdy „obok” stoi w opisie stanu przed trasa („lista obok podgladu: `/admin` obok …”); na smoke'ach etapow 1–4 obie
 * granice daja ten sam wynik.
 * @param {string} tresc punkt z co najmniej jedna makieta
 * @returns {string | null}
 */
function trasaTresci(tresc) {
  const fragmenty = [...tresc.slice(0, tresc.indexOf('visual-diff/')).matchAll(/`([^`]+)`/g)].map((m) => m[1])
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
  const zapytanie = przed.search(/[?#]/)
  const bezCzesci = zapytanie !== -1 ? przed.slice(0, zapytanie) : przed.slice(0, przed.lastIndexOf('/') + 1)
  return bezCzesci.replace(/\/+$/, '') || '/'
}

/** @param {string} tresc @returns {Wymiary | null} zapis R11 przed luzniejszymi odmianami (dwukropek, `px`, „x”) */
function viewportTresci(tresc) {
  const m = VIEWPORT_R11.exec(tresc) ?? VIEWPORT.exec(tresc)
  return m ? { szerokosc: Number(m[1]), wysokosc: Number(m[2]) } : null
}

/**
 * Opis punktu dla czlowieka (P28, pilot etapu 5: surowa linia R11 z dwiema sciezkami PNG i wymiarem „ciezko sie czyta”):
 * `co` — tekst przed „obok” (urzadzenie, miejsce, trasa), `stany` — warianty po „(viewport …):”, `sprawdz` — wynik po „→”.
 * Backticki znikaja (tresc zostaje). Zapis bez „obok”, wymiaru albo „→” = null — strona pokazuje wtedy cala linie.
 * Format trzech pol po „→” (P27 S3): `wejscie` z „Wejście:”, `sprawdz` z „Porównaj:”, `stany` z „Stany:”.
 * @param {string} tresc
 * @returns {Opis | null}
 */
function opisTresci(tresc) {
  const obok = tresc.indexOf(' obok ')
  const wymiar = /\(viewport [^)]*\)/.exec(tresc)
  const strzalka = tresc.indexOf('→')
  if (obok === -1 || !wymiar || strzalka === -1 || strzalka < wymiar.index) return null
  const czysty = (/** @type {string} */ t) => t.replace(/`/g, '').trim()
  const co = czysty(tresc.slice(0, obok)).replace(/:$/, '')
  const stany = czysty(tresc.slice(wymiar.index + wymiar[0].length, strzalka)).replace(/^:\s*/, '')
  const sprawdz = czysty(tresc.slice(strzalka + 1))
  const pola = POLA.exec(sprawdz)
  const bezKonca = (/** @type {string} */ t) => t.replace(/[.;]\s*$/, '').trim()
  if (pola) return { co, wejscie: bezKonca(pola[1]), sprawdz: bezKonca(pola[2]), stany: bezKonca(pola[3]) }
  return { co, stany: stany || null, sprawdz }
}

/** @param {string} md @returns {{ nr: number, tekst: string, rozbior: Linia }[]} linie checkboxow z makieta (bez fizycznych urzadzen i blokow ```) */
function linieZMakieta(md) {
  let kod = false
  return md.split('\n').flatMap((surowa, i) => {
    const tekst = surowa.replace(/\r$/, '')
    if (PLOT.test(tekst)) kod = !kod
    const rozbior = kod ? null : rozbierzLinie(tekst)
    return rozbior && /-figma\.png/.test(rozbior.tresc) && !FIZYCZNE.test(rozbior.tresc) ? [{ nr: i + 1, tekst, rozbior }] : []
  })
}

/** @param {{ rozbior: Linia }[]} linie @returns {Set<string>} tresci wystepujace w kilku liniach */
function powtorzone(linie) {
  /** @type {Map<string, number>} */
  const wystapienia = new Map()
  for (const l of linie) wystapienia.set(l.rozbior.tresc, (wystapienia.get(l.rozbior.tresc) ?? 0) + 1)
  return new Set([...wystapienia].filter(([, n]) => n > 1).map(([t]) => t))
}

/**
 * @param {string} md tresc smoke'u
 * @param {Skrot} skrot
 * @returns {Punkt[]} punkty z co najmniej jednym ekranem `visual-diff/<ekran>-figma.png`
 */
export function punktyWizualne(md, skrot) {
  const linie = linieZMakieta(md).filter((l) => ekranyTresci(l.rozbior.tresc).length)
  const dublowane = powtorzone(linie)
  return linie.map(({ nr, tekst, rozbior }) => {
    const trasa = trasaTresci(rozbior.tresc)
    return {
      id: `p-${skrot(rozbior.tresc).slice(0, DLUGOSC_ID)}`, linia: nr, tekst, checkbox: rozbior.checkbox, adnotacje: rozbior.adnotacje,
      tresc: rozbior.tresc, status: statusLinii(rozbior), ekrany: ekranyTresci(rozbior.tresc), trasa, trasaStartowa: trasaStartowa(trasa),
      viewport: viewportTresci(rozbior.tresc), niejednoznaczny: dublowane.has(rozbior.tresc), opis: opisTresci(rozbior.tresc),
    }
  })
}

/**
 * Uwagi formatu R11 punktu wizualnego: `- [ ] <Urzadzenie>: \`<trasa>\` obok \`visual-diff/<ekran>-figma.png\` (viewport WxH) → <wynik>`.
 * Pola po „→”: zapis zaczety od „Wejście:” z brakami — zawsze uwaga; bez „Wejście:” (stary R11, takze ze slowem „Stany:”) —
 * uwaga tylko z `pola` (nowy smoke; stare smoke'i bez zmian).
 * @param {string} tresc
 * @param {boolean} pola
 * @returns {string[]}
 */
function uwagiPol(tresc, pola) {
  const po = tresc.slice(tresc.indexOf('→') + 1)
  const brak = NAZWY_POL.filter(([, w]) => !w.test(po)).map(([n]) => n)
  if (brak.includes('Wejście')) return pola ? ['po „→” brak pól „Wejście: … Porównaj: … Stany: …”'] : []
  if (brak.length) return brak.map((n) => `po „→” brak pola „${n}:” (format: Wejście: … Porównaj: … Stany: …)`)
  return POLA.test(po.replace(/`/g, '').trim()) ? [] : ['pola po „→” w kolejności: Wejście:, Porównaj:, Stany:']
}

/**
 * @param {string} tresc
 * @param {string[]} ekrany
 * @param {boolean} pola
 * @returns {string[]}
 */
function uwagiFormatu(tresc, ekrany, pola) {
  if (!ekrany.length) return ['makieta bez ścieżki `visual-diff/<ekran>-figma.png` — narzędzie nie znajdzie ekranu']
  /** @type {string[]} */
  const uwagi = []
  if (ekrany.length > 1) uwagi.push(`kilka makiet w jednym punkcie (${ekrany.join(', ')}) — jedna makieta na punkt`)
  if (!new RegExp(`(^|\\s)obok \`visual-diff/${ekrany[0].replace(/[.]/g, '\\.')}-figma\\.png\``).test(tresc)) uwagi.push('makieta nie stoi po „obok” w backtickach (zapis: `<trasa>` obok `visual-diff/<ekran>-figma.png`)')
  if (!VIEWPORT_R11.test(tresc)) uwagi.push('brak „(viewport <W>×<H>)” bez dwukropka i sufiksu')
  if (!tresc.includes('→')) uwagi.push('brak „→ <oczekiwany wynik>”')
  else uwagi.push(...uwagiPol(tresc, pola))
  return uwagi
}

/**
 * Kontrola formatu smoke'u (fail-closed, z numerem linii): punkty z makieta spoza formatu R11, bez ekranu albo niejednoznaczne.
 * @param {string} md
 * @param {{ pola?: boolean }} [opcje] pola: punkt wymaga trzech pol po „→” (smoke pisany wedlug formatu P27 S3)
 * @returns {Problem[]}
 */
export function sprawdzFormat(md, { pola = false } = {}) {
  const linie = linieZMakieta(md)
  const dublowane = powtorzone(linie)
  return linie.flatMap(({ nr, rozbior }) => {
    const uwagi = uwagiFormatu(rozbior.tresc, ekranyTresci(rozbior.tresc), pola)
    if (dublowane.has(rozbior.tresc)) uwagi.push('ta sama treść punktu stoi w checkliście kilka razy — narzędzie nie zapisze decyzji')
    return uwagi.map((powod) => ({ linia: nr, powod }))
  })
}
