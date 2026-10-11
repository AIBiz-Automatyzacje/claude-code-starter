// Czekanie na bota (P18) na nagranych odpowiedziach GitHuba, bez sieci: zegar podstawiony, zrodlo odtwarza os czasu.
// vibersi PR #1: status `CodeRabbit` pending → success na dwoch czubkach, a podsumowanie bota przez caly czas zawiera
// „Reviewing files that changed…” (regresja: sesja czekala do limitu, choc recenzja byla gotowa po 3,5 min).
// Oferty: znaczniki `review paused`, `skip review`, `failure` w podsumowaniu bota.

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { czekajNaBota, KARENCJA_ODPYTAN, rozstrzygnij, znacznikSpecjalny } from '../bot.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = join(KATALOG, '..', 'czekaj-na-bota.mjs')
const VIBERSI = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'vibersi-pr1.json'), 'utf8'))
const OFERTY = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'oferty-znaczniki.json'), 'utf8'))
const CZUBEK_1 = 'b1addf5f71787812fcee6d404163701cbeceb2a3'
const CZUBEK_2 = '4d2bbb8688686cb0b8c0f034b15e43d1de62f74d'
const PR_OTWARTY = { number: 1, state: 'OPEN', headRefOid: CZUBEK_2 }

/** @param {string} iso @param {number} minuty */
const przesun = (iso, minuty) => new Date(Date.parse(iso) + minuty * 60_000).toISOString().replace('.000Z', 'Z')

/**
 * Odtworzenie osi czasu: odpytanie w chwili t widzi statusy i komentarze utworzone do t.
 * @param {{ start: string, pr?: import("../bot.mjs").StanPr, statusy?: any[], komentarze?: any[], commity?: Record<string, string>, bledy?: number }} os
 */
function odtworzenie({ start, pr = PR_OTWARTY, statusy = [], komentarze = [], commity = VIBERSI.commity, bledy = 0 }) {
  let teraz = Date.parse(start)
  let doBledu = bledy
  const odpytania = { pr: 0, komentarze: 0 }
  const widoczne = (/** @type {any[]} */ lista, /** @type {string} */ pole) => lista.filter((x) => Date.parse(x[pole]) <= teraz)
  return {
    odpytania,
    zegar: { teraz: () => teraz, spij: async (/** @type {number} */ ms) => { teraz += ms } },
    zrodlo: {
      pr: async () => {
        odpytania.pr += 1
        if (doBledu > 0) { doBledu -= 1; throw new Error('HTTP 502: Bad Gateway\nszczegoly') }
        return pr
      },
      dataCommita: async (/** @type {string} */ sha) => commity[sha],
      statusy: async (/** @type {string} */ sha) => widoczne(statusy, 'created_at').filter((s) => s.sha === sha),
      komentarze: async () => { odpytania.komentarze += 1; return widoczne(komentarze, 'updated_at') },
    },
  }
}

describe('vibersi PR #1 — status commita zamiast tekstu', () => {
  test('czubek 2: gotowa w pierwszym odpytaniu po success (12:53:33), mimo frazy „Reviewing files…”', async () => {
    assert.match(VIBERSI.komentarze[0].body, /Reviewing files that changed/)
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', statusy: VIBERSI.statusy, komentarze: VIBERSI.komentarze })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.deepEqual(wynik, {
      stan: 'gotowa',
      powod: 'status CodeRabbit success „Review completed” (2026-10-11T12:53:33Z)',
      sha: CZUBEK_2,
      minuty: 4,
    })
  })

  test('czubek 1 podany jawnie (--sha): gotowa po 9,5 min, statusy czubka 2 nie mieszaja sie', async () => {
    const os = odtworzenie({ start: '2026-10-11T12:35:49Z', statusy: VIBERSI.statusy, komentarze: VIBERSI.komentarze })
    const wynik = await czekajNaBota({ ...os, sha: CZUBEK_1, limitMin: 20, coS: 30 })
    assert.equal(wynik.stan, 'gotowa')
    assert.equal(wynik.sha, CZUBEK_1)
    assert.equal(wynik.minuty, 9.5)
    assert.match(wynik.powod, /12:45:12Z/)
  })

  test('pending do konca limitu → limit z ostatnim stanem statusu, bez odpytan komentarzy', async () => {
    const pending = VIBERSI.statusy.filter((/** @type {any} */ s) => s.state === 'pending')
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', statusy: pending, komentarze: VIBERSI.komentarze })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.equal(wynik.stan, 'limit')
    assert.equal(wynik.powod, 'po 20 min status CodeRabbit nadal pending „Review in progress”')
    assert.equal(wynik.minuty, 20)
    assert.equal(os.odpytania.pr, 41)
    // Status pending od 12:50:04, przed koncem karencji — komentarzy nie odpytujemy wcale.
    assert.equal(os.odpytania.komentarze, 0)
  })

  test('brak statusu i znacznika → limit z powodem „brak statusu”', async () => {
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', komentarze: VIBERSI.komentarze })
    const wynik = await czekajNaBota({ ...os, limitMin: 5, coS: 30 })
    assert.equal(wynik.stan, 'limit')
    assert.equal(wynik.powod, 'po 5 min brak statusu CodeRabbit na czubku i brak znacznika stanu bota')
    assert.equal(wynik.minuty, 5)
  })

  test('limit przy --sha innym niz czubek PR → powod nazywa rozjazd', async () => {
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', statusy: VIBERSI.statusy })
    const wynik = await czekajNaBota({ ...os, sha: 'abcdef0123456789abcdef0123456789abcdef01', limitMin: 1, coS: 30 })
    assert.equal(wynik.stan, 'limit')
    assert.equal(wynik.powod, 'po 1 min brak statusu CodeRabbit na czubku i brak znacznika stanu bota (czubek PR to 4d2bbb86, nie abcdef01)')
  })
})

