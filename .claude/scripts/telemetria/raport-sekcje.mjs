// Obliczenia raportu miesiecznego telemetrii (d5-telemetria-rekord.txt §4) — czyste funkcje na rekordach z pipeline.jsonl.

import { etapRoli } from './faza.mjs'

/** @typedef {Record<string, unknown>} Rekord */

/** @param {unknown} x */
const liczba = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
/** @param {unknown} x @returns {Record<string, unknown>} */
const obiekt = (x) => (x !== null && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : {})

/**
 * Kwantyl bez interpolacji — ta sama definicja co w skryptach analizy (v[min(n-1, floor(p*n))]).
 * @param {Array<number | null>} wartosci
 * @param {number} p
 * @returns {number | null}
 */
export function kwantyl(wartosci, p) {
  const v = wartosci.filter((x) => x !== null).sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]
}

/** @param {Rekord[]} agenci */
export function kosztPerEtap(agenci) {
  /** @type {Record<string, number>} */
  const suma = {}
  let pozaEtapami = 0
  for (const a of agenci) {
    const koszt = liczba(a.koszt_jedn) ?? 0
    const etap = etapRoli(typeof a.rola === 'string' ? a.rola : null)
    if (etap) suma[etap] = (suma[etap] ?? 0) + koszt
    else pozaEtapami += koszt
  }
  // Udzial od CALEGO kosztu — tak liczy d5r_koszt_output.py §2, wiec liczby sa wprost porownywalne z analiza.
  const razem = Object.values(suma).reduce((s, x) => s + x, 0) + pozaEtapami
  /** @type {Record<string, { jedn: number, udzial: number }>} */
  const etapy = {}
  for (const [etap, jedn] of Object.entries(suma)) {
    etapy[etap] = { jedn, udzial: razem ? Math.round((jedn / razem) * 1000) / 10 : 0 }
  }
  return { razem, poza_etapami: pozaEtapami, etapy }
}

/** @param {Rekord[]} agenci */
export function kontekstPerKlasa(agenci) {
  const grupy = Map.groupBy(agenci.filter((a) => a.klasa_roli), (a) => `${a.klasa_roli}|${a.model}`)
  return [...grupy].map(([klucz, lista]) => {
    const [klasa, model] = klucz.split('|')
    const ctx = lista.map((a) => liczba(a.ctx_start))
    return {
      klasa, model, n: lista.length,
      ctx_start_p50: kwantyl(ctx, 0.5), ctx_start_p90: kwantyl(ctx, 0.9),
      narzedzia_n_p50: kwantyl(lista.map((a) => liczba(obiekt(a.kontekst).narzedzia_n)), 0.5),
      claude_md_zn_p50: kwantyl(lista.map((a) => liczba(obiekt(a.kontekst).claude_md_zn)), 0.5),
    }
  }).sort((a, b) => a.klasa.localeCompare(b.klasa) || a.model.localeCompare(b.model))
}

/** @param {Rekord[]} agenci @returns {Record<string, Record<string, number>>} */
export function efortPerKlasa(agenci) {
  /** @type {Record<string, Record<string, number>>} */
  const wynik = {}
  for (const a of agenci) {
    if (typeof a.klasa_roli !== 'string') continue
    const poziom = typeof a.effort === 'string' ? a.effort : 'brak'
    const k = (wynik[a.klasa_roli] ??= {})
    k[poziom] = (k[poziom] ?? 0) + 1
  }
  return wynik
}

// Uwagi bota P1/P2 na 100 plikow PR — miara jakosci z mapy walidacji (PANEL-WEJSCIE §12). Unikalne watki per zadanie:
// suma po runach dev-pr zawyza o 43% (przeglad D5 §8 pkt 4).
const NA_STO = 100

