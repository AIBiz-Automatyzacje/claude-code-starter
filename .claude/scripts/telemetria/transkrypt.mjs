// Analiza transkryptu agenta (`agent-<id>.jsonl`): koszt, kontekst startowy, efort, narzedzia.
// Port koszt_agentow.py z poprawkami przegladu D5 (d5-telemetria-rekord.txt §8 pkt 5–6) i D4 (rozmiary w znakach).

import { kosztJednostek } from './cennik.mjs'

/**
 * @typedef {object} Uzycie
 * @property {number} [input_tokens]
 * @property {number} [cache_creation_input_tokens]
 * @property {number} [cache_read_input_tokens]
 * @property {number} [output_tokens]
 * @property {{ thinking_tokens?: number }} [output_tokens_details]
 */

/**
 * Wpis transkryptu — tylko pola, ktore czyta analiza.
 * @typedef {object} WpisTranskryptu
 * @property {string} [type]
 * @property {string} [timestamp]
 * @property {string} [version]
 * @property {string} [effort]
 * @property {Record<string, unknown>} [attachment]
 * @property {{ id?: string, model?: string, content?: unknown, usage?: Uzycie }} [message]
 */

/**
 * @typedef {object} Narzedzia
 * @property {number} razem
 * @property {number} bash
 * @property {number} read
 * @property {number} grep
 * @property {number} edit
 * @property {number} write
 * @property {number} structured
 * @property {number} mcp
 */

/**
 * Kontekst startowy agenta z zalacznikow transkryptu (null = zalacznika nie bylo, np. stary format).
 * @typedef {object} KontekstStartowy
 * @property {number | null} claude_md_zn
 * @property {number | null} rules_zn
 * @property {number | null} learned_zn
 * @property {number | null} pamiec_zn
 * @property {number | null} narzedzia_n
 * @property {number | null} odroczone_zn
 * @property {number | null} skille_n
 * @property {number | null} skille_zn
 * @property {number | null} tools_zn
 * @property {Record<string, number> | null} instrukcje
 */

/**
 * @typedef {object} AnalizaTranskryptu
 * @property {number} tury
 * @property {number} in
 * @property {number} cache_w
 * @property {number} cache_r
 * @property {number} out
 * @property {number} thinking
 * @property {number} koszt_jedn
 * @property {number | null} ctx_start
 * @property {number | null} ctx_sr
 * @property {number | null} ctx_max
 * @property {string | null} model
 * @property {string | null} effort
 * @property {string | null} cc_wersja
 * @property {string | null} start
 * @property {string | null} koniec
 * @property {number | null} sekundy
 * @property {string | null} prompt
 * @property {number | null} prompt_zn
 * @property {Narzedzia} narzedzia
 * @property {KontekstStartowy} kontekst
 */

/**
 * Obiekt JSON jako slownik pol (bez rzutowania typu: kopia wpisow).
 * @param {unknown} x
 * @returns {Record<string, unknown>}
 */
function obiekt(x) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return {}
  return Object.fromEntries(Object.entries(x))
}
/** @param {unknown} x @returns {unknown[]} */
const lista = (x) => (Array.isArray(x) ? x : [])
/** @param {unknown} x */
const liczba = (x) => (typeof x === 'number' ? x : 0)
/** @param {unknown} x */
const tekst = (x) => (typeof x === 'string' ? x : '')

/** @param {WpisTranskryptu['message']} wiadomosc @returns {string | null} */
function tekstWiadomosci(wiadomosc) {
  const tresc = wiadomosc?.content
  if (typeof tresc === 'string') return tresc
  const blok = lista(tresc).map(obiekt).find((b) => b.type === 'text')
  return blok ? tekst(blok.text) : null
}

/** @param {unknown[]} tresc @param {Narzedzia} n */
function policzNarzedzia(tresc, n) {
  for (const blok of tresc.map(obiekt)) {
    if (blok.type !== 'tool_use') continue
    const nazwa = tekst(blok.name).toLowerCase()
    n.razem++
    if (nazwa === 'bash') n.bash++
    else if (nazwa === 'read') n.read++
    else if (nazwa === 'grep' || nazwa === 'glob') n.grep++
    else if (nazwa === 'edit' || nazwa === 'multiedit') n.edit++
    else if (nazwa === 'write') n.write++
    else if (nazwa === 'structuredoutput') n.structured++
    if (nazwa.startsWith('mcp__')) n.mcp++
  }
}

/** @returns {KontekstStartowy} */
function pustyKontekst() {
  return {
    claude_md_zn: null, rules_zn: null, learned_zn: null, pamiec_zn: null, narzedzia_n: null,
    odroczone_zn: null, skille_n: null, skille_zn: null, tools_zn: null, instrukcje: null,
  }
}

