#!/usr/bin/env node
// Czekanie na recenzje bota CodeRabbit dla czubka pull requesta (PLAN-POPRAWY P18) — pod Monitor skilla /dev-pr, krok 2.
// Tylko odczyt GitHuba przez `gh`; niczego nie pisze w PR.
//
// Uzycie:
//   node .claude/scripts/pr/czekaj-na-bota.mjs [--pr <numer>] [--sha <oid>] [--limit-min 20, najwyzej 25] [--co-s 30]
//   bez --pr: PR biezacej galezi; bez --sha: headRefOid PR z pierwszego odpytania.
//
// Wynik: DOKLADNIE jedna linia JSON na stdout, potem koniec procesu (jedno zdarzenie Monitora):
//   { stan, powod, sha, minuty, pr, recenzja? }
//   stan: gotowa | blad | pauza | pominieta | pr-zamkniety | limit | blad-gh | blad-argumentow
//   recenzja (tylko przy gotowa): jest — recenzja bota z commit_id = czubek; brak — 2 min po statusie success jej nie ma (P19)
// Bledy pojedynczych odpytan ida na stderr (nie sa zdarzeniami). Kod wyjscia: 0 = stan ustalony, 2 = zle argumenty.

import { execFile } from 'node:child_process'
import { setTimeout as spij } from 'node:timers/promises'
import { parseArgs, promisify } from 'node:util'

import { czekajNaBota, statusZPrzebiegu } from './bot.mjs'

const KOD_ZLYCH_ARGUMENTOW = 2
const LIMIT_MIN_DOMYSLNY = 20
// Monitor zyje najwyzej 30 min: limit + ostatnie odpytanie (do 4 wywolan gh po 30 s) musza sie zmiescic.
const LIMIT_MIN_NAJWYZEJ = 25
const CO_S_DOMYSLNIE = 30
const LIMIT_WYWOLANIA_GH_MS = 30_000

const SHA = /^[0-9a-f]{40}$/

const wykonaj = promisify(execFile)

/** @param {string[]} argumenty */
async function gh(argumenty) {
  try {
    const { stdout } = await wykonaj('gh', argumenty, { timeout: LIMIT_WYWOLANIA_GH_MS, maxBuffer: 32 * 1024 * 1024 })
    return stdout
  } catch (e) {
    // Przyczyna siedzi w stderr gh (autoryzacja, brak PR, 404) — komunikat execFile podaje tylko polecenie.
    const stderr = String(/** @type {{ stderr?: unknown }} */ (e).stderr ?? '').trim().split('\n')[0]
    throw new Error(`gh ${argumenty.slice(0, 2).join(' ')}: ${stderr || (e instanceof Error ? e.message : String(e))}`, { cause: e })
  }
}

/**
 * Zrodlo odpytan przez `gh` dla repozytorium biezacego katalogu (`{owner}/{repo}` rozwiazuje gh).
 * @param {string | null} numer
 */
function zrodloGh(numer) {
  return {
    async pr() {
      const wynik = JSON.parse(await gh(['pr', 'view', ...(numer ? [numer] : []), '--json', 'number,state,headRefOid']))
      if (!Number.isInteger(wynik?.number) || typeof wynik.state !== 'string' || !SHA.test(wynik.headRefOid)) {
        throw new Error(`gh pr view: nieoczekiwany ksztalt odpowiedzi ${JSON.stringify(wynik).slice(0, 200)}`)
      }
      return { number: wynik.number, state: wynik.state, headRefOid: wynik.headRefOid }
    },
    /** @param {string} sha */
    async dataCommita(sha) {
      return (await gh(['api', `repos/{owner}/{repo}/commits/${sha}`, '--jq', '.commit.committer.date'])).trim()
    },
    /** @param {string} sha */
    async statusy(sha) {
      // Stan laczny: najnowszy wpis na kontekst — bez stronicowania historii wszystkich kontekstow.
      const statusy = JSON.parse(await gh(['api', `repos/{owner}/{repo}/commits/${sha}/status`, '--jq', '.statuses']))
      if (!Array.isArray(statusy)) throw new Error('gh api status: brak tablicy statuses')
      // Od vibersi PR #14 CodeRabbit raportuje check-run zamiast statusu — oba zrodla w jednej liscie statusow.
      const przebiegi = JSON.parse(await gh(['api', `repos/{owner}/{repo}/commits/${sha}/check-runs`, '--jq', '.check_runs']))
      if (!Array.isArray(przebiegi)) throw new Error('gh api check-runs: brak tablicy check_runs')
      return [...statusy, ...przebiegi.map(statusZPrzebiegu).filter((s) => s !== null)]
    },
    /** @param {number} nr */
    async komentarze(nr) {
      // --paginate z --jq daje jeden obiekt na linie (wyjscie nie jest terminalem) — bez sklejania tablic stron.
      const linie = await gh(['api', '--paginate', `repos/{owner}/{repo}/issues/${nr}/comments?per_page=100`,
        '--jq', '.[] | {login: .user.login, updated_at, body}'])
      return linie.split('\n').filter(Boolean).map((l) => JSON.parse(l))
    },
    /** @param {number} nr */
    async recenzje(nr) {
      const linie = await gh(['api', '--paginate', `repos/{owner}/{repo}/pulls/${nr}/reviews?per_page=100`,
        '--jq', '.[] | {login: .user.login, commit_id, submitted_at}'])
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
    if (values.sha !== undefined && !SHA.test(values.sha)) throw new Error(`--sha: oczekiwany pelny SHA (40 znakow hex), jest „${values.sha}”`)
    if (Number(values['limit-min'] ?? 0) > LIMIT_MIN_NAJWYZEJ) {
      throw new Error(`--limit-min: najwyzej ${LIMIT_MIN_NAJWYZEJ} na wywolanie (Monitor zyje 30 min), jest ${values['limit-min']}`)
    }
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