/** @param {Rekord[]} runy */
export function jakoscBota(runy) {
  /** @type {Map<string, { pliki: number, watki: Map<string, string> }>} */
  const perZadanie = new Map()
  for (const r of runy) {
    const pr = obiekt(r.pr)
    if (!Object.keys(pr).length || typeof r.zadanie !== 'string') continue
    const z = perZadanie.get(r.zadanie) ?? { pliki: 0, watki: new Map() }
    z.pliki = Math.max(z.pliki, liczba(pr.pliki) ?? 0)
    for (const k of Array.isArray(pr.klasy) ? pr.klasy.map(obiekt) : []) {
      if (typeof k.id === 'string') z.watki.set(k.id, String(k.severity))
    }
    perZadanie.set(r.zadanie, z)
  }
  return [...perZadanie].map(([zadanie, z]) => {
    const p1p2 = [...z.watki.values()].filter((s) => s === 'P1' || s === 'P2').length
    return { zadanie, pliki: z.pliki, watki: z.watki.size, p1p2, p1p2_na_100_plikow: z.pliki ? Math.round((p1p2 / z.pliki) * NA_STO * 10) / 10 : null }
  })
}

/** @param {Rekord[]} runy */
export function niezawodnosc(runy) {
  /** @type {Record<string, Record<string, number>>} */
  const statusy = {}
  /** @type {Record<string, number>} */
  const stopy = {}
  for (const r of runy) {
    const wf = typeof r.workflow === 'string' ? r.workflow : '(bez harnessu)'
    const s = (statusy[wf] ??= {})
    s[String(r.status)] = (s[String(r.status)] ?? 0) + 1
    if (typeof r.stop_kategoria === 'string') stopy[r.stop_kategoria] = (stopy[r.stop_kategoria] ?? 0) + 1
  }
  return { statusy, stopy }
}

// Prog anomalii kosztu: agent drozszy niz 2 mediany swojej roli (d5-telemetria-rekord.txt §4 pkt 6).
const MNOZNIK_ANOMALII = 2

/** @param {Rekord[]} agenci */
export function anomalie(agenci) {
  const perRola = Map.groupBy(agenci, (a) => String(a.rola))
  return [...perRola.values()].flatMap((lista) => {
    const m = kwantyl(lista.map((a) => liczba(a.koszt_jedn)), 0.5)
    return m === null ? [] : lista.filter((a) => (liczba(a.koszt_jedn) ?? 0) > MNOZNIK_ANOMALII * m)
  }).sort((a, b) => (liczba(b.koszt_jedn) ?? 0) - (liczba(a.koszt_jedn) ?? 0))
}

/** @param {Rekord[]} skille */
export function skillePerNazwa(skille) {
  const zamkniete = skille.filter((s) => s.otwarty !== true)
  return [...Map.groupBy(zamkniete, (s) => String(s.skill))].map(([skill, lista]) => ({
    skill, n: lista.length,
    pelny_p50: kwantyl(lista.map((s) => (liczba(s.koszt_jedn) ?? 0) + (liczba(s.subagenci_jedn) ?? 0)), 0.5),
    wiadomosci_p50: kwantyl(lista.map((s) => liczba(s.wiadomosci_operatora)), 0.5),
  })).sort((a, b) => (b.pelny_p50 ?? 0) - (a.pelny_p50 ?? 0))
}

/** @param {Rekord[]} fazy @returns {Record<string, { p1: number, p2: number, p3: number }>} */
export function findingiPerOs(fazy) {
  /** @type {Record<string, { p1: number, p2: number, p3: number }>} */
  const perOs = {}
  for (const f of fazy) {
    for (const [os, v] of Object.entries(obiekt(f.findingi_per_os))) {
      const w = obiekt(v)
      const s = (perOs[os] ??= { p1: 0, p2: 0, p3: 0 })
      s.p1 += liczba(w.p1) ?? 0; s.p2 += liczba(w.p2) ?? 0; s.p3 += liczba(w.p3) ?? 0
    }
  }
  return perOs
}