/** @param {Record<string, unknown>} zal @param {KontekstStartowy} k */
function dopiszInstrukcje(zal, k) {
  k.claude_md_zn = 0; k.rules_zn = 0; k.learned_zn = 0; k.pamiec_zn = 0; k.instrukcje = {}
  for (const plik of lista(zal.files).map(obiekt)) {
    const sciezka = tekst(plik.path)
    const zn = tekst(plik.content).length
    k.instrukcje[sciezka] = zn
    if (plik.type === 'AutoMem') k.pamiec_zn += zn
    else if (sciezka.endsWith('/CLAUDE.md')) k.claude_md_zn += zn
    else if (sciezka.endsWith('/learned-patterns.md')) k.learned_zn += zn
    else if (sciezka.includes('/.claude/rules/')) k.rules_zn += zn
  }
}

/** @param {Record<string, unknown>} zal @param {KontekstStartowy} k */
function dopiszZalacznik(zal, k) {
  if (zal.type === 'instructions') dopiszInstrukcje(zal, k)
  else if (zal.type === 'deferred_tools_delta') {
    k.narzedzia_n = lista(zal.addedNames).length
    k.odroczone_zn = lista(zal.addedLines).map(tekst).join('\n').length
  } else if (zal.type === 'deferred_tools_record' && k.narzedzia_n === null) {
    // Claude Code (od ~R-P15) zapisuje liste odroczonych narzedzi jako `deferred_tools_record` z `entries`; agenci
    // workflow maja ja pusta — wczesniej pole zostawalo null i raport pokazywal „—” zamiast 0 (6a pkt 80 j).
    k.narzedzia_n = lista(zal.entries).length
  } else if (zal.type === 'skill_listing') {
    k.skille_n = liczba(zal.skillCount)
    k.skille_zn = tekst(zal.content).length
  } else if (zal.type === 'prompt_snapshot' && Array.isArray(zal.tools) && k.tools_zn === null) {
    k.tools_zn = JSON.stringify(zal.tools).length
  }
}

/**
 * Odpowiedzi API: jedna odpowiedz = kilka wpisow z tym samym message.id; bierzemy OSTATNI wpis (koncowy output).
 * @param {WpisTranskryptu[]} wpisy
 * @returns {Map<string, Uzycie>}
 */
function uzyciePerOdpowiedz(wpisy) {
  /** @type {Map<string, Uzycie>} */
  const perId = new Map()
  wpisy.forEach((w, i) => {
    const u = w.message?.usage
    if (w.type === 'assistant' && u) perId.set(w.message?.id ?? `bez-id-${i}`, u)
  })
  return perId
}

/**
 * @param {WpisTranskryptu[]} wpisy sparsowane linie transkryptu, w kolejnosci pliku
 * @returns {AnalizaTranskryptu}
 */
export function analizujTranskrypt(wpisy) {
  const kontekst = pustyKontekst()
  /** @type {Narzedzia} */
  const narzedzia = { razem: 0, bash: 0, read: 0, grep: 0, edit: 0, write: 0, structured: 0, mcp: 0 }
  let prompt = null, model = null, effort = null, ccWersja = null, start = null, koniec = null
  let poPierwszejOdpowiedzi = false
  for (const w of wpisy) {
    if (w.timestamp) { start ??= w.timestamp; koniec = w.timestamp }
    if (w.type === 'user' && prompt === null) prompt = tekstWiadomosci(w.message) ?? ''
    if (w.type === 'attachment' && !poPierwszejOdpowiedzi) dopiszZalacznik(obiekt(w.attachment), kontekst)
    if (w.type !== 'assistant') continue
    poPierwszejOdpowiedzi = true
    model ??= w.message?.model ?? null
    effort ??= w.effort ?? null
    ccWersja ??= w.version ?? null
    policzNarzedzia(lista(w.message?.content), narzedzia)
  }
  const uzycia = [...uzyciePerOdpowiedz(wpisy).values()]
  const suma = { in: 0, cache_w: 0, cache_r: 0, out: 0, thinking: 0 }
  const konteksty = uzycia.map((u) => {
    const tur = { in: liczba(u.input_tokens), cache_w: liczba(u.cache_creation_input_tokens), cache_r: liczba(u.cache_read_input_tokens) }
    suma.in += tur.in; suma.cache_w += tur.cache_w; suma.cache_r += tur.cache_r
    suma.out += liczba(u.output_tokens); suma.thinking += liczba(u.output_tokens_details?.thinking_tokens)
    return tur.in + tur.cache_w + tur.cache_r
  })
  const sekundy = start && koniec ? Math.round((Date.parse(koniec) - Date.parse(start)) / 1000) : null
  return {
    tury: uzycia.length,
    ...suma,
    koszt_jedn: kosztJednostek(suma),
    ctx_start: konteksty[0] ?? null,
    ctx_sr: konteksty.length ? Math.round(konteksty.reduce((a, b) => a + b, 0) / konteksty.length) : null,
    ctx_max: konteksty.length ? Math.max(...konteksty) : null,
    model, effort, cc_wersja: ccWersja, start, koniec, sekundy,
    prompt, prompt_zn: prompt === null ? null : prompt.length,
    narzedzia, kontekst,
  }
}
