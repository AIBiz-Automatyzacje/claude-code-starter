// Epizody skilli w sesji glownej — rekord `skill` (d5-telemetria-rekord.txt §7 + §9; port koszt_skilli.py z granica z przegladu D6,
// d6r_rewizja_audytu.py wariant E2 + subagenci). Epizod: od `<command-name>` skilla albo narzedzia Skill do NASTEPNEGO skilla
// albo konca pliku sesji; powiadomienia, przerwania i komendy lokalne (/model, /compact...) go nie koncza — poza /clear.
// Skill pomocniczy wywolany narzedziem poza epizodem operatora konczy sie z tura; polecenia operatora po zakonczonym skillu
// to epizod SESJA_BEZ_SKILLA do nastepnego skilla (E5-19).
// Skill pomocniczy wywolany narzedziem Skill w epizodzie otwartym komenda operatora to krok tego skilla (P17, vibersi: /dev-plan
// wolal figma:figma-design-to-code w kroku 1.6 i epizod planu urywal sie po 6 turach, a 1,25 M szlo na „epizod Figmy”).
// Skill pipeline'u (dev-*) wywolany narzedziem zaczyna wlasny epizod — to zwykle nowa prosba operatora.
// /dev-plan konczy sie na wywolaniu Workflow (P20 A8): plan oddaje zadanie autopilotowi, a praca sesji po runie (odczyt, poprawki)
// nie jest planowaniem — vibersi etap-2-poprawki: telemetria 2,91 M, do Workflow 0,78 M.

import { kosztJednostek } from './cennik.mjs'
import { artefaktyPlanu, poleceniePlanu, wynikJson } from './planowanie.mjs'

/** @typedef {import('./transkrypt.mjs').WpisTranskryptu & { uuid?: string, isMeta?: boolean }} WpisSesji */
/** @typedef {import('./transkrypt.mjs').Uzycie} Uzycie */

/**
 * @typedef {object} Epizod
 * @property {string} klucz uuid wiadomosci otwierajacej albo id wywolania Skill (ten sam w kopiach wznowionej sesji)
 * @property {string} skill
 * @property {'slash' | 'Skill-tool' | 'bez-skilla'} zrodlo bez-skilla = praca sesji po zakonczonym skillu (SESJA_BEZ_SKILLA)
 * @property {string} sesja
 * @property {string} start
 * @property {string} koniec
 * @property {boolean} zamkniety true = zamknal go nastepny skill albo (dev-plan) wywolanie Workflow; false = trwal do konca pliku
 * @property {number | null} ctxStart kontekst pierwszej odpowiedzi API epizodu (in + cache_w + cache_r); ~65–70k = swieza sesja
 * @property {Map<string, Uzycie>} odpowiedzi odpowiedzi API w epizodzie (ostatni wpis per id)
 * @property {Map<string, Uzycie>} pierwszaOdpowiedz odpowiedzi do pierwszej wiadomosci typu user
 * @property {Set<string>} operator uuid wiadomosci operatora (tekst czlowieka)
 * @property {Set<string>} subagenci id wywolan narzedzia Agent
 * @property {{ narzedzia: Set<string>, workflow: number }} wywolania
 * @property {Map<string, import('./planowanie.mjs').WywolaniePlanu>} plan wywolania plan.mjs (id tool_use → polecenie i wynik)
 * @property {Set<string>} zagniezdzone skille pomocnicze wywolane narzedziem Skill jako krok tego epizodu
 * @property {boolean} poClear w pliku sesji przed startem epizodu byl /clear — epizod nie jest kontynuacja poprzedniej sesji
 */

const RE_KOMENDA = /<command-name>\/?([\w:-]+)<\/command-name>/
// Komendy wbudowane Claude Code — nie sa skillami, nie otwieraja ani nie zamykaja epizodu (lista z d6r_rewizja_audytu.py
// + komendy sesji spotkane w telemetrii: exit, quit, rewind, logout...).
// Raport filtruje nimi takze rekordy starszych wersji skanu, ktore je jeszcze liczyly jako skille (odczyt It. 1 §5c).
export const KOMENDY_LOKALNE = new Set(['model', 'clear', 'compact', 'context', 'cost', 'mcp', 'effort', 'fast', 'config', 'status', 'resume',
  'rename', 'login', 'permissions', 'hooks', 'memory', 'agents', 'ide', 'doctor', 'help', 'add-dir', 'export', 'release-notes', 'usage',
  'plugin', 'reload-plugins', 'skills', 'statusline', 'output-style', 'terminal-setup', 'vim', 'init', 'exit', 'quit', 'rewind', 'logout',
  'upgrade', 'feedback', 'bug', 'todos', 'bashes', 'tasks', 'privacy-settings', 'theme', 'sandbox', 'copy'])
