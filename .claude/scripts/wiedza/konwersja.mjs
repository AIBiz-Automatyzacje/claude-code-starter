// Jednorazowa konwersja .claude/rules/learned-patterns.md projektu (PLAN-POPRAWY P10, PW11). Skrypt robi czesc
// deterministyczna: kandydaci (tytul reguly jako propozycja, zrodla, waga z severity, wzorce plikow ze sciezek
// cytowanych w solution) → agent dopisuje klase ze slownika i poprawia regule/wzorce → zastosowanie z walidacja
// jak przy compoundzie. Czego nie da sie zapisac, trafia na liste odrzutow dla operatora.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { posix, join } from 'node:path'

import { czytajFrontmatter, ustawPola } from './frontmatter.mjs'
import { liczZdania, walidujWpis } from './walidacja.mjs'
import { POLA_ROZPOZNAJACE } from './wpisy.mjs'

export const PLIK_LEARNED_PATTERNS = '.claude/rules/learned-patterns.md'
const ARCHIWUM = 'docs/archiwum'
const REGULA = /^- \*\*(.+?)\*\*:?\s*(.*)$/
const ZRODLO = /^\s+Source:\s*(\S+)/
const WAGA_Z_SEVERITY = /** @type {Record<string, string>} */ ({ critical: 'wysoka', high: 'wysoka', medium: 'srednia', low: 'niska' })
const SZCZEBEL_KONWERSJI = 'regula'
const POWOD_KONWERSJI = 'konwersja learned-patterns: regula tekstowa sprzed P10, bez bramki mechanicznej'
const MAKS_REGULA_ZN = 400
// Wzorce wiedzy wskazuja kod: dokumentacja cytowana w solution (plany, archiwum zadan, reguly) nie jest kandydatem.
const DOKUMENTACJA = /^(?:docs|\.claude)\/|\.md$/

/**
 * @typedef {{ nr: number, tytul: string, tresc: string, zrodla: string[], solution: string | null, klasa: string,
 *   regula: string, paths: string[], waga: string, date: string, uwagi: string[] }} Kandydat
 */

/** @param {string} tekst @returns {{ tytul: string, tresc: string, zrodla: string[] }[]} */
function reguly(tekst) {
  /** @type {{ tytul: string, tresc: string, zrodla: string[] }[]} */
  const wynik = []
  for (const linia of tekst.split('\n')) {
    const r = REGULA.exec(linia)
    if (r) {
      wynik.push({ tytul: r[1].trim(), tresc: r[2].trim(), zrodla: [] })
      continue
    }
    const z = ZRODLO.exec(linia)
    if (z && wynik.length) wynik[wynik.length - 1].zrodla.push(z[1])
  }
  return wynik
}

/** @param {string} tytul @returns {string} tytul jako regula 1-2 zdan albo '' gdy za dlugi */
function regulaZTytulu(tytul) {
  const regula = /[.!?…]$/.test(tytul) ? tytul : `${tytul}.`
  return liczZdania(regula) <= 2 && regula.length <= MAKS_REGULA_ZN ? regula : ''
}

/**
 * Wzorce plikow z tokenow sciezek w tresci solution: plik repo rowny tokenowi albo konczacy sie na niego (token ze /)
 * → `katalog/**`, plik w korzeniu → jego nazwa. Kolejnosc: czestosc, potem alfabet.
 * @param {string} tresc
 * @param {string[]} pliki
 * @returns {string[]}
 */
