// Asercje stacku web dla adaptera E2E (plan szablonu mobile z rdzenia, IU-2.3). Uwagi planowania o serwerze API i proxy Vite oraz
// sonda na porcie Vite istnieją tylko w adapterze web, więc testy rdzenia nie mogą ich wymagać na wariancie Expo. Testy przeniesione z
// `plan/__tests__/plan-cli.test.mjs`, `e2e/__tests__/srodowisko.test.mjs` i `plan/__tests__/skill-dev-plan.test.mjs` bez zmiany asercji.
//
// Uruchomienie: node --test stacks/web/__tests__/e2e-adapter.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { DOMYSLNY_PORT, komendaStartu, NARZEDZIE_JAZDY, OPIS_PORTU_DEV, PORT_DEV, POLITYKA_OBCEGO, SCIEZKA_ZDROWIA, SZKIELET_WERYFIKACJI, uwagaSerweraApi } from '../../../.claude/scripts/e2e/adapter.mjs'
import { gotowosc } from '../../../.claude/scripts/plan/gotowosc.mjs'
import { PROFIL } from '../../../.claude/scripts/stack/profil.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const CLI = join(REPO, '.claude/scripts/plan/plan.mjs')
const FIXTURE = readFileSync(join(REPO, '.claude/scripts/plan/__tests__/fixtures/plan-techniczny.md'), 'utf8').replaceAll('e2e/seeds/', `${PROFIL.e2e.katalogSeedow}/`)
const PLAN = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'
const ZADANIE = 'docs/active/publikacja-ofert'
const PREP = 'docs/operator/publikacja-ofert-przygotowanie.md'

/** @param {string} korzen @param {string[]} a */
const git = (korzen, a) => execFileSync('git', ['-C', korzen, ...a], { stdio: 'pipe' })

/** @returns {string} repo z planem, plikami planu i commitem na main */
function repo() {
  const korzen = mkdtempSync(join(tmpdir(), 'web-adapter-'))
  const pliki = {
    [PLAN]: FIXTURE,
    'docs/DESIGN.md': '#\n',
    'docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md': '#\n',
    'docs/plans/publikacja-ofert-figma/SPEC.md': '#\n',
    'docs/plans/publikacja-ofert-figma/lista-ofert.png': 'png',
    'src/services/oferty-service.ts': 'const x = 1\n'.repeat(12),
    'src/features/oferty/components/lista-ofert.tsx': 'const x = 1\n'.repeat(8),
    [PREP]: '# Przygotowanie\n\n- [ ] Klucz mapy — **[blokuje: faza 2]** (IU-2)\n- [x] Konto — **[blokuje: faza 1]**\n',
    '.env.e2e': 'X=1\n',
  }
  for (const [s, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, s)), { recursive: true })
    writeFileSync(join(korzen, s), t)
  }
  writeFileSync(join(korzen, '.gitignore'), '.env.e2e\n')
  git(korzen, ['init', '-q', '-b', 'main'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'start'])
  return korzen
}

const ATRAPY = mkdtempSync(join(tmpdir(), 'web-adapter-bin-'))
writeFileSync(join(ATRAPY, NARZEDZIE_JAZDY.nazwa), '#!/bin/sh\necho "ok"\n', { mode: 0o755 })
test.after(() => rmSync(ATRAPY, { recursive: true, force: true }))

/** @param {string} korzen gotowe zadanie na galezi feature/ z commitem */
function zadanieNaGalezi(korzen) {
  git(korzen, ['checkout', '-qb', 'feature/publikacja-ofert'])
  const w = spawnSync(process.execPath, [CLI, 'generuj', PLAN, '--data', '2026-10-07', '--zapisz', '--projekt', korzen], { encoding: 'utf8', env: { ...process.env, PATH: `${ATRAPY}:${process.env.PATH}` } })
  assert.equal(w.status, 0, w.stderr)
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: inicjalizacja planu'])
}

