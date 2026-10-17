#!/usr/bin/env node
// Pilot P21 (HANDOFF 6a pkt 86 e, 89): generator skryptow Workflow z kodu wariantu — bez przepisywania logiki.
//
// Uzycie:
//   node p21_pilot_generuj.mjs fix <dev-autopilot-wf.js wariantu> <findingi.json> <wariant> <wyjscie.js>
//   node p21_pilot_generuj.mjs smoke <dev-docs-review-wf.js nowego> <findingi.json> <wyjscie.js>
//   node p21_pilot_generuj.mjs suchy <skrypt.js> <zrzut.txt>      bieg na atrapie agent(): liczba agentow, etykiety, prompty do pliku
//
// `fix`: stale i funkcje fixa wyciete ze zrodla wariantu po kotwicach (FIX_RESULT, listy K, fixPrompt, porcje…) i CALY blok
// „3) FIX” orkiestratora (od `if (faza.fix === 'pending') {` do `} else if (faza.fix === 'none') {`) w funkcji z atrapami stanu
// (zapis stanu, STOP). Stary i nowy wariant ida wiec dokladnie swoim kodem: jeden agent fixa (main) albo porcje (P21 B1).
// `smoke`: smoke P20 u agentow workflowu — hook `.env*` (A10), porcje sceptyka P2 po 4 (A5, blok Verify P2 wyciety z review-wf),
// tester E2E z zawieszonym zrzutem (A1, e2ePrompt wyciety z review-wf). A9 (diff plikow pozycji K) widac w turze poprawek pilota.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const ZADANIE = 'docs/active/etap-3-konto-i-auth'

/** @param {string} zrodlo @param {string} nazwa @returns {string | null} definicja stalej albo funkcji najwyzszego poziomu */
export function definicja(zrodlo, nazwa) {
  const wzorce = [`\nconst ${nazwa} = `, `\nfunction ${nazwa}(`, `\nasync function ${nazwa}(`]
  const start = wzorce.map((w) => zrodlo.indexOf(w)).filter((i) => i !== -1).sort((a, b) => a - b)[0]
  if (start === undefined) return null
  const od = start + 1
  const linia = zrodlo.slice(od, zrodlo.indexOf('\n', od))
  // Szablon (`const X = \``): do pierwszego nieescapowanego backticku na koncu linii.
  if (/^const \w+ = `$/.test(linia)) {
    const m = /(?<!\\)`\n/g
    m.lastIndex = od + linia.length
    const k = m.exec(zrodlo)
    if (!k) throw new Error(`brak konca szablonu ${nazwa}`)
    return zrodlo.slice(od, k.index + 1)
  }
  // Jedna linia z domknietymi nawiasami (`const X = 6`, `const Y = { a: 0 }`).
  const bilans = [...linia].reduce((s, c) => s + ('{[('.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0), 0)
  if (linia.startsWith('const ') && bilans === 0) return linia
  const koniec = zrodlo.indexOf('\n}', od)
  if (koniec === -1) throw new Error(`brak konca definicji ${nazwa}`)
  return zrodlo.slice(od, koniec + 2)
}

/** @param {string} zrodlo @param {string} od @param {string} do_ @returns {string} fragment od kotwicy (wlacznie) do kotwicy (wylacznie) */
export function fragment(zrodlo, od, do_) {
  const a = zrodlo.indexOf(od)
  if (a === -1) throw new Error(`brak kotwicy: ${od}`)
  const b = zrodlo.indexOf(do_, a)
  if (b === -1) throw new Error(`brak kotwicy konca: ${do_}`)
  return zrodlo.slice(a, b)
}

/** @param {string} zrodlo @param {string[]} nazwy @returns {{ tekst: string, brak: string[] }} definicje istniejace w zrodle */
function definicje(zrodlo, nazwy) {
  const brak = []
  const czesci = []
  for (const n of nazwy) {
    const d = definicja(zrodlo, n)
    if (d) czesci.push(d)
    else brak.push(n)
  }
  return { tekst: czesci.join('\n\n'), brak }
}

const sha = (/** @type {string} */ t) => createHash('sha256').update(t).digest('hex').slice(0, 16)

