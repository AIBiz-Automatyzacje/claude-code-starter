#!/usr/bin/env node
// Czekanie na recenzje bota CodeRabbit dla czubka pull requesta (PLAN-POPRAWY P18) — pod Monitor skilla /dev-pr, krok 2.
// Tylko odczyt GitHuba przez `gh`; niczego nie pisze w PR.
//
// Uzycie:
//   node .claude/scripts/pr/czekaj-na-bota.mjs [--pr <numer>] [--sha <oid>] [--limit-min 20] [--co-s 30]
//   bez --pr: PR biezacej galezi; bez --sha: headRefOid PR z pierwszego odpytania.
//
// Wynik: DOKLADNIE jedna linia JSON na stdout, potem koniec procesu (jedno zdarzenie Monitora):
//   { stan, powod, sha, minuty, pr }
//   stan: gotowa | blad | pauza | pominieta | pr-zamkniety | limit | blad-gh | blad-argumentow
// Bledy pojedynczych odpytan ida na stderr (nie sa zdarzeniami). Kod wyjscia: 0 = stan ustalony, 2 = zle argumenty.

import { execFile } from 'node:child_process'
import { setTimeout as spij } from 'node:timers/promises'
import { parseArgs, promisify } from 'node:util'

import { czekajNaBota } from './bot.mjs'

const KOD_ZLYCH_ARGUMENTOW = 2
const LIMIT_MIN_DOMYSLNY = 20
const CO_S_DOMYSLNIE = 30
const LIMIT_WYWOLANIA_GH_MS = 60_000

const wykonaj = promisify(execFile)

/** @param {string[]} argumenty */
async function gh(argumenty) {
  const { stdout } = await wykonaj('gh', argumenty, { timeout: LIMIT_WYWOLANIA_GH_MS, maxBuffer: 32 * 1024 * 1024 })
  return stdout
}

/**
 * Zrodlo odpytan przez `gh` dla repozytorium biezacego katalogu (`{owner}/{repo}` rozwiazuje gh).
 * @param {string | null} numer
 */
function zrodloGh(numer) {
  return {
    async pr() {
      const wynik = JSON.parse(await gh(['pr', 'view', ...(numer ? [numer] : []), '--json', 'number,state,headRefOid']))
      return { number: wynik.number, state: wynik.state, headRefOid: wynik.headRefOid }
    },
    /** @param {string} sha */
    async dataCommita(sha) {
      return (await gh(['api', `repos/{owner}/{repo}/commits/${sha}`, '--jq', '.commit.committer.date'])).trim()
    },
    /** @param {string} sha */
    async statusy(sha) {
      return JSON.parse(await gh(['api', `repos/{owner}/{repo}/commits/${sha}/statuses?per_page=100`]))
    },
    /** @param {number} nr */
    async komentarze(nr) {
      // --paginate z --jq daje jeden obiekt na linie — bez sklejania tablic stron.
      const linie = await gh(['api', '--paginate', `repos/{owner}/{repo}/issues/${nr}/comments?per_page=100`,
        '--jq', '.[] | {login: .user.login, updated_at, body}', '--compact-output'])
      return linie.split('\n').filter(Boolean).map((l) => JSON.parse(l))
    },
  }
}

/** @param {Record<string, unknown>} wynik */
function wypisz(wynik) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
}

/**
 * @param {string | undefined} tekst
 * @param {number} domyslnie
 */
function liczbaDodatnia(tekst, domyslnie) {
  if (tekst === undefined) return domyslnie
  const n = Number(tekst)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`oczekiwana liczba dodatnia, jest „${tekst}”`)
  return n
}

async function glowna() {
  /** @type {{ pr?: string, sha?: string, limitMin: number, coS: number }} */
  let op
  try {
    const { values } = parseArgs({
      options: {
        pr: { type: 'string' },
        sha: { type: 'string' },
        'limit-min': { type: 'string' },
        'co-s': { type: 'string' },
      },
    })
    if (values.pr !== undefined && !/^\d+$/.test(values.pr)) throw new Error(`--pr: oczekiwany numer, jest „${values.pr}”`)
    op = {
      pr: values.pr,
      sha: values.sha,
      limitMin: liczbaDodatnia(values['limit-min'], LIMIT_MIN_DOMYSLNY),
      coS: liczbaDodatnia(values['co-s'], CO_S_DOMYSLNIE),
    }
  } catch (e) {
    wypisz({ stan: 'blad-argumentow', powod: e instanceof Error ? e.message : String(e) })
    process.exitCode = KOD_ZLYCH_ARGUMENTOW
    return
  }
  const zrodlo = zrodloGh(op.pr ?? null)
  /** @type {number | null} */
  let numer = op.pr ? Number(op.pr) : null
  const wynik = await czekajNaBota({
    zrodlo: { ...zrodlo, pr: async () => { const pr = await zrodlo.pr(); numer = pr.number; return pr } },
    zegar: { teraz: () => Date.now(), spij: (ms) => spij(ms) },
    sha: op.sha ?? null,
    limitMin: op.limitMin,
    coS: op.coS,
    ostrzez: (tresc) => process.stderr.write(`czekaj-na-bota: ${tresc}\n`),
  })
  wypisz({ ...wynik, pr: numer })
}

await glowna()
