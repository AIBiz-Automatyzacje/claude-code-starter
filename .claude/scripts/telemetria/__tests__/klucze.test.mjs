// Test skanu kluczy w transkryptach agentow runu (znaleziska 2026-11-02 pkt 32: dashboard, run E2, faza 4 — klucz Stripe
// z .env w wyjsciu testu, a wiec w transkrypcie agenta). Skan zwraca nazwe wzorca, pliki i liczbe trafien, nigdy wartosc.
// Klucze fixture'ow sa skladane w kodzie z kawalkow: literal w zrodle testu trafilby do transkryptu kazdego agenta, ktory
// czyta ten plik, i sam dawalby trafienie.
//
// Uruchomienie: node --test .claude/scripts/telemetria/__tests__/klucze.test.mjs

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { otwarteTrafienia, plikKluczy, potwierdzRun, skanujTranskrypty, wierszeDoctora, wzorceWTekscie, zapiszTrafienia, WZORCE_KLUCZY } from '../klucze.mjs'
import { zbierzWszystko } from '../zbieranie.mjs'
import { odczytajRekordy } from '../zapis.mjs'
import { jsonl, zbudujFixture } from './fixture-projekty.mjs'

const KATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALFABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const WIELKIE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
/** @param {number} n @param {string} [alfabet] @returns {string} tresc klucza o dlugosci n, rozne znaki */
const tresc = (n, alfabet = ALFABET) => Array.from({ length: n }, (_, i) => alfabet[(i * 7 + 3) % alfabet.length]).join('')

// nazwa wzorca → [prefiks w kawalkach, tresc]
/** @type {Record<string, [string[], string]>} */
const KLUCZE = {
  'stripe-sk-live': [['sk', '_live_'], tresc(32)],
  'stripe-rk-live': [['rk', '_live_'], tresc(99)],
  'stripe-whsec': [['wh', 'sec_'], tresc(32)],
  'github-ghp': [['gh', 'p_'], tresc(36)],
  'github-pat': [['github', '_pat_'], `${tresc(22)}_${tresc(59)}`],
  anthropic: [['sk', '-ant-'], `api03-${tresc(60)}`],
  'openai-proj': [['sk', '-proj-'], tresc(48)],
  'aws-akia': [['AK', 'IA'], tresc(16, WIELKIE)],
  'supabase-secret': [['sb', '_secret_'], `${tresc(22)}_${tresc(8)}`],
}
/** @param {string} nazwa @returns {string} pelny klucz fixture'u */
const klucz = (nazwa) => `${KLUCZE[nazwa]?.[0].join('')}${KLUCZE[nazwa]?.[1]}`
/** @param {string} nazwa @returns {string} */
const prefiks = (nazwa) => KLUCZE[nazwa]?.[0].join('') ?? ''

/** @param {string} tekst @param {string} sekret @returns {boolean} tekst niesie sekret albo jego 8-znakowy fragment */
function niesieFragment(tekst, sekret) {
  for (let i = 0; i + 8 <= sekret.length; i++) if (tekst.includes(sekret.slice(i, i + 8))) return true
  return false
}

test('kazdy wzorzec zestawu ma fixture, a klucz z prefiksem i trescia wlasciwej dlugosci jest trafieniem', () => {
  assert.deepEqual(WZORCE_KLUCZY.map((w) => w.nazwa).sort(), Object.keys(KLUCZE).sort())
  for (const nazwa of Object.keys(KLUCZE)) {
    assert.deepEqual(wzorceWTekscie(`Settings(stripe_api_key='${klucz(nazwa)}', debug=False)`), [{ wzorzec: nazwa, trafien: 1 }], nazwa)
  }
})

test('transkrypt JSONL: klucz po sekwencji \\n i dwa klucze w jednej linii sa liczone', () => {
  const linia = JSON.stringify({ type: 'user', message: { content: `E   ValidationError\n${klucz('aws-akia')}\n${klucz('stripe-rk-live')} ${klucz('stripe-rk-live')}` } })
  assert.deepEqual(wzorceWTekscie(linia), [{ wzorzec: 'stripe-rk-live', trafien: 2 }, { wzorzec: 'aws-akia', trafien: 1 }])
})

