// Epizody skilli w sesji glownej — rekord `skill` (d5-telemetria-rekord.txt §7 + §9; port koszt_skilli.py z granica z przegladu D6,
// d6r_rewizja_audytu.py wariant E2 + subagenci). Epizod: od `<command-name>` skilla albo narzedzia Skill do NASTEPNEGO skilla
// albo konca pliku sesji; powiadomienia, przerwania i komendy lokalne (/model, /compact...) go nie koncza.

import { kosztJednostek } from './cennik.mjs'

/** @typedef {import('./transkrypt.mjs').WpisTranskryptu & { uuid?: string, isMeta?: boolean }} WpisSesji */
/** @typedef {import('./transkrypt.mjs').Uzycie} Uzycie */

/**
 * @typedef {object} Epizod
 * @property {string} klucz uuid wiadomosci otwierajacej albo id wywolania Skill (ten sam w kopiach wznowionej sesji)
 * @property {string} skill
 * @property {'slash' | 'Skill-tool'} zrodlo
 * @property {string} sesja
 * @property {string} start
 * @property {string} koniec
 * @property {boolean} zamkniety true = zamknal go nastepny skill; false = trwal do konca pliku
 * @property {Map<string, Uzycie>} odpowiedzi odpowiedzi API w epizodzie (ostatni wpis per id)
 * @property {Map<string, Uzycie>} pierwszaOdpowiedz odpowiedzi do pierwszej wiadomosci typu user
 * @property {Set<string>} operator uuid wiadomosci operatora (tekst czlowieka)
 * @property {Set<string>} subagenci id wywolan narzedzia Agent
 * @property {{ narzedzia: Set<string>, workflow: number }} wywolania
 */

const RE_KOMENDA = /<command-name>\/?([\w:-]+)<\/command-name>/
// Komendy wbudowane Claude Code — nie sa skillami, nie otwieraja ani nie zamykaja epizodu (lista z d6r_rewizja_audytu.py).
const RE_LOKALNA = /^\s*<command-name>\/?(model|clear|compact|context|cost|mcp|effort|fast|config|status|resume|rename|login|permissions|hooks|memory|agents|ide|doctor|help|add-dir|export|release-notes|usage|plugin|reload-plugins|skills|statusline|output-style|terminal-setup|vim|init)<\/command-name>/

