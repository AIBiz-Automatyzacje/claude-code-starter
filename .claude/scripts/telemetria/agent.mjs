// Rekord `agent` telemetrii (d5-telemetria-rekord.txt §2, §7, §8, §10). Czysta funkcja: dane wejsciowe czyta skan.
// Pola wspolne (v, ts, projekt, run, sesja, zadanie, workflow, klucz) dokleja zapis — tu tylko to, co opisuje agenta.

import { klasaRoli, klasyfikujPoPrompcie, rola } from './role.mjs'

/** @typedef {import('./transkrypt.mjs').AnalizaTranskryptu} AnalizaTranskryptu */
/** @typedef {import('./harness.mjs').WpisHarnessu} WpisHarnessu */

/**
 * @typedef {object} WynikJournala
 * @property {boolean} rozpoczety wpis `started` istnieje
 * @property {boolean} maWynik wpis `result` istnieje (wynik moze byc null)
 * @property {unknown} wynik
 */

/**
 * @typedef {object} WejscieAgenta
 * @property {string} id agentId
 * @property {{ agentType?: string, description?: string, workflowPhase?: string }} meta agent-<id>.meta.json
 * @property {WpisHarnessu | null} harness wpis z workflowProgress (brak dla wczesniejszych prob)
 * @property {WynikJournala | null} journal
 * @property {AnalizaTranskryptu} analiza
 * @property {number | null} faza
 * @property {number | null} instrukcjeStale pozycje bloku `## Polecenia` pliku roli (zrodla.mjs)
 */

/** @param {unknown} x @returns {Array<Record<string, unknown>>} */
function listaObiektow(x) {
  if (!Array.isArray(x)) return []
  return x.filter((e) => e !== null && typeof e === 'object').map((e) => Object.fromEntries(Object.entries(e)))
}

/** @param {unknown} wynik @returns {Record<string, unknown>} */
function obiekt(wynik) {
  return wynik !== null && typeof wynik === 'object' && !Array.isArray(wynik) ? Object.fromEntries(Object.entries(wynik)) : {}
}

/**
 * @param {WejscieAgenta} we
 * @returns {'ok' | 'null' | 'brak' | 'blad'}
 */
function statusWyniku(we) {
  if (we.harness?.stan === 'error') return 'blad'
  if (!we.journal?.maWynik) return 'brak'
  return we.journal.wynik === null ? 'null' : 'ok'
}

/** @param {unknown} wynik */
function findingiPerWaga(wynik) {
  const f = listaObiektow(obiekt(wynik).findings)
  return {
    p1: f.filter((x) => x.severity === 'P1').length,
    p2: f.filter((x) => x.severity === 'P2').length,
    p3: f.filter((x) => x.severity === 'P3').length,
  }
}

/**
 * Etykieta glosu po regule workflowu (P9): DISAGREE_EVIDENCE bez linii albo testu w `dowod` liczy sie jak CONCERN.
 * @param {Record<string, unknown>} w
 */
function etykietaGlosu(w) {
  if (w.etykieta === 'DISAGREE_EVIDENCE' && !String(w.dowod ?? '').trim()) return 'DISAGREE_CONCERN'
  return w.etykieta
}

/**
 * Werdykty sceptyka: od P9 etykiety (EVIDENCE = obalenie, CONCERN = degradacja), wczesniej pole `realny`.
 * @param {unknown} wynik
 * @returns {{ weryfikowane: number, obalone: number, etykiety: { agree: number, disagree_evidence: number, disagree_concern: number } | null }}
 */
function werdyktySceptyka(wynik) {
  const o = obiekt(wynik)
  const werdykty = Array.isArray(o.werdykty) ? listaObiektow(o.werdykty) : 'realny' in o || 'etykieta' in o ? [o] : []
  if (!werdykty.some((w) => 'etykieta' in w)) {
    return { weryfikowane: werdykty.length, obalone: werdykty.filter((w) => w.realny === false).length, etykiety: null }
  }
  const etykiety = werdykty.map(etykietaGlosu)
  const ile = (/** @type {string} */ e) => etykiety.filter((x) => x === e).length
  return {
    weryfikowane: werdykty.length,
    obalone: ile('DISAGREE_EVIDENCE'),
    etykiety: { agree: ile('AGREE'), disagree_evidence: ile('DISAGREE_EVIDENCE'), disagree_concern: ile('DISAGREE_CONCERN') },
  }
}

/**
 * @param {WejscieAgenta} we
 */
export function rekordAgenta(we) {
  const etykieta = we.harness?.etykieta ?? we.meta.description ?? null
  const r = rola(etykieta) ?? klasyfikujPoPrompcie(we.analiza.prompt)
  const klasa = klasaRoli(r)
  const wynik = we.journal?.wynik
  const sceptyk = klasa === 'sceptyk' && r !== 'verify-fix' ? werdyktySceptyka(wynik) : null
  const { prompt: _prompt, ...analiza } = we.analiza
  return {
    typ: 'agent',
    id: we.id,
    etykieta,
    grupa: we.harness?.grupa ?? we.meta.workflowPhase ?? null,
    faza: we.faza,
    rola: r,
    klasa_roli: klasa,
    agentType: we.harness?.agentType ?? we.meta.agentType ?? null,
    ...analiza,
    model: analiza.model ?? we.harness?.model ?? null,
    proba: we.harness?.proba ?? null,
    wynik: statusWyniku(we),
    findingi: klasa === 'reviewer' || klasa === 'tester-e2e' ? findingiPerWaga(wynik) : null,
    weryfikowane: sceptyk ? sceptyk.weryfikowane : null,
    obalone: sceptyk ? sceptyk.obalone : null,
    werdykty: sceptyk ? sceptyk.etykiety : null,
    instrukcje_stale: we.instrukcjeStale,
  }
}

/** @typedef {ReturnType<typeof rekordAgenta>} RekordAgenta */