describe('stany specjalne ze znacznikow (archiwum oferty)', () => {
  const OCZEKIWANE = /** @type {Record<string, [string, RegExp]>} */ ({
    'review paused': ['pauza', /Reviews paused: It looks like this branch is under active development/],
    'skip review': ['pominieta', /Review skipped: Review was skipped due to path filters/],
    failure: ['blad', /Review failed: The pull request is closed\./],
  })

  for (const k of OFERTY.komentarze) {
    const [stan, opis] = OCZEKIWANE[k.znacznik]
    test(`PR ${k.pr} „${k.znacznik}” edytowany po commicie → ${stan} po karencji; starszy od commita → limit`, async () => {
      const commit = przesun(k.updated_at, -1)
      const os = odtworzenie({ start: k.updated_at, komentarze: [k], commity: { [CZUBEK_2]: commit } })
      const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
      assert.equal(wynik.stan, stan)
      assert.equal(wynik.minuty, KARENCJA_ODPYTAN * 0.5)
      assert.match(wynik.powod, opis)
      assert.ok(wynik.powod.startsWith(`znacznik „${k.znacznik}” w komentarzu bota (${k.updated_at})`))
      const stary = odtworzenie({ start: k.updated_at, komentarze: [k], commity: { [CZUBEK_2]: przesun(k.updated_at, 1) } })
      const poLimicie = await czekajNaBota({ ...stary, limitMin: 5, coS: 30 })
      assert.equal(poLimicie.stan, 'limit')
    })
  }

  test('podsumowanie wskazuje czubek („between … and <czubek>”) → znacznik wazny mimo zegara commitera z przyszlosci', () => {
    const pominiecie = OFERTY.komentarze.find((/** @type {any} */ k) => k.znacznik === 'skip review')
    const czubek = [...pominiecie.body.matchAll(/between [0-9a-f]{40} and ([0-9a-f]{40})/g)].at(-1)[1]
    const dataCommita = przesun(pominiecie.updated_at, 5)
    assert.equal(znacznikSpecjalny([pominiecie], { dataCommita, czubek })?.stan, 'pominieta')
    assert.equal(znacznikSpecjalny([pominiecie], { dataCommita, czubek: CZUBEK_2 }), null)
  })

  test('karencja: znacznik poprzedniego czubka nie wygrywa z pending ustawionym po pushu', async () => {
    const pominiecie = OFERTY.komentarze.find((/** @type {any} */ k) => k.znacznik === 'skip review')
    const start = pominiecie.updated_at
    const statusy = [
      { context: 'CodeRabbit', state: 'pending', description: 'Review in progress', created_at: przesun(start, 0.2), sha: CZUBEK_2 },
      { context: 'CodeRabbit', state: 'success', description: 'Review completed', created_at: przesun(start, 3), sha: CZUBEK_2 },
    ]
    const os = odtworzenie({ start, statusy, komentarze: [pominiecie], commity: { [CZUBEK_2]: przesun(start, -1) } })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.equal(wynik.stan, 'gotowa')
    assert.equal(os.odpytania.komentarze, 0)
  })

  test('status ma pierwszenstwo przed znacznikiem: success → gotowa, pending → czekamy', () => {
    const pauza = OFERTY.komentarze.find((/** @type {any} */ k) => k.znacznik === 'review paused')
    const odczyt = { pr: PR_OTWARTY, komentarze: [pauza], dataCommita: null, czubek: null }
    const sukces = [{ context: 'CodeRabbit', state: 'success', description: 'Review completed', created_at: '2026-09-08T21:00:00Z' }]
    assert.equal(rozstrzygnij({ ...odczyt, statusy: sukces })?.stan, 'gotowa')
    assert.equal(rozstrzygnij({ ...odczyt, statusy: [{ ...sukces[0], state: 'pending' }] }), null)
    assert.equal(rozstrzygnij({ ...odczyt, statusy: [] })?.stan, 'pauza')
  })

  test('znacznik w komentarzu czlowieka (cytat) nie jest stanem bota', () => {
    const pauza = OFERTY.komentarze.find((/** @type {any} */ k) => k.znacznik === 'review paused')
    assert.equal(znacznikSpecjalny([{ ...pauza, login: 'AIBiz-Automatyzacje' }], { dataCommita: null, czubek: null }), null)
  })
})