/** @param {(korzen: string) => void} f */
function wRepo(f) {
  const korzen = repo()
  try {
    f(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

/** @type {string[]} */
const KATALOGI = []
test.afterEach(() => {
  for (const k of KATALOGI.splice(0)) rmSync(k, { recursive: true, force: true })
})

/** @param {{ pliki?: Record<string, string> }} o */
function projekt({ pliki = {} } = {}) {
  const katalog = mkdtempSync(join(tmpdir(), 'web-adapter-p-'))
  KATALOGI.push(katalog)
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(katalog, p, '..'), { recursive: true })
    writeFileSync(join(katalog, p), t)
  }
  return katalog
}

test('adapter web: Vite w trybie e2e na 5174, stop przy obcym procesie, sonda na E2E_URL, agent-browser', () => {
  assert.equal(DOMYSLNY_PORT, 5174)
  assert.equal(PORT_DEV, 5173)
  assert.equal(OPIS_PORTU_DEV, 'port zwyklego dev servera Vite')
  assert.equal(POLITYKA_OBCEGO, 'stop')
  assert.equal(SCIEZKA_ZDROWIA, '')
  assert.equal(komendaStartu('pnpm', 5174), 'pnpm run dev -- --mode e2e --port 5174 --strictPort')
  assert.equal(NARZEDZIE_JAZDY.nazwa, 'agent-browser')
  assert.match(NARZEDZIE_JAZDY.instalacja, /^npm install -g agent-browser/)
})

// Przeniesione z e2e/__tests__/szkielet.test.mjs: teksty narzędzia jazdy w szkielecie skilla weryfikacji.
test('szkielet web: dowód zrzutem pod ścieżką bezwzględną i selektory data-testid', () => {
  // P22 A3: zrzut pod sciezka bezwzgledna — demon agent-browser liczy wzgledna od swojego katalogu (zrzut w korzeniu repo).
  assert.match(SZKIELET_WERYFIKACJI.evidence, /`agent-browser screenshot "\$\(git rev-parse --show-toplevel\)\/<folder zadania>\/<flow>\.png"`/)
  assert.match(SZKIELET_WERYFIKACJI.evidence, /demon agent-browser/)
  assert.match(SZKIELET_WERYFIKACJI.selektory(1), /data-testid/)
  assert.equal(SZKIELET_WERYFIKACJI.atrybutSelektora, 'data-testid')
  assert.equal(SZKIELET_WERYFIKACJI.gdzieJazda, 'w przeglądarce')
  assert.deepEqual(SZKIELET_WERYFIKACJI.trasyZPlikow(['src/app/index.tsx'], '/x'), [])
})

// Przeniesione z plan/__tests__/skill-dev-plan.test.mjs.
test('slot plan-e2e i README e2e-env: status HTTP i meta trasy serwera — port serwera albo trasa z listy proxy, nigdy port Vite', () => {
  const p34b = readFileSync(join(REPO, '.claude/stack/plan-e2e.md'), 'utf8')
  assert.match(p34b, /status HTTP albo meta \(`<title>`, `og:\*`\) trasy renderowanej przez serwer/)
  assert.match(p34b, /port serwera albo trasa z listy proxy Vite, nigdy port Vite/)
  const readme = readFileSync(join(REPO, '.claude/templates/e2e-env/README.md'), 'utf8')
  assert.match(readme, /Status HTTP i meta \(`<title>`, `og:\*`\) trasy renderowanej przez serwer/)
  assert.match(readme, /nigdy port Vite/)
})

// P25 A2: aplikacja z serwerem API (katalog server/ albo skrypt *:server) i sonda E2E bez tresci — sam Vite przechodzi sonde
// fallbackiem SPA, a zapisy przez /api dostaja 404 (vibersi etapy 4–5). Uwaga przy planowaniu, nie STOP.
test('gotowosc: serwer API bez E2E_HEALTH_TRESC = uwaga E2E z sekcja README; z trescia albo bez serwera — bez uwagi', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const uwagaApi = (/** @type {string[]} */ u) => u.filter((t) => /serwer API/.test(t))
  assert.deepEqual(uwagaApi(gotowosc(k, ZADANIE).e2e.uwagi), [])
  mkdirSync(join(k, 'server'))
  writeFileSync(join(k, 'server/app.ts'), 'export {}\n')
  const [uwaga] = uwagaApi(gotowosc(k, ZADANIE).e2e.uwagi)
  assert.match(uwaga ?? '', /E2E_HEALTH_TRESC/)
  assert.match(uwaga ?? '', /Aplikacja z osobnym serwerem API/)
  writeFileSync(join(k, '.env.e2e'), "X=1\nE2E_HEALTH=http://localhost:5174/healthz\nE2E_HEALTH_TRESC='\"status\":\"ok\"'\n")
  assert.deepEqual(uwagaApi(gotowosc(k, ZADANIE).e2e.uwagi), [])
  rmSync(join(k, 'server'), { recursive: true })
  writeFileSync(join(k, '.env.e2e'), 'X=1\n')
  writeFileSync(join(k, 'package.json'), JSON.stringify({ scripts: { 'build:server': 'esbuild server/index.ts' } }))
  assert.equal(uwagaApi(gotowosc(k, ZADANIE).e2e.uwagi).length, 1, 'skrypt build:server tez oznacza serwer API')
  for (const zly of ['{ zly', '{"scripts":null}']) {
    writeFileSync(join(k, 'package.json'), zly)
    assert.deepEqual(uwagaApi(gotowosc(k, ZADANIE).e2e.uwagi), [], `${zly}: bez uwagi i bez wyjatku bramki`)
  }
}))

