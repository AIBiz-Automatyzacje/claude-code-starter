#!/usr/bin/env node
// Ślepy test P11 — wynik bramek w formacie bramki.mjs dla dossier kopii fazy (wejście `dossier.mjs --bramki`), zero agentów.
// Bramki z modułów .claude/scripts/bramki wariantu nowego (na main i na gałęzi P11 identyczne), narzędzia z ~/test-review/_narzedzia:
//   eslint            — konfiguracja szablonu (.claude/templates/bramki/eslint.config.szablon.ts) uruchomiona naprawdę na kopii;
//   migracje, suma, testyUsuniete, advisors — moduły szablonu na kopii (advisors bez tokenu = status brak, jak w kopiach testu);
//   stryker           — przeżyte mutanty z wrześniowego przebiegu (te same wersje Strykera i vitest, coverage perTest: wynik mutanta nie
//                       zależy od zakresu), przycięte do zakresu bramki szablonu (zakresyStrykera);
//   knip, typecheck   — wrześniowy przebieg na kopii (konfiguracja knip oferty z workspace'ami — szablonowa bez nich nie widzi wejść pakietów);
//   testyTypow, sizeLimit — brak (nie dotyczą testu).
// Uzycie: node skrypty/test_review_p11_bramki.mjs --kopia <dir> --baza <sha> --wrzesien <bramki-<et>.json> --claude <dir z .claude> --narzedzia <dir>
// Kopia po bramkach ma czysty git status (konfiguracja ESLint w korzeniu kopii tylko na czas przebiegu).
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const ZAKRES = /^(.+):(\d+)-(\d+)$/
const STRZALKA = ' → '
const KONFIG_KOPII = 'eslint.config.mjs'

/**
 * Mutanty wrześniowe (opis `Status: Mutator → zamiennik`) na liniach zakresu bramki szablonu, z opisem jak w stryker.mjs (`Status: zamiennik`).
 * @param {{ plik: string, linia: number, regula: string, opis: string }[]} trafienia
 * @param {string[]} mutate argumenty --mutate z zakresyStrykera (`plik:od-do`)
 */
export function mutantyWZakresie(trafienia, mutate) {
  const zakresy = mutate.map((z) => {
    const m = ZAKRES.exec(z)
    if (!m) throw new Error(`zakres Strykera spoza formatu plik:od-do: ${z}`)
    return { plik: m[1], od: Number(m[2]), do: Number(m[3]) }
  })
  return trafienia
    .filter((t) => zakresy.some((z) => z.plik === t.plik && t.linia >= z.od && t.linia <= z.do))
    .map((t) => {
      const [status, reszta] = [t.opis.slice(0, t.opis.indexOf(': ')), t.opis.slice(t.opis.indexOf(': ') + 2)]
      return { ...t, opis: `${status}: ${reszta.includes(STRZALKA) ? reszta.slice(reszta.indexOf(STRZALKA) + STRZALKA.length) : reszta}` }
    })
}

/** @param {string} katalog @param {string} modul */
const zaladuj = (katalog, modul) => import(pathToFileURL(join(katalog, '.claude', 'scripts', 'bramki', modul)).href)

/** ESLint szablonu na kopii: konfiguracja z _narzedzia (importy pluginów stamtąd), w korzeniu kopii tylko reeksport na czas przebiegu. */
async function eslint(a, zmiany) {
  const { bramkaEslint } = await zaladuj(a.claude, 'eslint.mjs')
  const konfig = join(a.narzedzia, 'konfig', 'eslint-szablon.ts')
  const zrodlo = readFileSync(join(a.claude, '.claude', 'templates', 'bramki', 'eslint.config.szablon.ts'), 'utf8')
  if (!zrodlo.includes('tsconfigRootDir: import.meta.dirname')) throw new Error('konfiguracja ESLint szablonu bez tsconfigRootDir — do przeglądu')
  writeFileSync(konfig, zrodlo.replace('tsconfigRootDir: import.meta.dirname', 'tsconfigRootDir: process.cwd()'))
  writeFileSync(join(a.kopia, KONFIG_KOPII), `export { default } from '${konfig}'\n`)
  try {
    return bramkaEslint(a.kopia, { bin: join(a.narzedzia, 'node_modules', '.bin', 'eslint') }, zmiany)
  } finally {
    rmSync(join(a.kopia, KONFIG_KOPII))
  }
}

