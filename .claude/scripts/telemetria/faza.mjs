// Rekordy `faza` telemetrii (d5-telemetria-rekord.txt §2, §7, §11): raport fazy z wyniku runu + agregacja agentow.

import { sekundyAgentow, sumaKosztu } from './run.mjs'

/** @typedef {import('./git.mjs').ZmianyCommitow} ZmianyCommitow */
/** @typedef {import('./agent.mjs').WynikJournala} WynikJournala */

/**
 * Minimum rekordu agenta, ktore czyta agregacja fazy.
 * @typedef {import('./run.mjs').KosztAgenta & { id: string, rola: string | null, faza: number | null,
 *   klasa_roli: string | null, findingi: { p1: number, p2: number, p3: number } | null }} AgentFazy
 */

// Skrot `e2eSync` (przeniesiony z dev-autopilot-wf.js, audyt 2026-09-06 N6): pelny raport agenta db-sync
// zostaje w wyniku runu (plik harnessu); do telemetrii idzie status i zdanie — w JSONL tekst zajmowal 35–45% wpisu.
export const E2E_SYNC_LIMIT_TELEMETRII = 200

/**
 * @template T
 * @param {T | string} tekst
 * @returns {T | string}
 */
export function skrotE2eSync(tekst) {
  if (typeof tekst !== 'string' || tekst.length <= E2E_SYNC_LIMIT_TELEMETRII) return tekst
  return `${tekst.slice(0, E2E_SYNC_LIMIT_TELEMETRII).trimEnd()}… [uciete: ${tekst.length} znakow, pelna tresc w logu runu]`
}

/** @typedef {'execute' | 'review' | 'sceptycy' | 'mechanika_review' | 'fix' | 'orkiestracja'} Etap */

// Jedno jawne grupowanie etapow fazy (PANEL-WEJSCIE §12: raport ma jedno grupowanie i nim przelicza punkt odniesienia).
// To samo co w d5r_koszt_output.py §2 — udzialy z telemetrii sa wprost porownywalne z analiza.
const ETAPY_ROL = {
  execute: ['build', 'planner', 'domkniecie', 'warmup:vitest'],
  mechanika_review: ['kontekst:diff', 'dedup:semantyczny', 'scribe'],
  orkiestracja: ['stan:zapis', 'bootstrap', 'telemetria', 'stop', 'e2e:precheck', 'e2e:env-up', 'e2e:env-down', 'e2e:db-sync',
    'walidacja-koncowa', 'compound', 'compound-refresh', 'complete', 'smoke-operatora'],
}

/**
 * @param {string | null} rola
 * @returns {Etap | null}
 */
export function etapRoli(rola) {
  if (!rola) return null
  if (rola.startsWith('review:')) return 'review'
  if (rola.startsWith('verify')) return 'sceptycy'
  if (rola.startsWith('fix') || rola === 'zwin-do-poprawy') return 'fix'
  if (ETAPY_ROL.execute.includes(rola)) return 'execute'
  if (ETAPY_ROL.mechanika_review.includes(rola)) return 'mechanika_review'
  if (rola === 'stop:commit-artefaktow' || ETAPY_ROL.orkiestracja.includes(rola)) return 'orkiestracja'
  return null
}

const RE_HASH = /^[0-9a-f]{7,40}$/

/** @param {unknown} x @returns {Record<string, unknown>} */
function obiekt(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : {}
}
/** @param {unknown} x @returns {number | null} */
const liczbaLubNull = (x) => (typeof x === 'number' ? x : null)

/** @param {AgentFazy[]} agenci */
function kosztFazy(agenci) {
  /** @type {Record<Etap, number>} */
  const perEtap = { execute: 0, review: 0, sceptycy: 0, mechanika_review: 0, fix: 0, orkiestracja: 0 }
  for (const a of agenci) {
    const etap = etapRoli(a.rola)
    if (etap) perEtap[etap] += a.koszt_jedn
  }
  const s = sumaKosztu(agenci)
  return { agentow: s.agentow, tur: s.tur, jedn: s.jedn, per_etap: perEtap }
}

/** @param {AgentFazy[]} agenci */
function findingiPerOs(agenci) {
  /** @type {Record<string, { p1: number, p2: number, p3: number }>} */
  const perOs = {}
  for (const a of agenci) {
    if (!a.findingi || !a.rola?.startsWith('review:')) continue
    const os = a.rola.slice('review:'.length)
    const s = (perOs[os] ??= { p1: 0, p2: 0, p3: 0 })
    s.p1 += a.findingi.p1; s.p2 += a.findingi.p2; s.p3 += a.findingi.p3
  }
  return perOs
}

/**
 * @param {Record<string, unknown>} raport wpis raporty[] wyniku runu
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 * @param {(commity: string[]) => ZmianyCommitow} zmianyFixa
 */
