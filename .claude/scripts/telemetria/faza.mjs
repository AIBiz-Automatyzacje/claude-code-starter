// Rekordy `faza` telemetrii (d5-telemetria-rekord.txt §2, §7, §11): raport fazy z wyniku runu + agregacja agentow.

import { sekundyAgentow, sumaKosztu } from './run.mjs'

/** @typedef {import('./git.mjs').ZmianyCommitow} ZmianyCommitow */
/** @typedef {import('./agent.mjs').WynikJournala} WynikJournala */

/**
 * Minimum rekordu agenta, ktore czyta agregacja fazy.
 * @typedef {import('./run.mjs').KosztAgenta & { id: string, rola: string | null, faza: number | null,
 *   klasa_roli: string | null, findingi: { p1: number, p2: number, p3: number } | null, grupa?: string | null }} AgentFazy
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
  mechanika_review: ['dossier:zapas', 'dedup:semantyczny', 'scribe'],
  orkiestracja: ['stan:zapis', 'bootstrap', 'telemetria', 'stop', 'e2e:precheck', 'e2e:env-up', 'e2e:start', 'e2e:env-down', 'e2e:db-sync',
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
  if (rola.startsWith('fix')) return 'fix'
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
// Starsze runy zapisywaly „1 (graceful P2)” (fix zostawil P2) — liczba z poczatku tekstu, inaczej null (6a pkt 80 j).
/** @param {unknown} x @returns {number | null} */
const cykleFixa = (x) => {
  const n = typeof x === 'string' ? Number.parseInt(x, 10) : x
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

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
 * Wynik agenta fix:kontrola fazy z journala (pusty obiekt, gdy agenta albo wyniku brak).
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 */
function wynikKontroli(agenci, journal) {
  const kontrola = agenci.find((a) => a.rola === 'fix:kontrola')
  return obiekt(kontrola ? journal.get(kontrola.id)?.wynik : null)
}

/**
 * Testy P1 z listy K-6 kontroli fixa (P8); null = kontrola bez list K (wynik sprzed P8 albo brak agenta).
 * @param {Record<string, unknown>} kontrola
 * @returns {Array<Record<string, unknown>> | null}
 */
function testyK6(kontrola) {
  const testy = obiekt(obiekt(kontrola.listy)['K-6']).testy
  return Array.isArray(testy) ? testy.map(obiekt) : null
}

/**
 * Pozycje per lista K-1…K-7 i bramki (P8). K-6 jak pozycjeKontroliFixa w dev-autopilot-wf: test P1 brakujacy albo
 * zielony przed poprawka. null = kontrola bez list K.
 * @param {Record<string, unknown>} kontrola
 * @returns {Record<string, number> | null}
 */
function pozycjeList(kontrola) {
  const listy = obiekt(kontrola.listy)
  if (!Object.keys(listy).length) return null
  /** @type {Record<string, number>} */
  const wynik = {}
  for (const id of Object.keys(listy).sort()) {
    const pozycje = obiekt(listy[id]).pozycje
    wynik[id] = id === 'K-6'
      ? (testyK6(kontrola) ?? []).filter((t) => t.czerwonyPrzedPoprawka !== true).length
      : Array.isArray(pozycje) ? pozycje.length : 0
  }
  const bramki = obiekt(kontrola.bramki).pozycje
  wynik.bramki = Array.isArray(bramki) ? bramki.length : 0
  return wynik
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
  const testy = testyK6(wynikKontroli(agenci, journal))
  return {
    naprawione: liczbaLubNull(zRaportu.naprawione),
    nierozwiazaneP2: liczbaLubNull(zRaportu.nierozwiazaneP2),
    // P8: fix bez P3 — pole tylko w runach sprzed P8, w nowych null
    p3Pominiete: liczbaLubNull(zRaportu.p3Pominiete),
    pliki: zmiany.ok ? zmiany.pliki : null,
    pliki_blad: zmiany.ok ? null : zmiany.powod,
    linie_diff: zmiany.ok ? zmiany.linie : null,
    p1_z_testem: testy ? testy.filter((t) => t.czerwonyPrzedPoprawka === true).length : null,
  }
}

/**
 * @param {Record<string, unknown>} raport
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 */
function kontrolaFixaFazy(raport, agenci, journal) {
  const zRaportu = obiekt(raport.kontrolaFixa)
  if (!agenci.some((a) => a.rola === 'fix:kontrola') && !Object.keys(zRaportu).length) return null
  const kontrola = wynikKontroli(agenci, journal)
  const regresje = kontrola.regresje
  return { ...zRaportu, regresje: Array.isArray(regresje) ? regresje.length : null, listy: pozycjeList(kontrola) }
}

/**
 * Etykiety sceptykow fazy (P9) z przebiegu review — liczone w review-wf po regule EVIDENCE bez dowodu = CONCERN;
 * przebieg sprzed P9 (bez pola albo z null ze stanu) = null.
 * @param {Record<string, unknown>} przebieg
 */
function sceptykFazy(przebieg) {
  if (przebieg.sceptyk === null || typeof przebieg.sceptyk !== 'object') return null
  const s = obiekt(przebieg.sceptyk)
  return {
    agree: liczbaLubNull(s.agree),
    disagree_evidence: liczbaLubNull(s.disagree_evidence),
    disagree_concern: liczbaLubNull(s.disagree_concern),
    degradacje: liczbaLubNull(s.degradacje),
  }
}

// Bramki domkniecia (P6): nazwy jak w kolejce .claude/scripts/bramki/bramki.mjs i w EXECUTE_RESULT dev-docs-execute-wf.
const NAZWY_BRAMEK = ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'migracje', 'migracjeSuma', 'testyUsuniete', 'stryker']

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

