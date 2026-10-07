#!/usr/bin/env node
// Planowanie (PLAN-POPRAWY P13): CLI scalonego /dev-plan — walidacja planu technicznego, generowanie docs/active/<zadanie>/
// i bramka gotowosci przed autopilotem.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   plan.mjs linie <plik>...                       linie kodu jak ESLint max-lines (bez pustych i komentarzy) — kolumna „dziś”
//   plan.mjs sprawdz <plan.md>                     walidacja planu (fazy, IU, tabela plikow z budzetem, scenariusze, seedy)
//   plan.mjs generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz]
//                                                  pliki zadania z planu; bez --zapisz tylko liczniki; plan z bledami — nic
//   plan.mjs gotowosc <docs/active/zadanie>        plan, srodowisko E2E, checklista przygotowania, galaz i czyste drzewo
// Wynik: JSON na stdout. Kod wyjscia: 0 = ok, 1 = do poprawy (bledy planu, STOP bramki, katalog zadania zajety),
// 2 = zle argumenty, 3 = wyjatek skryptu (JSON z polem wyjatek).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

import { liczLinieKodu, podsumowanieBudzetu } from './budzet-pliku.mjs'
import { gotowosc } from './gotowosc.mjs'
import { parsujPlan } from './plan-techniczny.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'
import { zadanieZPlanu } from './zadanie.mjs'

const KOD_DO_POPRAWY = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, nazwa: { type: 'string' }, data: { type: 'string' },
  zapisz: { type: 'boolean' }, nadpisz: { type: 'boolean' },
})

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`plan: ${komunikat}\nUzycie: plan.mjs linie <plik>... | sprawdz <plan.md> | generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz] | gotowosc <docs/active/zadanie> [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @param {unknown} wynik @param {boolean} ok @returns {never} */
function zakoncz(wynik, ok) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
  process.exit(ok ? 0 : KOD_DO_POPRAWY)
}

/** @returns {string} dzisiejsza data lokalna RRRR-MM-DD (nie UTC: po polnocy w Polsce UTC ma jeszcze wczorajsza) */
function dzis() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Powod odmowy zapisu: katalog zadania istnieje (wznowienie) bez --nadpisz; z --nadpisz — gdy zadanie ma juz przebieg
 * (stan autopilota, raport review, postep w zadaniach, wpisy dziennika), ktorego swieze pliki by nie znaly.
 * @param {string} katalog katalog zadania (absolutny)
 * @param {boolean} nadpisz
 * @returns {string | null}
 */
function odmowaZapisu(katalog, nadpisz) {
  if (!existsSync(katalog)) return null
  if (!nadpisz) return 'katalog zadania już istnieje — wznowienie: --nadpisz (bez przebiegu autopilota) albo inna --nazwa'
  const pliki = readdirSync(katalog)
  const tresc = (/** @type {string} */ sufiks) => {
    const p = pliki.find((n) => n.endsWith(sufiks))
    return p ? readFileSync(join(katalog, p), 'utf8') : ''
  }
  if (pliki.includes('.autopilot-state.json') || pliki.some((p) => /^review-faza-\d+\.md$/.test(p))) {
    return 'zadanie ma przebieg autopilota (.autopilot-state.json albo review-faza-N.md) — postępu nie nadpisuję'
  }
  if (/^- \[x\]/m.test(tresc('-zadania.md'))) return 'plik zadań ma odhaczone pozycje — postępu nie nadpisuję'
  if (/^## Dziennik\n+\S/m.test(tresc('-kontekst.md'))) return 'dziennik w pliku kontekstu ma wpisy — postępu nie nadpisuję'
  return null
}

/** @param {string} projekt @param {string} sciezka @returns {string} sciezka planu wzgledem projektu */
function planWzgledny(projekt, sciezka) {
  const wzgledna = isAbsolute(sciezka) ? relative(projekt, sciezka) : sciezka
  if (!existsSync(join(projekt, wzgledna))) zleArgumenty(`nie ma pliku planu ${sciezka}`)
  return wzgledna
}

/**
 * @param {string[]} positionals
 * @param {{ projekt?: string, nazwa?: string, data?: string, zapisz?: boolean, nadpisz?: boolean }} values
 */
function wykonaj(positionals, values) {
  const [polecenie, sciezka, ...reszta] = positionals
  const projekt = values.projekt ?? process.cwd()
  if (!sciezka) zleArgumenty(polecenie ? `${polecenie} wymaga ścieżki` : 'brak polecenia')
  const data = values.data ?? dzis()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) zleArgumenty('--data w formacie RRRR-MM-DD')

  if (polecenie === 'linie') {
    const wynik = Object.fromEntries([sciezka, ...reszta].map((p) => {
      const plik = join(projekt, p)
      return [p, existsSync(plik) ? liczLinieKodu(readFileSync(plik, 'utf8')) : null]
    }))
    zakoncz({ ok: true, linie: wynik }, true)
  }
  if (polecenie === 'gotowosc') {
    const wynik = gotowosc(projekt, sciezka.replace(/\/$/, ''))
    zakoncz(wynik, wynik.ok)
  }
  if (polecenie !== 'sprawdz' && polecenie !== 'generuj') zleArgumenty(`nieznane polecenie ${polecenie}`)
  const plan = planWzgledny(projekt, sciezka)
  const planMd = readFileSync(join(projekt, plan), 'utf8')
  const sparsowany = parsujPlan(planMd)
  const w = sprawdzPlan(sparsowany, projekt)
  if (polecenie === 'sprawdz' || w.bledy.length) zakoncz({ ok: !w.bledy.length, ...w }, !w.bledy.length)

  const zadanie = zadanieZPlanu(projekt, plan, { nazwa: values.nazwa, data })
  if (zadanie.bledyBilansu.length) zakoncz({ ok: false, bledy: zadanie.bledyBilansu, uwagi: w.uwagi }, false)
  const odmowa = values.zapisz ? odmowaZapisu(join(projekt, zadanie.katalog), values.nadpisz === true) : null
  /** @type {string[]} */
  const zapisane = []
  if (values.zapisz && !odmowa) {
    mkdirSync(join(projekt, zadanie.katalog), { recursive: true })
    for (const [rodzaj, tresc] of Object.entries(zadanie.pliki)) {
      const s = `${zadanie.katalog}/${zadanie.nazwa}-${rodzaj}.md`
      writeFileSync(join(projekt, s), tresc)
      zapisane.push(s)
    }
  }
  const rozmiary = { plan_zn: planMd.length, zadania_zn: zadanie.pliki.zadania.length }
  const budzet = podsumowanieBudzetu(sparsowany.fazy.flatMap((f) => f.iu))
  zakoncz({ ok: !odmowa, nazwa: zadanie.nazwa, katalog: zadanie.katalog, liczniki: zadanie.liczniki, rozmiary, budzet, uwagi: w.uwagi,
    zapisane, odmowa }, !odmowa)
}

const { values, positionals } = (() => {
  try {
    return parseArgs({ options: USTAWIENIA, allowPositionals: true })
  } catch (e) {
    return zleArgumenty(e instanceof Error ? e.message : String(e))
  }
})()
try {
  wykonaj(positionals, values)
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, wyjatek: e instanceof Error ? e.message : String(e) })}\n`)
  process.exit(KOD_WYJATKU)
}
