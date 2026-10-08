// Rekord `run` telemetrii (d5-telemetria-rekord.txt §2, §7, §8 pkt 1 i 3–4, §11). Czyste funkcje.
// Status: plik harnessu (przeglad D5); run bez pliku: w toku albo przerwany razem z sesja (mini-run (f), decyzja O6).

import { liczbyZRekordu } from '../ogrod/prog.mjs'

/** @typedef {'OK' | 'STOP' | 'KILLED' | 'FAILED'} Status */
/** @typedef {{ status: Status, powod: string | null }} StatusRunu */

// 3 h ciszy w journalu = run nie zyje (najdluzszy agent w historii: 6 016 s). Pozniejszy plik harnessu nadpisuje wersje.
export const PROG_CISZY_MS = 3 * 60 * 60 * 1000

// Statusy wyniku workflowu, ktore oznaczaja zatrzymanie na bramce (reszta, np. GOTOWY-DO-MERGE w dev-pr, to sukces etapu).
const STATUSY_STOP = new Set(['STOP', 'BLAD'])

/** @param {unknown} x @returns {Record<string, unknown>} */
function obiekt(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : {}
}
/** @param {unknown} x @returns {string | null} */
const tekstLubNull = (x) => (typeof x === 'string' && x ? x : null)

const WYNIKI_WALIDACJI = new Set(['PASS', 'FAIL'])

// Autopilot zwraca pelny obiekt walidacji koncowej ({ wynik, typecheck, testy, ... }); stary agent telemetrii zapisywal
// sam wynik. „done w poprzednim runie” = wynik nieznany w tym runie.
/** @param {unknown} walidacja @returns {string | null} */
function wynikWalidacji(walidacja) {
  const wynik = typeof walidacja === 'string' ? walidacja : obiekt(walidacja).wynik
  return typeof wynik === 'string' && WYNIKI_WALIDACJI.has(wynik) ? wynik : null
}

/**
 * @param {Record<string, unknown>} harness plik harnessu
 * @returns {StatusRunu}
 */
export function statusRunu(harness) {
  if (harness.status === 'killed') return { status: 'KILLED', powod: tekstLubNull(harness.error) }
  if (harness.status === 'failed') return { status: 'FAILED', powod: tekstLubNull(harness.error) }
  const wynik = obiekt(harness.result)
  const zatrzymany = typeof wynik.status === 'string' && STATUSY_STOP.has(wynik.status)
  return { status: zatrzymany ? 'STOP' : 'OK', powod: tekstLubNull(wynik.powod) }
}

/**
 * Run bez pliku harnessu. null = w toku (zywa sesja go prowadzi albo byl aktywny niedawno) — skan go pomija.
 * @param {{ wTokuWSesji: boolean, ostatniaAktywnoscMs: number, terazMs: number }} we
 * @returns {StatusRunu | null}
 */
export function statusBezHarnessu(we) {
  if (we.wTokuWSesji) return null
  if (we.terazMs - we.ostatniaAktywnoscMs <= PROG_CISZY_MS) return null
  return { status: 'KILLED', powod: 'sesja zakonczona' }
}

// Kolejnosc ma znaczenie: „P1 nierozwiazane po fixie” to P1, nie fix-FAIL; „walidacja fixa” to fix, nie walidacja koncowa;
// „execute zwrocil partial” bywa opisany slowami o testach E2E, a to STOP buildera. `bramka-wejscia` = etap start dev-pr,
// `start` = bramka wejscia autopilota przed faza 1 (doctor, zielony start; P4).
const DOPISEK_STOP_RUN = ' UWAGA: poza katalogiem zadania'

/** @type {Array<[RegExp, string]>} */
const KATEGORIE_STOPU = [
  [/niezacommitowane zmiany|branch mismatch|nie jest czyste/i, 'czystosc'],
  [/^start: srodowisko E2E/, 'E2E-srodowisko'],
  [/^start: /, 'start'],
  [/^warunek \d+ nie ?spe[lł]niony|warunki bramki/i, 'bramka-wejscia'],
  [/^execute fazy/i, 'execute'],
  [/scribe padl/i, 'scribe'],
  [/\bP1\b/, 'P1'],
  [/fix|tura poprawkowa|BINARNE/i, 'fix-FAIL'],
  [/SRODOWISK|\.env\.e2e|env-up|agent-browser/i, 'E2E-srodowisko'],
  [/E2E/, 'E2E-asercja'],
  [/walidacja koncowa/i, 'walidacja'],
]

/**
 * @param {string | null} powod
 * @returns {string | null}
 */