/** @param {string} nazwa @param {Array<{ zrodlo: string }>} otwarte @returns {boolean} krok skilla operatora, nie nowy epizod */
const czyKrokSkilla = (nazwa, otwarte) => !nazwa.startsWith('dev-') && otwarte.some((e) => e.zrodlo === 'slash')
// Skille, ktorych epizod konczy wywolanie Workflow (oddanie pracy autopilotowi). /dev-pr woła dev-pr-wf w kazdym etapie — nie tu.
const KONIEC_NA_WORKFLOW = new Set(['dev-plan'])
// Skill-krok wywolany narzedziem konczy sie z tura (E5-19: sync-template jako punkt 1 polecenia operatora, potem smoke).
// Lista jawna, nie „wszystko spoza dev-*”: zroastuj-mnie, makieta i skille projektow prowadza dialog (recenzja S4: Nawykometr
// zroastuj-mnie 18 odpowiedzi → 4). Skill z komendy operatora trwa zawsze do nastepnego skilla.
const SKILLE_KROKI = new Set(['sync-template', 'security', 'sentry-integration', 'agent-browser', 'coolify-manager', 'run',
  'supabase-dev-guidelines', 'tailwind-react-guidelines', 'ux-ui-guidelines', 'artifact-design', 'artifact-capabilities',
  'artifact-diagramming', 'dataviz', 'workflow-authoring', 'claude-api', 'update-config'])
/** @param {Epizod} e */
const konczySieZTura = (e) => e.zrodlo === 'Skill-tool' && (SKILLE_KROKI.has(e.skill) || e.skill.startsWith('figma:'))
const RE_CLEAR = /^\s*<command-name>\/?clear<\/command-name>/
// Praca sesji po zakonczonym skillu do nastepnego skilla (E5-19) — osobna pozycja raportu, nie koszt skilla.
export const SESJA_BEZ_SKILLA = '(sesja glowna bez skilla)'
const RE_LOKALNA = new RegExp(`^\\s*<command-name>\\/?(${[...KOMENDY_LOKALNE].join('|')})<\\/command-name>`)

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
 * @param {string} klucz @param {string} skill @param {Epizod['zrodlo']} zrodlo @param {string} sesja @param {string} czas
 * @param {boolean} poClear
 * @returns {Epizod & { e0: boolean, e2: boolean }}
 */
