// Testy rdzenia na zbudowanym wariancie (plan szablonu mobile z rdzenia, IU-2.0, zasada 4). Ławka = katalog tymczasowy z
// wynikiem `zbuduj.mjs` i tym, czego wymagają testy `.claude/**/__tests__` (package.json, tsconfig, node_modules, rejestr slotów,
// strażnik). Testy nakładki leżą w `stacks/<stack>/__tests__/` i biegną z `pnpm test`, same budując ławkę.
//
// Uruchomienie: node stacks/testuj-wariant.mjs <stack> [--zostaw]

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BladWariantu, zbuduj } from './zbuduj.mjs'

const PLIKI_LAWKI = ['package.json', 'tsconfig.json', 'stacks/sloty.json', 'stacks/straznik.json', 'stacks/straznik.mjs']
// Pakiety z pnpm-workspace.yaml: paczek nie ma w gicie, a testy bramek uruchamiają narzędzia z node_modules pakietu.
const KATALOGI_Z_PACZKAMI = ['.', '.claude/templates/bramki']

/**
 * @param {string} korzen @param {string} stack
 * @returns {{ katalog: string, wynik: ReturnType<typeof zbuduj>, sprzataj: () => void }}
 */
export function przygotujLawke(korzen, stack) {
  const katalog = mkdtempSync(join(tmpdir(), `wariant-${stack}-`))
  const sprzataj = () => rmSync(katalog, { recursive: true, force: true })
  try {
    const wynik = zbuduj({ korzen, stack, katalog })
    mkdirSync(join(katalog, 'stacks'))
    for (const p of PLIKI_LAWKI) copyFileSync(join(korzen, p), join(katalog, p))
    for (const k of KATALOGI_Z_PACZKAMI) {
      if (existsSync(join(korzen, k, 'node_modules')) && existsSync(join(katalog, k))) {
        symlinkSync(join(korzen, k, 'node_modules'), join(katalog, k, 'node_modules'))
      }
    }
    return { katalog, wynik, sprzataj }
  } catch (blad) {
    sprzataj()
    throw blad
  }
}

/** @param {string} katalog @returns {{ testy: number, typecheck: number }} kody wyjścia */
function uruchomNaLawce(katalog) {
  const testy = spawnSync(process.execPath, ['--test', '.claude/**/__tests__/*.test.mjs'], { cwd: katalog, stdio: 'inherit' })
  const typecheck = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: katalog, stdio: 'inherit' })
  return { testy: testy.status ?? 1, typecheck: typecheck.status ?? 1 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumenty = process.argv.slice(2)
  const stack = argumenty.find((a) => !a.startsWith('--'))
  if (!stack) {
    console.error('Użycie: node stacks/testuj-wariant.mjs <stack> [--zostaw]')
    process.exit(2)
  }
  const korzen = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const { katalog, wynik, sprzataj } = przygotujLawke(korzen, stack)
    const kody = uruchomNaLawce(katalog)
    if (argumenty.includes('--zostaw')) console.log(`ławka: ${katalog}`)
    else sprzataj()
    console.log(`wariant ${stack}: ${wynik.pliki} plików, testy=${kody.testy} typecheck=${kody.typecheck}`)
    process.exit(kody.testy || kody.typecheck ? 1 : 0)
  } catch (blad) {
    if (!(blad instanceof BladWariantu)) throw blad
    console.error(`${blad.kod}: ${blad.message}`)
    process.exit(1)
  }
}