test('literal z dokumentacji nie jest trafieniem: sam prefiks, wielokropek, za krotka tresc, wypelniacz, klucz przykladowy', () => {
  const literaly = [
    `${prefiks('stripe-sk-live')}...`, `${prefiks('stripe-rk-live')}…`, `${prefiks('stripe-whsec')}xxx`, `${prefiks('supabase-secret')}test`,
    `STRIPE_SECRET_KEY=${prefiks('stripe-sk-live')}${tresc(12)}`,
    `${prefiks('stripe-sk-live')}${'x'.repeat(32)}`, `${prefiks('github-ghp')}${'0'.repeat(36)}`,
    `${prefiks('aws-akia')}IOSFODNN7EXAMPLE`, `BAKIA${tresc(16, WIELKIE)}`, `${prefiks('aws-akia')}${tresc(20, WIELKIE)}`,
    `${prefiks('anthropic')}api03-...`, `${prefiks('openai-proj')}<klucz>`,
    `${prefiks('supabase-secret')}placeholder-wklej-tutaj-klucz`, `${prefiks('anthropic')}${'twoj-klucz-z-konsoli-'.repeat(2)}`,
  ]
  for (const l of literaly) assert.deepEqual(wzorceWTekscie(`Ustaw \`${l}\` w zmiennych srodowiska.`), [], l)
})

// `supabase status` wypisuje klucz serwisowy lokalnego stosu: jawny i taki sam na kazdej maszynie. Builder danych wola te
// komende, wiec bez wyjatku kazdy run z lokalna baza dawalby uwage „zrotuj klucz”.
test('jawny klucz lokalnego stosu Supabase CLI nie jest trafieniem; inny klucz tego samego ksztaltu jest', () => {
  const lokalny = [prefiks('supabase-secret'), 'N7UND0UgjKTVK', '-Uodkm0Hg', '_xSvEMPvz'].join('')
  assert.deepEqual(wzorceWTekscie(`Secret key: ${lokalny}\n`), [])
  assert.deepEqual(wzorceWTekscie(`Secret key: ${lokalny.slice(0, -1)}Q\n`), [{ wzorzec: 'supabase-secret', trafien: 1 }])
})

test('wynik skanu nie zawiera wartosci klucza ani jej fragmentu', () => {
  const tekst = Object.keys(KLUCZE).map((n) => `${n}=${klucz(n)}`).join('\n')
  const wynik = JSON.stringify(wzorceWTekscie(tekst))
  assert.equal(JSON.parse(wynik).length, Object.keys(KLUCZE).length)
  for (const nazwa of Object.keys(KLUCZE)) assert.equal(niesieFragment(wynik, KLUCZE[nazwa]?.[1] ?? ''), false, nazwa)
})

