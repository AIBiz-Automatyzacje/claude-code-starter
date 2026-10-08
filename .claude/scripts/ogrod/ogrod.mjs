#!/usr/bin/env node
// Ogrodnik (PLAN-POPRAWY P15): pomiar wzorcow, ktore agenci kopiuja z kodu projektu, na zamknieciu zadania autopilota.
// Tylko odczyt — skrypt niczego nie zapisuje (rekord `ogrod` powstaje z wyniku runu w telemetrii).
//
// Uzycie:
//   node .claude/scripts/ogrod/ogrod.mjs pomiar [--zadanie <nazwa>] [--projekt <katalog>] [--baza <commit>] [--telemetria <plik jsonl>]
//
// Wynik (stdout, JSON): { projekt, commit, plikow, liczby, poprzedni, decyzja: { ocena, powod, zrodlo, przyrost, bez_oceny },
//   noweRazem, nowe: [{ kategoria, plik, linia }], hotspoty: [{ plik, razem, <kategoria>: n }] }
//   liczby = caly projekt; nowe = wystapienia w liniach dodanych od merge-base z galezia glowna (z drzewem roboczym);
//   poprzedni = ostatni rekord `ogrod` runu autopilota tego projektu w telemetrii, z pominieciem runow zadania `--zadanie`
//   (null = pierwszy pomiar). Bez tresci linii w `nowe`: wynik przepisuje agent haiku, a ocena i tak czyta kod sama.
// Kod wyjscia: 0 = pomiar, 1 = blad (JSON { blad }), 2 = zle argumenty.

import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { PLIK_DANYCH } from '../telemetria/zapis.mjs'
import { KATEGORIE } from './kategorie.mjs'
import { zmierzProjekt } from './pomiar.mjs'
import { decyzjaOceny, poprzedniZPliku } from './prog.mjs'

const KOD_BLEDU = 1
const KOD_ZLYCH_ARGUMENTOW = 2

/**
 * @param {{ projekt: string, zadanie: string | null, baza?: string, telemetria: string }} op
 */
function pomiarOgrodu(op) {
  const projekt = resolve(op.projekt)
  // Nazwa projektu jak w telemetrii (zbieranie.mjs: basename katalogu sesji).
  const nazwa = basename(projekt)
  const pomiar = zmierzProjekt(projekt, op.baza ? { baza: op.baza } : {})
  const poprzedni = poprzedniZPliku(op.telemetria, { projekt: nazwa, zadanie: op.zadanie })
  const decyzja = decyzjaOceny({ liczby: pomiar.liczby, noweLiczby: pomiar.noweLiczby, poprzedni })
  return {
    projekt: nazwa,
    commit: pomiar.commit,
    plikow: pomiar.plikow,
    liczby: pomiar.liczby,
    poprzedni: poprzedni && { run: poprzedni.run, start: poprzedni.start, liczby: poprzedni.liczby },
    decyzja,
    noweRazem: KATEGORIE.reduce((s, k) => s + pomiar.noweLiczby[k], 0),
    nowe: pomiar.nowe.map(({ kategoria, plik, linia }) => ({ kategoria, plik, linia })),
    hotspoty: pomiar.hotspoty,
  }
}

function glowna() {
  /** @type {ReturnType<typeof parseArgs>} */
  let argumenty
  try {
    argumenty = parseArgs({
      allowPositionals: true,
      options: {
        projekt: { type: 'string', default: process.cwd() },
        baza: { type: 'string' },
        zadanie: { type: 'string' },
        telemetria: { type: 'string', default: PLIK_DANYCH },
      },
    })
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
    return KOD_ZLYCH_ARGUMENTOW
  }
  const { positionals, values } = argumenty
  if (positionals.length !== 1 || positionals[0] !== 'pomiar') {
    process.stderr.write('Uzycie: ogrod.mjs pomiar [--zadanie <nazwa>] [--projekt <katalog>] [--baza <commit>] [--telemetria <plik>]\n')
    return KOD_ZLYCH_ARGUMENTOW
  }
  try {
    const wynik = pomiarOgrodu({
      projekt: String(values.projekt),
      baza: typeof values.baza === 'string' ? values.baza : undefined,
      zadanie: typeof values.zadanie === 'string' ? values.zadanie : null,
      telemetria: String(values.telemetria),
    })
    process.stdout.write(`${JSON.stringify(wynik)}\n`)
    return 0
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ blad: e instanceof Error ? e.message : String(e) })}\n`)
    return KOD_BLEDU
  }
}

process.exitCode = glowna()