function fixFazy(raport, agenci, journal, zmianyFixa) {
  const fixy = agenci.filter((a) => a.rola === 'fix')
  const zRaportu = obiekt(raport.fix)
  if (!fixy.length && !Object.keys(zRaportu).length) return null
  // Agent fixa zapisuje commit jako hash albo „hash opis” (`030acce fix(e6): poprawki...`) — do gita idzie sam hash.
  const commity = fixy.flatMap((a) => {
    const c = obiekt(journal.get(a.id)?.wynik).commity
    return Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x.trim().split(/\s+/)[0] : '')).filter((x) => RE_HASH.test(x)) : []
  })
  const zmiany = zmianyFixa(commity)
  return {
    naprawione: liczbaLubNull(zRaportu.naprawione),
    nierozwiazaneP2: liczbaLubNull(zRaportu.nierozwiazaneP2),
    p3Pominiete: liczbaLubNull(zRaportu.p3Pominiete),
    pliki: zmiany.ok ? zmiany.pliki : null,
    pliki_blad: zmiany.ok ? null : zmiany.powod,
    linie_diff: zmiany.ok ? zmiany.linie : null,
    p1_z_testem: null,
  }
}

/**
 * @param {Record<string, unknown>} raport
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 */
function kontrolaFixaFazy(raport, agenci, journal) {
  const kontrola = agenci.find((a) => a.rola === 'fix:kontrola')
  const zRaportu = obiekt(raport.kontrolaFixa)
  if (!kontrola && !Object.keys(zRaportu).length) return null
  const regresje = obiekt(kontrola ? journal.get(kontrola.id)?.wynik : null).regresje
  return { ...zRaportu, regresje: Array.isArray(regresje) ? regresje.length : null }
}

// Bramki domkniecia (P6): nazwy jak w kolejce .claude/scripts/bramki/bramki.mjs i w EXECUTE_RESULT dev-docs-execute-wf.
const NAZWY_BRAMEK = ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'migracje', 'migracjeSuma', 'advisors', 'testyUsuniete', 'stryker']

/**
 * Bramki i testy usuniete z wyniku ostatniego domkniecia fazy (EXECUTE_RESULT): per bramka {status, sekundy, trafienia,
 * poNaprawie} z pierwszego przebiegu skryptu; bramka nieobecna w wyniku albo faza bez domkniecia = null.
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 */
function bramkiFazy(agenci, journal) {
  const domkniecie = agenci.filter((a) => a.rola === 'domkniecie').at(-1)
  const wynik = obiekt(domkniecie ? journal.get(domkniecie.id)?.wynik : null)
  const zWyniku = obiekt(wynik.bramki)
  const bramki = Object.fromEntries(NAZWY_BRAMEK.map((n) => {
    const b = obiekt(zWyniku[n])
    if (!Object.keys(b).length) return [n, null]
    return [n, { status: b.status ?? null, sekundy: liczbaLubNull(b.sekundy), trafienia: liczbaLubNull(b.trafienia), poNaprawie: b.poNaprawie ?? null }]
  }))
  return { bramki, testyUsuniete: Array.isArray(wynik.testyUsuniete) ? wynik.testyUsuniete : null }
}

/**
 * @param {{ wynikRunu: unknown, agenci: AgentFazy[], journal: Map<string, WynikJournala>, zmianyFixa: (commity: string[]) => ZmianyCommitow }} we
 */
export function rekordyFaz(we) {
  const wynik = obiekt(we.wynikRunu)
  const raporty = (Array.isArray(wynik.raporty) ? wynik.raporty : []).map(obiekt)
  const fazaStopu = wynik.status === 'STOP' ? liczbaLubNull(wynik.faza) : null
  const numery = new Set([
    ...raporty.map((r) => liczbaLubNull(r.faza)),
    ...we.agenci.map((a) => a.faza),
  ].filter((n) => n !== null))
  return [...numery].sort((a, b) => a - b).map((numer) => {
    const raport = raporty.find((r) => r.faza === numer) ?? {}
    const agenci = we.agenci.filter((a) => a.faza === numer)
    const przebieg = obiekt(raport.przebieg)
    const domkniecie = bramkiFazy(agenci, we.journal)
    return {
      typ: 'faza',
      faza: numer,
      status: numer === fazaStopu ? 'STOP' : raporty.includes(raport) ? 'OK' : null,
      gate: raport.gate ?? null,
      cykle: liczbaLubNull(raport.cykle),
      liczniki: raport.liczniki ?? null,
      przebieg: raport.przebieg ?? null,
      findingi_per_os: findingiPerOs(agenci),
      e2e: {
        checkboxy: liczbaLubNull(przebieg.e2eCheckboxy), pass: liczbaLubNull(przebieg.e2ePass),
        fail: liczbaLubNull(przebieg.e2eFail), skip: liczbaLubNull(przebieg.e2eSkip), manual: null,
      },
      fix: fixFazy(raport, agenci, we.journal, we.zmianyFixa),
      kontrolaFixa: kontrolaFixaFazy(raport, agenci, we.journal),
      koszt: kosztFazy(agenci),
      sekundy: sekundyAgentow(agenci),
      e2eSync: typeof raport.e2eSync === 'string' ? skrotE2eSync(raport.e2eSync) : null,
      review_rundy: agenci.filter((a) => a.rola === 'kontekst:diff').length,
      bramki: domkniecie.bramki,
      // Producenci w pozniejszych paczkach: sceptyk asymetryczny (P9), wiedza (P10), dossier ze skryptu (P7).
      sceptyk: null,
      wiedza: null,
      dossier_zn: null,
      testy_usuniete: domkniecie.testyUsuniete,
    }
  })
}

/** @typedef {ReturnType<typeof rekordyFaz>[number]} RekordFazy */
