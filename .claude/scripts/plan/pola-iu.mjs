// Pola Implementation Unit planu technicznego (PLAN-POPRAWY P13). Parser jest fail-closed: zapis, ktorego nie umie
// jednoznacznie przeczytac (lista wcieta albo z innym znacznikiem, kontynuacja bez wciecia, pole dwa razy, kilka plikow
// w jednej komorce), trafia do `problemy` jednostki i walidacja odrzuca plan — zamiast cicho zgubic scenariusz albo plik.

/**
 * @typedef {{ nr: number, tekst: string, kod: boolean }} Linia  linia pliku planu; kod = wewnatrz bloku kodu
 * @typedef {{ akcja: string, sciezka: string, dzis: number | null, po: number | null, wymiary: string, werdykt: string }} Plik
 * @typedef {{ typ: string, tresc: string, flow: string | null, seed: string | null }} Scenariusz
 * @typedef {{ tresc: string, e2e: boolean }} Weryfikacja
 * @typedef {{ id: string, numer: number, nazwa: string, faza: number | null, start: number, delegate: string,
 *   tabelaPlikow: boolean, pliki: Plik[], scenariusze: Scenariusz[], weryfikacja: Weryfikacja[], operator: string[],
 *   opis: string, problemy: string[] }} Jednostka
 */

const POLE_W_GWIAZDKACH = /^\*\*([^*]+?):\*\*\s*(.*)$/
const POLE_ZA_GWIAZDKAMI = /^\*\*([^*]+?)\*\*\s*(?:\([^)]*\))?\s*:\s*(.*)$/
const POLA_IU = new Set(['cel', 'wymagania', 'zaleznosci', 'pliki', 'delegate to', 'skills in play', 'podejscie', 'notatka wykonawcza',
  'teksty', 'wzorce do nasladowania', 'scenariusze testowe', 'weryfikacja', 'operator checklist'])
const POLA_LISTY = ['scenariusze testowe', 'weryfikacja', 'operator checklist']
const POLA_OPISU = ['cel', 'podejscie', 'notatka wykonawcza']
const SEPARATOR_KOMOREK = /(?<!\\)\|/
const ZAPIS_SEEDA = /\(seed:\s*(e2e\/seeds\/[^\s)]+)/

/** @param {string} s @returns {string} */
export function bezOgonkow(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
}

/**
 * Pole w zapisie szablonu: `**Nazwa:** wartosc`, `**Nazwa (dopisek):**`, `**Nazwa** (dopisek):`.
 * @param {string} linia
 * @returns {{ klucz: string, wartosc: string } | null} klucz bez ogonkow i dopisku w nawiasie, malymi literami
 */
export function pole(linia) {
  const m = POLE_W_GWIAZDKACH.exec(linia) ?? POLE_ZA_GWIAZDKAMI.exec(linia)
  return m ? { klucz: bezOgonkow(m[1]).replace(/\s*\(.*\)\s*$/, '').toLowerCase().trim(), wartosc: m[2].trim() } : null
}

/** @param {string} v @returns {string} wartosc bez placeholdera szablonu (`—`, `*(opcjonalne)*`) */
export function bezPlaceholdera(v) {
  const t = v.replace(/\*\([^)]*\)\*/g, '').replace(/\*/g, '').trim()
  return /^[—–-]?$/.test(t) ? '' : t
}

/** @param {string} komorka @returns {[number | null, number | null]} */
function linieDzisPo(komorka) {
  const m = /(\d+|—|-)\s*(?:→|->)\s*(\d+|—|-)/.exec(komorka)
  const liczba = (/** @type {string | undefined} */ s) => (s && /^\d+$/.test(s) ? Number(s) : null)
  return m ? [liczba(m[1]), liczba(m[2])] : [null, null]
}

/**
 * Pole "Pliki": tabela (Akcja | Plik | Linie dzis → po | Wymiary | Werdykt) albo lista `- Akcja: `sciezka`` starszych planow.
 * @param {Linia[]} linie
 * @param {string[]} problemy
 * @returns {{ tabela: boolean, pliki: Plik[] }}
 */
