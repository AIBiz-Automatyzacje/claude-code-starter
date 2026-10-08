// Generator skilla weryfikacji projektu (P14, PANEL-WEJSCIE §2 pkt 14): szkielet SKILL.md z repo (nie z wywiadu) z sekcjami
// Launch / Doctor / Drive / Evidence / Cleanup i mapa funkcji zasiana z planow zrobionych zadan. Doctor = e2e.mjs sprawdz,
// Launch = e2e.mjs start — ten sam skrypt, ktory wola autopilot, wiec skill nie ma wlasnego przepisu na srodowisko.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/szkielet.test.mjs

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parsujMape } from '../mapa.mjs'
import { szkieletSkilla, trasyAplikacji, wpisyZrobionych } from '../szkielet.mjs'
import { PLIK_MAPY, PLIK_SKILLA } from '../weryfikacja.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../e2e.mjs')
const PLAN = readFileSync(resolve(KATALOG, '../../plan/__tests__/fixtures/plan-techniczny.md'), 'utf8')
const SCIEZKA_PLANU = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'

/** @type {string[]} */
const PROJEKTY = []
test.afterEach(() => {
  for (const p of PROJEKTY.splice(0)) rmSync(p, { recursive: true, force: true })
})

/** @param {{ env?: string | null }} [o] fixture projektu: Vite + React Router, trasy w kodzie, plan zrobionego zadania */
function projekt({ env = 'E2E_URL=http://localhost:5180\nE2E_TEST_EMAIL=t@x.pl\nE2E_TEST_PASSWORD=p\n' } = {}) {
  const k = mkdtempSync(join(tmpdir(), 'e2e-szkielet-'))
  PROJEKTY.push(k)
  const pliki = {
    'package.json': JSON.stringify({ name: 'oferty-online', scripts: { dev: 'vite' }, dependencies: { react: '19.0.0', 'react-router': '7.0.0' }, devDependencies: { vite: '7.0.0' } }),
    'pnpm-lock.yaml': '',
    'src/app/router.tsx': "const trasy = [{ path: '/oferty', element: <Lista /> }, { path: '/logowanie', element: <Login /> }]\n",
    'src/app/App.tsx': '<Route path="/o/:slug" element={<Oferta />} />\n<Route path="/oferty" element={<Lista />} />\n',
    'src/features/oferty/lista.tsx': '<button data-testid="publikuj">Publikuj</button>\n',
    'src/app/sciezki.ts': "export const SZKICE_PATH = '/oferty/szkice'\nconst ROZMIAR = '/nie-trasa'\nconst LOGO_PATH = '/brand/logo.webp'\n",
    'src/node_modules/y/index.js': "{ path: '/z-zagniezdzonych-node-modules' }\n",
    'src/features/oferty/lista.test.tsx': "render(<Route path='/test-only' />)\n",
    'node_modules/x/index.js': "{ path: '/z-node-modules' }\n",
    [SCIEZKA_PLANU]: PLAN,
    'docs/completed/publikacja-ofert/publikacja-ofert-plan.md': `# Plan\n\nPlan techniczny: \`${SCIEZKA_PLANU}\`\n`,
    ...(env === null ? {} : { '.env.e2e': env }),
  }
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  return k
}

/** @param {string} k @param {string[]} a */
function uruchom(k, a) {
  const w = spawnSync('node', [CLI, ...a, '--projekt', k], { encoding: 'utf8' })
  return { kod: w.status, json: w.stdout.trim() ? JSON.parse(w.stdout) : null, stderr: w.stderr }
}

test('trasyAplikacji: sciezki z routera, <Route> i stalych *_PATH, bez testow i node_modules (takze zagniezdzonych); app router Next z katalogow', () => {
  const k = projekt()
  assert.deepEqual(trasyAplikacji(k).trasy, ['/logowanie', '/o/:slug', '/oferty', '/oferty/szkice'])
  mkdirSync(join(k, 'app/(panel)/ustawienia'), { recursive: true })
  writeFileSync(join(k, 'app/(panel)/ustawienia/page.tsx'), 'export default function P() {}\n')
  writeFileSync(join(k, 'app/page.tsx'), 'export default function P() {}\n')
  assert.deepEqual(trasyAplikacji(k).trasy, ['/', '/logowanie', '/o/:slug', '/oferty', '/oferty/szkice', '/ustawienia'])
})

