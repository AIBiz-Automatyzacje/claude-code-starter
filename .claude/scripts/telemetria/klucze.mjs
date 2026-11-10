#!/usr/bin/env node
// Skan transkryptow agentow runu pod katem kluczy dostawcow (znaleziska 2026-11-02 pkt 32). Dashboard, run E2, faza 4: test
// z bledna nazwa pola wypisal obiekt konfiguracji z kluczem Stripe z lokalnego .env do wyjscia testu, a wiec do transkryptu
// agenta. Hook env-wartosci blokuje komendy czytajace .env, nie wyjscie testow. Workflow nie zna id runu ani katalogu
// transkryptow; zna je telemetria z hooka Stop, wiec skan biegnie w zbieraniu (zbieranie.mjs), po kazdym odczytanym runie.
// Wynik nigdy nie niesie wartosci klucza ani jej fragmentu: tylko nazwa wzorca, nazwy plikow, liczba trafien, id runu, data
// i miejsce (projekt, katalog runu). Hook jest niemy, wiec wynik pokazuja doctor (wiersz UWAGA) i raport telemetrii.
//
// Uzycie:
//   node .claude/scripts/telemetria/klucze.mjs --potwierdz <wf_run>          operator zrotowal klucz: uwaga doctora znika
//   node .claude/scripts/telemetria/klucze.mjs --doctor <katalog-projektu>   wiersze TSV dla doctor.sh
// Nadpisanie sciezki (testy): --plik <jsonl>

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { PLIK_DANYCH, dopisz, odczytajRekordy } from './zapis.mjs'
import { katalogRepo } from './zrodla.mjs'

const NAZWA_PLIKU = 'klucze-transkryptow.jsonl'
/** @param {string} plikDanych plik telemetrii @returns {string} plik trafien obok niego (~/.claude/telemetry/, poza repo projektu) */
export const plikKluczy = (plikDanych) => join(dirname(plikDanych), NAZWA_PLIKU)
export const PLIK_KLUCZY = plikKluczy(PLIK_DANYCH)

// Zestaw zachowawczy: prefiks dostawcy ORAZ tresc klucza o jego dlugosci, zeby literal z dokumentacji (`sk_live_...`,
// `whsec_xxx`) nie byl trafieniem. `przed` i `po` tylko tam, gdzie prefiks nie jest wyrozniajacy (AKIA).
/** @type {Array<{ nazwa: string, prefiks: string, tresc: string, przed?: string, po?: string }>} */
const DEFINICJE = [
  { nazwa: 'stripe-sk-live', prefiks: 'sk_live_', tresc: '[A-Za-z0-9]{24,}' },
  { nazwa: 'stripe-rk-live', prefiks: 'rk_live_', tresc: '[A-Za-z0-9]{24,}' },
  { nazwa: 'stripe-whsec', prefiks: 'whsec_', tresc: '[A-Za-z0-9]{24,}' },
  { nazwa: 'github-ghp', prefiks: 'ghp_', tresc: '[A-Za-z0-9]{36}' },
  { nazwa: 'github-pat', prefiks: 'github_pat_', tresc: '[A-Za-z0-9]{22}_[A-Za-z0-9]{59}' },
  { nazwa: 'anthropic', prefiks: 'sk-ant-', tresc: '[A-Za-z0-9_-]{32,}' },
  { nazwa: 'openai-proj', prefiks: 'sk-proj-', tresc: '[A-Za-z0-9_-]{32,}' },
  // Transkrypt to JSON: przed kluczem bywa litera z sekwencji `\n`, wiec granica wyklucza tylko wielkie litery i cyfry.
  { nazwa: 'aws-akia', prefiks: 'AKIA', tresc: '[0-9A-Z]{16}', przed: '(?<![A-Z0-9])', po: '(?![A-Z0-9])' },
  { nazwa: 'supabase-secret', prefiks: 'sb_secret_', tresc: '[A-Za-z0-9_-]{20,}' },
]
export const WZORCE_KLUCZY = DEFINICJE.map((d) => ({ nazwa: d.nazwa, wzor: new RegExp(`${d.przed ?? ''}${d.prefiks}(${d.tresc})${d.po ?? ''}`, 'g') }))