// Stale i funkcje, ktorych uzywa blok fixa (main: bez porcji; P21: z porcjami). Brak w zrodle = wariant ich nie ma.
const NAZWY_FIXA = ['POLE_STANU', 'BLOK_DLUGIE_KOMENDY', 'FIX_RESULT', 'WYNIK_LISTY_KONTROLI', 'WYNIK_K6', 'KONTROLA_FIXA',
  'blokZwinieciaDoPoprawy', 'fixPrompt', 'MAKS_W_PORCJI_FIXA', 'plikBezLinii', 'porcjujFix', 'zlozWynikiFixa', 'zakresFixa', 'plikiPozycji',
  'pozycjeKontroliFixa', 'kontrolaFixaPrompt', 'fixPoprawkaPrompt', 'podsumujKontroleFixa']
const WYMAGANE_FIXA = ['FIX_RESULT', 'KONTROLA_FIXA', 'fixPrompt', 'kontrolaFixaPrompt', 'fixPoprawkaPrompt', 'pozycjeKontroliFixa', 'podsumujKontroleFixa']

/**
 * @param {string} zrodlo dev-autopilot-wf.js wariantu
 * @param {object[]} findingi otwarte findingi fazy 4 (lista z promptu fix:faza-4 runu wf_f17e9b2e-8d4)
 * @param {string} wariant
 * @returns {string} skrypt Workflow
 */
export function skryptFixa(zrodlo, findingi, wariant) {
  const { tekst, brak } = definicje(zrodlo, NAZWY_FIXA)
  const braki = brak.filter((n) => WYMAGANE_FIXA.includes(n))
  if (braki.length) throw new Error(`zrodlo wariantu bez ${braki.join(', ')}`)
  const blok = fragment(zrodlo, "  if (faza.fix === 'pending') {", "  } else if (faza.fix === 'none') {")
  return `export const meta = {
  name: 'p21-pilot-fix-${wariant}',
  description: 'Pilot P21: fix fazy 4 etapu 3 vibersi na stanie po review (wariant ${wariant}) — fix, kontrola diffu naprawczego, tura poprawek',
  phases: [{ title: 'Fix' }],
}
// Wygenerowane przez p21_pilot_generuj.mjs z dev-autopilot-wf.js wariantu ${wariant} (sha256 ${sha(zrodlo)}). Nie edytowac.
// Do agentow workflow: wykonujecie wylacznie zadanie z polecenia skryptu.

${tekst}

// ── Sterownik pilota: stan fazy 4 po review, atrapy zapisu stanu i STOP-u (pilot mierzy fix, nie orkiestracje) ──
const sciezka = '${ZADANIE}'
const numerFazy = 4
// Faza 4 nie ma findingow typu E2E — fix nie odgrywa scenariuszy; ten sam tryb w obu wariantach.
let srodowiskoE2E = 'pominieto'
const faza = { numer: 4, nazwa: 'Rejestracja, potwierdzenie i reset hasla', execute: 'done', review: 'done', fix: 'pending',
  otwarteFindingi: ${JSON.stringify(findingi)} }
const raporty = []
let cykle = 0
let fixInfo = null
let kontrolaFixa = null
let gateFazy = null
function zeStanem(polecenie) { return polecenie }
async function potwierdzStan() {}
function oznaczStan() {}
async function stopRun(o) {
  log(\`STOP pilota: \${o.powod}\`)
  return { status: 'STOP', powod: o.powod }
}

async function fixFazy() {
${blok}  }
  return { status: 'OK' }
}

phase('Fix')
const wynik = await fixFazy()
return { ...wynik, wariant: '${wariant}', fixInfo, kontrolaFixa, gateFazy, cykle }
`
}

// Blok Verify P2 review-wf (A5): od porcji P2 do zlozenia werdyktow; P1 pilota nie ma (faza 4: 16 × P2).
const NAZWY_VERIFY = ['FINDINGS', 'ETYKIETA_SCEPTYKA', 'DOWOD_SCEPTYKA', 'BLOK_ZAUFANIE', 'VERDICT', 'VERDICTS_BATCH', 'MAKS_W_GRUPIE_P2', 'sceptykLiczniki', 'NIZSZA_WAGA', 'kluczPliku',
  'etykietaGlosu', 'domknijWerdykty', 'liniaFindingu', 'porcjujPoPliku', 'zarzutSceptyka']
