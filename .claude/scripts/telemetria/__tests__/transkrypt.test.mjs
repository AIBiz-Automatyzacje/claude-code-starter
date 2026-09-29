// Test analizy transkryptu agenta (It. 1, krok 1) — koszt, kontekst startowy, efort, narzedzia.
// Uruchomienie: pnpm test  (albo: node --test .claude/scripts/telemetria/__tests__/transkrypt.test.mjs)
//
// Dlaczego te przypadki: przeglad D5 (d5-telemetria-rekord.txt §8 pkt 6) pokazal, ze jedna odpowiedz API
// zapisuje sie w transkrypcie jako kilka wpisow z tym samym message.id, a output_tokens rosnie miedzy nimi
// (49% odpowiedzi). Pierwszy wpis zanizal output ~5x — model kosztu etapu 0 byl przez to bledny o 10%.

import test from 'node:test'
import assert from 'node:assert/strict'

import { analizujTranskrypt } from '../transkrypt.mjs'
import { KOSZT_CACHE_READ, KOSZT_CACHE_WRITE, KOSZT_INPUT, KOSZT_OUTPUT } from '../cennik.mjs'

/** @param {Record<string, unknown>} pola */
const zalacznik = (pola) => ({ type: 'attachment', attachment: pola })

/**
 * @param {string} id
 * @param {{ in: number, cw: number, cr: number, out: number, thinking?: number }} u
 * @param {Array<Record<string, unknown>>} [content]
 * @param {Record<string, unknown>} [dodatkowe]
 */
const odpowiedz = (id, u, content = [], dodatkowe = {}) => ({
  type: 'assistant',
  timestamp: '2026-09-23T10:00:00.000Z',
  version: '2.1.283',
  effort: 'high',
  ...dodatkowe,
  message: {
    id,
    model: 'claude-opus-5-5',
    content,
    usage: {
      input_tokens: u.in,
      cache_creation_input_tokens: u.cw,
      cache_read_input_tokens: u.cr,
      output_tokens: u.out,
      output_tokens_details: { thinking_tokens: u.thinking ?? 0 },
    },
  },
})

const PROMPT = 'Jestes reviewerem fazy 2 w folderze docs/active/x.'

const TRANSKRYPT = [
  { type: 'user', timestamp: '2026-09-23T10:00:00.000Z', message: { role: 'user', content: PROMPT } },
  zalacznik({ type: 'deferred_tools_delta', addedNames: ['A', 'B', 'mcp__x__y'], addedLines: ['A', 'B', 'mcp__x__y'] }),
  zalacznik({ type: 'skill_listing', skillCount: 2, content: 'skill-a\nskill-b' }),
  zalacznik({
    type: 'instructions',
    files: [
      { path: '/Users/u/.claude/CLAUDE.md', type: 'User', content: 'x'.repeat(10) },
      { path: '/Users/u/p/CLAUDE.md', type: 'Project', content: 'x'.repeat(100) },
      { path: '/Users/u/p/.claude/rules/coding-rules.md', type: 'Project', content: 'x'.repeat(20) },
      { path: '/Users/u/p/.claude/rules/learned-patterns.md', type: 'Project', content: 'x'.repeat(30) },
      { path: '/Users/u/.claude/projects/p/memory/MEMORY.md', type: 'AutoMem', content: 'x'.repeat(5) },
    ],
  }),
  zalacznik({ type: 'prompt_snapshot', systemPrompt: [], tools: [{ name: 'Read' }, { name: 'Bash' }] }),
  // Odpowiedz 1 w trzech wpisach: output rosnie, input/cache identyczne.
  odpowiedz('m1', { in: 2, cw: 1000, cr: 0, out: 10 }, [{ type: 'thinking' }]),
  odpowiedz('m1', { in: 2, cw: 1000, cr: 0, out: 150, thinking: 20 }, [{ type: 'tool_use', id: 't1', name: 'Read' }]),
  odpowiedz('m1', { in: 2, cw: 1000, cr: 0, out: 185, thinking: 30 }, [{ type: 'tool_use', id: 't2', name: 'Bash' }]),
  { type: 'user', timestamp: '2026-09-23T10:00:30.000Z', message: { role: 'user', content: [{ type: 'tool_result' }] } },
  odpowiedz('m2', { in: 1, cw: 200, cr: 1000, out: 50 }, [{ type: 'tool_use', id: 't3', name: 'mcp__x__y' }], {
    timestamp: '2026-09-23T10:01:40.000Z',
  }),
]