// Wypelniacz z dokumentacji ma dlugosc klucza, ale nie jego tresc: jeden znak w kolko (`xxxxxxxx…`), slowo EXAMPLE (klucz
// AWS z dokumentacji) albo same male litery z lacznikami (slowa zamiast losowej tresci; proba na 793 runach tej maszyny:
// 29 z 34 trafien wzorca Supabase). Ponizej tylu roznych znakow tresc nie jest losowa.
const MIN_ROZNYCH_ZNAKOW = 6
/** @param {string} tresc @returns {boolean} */
const czyWypelniacz = (tresc) => new Set(tresc).size < MIN_ROZNYCH_ZNAKOW || /example/i.test(tresc) || /^[a-z_-]+$/.test(tresc)

// Klucze jawne, takie same na kazdej maszynie: klucz serwisowy lokalnego stosu Supabase CLI, ktory wypisuje `supabase status`.
// Builder danych wola te komende, wiec bez wyjatku kazdy run z lokalna baza dawalby uwage „zrotuj klucz”. Skrot SHA-256
// zamiast literalu: literal w zrodle zatrzymalby skanery sekretow przy pushu.
const JAWNE_SHA256 = new Set(['c85debb55f2f204d868cc1552c42faa143b4c675f61363ab040dd50b5b5304cd'])
/** @param {string} klucz @returns {boolean} */
const czyJawny = (klucz) => JAWNE_SHA256.has(createHash('sha256').update(klucz).digest('hex'))

/**
 * @typedef {{ wzorzec: string, trafien: number }} Trafienie
 * @typedef {{ wzorzec: string, pliki: string[], trafien: number }} TrafienieRunu
 * @typedef {{ klucz: string, typ: 'klucz', ts: string, run: string, projekt: string | null, repo: string | null, katalog: string,
 *   wzorzec: string, pliki: string[], trafien: number, potwierdzone: string | null }} RekordKlucza
 */

/**
 * Funkcja czysta: ktore wzorce kluczy wystepuja w tekscie i ile razy. Zwraca nazwy i liczby, nigdy dopasowany tekst.
 * @param {string} tekst
 * @returns {Trafienie[]}
 */
export function wzorceWTekscie(tekst) {
  return WZORCE_KLUCZY
    .map(({ nazwa, wzor }) => ({ wzorzec: nazwa, trafien: [...tekst.matchAll(wzor)].filter((m) => !czyWypelniacz(m[1] ?? '') && !czyJawny(m[0])).length }))
    .filter((t) => t.trafien > 0)
}

/**
 * @param {string} katalogRunu katalog z transkryptami agentow runu (agent-<id>.jsonl)
 * @returns {TrafienieRunu[]} po jednym wpisie na wzorzec: pliki, w ktorych wystapil, i suma trafien
 */
export function skanujTranskrypty(katalogRunu) {
  /** @type {Map<string, TrafienieRunu>} */
  const perWzorzec = new Map()
  for (const plik of readdirSync(katalogRunu).filter((n) => n.startsWith('agent-') && n.endsWith('.jsonl')).sort()) {
    for (const { wzorzec, trafien } of wzorceWTekscie(readFileSync(join(katalogRunu, plik), 'utf8'))) {
      const wpis = perWzorzec.get(wzorzec) ?? { wzorzec, pliki: [], trafien: 0 }
      perWzorzec.set(wzorzec, { wzorzec, pliki: [...wpis.pliki, plik], trafien: wpis.trafien + trafien })
    }
  }
  return [...perWzorzec.values()]
}

/** @param {Record<string, unknown>} w @returns {w is RekordKlucza} */
const czyRekordKlucza = (w) => w.typ === 'klucz' && typeof w.run === 'string' && typeof w.wzorzec === 'string' && Array.isArray(w.pliki)

/** @param {string} plik @returns {Map<string, RekordKlucza>} ostatnia wersja rekordu per `run|wzorzec` */
function ostatnieRekordy(plik) {
  /** @type {Map<string, RekordKlucza>} */
  const wynik = new Map()
  for (const [klucz, w] of odczytajRekordy(plik).ostatnie) if (czyRekordKlucza(w)) wynik.set(klucz, w)
  return wynik
}