function polePliki(linie, problemy) {
  const wiersze = linie.filter((l) => /^\s*\|/.test(l.tekst)).map((l) => ({
    nr: l.nr,
    komorki: l.tekst.trim().replace(/^\||\|$/g, '').split(SEPARATOR_KOMOREK).map((k) => k.replace(/\\\|/g, '|').trim()),
  }))
  const naglowek = wiersze[0]?.komorki.map((k) => bezOgonkow(k).toLowerCase())
  if (naglowek?.includes('plik')) {
    const kol = (/** @type {string} */ nazwa) => naglowek.findIndex((k) => k.startsWith(nazwa))
    const [iAkcja, iPlik, iLinie, iWymiary, iWerdykt] = ['akcja', 'plik', 'linie', 'wymiary', 'werdykt'].map(kol)
    const pliki = wiersze.slice(1).filter((w) => !w.komorki.every((k) => /^:?-+:?$/.test(k))).map((w) => {
      const sciezki = [...(w.komorki[iPlik] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1])
      if (sciezki.length > 1) problemy.push(`linia ${w.nr}: kilka plików w jednej komórce — jeden plik na wiersz tabeli`)
      const [dzis, po] = linieDzisPo(w.komorki[iLinie] ?? '')
      return { akcja: w.komorki[iAkcja] ?? '', sciezka: sciezki[0] ?? (w.komorki[iPlik] ?? '').trim(), dzis, po,
        wymiary: w.komorki[iWymiary] ?? '', werdykt: w.komorki[iWerdykt] ?? '' }
    })
    return { tabela: true, pliki }
  }
  const pliki = linie.map((l) => /^\s*-\s+(?:([^:`]+):\s*)?(.+)$/.exec(l.tekst)).filter((m) => m !== null).map((m) => ({
    akcja: (m[1] ?? '').trim(), sciezka: /`([^`]+)`/.exec(m[2])?.[1] ?? m[2].replace(/\s*\(.*$/, '').trim(),
    dzis: null, po: null, wymiary: '', werdykt: '',
  }))
  return { tabela: false, pliki }
}

/**
 * Pozycje listy w kolumnie 0 (`- tresc`, `- [ ] tresc`); wcieta linia tekstu = kontynuacja poprzedniej pozycji.
 * @param {Linia[]} linie
 * @param {string} nazwaPola
 * @param {string[]} problemy
 * @returns {string[]}
 */
function pozycje(linie, nazwaPola, problemy) {
  /** @type {string[]} */
  const wynik = []
  for (const l of linie) {
    if (!l.tekst.trim()) continue
    const p = l.kod ? null : /^-\s+(?:\[[ x]\]\s+)?(.*)$/.exec(l.tekst)
    if (p) wynik.push(p[1].trim())
    else if (!l.kod && wynik.length && /^\s+\S/.test(l.tekst) && !/^\s+(?:[-*+]|\d+[.)])\s/.test(l.tekst)) {
      wynik[wynik.length - 1] += ` ${l.tekst.trim()}`
    } else {
      problemy.push(`linia ${l.nr}: pole „${nazwaPola}” — pozycja poza zapisem \`- \` w kolumnie 0 (lista wcięta, *, numerowana, blok kodu albo kontynuacja bez wcięcia): „${l.tekst.trim().slice(0, 60)}”`)
    }
  }
  return wynik
}

/** @param {string} pozycja tresc po "- " @param {string[]} problemy @returns {Scenariusz} */
function scenariusz(pozycja, problemy) {
  const typ = /^\[(Unit|E2E|Manual)\]\s*/.exec(pozycja)
  const tresc = typ ? pozycja.slice(typ[0].length) : pozycja
  const seed = ZAPIS_SEEDA.exec(tresc)?.[1] ?? null
  if (/\(seed:/.test(tresc) && !seed) problemy.push(`seed w zapisie innym niż „(seed: e2e/seeds/<x>-seed.sql)”: „${tresc.slice(0, 60)}”`)
  return { typ: typ ? typ[1] : '', tresc, flow: typ?.[1] === 'E2E' ? (/^`([^`]+)`/.exec(tresc)?.[1] ?? null) : null, seed }
}

/**
 * Pola jednostki: klucz → wartosc z linii pola i linie do nastepnego pola. Nieznane pogrubione pole konczy biezace
 * (adnotacje dopisane przy wykonaniu nie trafiaja do Weryfikacji); znane pole drugi raz to problem, nie nadpisanie.
 * @param {Linia[]} linie
 * @param {string[]} problemy
 * @returns {Map<string, { wartosc: string, linie: Linia[] }>}
 */
function polaBloku(linie, problemy) {
  /** @type {Map<string, { wartosc: string, linie: Linia[] }>} */
  const pola = new Map()
  /** @type {{ wartosc: string, linie: Linia[] } | null} */
  let biezace = null
  for (const l of linie) {
    const p = l.kod ? null : pole(l.tekst)
    if (p && POLA_IU.has(p.klucz)) {
      if (pola.has(p.klucz)) problemy.push(`linia ${l.nr}: pole „${p.klucz}” drugi raz w tej jednostce — połącz w jedno`)
      biezace = { wartosc: p.wartosc, linie: [] }
      pola.set(p.klucz, biezace)
    } else if (p) biezace = null
    else if (biezace) biezace.linie.push(l)
  }
  return pola
}

/**
 * @param {{ id: string, numer: number, nazwa: string, faza: number | null, start: number }} naglowek
 * @param {Linia[]} linie blok jednostki bez naglowka
 * @returns {Jednostka}
 */
export function jednostka(naglowek, linie) {
  /** @type {string[]} */
  const problemy = []
  const pola = polaBloku(linie, problemy)
  const lista = (/** @type {string} */ klucz) => pozycje(pola.get(klucz)?.linie ?? [], klucz, problemy)
  const [scen, wer, oper] = POLA_LISTY.map(lista)
  const { tabela, pliki } = polePliki(pola.get('pliki')?.linie ?? [], problemy)
  return {
    ...naglowek,
    delegate: (pola.get('delegate to')?.wartosc ?? '').replace(/[`*]/g, '').trim(),
    tabelaPlikow: tabela,
    pliki,
    scenariusze: scen.map((s) => scenariusz(s, problemy)),
    weryfikacja: wer.map((t) => ({ tresc: t.replace(/^\[E2E\]\s*/, ''), e2e: /^\[E2E\]/.test(t) })),
    operator: oper,
    opis: POLA_OPISU.map((k) => [pola.get(k)?.wartosc ?? '', ...(pola.get(k)?.linie ?? []).map((l) => l.tekst)].join('\n')).join('\n'),
    problemy,
  }
}