// P27 (1) (vibersi etap 5): E2E_HEALTH=<E2E_URL>/healthz, a proxy Vite tylko na /api — /healthz dostal fallback SPA (index.html),
// sonda z E2E_HEALTH_TRESC dala STOP startu. Uwaga przy planowaniu, gdy sciezki sondy nie ma w vite.config.*.
test('gotowosc: sciezka E2E_HEALTH na porcie Vite bez wpisu w vite.config = uwaga; w proxy, pod /api albo na porcie serwera — bez uwagi', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const uwagaProxy = (/** @type {string[]} */ u) => u.filter((t) => /proxy Vite/.test(t))
  const vite = (/** @type {string} */ klucze) => writeFileSync(join(k, 'vite.config.ts'), `export default { server: { proxy: { ${klucze} } } }\n`)
  const env = (/** @type {string} */ zdrowie, tresc = "E2E_HEALTH_TRESC='ok'\n") => writeFileSync(join(k, '.env.e2e'), `X=1\nE2E_URL=http://localhost:5174\nE2E_HEALTH=${zdrowie}\n${tresc}`)
  vite("'/api': 'http://localhost:8787'")
  env('http://localhost:5174/healthz')
  const [uwaga] = uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi)
  assert.match(uwaga ?? '', /ścieżki \/healthz z E2E_HEALTH nie ma w trasach proxy vite\.config\.ts/)
  assert.match(uwaga ?? '', /Aplikacja z osobnym serwerem API/)
  vite("'/api': 'http://localhost:8787', '/healthz': 'http://localhost:8787'")
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [])
  vite("'^/healthz': 'http://localhost:8787'")
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [], 'klucz proxy jako wyrazenie z ^')
  vite("'/api': 'http://localhost:8787'")
  env('http://localhost:5174/api/health')
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [], 'sciezka pod /api')
  env('http://localhost:5174/apihealth')
  assert.equal(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi).length, 1, '/api nie jest prefiksem segmentu /apihealth')
  env('http://localhost:8787/healthz')
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [], 'sonda wprost na porcie serwera')
  env('http://localhost:5174')
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [], 'sonda na stronie glownej')
  rmSync(join(k, 'vite.config.ts'))
  env('http://localhost:5174/healthz')
  assert.deepEqual(uwagaProxy(gotowosc(k, ZADANIE).e2e.uwagi), [], 'bez vite.config — projekt nie na Vite')
}))

// Recenzja S1 (P2-1, P3-3, P3-4): bez E2E_HEALTH_TRESC sonda przechodzi na kazdej trasie (rada „dodaj do proxy” psulaby trase
// aplikacji); alias hosta to ten sam port Vite; liczą się tylko klucze proxy (bez komentarzy, `base`, aliasow), klucz z ^ = regex.
test('gotowosc: uwaga proxy sondy tylko z E2E_HEALTH_TRESC, alias hosta, klucze proxy bez komentarzy, klucze-regexy Vite', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const uwagaProxy = () => gotowosc(k, ZADANIE).e2e.uwagi.filter((t) => /proxy Vite/.test(t))
  const vite = (/** @type {string} */ tresc) => writeFileSync(join(k, 'vite.config.ts'), tresc)
  const env = (/** @type {string} */ zdrowie, tresc = "E2E_HEALTH_TRESC='ok'\n") => writeFileSync(join(k, '.env.e2e'), `X=1\nE2E_URL=http://localhost:5174\nE2E_HEALTH=${zdrowie}\n${tresc}`)
  vite("export default { server: { proxy: { '/api': 'http://localhost:8787' } } }\n")
  env('http://localhost:5174/login', '')
  assert.deepEqual(uwagaProxy(), [], 'bez E2E_HEALTH_TRESC — trasa aplikacji, bez rady')
  env('http://127.0.0.1:5174/healthz')
  assert.equal(uwagaProxy().length, 1, '127.0.0.1 i localhost to ten sam serwer Vite')
  const przypadki = /** @type {[string, string, number][]} */ ([
    ["export default { base: '/', server: { proxy: { '/api': 'x' } } }", '/healthz', 1],
    ["export default { server: { proxy: {\n  // '/healthz': 'x',\n  '/api': 'x' } } }", '/healthz', 1],
    ["export default { resolve: { alias: { '@': '/src' } }, server: { proxy: { '/api': 'x' } } }", '/src/health', 1],
    ["export default { server: { proxy: { '/api': { target: 'x', rewrite: (p) => p.replace(/^\\/api/, '/healthz') } } } }", '/healthz', 1],
    ["export default { server: { proxy: { '^/api/.*': 'x' } } }", '/api/health', 0],
    ["export default { server: { proxy: { '^/(api|healthz)': 'x' } } }", '/healthz', 0],
    ["export default { server: { proxy: { '/healthz': 'http://localhost:8787' } } }", '/healthz/', 0],
    ["export default { server: { proxy: { '/api/': 'x' } } }", '/api/health', 0],
    ["export default { server: { proxy: { '^/(': 'x' } } }", '/healthz', 1],
    ["export default { define: { '/healthz': 'x' }, server: { proxy: { '/api': 'x' } } }", '/healthz', 1],
    ["export default { server: { proxy: { '^/healthz$': 'x' } } }", '/healthz/', 0],
    // vibersi etap 6a: proxy z funkcji (`proxySerweraE2e(...)` z tablicy tras) — kluczy nie widac, liczy sie napis-sciezka w pliku
    ["const TRASY = ['/api/', '/healthz'] as const\nexport default { server: { proxy: zTras(TRASY) } }", '/healthz', 0],
    ["const TRASY = ['/api/'] as const\nexport default { server: { proxy: zTras(TRASY) } }", '/healthz', 1],
    ["export default { server: { proxy } }", '/healthz', 1],
  ])
  for (const [tresc, sciezka, ile] of przypadki) {
    vite(`${tresc}\n`)
    env(`http://localhost:5174${sciezka}`)
    assert.equal(uwagaProxy().length, ile, `${tresc} / ${sciezka}`)
  }
}))