test('odpowiedz API w kilku wpisach liczona RAZ, output z OSTATNIEGO wpisu', () => {
  const t = analizujTranskrypt(TRANSKRYPT)
  assert.equal(t.tury, 2)
  assert.equal(t.out, 185 + 50)
  assert.equal(t.thinking, 30)
  assert.equal(t.cache_w, 1200)
  assert.equal(t.cache_r, 1000)
  assert.equal(t.in, 3)
  const oczekiwany = 3 * KOSZT_INPUT + 1200 * KOSZT_CACHE_WRITE + 1000 * KOSZT_CACHE_READ + 235 * KOSZT_OUTPUT
  assert.equal(t.koszt_jedn, Math.round(oczekiwany))
})

test('ctx_start to kontekst PIERWSZEJ tury, ctx_sr i ctx_max z wszystkich tur', () => {
  const t = analizujTranskrypt(TRANSKRYPT)
  assert.equal(t.ctx_start, 1002)
  assert.equal(t.ctx_max, 1201)
  assert.equal(t.ctx_sr, Math.round((1002 + 1201) / 2))
})

test('efort, model, wersja Claude Code i czas pracy z wpisow transkryptu', () => {
  const t = analizujTranskrypt(TRANSKRYPT)
  assert.equal(t.effort, 'high')
  assert.equal(t.model, 'claude-opus-5-5')
  assert.equal(t.cc_wersja, '2.1.283')
  assert.equal(t.sekundy, 100)
})

test('agent haiku nie ma efortu — pole null, nie domyslna wartosc', () => {
  const haiku = TRANSKRYPT.map((w) => (w.type === 'assistant' ? { ...w, effort: undefined } : w))
  assert.equal(analizujTranskrypt(haiku).effort, null)
})

test('narzedzia liczone po blokach tool_use, z MCP osobno', () => {
  const t = analizujTranskrypt(TRANSKRYPT)
  assert.deepEqual(t.narzedzia, { razem: 3, bash: 1, read: 1, grep: 0, edit: 0, write: 0, structured: 0, mcp: 1 })
})

test('kontekst startowy z zalacznikow przed pierwsza odpowiedzia', () => {
  const k = analizujTranskrypt(TRANSKRYPT).kontekst
  assert.equal(k.claude_md_zn, 110)
  assert.equal(k.rules_zn, 20)
  assert.equal(k.learned_zn, 30)
  assert.equal(k.pamiec_zn, 5)
  assert.equal(k.narzedzia_n, 3)
  assert.equal(k.odroczone_zn, 'A\nB\nmcp__x__y'.length)
  assert.equal(k.skille_n, 2)
  assert.equal(k.skille_zn, 'skill-a\nskill-b'.length)
  assert.equal(k.tools_zn, JSON.stringify([{ name: 'Read' }, { name: 'Bash' }]).length)
  assert.equal(k.instrukcje?.['/Users/u/p/CLAUDE.md'], 100)
})

test('prompt delegacji: dlugosc w znakach z pierwszej wiadomosci user', () => {
  const t = analizujTranskrypt(TRANSKRYPT)
  assert.equal(t.prompt_zn, PROMPT.length)
  assert.equal(t.prompt, PROMPT)
})

test('stary transkrypt bez zalacznikow: kontekst ma klucze z null, nie znika', () => {
  const stary = TRANSKRYPT.filter((w) => w.type !== 'attachment')
  const k = analizujTranskrypt(stary).kontekst
  assert.deepEqual(Object.keys(k).sort(), [
    'claude_md_zn', 'instrukcje', 'learned_zn', 'narzedzia_n', 'odroczone_zn', 'pamiec_zn', 'rules_zn', 'skille_n', 'skille_zn', 'tools_zn',
  ])
  assert.equal(k.claude_md_zn, null)
  assert.equal(k.narzedzia_n, null)
})

test('transkrypt bez zadnej odpowiedzi API: zero tur i koszt 0, ctx_start null', () => {
  const t = analizujTranskrypt(TRANSKRYPT.slice(0, 1))
  assert.equal(t.tury, 0)
  assert.equal(t.koszt_jedn, 0)
  assert.equal(t.ctx_start, null)
})
