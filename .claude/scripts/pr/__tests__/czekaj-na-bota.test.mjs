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

import { czekajNaBota, KARENCJA_ODPYTAN, recenzjaCzubka, rozstrzygnij, statusZPrzebiegu, znacznikSpecjalny } from '../bot.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = join(KATALOG, '..', 'czekaj-na-bota.mjs')
const VIBERSI = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'vibersi-pr1.json'), 'utf8'))
const OFERTY = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'oferty-znaczniki.json'), 'utf8'))
const VIBERSI_PR2 = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'vibersi-pr2.json'), 'utf8'))
const VIBERSI_PR14 = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'vibersi-pr14.json'), 'utf8'))
const CZUBEK_1 = 'b1addf5f71787812fcee6d404163701cbeceb2a3'
const CZUBEK_2 = '4d2bbb8688686cb0b8c0f034b15e43d1de62f74d'
const PR_OTWARTY = { number: 1, state: 'OPEN', headRefOid: CZUBEK_2 }

/** @param {string} iso @param {number} minuty */
const przesun = (iso, minuty) => new Date(Date.parse(iso) + minuty * 60_000).toISOString().replace('.000Z', 'Z')

/**
 * Odtworzenie osi czasu: odpytanie w chwili t widzi statusy i komentarze utworzone do t.
 * @param {{ start: string, pr?: import("../bot.mjs").StanPr, statusy?: any[], komentarze?: any[], recenzje?: any[], commity?: Record<string, string>, bledy?: number }} os
 */
function odtworzenie({ start, pr = PR_OTWARTY, statusy = [], komentarze = [], recenzje = VIBERSI.recenzje, commity = VIBERSI.commity, bledy = 0 }) {
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
      recenzje: async () => widoczne(recenzje, 'submitted_at'),
    },
  }
}

