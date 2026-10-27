// Test epizodow skilli w sesji glownej (It. 1, krok 4): typ `skill` (d5-telemetria-rekord.txt §7 + §9, przeglad D6).
// Granica epizodu: nastepny skill albo koniec pliku — NIE pierwsza wiadomosc typu user (koszt_skilli.py konczyl dev-plan
// na powrocie subagenta w 7/19 epizodow, dev-prep na pierwszej odpowiedzi operatora w 8/15).

import test from 'node:test'
import assert from 'node:assert/strict'

import { SESJA_BEZ_SKILLA, epizodySesji, rekordSkilla, scalEpizody } from '../skill.mjs'

/** @param {string} uuid @param {string | unknown[]} content @param {Record<string, unknown>} [inne] */
const user = (uuid, content, inne = {}) => ({ type: 'user', uuid, timestamp: '2026-09-20T10:00:00.000Z', message: { content }, ...inne })
/** @param {string} id @param {number} cw @param {unknown[]} [content] @param {string} [czas] */
const asystent = (id, cw, content = [], czas = '2026-09-20T10:05:00.000Z') => ({
  type: 'assistant', timestamp: czas,
  message: { id, content, usage: { input_tokens: 0, cache_creation_input_tokens: cw, cache_read_input_tokens: 0, output_tokens: 0 } },
})

const SESJA = [
  user('u1', '<command-name>/dev-plan</command-name>'),
  asystent('m1', 100, [{ type: 'tool_use', id: 'agent-1', name: 'Agent' }]),
  user('u2', '<task-notification>subagent skonczyl</task-notification>'),
  asystent('m2', 200),
  user('u3', 'operator: tak, dalej'),
  asystent('m3', 300, [], '2026-09-20T12:00:00.000Z'),
  user('u4', '<command-name>/model</command-name>'),
  asystent('m4', 50),
  user('u5', '<command-name>/dev-docs</command-name>'),
  asystent('m5', 400, [{ type: 'tool_use', id: 'wf-1', name: 'Workflow' }]),
  user('u6', 'operator: teraz compound'),
  asystent('m6', 10, [{ type: 'tool_use', id: 's-1', name: 'Skill', input: { skill: 'dev-compound' } }]),
  asystent('m7', 20),
]

/** @param {string} skill */
const epizod = (skill) => {
  const e = epizodySesji(SESJA, 'sesja-1').find((x) => x.skill === skill)
  assert.ok(e, `brak epizodu ${skill}`)
  return e
}

test('epizod trwa przez powiadomienie, tekst operatora i komende lokalna — do nastepnego skilla', () => {
  const e = epizod('dev-plan')
  assert.deepEqual([...e.odpowiedzi.keys()], ['m1', 'm2', 'm3', 'm4'])
  assert.equal(e.zamkniety, true)
})

test('pierwsza odpowiedz konczy sie na pierwszej wiadomosci typu user (ciaglosc z koszt_skilli.py)', () => {
  assert.deepEqual([...epizod('dev-plan').pierwszaOdpowiedz.keys()], ['m1'])
})

test('wiadomosci operatora: tylko tekst czlowieka (bez powiadomien i komend lokalnych)', () => {
  assert.deepEqual([...epizod('dev-plan').operator], ['u3'])
})

test('skill wywolany narzedziem Skill otwiera nowy epizod i zamyka poprzedni', () => {
  assert.deepEqual([...epizod('dev-docs').odpowiedzi.keys()], ['m5'])
  const compound = epizod('dev-compound')
  assert.equal(compound.zrodlo, 'Skill-tool')
  assert.deepEqual([...compound.odpowiedzi.keys()], ['m6', 'm7'])
  assert.equal(compound.zamkniety, false, 'ostatni epizod pliku jest otwarty — zamyka go dopiero cisza w pliku sesji')
})

test('narzedzia epizodu: Agent i Workflow liczone osobno, subagenci po id wywolania', () => {
  assert.deepEqual([...epizod('dev-plan').subagenci], ['agent-1'])
  assert.equal(epizod('dev-docs').wywolania.workflow, 1)
})

