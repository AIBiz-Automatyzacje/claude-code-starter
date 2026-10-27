#!/usr/bin/env node
// Czesci PR zadania (P20 S2, PR wieloczesciowy): rozmiar kazdej czesci na commitach konca faz, bez worktree.
// vibersi etap 3: archiwizacja zmierzyla 172 pliki do recenzji (> 150, limit bota) i radzila podzial „per katalog”, nierealny
// dla jednej galezi; operator podzielil PR recznie po fazie 3 (cięcie 909f669 = kontrola diffu naprawczego fazy 3: PR #3
// 93 pliki, PR #4 121). Koniec fazy N = baza fazy N+1 ze stanu autopilota (HEAD przed jej execute), a bez niej ostatni commit
// fazy po temacie: kontrola diffu naprawczego, poprawki po review albo commit execute.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   czesci.mjs --zadanie <docs/completed/<zadanie> | docs/active/<zadanie>> [--baza <ref>]
// Ciecia: sekcja „## Części PR” planu technicznego (linia „Plan techniczny:” w <zadanie>-plan.md); bez sekcji albo gdy czesc
// z planu ma >= 150 plikow — ciecie z pomiaru na koncach faz (najmniej czesci, kazda < 150, najmniejsza najwieksza).
// Wynik: JSON w jednej linii { ok, zrodlo, baza, czubek, fazy: [{faza, koniec}], czesci: [{czesc, fazy, od, do, doRecenzji, wszystkie}],
//   ciecia, plan, uwaga }. ok = jeden PR <= 150 albo kazda czesc < 150. Kod wyjscia: 0 = ok, 1 = czesc za duza, 2 = zle argumenty, 3 = wyjatek.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { podzialFaz, sekcjaCzesci } from '../plan/czesci-pr.mjs'
import { PROG_PLIKOW_PR, rozmiarPr } from './rozmiar.mjs'

const KOD_ZA_DUZA = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3

/**
 * @typedef {{ sha: string, temat: string }} Commit
 * @typedef {{ faza: number, koniec: string }} KoniecFazy
 * @typedef {{ czesc: number, fazy: string, od: string, do: string, doRecenzji: number, wszystkie: number }} Czesc
 */

/** @param {string} projekt @param {string[]} argumenty @returns {string} */
function git(projekt, argumenty) {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (w.status !== 0) throw new Error(`git ${argumenty.join(' ')}: ${(w.stderr ?? '').trim()}`)
  return w.stdout ?? ''
}

/** @param {string} s @returns {string} */
const doRegexu = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Ostatni commit fazy w jej zakresie: kontrola diffu naprawczego fazy N, potem poprawki po review fazy N, potem commit
 * execute (`feat|fix|refactor(<zadanie>):`). Commity docs (stan po STOP, archiwum) nie koncza fazy.
 * @param {Commit[]} commity zakresu fazy, od najstarszego
 * @param {string} zadanie
 * @param {number} faza
 * @returns {string | null}
 */
export function koniecFazy(commity, zadanie, faza) {
  const z = doRegexu(zadanie)
  const wzorce = [
    new RegExp(`^fix\\(${z}\\): kontrola diffu naprawczego fazy ${faza}$`),
    new RegExp(`^fix\\(${z}\\): poprawki po review fazy ${faza}$`),
    new RegExp(`^(?:feat|fix|refactor)\\(${z}\\): `),
  ]
  for (const wzor of wzorce) {
    const trafione = commity.filter((c) => wzor.test(c.temat))
    if (trafione.length) return trafione.at(-1)?.sha ?? null
  }
  return null
}

/** @param {string} projekt @param {string} przodek @param {string} potomek @returns {boolean} */
function jestPrzodkiem(projekt, przodek, potomek) {
  return spawnSync('git', ['merge-base', '--is-ancestor', przodek, potomek], { cwd: projekt }).status === 0
}

/**
 * Konce faz ze stanu autopilota. Faza nieostatnia konczy sie na bazie nastepnej (`fazy[N+1].baza` = HEAD przed execute fazy
 * N+1): to stan po review, fixie i recznej naprawie operatora po STOP-ie, wiec takze po commitach spoza tematow pipeline'u.
 * Bez bazy nastepnej (stan sprzed P13, null po bledzie zapisu) i dla ostatniej fazy — ostatni commit fazy po temacie
 * (`koniecFazy`) w zakresie od jej bazy (albo konca poprzedniej) do czubka. Faza bez commita (0 IU) konczy sie tam, gdzie
 * poprzednia — z uwaga, bez wyjatku.
 * @param {string} projekt
 * @param {{ numer: number, baza?: string | null }[]} fazy
 * @param {{ zadanie: string, baza: string, czubek: string }} we
 * @returns {{ konce: KoniecFazy[], uwagi: string[] }}
 */
