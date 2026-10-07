// Mapa funkcji skilla weryfikacji (P14, PANEL-WEJSCIE §2 pkt 14): jeden wpis na funkcje — droga uzytkownika, dowod dzialania,
// pliki kodu. Zrodlo wpisu: scenariusz [E2E] planu technicznego (flow = klucz) i pole Pliki jego jednostki. Archiwizacja
// dopisuje funkcje zadania (`e2e.mjs mapa`), generator skilla zasiewa mape z planow zadan zrobionych przed nim.
//
// Scalanie po flow: Droga i Dowod bierze z nowszego planu, Pliki i Zadania sumuje, pola dopisane recznie (np. Selektory)
// z ich podlistami i luzne linie wpisu zostawia; wpis bez zmian, tekst nad wpisami i sekcje spoza wpisow zostaja bajt w bajt.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { sciezkaPlanu } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { parsujPlan } from '../plan/plan-techniczny.mjs'
import { bezOgonkow } from '../plan/pola-iu.mjs'
import { KOMENDA_GENERATORA, maSkillWeryfikacji, PLIK_MAPY } from './weryfikacja.mjs'

/**
 * @typedef {{ flow: string, droga: string, dowod: string, pliki: string[], zadania: string[] }} Wpis
 * @typedef {[string, string][]} Pola  pola wpisu w kolejnosci pliku: [klucz, wartosc]
 * @typedef {{ flow: string | null, linie: string[] }} Blok  sekcja `## …` mapy; flow = null dla sekcji, ktora nie jest wpisem
 * @typedef {{ preambula: string[], bloki: Blok[], wpisy: Map<string, Pola> }} Mapa
 */

const POLA_WPISU = ['Droga', 'Dowód', 'Pliki', 'Zadania']
const BRAK = '—'
const NAGLOWEK_WPISU = /^## `([^`]+)`\s*$/
const POLE = /^- ([^:]+): (.*)$/
// Pliki jednostki, ktore nie sa kodem funkcji: testy, scenariusze i seedy e2e, migracje (rosna z kazdym zadaniem).
const NIE_KOD = /\.(?:test|spec)\.|__tests__\/|(?:^|\/)e2e\/|\.maestro\/|-seed\.sql$|supabase\/migrations\//

/**
 * Opis scenariusza `<flow>`[ (seed: …)] — <kroki> → <oczekiwany stan>: droga = kroki, dowod = stan za ostatnia strzalka.
 * Koncowe „→ PASS” starszych planow nie jest stanem aplikacji.
 * @param {string} tresc
 * @returns {{ droga: string, dowod: string }}
 */