describe('pozostale stany koncowe', () => {
  test('status failure → blad z opisem statusu', () => {
    const statusy = [
      { context: 'CodeRabbit', state: 'pending', description: 'Review in progress', created_at: '2026-10-11T12:50:04Z' },
      { context: 'CodeRabbit', state: 'failure', description: 'Review failed', created_at: '2026-10-11T12:52:00Z' },
      { context: 'ci/build', state: 'success', description: 'ok', created_at: '2026-10-11T12:59:00Z' },
    ]
    assert.deepEqual(rozstrzygnij({ pr: PR_OTWARTY, statusy, komentarze: [], dataCommita: null, czubek: null }), {
      stan: 'blad',
      powod: 'status CodeRabbit failure „Review failed” (2026-10-11T12:52:00Z)',
    })
  })

  test('kolejnosc wpisow z API bez znaczenia: najnowszy po dacie, nie po pozycji', () => {
    const historia = VIBERSI.statusy.filter((/** @type {any} */ s) => s.sha === CZUBEK_2)
    for (const statusy of [historia, [...historia].reverse()]) {
      assert.equal(rozstrzygnij({ pr: PR_OTWARTY, statusy, komentarze: [], dataCommita: null, czubek: null })?.stan, 'gotowa')
    }
  })

  test('PR zmergowany → pr-zamkniety bez czekania', async () => {
    const os = odtworzenie({ start: '2026-10-11T13:14:00Z', pr: { ...PR_OTWARTY, state: 'MERGED' } })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.deepEqual(wynik, { stan: 'pr-zamkniety', powod: 'PR #1 ma stan MERGED', sha: CZUBEK_2, minuty: 0 })
  })

  test('3 bledy gh z rzedu → blad-gh z pierwsza linia bledu i sladem na stderr', async () => {
    const slady = /** @type {string[]} */ ([])
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', bledy: 3 })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30, ostrzez: (t) => slady.push(t) })
    assert.deepEqual(wynik, { stan: 'blad-gh', powod: '3 kolejne bledy gh: HTTP 502: Bad Gateway', sha: null, minuty: 1 })
    assert.deepEqual(slady, ['blad gh 1/3: HTTP 502: Bad Gateway', 'blad gh 2/3: HTTP 502: Bad Gateway', 'blad gh 3/3: HTTP 502: Bad Gateway'])
  })

  test('2 przejsciowe bledy gh → odpytanie ponowione, wynik gotowa', async () => {
    const os = odtworzenie({ start: '2026-10-11T12:53:00Z', statusy: VIBERSI.statusy, bledy: 2 })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.equal(wynik.stan, 'gotowa')
    assert.equal(wynik.minuty, 1)
  })
})

/**
 * Atrapa `gh` w PATH: odpowiedzi jak prawdziwe gh po `--jq` (statusy = tablica, komentarze = jeden obiekt na linie).
 * Nieznana flaga konczy sie bledem jak w gh 2.83 (`--compact-output` nie istnieje w `gh api`).
 * @param {{ statusy: object[], komentarze: object[], dataCommita: string }} odpowiedzi
 * @param {string[]} argumentyCli
 */