// Uruchomienia review-wf w fazie = rozne grupy harnessu dziecka review („▸ dev-docs-review-wf”, „… #2”).
const GRUPA_REVIEW = /dev-docs-review-wf/

/** @param {AgentFazy[]} agenci */
function rundyReview(agenci) {
  return new Set(agenci.map((a) => a.grupa).filter((g) => typeof g === 'string' && GRUPA_REVIEW.test(g))).size
}

/**
 * Dossier fazy (P7): z zapasowego agenta, gdy byl (to dossier dostalo review), inaczej z ostatniego domkniecia.
 * @param {AgentFazy[]} agenci
 * @param {Map<string, WynikJournala>} journal
 * @returns {Record<string, unknown>}
 */
function dossierFazy(agenci, journal) {
  const zrodlo = agenci.filter((a) => a.rola === 'dossier:zapas').at(-1) ?? agenci.filter((a) => a.rola === 'domkniecie').at(-1)
  return obiekt(obiekt(zrodlo ? journal.get(zrodlo.id)?.wynik : null).dossier)
}

/**
 * Wiedza projektu w dossier fazy (P10): rozmiar indeksu i CLAUDE.md, wycinek regul dla plikow fazy. Dossier bez pola = null.
 * @param {Record<string, unknown>} dossier
 */
function wiedzaFazy(dossier) {
  const w = obiekt(dossier.wiedza)
  if (!Object.keys(w).length) return null
  return {
    indeks_zn: liczbaLubNull(w.indeksZn), claude_md_zn: liczbaLubNull(w.claudeMdZn), wycinek_zn: liczbaLubNull(w.wycinekZn),
    wycinek_wpisy: liczbaLubNull(w.wycinekWpisy), wycinek_pominiete: liczbaLubNull(w.wycinekPominiete),
  }
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
    const dossier = dossierFazy(agenci, we.journal)
    return {
      typ: 'faza',
      faza: numer,
      status: numer === fazaStopu ? 'STOP' : raporty.includes(raport) ? 'OK' : null,
      gate: raport.gate ?? null,
      cykle: cykleFixa(raport.cykle),
      advisors: raport.advisors ?? null,
      liczniki: raport.liczniki ?? null,
      przebieg: raport.przebieg ?? null,
      findingi_per_os: findingiPerOs(agenci),
      e2e: {
        checkboxy: liczbaLubNull(przebieg.e2eCheckboxy), pass: liczbaLubNull(przebieg.e2ePass),
        fail: liczbaLubNull(przebieg.e2eFail), skip: liczbaLubNull(przebieg.e2eSkip), manual: liczbaLubNull(przebieg.e2eManual),
      },
      fix: fixFazy(raport, agenci, we.journal, we.zmianyFixa),
      kontrolaFixa: kontrolaFixaFazy(raport, agenci, we.journal),
      koszt: kosztFazy(agenci),
      sekundy: sekundyAgentow(agenci),
      e2eSync: typeof raport.e2eSync === 'string' ? skrotE2eSync(raport.e2eSync) : null,
      review_rundy: rundyReview(agenci),
      bramki: domkniecie.bramki,
      sceptyk: sceptykFazy(przebieg),
      wiedza: wiedzaFazy(dossier),
      dossier_zn: liczbaLubNull(dossier.ctxZnaki),
      testy_usuniete: domkniecie.testyUsuniete,
    }
  })
}

/** @typedef {ReturnType<typeof rekordyFaz>[number]} RekordFazy */
