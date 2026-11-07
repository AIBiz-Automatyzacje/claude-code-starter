#!/usr/bin/env node
// Uruchomienie flow Maestro przez testera i naprawę E2E. Urządzenie wybiera ta sama logika co start, tylko bez włączania symulatora, bo
// adapter nie zapisuje wyboru między procesami. Konto i klucze idą w środowisku procesu (w argumentach widać je w `ps`), a hasło i klucze są maskowane, więc nie trafiają do wyniku agenta,
// a limit czasu daje wynik zamiast zawieszonej komendy. Wyjście Maestro idzie na stderr, co resetuje watchdog ciszy agenta.
//
// Użycie (z korzenia projektu albo z --projekt <katalog>):
//   expo-flow.mjs --urzadzenie                               preflight: wybrane włączone urządzenie albo przyczyna braku
//   expo-flow.mjs --zadanie <folder> --flow <flow> [--plik <ścieżka>]   plik domyślnie .maestro/<flow>.yaml, dowody w <folder>/maestro/<flow>
// Wynik: JSON w jednej linii na stdout. Kod wyjścia 0, także przy porażce flow (status w JSON-ie); 2 = złe argumenty.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { uruchomMaestro, zmienneFlow } from './expo-canary.mjs'
import { aplikacjaProjektu, przygotujUrzadzenie, wykonaj } from './expo-urzadzenie.mjs'
import { envE2e, konfiguracja } from './srodowisko.mjs'

// Limit krótszy niż 600 s foreground Bash: zawieszony flow kończy się wynikiem, a nie zabitą komendą.
const LIMIT_FLOW_MS = 480_000
const KOD_ZLYCH_ARGUMENTOW = 2

/**
 * @typedef {{ projekt: string, env?: Record<string, string>, wykonajKomende?: import('./expo-urzadzenie.mjs').Wykonaj, maestro?: typeof uruchomMaestro }} Opcje
 */

/** @param {string} projekt @param {Record<string, string>} env @param {import('./expo-urzadzenie.mjs').Wykonaj} wykonajKomende */
function cel(projekt, env, wykonajKomende) {
  const aplikacja = aplikacjaProjektu(projekt, wykonajKomende)
  if (!aplikacja) return /** @type {const} */ ({ ok: false, status: 'brak-urzadzenia', detal: 'repo bez konfiguracji Expo', naprawa: '' })
  const wynik = przygotujUrzadzenie(projekt, aplikacja, env, wykonajKomende, { tylkoWlaczone: true })
  return wynik.ok ? { ...wynik, aplikacja } : /** @type {const} */ ({ ok: false, status: 'brak-urzadzenia', detal: wynik.detal, naprawa: wynik.naprawa })
}

/** @param {Opcje} o */
export function urzadzenieTestera({ projekt, env = envE2e(projekt) ?? {}, wykonajKomende = wykonaj }) {
  const c = cel(projekt, env, wykonajKomende)
  if (!c.ok) return c
  return { status: 'gotowe', platforma: c.urzadzenie.platforma, id: c.urzadzenie.id, nazwa: c.urzadzenie.nazwa, uwagi: c.uwagi }
}

/**
 * Do katalogu zadania idą tylko zrzuty: `takeScreenshot` pod własną nazwą i zrzut porażki jako `blad-<n>.png`, bez zrzutów pominiętych
 * kroków opcjonalnych. Pliki `commands-*.json` zapisują wartości zmiennych flow, także te ze środowiska, więc nigdy nie trafiają do repo.
 * @param {string} robocze @param {string} katalog @param {string} projekt @returns {string[]} ścieżki od korzenia projektu
 */
function przeniesZrzuty(robocze, katalog, projekt) {
  const pliki = readdirSync(robocze, { recursive: true, withFileTypes: true }).filter((w) => w.isFile() && w.name.endsWith('.png'))
  let bledy = 0
  const zapisane = []
  for (const w of pliki) {
    if (w.name.startsWith('screenshot-⚠')) continue
    const nazwa = w.name.startsWith('screenshot-❌') ? `blad-${++bledy}.png` : w.name
    copyFileSync(join(w.parentPath, w.name), join(katalog, nazwa))
    zapisane.push(relative(projekt, join(katalog, nazwa)))
  }
  return zapisane.sort()
}

/**
 * @param {Opcje & { zadanie: string, flow: string, plik?: string }} o
 * @returns {Promise<Record<string, unknown>>} status: ok | porazka | zawieszony | blad-maestro | brak-flow | brak-urzadzenia
 */
export async function odegrajFlow({ projekt, zadanie, flow, plik = `.maestro/${flow}.yaml`, env = envE2e(projekt) ?? {}, wykonajKomende = wykonaj, maestro = uruchomMaestro }) {
  if (!existsSync(join(projekt, plik))) return { status: 'brak-flow', flow, plik }
  const c = cel(projekt, env, wykonajKomende)
  if (!c.ok) return c
  const katalog = join(projekt, zadanie, 'maestro', flow)
  mkdirSync(katalog, { recursive: true })
  const { argumenty, srodowisko, sekrety } = zmienneFlow(env, { port: konfiguracja(projekt, env).port, urzadzenie: c.urzadzenie, aplikacja: c.aplikacja })
  // Praca poza repo: zabity proces nie zostawia w katalogu zadania pliku z hasłem. `--debug-output` zabiera ten sam zapis z ~/.maestro/tests.
  const robocze = mkdtempSync(join(tmpdir(), 'expo-flow-'))
  try {
    const { kod, ogon } = await maestro(['--device', c.urzadzenie.id, 'test', '--test-output-dir', join(robocze, 'wynik'), '--debug-output', join(robocze, 'debug'), ...argumenty, plik], projekt, { sekrety, srodowisko }, LIMIT_FLOW_MS)
    const status = kod === 0 ? 'ok' : typeof kod === 'number' ? 'porazka' : kod === 'SIGKILL' ? 'zawieszony' : 'blad-maestro'
    return { status, flow, kod, ogon, urzadzenie: c.urzadzenie.nazwa, katalog: relative(projekt, katalog), zrzuty: przeniesZrzuty(robocze, katalog, projekt) }
  } finally {
    rmSync(robocze, { recursive: true, force: true })
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: o } = parseArgs({ options: { projekt: { type: 'string' }, urzadzenie: { type: 'boolean' }, zadanie: { type: 'string' }, flow: { type: 'string' }, plik: { type: 'string' } } })
  const projekt = o.projekt ?? process.cwd()
  if (o.urzadzenie) {
    process.stdout.write(`${JSON.stringify(urzadzenieTestera({ projekt }))}\n`)
  } else if (o.zadanie && o.flow) {
    process.stdout.write(`${JSON.stringify(await odegrajFlow({ projekt, zadanie: o.zadanie, flow: o.flow, plik: o.plik }))}\n`)
  } else {
    process.stderr.write('Użycie: expo-flow.mjs --urzadzenie | --zadanie <folder> --flow <flow> [--plik <ścieżka>] [--projekt <katalog>]\n')
    process.exitCode = KOD_ZLYCH_ARGUMENTOW
  }
}
