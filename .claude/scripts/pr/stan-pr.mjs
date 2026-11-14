#!/usr/bin/env node
// Stan pull requesta liczony ze zrodel trwalych: commitow PR, watkow i recenzji na GitHubie. Licznik tur i decyzje o watkach
// przezywaja dzieki temu koniec sesji (aa-exam PR #51), a bramka merge'a nie liczy watkow opisem dla modelu (aa-exam PR #48)
// i widzi, czy bot zrecenzowal czubek (piszemy_wirale PR #7: merge poprawki bez recenzji przy „Review rate limited”).
//
// Uzycie: node .claude/scripts/pr/stan-pr.mjs [--pr <numer>] [--projekt <katalog>]
// Wynik: jedna linia JSON { pr, czubek, baza, reviewDecision, tury, ostatniaTura, recenzjaCzubka, czekanieNaBota, watki, liczniki }
// albo { wyjatek }.
// Kod wyjscia: 0 = ok, 2 = zle argumenty, 3 = wyjatek. Tylko odczyt.

import { execFileSync, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { LIMIT_PLANU, LOGIN_BOTA, najnowszyStatus, statusZPrzebiegu } from './bot.mjs'
import { rozmiarPr } from './rozmiar.mjs'

const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const COMMIT_TURY = /^fix\(pr\): tura (\d+)\b/
const ZNACZNIK = /<!-- dev-pr:(\{[^\n]*?\}) -->/g
export const DECYZJE = /** @type {const} */ (['naprawione', 'odrzucone', 'operator'])
/** Ponizej tego ostatnia tura idzie do bramki bez dodatkowego review; aa-exam PR #51: +814 linii z regresja zapisu odpowiedzi. */
export const PROG_LINII_TURY = 200
const PLIK_TESTOWY = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[^/]+$/
const PLIK_POZA_KODEM = /^(docs\/|\.claude\/)|\.md$/
const PLIK_RYZYKOWNY = /auth|login|sesj|session|migrac|migrat|permission|uprawnien|member|platn|payment/i

/**
 * Znacznik decyzji na koncu odpowiedzi w watku. Komentarz HTML nie zaslania tresci, a przezywa koniec sesji.
 * @param {{ decyzja: typeof DECYZJE[number], tura?: number, sha?: string }} wpis
 */
export function znacznikDecyzji(wpis) {
  return `<!-- dev-pr:${JSON.stringify(wpis)} -->`
}

/**
 * Ostatni znacznik decyzji w tresci.
 * @param {string} tresc
 * @returns {{ decyzja: string, sha?: string } | null}
 */
export function odczytajZnacznik(tresc) {
  const trafienia = [...String(tresc).matchAll(ZNACZNIK)]
  if (!trafienia.length) return null
  try {
    const wpis = JSON.parse(trafienia[trafienia.length - 1][1])
    return DECYZJE.includes(wpis?.decyzja) ? wpis : null
  } catch {
    return null
  }
}

/**
 * @typedef {{ author?: { login?: string } | null, body: string }} KomentarzWatku
 * @typedef {{ id: string, isResolved: boolean, path?: string | null, line?: number | null, comments: { nodes: KomentarzWatku[] } }} Watek
 * @typedef {'rozstrzygniety' | 'naprawiony-czeka-na-bota' | 'otwarty'} StanWatku
 */

/**
 * Stan nierozwiazanego watku. Odmowa i decyzja operatora obowiazuja takze po grzecznosciowej odpowiedzi bota: nowy zarzut w tym
 * samym watku rozpoznaje klasyfikator etapu zbierz. Poprawka czeka na bota tylko wtedy, gdy jest w historii czubka i bot jeszcze
 * nie odpowiedzial; po jego odpowiedzi watek wraca do oceny (potwierdzenie albo podtrzymany zarzut).
 * @param {Watek} watek
 * @param {(sha: string) => boolean} jestPrzodkiem
 * @returns {{ stan: StanWatku, decyzja: string | null, botOdpowiedzial: boolean }}
 */
export function stanWatku(watek, jestPrzodkiem) {
  const komentarze = watek.comments?.nodes ?? []
  let indeks = -1
  /** @type {{ decyzja: string, sha?: string } | null} */
  let wpis = null
  komentarze.forEach((k, i) => {
    const znaleziony = odczytajZnacznik(k.body)
    if (znaleziony) { indeks = i; wpis = znaleziony }
  })
  if (!wpis) return { stan: 'otwarty', decyzja: null, botOdpowiedzial: false }
  const decyzja = /** @type {{ decyzja: string, sha?: string }} */ (wpis)
  const botOdpowiedzial = komentarze.slice(indeks + 1).some((k) => LOGIN_BOTA.test(k.author?.login ?? ''))
  if (decyzja.decyzja !== 'naprawione') return { stan: 'rozstrzygniety', decyzja: decyzja.decyzja, botOdpowiedzial }
  const czeka = !botOdpowiedzial && !!decyzja.sha && jestPrzodkiem(decyzja.sha)
  return { stan: czeka ? 'naprawiony-czeka-na-bota' : 'otwarty', decyzja: decyzja.decyzja, botOdpowiedzial }
}

/**
 * Liczba tur napraw z tematow commitow PR; rebase i nowa sesja jej nie zeruja.
 * @param {string[]} tematy
 */
export function liczbaTur(tematy) {
  return tematy.reduce((max, t) => Math.max(max, Number(COMMIT_TURY.exec(t)?.[1] ?? 0)), 0)
}

/**
 * Czy bot widzial czubek: check-run czubka bez limitu planu, recenzja czubka albo od ostatniej recenzji tylko pliki poza filtrami.
 * @param {{ statusy: import('./bot.mjs').Status[], recenzjaCzubka: boolean, plikiPoRecenzji: number | null }} fakty
 * @returns {{ ok: boolean, powod: string }}
 */
export function ocenaRecenzjiCzubka({ statusy, recenzjaCzubka, plikiPoRecenzji }) {
  const status = najnowszyStatus(statusy)
  if (status && (status.state === 'rate-limit' || LIMIT_PLANU.test(status.description ?? ''))) {
    return { ok: false, powod: `bot wyczerpal limit planu i nie zrecenzowal czubka: „${status.description ?? ''}”` }
  }
  if (recenzjaCzubka) return { ok: true, powod: 'recenzja bota dotyczy czubka' }
  if (status?.state === 'pending') return { ok: false, powod: 'recenzja bota dla czubka jeszcze trwa' }
  if (status?.state === 'success') return { ok: true, powod: 'bot zakonczyl check-run czubka bez uwag' }
  if (plikiPoRecenzji === 0) return { ok: true, powod: 'od ostatniej recenzji tylko pliki poza filtrami bota' }
  return { ok: false, powod: status ? `status bota dla czubka: ${status.state}` : 'brak recenzji i check-runu bota dla czubka' }
}

/** Punkt 64 (vibersi PR #24): ile minut po recenzji czubka bramka czeka na odpowiedz bota w watku z nasza poprawka (decyzja operatora). */
export const LIMIT_CZEKANIA_NA_BOTA_MIN = 10

/**
 * Czy merge ma czekac na ocene poprawki przez bota. Bot odrzucil poprawke 4 min po swojej recenzji czubka, a bramka sprawdzala stan
 * kilkanascie sekund pozniej: wczesniej przepuscilaby niepelna poprawke. Czekamy najwyzej limit od konca recenzji czubka, potem
 * merge idzie z adnotacja w raporcie (bot czasem nie odpowiada wcale: aa-exam PR #48, #51).
 * @param {{ czekajace: string[], koniecRecenzji: string | null, teraz: number, limitMin?: number }} fakty
 * @returns {{ czekaj: boolean, watki: string[], resztaMin: number, poLimicie: boolean, powod: string }}
 */
export function ocenaCzekaniaNaBota({ czekajace, koniecRecenzji, teraz, limitMin = LIMIT_CZEKANIA_NA_BOTA_MIN }) {
  if (!czekajace.length) return { czekaj: false, watki: [], resztaMin: 0, poLimicie: false, powod: 'brak poprawek czekajacych na bota' }
  const koniec = koniecRecenzji ? Date.parse(koniecRecenzji) : NaN
  if (Number.isNaN(koniec)) return { czekaj: true, watki: czekajace, resztaMin: limitMin, poLimicie: false, powod: 'bot jeszcze nie zrecenzowal czubka z poprawka' }
  const minelo = (teraz - koniec) / 60_000
  if (minelo < limitMin) {
    const reszta = Math.max(1, Math.ceil(limitMin - minelo))
    return { czekaj: true, watki: czekajace, resztaMin: reszta, poLimicie: false, powod: `${czekajace.length} poprawek czeka na odpowiedz bota, jeszcze ${reszta} min z ${limitMin}` }
  }
  return { czekaj: false, watki: czekajace, resztaMin: 0, poLimicie: true, powod: `bot nie odpowiedzial na poprawke w ${limitMin} min od recenzji czubka: ${czekajace.join(', ')}` }
}

/**
 * Koniec recenzji czubka: najpozniejsza z recenzji bota dla czubka i zakonczonego check-runu bota (bez uwag recenzji nie ma).
 * @param {{ submitted_at?: string, commit_id: string }[]} recenzje @param {import('./bot.mjs').Status | null} status @param {string} czubek
 * @returns {string | null}
 */
export function koniecRecenzjiCzubka(recenzje, status, czubek) {
  const czasy = recenzje.filter((r) => r.commit_id === czubek && r.submitted_at).map((r) => /** @type {string} */ (r.submitted_at))
  if (status && status.state === 'success' && status.created_at) czasy.push(status.created_at)
  return czasy.sort().at(-1) ?? null
}

/**
 * Czy ostatnia tura wymaga krotkiego review przed bramka: duzo kodu poza testami albo pliki dostepu, sesji i migracji.
 * @param {{ plik: string, dodane: number }[]} pliki
 * @returns {{ dodane: number, plikiKodu: string[], ryzykowne: string[], wymagaReview: boolean }}
 */
export function ocenaOstatniejTury(pliki) {
  const kod = pliki.filter((p) => !PLIK_TESTOWY.test(p.plik) && !PLIK_POZA_KODEM.test(p.plik))
  const dodane = kod.reduce((s, p) => s + p.dodane, 0)
  const ryzykowne = kod.map((p) => p.plik).filter((p) => PLIK_RYZYKOWNY.test(p))
  return { dodane, plikiKodu: kod.map((p) => p.plik), ryzykowne, wymagaReview: dodane > PROG_LINII_TURY || ryzykowne.length > 0 }
}

const ZAPYTANIE_WATKOW = `query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
  reviewThreads(first:100){nodes{id isResolved path line comments(first:50){nodes{author{login} body}}}}}}}`

/** @param {string} projekt @param {string[]} argumenty */
const gh = (projekt, argumenty) => execFileSync('gh', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** @param {string} projekt @param {string} sha @returns {{ plik: string, dodane: number }[]} */
function plikiCommitu(projekt, sha) {
  const wynik = spawnSync('git', ['show', '--numstat', '--format=', sha], { cwd: projekt, encoding: 'utf8' })
  if (wynik.status !== 0) return []
  return wynik.stdout.split('\n').filter(Boolean).map((l) => l.split('\t')).map(([d, , plik]) => ({ plik, dodane: Number(d) || 0 }))
}

/** @param {string} projekt @param {string} sha @param {string} czubek */
function jestPrzodkiemCzubka(projekt, sha, czubek) {
  return spawnSync('git', ['merge-base', '--is-ancestor', sha, czubek], { cwd: projekt }).status === 0
}

/**
 * @param {string} projekt
 * @param {string | undefined} numer
 */
export function stanPr(projekt, numer) {
  const pr = JSON.parse(gh(projekt, ['pr', 'view', ...(numer ? [numer] : []), '--json', 'number,headRefOid,baseRefName,reviewDecision,commits']))
  const repo = JSON.parse(gh(projekt, ['repo', 'view', '--json', 'owner,name']))
  const graf = JSON.parse(gh(projekt, ['api', 'graphql', '-F', `owner=${repo.owner.login}`, '-F', `repo=${repo.name}`, '-F', `pr=${pr.number}`, '-f', `query=${ZAPYTANIE_WATKOW}`]))
  const czubek = pr.headRefOid
  const przebiegi = JSON.parse(gh(projekt, ['api', `repos/{owner}/{repo}/commits/${czubek}/check-runs`, '--jq', '.check_runs']))
  const statusyCommita = JSON.parse(gh(projekt, ['api', `repos/{owner}/{repo}/commits/${czubek}/status`, '--jq', '.statuses']))
  const recenzje = gh(projekt, ['api', '--paginate', `repos/{owner}/{repo}/pulls/${pr.number}/reviews?per_page=100`, '--jq', '.[] | {login: .user.login, commit_id, submitted_at}'])
    .split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => LOGIN_BOTA.test(r.login))
  const statusy = [...statusyCommita, ...przebiegi.map(statusZPrzebiegu).filter((/** @type {unknown} */ s) => s !== null)]
  const ostatnia = recenzje.filter((r) => jestPrzodkiemCzubka(projekt, r.commit_id, czubek)).at(-1)
  const plikiPoRecenzji = ostatnia ? rozmiarPr(projekt, ostatnia.commit_id, czubek).doRecenzji : null
  const tematy = pr.commits.map((/** @type {{ messageHeadline: string }} */ c) => c.messageHeadline)
  const commitTury = pr.commits.filter((/** @type {{ messageHeadline: string }} */ c) => COMMIT_TURY.test(c.messageHeadline)).at(-1)
  /** @type {Watek[]} */
  const otwarte = graf.data.repository.pullRequest.reviewThreads.nodes.filter((/** @type {Watek} */ w) => !w.isResolved)
  const watki = otwarte.map((/** @type {Watek} */ w) => ({
    id: w.id, plik: `${w.path ?? '(recenzja ogolna)'}${w.line ? `:${w.line}` : ''}`,
    ...stanWatku(w, (sha) => jestPrzodkiemCzubka(projekt, sha, czubek)),
  }))
  const czekanieNaBota = ocenaCzekaniaNaBota({
    czekajace: watki.filter((w) => w.stan === 'naprawiony-czeka-na-bota').map((w) => w.plik),
    koniecRecenzji: koniecRecenzjiCzubka(recenzje, najnowszyStatus(statusy), czubek),
    teraz: Date.now(),
  })
  return {
    pr: pr.number, czubek, baza: pr.baseRefName, reviewDecision: pr.reviewDecision ?? null,
    tury: liczbaTur(tematy),
    ostatniaTura: commitTury ? { sha: commitTury.oid, ...ocenaOstatniejTury(plikiCommitu(projekt, commitTury.oid)) } : null,
    recenzjaCzubka: ocenaRecenzjiCzubka({ statusy, recenzjaCzubka: recenzje.some((r) => r.commit_id === czubek), plikiPoRecenzji }),
    czekanieNaBota,
    watki,
    liczniki: {
      otwarty: watki.filter((w) => w.stan === 'otwarty').length,
      rozstrzygniety: watki.filter((w) => w.stan === 'rozstrzygniety').length,
      'naprawiony-czeka-na-bota': watki.filter((w) => w.stan === 'naprawiony-czeka-na-bota').length,
    },
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ pr?: string, projekt?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { pr: { type: 'string' }, projekt: { type: 'string' } } }).values
  } catch (blad) {
    process.stderr.write(`stan-pr: ${blad instanceof Error ? blad.message : String(blad)}\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    process.stdout.write(`${JSON.stringify(stanPr(o.projekt ?? process.cwd(), o.pr))}\n`)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