export function rozbijScenariusz(tresc) {
  const opis = tresc.replace(/^`[^`]+`\s*/, '').replace(/^\(seed:[^)]*\)\s*/, '').replace(/^(?:[—–]|-(?!>))\s*/, '')
    .replace(/\s*(?:→|->)\s*PASS\.?\s*$/, '').trim()
  const m = /^(.*)(?:→|->)\s*(.*)$/s.exec(opis)
  return m ? { droga: m[1].trim(), dowod: m[2].trim() } : { droga: opis, dowod: '' }
}

/** @param {string[]} a @param {string[]} b @returns {string[]} suma z zachowaniem kolejnosci */
const suma = (a, b) => [...new Set([...a, ...b])]

/**
 * @param {string} md plan techniczny
 * @param {string} zadanie nazwa zadania (pole Zadania wpisu)
 * @returns {Wpis[]}
 */
export function wpisyZPlanu(md, zadanie) {
  const plan = parsujPlan(md)
  /** @type {Map<string, Wpis>} */
  const wpisy = new Map()
  for (const iu of [...plan.fazy.flatMap((f) => f.iu), ...plan.bezFazy]) {
    const pliki = iu.pliki.filter((p) => !/test|e2e|usun/i.test(bezOgonkow(p.akcja)) && p.sciezka && !NIE_KOD.test(p.sciezka)).map((p) => p.sciezka)
    for (const s of iu.scenariusze) {
      if (s.typ !== 'E2E' || !s.flow || s.flow.endsWith('.sh')) continue
      const poprzedni = wpisy.get(s.flow)
      wpisy.set(s.flow, { flow: s.flow, ...rozbijScenariusz(s.tresc), pliki: suma(poprzedni?.pliki ?? [], pliki), zadania: [zadanie] })
    }
  }
  return [...wpisy.values()]
}

/** @param {string[]} linie bloku @returns {Pola} */
const polaBloku = (linie) => linie.slice(1).flatMap((l) => {
  const m = POLE.exec(l)
  return m ? [/** @type {[string, string]} */ ([m[1], m[2]])] : []
})

/**
 * @typedef {{ przed: string[], kontynuacje: Map<string, string[][]>, luzne: string[] }} Reszta
 *   przed = linie miedzy naglowkiem a pierwszym polem; kontynuacje = wciete linie (podlista) kazdego wystapienia pola,
 *   po kluczu i numerze wystapienia; luzne = pozostale linie wpisu
 */

/**
 * Linie wpisu poza samymi polami — wracaja przy aktualizacji wpisu na swoje miejsce.
 * @param {string[]} linie bloku
 * @returns {Reszta}
 */
function resztaBloku(linie) {
  /** @type {Reszta} */
  const reszta = { przed: [], kontynuacje: new Map(), luzne: [] }
  /** @type {string[] | null} */
  let podlista = null
  let byloPole = false
  for (const l of linie.slice(1)) {
    const m = POLE.exec(l)
    if (m) {
      podlista = []
      reszta.kontynuacje.set(m[1], [...(reszta.kontynuacje.get(m[1]) ?? []), podlista])
      byloPole = true
    } else if (!l.trim()) continue
    else if (!byloPole) reszta.przed.push(l)
    else if (podlista && /^\s+\S/.test(l)) podlista.push(l)
    else {
      reszta.luzne.push(l)
      podlista = null
    }
  }
  return reszta
}

/**
 * @param {string} md tresc mapy
 * @returns {Mapa}
 */
export function parsujMape(md) {
  const linie = md.replace(/\r\n/g, '\n').split('\n')
  const start = linie.findIndex((l) => l.startsWith('## '))
  /** @type {Blok[]} */
  const bloki = []
  for (const l of start === -1 ? [] : linie.slice(start)) {
    if (l.startsWith('## ')) bloki.push({ flow: NAGLOWEK_WPISU.exec(l)?.[1] ?? null, linie: [l] })
    else bloki[bloki.length - 1].linie.push(l)
  }
  const wpisy = new Map(bloki.flatMap((b) => (b.flow ? [/** @type {[string, Pola]} */ ([b.flow, polaBloku(b.linie)])] : [])))
  return { preambula: start === -1 ? linie : linie.slice(0, start), bloki, wpisy }
}

/** @param {string} wartosc pola Pliki (z backtickami albo wpisane recznie po przecinku) @returns {string[]} */
const plikiPola = (wartosc) => wartosc.split(',').map((p) => p.trim().replace(/^`|`$/g, '')).filter((p) => p && p !== BRAK)
/** @param {string} wartosc pola Zadania @returns {string[]} */
const zadaniaPola = (wartosc) => (wartosc === BRAK ? [] : wartosc.split(',').map((z) => z.trim()).filter(Boolean))

/**
 * @param {Pola} stare pola istniejacego wpisu (puste dla nowego)
 * @param {Wpis} w
 * @returns {Pola} cztery pola wpisu w stalej kolejnosci, potem pola dopisane recznie
 */
function scalPola(stare, w) {
  const pole = (/** @type {string} */ k) => stare.find(([klucz]) => klucz === k)?.[1] ?? ''
  const pliki = suma(plikiPola(pole('Pliki')), w.pliki)
  const zadania = suma(zadaniaPola(pole('Zadania')), w.zadania)
  return [
    ['Droga', w.droga || BRAK], ['Dowód', w.dowod || BRAK],
    ['Pliki', pliki.length ? pliki.map((p) => `\`${p}\``).join(', ') : BRAK], ['Zadania', zadania.join(', ') || BRAK],
    ...stare.filter(([k]) => !POLA_WPISU.includes(k)),
  ]
}

/** @param {Pola} pola @returns {Pola} pola w kolejnosci, w jakiej zapisuje je scalanie */
const kanon = (pola) => [...POLA_WPISU.flatMap((k) => pola.filter(([klucz]) => klucz === k)), ...pola.filter(([k]) => !POLA_WPISU.includes(k))]

/**
 * @param {string} flow
 * @param {Pola} pola
 * @param {Reszta} [reszta] z istniejacego wpisu
 * @returns {string[]}
 */