function konceFaz(projekt, fazy, { zadanie, baza, czubek }) {
  /** @type {KoniecFazy[]} */
  const konce = []
  /** @type {string[]} */
  const uwagi = []
  fazy.forEach((f, i) => {
    const poprzedni = konce.at(-1)?.koniec ?? baza
    const nastepna = fazy[i + 1]?.baza
    if (nastepna && jestPrzodkiem(projekt, nastepna, czubek)) {
      konce.push({ faza: f.numer, koniec: git(projekt, ['rev-parse', nastepna]).trim() })
      return
    }
    const od = f.baza && jestPrzodkiem(projekt, f.baza, czubek) ? f.baza : poprzedni
    const commity = git(projekt, ['log', '--reverse', '--format=%H%x09%s', `${od}..${czubek}`]).split('\n').filter(Boolean)
      .map((l) => ({ sha: l.slice(0, l.indexOf('\t')), temat: l.slice(l.indexOf('\t') + 1) }))
    const koniec = koniecFazy(commity, zadanie, f.numer)
    if (!koniec) uwagi.push(`faza ${f.numer}: bez commita fazy — koniec jak poprzedniej (${poprzedni.slice(0, 12)})`)
    else if (i < fazy.length - 1) uwagi.push(`faza ${f.numer}: koniec z tematu commita (brak bazy fazy ${fazy[i + 1].numer} w historii)`)
    konce.push({ faza: f.numer, koniec: koniec ?? poprzedni })
  })
  return { konce, uwagi }
}

/**
 * Ciecia z planu technicznego zadania: numery faz konczacych czesci poza ostatnia. Brak planu albo sekcji = null.
 * @param {string} projekt
 * @param {string} katalog
 * @param {string} zadanie
 * @returns {number[] | null}
 */
