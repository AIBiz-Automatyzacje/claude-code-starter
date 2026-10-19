#!/usr/bin/env node
// Commity po archiwizacji zadania (P22 B4): zmiany ze smoke'u operatora omijaja review pipeline'u. vibersi etap 4: po commicie
// archiwum sesja smoke'u dodala m.in. naklejke odznaki (71a1652) i poprawki serwera — czesc 2 PR miala 93 pliki src, a sprawdzil
// je tylko bot. Skrypt wylicza commity <archiwum>..<galaz zadania> bez tematow pipeline'u i pliki kodu (poza docs/ i .claude/),
// zeby /dev-pr przed wyslaniem PR zapytal operatora o krotkie review (correctness + security na diffie tych commitow).
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   po-archiwum.mjs --zadanie <nazwa> [--galaz <ref>] [--czesc N]
// galaz domyslnie feature/<nazwa>. Commity po archiwum jada w ostatniej czesci PR (czesci nieostatnie koncza sie przed
// archiwum) — przy --czesc N < liczby czesci z podsumowania wTejCzesci = false.
// Wynik: JSON w jednej linii { ok, archiwum, galaz, zakres, czesci, wTejCzesci, commity: [{ sha, temat, plikiKodu }], plikiKodu }.
// archiwum null = brak commitu `docs(<nazwa>): archiwum` na galezi (zadanie niezarchiwizowane). Kod wyjscia: 0 = ok,
// 2 = zle argumenty, 3 = wyjatek (JSON z polem wyjatek).

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
// Katalogi bez kodu aplikacji: dokumentacja zadania i smoke'u oraz maszyneria szablonu.
const KATALOGI_BEZ_KODU = ['docs/', '.claude/']

/** @param {string} zadanie @returns {RegExp[]} tematy commitow pipeline'u po archiwum (archiwizacja i /dev-pr) */
function tematyPipeline(zadanie) {
  const z = zadanie.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    new RegExp(`^docs\\(${z}\\): (części PR w podsumowaniu|rozmiar PR w podsumowaniu|CLAUDE\\.md uzgodniony po merge'u)$`),
    /^fix\(pr\): tura \d+ — poprawki po review bota$/,
  ]
}

/** @param {string} projekt @param {string[]} argumenty @returns {string} */
function git(projekt, argumenty) {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (w.status !== 0) throw new Error(`git ${argumenty.join(' ')}: ${(w.stderr ?? '').trim()}`)
  return w.stdout ?? ''
}

/** @param {string} plik @returns {boolean} */
export function plikKodu(plik) {
  return !KATALOGI_BEZ_KODU.some((k) => plik.startsWith(k))
}

/** @param {string} projekt @param {string} galaz @param {string} zadanie @returns {number | null} liczba czesci z podsumowania (null = jeden PR) */
function liczbaCzesci(projekt, galaz, zadanie) {
  const w = spawnSync('git', ['show', `${galaz}:docs/completed/${zadanie}/${zadanie}-podsumowanie.md`], { cwd: projekt, encoding: 'utf8' })
  if (w.status !== 0) return null
  // Ten sam poczatek sekcji co awk w dev-pr-wf.js (`/^## Części PR/`): naglowek z dopiskiem albo CRLF tez sie liczy.
  const sekcja = /^## Części PR[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec((w.stdout ?? '').replace(/\r\n/g, '\n'))?.[1] ?? ''
  const wiersze = sekcja.split('\n').filter((l) => /^\|\s*\**\d+\**\s*\|/.test(l))
  return wiersze.length > 1 ? wiersze.length : null
}

/**
 * @param {string} projekt
 * @param {{ zadanie: string, galaz?: string, czesc?: number }} o
 */
export function poArchiwum(projekt, { zadanie, galaz = `feature/${zadanie}`, czesc }) {
  const temat = `docs(${zadanie}): archiwum`
  // --grep szuka podciagu w calej wiadomosci; archiwum = commit z dokladnie tym tematem (nie revert, nie inne zadanie).
  const archiwum = git(projekt, ['log', '--format=%H%x09%s', '--fixed-strings', `--grep=${temat}`, galaz]).split('\n')
    .find((l) => l.slice(41) === temat)?.slice(0, 40) ?? null
  const czesci = liczbaCzesci(projekt, galaz, zadanie)
  const wTejCzesci = !czesc || !czesci || czesc >= czesci
  if (!archiwum) return { ok: true, archiwum, galaz, zakres: null, czesci, wTejCzesci, commity: [], plikiKodu: [] }
  const pipeline = tematyPipeline(zadanie)
  const commity = git(projekt, ['log', '--reverse', '--format=%H%x09%s', `${archiwum}..${galaz}`]).split('\n').filter(Boolean)
    .map((l) => ({ sha: l.slice(0, 40), temat: l.slice(41) }))
    .filter((c) => !pipeline.some((r) => r.test(c.temat)))
    .map((c) => ({ ...c, plikiKodu: git(projekt, ['show', '--name-only', '--format=', c.sha]).split('\n').filter((p) => p && plikKodu(p)) }))
  const plikiKodu = [...new Set(commity.flatMap((c) => c.plikiKodu))].sort()
  return { ok: true, archiwum, galaz, zakres: `${archiwum.slice(0, 12)}..${galaz}`, czesci, wTejCzesci, commity, plikiKodu }
}

// realpath i fileURLToPath: sciezka ze spacja albo polskimi znakami jest w URL-u zakodowana (%20), /var → /private/var.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, zadanie?: string, galaz?: string, czesc?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, zadanie: { type: 'string' }, galaz: { type: 'string' }, czesc: { type: 'string' } } }).values
    if (!o.zadanie || !/^[\w.-]+$/.test(o.zadanie)) throw new Error('brak albo zla nazwa --zadanie')
    if (o.czesc !== undefined && !/^[1-9]\d*$/.test(o.czesc)) throw new Error('--czesc musi byc numerem czesci')
  } catch (blad) {
    process.stderr.write(`po-archiwum: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: po-archiwum.mjs --zadanie <nazwa> [--galaz <ref>] [--czesc N] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    const w = poArchiwum(o.projekt ?? process.cwd(), { zadanie: o.zadanie, galaz: o.galaz, czesc: o.czesc ? Number(o.czesc) : undefined })
    process.stdout.write(`${JSON.stringify(w)}\n`)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ ok: false, wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