function wrzesniowe(w, zmiany, zakresyStrykera) {
  const tc = w.bramki.typecheck
  const st = w.bramki.stryker || {}
  const mutate = zakresyStrykera(zmiany)
  const przebiegi = Object.values(st.wyniki || {})
  const stryker = !mutate.length
    ? { status: 'pominieta', sekundy: null, trafienia: [], powod: 'faza nie zmienila pary test <-> plik produkcyjny z liniami dodanymi' }
    : przebiegi.length && przebiegi.every((p) => p.status === 'uruchomiona')
      ? { status: 'ok', sekundy: null, trafienia: mutantyWZakresie(przebiegi.flatMap((p) => p.przezyte || []), mutate) }
      : { status: 'brak', sekundy: null, trafienia: [], powod: `wrzesniowy przebieg Strykera: ${st.status || 'brak'}` }
  return {
    typecheck: { status: tc && tc.kod_wyjscia === 0 && !tc.bledy_ts ? 'ok' : 'porazka', sekundy: tc ? tc.sekundy : null, trafienia: [] },
    knip: { status: w.bramki.knip ? 'ok' : 'brak', sekundy: null, trafienia: (w.bramki.knip && w.bramki.knip.trafienia) || [], zastane: (w.bramki.knip && w.bramki.knip.zastane) || 0 },
    stryker,
  }
}

async function main() {
  const { values: a } = parseArgs({ options: Object.fromEntries(['kopia', 'baza', 'wrzesien', 'claude', 'narzedzia'].map((k) => [k, { type: 'string' }])) })
  for (const k of ['kopia', 'baza', 'wrzesien', 'claude', 'narzedzia']) if (!a[k]) throw new Error(`brak --${k}`)
  const { zmianyFazy } = await zaladuj(a.claude, 'diff.mjs')
  const { zakresyStrykera } = await zaladuj(a.claude, 'stryker.mjs')
  const { bramkaNiezmiennoscMigracji } = await zaladuj(a.claude, 'migracje.mjs')
  const { bramkaMigrationsSum } = await zaladuj(a.claude, 'migrations-sum.mjs')
  const { bramkaTestyUsuniete } = await zaladuj(a.claude, 'testy-usuniete.mjs')
  const { API_SUPABASE, bramkaAdvisors } = await zaladuj(a.claude, 'advisors.mjs')
  const zmiany = zmianyFazy(a.kopia, a.baza)
  const w = wrzesniowe(JSON.parse(readFileSync(a.wrzesien, 'utf8')), zmiany, zakresyStrykera)
  const brak = (powod) => ({ status: 'brak', sekundy: null, trafienia: [], powod })
  const wynik = {
    typecheck: w.typecheck,
    eslint: await eslint(a, zmiany),
    testyTypow: brak('nie dotyczy testu P11'),
    knip: w.knip,
    sizeLimit: brak('nie dotyczy testu P11'),
    migracje: bramkaNiezmiennoscMigracji(a.kopia, a.baza),
    migracjeSuma: bramkaMigrationsSum(a.kopia),
    advisors: await bramkaAdvisors(a.kopia, {}, API_SUPABASE),
    testyUsuniete: bramkaTestyUsuniete(a.kopia, zmiany),
    stryker: w.stryker,
  }
  const status = execFileSync('git', ['-C', a.kopia, 'status', '--porcelain'], { encoding: 'utf8' })
  if (status) throw new Error(`kopia brudna po bramkach:\n${status}`)
  process.stdout.write(`${JSON.stringify(wynik, null, 1)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