function wzorceZTresci(tresc, pliki) {
  const tokeny = [...tresc.matchAll(/`([^`\s]+)`/g)].map((m) => m[1])
    .concat([...tresc.matchAll(/[\w.@-]+(?:\/[\w.@-]+)+/g)].map((m) => m[0]))
  const kod = pliki.filter((p) => !DOKUMENTACJA.test(p))
  /** @type {Map<string, number>} */
  const licznik = new Map()
  for (const token of tokeny) {
    const trafione = kod.filter((p) => p === token || (token.includes('/') && p.endsWith(`/${token}`)))
    for (const p of new Set(trafione.map((t) => (posix.dirname(t) === '.' ? t : `${posix.dirname(t)}/**`)))) {
      licznik.set(p, (licznik.get(p) ?? 0) + 1)
    }
  }
  return [...licznik.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g)
}

/** @param {string} sciezka @returns {boolean} plik .md wewnatrz docs/solutions/ (bez segmentow . i ..) */
function wSolutions(sciezka) {
  return sciezka.startsWith('docs/solutions/') && sciezka.endsWith('.md') && !sciezka.split('/').some((s) => s === '..' || s === '.')
}

/**
 * @param {string} tekst tresc .claude/rules/learned-patterns.md
 * @param {string} projekt
 * @param {string[]} pliki pliki repo
 * @returns {Kandydat[]}
 */
export function kandydaci(tekst, projekt, pliki) {
  return reguly(tekst).map((r, i) => {
    const poza = r.zrodla.filter((z) => !wSolutions(z))
    const brakujace = r.zrodla.filter((z) => !poza.includes(z) && !existsSync(join(projekt, z)))
    const solution = r.zrodla.find((z) => !poza.includes(z) && !brakujace.includes(z)) ?? null
    const tresc = solution ? readFileSync(join(projekt, solution), 'utf8') : ''
    const pola = czytajFrontmatter(tresc)?.pola ?? {}
    const tekstPola = (/** @type {string} */ p) => (typeof pola[p] === 'string' ? String(pola[p]) : '')
    return {
      nr: i + 1,
      tytul: r.tytul,
      tresc: r.tresc,
      zrodla: r.zrodla,
      solution,
      klasa: '',
      regula: regulaZTytulu(r.tytul),
      paths: wzorceZTresci(tresc, pliki),
      waga: WAGA_Z_SEVERITY[tekstPola('severity')] ?? '',
      date: tekstPola('date'),
      uwagi: [
        ...(r.zrodla.length ? [] : ['brak linii Source']),
        ...poza.map((z) => `zrodlo poza docs/solutions: ${z}`),
        ...brakujace.map((z) => `zrodlo nie istnieje: ${z}`),
      ],
    }
  })
}

/** @typedef {{ nr: number, klasa: string, regula: string, paths: string[], solution: string | null, waga: string }} Propozycja */
/** @typedef {{ nr: number, tytul: string, powod: string }} Odrzut */

/** @param {unknown} p @returns {p is Propozycja} */
function czyPropozycja(p) {
  if (typeof p !== 'object' || p === null) return false
  const o = /** @type {Record<string, unknown>} */ (p)
  return Number.isInteger(o.nr) && typeof o.klasa === 'string' && typeof o.regula === 'string' && typeof o.waga === 'string'
    && Array.isArray(o.paths) && o.paths.every((g) => typeof g === 'string') && (o.solution === null || typeof o.solution === 'string')
}

/** @param {unknown} p @returns {number | null} */
function nrPropozycji(p) {
  const nr = typeof p === 'object' && p !== null ? /** @type {Record<string, unknown>} */ (p).nr : null
  return Number.isInteger(nr) ? Number(nr) : null
}

/**
 * Powod odrzucenia propozycji przed walidacja pol albo null.
 * @param {Kandydat} k
 * @param {unknown} p
 * @param {string} projekt
 * @param {Map<string, number>} zapisane solution -> nr reguly zapisanej w tym przebiegu
 * @returns {string | null}
 */
function bladPropozycji(k, p, projekt, zapisane) {
  if (p === undefined) return 'brak propozycji dla reguly'
  if (!czyPropozycja(p)) return 'zly ksztalt propozycji (nr, klasa, regula, paths, solution, waga)'
  if (p.solution === null) return `brak solution: ${k.uwagi.join('; ') || 'agent nie wskazal pliku'}`
  if (!k.zrodla.includes(p.solution) || !wSolutions(p.solution) || !existsSync(join(projekt, p.solution))) {
    return `solution spoza zrodel reguly albo poza docs/solutions: ${p.solution}`
  }
  const nr = zapisane.get(p.solution)
  if (nr !== undefined) return `solution ma juz regule z nr ${nr}: ${p.solution}`
  const pola = czytajFrontmatter(readFileSync(join(projekt, p.solution), 'utf8'))?.pola ?? {}
  if (POLA_ROZPOZNAJACE.some((pole) => pole in pola)) return `solution ma juz pola wiedzy (konwersja powtorzona?): ${p.solution}`
  return null
}

/**
 * Zapisuje pola wiedzy do solutions wg propozycji agenta; kandydaci liczeni od nowa z pliku (agent nie zmieni zrodel).
 * @param {string} projekt
 * @param {string} tekst tresc .claude/rules/learned-patterns.md
 * @param {unknown[]} propozycje kandydaci z dopisana klasa (plik JSON od agenta)
 * @param {string[]} pliki pliki repo (walidacja globow)
 * @param {string} dzis RRRR-MM-DD
 * @returns {{ zapisane: { nr: number, plik: string }[], odrzuty: Odrzut[] }}
 */
export function zastosuj(projekt, tekst, propozycje, pliki, dzis) {
  /** @type {Map<string, number>} */
  const zapisane = new Map()
  /** @type {Odrzut[]} */
  const odrzuty = []
  for (const k of kandydaci(tekst, projekt, pliki)) {
    const p = propozycje.find((x) => nrPropozycji(x) === k.nr)
    const blad = bladPropozycji(k, p, projekt, zapisane)
    if (blad || !czyPropozycja(p) || !p.solution) {
      odrzuty.push({ nr: k.nr, tytul: k.tytul, powod: blad ?? 'brak solution' })
      continue
    }
    const plik = join(projekt, p.solution)
    const pola = {
      klasa: p.klasa, regula: p.regula, paths: p.paths, waga: p.waga, szczebel: SZCZEBEL_KONWERSJI, szczebel_powod: POWOD_KONWERSJI,
      date: k.date || dzis, zrodlo: `learned-patterns (konwersja ${dzis})`, ucieczki: '0',
    }
    const walidacja = walidujWpis(pola, pliki)
    if (!walidacja.ok) {
      odrzuty.push({ nr: k.nr, tytul: k.tytul, powod: walidacja.bledy.join('; ') })
      continue
    }
    const { date, ...nowe } = pola
    writeFileSync(plik, ustawPola(readFileSync(plik, 'utf8'), { ...(k.date ? {} : { date }), ...nowe, ucieczki: 0 }))
    zapisane.set(p.solution, k.nr)
  }
  return { zapisane: [...zapisane.entries()].map(([plik, nr]) => ({ nr, plik })), odrzuty }
}

/**
 * Przenosi stary plik do docs/archiwum/ (wyjscie z ladowania eager, cofniecie = przeniesienie z powrotem) i zapisuje
 * obok liste odrzutow dla operatora.
 * @param {string} projekt
 * @param {string} tekst tresc .claude/rules/learned-patterns.md
 * @param {Odrzut[]} odrzuty
 * @param {string} dzis
 * @returns {{ plik: string, odrzuty: string }}
 */
export function archiwizuj(projekt, tekst, odrzuty, dzis) {
  const plik = `${ARCHIWUM}/learned-patterns-${dzis}.md`
  const plikOdrzutow = `${ARCHIWUM}/learned-patterns-odrzuty-${dzis}.md`
  mkdirSync(join(projekt, ARCHIWUM), { recursive: true })
  renameSync(join(projekt, PLIK_LEARNED_PATTERNS), join(projekt, plik))
  writeFileSync(join(projekt, plikOdrzutow), [
    `# Odrzuty konwersji learned-patterns (${dzis})`,
    '',
    `Reguly, ktore nie trafily do wiedzy projektu (${odrzuty.length} z ${reguly(tekst).length} regul). Decyzja operatora: dopisac pola`,
    'w solution recznie i sprawdzic `node .claude/scripts/wiedza/wiedza.mjs sprawdz <plik>`, albo pominac.',
    `Pelne brzmienie regul: \`${plik}\`.`,
    '',
    ...odrzuty.map((o) => `- nr ${o.nr} — ${o.tytul}: ${o.powod}`),
    '',
  ].join('\n'))
  return { plik, odrzuty: plikOdrzutow }
}
