#!/usr/bin/env node
// Telemetria pipeline'u dev-* — zbieranie (It. 1). Zero agentow: czyta pliki Claude Code po runie i dopisuje rekordy.
//
// Uzycie:
//   node .claude/scripts/telemetria/zbierz.mjs --skan            pelny skan maszyny (recznie, przed raportem)
//   node .claude/scripts/telemetria/zbierz.mjs --skan --szybko   tylko pliki zmienione od ostatniego skanu
//   node .claude/scripts/telemetria/zbierz.mjs --hook            hook Stop: wejscie hooka na stdin, tryb szybki,
//                                                                zawsze exit 0 i pusty stdout (bledy → log)
// Nadpisania sciezek (testy): --projekty <kat> --plik <jsonl> --bledy <log> --znacznik <plik>

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { zbierzWszystko } from './zbieranie.mjs'
import { PLIK_BLEDOW, PLIK_DANYCH, zapiszBlad } from './zapis.mjs'
import { KATALOG_PROJEKTOW } from './zrodla.mjs'

const ZNACZNIK = join(homedir(), '.claude', 'telemetry', 'zbierz-znacznik.txt')
// Hook bez znacznika (pierwsze uruchomienie na maszynie) skanuje tylko ostatnia dobe — pelny skan historii (~25 s)
// zatrzymalby sesje; robi go reczny --skan albo raport.mjs.
const OKNO_PIERWSZEGO_HOOKA_MS = 24 * 60 * 60 * 1000

const { values: opcje } = parseArgs({
  options: {
    skan: { type: 'boolean', default: false },
    szybko: { type: 'boolean', default: false },
    hook: { type: 'boolean', default: false },
    projekty: { type: 'string', default: KATALOG_PROJEKTOW },
    plik: { type: 'string', default: PLIK_DANYCH },
    bledy: { type: 'string', default: PLIK_BLEDOW },
    znacznik: { type: 'string', default: ZNACZNIK },
  },
})

/** @param {string} plik @returns {number | undefined} */
function czytajZnacznik(plik) {
  if (!existsSync(plik)) return undefined
  const ms = Number(readFileSync(plik, 'utf8').trim())
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Wejscie hooka Stop: sesja i jej zadania w tle (mini-run (f): `background_tasks` ze statusem runow).
 * @param {string} surowe
 * @returns {{ sesja: string | null, maDzialajacyWorkflow: boolean }}
 */
function wejscieHooka(surowe) {
  const w = JSON.parse(surowe)
  const zadania = Array.isArray(w?.background_tasks) ? w.background_tasks : []
  return {
    sesja: typeof w?.session_id === 'string' ? w.session_id : null,
    maDzialajacyWorkflow: zadania.some((/** @type {{ type?: string, status?: string }} */ z) => z?.type === 'workflow' && z?.status === 'running'),
  }
}

function glowna() {
  const terazMs = Date.now()
  /** @type {Set<string>} */
  const sesjeWToku = new Set()
  /** @type {Set<string>} */
  const pominSesje = new Set()
  if (opcje.hook) {
    const { sesja, maDzialajacyWorkflow } = wejscieHooka(readFileSync(0, 'utf8'))
    if (sesja) {
      pominSesje.add(sesja)
      if (maDzialajacyWorkflow) sesjeWToku.add(sesja)
    }
  }
  const szybko = opcje.hook || opcje.szybko
  const wynik = zbierzWszystko({
    projekty: opcje.projekty, plik: opcje.plik, bledy: opcje.bledy, terazMs, szybko,
    znacznikMs: szybko ? czytajZnacznik(opcje.znacznik) ?? (opcje.hook ? terazMs - OKNO_PIERWSZEGO_HOOKA_MS : undefined) : undefined,
    sesjeWToku, pominSesje,
  })
  if (wynik) writeFileSync(opcje.znacznik, String(terazMs))
  return wynik
}

if (!opcje.skan && !opcje.hook) {
  process.stderr.write('Uzycie: zbierz.mjs --skan [--szybko] | --hook\n')
  process.exit(2)
}

if (opcje.hook) {
  // Hook nie moze zatrzymac ani spowolnic sesji bledem telemetrii — kazdy blad laduje w logu, wyjscie zawsze 0.
  try {
    glowna()
  } catch (e) {
    zapiszBlad(opcje.bledy, 'hook', e)
  }
  process.exit(0)
}

const wynik = glowna()
process.stdout.write(wynik
  ? `runow: ${wynik.runow}, sesji: ${wynik.sesji}, dopisanych: ${wynik.dopisanych}, bledow: ${wynik.bledow} → ${opcje.plik}\n`
  : 'inny skan trzyma zamek — pomijam (dopisanych: 0)\n')
process.exit(wynik && wynik.bledow ? 1 : 0)