function linieWpisu(flow, pola, reszta = { przed: [], kontynuacje: new Map(), luzne: [] }) {
  /** @type {Map<string, number>} */
  const wystapienia = new Map()
  const liniePol = pola.flatMap(([k, v]) => {
    const n = wystapienia.get(k) ?? 0
    wystapienia.set(k, n + 1)
    return [`- ${k}: ${v}`, ...(reszta.kontynuacje.get(k)?.[n] ?? [])]
  })
  return [`## \`${flow}\``, ...reszta.przed, ...liniePol, ...reszta.luzne, '']
}

/** @param {string} projekt @returns {string[]} */
const naglowekMapy = (projekt) => [
  `# Mapa funkcji — ${projekt}`, '',
  'Jeden wpis na funkcję aplikacji: droga użytkownika, dowód działania i pliki kodu. Wpisy dopisuje archiwizacja zadania ze scenariuszy [E2E]',
  'planu technicznego (`node .claude/scripts/e2e/e2e.mjs mapa`); pola spoza Droga, Dowód, Pliki i Zadania (np. Selektory) zostają przy scalaniu.', '',
]

/**
 * @param {string | null} md obecna mapa (null: nowa)
 * @param {Wpis[]} wpisy
 * @param {string} projekt nazwa projektu do naglowka nowej mapy
 * @returns {{ tekst: string, dodane: string[], zaktualizowane: string[] }}
 */
export function scalMape(md, wpisy, projekt) {
  // Parsowanie po LF (inaczej `(.*)$` pola nie przechodzi przez \r i kazde scalenie dublowaloby pola); zapis koncami linii
  // obecnej mapy, a mapa bez zmian wraca bez zmian.
  const eol = md?.includes('\r\n') ? '\r\n' : '\n'
  const mapa = md === null ? { preambula: naglowekMapy(projekt), bloki: /** @type {Blok[]} */ ([]) } : parsujMape(md)
  /** @type {string[]} */
  const dodane = []
  /** @type {string[]} */
  const zaktualizowane = []
  for (const w of wpisy) {
    const blok = mapa.bloki.find((b) => b.flow === w.flow)
    if (!blok) {
      const ostatni = mapa.bloki.at(-1)?.linie ?? mapa.preambula
      if (ostatni.at(-1) !== '') ostatni.push('')
      mapa.bloki.push({ flow: w.flow, linie: linieWpisu(w.flow, scalPola([], w)) })
      dodane.push(w.flow)
      continue
    }
    const stare = polaBloku(blok.linie)
    const nowe = scalPola(stare, w)
    if (JSON.stringify(nowe) === JSON.stringify(kanon(stare))) continue
    blok.linie = linieWpisu(w.flow, nowe, resztaBloku(blok.linie))
    zaktualizowane.push(w.flow)
  }
  if (md !== null && !dodane.length && !zaktualizowane.length) return { tekst: md, dodane, zaktualizowane }
  return { tekst: [...mapa.preambula, ...mapa.bloki.flatMap((b) => b.linie)].join(eol), dodane, zaktualizowane }
}

/**
 * Funkcje zadania do mapy projektu (archiwizacja). Bez skilla weryfikacji mapa nie powstaje — generator zasieje ja z planow.
 * @param {string} projekt
 * @param {string} katalogZadania docs/active/<zadanie> wzgledem projektu
 * @returns {{ pominieto: string } | { blad: string } | { plik: string, plan: string, dodane: string[], zaktualizowane: string[] }}
 */
export function dopiszZadanie(projekt, katalogZadania) {
  if (!maSkillWeryfikacji(projekt)) return { pominieto: `brak skilla weryfikacji projektu — mapa funkcji powstanie z ${KOMENDA_GENERATORA}` }
  const planZadania = plikZadania(join(projekt, katalogZadania), '-plan.md')?.tresc
  const plan = planZadania ? sciezkaPlanu(planZadania) : null
  if (!plan || !existsSync(join(projekt, plan))) return { blad: `brak planu technicznego zadania (wskaźnik: ${plan ?? 'brak linii „Plan techniczny:” w planie zadania'})` }
  const sciezkaMapy = join(projekt, PLIK_MAPY)
  const obecna = existsSync(sciezkaMapy) ? readFileSync(sciezkaMapy, 'utf8') : null
  const { tekst, dodane, zaktualizowane } = scalMape(obecna, wpisyZPlanu(readFileSync(join(projekt, plan), 'utf8'), basename(katalogZadania)), basename(projekt))
  if (tekst !== obecna) writeFileSync(sciezkaMapy, tekst)
  return { plik: PLIK_MAPY, plan, dodane, zaktualizowane }
}
