// Repo testowe bramek: katalog tymczasowy z gitem, zapis plikow i commit. Wspolne dla testow bramek.

import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')

/** @param {string} repo @param {string[]} argumenty */
export function git(repo, argumenty) {
  return execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8' }).trim()
}

/** @returns {string} katalog nowego repo z jednym pustym commitem */
export function noweRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'bramki-'))
  git(repo, ['init', '-q'])
  git(repo, ['config', 'user.email', 't@t'])
  git(repo, ['config', 'user.name', 't'])
  git(repo, ['commit', '-q', '--allow-empty', '-m', 'start'])
  return repo
}

/** @param {string} repo @param {Record<string, string>} pliki sciezka wzgledna -> tresc */
export function zapisz(repo, pliki) {
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(repo, sciezka)), { recursive: true })
    writeFileSync(join(repo, sciezka), tresc)
  }
}

/** @param {string} repo @param {string} komunikat @returns {string} sha commita */
export function commit(repo, komunikat) {
  git(repo, ['add', '-A'])
  git(repo, ['commit', '-q', '-m', komunikat])
  return git(repo, ['rev-parse', 'HEAD'])
}

/**
 * Atrapa narzedzia w node_modules/.bin projektu: wypisuje nagrane wyjscie prawdziwego narzedzia
 * (fixtures/), wariant zalezny od tego, czy plik `znacznik` projektu zawiera `wzorzec`.
 * @param {string} repo
 * @param {{ nazwa: string, znacznik: string, wzorzec: string, naruszenie: string, czyste: string, kodNaruszenia?: number, plikWyjscia?: string }} o
 *   plikWyjscia — wyjscie do pliku (raport Strykera) zamiast na stdout
 */
export function atrapa(repo, o) {
  const bin = join(repo, 'node_modules', '.bin')
  mkdirSync(bin, { recursive: true })
  const tresc = (/** @type {string} */ plik) => readFileSync(join(FIXTURES, plik), 'utf8').replaceAll('__PROJEKT__', repo)
  writeFileSync(join(bin, `${o.nazwa}.naruszenie`), tresc(o.naruszenie))
  writeFileSync(join(bin, `${o.nazwa}.czyste`), tresc(o.czyste))
  const cel = o.plikWyjscia ? `> "${join(repo, o.plikWyjscia)}"` : ''
  if (o.plikWyjscia) mkdirSync(dirname(join(repo, o.plikWyjscia)), { recursive: true })
  const skrypt = [
    '#!/bin/sh',
    `printf '%s\\n' "$*" > "${join(bin, `${o.nazwa}.argumenty`)}"`,
    `if grep -q '${o.wzorzec}' "${join(repo, o.znacznik)}"; then cat "${join(bin, `${o.nazwa}.naruszenie`)}" ${cel}; exit ${o.kodNaruszenia ?? 1}; fi`,
    `cat "${join(bin, `${o.nazwa}.czyste`)}" ${cel}`,
  ].join('\n')
  writeFileSync(join(bin, o.nazwa), `${skrypt}\n`)
  chmodSync(join(bin, o.nazwa), 0o755)
}

/** @param {string} repo @param {string} nazwa @returns {string} argumenty ostatniego wywolania atrapy */
export function argumentyAtrapy(repo, nazwa) {
  return readFileSync(join(repo, 'node_modules', '.bin', `${nazwa}.argumenty`), 'utf8').trim()
}

/** @param {string} repo */
export function usun(repo) {
  rmSync(repo, { recursive: true, force: true })
}