function nowyEpizod(klucz, skill, zrodlo, sesja, czas, poClear) {
  return {
    klucz, skill, zrodlo, sesja, start: czas, koniec: czas, zamkniety: false, ctxStart: null, e0: true, e2: true, poClear,
    odpowiedzi: new Map(), pierwszaOdpowiedz: new Map(), operator: new Set(), subagenci: new Set(),
    wywolania: { narzedzia: new Set(), workflow: 0 }, plan: new Map(), zagniezdzone: new Set(),
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
  let poClear = false
  for (const w of wpisy) {
    const tresc = w.message?.content
    const czas = w.timestamp ?? ''
    if (w.type === 'user' && !w.isMeta && !czyToolResult(tresc)) {
      const t = tekst(tresc)
      const komenda = t.match(RE_KOMENDA)
      const skill = komenda && !czyLokalna(t) ? komenda[1] : null
      const clear = RE_CLEAR.test(t)
      const czlowiek = czyCzlowiek(t)
      poClear ||= clear
      for (const e of otwarte) {
        e.e0 = false
        if (skill || clear || (czlowiek && konczySieZTura(e))) { e.e2 = false; e.zamkniety = true } else if (czlowiek && w.uuid) e.operator.add(w.uuid)
      }
      otwarte = otwarte.filter((e) => e.e2)
      if (skill && w.uuid) {
        const e = nowyEpizod(w.uuid, skill, 'slash', sesja, czas, poClear)
        wszystkie.push(e); otwarte.push(e)
      } else if (czlowiek && w.uuid && !otwarte.length && wszystkie.length) {
        // Polecenie operatora po zakonczonym skillu: praca do nastepnego skilla jest osobna pozycja (E5-19). e0 = false —
        // narzedzie Skill w pierwszej odpowiedzi otwiera wlasny epizod (e0 chroni tylko przed echem komendy skilla).
        const e = { ...nowyEpizod(w.uuid, SESJA_BEZ_SKILLA, 'bez-skilla', sesja, czas, poClear), e0: false }
        e.operator.add(w.uuid)
        wszystkie.push(e); otwarte.push(e)
      }
      continue
    }
    if (w.type === 'user' && Array.isArray(tresc)) {
      for (const b of tresc) {
        if (!b || typeof b !== 'object' || b.type !== 'tool_result') continue
        for (const e of otwarte) {
          const p = e.plan.get(String(b.tool_use_id))
          if (p) p.wynik = wynikJson(b.content)
        }
      }
    }
    if (w.type !== 'assistant') continue
    const narzedzia = blokiNarzedzi(tresc)
    const wywolanieSkilla = otwarte.some((e) => e.e0) ? undefined : narzedzia.find((b) => b.name === 'Skill')
    if (wywolanieSkilla && typeof wywolanieSkilla.id === 'string') {
      const wejscie = wywolanieSkilla.input
      const nazwa = wejscie && typeof wejscie === 'object' && 'skill' in wejscie ? String(wejscie.skill) : '?'
      if (czyKrokSkilla(nazwa, otwarte)) {
        for (const e of otwarte) e.zagniezdzone.add(nazwa)
      } else {
        for (const e of otwarte) { e.e2 = false; e.zamkniety = true }
        const e = nowyEpizod(wywolanieSkilla.id, nazwa, 'Skill-tool', sesja, czas, poClear)
        wszystkie.push(e)
        otwarte = [e]
      }
    }
    const u = w.message?.usage
    const id = w.message?.id
    for (const e of otwarte) {
      if (u && id) {
        if (e.ctxStart === null) e.ctxStart = kontekstTury(u)
        e.odpowiedzi.set(id, u)
        if (e.e0) e.pierwszaOdpowiedz.set(id, u)
      }
      if (czas > e.koniec) e.koniec = czas
      for (const b of narzedzia) {
        if (typeof b.id !== 'string') continue
        e.wywolania.narzedzia.add(b.id)
        if (b.name === 'Agent') e.subagenci.add(b.id)
        if (b.name === 'Workflow') e.wywolania.workflow++
        if (b.name === 'Workflow' && KONIEC_NA_WORKFLOW.has(e.skill)) { e.e2 = false; e.zamkniety = true }
        const polecenie = poleceniePlanu(b)
        if (polecenie) e.plan.set(b.id, { polecenie, wynik: null })
      }
    }
    otwarte = otwarte.filter((e) => e.e2)
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
        operator: new Set(e.operator), subagenci: new Set(e.subagenci), wywolania: { narzedzia: new Set(e.wywolania.narzedzia), workflow: e.wywolania.workflow },
        plan: new Map(e.plan), zagniezdzone: new Set(e.zagniezdzone) })
      continue
    }
    for (const [id, u] of e.odpowiedzi) s.odpowiedzi.set(id, u)
    for (const [id, u] of e.pierwszaOdpowiedz) s.pierwszaOdpowiedz.set(id, u)
    for (const x of e.operator) s.operator.add(x)
    for (const x of e.subagenci) s.subagenci.add(x)
    for (const x of e.wywolania.narzedzia) s.wywolania.narzedzia.add(x)
    s.wywolania.workflow = Math.max(s.wywolania.workflow, e.wywolania.workflow)
    s.ctxStart ??= e.ctxStart
    for (const [id, p] of e.plan) if (!s.plan.get(id)?.wynik) s.plan.set(id, p)
    for (const x of e.zagniezdzone) s.zagniezdzone.add(x)
    if (e.koniec > s.koniec) s.koniec = e.koniec
    s.zamkniety = s.zamkniety || e.zamkniety
  }
  return [...scalone.values()]
}

/** @param {Uzycie} u @returns {number} kontekst wejscia jednej odpowiedzi */
function kontekstTury(u) {
  return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
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
    // Kontekst odziedziczony po poprzedniej pracy sesji (P20 A8): /dev-plan po /dev-prep bez /clear startowal z 215–237k.
    ctx_start: e.ctxStart,
    subagenci_n: e.subagenci.size,
    subagenci_jedn: koszty.some((k) => k === null) ? null : koszty.reduce((a, b) => (a ?? 0) + (b ?? 0), 0),
    wiadomosci_operatora: e.operator.size,
    okno_h: Number.isFinite(okno) ? Math.round((okno / MS_NA_GODZINE) * 100) / 100 : null,
    tool_calls: e.wywolania.narzedzia.size,
    agent_calls: e.subagenci.size,
    workflow_calls: e.wywolania.workflow,
    zagniezdzone: [...e.zagniezdzone],
    // Epizod po /clear w tym pliku — raport nie laczy go z otwartym epizodem poprzedniej sesji jako kontynuacji (E5-19).
    po_clear: e.poClear,
    // Wyniki plan.mjs z epizodu /dev-plan (P13): rozmiary planu i zadan, budzet pliku, walidacja, bramka gotowosci; inne skille null.
    artefakty: artefaktyPlanu([...e.plan.values()]),
  }
}

/** @typedef {ReturnType<typeof rekordSkilla>} RekordSkilla */