/** @param {(katalog: string) => void} cialo */
function zKatalogiem(cialo) {
  const katalog = mkdtempSync(join(tmpdir(), 'klucze-'))
  try {
    cialo(katalog)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
}

test('skanujTranskrypty: pliki agentow runu z trafieniem per wzorzec; journal i meta poza skanem', () => zKatalogiem((run) => {
  writeFileSync(join(run, 'agent-a1.jsonl'), jsonl([{ type: 'user', message: { content: `wynik testu: ${klucz('stripe-rk-live')}` } }]))
  writeFileSync(join(run, 'agent-a2.jsonl'), jsonl([{ type: 'user', message: { content: 'czysty transkrypt' } }]))
  writeFileSync(join(run, 'agent-a3.jsonl'), jsonl([{ type: 'user', message: { content: `${klucz('stripe-rk-live')} i ${klucz('github-ghp')}` } }]))
  writeFileSync(join(run, 'agent-a1.meta.json'), JSON.stringify({ description: klucz('aws-akia') }))
  writeFileSync(join(run, 'journal.jsonl'), jsonl([{ type: 'result', result: klucz('aws-akia') }]))
  assert.deepEqual(skanujTranskrypty(run), [
    { wzorzec: 'stripe-rk-live', pliki: ['agent-a1.jsonl', 'agent-a3.jsonl'], trafien: 2 },
    { wzorzec: 'github-ghp', pliki: ['agent-a3.jsonl'], trafien: 1 },
  ])
}))

const TERAZ = Date.parse('2026-11-07T18:00:00.000Z')
const KONTEKST = { run: 'wf_2e0ed17c-f7b', projekt: 'dashboard', repo: '/Users/u/Kodowanie/dashboard', katalog: '/Users/u/.claude/projects/x/s/subagents/workflows/wf_2e0ed17c-f7b', terazMs: TERAZ }
const TRAFIENIE = { wzorzec: 'stripe-rk-live', pliki: ['agent-afab.jsonl'], trafien: 1 }

test('zapis: rekord niesie wzorzec, pliki, liczbe, run, date i miejsce; bez trafien plik nie powstaje', () => zKatalogiem((k) => {
  const plik = join(k, 'klucze.jsonl')
  assert.equal(zapiszTrafienia(plik, [], KONTEKST), 0)
  assert.equal(existsSync(plik), false)
  assert.equal(zapiszTrafienia(plik, [TRAFIENIE], KONTEKST), 1)
  assert.deepEqual(otwarteTrafienia(plik), [{
    klucz: 'wf_2e0ed17c-f7b|stripe-rk-live', typ: 'klucz', ts: '2026-11-07T18:00:00.000Z', run: 'wf_2e0ed17c-f7b', projekt: 'dashboard',
    repo: KONTEKST.repo, katalog: KONTEKST.katalog, wzorzec: 'stripe-rk-live', pliki: ['agent-afab.jsonl'], trafien: 1, potwierdzone: null,
  }])
}))

test('potwierdzenie operatora zamyka uwage; ponowny skan z ta sama trescia jej nie otwiera, nowe trafienie otwiera', () => zKatalogiem((k) => {
  const plik = join(k, 'klucze.jsonl')
  zapiszTrafienia(plik, [TRAFIENIE, { wzorzec: 'github-ghp', pliki: ['agent-b.jsonl'], trafien: 2 }], KONTEKST)
  zapiszTrafienia(plik, [TRAFIENIE], { ...KONTEKST, run: 'wf_inny' })
  assert.equal(potwierdzRun(plik, 'wf_brak', TERAZ + 1000), 0)
  assert.equal(potwierdzRun(plik, KONTEKST.run, TERAZ + 1000), 2)
  assert.deepEqual(otwarteTrafienia(plik).map((r) => r.run), ['wf_inny'], 'potwierdzenie dotyczy jednego runu')
  assert.equal(zapiszTrafienia(plik, [TRAFIENIE], { ...KONTEKST, terazMs: TERAZ + 2000 }), 0, 'ten sam wynik skanu nie cofa potwierdzenia')
  assert.deepEqual(otwarteTrafienia(plik).map((r) => r.run), ['wf_inny'])
  assert.equal(zapiszTrafienia(plik, [{ ...TRAFIENIE, pliki: ['agent-afab.jsonl', 'agent-nowy.jsonl'], trafien: 2 }], { ...KONTEKST, terazMs: TERAZ + 3000 }), 1)
  assert.deepEqual(otwarteTrafienia(plik).map((r) => [r.run, r.trafien]), [[KONTEKST.run, 2], ['wf_inny', 1]])
}))

test('wiersze doctora: UWAGA z runem, wzorcem, liczba plikow i komenda potwierdzenia; tylko runy tego projektu i bez repo', () => zKatalogiem((k) => {
  const plik = join(k, 'klucze.jsonl')
  const projekt = join(k, 'projekt')
  mkdirSync(projekt)
  zapiszTrafienia(plik, [{ ...TRAFIENIE, pliki: ['agent-a.jsonl', 'agent-b.jsonl'], trafien: 3 }], { ...KONTEKST, repo: projekt })
  zapiszTrafienia(plik, [TRAFIENIE], { ...KONTEKST, run: 'wf_obcy', repo: join(k, 'inny-projekt') })
  zapiszTrafienia(plik, [TRAFIENIE], { ...KONTEKST, run: 'wf_bez_repo', repo: null })
  assert.deepEqual(wierszeDoctora(plik, projekt), [
    ['klucz w transkryptach', 'UWAGA', 'w transkryptach runu wf_2e0ed17c-f7b jest wzorzec klucza stripe-rk-live (2 pliki) — zrotuj klucz', 'po rotacji: node .claude/scripts/telemetria/klucze.mjs --potwierdz wf_2e0ed17c-f7b'],
    ['klucz w transkryptach', 'UWAGA', 'w transkryptach runu wf_bez_repo jest wzorzec klucza stripe-rk-live (1 plik) — zrotuj klucz', 'po rotacji: node .claude/scripts/telemetria/klucze.mjs --potwierdz wf_bez_repo'],
  ])
  assert.deepEqual(wierszeDoctora(join(k, 'brak.jsonl'), projekt), [], 'brak pliku trafien = brak wierszy')
}))

test('CLI: --potwierdz zamyka uwage (exit 0), nieznany run to exit 1, bez argumentow exit 2', () => zKatalogiem((k) => {
  const plik = join(k, 'klucze.jsonl')
  const projekt = join(k, 'projekt')
  mkdirSync(projekt)
  zapiszTrafienia(plik, [TRAFIENIE], { ...KONTEKST, repo: projekt })
  const cli = (/** @type {string[]} */ ...argumenty) => spawnSync(process.execPath, [join(KATALOG, 'klucze.mjs'), ...argumenty, '--plik', plik], { encoding: 'utf8' })
  assert.match(cli('--doctor', projekt).stdout, /^klucz w transkryptach\tUWAGA\t.*wf_2e0ed17c-f7b.*\tpo rotacji: /)
  assert.equal(cli('--potwierdz', 'wf_literowka').status, 1)
  const potwierdzenie = cli('--potwierdz', KONTEKST.run)
  assert.equal(potwierdzenie.status, 0, potwierdzenie.stderr)
  assert.equal(potwierdzenie.stdout, 'potwierdzono: wf_2e0ed17c-f7b, wzorcow: 1\n')
  assert.equal(cli('--doctor', projekt).stdout, '')
  assert.equal(cli().status, 2)
}))

// ── Skan w zbieraniu telemetrii: po kazdym odczytanym runie, obok pliku danych, bez wplywu na rekordy i hook ──

/** @param {(k: { projekty: string, plik: string, bledy: string, transkrypt: string }) => void} cialo */
function zFixture(cialo) {
  const projekty = zbudujFixture()
  const wyjscie = mkdtempSync(join(tmpdir(), 'klucze-wyjscie-'))
  const transkrypt = join(projekty, '-Users-u-Kodowanie-projekt', 'sesja-1', 'subagents', 'workflows', 'wf_aaa-111', 'agent-a1.jsonl')
  appendFileSync(transkrypt, jsonl([{ type: 'user', message: { content: [{ type: 'tool_result', content: `E  Settings(stripe_api_key='${klucz('stripe-rk-live')}')` }] } }]))
  try {
    cialo({ projekty, plik: join(wyjscie, 'pipeline.jsonl'), bledy: join(wyjscie, 'bledy.log'), transkrypt })
  } finally {
    rmSync(projekty, { recursive: true, force: true })
    rmSync(wyjscie, { recursive: true, force: true })
  }
}

test('zbieranie: klucz w transkrypcie agenta runu → rekord obok pliku danych, bez wartosci; drugi skan nic nie dopisuje', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const we = { projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() }
    assert.equal(zbierzWszystko(we)?.bledow, 0)
    const klucze = plikKluczy(plik)
    assert.deepEqual(otwarteTrafienia(klucze).map((r) => [r.run, r.projekt, r.wzorzec, r.pliki, r.trafien]),
      [['wf_aaa-111', 'projekt', 'stripe-rk-live', ['agent-a1.jsonl'], 1]])
    for (const zapisany of [klucze, plik]) {
      assert.equal(niesieFragment(readFileSync(zapisany, 'utf8'), KLUCZE['stripe-rk-live']?.[1] ?? ''), false, `${zapisany} niesie fragment klucza`)
    }
    const rozmiar = readFileSync(klucze, 'utf8').length
    zbierzWszystko({ ...we, terazMs: TERAZ + 60_000 })
    assert.equal(readFileSync(klucze, 'utf8').length, rozmiar)
  })
})