/** @param {unknown} c @returns {string} */
function tekst(c) {
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c.map((b) => (b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join(' ')
}
/** @param {unknown} c */
const czyToolResult = (c) => Array.isArray(c) && c.some((b) => b && typeof b === 'object' && b.type === 'tool_result')
/** @param {string} t */
const czyLokalna = (t) => t.startsWith('<local-command') || RE_LOKALNA.test(t)
/** @param {string} t */
const czyCzlowiek = (t) => !(t.trimStart().startsWith('<task-notification>') || t.startsWith('[Request interrupted') || czyLokalna(t))

/** @param {unknown} c @returns {Array<Record<string, unknown>>} */
function blokiNarzedzi(c) {
  if (!Array.isArray(c)) return []
  return c.filter((b) => b && typeof b === 'object' && b.type === 'tool_use').map((b) => Object.fromEntries(Object.entries(b)))
}

/**
 * @param {string} klucz @param {string} skill @param {'slash' | 'Skill-tool'} zrodlo @param {string} sesja @param {string} czas
 * @returns {Epizod & { e0: boolean, e2: boolean }}
 */
function nowyEpizod(klucz, skill, zrodlo, sesja, czas) {
  return {
    klucz, skill, zrodlo, sesja, start: czas, koniec: czas, zamkniety: false, e0: true, e2: true,
    odpowiedzi: new Map(), pierwszaOdpowiedz: new Map(), operator: new Set(), subagenci: new Set(),
    wywolania: { narzedzia: new Set(), workflow: 0 },
  }
}

/**
 * @param {WpisSesji[]} wpisy wpisy jednego pliku sesji glownej, w kolejnosci
 * @param {string} sesja nazwa pliku sesji (bez .jsonl)
 * @returns {Epizod[]}
 */
export function epizodySesji(wpisy, sesja) {
  /** @type {Array<Epizod & { e0: boolean, e2: boolean }>} */
  const wszystkie = []
  /** @type {Array<Epizod & { e0: boolean, e2: boolean }>} */
  let otwarte = []
  for (const w of wpisy) {
    const tresc = w.message?.content
    const czas = w.timestamp ?? ''
    if (w.type === 'user' && !w.isMeta && !czyToolResult(tresc)) {
      const t = tekst(tresc)
      const komenda = t.match(RE_KOMENDA)
      const skill = komenda && !czyLokalna(t) ? komenda[1] : null
      for (const e of otwarte) {
        e.e0 = false
        if (skill) { e.e2 = false; e.zamkniety = true } else if (czyCzlowiek(t) && w.uuid) e.operator.add(w.uuid)
      }
      otwarte = otwarte.filter((e) => e.e2)
      if (skill && w.uuid) {
        const e = nowyEpizod(w.uuid, skill, 'slash', sesja, czas)
        wszystkie.push(e); otwarte.push(e)
      }
      continue
    }
    if (w.type !== 'assistant') continue
    const narzedzia = blokiNarzedzi(tresc)
    const wywolanieSkilla = otwarte.some((e) => e.e0) ? undefined : narzedzia.find((b) => b.name === 'Skill')
    if (wywolanieSkilla && typeof wywolanieSkilla.id === 'string') {
      for (const e of otwarte) { e.e2 = false; e.zamkniety = true }
      const wejscie = wywolanieSkilla.input
      const nazwa = wejscie && typeof wejscie === 'object' && 'skill' in wejscie ? String(wejscie.skill) : '?'
      const e = nowyEpizod(wywolanieSkilla.id, nazwa, 'Skill-tool', sesja, czas)
      wszystkie.push(e)
      otwarte = [e]
    }
    const u = w.message?.usage
    const id = w.message?.id
    for (const e of otwarte) {
      if (u && id) { e.odpowiedzi.set(id, u); if (e.e0) e.pierwszaOdpowiedz.set(id, u) }
      if (czas > e.koniec) e.koniec = czas
      for (const b of narzedzia) {
        if (typeof b.id !== 'string') continue
        e.wywolania.narzedzia.add(b.id)
        if (b.name === 'Agent') e.subagenci.add(b.id)
        if (b.name === 'Workflow') e.wywolania.workflow++
      }
    }
  }
  return wszystkie.map(({ e0: _e0, e2: _e2, ...e }) => e)
}

/**
 * Scala kopie epizodu z wielu plikow (sesja wznowiona kopiuje wpisy do nowego pliku) — odpowiedzi po id, bez dublowania.
 * @param {Epizod[]} epizody
 * @returns {Epizod[]}
 */
export function scalEpizody(epizody) {
  /** @type {Map<string, Epizod>} */
  const scalone = new Map()
  for (const e of [...epizody].sort((a, b) => a.start.localeCompare(b.start))) {
    const s = scalone.get(e.klucz)
    if (!s) {
      scalone.set(e.klucz, { ...e, odpowiedzi: new Map(e.odpowiedzi), pierwszaOdpowiedz: new Map(e.pierwszaOdpowiedz),
        operator: new Set(e.operator), subagenci: new Set(e.subagenci), wywolania: { narzedzia: new Set(e.wywolania.narzedzia), workflow: e.wywolania.workflow } })
      continue
    }
    for (const [id, u] of e.odpowiedzi) s.odpowiedzi.set(id, u)
    for (const [id, u] of e.pierwszaOdpowiedz) s.pierwszaOdpowiedz.set(id, u)
    for (const x of e.operator) s.operator.add(x)
    for (const x of e.subagenci) s.subagenci.add(x)
    for (const x of e.wywolania.narzedzia) s.wywolania.narzedzia.add(x)
    s.wywolania.workflow = Math.max(s.wywolania.workflow, e.wywolania.workflow)
    if (e.koniec > s.koniec) s.koniec = e.koniec
    s.zamkniety = s.zamkniety || e.zamkniety
  }
  return [...scalone.values()]
}

/** @param {Iterable<Uzycie>} uzycia */
function suma(uzycia) {
  const s = { in: 0, cache_w: 0, cache_r: 0, out: 0 }
  let ctxMax = 0
  for (const u of uzycia) {
    const tura = { in: u.input_tokens ?? 0, cache_w: u.cache_creation_input_tokens ?? 0, cache_r: u.cache_read_input_tokens ?? 0 }
    s.in += tura.in; s.cache_w += tura.cache_w; s.cache_r += tura.cache_r; s.out += u.output_tokens ?? 0
    ctxMax = Math.max(ctxMax, tura.in + tura.cache_w + tura.cache_r)
  }
  return { ...s, ctx_max: ctxMax }
}

const MS_NA_GODZINE = 3_600_000

/**
 * @param {Epizod} e
 * @param {(toolUseId: string) => number | null} kosztSubagenta koszt transkryptu subagenta; null = brak transkryptu
 */
export function rekordSkilla(e, kosztSubagenta) {
  const s = suma(e.odpowiedzi.values())
  const koszty = [...e.subagenci].map(kosztSubagenta)
  const okno = Date.parse(e.koniec) - Date.parse(e.start)
  return {
    typ: 'skill',
    klucz_epizodu: e.klucz,
    skill: e.skill,
    zrodlo: e.zrodlo,
    sesja: e.sesja,
    start: e.start,
    koniec: e.koniec,
    tury: e.odpowiedzi.size,
    ...s,
    koszt_jedn: kosztJednostek(s),
    pierwsza_odpowiedz_jedn: kosztJednostek(suma(e.pierwszaOdpowiedz.values())),
    subagenci_n: e.subagenci.size,
    subagenci_jedn: koszty.some((k) => k === null) ? null : koszty.reduce((a, b) => (a ?? 0) + (b ?? 0), 0),
    wiadomosci_operatora: e.operator.size,
    okno_h: Number.isFinite(okno) ? Math.round((okno / MS_NA_GODZINE) * 100) / 100 : null,
    tool_calls: e.wywolania.narzedzia.size,
    agent_calls: e.subagenci.size,
    workflow_calls: e.wywolania.workflow,
    // Rozmiary artefaktow (plan, zadania, IU z budzetem) — producent przy scaleniu dev-plan + dev-docs (R1 po It. 3).
    artefakty: null,
  }
}

/** @typedef {ReturnType<typeof rekordSkilla>} RekordSkilla */
