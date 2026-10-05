#!/usr/bin/env node
// Czesc doctor.sh: licznik warstwy stalej plikow rol w instalacji projektu (PLAN-POPRAWY P11). Liczy tylko pliki
// `.claude/agents/*.md` z blokiem `## Polecenia` — pliki bez bloku nie sa jeszcze przepisane wg zasad pisania.
// Wiersz TSV jak zaleznosci-bramek.mjs. Naruszenie = UWAGA, nie BRAK: rola dziala, tylko jej warstwa stala odjechala
// od szablonu (zwykle reczna edycja w projekcie).
//
// Uzycie: node warstwa-rol.mjs <katalog-projektu>

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { MAKS_POLECEN, liczbaPolecen, naruszeniaWarstwy } from './warstwa-stala.mjs'

/** @typedef {[string, string, string, string]} Wiersz */

const ELEMENT = 'warstwa stała ról'
const NAGLOWEK_BLOKU = /^## Polecenia\s*$/m

/** @param {number} n @returns {string} */
function plikiRol(n) {
  const reszta10 = n % 10
  const reszta100 = n % 100
  const forma = n === 1 ? 'plik' : reszta10 >= 2 && reszta10 <= 4 && (reszta100 < 12 || reszta100 > 14) ? 'pliki' : 'plików'
  return `${n} ${forma} ról`
}

/**
 * @param {string} projekt
 * @returns {Wiersz}
 */
function wierszWarstwy(projekt) {
  const katalog = join(projekt, '.claude', 'agents')
  const role = (existsSync(katalog) ? readdirSync(katalog) : [])
    .filter((n) => n.endsWith('.md'))
    .sort()
    .map((n) => ({ nazwa: n, tekst: readFileSync(join(katalog, n), 'utf8') }))
    .filter((r) => NAGLOWEK_BLOKU.test(r.tekst))
  if (!role.length) return [ELEMENT, 'nie dotyczy', 'brak plików ról z blokiem „## Polecenia” w .claude/agents/', '—']
  const naruszenia = role.flatMap((r) => {
    const lista = naruszeniaWarstwy(r.tekst)
    return lista.length ? [`${r.nazwa}: ${lista[0]}${lista.length > 1 ? ` (+${lista.length - 1})` : ''}`] : []
  })
  if (naruszenia.length) return [ELEMENT, 'UWAGA', naruszenia.join('; '), 'przywróć pliki z szablonu: /sync-template']
  const liczby = role.map((r) => ({ nazwa: r.nazwa, polecen: liczbaPolecen(r.tekst) }))
  const suma = liczby.reduce((a, r) => a + r.polecen, 0)
  const maks = liczby.reduce((a, r) => (r.polecen > a.polecen ? r : a))
  return [ELEMENT, 'OK', `${plikiRol(role.length)}, poleceń ${suma} (najwięcej ${maks.polecen}: ${maks.nazwa}), budżet ${MAKS_POLECEN} na plik`, '—']
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node warstwa-rol.mjs <katalog-projektu>\n')
  process.exit(2)
}
process.stdout.write(`${wierszWarstwy(projekt).join('\t')}\n`)