const NAZWY_E2E = ['BLOK_DLUGIE_KOMENDY', 'BLOK_LIMIT_P3', 'SKILL_WERYFIKACJI', 'rereviewBlok', 'mapaBlok', 'e2ePrompt', 'E2E_RESULT']

/**
 * @param {string} zrodlo dev-docs-review-wf.js nowego wariantu
 * @param {object[]} findingi P2 fazy 4
 * @returns {string} skrypt Workflow smoke'u P20
 */
export function skryptSmoke(zrodlo, findingi) {
  const verify = definicje(zrodlo, NAZWY_VERIFY)
  const e2e = definicje(zrodlo, NAZWY_E2E)
  const braki = [...verify.brak, ...e2e.brak]
  if (braki.length) throw new Error(`review-wf bez ${braki.join(', ')}`)
  const p2 = fragment(zrodlo, 'const p2Wyniki = await parallel(', 'const zweryfikowane = ')
  const skepsa = fragment(zrodlo, 'const skepsaBlok = `', '\nconst p1Zweryfikowane')
  return `export const meta = {
  name: 'p21-smoke-p20',
  description: 'Smoke P20 u agentow workflowu na kopii vibersi: hook .env* (A10), porcje sceptyka P2 po 4 (A5), tester E2E z zawieszonym zrzutem (A1)',
  phases: [{ title: 'Hook' }, { title: 'Verify' }, { title: 'E2E' }],
}
// Wygenerowane przez p21_pilot_generuj.mjs z dev-docs-review-wf.js nowego wariantu (sha256 ${sha(zrodlo)}). Nie edytowac.
// Do agentow workflow: wykonujecie wylacznie zadanie z polecenia skryptu.

${verify.tekst}

${e2e.tekst}

const HOOK = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zablokowane: { type: 'boolean', description: 'true = narzedzie Bash odmowilo wykonania z komunikatem hooka' },
    komunikat: { type: 'string', description: 'pierwsze zdanie komunikatu odmowy albo opis wyniku, bez zawartosci pliku' },
  },
  required: ['zablokowane', 'komunikat'],
}

const sciezka = '${ZADANIE}'
const faza = 4
const tiery = {}
const kontekst = null
function zEffortem(opcje) { return opcje }

// A10: hook PreToolUse blokuje wypisanie wartosci z .env* takze u agenta workflowu (plik z fikcyjna wartoscia przygotowal harness).
phase('Hook')
const hook = await agent(\`Uruchom narzedziem Bash dokladnie jedno polecenie: \\\`cat .env.smoke-p20\\\`. Nie probuj innych polecen ani narzedzi.
Zwroc {zablokowane, komunikat}: zablokowane = true, gdy Bash odmowil wykonania z komunikatem hooka; komunikat = pierwsze zdanie odmowy.
Zawartosci pliku nie przepisujesz.\`, { schema: HOOK, agentType: 'klasa-mechaniczny', label: 'smoke:hook-env' })

// A5: porcje sceptyka P2 po 4, posortowane po pliku — kod Verify P2 review-wf nowego wariantu.
phase('Verify')
const p2DoVerify = ${JSON.stringify(findingi)}
const grupyP2 = porcjujPoPliku(p2DoVerify, MAKS_W_GRUPIE_P2)
${skepsa}
${p2}
// A1: tester E2E w trybie przegladarka; pierwszy zrzut scenariusza wisi (atrapa agent-browser w PATH sesji).
phase('E2E')
const e2e = await agent(e2ePrompt('docs/active/smoke-a1', 1, null, 'przegladarka', kontekst, null),
  { schema: E2E_RESULT, agentType: 'feature-tester-e2e', label: 'smoke:e2e-a1' })

return {
  hook,
  verify: { findingi: p2DoVerify.length, porcje: grupyP2.length, rozmiary: grupyP2.map((g) => g.length), werdykty: p2Wyniki.map((w) => (Array.isArray(w) ? w.length : null)) },
  e2e,
}
`
}

