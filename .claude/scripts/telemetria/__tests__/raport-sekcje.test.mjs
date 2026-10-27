// Test obliczen raportu miesiecznego (It. 1, krok 6; d5-telemetria-rekord.txt §4).

import test from 'node:test'
import assert from 'node:assert/strict'

import { PROG_CTX_START_SKILLA, anomalie, efortPerKlasa, findingiPerOs, jakoscBota, kontekstPerKlasa, kosztPerEtap, kwantyl, niezawodnosc, skillePerNazwa, skilleZOdziedziczonymKontekstem, ucieczkiBota } from '../raport-sekcje.mjs'

/** @param {string} rola @param {string} klasa @param {number} koszt @param {Record<string, unknown>} [inne] */
const agent = (rola, klasa, koszt, inne = {}) => ({
  typ: 'agent', rola, klasa_roli: klasa, koszt_jedn: koszt, model: 'claude-opus-5-5', effort: 'high', ctx_start: 100_000,
  kontekst: { narzedzia_n: 900, claude_md_zn: 20_000 }, ...inne,
})

test('kwantyl: mediana i p90 bez interpolacji (jak w analizie)', () => {
  assert.equal(kwantyl([5, 1, 3], 0.5), 3)
  assert.equal(kwantyl([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 10)
  assert.equal(kwantyl([], 0.5), null)
})

test('koszt per etap: udzial liczony od calego kosztu (jak d5r §2), role spoza etapow osobno', () => {
  const k = kosztPerEtap([agent('build', 'builder', 600), agent('review:security', 'reviewer', 300), agent('pr:zbierz', 'orkiestracyjny', 100)])
  assert.equal(k.razem, 1000)
  assert.deepEqual(k.etapy.execute, { jedn: 600, udzial: 60 })
  assert.deepEqual(k.etapy.review, { jedn: 300, udzial: 30 })
  assert.equal(k.poza_etapami, 100)
})

test('kontekst per klasa i model: p50/p90 ctx_start, narzedzia, CLAUDE.md', () => {
  const w = kontekstPerKlasa([
    agent('stan:zapis', 'mechaniczny', 1, { model: 'claude-haiku-4-5', ctx_start: 89_000, effort: null }),
    agent('stan:zapis', 'mechaniczny', 1, { model: 'claude-haiku-4-5', ctx_start: 91_000, effort: null }),
    agent('review:security', 'reviewer', 1, { ctx_start: 125_000 }),
  ])
  const mech = w.find((x) => x.klasa === 'mechaniczny')
  assert.deepEqual(mech, { klasa: 'mechaniczny', model: 'claude-haiku-4-5', n: 2, ctx_start_p50: 91_000, ctx_start_p90: 91_000, narzedzia_n_p50: 900, narzedzia_zapytania_p50: null, claude_md_zn_p50: 20_000 })
})

test('efort per klasa: rozklad poziomow, null = efort sesji albo model bez efortu', () => {
  const e = efortPerKlasa([agent('build', 'builder', 1), agent('build', 'builder', 1, { effort: 'xhigh' }), agent('stan:zapis', 'mechaniczny', 1, { effort: null })])
  assert.deepEqual(e.builder, { high: 1, xhigh: 1 })
  assert.deepEqual(e.mechaniczny, { brak: 1 })
})

test('jakosc bota: unikalne watki per zadanie (ta sama uwaga w 2 turach = 1), P1/P2 na 100 plikow PR', () => {
  const runy = [
    { typ: 'run', zadanie: 'z1', pr: { pliki: 50, klasy: [{ id: 'A', severity: 'P1' }, { id: 'B', severity: 'P3' }] } },
    { typ: 'run', zadanie: 'z1', pr: { pliki: 50, klasy: [{ id: 'A', severity: 'P1' }, { id: 'C', severity: 'P2' }] } },
    { typ: 'run', zadanie: 'z2', pr: null },
  ]
  assert.deepEqual(jakoscBota(runy), [{ zadanie: 'z1', pliki: 50, watki: 3, bez_wagi: 0, p1p2: 2, p1p2_na_100_plikow: 4 }])
})

test('jakosc bota: watek bez wagi (runy dev-pr sprzed slownika klas) to brak klasyfikacji, nie zero P1/P2', () => {
  const runy = [
    // Ksztalt z prawdziwego run.pr sprzed kroku 8 It. 1: severity i pliki null
    { typ: 'run', zadanie: 'stare', pr: { pliki: null, klasy: [{ id: 'A', severity: null }, { id: 'B', severity: null }] } },
    { typ: 'run', zadanie: 'mieszane', pr: { pliki: 20, klasy: [{ id: 'C', severity: 'P2' }, { id: 'D', severity: null }] } },
  ]
  assert.deepEqual(jakoscBota(runy), [
    { zadanie: 'stare', pliki: 0, watki: 2, bez_wagi: 2, p1p2: 0, p1p2_na_100_plikow: null },
    { zadanie: 'mieszane', pliki: 20, watki: 2, bez_wagi: 1, p1p2: 1, p1p2_na_100_plikow: 5 },
  ])
})

test('jakosc bota: PR w czesciach — suma plikow czesci (rozne pr.numer), ten sam PR raz z najnowszego rekordu (E5-16)', () => {
  /** @param {number} numer @param {number} pliki @param {string} id */
  const pr = (numer, pliki, id) => ({ numer, pliki, klasy: [{ id, severity: 'P2' }] })
  const runy = [
    // Etap 5 vibersi: trzy czesci 61/130/148 plikow, 4 watki P1/P2 — Math.max dawal 148 plikow i 2,7/100 zamiast 1,2/100
    { typ: 'run', zadanie: 'etap5', start: '2026-10-20T10:00:00Z', pr: pr(11, 61, 'A') },
    { typ: 'run', zadanie: 'etap5', start: '2026-10-21T10:00:00Z', pr: pr(12, 125, 'B') },
    { typ: 'run', zadanie: 'etap5', start: '2026-10-21T12:00:00Z', pr: pr(12, 130, 'C') },
    { typ: 'run', zadanie: 'etap5', start: '2026-10-22T10:00:00Z', pr: pr(13, 148, 'D') },
    // Starszy rekord tego samego PR zapisany po nowszym (kolejnosc w pliku nie jest kolejnoscia czasu)
    { typ: 'run', zadanie: 'etap5', start: '2026-10-21T08:00:00Z', pr: pr(12, 300, 'C') },
  ]
  assert.deepEqual(jakoscBota(runy), [{ zadanie: 'etap5', pliki: 339, watki: 4, bez_wagi: 0, p1p2: 4, p1p2_na_100_plikow: 1.2 }])
})

test('niezawodnosc: statusy per workflow i kategorie STOP', () => {
  const n = niezawodnosc([
    { typ: 'run', workflow: 'dev-autopilot', status: 'OK', stop_kategoria: null },
    { typ: 'run', workflow: 'dev-autopilot', status: 'STOP', stop_kategoria: 'czystosc' },
    { typ: 'run', workflow: 'dev-autopilot', status: 'STOP', stop_kategoria: 'czystosc' },
  ])
  assert.deepEqual(n.statusy['dev-autopilot'], { OK: 1, STOP: 2 })
  assert.deepEqual(n.stopy, { czystosc: 2 })
})

test('anomalie: agent > 2x mediany swojej roli', () => {
  const a = anomalie([agent('build', 'builder', 100), agent('build', 'builder', 110), agent('build', 'builder', 500, { id: 'x' })])
  assert.deepEqual(a.map((x) => x.id), ['x'])
})

test('skille: mediana pelnego kosztu (wlasny + subagenci) i wiadomosci operatora; epizody otwarte pominiete', () => {
  const s = skillePerNazwa([
    { typ: 'skill', skill: 'dev-plan', koszt_jedn: 100, subagenci_jedn: 50, wiadomosci_operatora: 1, otwarty: false },
    { typ: 'skill', skill: 'dev-plan', koszt_jedn: 300, subagenci_jedn: null, wiadomosci_operatora: 3, otwarty: false },
    { typ: 'skill', skill: 'dev-plan', koszt_jedn: 9999, subagenci_jedn: 0, wiadomosci_operatora: 0, otwarty: true },
  ])
  assert.deepEqual(s, [{ skill: 'dev-plan', n: 2, pelny_p50: 300, wiadomosci_p50: 3 }])
})

test('skille: komendy lokalne z rekordow starszej wersji skanu (v1: exit, copy) nie sa skillami', () => {
  const s = skillePerNazwa([
    { typ: 'skill', skill: 'exit', koszt_jedn: 5_779_000, subagenci_jedn: 0, wiadomosci_operatora: 20, otwarty: false, v: 1 },
    { typ: 'skill', skill: 'copy', koszt_jedn: 100, subagenci_jedn: 0, wiadomosci_operatora: 1, otwarty: false, v: 1 },
    { typ: 'skill', skill: 'dev-pr', koszt_jedn: 200, subagenci_jedn: 0, wiadomosci_operatora: 2, otwarty: false, v: 4 },
  ])
  assert.deepEqual(s.map((x) => x.skill), ['dev-pr'])
})

test('findingi per os: suma z rekordow faz, faza bez findingow nie psuje sumy', () => {
  assert.deepEqual(findingiPerOs([
    { typ: 'faza', findingi_per_os: { security: { p1: 1, p2: 2, p3: 0 } } },
    { typ: 'faza', findingi_per_os: { security: { p1: 0, p2: 1, p3: 4 }, spec: { p1: 0, p2: 0, p3: 1 } } },
    { typ: 'faza', findingi_per_os: null },
  ]), { security: { p1: 1, p2: 3, p3: 4 }, spec: { p1: 0, p2: 0, p3: 1 } })
})

// P17 (6a pkt 80 j, vibersi): /dev-plan w sesji zamknietej restartem (wtyczka Figmy) zostawal „otwarty” na zawsze, a w nowej
// sesji ten sam skill liczyl sie jako osobny epizod — raport pokazywal 0,13 M zamiast ~2,4 M.
test('skille: epizod otwarty bez ruchu od 2 h liczony; ten sam skill w nowej sesji do 30 min = kontynuacja (jeden epizod)', () => {
  const teraz = Date.parse('2026-10-10T12:00:00.000Z')
  const s = skillePerNazwa([
    { typ: 'skill', projekt: 'v', skill: 'dev-plan', sesja: 'a', start: '2026-10-09T19:53:00.000Z', koniec: '2026-10-09T20:38:00.000Z', koszt_jedn: 1_060_000, subagenci_jedn: 900_000, wiadomosci_operatora: 3, otwarty: true },
    { typ: 'skill', projekt: 'v', skill: 'dev-plan', sesja: 'b', start: '2026-10-09T20:41:00.000Z', koniec: '2026-10-09T21:07:00.000Z', koszt_jedn: 1_380_000, subagenci_jedn: 0, wiadomosci_operatora: 2, otwarty: false },
    { typ: 'skill', projekt: 'v', skill: 'dev-brainstorm', sesja: 'c', start: '2026-10-09T07:19:00.000Z', koniec: '2026-10-09T11:59:00.000Z', koszt_jedn: 2_220_000, subagenci_jedn: 0, wiadomosci_operatora: 2, otwarty: true },
    { typ: 'skill', projekt: 'v', skill: 'dev-pr', sesja: 'd', start: '2026-10-10T11:30:00.000Z', koniec: '2026-10-10T11:50:00.000Z', koszt_jedn: 100, subagenci_jedn: 0, wiadomosci_operatora: 1, otwarty: true },
  ], teraz)
  assert.deepEqual(s, [
    { skill: 'dev-plan', n: 1, pelny_p50: 3_340_000, wiadomosci_p50: 5 },
    { skill: 'dev-brainstorm', n: 1, pelny_p50: 2_220_000, wiadomosci_p50: 2 },
  ], 'dev-pr w toku (ruch < 2 h) pominiety')
})

// P17 (smoke): rekord „epizodu Figmy” zapisany przed poprawka zostaje w danych, a jego koszt jest juz w /dev-plan
// (zagniezdzone) — raport go pomija, zamiast liczyc dwa razy.
test('skille: stary rekord skilla pomocniczego objety zagniezdzone rodzica z tej sesji nie liczy sie osobno', () => {
  const s = skillePerNazwa([
    { typ: 'skill', projekt: 'v', skill: 'dev-plan', sesja: 'b', start: '2026-10-09T20:41:00.000Z', koniec: '2026-10-09T21:07:00.000Z', koszt_jedn: 1_380_000, subagenci_jedn: 0, wiadomosci_operatora: 2, otwarty: false, zagniezdzone: ['figma:figma-design-to-code'] },
    { typ: 'skill', projekt: 'v', skill: 'figma:figma-design-to-code', sesja: 'b', start: '2026-10-09T20:42:23.000Z', koniec: '2026-10-09T21:07:00.000Z', koszt_jedn: 1_250_000, subagenci_jedn: 0, wiadomosci_operatora: 2, otwarty: false },
    { typ: 'skill', projekt: 'v', skill: 'figma:figma-design-to-code', sesja: 'c', start: '2026-10-09T22:00:00.000Z', koniec: '2026-10-09T22:10:00.000Z', koszt_jedn: 100, subagenci_jedn: 0, wiadomosci_operatora: 1, otwarty: false },
  ])
  assert.deepEqual(s.map((x) => [x.skill, x.n]), [['dev-plan', 1], ['figma:figma-design-to-code', 1]], 'figma z innej sesji zostaje')
})

// P20 A8: flaga kontekstu odziedziczonego — swieze sesje vibersi 65–71k, /dev-plan po /dev-prep bez /clear 164–237k.
test('skille z odziedziczonym kontekstem: ctx_start powyzej progu, tylko komenda operatora, bez komend lokalnych, krokow innego epizodu i rekordow bez pola', () => {
  const s = skilleZOdziedziczonymKontekstem([
    { typ: 'skill', skill: 'dev-plan', zrodlo: 'slash', start: '2026-10-14T20:17', ctx_start: 233_380 },
    { typ: 'skill', skill: 'dev-plan', zrodlo: 'slash', start: '2026-10-11T17:34', ctx_start: 67_825 },
    { typ: 'skill', skill: 'dev-prep', zrodlo: 'slash', start: '2026-10-09T19:53', ctx_start: 236_731 },
    { typ: 'skill', skill: 'exit', zrodlo: 'slash', start: '2026-10-09T20:00', ctx_start: 500_000 },
    { typ: 'skill', skill: 'dev-pr', zrodlo: 'slash', start: '2026-10-10T10:00' },
    { typ: 'skill', skill: 'dev-compound', zrodlo: 'Skill-tool', start: '2026-10-10T11:00', ctx_start: 300_000 },
    { typ: 'skill', skill: 'figma:figma-use', zrodlo: 'slash', sesja: 's', start: '2026-10-14T20:30', ctx_start: 300_000 },
    { typ: 'skill', skill: 'dev-plan', zrodlo: 'slash', sesja: 's', start: '2026-10-14T20:20', koniec: '2026-10-14T21:00', zagniezdzone: ['figma:figma-use'], ctx_start: 50_000 },
  ])
  assert.deepEqual(s.map((x) => `${x.skill} ${x.ctx_start}`), ['dev-prep 236731', 'dev-plan 233380'])
  assert.equal(PROG_CTX_START_SKILLA, 120_000)
})

test('skille: epizod w sesji zaczetej od /clear (po_clear) nie jest kontynuacja otwartego epizodu sprzed /clear (E5-19)', () => {
  const s = skillePerNazwa([
    { typ: 'skill', skill: 'dev-plan', projekt: 'p', sesja: 's1', start: '2026-10-21T10:00:00Z', koniec: '2026-10-21T10:30:00Z', koszt_jedn: 100, subagenci_jedn: 0, wiadomosci_operatora: 1, otwarty: true },
    { typ: 'skill', skill: 'dev-plan', projekt: 'p', sesja: 's2', start: '2026-10-21T10:35:00Z', koniec: '2026-10-21T11:00:00Z', koszt_jedn: 300, subagenci_jedn: 0, wiadomosci_operatora: 3, otwarty: false, po_clear: true },
  ], Date.parse('2026-10-22T10:00:00Z'))
  assert.deepEqual(s, [{ skill: 'dev-plan', n: 2, pelny_p50: 300, wiadomosci_p50: 3 }])
})

test('ucieczki bota: unikalne watki per zadanie (waga z najnowszej wersji, kubelek z pierwszej), kubelki w stalej kolejnosci z P1/P2; bez oznaczenia = bez danych (E5-20)', () => {
  /** @param {string} id @param {string} severity @param {string | null} kubelek */
  const w = (id, severity, kubelek) => ({ id, severity, ucieczka: kubelek ? { kubelek, pochodzenie: kubelek, znane: null } : null })
  const runy = [
    { typ: 'run', zadanie: 'z', start: '2026-10-25T10:00:00Z', pr: { numer: 9, klasy: [w('A', 'P3', 'nowy'), w('B', 'P2', 'kod-tury-PR')] } },
    { typ: 'run', zadanie: 'z', start: '2026-10-25T11:00:00Z', pr: { numer: 9, klasy: [w('A', 'P2', 'review-P3'), w('C', 'P2', 'kod-fixa'), w('D', 'P2', null)] } },
    { typ: 'run', zadanie: 'inne', start: '2026-10-25T11:00:00Z', pr: null },
  ]
  assert.deepEqual(ucieczkiBota(runy), [{
    zadanie: 'z', watki: 4,
    kubelki: [
      { kubelek: 'kod-fixa', razem: 1, p1p2: 1 },
      { kubelek: 'kod-tury-PR', razem: 1, p1p2: 1 },
      { kubelek: 'nowy', razem: 1, p1p2: 1 },
      { kubelek: 'bez danych', razem: 1, p1p2: 1 },
    ],
  }])
})

// Recenzja S4 (F4): watek odrzucony zostaje nierozwiazany i wraca w turze 2 — blame jego linii po fixie tury 1 daje
// „kod-tury-PR”, choc bot zglosil kod sprzed tury. Pochodzenie z pierwszego widzenia watku, waga z najnowszego.
test('ucieczki bota: kubelek z pierwszego rekordu z oznaczeniem watku, waga z najnowszego; zadanie bez watkow pominiete', () => {
  /** @param {string} severity @param {string | null} kubelek */
  const w = (severity, kubelek) => ({ id: 'A', severity, ucieczka: kubelek ? { kubelek, pochodzenie: kubelek, znane: null } : null })
  const runy = [
    { typ: 'run', zadanie: 'z', start: '2026-10-25T12:00:00Z', pr: { numer: 9, klasy: [w('P2', 'kod-tury-PR')] } },
    { typ: 'run', zadanie: 'z', start: '2026-10-25T10:00:00Z', pr: { numer: 9, klasy: [w('P3', null)] } },
    { typ: 'run', zadanie: 'z', start: '2026-10-25T11:00:00Z', pr: { numer: 9, klasy: [w('P3', 'review-P3')] } },
    { typ: 'run', zadanie: 'pusty', start: '2026-10-25T11:00:00Z', pr: { numer: 1, klasy: [] } },
  ]
  assert.deepEqual(ucieczkiBota(runy), [{ zadanie: 'z', watki: 1, kubelki: [{ kubelek: 'review-P3', razem: 1, p1p2: 1 }] }])
})

test('jakosc bota: najnowszy rekord PR bez liczby plikow nie zeruje plikow tego PR (F5)', () => {
  const runy = [
    { typ: 'run', zadanie: 'z', start: '2026-10-25T10:00:00Z', pr: { numer: 9, pliki: 40, klasy: [{ id: 'A', severity: 'P2' }] } },
    { typ: 'run', zadanie: 'z', start: '2026-10-25T11:00:00Z', pr: { numer: 9, pliki: null, klasy: [] } },
  ]
  assert.equal(jakoscBota(runy)[0].pliki, 40)
})