describe('vibersi PR #1 — status commita zamiast tekstu', () => {
  test('czubek 2: gotowa w pierwszym odpytaniu po recenzji czubka (success 12:53:33, recenzja 12:55:02), mimo frazy „Reviewing files…”', async () => {
    assert.match(VIBERSI.komentarze[0].body, /Reviewing files that changed/)
    const os = odtworzenie({ start: '2026-10-11T12:50:00Z', statusy: VIBERSI.statusy, komentarze: VIBERSI.komentarze })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.deepEqual(wynik, {
      stan: 'gotowa',
      powod: 'status CodeRabbit success „Review completed” (2026-10-11T12:53:33Z)',
      recenzja: 'jest',
      sha: CZUBEK_2,
      minuty: 5.5,
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

// P19: CodeRabbit ustawia success ~42 s przed publikacja recenzji (vibersi PR #2: 07:51:39 vs 07:52:21); `zbierz` zaraz po
// „gotowa” dal recenzjaAktualna: false i skill wrocil do kroku 2. Teraz gotowa = recenzja z commit_id = czubek albo 2 min po
// statusie (bot bez uwag recenzji nie publikuje) z adnotacja.
describe('vibersi PR #2 — status przed recenzja', () => {
  const CZUBEK = '5335e7094ea374f4e5c27c208559f82f05c672d6'
  const pr2 = (/** @type {any[]} */ recenzje) => ({ start: '2026-10-13T07:46:00Z', pr: { ...VIBERSI_PR2.pr, headRefOid: CZUBEK }, statusy: VIBERSI_PR2.statusy, recenzje, commity: VIBERSI_PR2.commity })

  test('success 07:51:39, recenzja bota 07:52:21 → gotowa 07:52:30 (nie 07:52:00), recenzja: jest', async () => {
    const os = odtworzenie(pr2(VIBERSI_PR2.recenzje))
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.deepEqual(wynik, { stan: 'gotowa', powod: 'status CodeRabbit success „Review completed” (2026-10-13T07:51:39Z)', recenzja: 'jest', sha: CZUBEK, minuty: 6.5 })
  })

  test('bez recenzji bota (tylko odpowiedzi czlowieka z commit_id = czubek) → gotowa 2 min po statusie z adnotacja, recenzja: brak', async () => {
    const ludzi = VIBERSI_PR2.recenzje.filter((/** @type {any} */ r) => !/coderabbit/.test(r.login))
    assert.ok(ludzi.some((/** @type {any} */ r) => r.commit_id === CZUBEK))
    const os = odtworzenie(pr2(ludzi))
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.equal(wynik.stan, 'gotowa')
    assert.equal(wynik.recenzja, 'brak')
    assert.equal(wynik.minuty, 8, 'pierwsze odpytanie >= 07:53:39 to 07:54:00')
    assert.equal(wynik.powod, 'status CodeRabbit success „Review completed” (2026-10-13T07:51:39Z); recenzji bota z commit_id = czubek brak 2 min po statusie — bot mogl nie miec uwag do czubka, zbierz moze dac recenzjaAktualna: false')
  })

  test('limit w trakcie czekania na recenzje po success → gotowa z adnotacja zamiast limit', async () => {
    const os = odtworzenie({ ...pr2([]), start: '2026-10-13T07:50:00Z' })
    const wynik = await czekajNaBota({ ...os, limitMin: 2.5, coS: 30 })
    assert.deepEqual([wynik.stan, wynik.recenzja, wynik.minuty], ['gotowa', 'brak', 2.5])
  })

  test('blad odczytu recenzji po success = brak recenzji ze sladem na stderr, nie blad-gh', async () => {
    const slady = /** @type {string[]} */ ([])
    const os = odtworzenie({ ...pr2([]), start: '2026-10-13T07:52:00Z' })
    const wynik = await czekajNaBota({ ...os, zrodlo: { ...os.zrodlo, recenzje: async () => { throw new Error('HTTP 403: Resource not accessible\nszczegoly') } }, limitMin: 20, coS: 30, ostrzez: (t) => slady.push(t) })
    assert.deepEqual([wynik.stan, wynik.recenzja, wynik.minuty], ['gotowa', 'brak', 2])
    assert.equal(slady[0], 'odczyt recenzji PR nieudany (traktuje jak brak recenzji czubka): HTTP 403: Resource not accessible')
  })

  test('recenzja poprzedniego czubka nie jest recenzja czubka; login bota z REST i z gh pr view', () => {
    assert.equal(recenzjaCzubka(VIBERSI_PR2.recenzje.filter((/** @type {any} */ r) => r.submitted_at < '2026-10-13T07:45:00Z'), CZUBEK), null)
    assert.equal(recenzjaCzubka([{ login: 'coderabbitai', commit_id: CZUBEK, submitted_at: 'x' }], CZUBEK)?.login, 'coderabbitai')
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
    assert.equal(wynik.minuty, 2.5, 'recenzja czubka 12:55:02 — pierwsze odpytanie po niej 12:55:30')
  })
})

/**
 * Atrapa `gh` w PATH: odpowiedzi jak prawdziwe gh po `--jq` (statusy = tablica, komentarze i recenzje = jeden obiekt na linie).
 * Nieznana flaga konczy sie bledem jak w gh 2.83 (`--compact-output` nie istnieje w `gh api`).
 * @param {{ statusy: object[], komentarze: object[], dataCommita: string, recenzje?: object[], checkRuns?: object[] }} odpowiedzi
 * @param {string[]} argumentyCli
 */
function uruchomZAtrapa({ statusy, komentarze, dataCommita, recenzje = [], checkRuns = [] }, argumentyCli) {
  const katalog = mkdtempSync(join(tmpdir(), 'czekaj-na-bota-'))
  try {
    const ndjson = komentarze.map((k) => JSON.stringify(k)).join('\n') + '\n'
    const recenzjeNdjson = recenzje.map((k) => JSON.stringify(k)).join('\n') + '\n'
    const atrapa = [
      `#!${process.execPath}`,
      'const a = process.argv.slice(2).join(" ")',
      'const w = (t) => process.stdout.write(t)',
      'if (a.includes("--compact-output")) { process.stderr.write("unknown flag: --compact-output"); process.exit(1) }',
      `if (a.startsWith("pr view 1 --json")) w(${JSON.stringify(JSON.stringify(PR_OTWARTY))})`,
      `else if (a.includes("/commits/${CZUBEK_2}/status --jq .statuses")) w(${JSON.stringify(JSON.stringify(statusy))})`,
      `else if (a.includes("/commits/${CZUBEK_2}/check-runs --jq .check_runs")) w(${JSON.stringify(JSON.stringify(checkRuns))})`,
      `else if (a.includes("/commits/${CZUBEK_2} --jq")) w(${JSON.stringify(dataCommita + '\n')})`,
      `else if (a.includes("/issues/1/comments")) w(${JSON.stringify(ndjson)})`,
      `else if (a.includes("/pulls/1/reviews?per_page=100 --jq .[] | {login: .user.login, commit_id, submitted_at}")) w(${JSON.stringify(recenzjeNdjson)})`,
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
    const wynik = uruchomZAtrapa({ statusy, komentarze: [], dataCommita: VIBERSI.commity[CZUBEK_2], recenzje: VIBERSI.recenzje }, ['--pr', '1', '--co-s', '0.01'])
    assert.equal(wynik.status, 0, String(wynik.stderr))
    const zdarzenie = jednoZdarzenie(wynik)
    assert.equal(zdarzenie.stan, 'gotowa')
    assert.equal(zdarzenie.recenzja, 'jest')
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

test('skill /dev-pr: gotowa z recenzja: brak nie odsyla do kroku 2 przy recenzjaAktualna: false', () => {
  const skill = readFileSync(join(KATALOG, '..', '..', '..', 'skills', 'dev-pr', 'SKILL.md'), 'utf8')
  assert.match(skill, /`\{stan, powod, sha, minuty, pr, recenzja\}`/)
  assert.match(skill, /`recenzja: brak` znaczy, że 2 min po statusie recenzji czubka nie było[\s\S]*`recenzjaAktualna: false` z kroku 3 nie odsyła wtedy do kroku 2/)
  assert.match(skill, /`recenzjaAktualna: false` przy `recenzja: jest` → recenzja nie dotyczy czubka gałęzi\. Wróć do kroku 2/)
})

// vibersi PR #14 (2026-10-29): CodeRabbit przestal ustawiac status commita (PR #12, #13 z 26.10 go maja) i raportuje check-run
// aplikacji `coderabbitai`. Skrypt czytal tylko statusy — obie tury /dev-pr skonczyly sie limitem 20 min przy gotowej recenzji.
describe('vibersi PR #14 — check-run CodeRabbit zamiast statusu commita', () => {
  const [przebieg] = VIBERSI_PR14.checkRuns
  const wToku = { ...przebieg, status: 'in_progress', conclusion: null, completed_at: null, output: { title: 'Review in progress' } }

  test('check-run → status: w toku = pending od startu, zakonczony wg conclusion od konca; skipped i cudzy check-run = brak statusu', () => {
    assert.deepEqual(statusZPrzebiegu(przebieg), { context: 'CodeRabbit', state: 'success', description: 'Finished', created_at: '2026-10-29T06:44:54Z' })
    assert.deepEqual(statusZPrzebiegu(wToku), { context: 'CodeRabbit', state: 'pending', description: 'Review in progress', created_at: '2026-10-29T06:36:41Z' })
    const zakonczony = (/** @type {string} */ conclusion) => statusZPrzebiegu({ ...przebieg, conclusion })?.state
    assert.deepEqual(['neutral', 'failure', 'timed_out', 'action_required', 'cancelled', 'stale'].map(zakonczony), ['success', 'failure', 'failure', 'failure', 'error', 'error'])
    assert.equal(statusZPrzebiegu({ ...przebieg, conclusion: 'skipped' }), null, 'pominieta recenzja rozstrzyga znacznik w komentarzu')
    assert.equal(statusZPrzebiegu({ ...przebieg, name: 'build' }), null)
  })

  test('czekanie na check-run: gotowa z recenzja czubka w pierwszym odpytaniu po zakonczeniu (06:44:54, recenzja 06:44:49)', async () => {
    const statusy = [wToku, przebieg].map((r) => ({ ...statusZPrzebiegu(r), sha: VIBERSI_PR14.czubek }))
    const os = odtworzenie({ start: '2026-10-29T06:37:00Z', pr: { number: 14, state: 'OPEN', headRefOid: VIBERSI_PR14.czubek }, statusy, recenzje: VIBERSI_PR14.recenzje, commity: VIBERSI_PR14.commity })
    const wynik = await czekajNaBota({ ...os, limitMin: 20, coS: 30 })
    assert.deepEqual([wynik.stan, wynik.recenzja, wynik.sha, wynik.minuty], ['gotowa', 'jest', VIBERSI_PR14.czubek, 8])
    assert.equal(os.odpytania.komentarze, 0, 'pending z check-runu = bot pracuje, znacznikow nie czytamy')
  })

  test('CLI: bez statusu commita, z check-runem success → jedna linia „gotowa” (zapytanie check-runs przez gh)', () => {
    const recenzje = VIBERSI_PR14.recenzje.map((/** @type {any} */ r) => ({ ...r, commit_id: r.commit_id === VIBERSI_PR14.czubek ? CZUBEK_2 : r.commit_id }))
    const wynik = uruchomZAtrapa({ statusy: [], checkRuns: VIBERSI_PR14.checkRuns, komentarze: [], dataCommita: VIBERSI_PR14.commity[VIBERSI_PR14.czubek], recenzje }, ['--pr', '1', '--co-s', '0.01', '--limit-min', '0.05'])
    assert.equal(wynik.status, 0, String(wynik.stderr))
    const zdarzenie = jednoZdarzenie(wynik)
    assert.deepEqual([zdarzenie.stan, zdarzenie.recenzja, zdarzenie.sha], ['gotowa', 'jest', CZUBEK_2])
    assert.equal(String(wynik.stderr), '')
  })
})
