#!/usr/bin/env node
// E2E (PLAN-POPRAWY P14): CLI srodowiska i ksiegowania scenariuszy [E2E] — jedno zrodlo dla autopilota, review, fixa,
// smoke'u operatora i sekcji Doctor skilla weryfikacji.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   e2e.mjs sprawdz --zadanie <docs/active/zadanie>   potrzeby zadania + sprawdzenie .env.e2e bez startu serwera (Doctor)
//   e2e.mjs start --zadanie <docs/active/zadanie>     to samo + start serwera aplikacji (bootstrap autopilota)
//   e2e.mjs stop                                      zatrzymuje serwer uruchomiony przez start (plik PID)
//   e2e.mjs suma                                      suma migracji przed wypchnieciem do bazy e2e
//   e2e.mjs ksieguj --zadanie <dir> --faza N [--brak-wpisu <przyczyna> --powod <tekst>] [--tylko-z-wpisem]
//                                                     przebiegi testera (JSON z stdin) -> linie [E2E] fazy w pliku zadan
//   e2e.mjs manual --zadanie <dir> --faza N --flow <id> --przyczyna <przyczyna> --powod <tekst>
//                                                     jeden flow na [Manual] (fix przy srodowisku niedostepnym w runie)
//   e2e.mjs lista-manual --zadanie <dir>              pozycje przeniesione w runie na [Manual] (smoke operatora)
// Wynik: JSON w jednej linii na stdout. Kod wyjscia: 0 = ok, 1 = do poprawy (STOP, porazka sumy, flow bez linii),
// 2 = zle argumenty, 3 = wyjatek skryptu (JSON z polem wyjatek).

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

import { bramkaMigrationsSum } from '../bramki/migrations-sum.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { rodzajPrzyczyny, zaksiegujFaze } from './ksiegowanie.mjs'
import { listaManual } from './scenariusze.mjs'
import { envE2e, konfiguracja, zatrzymajSerwer } from './srodowisko.mjs'
import { startE2e } from './start.mjs'