test('zbieranie: awaria skanu kluczy idzie do logu i licznika bledow, rekordy runu zostaja zapisane', () => {
  zFixture(({ projekty, plik, bledy }) => {
    // Plik trafien, ktorego nie da sie przeczytac (katalog w jego miejscu), wywraca zapis skanu.
    mkdirSync(plikKluczy(plik), { recursive: true })
    const wynik = zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
    assert.equal(wynik?.bledow, 1)
    assert.ok(odczytajRekordy(plik).ostatnie.has('wf_aaa-111|run|wf_aaa-111'), 'rekord runu mimo awarii skanu')
    assert.ok(odczytajRekordy(plik).ostatnie.has('wf_aaa-111|agent|a1'))
    assert.match(readFileSync(bledy, 'utf8'), /\[klucze wf_aaa-111\]/)
  })
})

test('hook Stop: niemy takze przy trafieniu (pusty stdout i stderr, exit 0), wynik w pliku trafien', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const w = spawnSync(process.execPath, [join(KATALOG, 'zbierz.mjs'), '--hook', '--projekty', projekty, '--plik', plik, '--bledy', bledy, '--znacznik', join(dirname(plik), 'znacznik.txt')],
      { input: JSON.stringify({ session_id: 'inna-sesja', hook_event_name: 'Stop', background_tasks: [] }), encoding: 'utf8' })
    assert.deepEqual([w.status, w.stdout, w.stderr], [0, '', ''])
    assert.deepEqual(otwarteTrafienia(plikKluczy(plik)).map((r) => [r.run, r.wzorzec]), [['wf_aaa-111', 'stripe-rk-live']])
  })
})

