#!/usr/bin/env node
// Dossier fazy dla review (PLAN-POPRAWY P7): deterministyczny skrypt zamiast agenta context-packagera.
//
// Uzycie:
//   node .claude/scripts/dossier/dossier.mjs --sciezka <katalog zadania> --faza <N> [--baza <commit sprzed fazy>]
//     [--bramki <wynik JSON bramek>] [--projekt <katalog>] [--wyjscie <katalog plikow, domyslnie /tmp>]
//
// Pliki (sciezki deterministyczne z zadania i fazy — ponowne uruchomienie nadpisuje):
//   review-diff-<zadanie>-faza-N.diff   pelny diff fazy (limit 300 KB, znacznik uciecia),
//   review-ctx-<zadanie>-faza-N.md      dossier: zmiany, profil stacku, sygnaly diffu, bramki (ostatni przebieg),
//                                       sekcja planu fazy, wiersze wymagan, learned-patterns, zadania fazy, kontekst designerski.
//   Bez --bramki: bramki-<zadanie>-faza-N.json z katalogu wyjscia (domkniecie zapisuje tam wynik bramek), o ile istnieje.
// Wynik (stdout, JSON) = pole `dossier` w schemacie KONTEKST z dev-docs-review-wf.js:
//   { diffStat, pliki: [{ plik, czegoDotyczy }], warstwy: { ui, dane, typowanie, nowyModul }, e2eCheckboxy, figmaScreens,
//     diffPlik, diffZapisany, diffUciety, ctxPlik, ctxZapisany, ctxZnaki, preSkan: [{ wzorzec, plik }] }
// Kod wyjscia: 0 = dossier zapisane, 2 = zle argumenty (takze baza, ktora nie jest commitem).

import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { blokBramek } from './bramki-blok.mjs'
import { profilStacku } from './profil.mjs'
import { sciezkiArtefaktow } from './sciezki.mjs'
import { dodaneLinie, preSkan, warstwy } from './sygnaly.mjs'
import { wycinkiZadania } from './zadanie.mjs'
import { bazaZastepcza, zapiszDiff, zmianyDossier } from './zmiany.mjs'

const KOD_ZLYCH_ARGUMENTOW = 2
const WYJSCIE_DOMYSLNE = '/tmp'
const STATUS_OPIS = /** @type {const} */ ({ A: 'dodany', M: 'zmieniony', D: 'usuniety' })

/** @typedef {import('./zmiany.mjs').PlikFazy} PlikFazy */

/** @param {PlikFazy} p @returns {string} */
function czegoDotyczy(p) {
  const linie = [p.dodane ? `+${p.dodane}` : '', p.usuniete ? `−${p.usuniete}` : ''].filter(Boolean).join(' ')
  return `${STATUS_OPIS[p.status]}${linie ? ` (${linie})` : ''}`
}

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`dossier: ${komunikat}\nUzycie: dossier.mjs --sciezka <katalog zadania> --faza <N> [--baza <commit>] [--bramki <plik>] [--projekt <katalog>] [--wyjscie <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @returns {{ sciezka: string, faza: number, baza: string | undefined, bramki: string | undefined, projekt: string, wyjscie: string }} */
function argumenty() {
  /** @type {Record<string, string | undefined>} */
  let v
  try {
    v = parseArgs({ options: Object.fromEntries(['sciezka', 'faza', 'baza', 'bramki', 'projekt', 'wyjscie'].map((k) => [k, { type: 'string' }])) }).values
  } catch (e) {
    if (!(e instanceof TypeError)) throw e
    return zleArgumenty(e.message)
  }
  if (!v.sciezka) return zleArgumenty('brak --sciezka (katalog zadania)')
  if (!/^\d+$/.test(v.faza ?? '')) return zleArgumenty('--faza musi byc numerem fazy')
  const projekt = v.projekt ?? process.cwd()
  if (v.baza && spawnSync('git', ['-C', projekt, 'rev-parse', '--verify', '--quiet', `${v.baza}^{commit}`]).status !== 0) {
    return zleArgumenty(`baza fazy "${v.baza}" nie jest commitem w ${projekt}`)
  }
  return { sciezka: v.sciezka, faza: Number(v.faza), baza: v.baza, bramki: v.bramki, projekt, wyjscie: v.wyjscie ?? WYJSCIE_DOMYSLNE }
}

const a = argumenty()
const sciezki = sciezkiArtefaktow(a.wyjscie, a.sciezka, a.faza)
const baza = a.baza ?? bazaZastepcza(a.projekt)
const opisBazy = a.baza ? baza : `${baza} (zastepcza: merge-base z galezia glowna albo HEAD — zakres moze objac wczesniejsze fazy zadania)`
const { pliki, diff } = zmianyDossier(a.projekt, baza)
const dodane = dodaneLinie(diff)
const sygnaly = preSkan(a.projekt, dodane)
const zapisDiffu = zapiszDiff(diff, sciezki.diff)
const zadanie = wycinkiZadania(a.projekt, a.sciezka, a.faza)
const plikBramek = a.bramki ?? (existsSync(sciezki.bramki) ? sciezki.bramki : null)
const diffStat = `${pliki.length} plikow, +${pliki.reduce((s, p) => s + p.dodane, 0)} −${pliki.reduce((s, p) => s + p.usuniete, 0)}`

const tresc = [
  `# Dossier fazy ${a.faza} — ${a.sciezka}`,
  '',
  `Baza fazy: ${opisBazy}`,
  `Pelny diff fazy: ${zapisDiffu.zapisany ? sciezki.diff : 'brak (pusty diff)'}${zapisDiffu.uciety ? ' — PRZYCIETY do 300 KB, pliki spoza zrzutu dobierz osobno' : ''}`,
  '',
  '## Zmiany fazy', '', diffStat, ...pliki.map((p) => `- ${p.plik} — ${czegoDotyczy(p)}`), '',
  '## Profil stacku', '', profilStacku(a.projekt), '',
  '## Sygnaly diffu (pre-skan: miejsca, nie findingi)', '', sygnaly.map((t) => `- ${t.wzorzec}: ${t.plik}`).join('\n') || '- brak', '',
  '## Bramki domkniecia (ostatni przebieg)', '', blokBramek(plikBramek), '',
  '## Plan techniczny — sekcja fazy', '', zadanie.planFazy, '',
  '## Sledzenie wymagan — wiersze tej fazy', '', zadanie.wymagania, '',
  '## Reguly projektu (learned-patterns.md)', '', zadanie.reguly, '',
  '## Zadania fazy', '', zadanie.zadaniaFazy, '',
  '## Designerski kontekst zadania', '', zadanie.designerski, '',
].join('\n')
writeFileSync(sciezki.dossier, tresc)

const wynik = {
  diffStat,
  pliki: pliki.map((p) => ({ plik: p.plik, czegoDotyczy: czegoDotyczy(p) })),
  warstwy: warstwy(a.projekt, pliki, dodane),
  e2eCheckboxy: zadanie.e2eCheckboxy,
  figmaScreens: zadanie.figmaScreens,
  diffPlik: zapisDiffu.zapisany ? sciezki.diff : '',
  diffZapisany: zapisDiffu.zapisany,
  diffUciety: zapisDiffu.uciety,
  ctxPlik: sciezki.dossier,
  // writeFileSync rzuca przy nieudanym zapisie (kod 1) — tu plik juz jest.
  ctxZapisany: true,
  ctxZnaki: tresc.length,
  preSkan: sygnaly,
}
process.stdout.write(`${JSON.stringify(wynik)}\n`)