test('sesja wznowiona: kopia wpisow w nowym pliku nie dubluje kosztu', () => {
  const kopia = epizodySesji([...SESJA.slice(0, 4), asystent('m9', 1000)], 'sesja-2')
  const oryginal = epizodySesji(SESJA, 'sesja-1')
  const scalone = scalEpizody([...oryginal, ...kopia])
  const plan = scalone.find((e) => e.skill === 'dev-plan')
  assert.ok(plan)
  assert.deepEqual([...plan.odpowiedzi.keys()].sort(), ['m1', 'm2', 'm3', 'm4', 'm9'])
  assert.equal(plan.sesja, 'sesja-1', 'sesja = plik, w ktorym epizod zaczal sie najwczesniej')
})

test('rekord skill: koszt wlasny, pierwsza odpowiedz, subagenci, wiadomosci operatora, okno', () => {
  const r = rekordSkilla(epizod('dev-plan'), () => 1000)
  assert.equal(r.typ, 'skill')
  assert.equal(r.skill, 'dev-plan')
  assert.equal(r.koszt_jedn, Math.round((100 + 200 + 300 + 50) * 1.25))
  assert.equal(r.pierwsza_odpowiedz_jedn, 125)
  assert.equal(r.subagenci_n, 1)
  assert.equal(r.subagenci_jedn, 1000)
  assert.equal(r.wiadomosci_operatora, 1)
  assert.equal(r.okno_h, 2)
  assert.equal(r.tury, 4)
})

test('subagent bez transkryptu: koszt nieznany nie jest zerem', () => {
  const r = rekordSkilla(epizod('dev-plan'), () => null)
  assert.equal(r.subagenci_n, 1)
  assert.equal(r.subagenci_jedn, null)
})

test('/exit i inne komendy wbudowane nie sa skillami', () => {
  const e = epizodySesji([
    user('u1', '<command-name>/dev-plan</command-name>'),
    asystent('m1', 10),
    user('u2', '<command-name>/exit</command-name>'),
    asystent('m2', 10),
  ], 's')
  assert.deepEqual(e.map((x) => x.skill), ['dev-plan'])
})

test('skill wywolany w pierwszej odpowiedzi innego skilla nie otwiera epizodu (zagniezdzenie)', () => {
  const zagniezdzony = epizodySesji([
    user('u1', '<command-name>/dev-pr</command-name>'),
    asystent('m1', 10, [{ type: 'tool_use', id: 's-9', name: 'Skill', input: { skill: 'dev-compound' } }]),
  ], 's')
  assert.deepEqual(zagniezdzony.map((e) => e.skill), ['dev-pr'])
})

test('artefakty: wyniki plan.mjs z epizodu dev-plan — rozmiary, budzet, odrzucenia walidacji, ostatnia bramka gotowosci', () => {
  /** @param {string} id @param {string} command */
  const bash = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } })
  /** @param {string} uuid @param {string} id @param {unknown} wynik @param {boolean} [tablica] */
  const wynik = (uuid, id, wynik, tablica = false) => {
    const tekstWyniku = `${JSON.stringify(wynik)}\n`
    return user(uuid, [{ type: 'tool_result', tool_use_id: id, content: tablica ? [{ type: 'text', text: tekstWyniku }] : tekstWyniku }])
  }
  const bledy = ['IU-2: `src/a.ts` po zmianie 380 linii > 360 (próg ESLint max-lines) — zaplanuj wydzielenie', 'IU-1: brak plików w polu Pliki']
  const e = epizodySesji([
    user('u1', '<command-name>/dev-plan</command-name>'),
    asystent('m1', 10, [bash('b1', 'node .claude/scripts/plan/plan.mjs sprawdz docs/plans/x-plan.md')]),
    wynik('r1', 'b1', { ok: false, bledy, uwagi: [] }),
    asystent('m2', 10, [bash('b2', 'node .claude/scripts/plan/plan.mjs sprawdz docs/plans/x-plan.md')]),
    wynik('r2', 'b2', { ok: true, bledy: [], uwagi: [] }, true),
    asystent('m3', 10, [bash('b3', 'node .claude/scripts/plan/plan.mjs generuj docs/plans/x-plan.md --zapisz')]),
    wynik('r3', 'b3', { ok: true, liczniki: { fazy: 1, iu: 3 }, rozmiary: { plan_zn: 20480, zadania_zn: 3072 },
      budzet: { iu_z_wymiarami: 1, wydzielenia: 1 }, zapisane: ['a'], odmowa: null }),
    asystent('m4', 10, [bash('b4', 'node .claude/scripts/plan/plan.mjs gotowosc docs/active/x'), bash('b5', 'git status --short')]),
    wynik('r4', 'b4', { ok: false, plan: { ok: true }, e2e: { ok: false }, przygotowanie: { ok: true }, git: { ok: false } }),
    asystent('m5', 10, [bash('b6', 'node .claude/scripts/plan/plan.mjs gotowosc docs/active/x')]),
    wynik('r5', 'b6', 'plan: brak pliku'),
  ], 's')
  const r = rekordSkilla(e[0], () => 0)
  assert.deepEqual(r.artefakty, {
    plan_kb: 20, zadania_kb: 3, iu: 3, iu_z_wymiarami: 1, wydzielenia: 1,
    walidacja: { n: 2, odrzucone: 1, bledy_pierwszy: 2, bledy_budzetu_pierwszy: 1 },
    gotowosc: { n: 2, ok_ostatnia: false, czerwone_ostatnia: ['e2e', 'git'] },
  }, 'wynik bez JSON (b6) nie nadpisuje ostatniej odczytanej bramki')
  assert.equal(rekordSkilla(epizod('dev-compound'), () => 0).artefakty, null, 'epizod bez plan.mjs: artefakty null')
})

