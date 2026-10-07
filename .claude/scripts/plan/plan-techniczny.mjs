// Plan techniczny z dev-plan (PLAN-POPRAWY P13): frontmatter, sekcje, fazy i Implementation Units z polami, ktore
// generator przepisuje do docs/active/ (tabela plikow, scenariusze, weryfikacja, operator checklist), a bramka sprawdza.

const NAGLOWEK_FAZY = /^#{2,3}\s+Faza\s+(\S+?)\s*[—–:-]\s*(.+?)\s*$/
const NAGLOWEK_IU = /^(?:- \[[ x]\] \*\*IU-(\d+):\s*(.+?)\*\*|#{3,4}\s+IU-(\d+):\s*(.+?))\s*$/
const POLE = /^\*{0,2}([A-ZŻŹĆĄŚĘŁÓŃa-zżźćńółęąś ]+?)(?:\s*\([^)]*\))?:\*{0,2}\s*(.*)$/
const KLUCZ_FM = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/
const ZNANE_POLA = new Set(['cel', 'wymagania', 'zaleznosci', 'pliki', 'delegate to', 'skills in play', 'podejscie', 'notatka wykonawcza',
  'teksty', 'wzorce do nasladowania', 'wzorce', 'scenariusze testowe', 'weryfikacja', 'operator checklist', 'zalezy od', 'rownolegle z'])

/**
 * @typedef {{ akcja: string, sciezka: string, dzis: number | null, po: number | null, wymiary: string, werdykt: string }} Plik
 * @typedef {{ typ: string, tresc: string, flow: string | null, seed: string | null }} Scenariusz
 * @typedef {{ tresc: string, e2e: boolean }} Weryfikacja
 * @typedef {{ id: string, numer: number, nazwa: string, faza: number | null, delegate: string, tabelaPlikow: boolean,
 *   pliki: Plik[], scenariusze: Scenariusz[], weryfikacja: Weryfikacja[], operator: string[], tekst: string }} Jednostka
 * @typedef {{ numer: number, oznaczenie: string, nazwa: string, zalezyOd: string, rownolegleZ: string, iu: Jednostka[] }} Faza
 * @typedef {{ frontmatter: Record<string, string | null | Record<string, string>>, sekcje: string[], przeglad: string,
 *   fazy: Faza[], bezFazy: Jednostka[], rejestrStalych: boolean }} Plan
 */

/** @param {string} s @returns {string} */
export function bezOgonkow(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
}