export function kategoriaStopu(powod) {
  if (!powod) return null
  // stopRun dokleja do KAZDEGO powodu ostrzezenie o brudnym drzewie poza zadaniem — to skutek, nie przyczyna STOP-u.
  const przyczyna = powod.split(DOPISEK_STOP_RUN)[0]
  return KATEGORIE_STOPU.find(([re]) => re.test(przyczyna))?.[1] ?? 'inne'
}

/**
 * @typedef {object} KosztAgenta
 * @property {number} koszt_jedn
 * @property {number} tury
 * @property {number} in
 * @property {number} cache_w
 * @property {number} cache_r
 * @property {number} out
 * @property {string | null} start
 * @property {string | null} koniec
 */

/** @param {KosztAgenta[]} agenci */
export function sumaKosztu(agenci) {
  const s = { agentow: agenci.length, tur: 0, in: 0, cache_w: 0, cache_r: 0, out: 0, jedn: 0 }
  for (const a of agenci) {
    s.tur += a.tury; s.in += a.in; s.cache_w += a.cache_w; s.cache_r += a.cache_r; s.out += a.out; s.jedn += a.koszt_jedn
  }
  return s
}

/** @param {KosztAgenta[]} agenci @returns {string | null} najwczesniejszy start agenta (ISO) */
function startAgentow(agenci) {
  return agenci.map((a) => a.start).filter((s) => typeof s === 'string').sort()[0] ?? null
}

/** @param {KosztAgenta[]} agenci @returns {number | null} */
export function sekundyAgentow(agenci) {
  const starty = agenci.map((a) => (a.start ? Date.parse(a.start) : NaN)).filter(Number.isFinite)
  const konce = agenci.map((a) => (a.koniec ? Date.parse(a.koniec) : NaN)).filter(Number.isFinite)
  if (!starty.length || !konce.length) return null
  return Math.round((Math.max(...konce) - Math.min(...starty)) / 1000)
}

/** @param {string} sciezka @returns {string | null} ostatni segment sciezki zadania (`@docs/active/x/` -> `x`) */
const nazwaZSciezki = (sciezka) => sciezka.replace(/^@/, '').replace(/\/+$/, '').split('/').pop() || null

/** @param {unknown} x @returns {number | null} */
const liczbaLubNull = (x) => (typeof x === 'number' ? x : null)

/**
 * `run.pr` z wyniku etapu `zbierz` dev-pr (klasa bledu, os i waga ze slownika KLASY_BLEDOW w dev-pr-wf.js; It. 1 krok 8).
 * Jeden run = jedna tura; raport liczy UNIKALNE watki per zadanie (suma po turach zawyza o 43% — przeglad D5 §8 pkt 4).
 * @param {Record<string, unknown>} wynik wynik runu z pliku harnessu
 * @param {Set<string> | null} klasyZRegula klasy z regula w wiedzy projektu (P10); null = wiedza nieodczytana
 */
function rekordPr(wynik, klasyZRegula) {
  const watki = Array.isArray(wynik.watki) ? wynik.watki.map(obiekt) : []
  /** @param {string} waga */
  const ile = (waga) => watki.filter((w) => w.waga === waga).length
  return {
    numer: liczbaLubNull(wynik.prNumer), tura: liczbaLubNull(wynik.tura), pliki: liczbaLubNull(wynik.plikiPr),
    uwagi_razem: watki.length, p1: ile('P1'), p2: ile('P2'), p3: ile('P3'),
    // Rekomendacja liczona w JS dev-pr-wf (P5); koszyk A–D (ETAP1B) — producent w It. 2.
    koszyk: null, rekomendacja: tekstLubNull(wynik.rekomendacja),
    klasy: watki.map((w) => ({
      id: tekstLubNull(w.id), klasa: tekstLubNull(w.klasaBledu), severity: tekstLubNull(w.waga), plik: tekstLubNull(w.plik),
      os: tekstLubNull(w.os), decyzja: tekstLubNull(w.klasa),
      ma_regule: klasyZRegula && typeof w.klasaBledu === 'string' ? klasyZRegula.has(w.klasaBledu) : null,
    })),
  }
}

/**
 * Zadanie z argumentow runu: autopilot = sciezka jako tekst, execute/review = { sciezka }, dev-pr = { zadanie },
 * complete = { nazwaZadania }.
 * @param {unknown} args
 * @returns {string | null}
 */
function zadanieZArgumentow(args) {
  if (typeof args === 'string') return nazwaZSciezki(args)
  const a = obiekt(args)
  const sciezka = tekstLubNull(a.sciezka)
  return tekstLubNull(a.zadanie) ?? tekstLubNull(a.nazwaZadania) ?? (sciezka ? nazwaZSciezki(sciezka) : null)
}