test('artefakty: wynik plan.mjs przepuszczony przez jq (JSON wieloliniowy) i opcja --projekt przed poleceniem', () => {
  const e = epizodySesji([
    user('u1', '<command-name>/dev-plan</command-name>'),
    asystent('m1', 10, [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node .claude/scripts/plan/plan.mjs --projekt . sprawdz x.md | jq .' } }]),
    user('r1', [{ type: 'tool_result', tool_use_id: 'b1', content: `Exit code 1\n${JSON.stringify({ ok: false, bledy: ['a'], uwagi: [] }, null, 2)}` }]),
  ], 's')
  const a = rekordSkilla(e[0], () => 0).artefakty
  assert.deepEqual(a?.walidacja, { n: 1, odrzucone: 1, bledy_pierwszy: 1, bledy_budzetu_pierwszy: 0 })
})

// P17 (vibersi, 6a pkt 80 j): /dev-plan czekal na logowanie do Figmy, operator napisal „gotowe”, plan wywolal narzedziem Skill
// figma:figma-design-to-code (krok 1.6). To krok planu, nie nowy epizod — wczesniej plan urywal sie po 6 turach.
test('skill pomocniczy wywolany narzedziem w epizodzie operatora = krok tego epizodu (zagniezdzone); dev-* narzedziem = nowy epizod', () => {
  const sesja = [
    user('p1', '<command-name>/dev-plan</command-name>'),
    asystent('n1', 100),
    user('p2', 'gotowe'),
    asystent('n2', 10, [{ type: 'tool_use', id: 's-figma', name: 'Skill', input: { skill: 'figma:figma-design-to-code' } }]),
    asystent('n3', 500, [{ type: 'tool_use', id: 'mcp-1', name: 'mcp__plugin_figma_figma__get_design_context' }]),
    asystent('n4', 200, [{ type: 'tool_use', id: 's-dev', name: 'Skill', input: { skill: 'dev-compound' } }]),
    asystent('n5', 20),
  ]
  const [plan, compound, ...reszta] = epizodySesji(sesja, 'sesja-v')
  assert.equal(reszta.length, 0)
  assert.equal(plan.skill, 'dev-plan')
  assert.deepEqual([...plan.odpowiedzi.keys()], ['n1', 'n2', 'n3'])
  assert.deepEqual([...plan.zagniezdzone], ['figma:figma-design-to-code'])
  assert.equal(compound.skill, 'dev-compound')
  assert.deepEqual(rekordSkilla(plan, () => 0).zagniezdzone, ['figma:figma-design-to-code'])
})

// P20 A8: epizod /dev-plan konczy sie na wywolaniu Workflow — vibersi etap-2-poprawki: 2,91 M w telemetrii, do Workflow 0,78 M
// (sesja czekala na run i robila odczyt). /dev-pr woła dev-pr-wf w kazdym etapie, wiec jego epizod trwa dalej.
test('dev-plan: wywolanie Workflow zamyka epizod (odpowiedz z wywolaniem w epizodzie, dalsze poza); dev-pr trwa przez Workflow', () => {
  const sesja = [
    user('u1', '<command-name>/dev-plan</command-name>'),
    asystent('m1', 100),
    asystent('m2', 200, [{ type: 'tool_use', id: 'wf-1', name: 'Workflow' }]),
    user('u-wf', [{ type: 'tool_result', tool_use_id: 'wf-1', content: 'uruchomiony' }]),
    asystent('m2b', 700),
    user('u2', '<task-notification>workflow skonczyl</task-notification>'),
    asystent('m3', 5000),
    user('u3', '<command-name>/dev-pr</command-name>'),
    asystent('m4', 10, [{ type: 'tool_use', id: 'wf-2', name: 'Workflow' }]),
    asystent('m5', 20, [{ type: 'tool_use', id: 'wf-3', name: 'Workflow' }]),
  ]
  const [plan, pr] = epizodySesji(sesja, 's')
  assert.deepEqual([...plan.odpowiedzi.keys()], ['m1', 'm2'])
  assert.equal(plan.zamkniety, true)
  assert.equal(plan.wywolania.workflow, 1)
  assert.equal(pr.skill, 'dev-pr')
  assert.deepEqual([...pr.odpowiedzi.keys()], ['m4', 'm5'])
  assert.equal(pr.wywolania.workflow, 2)
})

test('ctx_start: kontekst pierwszej odpowiedzi epizodu (in + cache_w + cache_r), nie maksimum', () => {
  const sesja = [
    user('u1', 'praca przed skillem'),
    asystent('m0', 9000),
    user('u2', '<command-name>/dev-plan</command-name>'),
    { ...asystent('m1', 0), message: { id: 'm1', content: [], usage: { input_tokens: 3, cache_creation_input_tokens: 2000, cache_read_input_tokens: 215_000, output_tokens: 9 } } },
    asystent('m2', 300_000),
  ]
  const [plan] = epizodySesji(sesja, 's')
  assert.equal(rekordSkilla(plan, () => 0).ctx_start, 217_003)
})

test('ctx_start po scaleniu kopii wznowionej sesji: z kopii, w ktorej epizod zaczal sie najwczesniej', () => {
  const otwarcie = [user('u1', '<command-name>/dev-plan</command-name>', { timestamp: '2026-09-20T10:00:00.000Z' })]
  const pierwsza = epizodySesji([...otwarcie, asystent('m1', 70_000)], 'sesja-1')
  const kopia = epizodySesji([...otwarcie, asystent('m9', 300_000)], 'sesja-2').map((e) => ({ ...e, start: '2026-09-20T11:00:00.000Z' }))
  const [scalony] = scalEpizody([...kopia, ...pierwsza])
  assert.equal(scalony.ctxStart, 70_000)
})

// E5-19 (vibersi c2bba459, 2026-10-21): model wywolal sync-template narzedziem Skill jako punkt 1 polecenia operatora, potem
// smoke przez 14 wiadomosci operatora i 158 tur — epizod sync-template trwal do nastepnego skilla (6,6 M z subagentami E2E).
test('skill pomocniczy wywolany narzedziem konczy sie z tura; dalsza praca operatora = „sesja glowna bez skilla” do nastepnego skilla', () => {
  const sesja = [
    user('o1', 'Punkt 1: uruchom /sync-template. Punkt 2: srodowisko E2E.'),
    asystent('a1', 10, [{ type: 'tool_use', id: 's-sync', name: 'Skill', input: { skill: 'sync-template' } }]),
    asystent('a2', 20, [{ type: 'tool_use', id: 'b-1', name: 'Bash' }]),
    user('t1', [{ type: 'tool_result', tool_use_id: 'b-1', content: 'ok' }]),
    asystent('a3', 30),
    user('o2', 'dalej'),
    asystent('a4', 400, [{ type: 'tool_use', id: 'agent-e2e', name: 'Agent' }]),
    user('n1', '<task-notification>tester skonczyl</task-notification>'),
    asystent('a5', 500),
    user('o3', 'popraw Turnstile'),
    asystent('a6', 600),
    asystent('a7', 10, [{ type: 'tool_use', id: 's-figma', name: 'Skill', input: { skill: 'figma:figma-use' } }]),
    asystent('a8', 20),
  ]
  const [sync, bezSkilla, figma, ...reszta] = epizodySesji(sesja, 's')
  assert.equal(reszta.length, 0)
  assert.equal(sync.skill, 'sync-template')
  assert.deepEqual([...sync.odpowiedzi.keys()], ['a1', 'a2', 'a3'])
  assert.equal(sync.zamkniety, true)
  assert.equal(sync.operator.size, 0)
  assert.equal(bezSkilla.skill, SESJA_BEZ_SKILLA)
  assert.equal(bezSkilla.zrodlo, 'bez-skilla')
  assert.equal(bezSkilla.klucz, 'o2')
  assert.deepEqual([...bezSkilla.odpowiedzi.keys()], ['a4', 'a5', 'a6'])
  assert.deepEqual([...bezSkilla.operator], ['o2', 'o3'])
  assert.deepEqual([...bezSkilla.subagenci], ['agent-e2e'])
  assert.equal(bezSkilla.zamkniety, true)
  assert.equal(figma.skill, 'figma:figma-use')
  assert.deepEqual([...figma.odpowiedzi.keys()], ['a7', 'a8'])
})

test('skill pipeline\'u (dev-*) wywolany narzedziem i skill z komendy operatora trwaja przez wiadomosci operatora (dialog)', () => {
  const sesja = [
    user('o1', 'zrobmy brainstorm'),
    asystent('a1', 10, [{ type: 'tool_use', id: 's-b', name: 'Skill', input: { skill: 'dev-brainstorm' } }]),
    user('o2', 'odpowiedz na pytanie 1'),
    asystent('a2', 20),
  ]
  const [brainstorm, ...reszta] = epizodySesji(sesja, 's')
  assert.equal(reszta.length, 0)
  assert.deepEqual([...brainstorm.odpowiedzi.keys()], ['a1', 'a2'])
  assert.deepEqual([...brainstorm.operator], ['o2'])
})

test('/clear zamyka epizod; praca po nim = „sesja glowna bez skilla”; po_clear w rekordzie epizodu po /clear', () => {
  const clear = '<command-name>/clear</command-name>\n            <command-message>clear</command-message>'
  const sesja = [
    user('c0', clear),
    user('o1', '<command-name>/sync-template</command-name>'),
    asystent('a1', 10),
    user('c1', clear),
    user('o2', 'teraz smoke'),
    asystent('a2', 900),
  ]
  const [sync, bezSkilla, ...reszta] = epizodySesji(sesja, 's')
  assert.equal(reszta.length, 0)
  assert.deepEqual([...sync.odpowiedzi.keys()], ['a1'])
  assert.equal(sync.zamkniety, true)
  assert.equal(rekordSkilla(sync, () => 0).po_clear, true, 'plik sesji zaczal sie od /clear — to nie kontynuacja poprzedniej sesji')
  assert.equal(bezSkilla.skill, SESJA_BEZ_SKILLA)
  assert.deepEqual([...bezSkilla.odpowiedzi.keys()], ['a2'])
  assert.equal(rekordSkilla(epizod('dev-plan'), () => 0).po_clear, false)
})

// Recenzja S4 (F1): zroastuj-mnie wolany narzedziem prowadzi dialog (Nawykometr 540559b7: 18 odpowiedzi i 7 wiadomosci
// operatora → 4 i 0 przy regule „kazdy skill spoza dev-* konczy sie z tura”). Z tura koncza sie tylko skille-kroki z listy.
test('skill dialogowy spoza dev-* wolany narzedziem trwa przez wiadomosci operatora; skill-krok (lista, figma:*) konczy sie z tura', () => {
  /** @param {string} nazwa */
  const sesja = (nazwa) => [
    user('o1', 'zrob to'),
    asystent('a1', 10, [{ type: 'tool_use', id: 's-1', name: 'Skill', input: { skill: nazwa } }]),
    user('o2', 'odpowiedz operatora'),
    asystent('a2', 20),
  ]
  for (const nazwa of ['zroastuj-mnie', 'makieta', 'utworz-zadanie']) {
    const [e, ...reszta] = epizodySesji(sesja(nazwa), 's')
    assert.equal(reszta.length, 0, nazwa)
    assert.deepEqual([...e.odpowiedzi.keys()], ['a1', 'a2'], nazwa)
  }
  for (const nazwa of ['sync-template', 'figma:figma-use', 'security']) {
    const [e, bez] = epizodySesji(sesja(nazwa), 's')
    assert.deepEqual([...e.odpowiedzi.keys()], ['a1'], nazwa)
    assert.equal(bez.skill, SESJA_BEZ_SKILLA, nazwa)
  }
})