function cieciaPlanu(projekt, katalog, zadanie) {
  const plikZadania = join(projekt, katalog, `${zadanie}-plan.md`)
  if (!existsSync(plikZadania)) return null
  const sciezka = /^Plan techniczny: `([^`]+)`/m.exec(readFileSync(plikZadania, 'utf8'))?.[1]
  if (!sciezka || !existsSync(join(projekt, sciezka))) return null
  const sekcja = sekcjaCzesci(readFileSync(join(projekt, sciezka), 'utf8'))
  // Sekcja z bledami zapisu (sprawdz ja odrzucil) nie wyznacza ciecia — pomiar.
  if (!sekcja || sekcja.problemy.length || !sekcja.czesci.length) return null
  return sekcja.czesci.slice(0, -1).map((c) => c.do)
}

/**
 * Czesci dla ciec (fazy konczace czesci): czesc i = diff od konca poprzedniej (albo bazy) do konca swojej (ostatnia do czubka).
 * @param {{ projekt: string, baza: string, czubek: string, konce: KoniecFazy[], ciecia: number[] }} we
 * @returns {Czesc[]}
 */
function zmierz({ projekt, baza, czubek, konce, ciecia }) {
  const granice = [...ciecia, konce.at(-1)?.faza ?? 0]
  let od = baza
  let pierwsza = konce[0]?.faza ?? 1
  return granice.map((g, i) => {
    const ostatnia = i === granice.length - 1
    const doSha = ostatnia ? czubek : konce.find((k) => k.faza === g)?.koniec ?? czubek
    const r = rozmiarPr(projekt, od, doSha)
    const czesc = { czesc: i + 1, fazy: pierwsza === g ? `${g}` : `${pierwsza}–${g}`, od, do: r.czubek, doRecenzji: r.doRecenzji, wszystkie: r.wszystkie }
    od = r.czubek
    pierwsza = g + 1
    return czesc
  })
}

/**
 * Jeden PR do progu wlacznie (jak bramka archiwizacji P19 i plan bez sekcji); czesc PR wieloczesciowego ponizej progu.
 * @param {Czesc} c @param {number} liczba czesci @returns {boolean}
 */
const czescMiesci = (c, liczba) => (liczba === 1 ? c.doRecenzji <= PROG_PLIKOW_PR : c.doRecenzji < PROG_PLIKOW_PR)

/**
 * Ciecia z pomiaru: `podzialFaz` (najmniej czesci < progu, najmniejsza najwieksza) na diffach miedzy koncami faz; ostatnia
 * czesc konczy sie na czubku (archiwum i commity po fazach). Bez podzialu — kazda faza osobno (widac, ktora przekracza).
 * @param {string} projekt @param {string} baza @param {string} czubek @param {KoniecFazy[]} konce
 * @returns {number[]} numery faz konczacych czesci poza ostatnia
 */
function cieciaPomiaru(projekt, baza, czubek, konce) {
  const n = konce.length
  const sha = (/** @type {number} */ i) => (i === n - 1 ? czubek : konce[i].koniec)
  const ciecia = podzialFaz(n, (od, doFazy) => rozmiarPr(projekt, od ? konce[od - 1].koniec : baza, sha(doFazy)).doRecenzji)
  return (ciecia ?? konce.slice(0, -1).map((_, i) => i)).map((i) => konce[i].faza)
}

/**
 * @param {string} projekt
 * @param {string} katalog katalog zadania wzgledem projektu
 * @param {string} [bazaArg]
 */
export function czesciZadania(projekt, katalog, bazaArg) {
  const zadanie = katalog.replace(/\/+$/, '').split('/').pop() ?? ''
  const plikStanu = join(projekt, katalog, '.autopilot-state.json')
  if (!existsSync(plikStanu)) throw new Error(`brak ${katalog}/.autopilot-state.json — konce faz liczone z baz faz autopilota`)
  const stan = JSON.parse(readFileSync(plikStanu, 'utf8'))
  const fazy = Array.isArray(stan.fazy) ? stan.fazy : []
  if (!fazy.length) throw new Error('stan autopilota bez faz')
  const czubek = git(projekt, ['rev-parse', 'HEAD']).trim()
  const baza = bazaArg ?? rozmiarPr(projekt, undefined, czubek).baza
  const { konce, uwagi } = konceFaz(projekt, fazy, { zadanie, baza, czubek })
  const plan = cieciaPlanu(projekt, katalog, zadanie)
  const wszystkie = zmierz({ projekt, baza, czubek, konce, ciecia: [] })
  /** @type {{ zrodlo: string, ciecia: number[] }} */
  let wybor = { zrodlo: 'jedna', ciecia: [] }
  /** @type {string | null} */
  let uwaga = uwagi.length ? uwagi.join('; ') : null
  const dopisz = (/** @type {string} */ u) => { uwaga = uwaga ? `${uwaga}; ${u}` : u }
  if (plan && plan.length && wszystkie[0].doRecenzji <= PROG_PLIKOW_PR) {
    // Plan przewidzial czesci, a caly diff miesci sie w jednym PR — dzielenie tylko dokladaloby tur bota.
    dopisz(`plan przewidywał części, a całość ma ${wszystkie[0].doRecenzji} plików do recenzji — jeden PR`)
  } else if (plan && plan.length) {
    const zPlanu = zmierz({ projekt, baza, czubek, konce, ciecia: plan })
    if (zPlanu.every((c) => c.doRecenzji < PROG_PLIKOW_PR)) wybor = { zrodlo: 'plan', ciecia: plan }
    else {
      const za = zPlanu.filter((c) => c.doRecenzji >= PROG_PLIKOW_PR).map((c) => `część ${c.czesc} (fazy ${c.fazy}) ${c.doRecenzji}`)
      dopisz(`cięcie z planu daje część >= ${PROG_PLIKOW_PR}: ${za.join(', ')} — inny punkt cięcia`)
      wybor = { zrodlo: 'pomiar', ciecia: cieciaPomiaru(projekt, baza, czubek, konce) }
    }
  } else if (wszystkie[0].doRecenzji > PROG_PLIKOW_PR) {
    wybor = { zrodlo: 'pomiar', ciecia: cieciaPomiaru(projekt, baza, czubek, konce) }
  }
  const czesci = wybor.ciecia.length ? zmierz({ projekt, baza, czubek, konce, ciecia: wybor.ciecia }) : wszystkie
  const zaDuze = czesci.filter((c) => !czescMiesci(c, czesci.length))
  const ok = !zaDuze.length
  if (!ok) {
    const za = zaDuze.map((c) => `część ${c.czesc} (fazy ${c.fazy}) ${c.doRecenzji}`)
    dopisz(`bez cięcia na granicy faz poniżej ${PROG_PLIKOW_PR}: ${za.join(', ')} — faza powyżej limitu bota, dziel zadanie w planowaniu`)
  }
  return {
    ok, zrodlo: wybor.zrodlo, baza, czubek, fazy: konce, czesci, ciecia: czesci.slice(0, -1).map((c) => c.do), plan, uwaga,
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, zadanie?: string, baza?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, zadanie: { type: 'string' }, baza: { type: 'string' } } }).values
    if (!o.zadanie) throw new Error('brak --zadanie')
  } catch (blad) {
    process.stderr.write(`czesci: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: czesci.mjs --zadanie <katalog zadania> [--baza <ref>] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    const w = czesciZadania(o.projekt ?? process.cwd(), o.zadanie, o.baza)
    process.stdout.write(`${JSON.stringify(w)}\n`)
    process.exit(w.ok ? 0 : KOD_ZA_DUZA)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