/**
 * Scenariusze [E2E] przeniesione w runie na [Manual] (P14) — suma z faz; null, gdy zadna faza nie ma pola (run sprzed P14).
 * @param {unknown[] | null} raporty
 * @returns {number | null}
 */
export function manualRazem(raporty) {
  const liczby = (raporty ?? []).map((r) => obiekt(obiekt(r).przebieg).e2eManual).filter((n) => typeof n === 'number')
  return liczby.length ? liczby.reduce((a, b) => a + b, 0) : null
}

/**
 * Pomiar ogrodnika (P15) z wyniku autopilota — pola znane, typy sprawdzone; null, gdy wynik pola nie ma (run sprzed P15
 * albo archiwizacja w poprzednim runie). Skrypt ogrodnika czyta z tego rekordu liczby i licznik `bez_oceny` nastepnego pomiaru.
 * @param {unknown} ogrod
 */
export function rekordOgrodu(ogrod) {
  const o = obiekt(ogrod)
  if (o.status === 'blad') return { status: 'blad', powod: tekstLubNull(o.powod) }
  if (o.status !== 'ok') return null
  const szczeble = obiekt(o.szczeble)
  return {
    status: 'ok',
    commit: tekstLubNull(o.commit),
    plikow: liczbaLubNull(o.plikow),
    liczby: liczbyZRekordu(o.liczby),
    przyrost: liczbyZRekordu(o.przyrost),
    zrodlo: o.zrodlo === 'telemetria' || o.zrodlo === 'diff' ? o.zrodlo : null,
    powod: tekstLubNull(o.powod),
    nowe: liczbaLubNull(o.nowe),
    ocena: o.ocena === true,
    bez_oceny: liczbaLubNull(o.bez_oceny),
    propozycje: liczbaLubNull(o.propozycje),
    szczeble: Object.fromEntries(['regula_lint', 'zadanie_sprzatajace', 'zostawic'].map((k) => [k, liczbaLubNull(szczeble[k]) ?? 0])),
  }
}

/**
 * @param {{ harness: Record<string, unknown> | null, status: StatusRunu, agenci: KosztAgenta[], bootstrap: unknown,
 *   szablon?: import('./szablon.mjs').WersjaSzablonu | null, klasyZRegula?: Set<string> | null }} we
 */
export function rekordRunu(we) {
  const wynik = obiekt(we.harness?.result)
  const bootstrap = obiekt(we.bootstrap)
  const raporty = Array.isArray(wynik.raporty) ? wynik.raporty : null
  const nazwaWorkflowu = tekstLubNull(we.harness?.workflowName)
  const czasMs = we.harness?.durationMs
  return {
    typ: 'run',
    workflow: nazwaWorkflowu ? nazwaWorkflowu.replace(/-wf$/, '') : null,
    zadanie: tekstLubNull(bootstrap.nazwaZadania) ?? tekstLubNull(wynik.nazwaZadania) ?? zadanieZArgumentow(we.harness?.args),
    start: typeof we.harness?.startTime === 'number' ? new Date(we.harness.startTime).toISOString() : startAgentow(we.agenci),
    status: we.status.status,
    powod: we.status.powod,
    stop_kategoria: we.status.status === 'STOP' ? kategoriaStopu(we.status.powod) : null,
    fazyZadania: Array.isArray(bootstrap.fazy) ? bootstrap.fazy.length : null,
    // Autopilot od P4 zwraca fazy domkniete w zadaniu; starsze wyniki — liczba faz tego runu (= raporty), wiec stare rekordy bez zmian.
    fazyUkonczone: typeof wynik.fazyUkonczone === 'number' ? wynik.fazyUkonczone : raporty ? raporty.length : null,
    walidacja: wynikWalidacji(wynik.walidacja),
    e2eSrodowisko: tekstLubNull(wynik.e2eSrodowisko),
    solution: tekstLubNull(wynik.solution),
    koszt: sumaKosztu(we.agenci),
    sekundy: typeof czasMs === 'number' ? Math.round(czasMs / 1000) : sekundyAgentow(we.agenci),
    szablon: we.szablon ?? null,
    // Producenci w pozniejszych iteracjach: profil stacku i smoke (It. 3). Klucze sa od razu — raport nie moze
    // zgadywac ksztaltu. MANUAL: P14. Ogrod: P15 (nowe pole z nowych runow — WERSJA_REKORDU bez zmian).
    pr: nazwaWorkflowu === 'dev-pr-wf' && wynik.etap === 'zbierz' ? rekordPr(wynik, we.klasyZRegula ?? null) : null,
    manual_razem: manualRazem(raporty),
    profil_stacku: null,
    smoke: null,
    ogrod: rekordOgrodu(wynik.ogrod),
  }
}

/** @typedef {ReturnType<typeof rekordRunu>} RekordRunu */