// P3 pkt 96 M15: uwagi serwera API i proxy sondy dotycza scenariuszy [E2E] — zadanie bez nich (same makiety albo nic) ich nie
// dostaje; mutacja usuwajaca warunek `scenariusze` w gotowosc przezywala.
test('gotowosc: serwer API i sonda poza proxy bez scenariuszy [E2E] — bez uwag (dotycza tylko scenariuszy)', () => wRepo((k) => {
  zadanieNaGalezi(k)
  mkdirSync(join(k, 'server'))
  writeFileSync(join(k, 'server/app.ts'), 'export {}\n')
  writeFileSync(join(k, 'vite.config.ts'), "export default { server: { proxy: { '/api': 'http://localhost:8787' } } }\n")
  const env = (/** @type {string} */ tresc) => writeFileSync(join(k, '.env.e2e'), `X=1\nE2E_URL=http://localhost:5174\nE2E_HEALTH=http://localhost:5174/healthz\n${tresc}`)
  const uwagi = (/** @type {RegExp} */ wzor) => gotowosc(k, ZADANIE).e2e.uwagi.filter((u) => wzor.test(u)).length
  env('')
  assert.equal(uwagi(/serwer API/), 1, 'ze scenariuszami, sonda bez tresci: uwaga serwera API')
  env("E2E_HEALTH_TRESC='ok'\n")
  assert.equal(uwagi(/proxy Vite/), 1, 'ze scenariuszami, sonda z trescia poza proxy: uwaga proxy')
  const zadania = join(k, ZADANIE, 'publikacja-ofert-zadania.md')
  writeFileSync(zadania, readFileSync(zadania, 'utf8').replace(/\[E2E\]/g, '[Manual]'))
  assert.equal(gotowosc(k, ZADANIE).e2e.scenariusze, 0)
  assert.equal(uwagi(/proxy Vite/), 0)
  env('')
  assert.equal(uwagi(/serwer API/), 0)
}))

// P3 pkt 96 M14 + P27 S1 (12): wykrycie serwera API — kotwice regexu skryptow bez testu (mutacje przezywaly), a uklady
// `api/`, `apps/api/` i skrypty `*:api` nie byly wykrywane (uwaga P25 nie dzialala na innych repo).
test('uwagaSerweraApi: katalogi server/, api/, apps/api/ i skrypty z czlonem server albo api; observer, server-x, rapid — nie', () => {
  const wykryty = (/** @type {Record<string, string>} */ pliki) => uwagaSerweraApi(projekt({ pliki }), {}) !== null
  for (const katalog of ['server/index.ts', 'api/index.ts', 'apps/api/src/index.ts']) assert.equal(wykryty({ [katalog]: '' }), true, katalog)
  const zeSkryptem = (/** @type {string} */ nazwa) => wykryty({ 'package.json': JSON.stringify({ scripts: { [nazwa]: 'x' } }) })
  for (const nazwa of ['server', 'dev:server', 'server:dev', 'build:server:prod', 'api', 'dev:api', 'api:build']) assert.equal(zeSkryptem(nazwa), true, nazwa)
  for (const nazwa of ['observer', 'server-x', 'dev:observer', 'serverless:x', 'rapid', 'dev:apis', 'api-docs', 'dev']) assert.equal(zeSkryptem(nazwa), false, nazwa)
  assert.equal(wykryty({ 'apps/web/src/index.ts': '' }), false, 'apps/ bez api/')
  assert.equal(uwagaSerweraApi(projekt({ pliki: { 'apps/api/x.ts': '' } }), { E2E_HEALTH_TRESC: 'ok' }), null, 'sonda z trescia')
})
