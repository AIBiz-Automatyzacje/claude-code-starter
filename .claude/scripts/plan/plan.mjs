#!/usr/bin/env node
// Planowanie (PLAN-POPRAWY P13): CLI scalonego /dev-plan — walidacja planu technicznego, generowanie docs/active/<zadanie>/
// i bramka gotowosci przed autopilotem.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   plan.mjs sprawdz <plan.md>                     walidacja planu (fazy, IU, tabela plikow z budzetem, scenariusze, seedy)
//   plan.mjs generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz]
//                                                  pliki zadania z planu; bez --zapisz tylko liczniki; plan z bledami — nic
//   plan.mjs gotowosc <docs/active/zadanie>        plan, srodowisko E2E, checklista przygotowania, galaz i czyste drzewo
// Wynik: JSON na stdout. Kod wyjscia: 0 = ok, 1 = do poprawy (bledy planu, STOP bramki, katalog zadania zajety), 2 = zle argumenty.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { gotowosc } from './gotowosc.mjs'
import { parsujPlan } from './plan-techniczny.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'
import { zadanieZPlanu } from './zadanie.mjs'

const KOD_DO_POPRAWY = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, nazwa: { type: 'string' }, data: { type: 'string' },
  zapisz: { type: 'boolean' }, nadpisz: { type: 'boolean' },
})

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`plan: ${komunikat}\nUzycie: plan.mjs sprawdz <plan.md> | generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz] | gotowosc <docs/active/zadanie> [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @param {unknown} wynik @param {boolean} ok @returns {never} */
function zakoncz(wynik, ok) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
  process.exit(ok ? 0 : KOD_DO_POPRAWY)
}

/** @param {string} projekt @param {string} sciezka */
function walidacja(projekt, sciezka) {
  if (!existsSync(join(projekt, sciezka))) zleArgumenty(`nie ma pliku planu ${sciezka}`)
  return sprawdzPlan(parsujPlan(readFileSync(join(projekt, sciezka), 'utf8')), projekt)
}

/**
 * Zapis plikow zadania. Istniejacy katalog = wznowienie: bez --nadpisz odmowa, z --nadpisz tylko gdy zadania bez postepu.
 * @param {string} projekt
 * @param {import('./zadanie.mjs').Zadanie} zadanie
 * @param {boolean} nadpisz
 * @returns {{ zapisane: string[], odmowa: string | null }}
 */
function zapisz(projekt, zadanie, nadpisz) {
  const sciezki = Object.keys(zadanie.pliki).map((rodzaj) => `${zadanie.katalog}/${zadanie.nazwa}-${rodzaj}.md`)
  const istniejace = sciezki.filter((s) => existsSync(join(projekt, s)))
  const zadania = join(projekt, zadanie.katalog, `${zadanie.nazwa}-zadania.md`)
  if (istniejace.length && !nadpisz) return { zapisane: [], odmowa: `${zadanie.katalog} już istnieje (${istniejace.join(', ')}) — wznowienie: --nadpisz albo inna --nazwa` }
  if (existsSync(zadania) && /^- \[x\]/m.test(readFileSync(zadania, 'utf8'))) {
    return { zapisane: [], odmowa: `${zadanie.katalog}: plik zadań ma odhaczone pozycje — postępu nie nadpisuję` }
  }
  mkdirSync(join(projekt, zadanie.katalog), { recursive: true })
  Object.values(zadanie.pliki).forEach((tresc, i) => writeFileSync(join(projekt, sciezki[i]), tresc))
  return { zapisane: sciezki, odmowa: null }
}

const { values, positionals } = (() => {
  try {
    return parseArgs({ options: USTAWIENIA, allowPositionals: true })
  } catch (e) {
    return zleArgumenty(e instanceof Error ? e.message : String(e))
  }
})()
const [polecenie, sciezka] = positionals
const projekt = values.projekt ?? process.cwd()
if (!sciezka) zleArgumenty(polecenie ? `${polecenie} wymaga ścieżki` : 'brak polecenia')
if (values.data && !/^\d{4}-\d{2}-\d{2}$/.test(values.data)) zleArgumenty('--data w formacie RRRR-MM-DD')

if (polecenie === 'sprawdz') {
  const w = walidacja(projekt, sciezka)
  zakoncz({ ok: !w.bledy.length, ...w }, !w.bledy.length)
} else if (polecenie === 'generuj') {
  const w = walidacja(projekt, sciezka)
  if (w.bledy.length) zakoncz({ ok: false, ...w }, false)
  const zadanie = zadanieZPlanu(projekt, sciezka, { nazwa: values.nazwa, data: values.data ?? new Date().toISOString().slice(0, 10) })
  const zapis = values.zapisz ? zapisz(projekt, zadanie, values.nadpisz === true) : { zapisane: [], odmowa: null }
  zakoncz({ ok: !zapis.odmowa, nazwa: zadanie.nazwa, katalog: zadanie.katalog, liczniki: zadanie.liczniki, uwagi: w.uwagi, ...zapis }, !zapis.odmowa)
} else if (polecenie === 'gotowosc') {
  const wynik = gotowosc(projekt, sciezka.replace(/\/$/, ''))
  zakoncz(wynik, wynik.ok)
} else {
  zleArgumenty(`nieznane polecenie ${polecenie}`)
}