/** @param {string | undefined} v @returns {string | null} */
function skalar(v) {
  const t = (v ?? '').replace(/\s+#.*$/, '').trim()
  if (!t || t === 'null' || t === '~' || t === '{}') return null
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t
}

/**
 * Frontmatter planu: skalary i jednopoziomowe mapy (`figma_screens:` z wcietymi `nazwa: sciezka`). Bez biblioteki YAML.
 * @param {string[]} linie
 * @returns {{ pola: Record<string, string | null | Record<string, string>>, koniec: number }}
 */
function frontmatter(linie) {
  /** @type {Record<string, string | null | Record<string, string>>} */
  const pola = {}
  const koniec = linie[0] === '---' ? linie.indexOf('---', 1) : -1
  if (koniec === -1) return { pola, koniec: 0 }
  /** @type {string | null} */
  let mapa = null
  for (const linia of linie.slice(1, koniec)) {
    const wciete = /^\s+([\w.-]+):\s*(.*)$/.exec(linia)
    const nadrzedna = mapa ? pola[mapa] : null
    if (wciete && mapa && nadrzedna && typeof nadrzedna === 'object') {
      nadrzedna[wciete[1]] = skalar(wciete[2]) ?? ''
      continue
    }
    const k = KLUCZ_FM.exec(linia)
    if (!k) continue
    const wartosc = skalar(k[2])
    mapa = wartosc === null && !(k[2] ?? '').includes('null') ? k[1] : null
    pola[k[1]] = mapa ? {} : wartosc
  }
  return { pola, koniec: koniec + 1 }
}

/** @param {string} komorka @returns {[number | null, number | null]} */
function linieDzisPo(komorka) {
  const m = /(\d+|—|-)\s*(?:→|->)\s*(\d+|—|-)/.exec(komorka)
  const liczba = (/** @type {string | undefined} */ s) => (s && /^\d+$/.test(s) ? Number(s) : null)
  return m ? [liczba(m[1]), liczba(m[2])] : [null, null]
}

/** @param {string} tekst @returns {string} pierwsza sciezka w backtickach albo tekst bez dopiskow */
function sciezka(tekst) {
  return /`([^`]+)`/.exec(tekst)?.[1] ?? tekst.replace(/\s*\(.*$/, '').trim()
}

/**
 * Pole "Pliki": tabela (Akcja | Plik | Linie dzis → po | Wymiary | Werdykt) albo lista `- Akcja: `sciezka`` starszych planow.
 * @param {string[]} linie
 * @returns {{ tabela: boolean, pliki: Plik[] }}
 */
function polePliki(linie) {
  const wiersze = linie.filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((k) => k.trim()))
  const naglowek = wiersze[0]?.map((k) => bezOgonkow(k).toLowerCase())
  if (naglowek && naglowek.includes('plik')) {
    const kol = (/** @type {string} */ nazwa) => naglowek.findIndex((k) => k.startsWith(nazwa))
    const [iAkcja, iPlik, iLinie, iWymiary, iWerdykt] = ['akcja', 'plik', 'linie', 'wymiary', 'werdykt'].map(kol)
    const pliki = wiersze.slice(1).filter((w) => !w.every((k) => /^:?-+:?$/.test(k))).map((w) => {
      const [dzis, po] = linieDzisPo(w[iLinie] ?? '')
      return { akcja: w[iAkcja] ?? '', sciezka: sciezka(w[iPlik] ?? ''), dzis, po, wymiary: w[iWymiary] ?? '', werdykt: w[iWerdykt] ?? '' }
    })
    return { tabela: true, pliki }
  }
  const pliki = linie.map((l) => /^\s*-\s+(?:([^:`]+):\s*)?(.+)$/.exec(l)).filter((m) => m !== null)
    .map((m) => ({ akcja: (m[1] ?? '').trim(), sciezka: sciezka(m[2]), dzis: null, po: null, wymiary: '', werdykt: '' }))
  return { tabela: false, pliki }
}

/** @param {string} pozycja tresc po "- " @returns {Scenariusz} */
function scenariusz(pozycja) {
  const typ = /^\[(Unit|E2E|Manual)\]\s*/.exec(pozycja)
  const tresc = typ ? pozycja.slice(typ[0].length) : pozycja
  return {
    typ: typ ? typ[1] : '',
    tresc,
    flow: typ?.[1] === 'E2E' ? (/^`([^`]+)`/.exec(tresc)?.[1] ?? null) : null,
    seed: /\(seed:\s*([^)\s]+)\)/.exec(tresc)?.[1] ?? null,
  }
}

/** @param {string[]} linie @returns {string[]} tresc pozycji listy (kontynuacje wciete doklejone) */
function pozycje(linie) {
  /** @type {string[]} */
  const wynik = []
  for (const linia of linie) {
    const p = /^-\s+(?:\[[ x]\]\s+)?(.*)$/.exec(linia)
    if (p) wynik.push(p[1].trim())
    else if (/^\s+\S/.test(linia) && wynik.length && !/^\s*\|/.test(linia)) wynik[wynik.length - 1] += ` ${linia.trim()}`
  }
  return wynik
}

/**
 * Pola jednostki: nazwa pola → linie do nastepnego pola.
 * @param {string[]} linie
 * @returns {Map<string, { wartosc: string, linie: string[] }>}
 */
function polaBloku(linie) {
  /** @type {Map<string, { wartosc: string, linie: string[] }>} */
  const pola = new Map()
  /** @type {{ wartosc: string, linie: string[] } | null} */
  let biezace = null
  for (const linia of linie) {
    const p = POLE.exec(linia)
    const klucz = p ? bezOgonkow(p[1]).toLowerCase().trim() : ''
    if (p && ZNANE_POLA.has(klucz) && !/^\s*[-|]/.test(linia)) {
      biezace = { wartosc: p[2].replace(/^\*+\s*/, '').trim(), linie: [] }
      pola.set(klucz, biezace)
    } else if (biezace) biezace.linie.push(linia)
  }
  return pola
}

/**
 * @param {string} id @param {number} numer @param {string} nazwa @param {number | null} faza @param {string[]} linie
 * @returns {Jednostka}
 */
function jednostka(id, numer, nazwa, faza, linie) {
  const pola = polaBloku(linie)
  const lista = (/** @type {string} */ klucz) => pozycje(pola.get(klucz)?.linie ?? [])
  const { tabela, pliki } = polePliki(pola.get('pliki')?.linie ?? [])
  return {
    id, numer, nazwa, faza,
    delegate: (pola.get('delegate to')?.wartosc ?? '').replace(/[`*]/g, '').trim(),
    tabelaPlikow: tabela,
    pliki,
    scenariusze: lista('scenariusze testowe').map(scenariusz),
    weryfikacja: lista('weryfikacja').map((t) => ({ tresc: t.replace(/^\[E2E\]\s*/, ''), e2e: /^\[E2E\]/.test(t) })),
    operator: lista('operator checklist'),
    tekst: linie.join('\n'),
  }
}