/**
 * Dopisuje trafienia runu do pliku. Rekord, ktory juz jest z ta sama trescia, nie wraca: ponowny skan runu nie cofa
 * potwierdzenia operatora, a nowe pliki albo trafienia otwieraja uwage od nowa.
 * @param {string} plik
 * @param {TrafienieRunu[]} trafienia
 * @param {{ run: string, projekt: string | null, repo: string | null, katalog: string, terazMs: number }} kontekst
 * @returns {number} liczba dopisanych rekordow
 */
export function zapiszTrafienia(plik, trafienia, kontekst) {
  if (!trafienia.length) return 0
  const ostatnie = ostatnieRekordy(plik)
  /** @type {RekordKlucza[]} */
  const nowe = trafienia.map((t) => ({
    klucz: `${kontekst.run}|${t.wzorzec}`, typ: 'klucz', ts: new Date(kontekst.terazMs).toISOString(), run: kontekst.run,
    projekt: kontekst.projekt, repo: kontekst.repo, katalog: kontekst.katalog, ...t, potwierdzone: null,
  }))
  return dopisz(plik, nowe.filter((r) => {
    const poprzedni = ostatnie.get(r.klucz)
    return !poprzedni || poprzedni.trafien !== r.trafien || poprzedni.pliki.join('|') !== r.pliki.join('|')
  }))
}

/** @param {string} [plik] @returns {RekordKlucza[]} trafienia, ktorych operator nie potwierdzil */
export function otwarteTrafienia(plik = PLIK_KLUCZY) {
  return [...ostatnieRekordy(plik).values()].filter((r) => !r.potwierdzone)
}

/**
 * Operator zrotowal klucz: kazde otwarte trafienie runu dostaje date potwierdzenia (dopisany rekord, plik tylko rosnie).
 * @param {string} plik @param {string} run @param {number} terazMs
 * @returns {number} liczba potwierdzonych trafien
 */
export function potwierdzRun(plik, run, terazMs) {
  const potwierdzone = new Date(terazMs).toISOString()
  return dopisz(plik, otwarteTrafienia(plik).filter((r) => r.run === run).map((r) => ({ ...r, ts: potwierdzone, potwierdzone })))
}

/** @param {string} sciezka @returns {string} sciezka po dowiazaniach (katalog tymczasowy macOS: /var → /private/var) */
function kanon(sciezka) {
  return existsSync(sciezka) ? realpathSync(sciezka) : resolve(sciezka)
}

/** @param {number} n */
const plikow = (n) => (n === 1 ? '1 plik' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} pliki` : `${n} plików`)

/**
 * Wiersze doctora: otwarte trafienia runow tego projektu (i runow bez ustalonego repo).
 * @param {string} plik @param {string} projekt katalog projektu
 * @returns {Array<[string, string, string, string]>}
 */
export function wierszeDoctora(plik, projekt) {
  const repo = kanon(katalogRepo(projekt) ?? projekt)
  return otwarteTrafienia(plik)
    .filter((r) => r.repo === null || kanon(r.repo) === repo)
    .map((r) => ['klucz w transkryptach', 'UWAGA', `w transkryptach runu ${r.run} jest wzorzec klucza ${r.wzorzec} (${plikow(r.pliki.length)}) — zrotuj klucz`,
      `po rotacji: node .claude/scripts/telemetria/klucze.mjs --potwierdz ${r.run}`])
}

// realpath: katalog tymczasowy macOS (/var → /private/var) daje rozne zapisy tej samej sciezki.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: opcje } = parseArgs({
    options: { potwierdz: { type: 'string' }, doctor: { type: 'string' }, plik: { type: 'string', default: PLIK_KLUCZY } },
  })
  if (opcje.doctor) {
    for (const w of wierszeDoctora(opcje.plik, opcje.doctor)) process.stdout.write(`${w.join('\t')}\n`)
  } else if (opcje.potwierdz) {
    const n = potwierdzRun(opcje.plik, opcje.potwierdz, Date.now())
    process.stdout.write(n ? `potwierdzono: ${opcje.potwierdz}, wzorcow: ${n}\n` : `brak niepotwierdzonych trafien dla runu ${opcje.potwierdz}\n`)
    process.exit(n ? 0 : 1)
  } else {
    process.stderr.write('Uzycie: klucze.mjs --potwierdz <wf_run> | --doctor <katalog-projektu>\n')
    process.exit(2)
  }
}