test('raport telemetrii: sekcja z niepotwierdzonymi trafieniami, bez wartosci klucza', () => zKatalogiem((k) => {
  const plik = join(k, 'pipeline.jsonl')
  writeFileSync(plik, '')
  zapiszTrafienia(plikKluczy(plik), [TRAFIENIE], KONTEKST)
  const w = spawnSync(process.execPath, [join(KATALOG, 'raport.mjs'), '--od', '2026-11-01', '--do', '2026-11-30', '--bez-skanu', '--plik', plik, '--wyj', k], { encoding: 'utf8' })
  assert.equal(w.status, 0, w.stderr)
  const txt = readFileSync(join(k, 'raport-2026-11-01_2026-11-30.txt'), 'utf8')
  assert.match(txt, /8\. Wzorce kluczy w transkryptach runow, niepotwierdzone \(po rotacji klucza: klucze\.mjs --potwierdz <run>\)\n {3}wf_2e0ed17c-f7b dashboard: stripe-rk-live, plikow 1, trafien 1\n/)
  potwierdzRun(plikKluczy(plik), KONTEKST.run, TERAZ + 1000)
  spawnSync(process.execPath, [join(KATALOG, 'raport.mjs'), '--od', '2026-11-01', '--do', '2026-11-30', '--bez-skanu', '--plik', plik, '--wyj', k], { encoding: 'utf8' })
  assert.match(readFileSync(join(k, 'raport-2026-11-01_2026-11-30.txt'), 'utf8'), /8\. Wzorce kluczy[^\n]*\n {3}brak\n/)
}))