function uruchomZAtrapa({ statusy, komentarze, dataCommita }, argumentyCli) {
  const katalog = mkdtempSync(join(tmpdir(), 'czekaj-na-bota-'))
  try {
    const ndjson = komentarze.map((k) => JSON.stringify(k)).join('\n') + '\n'
    const atrapa = [
      `#!${process.execPath}`,
      'const a = process.argv.slice(2).join(" ")',
      'const w = (t) => process.stdout.write(t)',
      'if (a.includes("--compact-output")) { process.stderr.write("unknown flag: --compact-output"); process.exit(1) }',
      `if (a.startsWith("pr view 1 --json")) w(${JSON.stringify(JSON.stringify(PR_OTWARTY))})`,
      `else if (a.includes("/commits/${CZUBEK_2}/status --jq .statuses")) w(${JSON.stringify(JSON.stringify(statusy))})`,
      `else if (a.includes("/commits/${CZUBEK_2} --jq")) w(${JSON.stringify(dataCommita + '\n')})`,
      `else if (a.includes("/issues/1/comments")) w(${JSON.stringify(ndjson)})`,
      'else { process.stderr.write("nieznane: " + a); process.exit(1) }',
    ].join('\n')
    writeFileSync(join(katalog, 'gh'), atrapa)
    chmodSync(join(katalog, 'gh'), 0o755)
    return spawnSync(process.execPath, [CLI, ...argumentyCli], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${katalog}:${process.env.PATH}` },
    })
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
}

/** @param {ReturnType<typeof spawnSync>} wynik */
function jednoZdarzenie(wynik) {
  const linie = String(wynik.stdout).split('\n').filter(Boolean)
  assert.equal(linie.length, 1, String(wynik.stderr))
  return JSON.parse(linie[0])
}

describe('CLI', () => {
  test('zle argumenty → jedna linia JSON blad-argumentow, kod 2', () => {
    const liczba = spawnSync(process.execPath, [CLI, '--limit-min', 'zero'], { encoding: 'utf8' })
    assert.equal(liczba.status, 2)
    assert.deepEqual(jednoZdarzenie(liczba), { stan: 'blad-argumentow', powod: 'oczekiwana liczba dodatnia, jest „zero”' })
    const krotkiSha = spawnSync(process.execPath, [CLI, '--sha', '4d2bbb8'], { encoding: 'utf8' })
    assert.equal(krotkiSha.status, 2)
    assert.equal(jednoZdarzenie(krotkiSha).powod, '--sha: oczekiwany pelny SHA (40 znakow hex), jest „4d2bbb8”')
    const dlugo = spawnSync(process.execPath, [CLI, '--limit-min', '40'], { encoding: 'utf8' })
    assert.equal(dlugo.status, 2)
    assert.equal(jednoZdarzenie(dlugo).powod, '--limit-min: najwyzej 25 na wywolanie (Monitor zyje 30 min), jest 40')
  })

  test('nagrane odpowiedzi vibersi (status success) → dokladnie jedna linia „gotowa”', () => {
    const statusy = VIBERSI.statusy.filter((/** @type {any} */ s) => s.sha === CZUBEK_2 && s.state === 'success')
    const wynik = uruchomZAtrapa({ statusy, komentarze: [], dataCommita: VIBERSI.commity[CZUBEK_2] }, ['--pr', '1', '--co-s', '0.01'])
    assert.equal(wynik.status, 0, String(wynik.stderr))
    const zdarzenie = jednoZdarzenie(wynik)
    assert.equal(zdarzenie.stan, 'gotowa')
    assert.equal(zdarzenie.sha, CZUBEK_2)
    assert.equal(zdarzenie.pr, 1)
  })

  test('brak statusu i znacznik „skip review” w podsumowaniu → jedna linia „pominieta” (sciezka komentarzy przez gh)', () => {
    const pominiecie = OFERTY.komentarze.find((/** @type {any} */ k) => k.znacznik === 'skip review')
    const komentarze = [{ login: pominiecie.login, updated_at: pominiecie.updated_at, body: pominiecie.body }]
    const wynik = uruchomZAtrapa({ statusy: [], komentarze, dataCommita: przesun(pominiecie.updated_at, -1) },
      ['--pr', '1', '--sha', CZUBEK_2, '--co-s', '0.01'])
    assert.equal(wynik.status, 0, String(wynik.stderr))
    const zdarzenie = jednoZdarzenie(wynik)
    assert.equal(zdarzenie.stan, 'pominieta')
    assert.equal(String(wynik.stderr), '')
  })
})