test('trasyAplikacji: frontend w podkatalogu (frontend/src), trasy wzgledne <Route> i obiektu routera, /api poza lista, przyciecie raportowane', () => {
  const k = projekt()
  mkdirSync(join(k, 'frontend/src'), { recursive: true })
  writeFileSync(join(k, 'frontend/package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }))
  writeFileSync(join(k, 'frontend/src/App.tsx'), '<Route path="/panel" element={<P />}>\n  <Route\n    path="clients"\n    element={<K />} />\n  <Route element={<L />} path="po-elemencie" />\n  <Route path="*" element={<Brak />} />\n</Route>\n')
  writeFileSync(join(k, 'frontend/src/routes.ts'), "export const r = [{ path: 'faktury', element: <F /> }, { path: 'ustawienia/:id', Component: U }]\nconst plik = { path: 'logi/x.txt' }\nconst z = [{ path: 'src/lib', index: true }, { path: 'assets/logo', children: [] }, { path: 'node:fs', loader: 1 }]\n")
  // Katalog <x>/src bez frontendu (backend, skrypty) nie jest zrodlem tras ekranow.
  /** @type {[string, object | null][]} */
  const bezFrontendu = [['backend', { dependencies: { express: '5.0.0' } }], ['scripts', null]]
  for (const [katalog, pkg] of bezFrontendu) {
    mkdirSync(join(k, katalog, 'src'), { recursive: true })
    if (pkg) writeFileSync(join(k, katalog, 'package.json'), JSON.stringify(pkg))
    writeFileSync(join(k, katalog, 'src/index.ts'), "const a = { path: '/var/log/app' }\nconst CHROME_PATH = '/Applications/Chromium.app'\n")
  }
  writeFileSync(join(k, 'src/app/api.ts'), "app.route({ path: '/api/oferty' })\n")
  const w = trasyAplikacji(k)
  assert.deepEqual(w.trasy, ['/logowanie', '/o/:slug', '/oferty', '/oferty/szkice', '/panel', 'clients', 'faktury', 'po-elemencie', 'ustawienia/:id'])
  assert.equal(w.obcieto, 0)
  writeFileSync(join(k, 'src/app/duzo.ts'), Array.from({ length: 45 }, (_, i) => `const T${i}_PATH = '/t${String(i).padStart(2, '0')}'`).join('\n'))
  const duzo = trasyAplikacji(k)
  assert.equal(duzo.trasy.length, 40)
  assert.equal(duzo.obcieto, 14)
  assert.match(szkieletSkilla(k, { wpisowMapy: 0 }), /<!-- UZUPEŁNIJ: 14 tras poza listą/)
})

test('trasyAplikacji: pakiet frontendu takze z devDependencies (nazwa dokladna), zly package.json pominiety, trasa wzgledna od parametru', () => {
  const k = projekt()
  /** @type {[string, string][]} */
  const pakiety = [
    ['web', JSON.stringify({ devDependencies: { vue: '3.5.0' } })],
    ['typy', JSON.stringify({ devDependencies: { '@types/react': '19.0.0', 'react-query': '3.0.0' } })],
    ['szablon', '{ "name": "{{name}}", }'],
  ]
  for (const [katalog, pkg] of pakiety) {
    mkdirSync(join(k, katalog, 'src'), { recursive: true })
    writeFileSync(join(k, katalog, 'package.json'), pkg)
    writeFileSync(join(k, katalog, 'src/routes.ts'), `export const r = [{ path: '/${katalog}', element: <A /> }, { path: ':${katalog}Id', element: <B /> }]\n`)
  }
  assert.deepEqual(trasyAplikacji(k).trasy, ['/logowanie', '/o/:slug', '/oferty', '/oferty/szkice', '/web', ':webId'])
})

test('wpisyZrobionych: plany w kolejnosci daty — przy tym samym flow nowszy plan daje droge', () => {
  const k = projekt()
  const starszy = 'docs/plans/2026-09-01-001-feat-stare-plan.md'
  writeFileSync(join(k, starszy), PLAN.replace('otwórz /oferty, kliknij „Publikuj” przy szkicu, zrób screenshot', 'stara droga'))
  mkdirSync(join(k, 'docs/completed/zz-stare'), { recursive: true })
  writeFileSync(join(k, 'docs/completed/zz-stare/zz-stare-plan.md'), `Plan techniczny: \`${starszy}\`\n`)
  const wpisy = wpisyZrobionych(k).filter((w) => w.flow === 'publikacja-oferty')
  assert.deepEqual(wpisy.map((w) => [w.zadania[0], w.droga.slice(0, 11)]), [['zz-stare', 'stara droga'], ['publikacja-ofert', 'otwórz /ofe']])
})

test('szkielet: sekcje Launch / Doctor / Drive / Evidence / Cleanup / Mapa funkcji; Doctor = e2e.mjs sprawdz, Launch = e2e.mjs start', () => {
  const k = projekt()
  const s = szkieletSkilla(k, { wpisowMapy: 2 })
  assert.match(s, /^---\nname: weryfikacja\ndescription: "[^"]+"\n---\n/)
  const sekcje = [...s.matchAll(/^## (.+)$/gm)].map((m) => m[1])
  assert.deepEqual(sekcje, ['Launch', 'Doctor', 'Drive', 'Evidence', 'Cleanup', 'Mapa funkcji'])
  /** @param {string} nazwa */
  const sekcja = (nazwa) => s.slice(s.indexOf(`## ${nazwa}\n`), s.indexOf('\n## ', s.indexOf(`## ${nazwa}\n`) + 1))
  assert.match(sekcja('Launch'), /`node \.claude\/scripts\/e2e\/e2e\.mjs start`/)
  assert.match(sekcja('Launch'), /http:\/\/localhost:5180/)
  assert.match(sekcja('Launch'), /pnpm run dev -- --mode e2e --port 5180 --strictPort/)
  assert.match(sekcja('Doctor'), /`node \.claude\/scripts\/e2e\/e2e\.mjs sprawdz`/)
  assert.match(sekcja('Doctor'), /`node \.claude\/scripts\/e2e\/e2e\.mjs stan`/)
  assert.match(sekcja('Drive'), /`\/oferty`/)
  assert.match(sekcja('Drive'), /`\/logowanie`/)
  assert.match(sekcja('Drive'), /E2E_TEST_EMAIL/)
  assert.match(sekcja('Drive'), /data-testid/)
  assert.match(sekcja('Cleanup'), /`node \.claude\/scripts\/e2e\/e2e\.mjs stop`/)
  assert.match(sekcja('Mapa funkcji'), /mapa-funkcji\.md/)
  assert.match(sekcja('Mapa funkcji'), /2 wpis/)
  assert.match(s, /^Przejście na żywo: niewykonane$/m)
  assert.match(s, /<!-- UZUPEŁNIJ:/)
})

test('szkielet bez .env.e2e: domyslny adres Vite i wskazanie setupu; bez tras — znacznik do uzupelnienia', () => {
  const k = projekt({ env: null })
  rmSync(join(k, 'src/app'), { recursive: true })
  const s = szkieletSkilla(k, { wpisowMapy: 0 })
  assert.match(s, /http:\/\/localhost:5173/)
  assert.match(s, /\.claude\/templates\/e2e-env\/README\.md/)
  assert.match(s, /<!-- UZUPEŁNIJ: trasy/)
  assert.doesNotMatch(s, /E2E_TEST_EMAIL/)
})

test('CLI weryfikacja: bez --zapisz podglad bez zapisu; --zapisz tworzy skill i zasiewa mape z planow zrobionych zadan; ponownie bez --nadpisz odmowa', () => {
  const k = projekt()
  const podglad = uruchom(k, ['weryfikacja'])
  assert.equal(podglad.kod, 0, podglad.stderr)
  assert.equal(podglad.json.zapisano, false)
  assert.match(podglad.json.tresc, /^---\nname: weryfikacja/)
  assert.equal(existsSync(join(k, PLIK_SKILLA)), false)

  const w = uruchom(k, ['weryfikacja', '--zapisz'])
  assert.equal(w.kod, 0, w.stderr)
  assert.deepEqual([w.json.zapisano, w.json.plik, w.json.mapa.plik, w.json.mapa.dodane], [true, PLIK_SKILLA, PLIK_MAPY, ['publikacja-oferty', 'oferta-publiczna']])
  assert.deepEqual(w.json.trasy, ['/logowanie', '/o/:slug', '/oferty', '/oferty/szkice'])
  assert.ok(w.json.uzupelnij > 0)
  assert.match(readFileSync(join(k, PLIK_SKILLA), 'utf8'), /2 wpis/)
  const mapa = parsujMape(readFileSync(join(k, PLIK_MAPY), 'utf8'))
  assert.deepEqual(mapa.wpisy.get('publikacja-oferty')?.find(([klucz]) => klucz === 'Zadania'), ['Zadania', 'publikacja-ofert'])

  const ponownie = uruchom(k, ['weryfikacja', '--zapisz'])
  assert.equal(ponownie.kod, 1)
  assert.match(ponownie.json.odmowa, /już istnieje/)
  assert.equal(uruchom(k, ['weryfikacja', '--zapisz', '--nadpisz']).kod, 0)
})
