#!/usr/bin/env node
// Pakiet fixture smoke'a (PLAN-POPRAWY P0, P6): pliki z pakiet/ + konfiguracje bramek z .claude/templates/bramki
// (szablon ESLint jako eslint.config.ts) + devDependencies bramek dopisane do package.json pakietu — smoke uruchamia
// prawdziwe bramki domkniecia fazy. Wolany przez przygotuj-kopie.sh przed `pnpm install`.
//
// Uzycie: node wstaw-pakiet.mjs <katalog-pakietu>

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SMOKE = dirname(fileURLToPath(import.meta.url))
const BRAMKI = join(SMOKE, '..', 'bramki')
const PLIKI_PAKIETU = ['tsconfig.json', 'vitest.config.ts']
const KONFIGURACJE = { 'eslint.config.szablon.ts': 'eslint.config.ts', 'knip.json': 'knip.json', '.size-limit.json': '.size-limit.json', 'stryker.config.json': 'stryker.config.json' }

const pakiet = process.argv[2]
if (!pakiet) {
  process.stderr.write('Użycie: node wstaw-pakiet.mjs <katalog-pakietu>\n')
  process.exit(2)
}
mkdirSync(join(pakiet, 'src'), { recursive: true })
for (const plik of PLIKI_PAKIETU) copyFileSync(join(SMOKE, 'pakiet', plik), join(pakiet, plik))
for (const [szablon, plik] of Object.entries(KONFIGURACJE)) copyFileSync(join(BRAMKI, szablon), join(pakiet, plik))
const json = JSON.parse(readFileSync(join(SMOKE, 'pakiet', 'package.json'), 'utf8'))
json.devDependencies = JSON.parse(readFileSync(join(BRAMKI, 'package.json'), 'utf8')).devDependencies
writeFileSync(join(pakiet, 'package.json'), `${JSON.stringify(json, null, 2)}\n`)