const KOD_DO_POPRAWY = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, zadanie: { type: 'string' }, faza: { type: 'string' }, flow: { type: 'string' },
  przyczyna: { type: 'string' }, powod: { type: 'string' }, 'brak-wpisu': { type: 'string' }, 'tylko-z-wpisem': { type: 'boolean' },
})

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`e2e: ${komunikat}\nUzycie: e2e.mjs sprawdz|start --zadanie <dir> | stop | suma | ksieguj --zadanie <dir> --faza N [--brak-wpisu <przyczyna> --powod <tekst>] [--tylko-z-wpisem] | manual --zadanie <dir> --faza N --flow <id> --przyczyna <p> --powod <tekst> | lista-manual --zadanie <dir> [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @param {unknown} wynik @param {boolean} ok @returns {never} */
function zakoncz(wynik, ok) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
  process.exit(ok ? 0 : KOD_DO_POPRAWY)
}

/** @param {string} projekt @param {string | undefined} zadanie @returns {string} katalog zadania wzgledem projektu */
function sciezkaZadania(projekt, zadanie) {
  if (!zadanie) zleArgumenty('brak --zadanie <docs/active/zadanie>')
  return isAbsolute(zadanie) ? relative(projekt, zadanie) : zadanie
}

/** @param {string | undefined} faza @returns {number} */
function numerFazy(faza) {
  const n = Number(faza)
  if (!Number.isInteger(n) || n < 1) zleArgumenty(`--faza musi byc numerem fazy (jest: ${faza ?? 'brak'})`)
  return n
}

/** @param {string} projekt @param {string} sciezka @returns {{ plik: string, tresc: string }} */
function zadania(projekt, sciezka) {
  const plik = plikZadania(join(projekt, sciezka), '-zadania.md')
  if (!plik) zleArgumenty(`brak pliku *-zadania.md w ${sciezka}`)
  return { plik: join(projekt, sciezka, plik.nazwa), tresc: plik.tresc }
}

/** @param {import('./ksiegowanie.mjs').Zmiany} z */
const liczniki = (z) => ({ odznaczone: z.pass.length, fail: z.fail.length, skip: z.skip.length, manual: z.manual.length, bezWpisu: z.bezWpisu.length })

/** @param {string} projekt @param {string} plik @param {string} tekst @param {import('./ksiegowanie.mjs').Zmiany} zmiany */
function zapiszKsiegowanie(projekt, plik, tekst, zmiany) {
  writeFileSync(plik, tekst)
  return { plik: relative(projekt, plik), ...liczniki(zmiany), manualPozycje: zmiany.manual.map(({ flow, przyczyna, powod }) => ({ flow, przyczyna, powod })) }
}

/** @param {string} polecenie @param {ReturnType<typeof parseArgs<{ options: typeof USTAWIENIA, allowPositionals: true }>>['values']} o @param {string} projekt */
async function wykonaj(polecenie, o, projekt) {
  if (polecenie === 'sprawdz' || polecenie === 'start') {
    const w = await startE2e(projekt, sciezkaZadania(projekt, o.zadanie), { uruchom: polecenie === 'start' })
    zakoncz(w, w.status === 'pominieto' || w.status === 'gotowe')
  }
  if (polecenie === 'stop') zakoncz(zatrzymajSerwer(konfiguracja(projekt, envE2e(projekt) ?? {})), true)
  if (polecenie === 'suma') {
    const w = bramkaMigrationsSum(projekt)
    zakoncz(w, w.status !== 'porazka')
  }
  const sciezka = sciezkaZadania(projekt, o.zadanie)
  const { plik, tresc } = zadania(projekt, sciezka)
  if (polecenie === 'lista-manual') zakoncz({ pozycje: listaManual(tresc) }, true)
  const faza = numerFazy(o.faza)
  if (polecenie === 'ksieguj') {
    const przebiegi = JSON.parse(readFileSync(0, 'utf8') || '[]')
    if (!Array.isArray(przebiegi)) zleArgumenty('stdin: oczekiwana tablica przebiegow JSON')
    if (o['brak-wpisu'] && rodzajPrzyczyny(o['brak-wpisu']) !== 'manual') zleArgumenty(`--brak-wpisu ${o['brak-wpisu']} nie jest przyczyna recznego sprawdzenia`)
    const brakWpisu = o['brak-wpisu'] ? { przyczyna: o['brak-wpisu'], powod: o.powod ?? '' } : undefined
    const { tekst, zmiany } = zaksiegujFaze(tresc, faza, przebiegi, { brakWpisu, tylkoZWpisem: !!o['tylko-z-wpisem'] })
    zakoncz(zapiszKsiegowanie(projekt, plik, tekst, zmiany), true)
  }
  if (polecenie === 'manual') {
    if (!o.flow || !o.przyczyna || rodzajPrzyczyny(o.przyczyna) !== 'manual') zleArgumenty('manual wymaga --flow i --przyczyna z: srodowisko, limit-zewnetrzny, harness, tester-padl')
    const wpis = { flow: o.flow, checkbox: o.flow, wynik: 'SKIP', przyczyna: o.przyczyna, dowod: o.powod ?? '' }
    const { tekst, zmiany } = zaksiegujFaze(tresc, faza, [wpis], { tylkoZWpisem: true })
    if (!zmiany.manual.length) zakoncz({ blad: `faza ${faza} nie ma niezaznaczonej linii [E2E] z flow ${o.flow}` }, false)
    zakoncz(zapiszKsiegowanie(projekt, plik, tekst, zmiany), true)
  }
  zleArgumenty(`nieznane polecenie: ${polecenie}`)
}

const { values: o, positionals } = (() => {
  try {
    return parseArgs({ options: USTAWIENIA, allowPositionals: true })
  } catch (blad) {
    return zleArgumenty(blad instanceof Error ? blad.message : String(blad))
  }
})()
const projekt = o.projekt ?? process.cwd()
try {
  await wykonaj(positionals[0] ?? '', o, projekt)
} catch (blad) {
  process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
  process.exit(KOD_WYJATKU)
}