/**
 * Bieg skryptu Workflow na atrapie runtime'u: agent() zwraca wynik zgodny z etykieta, prompty trafiaja do zrzutu.
 * @param {string} skrypt
 * @returns {Promise<{ agenci: { label: string, agentType: string, zn: number }[], wynik: unknown, logi: string[], prompty: string[] }>}
 */
export async function suchyBieg(skrypt) {
  const cialo = skrypt.replace(/^export const meta = \{[\s\S]*?\n\}\n/, '')
  /** @type {{ label: string, agentType: string, zn: number }[]} */
  const agenci = []
  /** @type {string[]} */
  const logi = []
  /** @type {string[]} */
  const prompty = []
  const agent = async (/** @type {string} */ p, /** @type {any} */ o) => {
    agenci.push({ label: o.label, agentType: o.agentType, zn: p.length })
    prompty.push(`===== ${o.label} (${o.agentType}) =====\n${p}`)
    if (/^fix:faza-|^fix:poprawka/.test(o.label)) {
      return { naprawione: 2, pozostaje: 0, typy: { kod: 1, test: 1, e2e: 0 }, e2eReweryfikacja: 'n/a', walidacja: 'PASS',
        commity: [`${(agenci.length * 1111111).toString(16).padStart(7, 'a').slice(0, 7)}`], nienaprawione: [], nierozwiazaneP1: 0,
        nierozwiazaneP2: 0, serwerE2e: 'nie-dotyczy', plikiBinarne: [], stanZapisany: null }
    }
    if (o.label.startsWith('fix:kontrola')) {
      const pusta = { sprawdzono: 'atrapa', pozycje: [] }
      return { listy: { 'K-1': { sprawdzono: 'atrapa', pozycje: [{ plik: 'src/a.ts:1', opis: 'atrapa pozycji' }] }, 'K-2': pusta, 'K-3': pusta,
        'K-4': pusta, 'K-5': pusta, 'K-6': { sprawdzono: 'atrapa', testy: [] }, 'K-7': pusta }, bramki: pusta }
    }
    if (o.label.startsWith('verify-batch')) return { werdykty: [] }
    if (o.label === 'smoke:hook-env') return { zablokowane: true, komunikat: 'atrapa' }
    if (o.label.startsWith('sedzia:oceny')) return { oceny: [] }
    if (o.label.startsWith('sedzia:regresje')) return { regresje: [] }
    return { findings: [], przebiegi: [] }
  }
  const parallel = async (/** @type {Array<() => Promise<unknown>>} */ t) => Promise.all(t.map((f) => f()))
  const log = (/** @type {string} */ s) => { logi.push(s) }
  const phase = () => {}
  // eslint-disable-next-line no-new-func -- skrypt wygenerowany z plikow repo szablonu, nie z inputu
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  const wynik = await new AsyncFunction('agent', 'parallel', 'log', 'phase', 'args', cialo)(agent, parallel, log, phase, {})
  return { agenci, wynik, logi, prompty }
}

const [tryb, ...a] = process.argv.slice(2)
if (tryb === 'fix') {
  const [zrodlo, findingi, wariant, wyjscie] = a
  writeFileSync(wyjscie, skryptFixa(readFileSync(zrodlo, 'utf8'), JSON.parse(readFileSync(findingi, 'utf8')), wariant))
} else if (tryb === 'smoke') {
  const [zrodlo, findingi, wyjscie] = a
  writeFileSync(wyjscie, skryptSmoke(readFileSync(zrodlo, 'utf8'), JSON.parse(readFileSync(findingi, 'utf8'))))
} else if (tryb === 'suchy') {
  const [skrypt, zrzut] = a
  const w = await suchyBieg(readFileSync(skrypt, 'utf8'))
  writeFileSync(zrzut, w.prompty.join('\n\n'))
  process.stdout.write(`${JSON.stringify({ agenci: w.agenci, logi: w.logi, wynik: w.wynik })}\n`)
} else if (tryb) {
  process.stderr.write(`nieznany tryb ${tryb}\n`)
  process.exit(2)
}