/** @param {string} md @param {string} nazwa @returns {string} pierwszy akapit sekcji `## <nazwa>` */
function pierwszyAkapit(md, nazwa) {
  const linie = md.split('\n')
  const start = linie.findIndex((l) => new RegExp(`^##\\s+${nazwa}`, 'i').test(bezOgonkow(l)))
  if (start === -1) return ''
  const akapit = []
  for (const linia of linie.slice(start + 1)) {
    if (/^#/.test(linia) || (!linia.trim() && akapit.length)) break
    if (linia.trim()) akapit.push(linia.trim())
  }
  return akapit.join(' ')
}

/**
 * @param {string} md tresc planu technicznego
 * @returns {Plan}
 */
export function parsujPlan(md) {
  const wszystkie = md.split('\n')
  const { pola, koniec } = frontmatter(wszystkie)
  const linie = wszystkie.slice(koniec)
  /** @type {Faza[]} */
  const fazy = []
  /** @type {Jednostka[]} */
  const bezFazy = []
  /** @type {{ id: string, numer: number, nazwa: string, faza: Faza | null, linie: string[] } | null} */
  let iu = null
  /** @type {Faza | null} */
  let faza = null
  const zamknijIu = () => {
    if (!iu) return
    const j = jednostka(iu.id, iu.numer, iu.nazwa, iu.faza?.numer ?? null, iu.linie)
    if (iu.faza) iu.faza.iu.push(j)
    else bezFazy.push(j)
    iu = null
  }
  for (const linia of linie) {
    const f = NAGLOWEK_FAZY.exec(linia)
    const j = NAGLOWEK_IU.exec(linia)
    if (f || (/^## /.test(linia) && !j)) zamknijIu()
    if (f) {
      faza = { numer: /^\d+$/.test(f[1]) ? Number(f[1]) : NaN, oznaczenie: f[1], nazwa: f[2], zalezyOd: '', rownolegleZ: '', iu: [] }
      fazy.push(faza)
    } else if (/^## /.test(linia)) faza = null
    else if (j) {
      zamknijIu()
      const numer = Number(j[1] ?? j[3])
      iu = { id: `IU-${numer}`, numer, nazwa: (j[2] ?? j[4]).trim(), faza, linie: [] }
    } else if (iu) iu.linie.push(linia)
    else if (faza) {
      const p = POLE.exec(linia)
      const klucz = p ? bezOgonkow(p[1]).toLowerCase() : ''
      if (p && klucz === 'zalezy od') faza.zalezyOd = p[2].replace(/\*/g, '').trim()
      if (p && klucz === 'rownolegle z') faza.rownolegleZ = p[2].replace(/\*/g, '').trim()
    }
  }
  zamknijIu()
  return {
    frontmatter: pola,
    sekcje: linie.filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim()),
    przeglad: pierwszyAkapit(md, 'Przeglad'),
    fazy,
    bezFazy,
    rejestrStalych: linie.some((l) => /^##\s+Rejestr sta/i.test(bezOgonkow(l))),
  }
}

/**
 * Nazwa zadania = <slug> z `YYYY-MM-DD-NNN-<typ>-<slug>-plan.md`.
 * @param {string} sciezkaPlanu
 * @returns {string}
 */
export function nazwaZadania(sciezkaPlanu) {
  const plik = sciezkaPlanu.slice(sciezkaPlanu.lastIndexOf('/') + 1).replace(/\.md$/, '')
  return plik.replace(/^\d{4}-\d{2}-\d{2}-\d{3}-(?:feat|fix|refactor)-/, '').replace(/-plan$/, '')
}
