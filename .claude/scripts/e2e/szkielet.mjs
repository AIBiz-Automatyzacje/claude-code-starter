// Generator skilla weryfikacji projektu (P14, PANEL-WEJSCIE §2 pkt 14; wolany przez /weryfikacja-setup): szkielet SKILL.md
// z faktow repo (parametry .env.e2e, menedzer pakietow, trasy z kodu, konwencja data-testid) i mapa funkcji zasiana z planow
// zrobionych zadan. Launch, Doctor i Cleanup to polecenia e2e.mjs — te same, ktore wola autopilot — wiec skill nie ma
// wlasnego przepisu na srodowisko. Znaczniki „UZUPEŁNIJ” zostawiaja miejsca, ktore agent generatora wypelnia z kodu
// i sprawdza w jednym przejsciu na zywo.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'

import { sciezkaPlanu } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { scalMape, wpisyZPlanu } from './mapa.mjs'
import { envE2e, konfiguracja, PLIK_ENV } from './srodowisko.mjs'
import { PLIK_MAPY, PLIK_SKILLA } from './weryfikacja.mjs'

const KATALOGI_KODU = ['src', 'app', 'apps', 'packages', 'pages']
const POMIJANE = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.turbo', '.git'])
const PLIK_KODU = /\.(?:tsx|ts|jsx|js)$/
const PLIK_TESTU = /\.(?:test|spec)\.|__tests__\//
const TRASA_W_KODZIE = /\bpath\s*[=:]\s*\{?\s*["'`](\/[^"'`\s]*)["'`]/g
// Trasa w stalej (`export const OFFERS_PATH = '/oferty'`), gdy router dostaje `path={OFFERS_PATH}`.
const TRASA_W_STALEJ = /\bconst\s+[A-Z0-9_]*(?:PATH|PATTERN|ROUTE)[A-Z0-9_]*\s*=\s*["'`](\/[^"'`\s]*)["'`]/g
// Trasy wzgledne zagniezdzonego routera (React Router: `<Route path="clients">`, `{ path: 'clients', element }`).
// Atrybuty przed `path` moga miec JSX w klamrach (`element={<L />}`), wiec `>` w klamrach nie konczy znacznika.
const TRASA_WZGLEDNA_JSX = /<Route\b(?:[^>{]|\{[^}]*\})*?\spath=\{?["'`]([A-Za-z0-9:_*][^"'`\s]*)["'`]/g
// Tylko klucze, ktore ma wylacznie obiekt trasy (children, index, loader bywaja w zwyklych obiektach konfiguracji).
const TRASA_WZGLEDNA_OBIEKT = /\bpath:\s*["'`]([A-Za-z0-9_][^"'`\s:]*(?::[A-Za-z][^"'`\s]*)?)["'`]\s*,\s*(?:element|Component|lazy)\b/g
// Pakiet z kodem ekranow: katalog <x>/src liczy sie jako kod frontendu tylko przy takiej zaleznosci w <x>/package.json.
const ZALEZNOSC_FRONTENDU = /^(?:react|react-dom|vue|svelte|solid-js|preact|next|nuxt|@angular\/core|@remix-run\/react|@tanstack\/react-router)$/
const TRASA_API = /^\/api(?:\/|$)/
const STRONA_NEXT = /(?:^|\/)app\/(.*?)\/?page\.(?:tsx|jsx|ts|js)$/
const MAKS_TRAS = 40
const PLIK_STATYCZNY = /\.[a-z0-9]{2,5}$/i
const ZNACZNIK = '<!-- UZUPEŁNIJ:'

/** @param {string} katalog @returns {string[]} pliki pod katalogiem bez wchodzenia do zaleznosci i wynikow budowania */
function pliki(katalog) {
  return readdirSync(katalog, { withFileTypes: true }).flatMap((w) => {
    if (w.isDirectory()) return POMIJANE.has(w.name) ? [] : pliki(join(katalog, w.name))
    return w.isFile() ? [join(katalog, w.name)] : []
  })
}

/** @param {string} katalog @returns {boolean} czy package.json katalogu ma zaleznosc frontendu */
function pakietFrontendu(katalog) {
  const pkg = join(katalog, 'package.json')
  if (!existsSync(pkg)) return false
  const { dependencies = {}, devDependencies = {} } = /** @type {{ dependencies?: object, devDependencies?: object }} */ (JSON.parse(readFileSync(pkg, 'utf8')))
  return [...Object.keys(dependencies), ...Object.keys(devDependencies)].some((z) => ZALEZNOSC_FRONTENDU.test(z))
}

/**
 * @param {string} projekt
 * @returns {string[]} katalogi kodu: znane z korzenia i `<katalog>/src` pierwszego poziomu z pakietem frontendu (np. frontend/src);
 *   backend, skrypty i narzedzia z wlasnym src nie daja tras ekranow
 */
function katalogiKodu(projekt) {
  const podkatalogi = readdirSync(projekt, { withFileTypes: true })
    .filter((w) => w.isDirectory() && !w.name.startsWith('.') && !POMIJANE.has(w.name) && !KATALOGI_KODU.includes(w.name))
    .filter((w) => existsSync(join(projekt, w.name, 'src')) && pakietFrontendu(join(projekt, w.name)))
    .map((w) => `${w.name}/src`)
  return [...KATALOGI_KODU.filter((k) => existsSync(join(projekt, k))), ...podkatalogi]
}

/** @param {string} projekt @returns {string[]} pliki kodu wzgledem projektu (bez testow i katalogow budowania) */
function plikiKodu(projekt) {
  return katalogiKodu(projekt).flatMap((k) => pliki(join(projekt, k)))
    .map((p) => relative(projekt, p).split(sep).join('/'))
    .filter((p) => PLIK_KODU.test(p) && !PLIK_TESTU.test(p))
}

/**
 * Trasy ekranow z kodu: `path: '/x'` (konfiguracja routera), `<Route path="/x">`, trasy wzgledne zagniezdzonego routera, stale
 * `*_PATH`/`*_ROUTE` i katalogi stron app routera Next.js — bez tras API i plikow statycznych.
 * @param {string} projekt
 * @returns {{ trasy: string[], obcieto: number }} posortowane, bez powtorzen; obcieto = trasy ponad limit listy
 */
export function trasyAplikacji(projekt) {
  const trasy = new Set()
  for (const p of plikiKodu(projekt)) {
    const next = STRONA_NEXT.exec(p)
    if (next) trasy.add(`/${next[1].split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/')}`.replace(/\/$/, '') || '/')
    const kod = readFileSync(join(projekt, p), 'utf8')
    for (const wzorzec of [TRASA_W_KODZIE, TRASA_W_STALEJ, TRASA_WZGLEDNA_JSX, TRASA_WZGLEDNA_OBIEKT]) {
      for (const m of kod.matchAll(wzorzec)) trasy.add(m[1])
    }
  }
  const ekrany = [...trasy].filter((t) => t !== '*' && !PLIK_STATYCZNY.test(t) && !TRASA_API.test(t)).sort()
  return { trasy: ekrany.slice(0, MAKS_TRAS), obcieto: Math.max(0, ekrany.length - MAKS_TRAS) }
}

/** @param {string} projekt @returns {number} liczba atrybutow data-testid w kodzie */
const liczTestId = (projekt) => plikiKodu(projekt).reduce((n, p) => n + (readFileSync(join(projekt, p), 'utf8').match(/data-testid=/g)?.length ?? 0), 0)

/** @param {string} projekt @returns {string} */
function nazwaProjektu(projekt) {
  const pkg = join(projekt, 'package.json')
  const nazwa = existsSync(pkg) ? /** @type {{ name?: unknown }} */ (JSON.parse(readFileSync(pkg, 'utf8'))).name : null
  return typeof nazwa === 'string' && nazwa ? nazwa : basename(projekt)
}

/**
 * @param {string} projekt
 * @returns {import('./mapa.mjs').Wpis[]} funkcje ze scenariuszy [E2E] planow zadan z docs/completed/ (kolejnosc: data planu)
 */
export function wpisyZrobionych(projekt) {
  const archiwum = join(projekt, 'docs/completed')
  if (!existsSync(archiwum)) return []
  return readdirSync(archiwum, { withFileTypes: true }).filter((w) => w.isDirectory()).flatMap((w) => {
    const planZadania = plikZadania(join(archiwum, w.name), '-plan.md')?.tresc
    const plan = planZadania ? sciezkaPlanu(planZadania) : null
    return plan && existsSync(join(projekt, plan)) ? [{ plan, zadanie: w.name }] : []
  }).sort((a, b) => a.plan.localeCompare(b.plan))
    .flatMap(({ plan, zadanie }) => wpisyZPlanu(readFileSync(join(projekt, plan), 'utf8'), zadanie))
}

/**
 * @param {string} projekt
 * @param {{ wpisowMapy: number }} opcje
 * @returns {string} tresc SKILL.md skilla weryfikacji projektu
 */
export function szkieletSkilla(projekt, { wpisowMapy }) {
  const env = envE2e(projekt)
  const konf = konfiguracja(projekt, env ?? {})
  const nazwa = nazwaProjektu(projekt)
  const { trasy, obcieto } = trasyAplikacji(projekt)
  const testId = liczTestId(projekt)
  const logowanie = trasy.filter((t) => /login|logowan|signin|sign-in|auth/i.test(t))
  return [
    '---',
    'name: weryfikacja',
    `description: "Weryfikacja aplikacji ${nazwa} na żywo: uruchomienie (Launch), sprawdzenie środowiska (Doctor), prowadzenie aplikacji w przeglądarce (Drive), dowody (Evidence), sprzątanie (Cleanup) i mapa funkcji. Używaj przy scenariuszach [E2E], sprawdzaniu funkcji w działającej aplikacji, odtwarzaniu zgłoszenia i smoke'u operatora."`,
    '---', '',
    `# Weryfikacja — ${nazwa}`, '',
    'Przejście na żywo: niewykonane', '',
    '## Launch', '',
    `\`node .claude/scripts/e2e/e2e.mjs start\` uruchamia w tle \`${konf.start}\` i czeka, aż \`${konf.zdrowie}\` odpowie kodem < 500`,
    `(limit ${konf.limitSek} s). Adres aplikacji: ${konf.url}. Log serwera: \`${konf.log}\`. Działający serwer bez naszego pliku PID jest „zastany” —`,
    'może celować w bazę dev, więc logowanie kontem e2e to pierwszy krok Drive.',
    env ? '' : `Repo nie ma \`${PLIK_ENV}\`: parametry powyżej są domyślne (Vite). Setup: \`.claude/templates/e2e-env/README.md\`.`, '',
    '## Doctor', '',
    `\`node .claude/scripts/e2e/e2e.mjs sprawdz\` — \`${PLIK_ENV}\` w \`.gitignore\`, klucze i guard bazy e2e, \`migrations.sum\`, \`agent-browser doctor\`, adresy.`,
    'Status `gotowe` = instancję warto prowadzić; inny status ma gotową naprawę w polu `naprawa`.',
    '`node .claude/scripts/e2e/e2e.mjs stan` — czy serwer uruchomiony przez Launch żyje i ogon jego logu (aplikacja przestała odpowiadać).', '',
    '## Drive', '',
    'Przeglądarka: skill `agent-browser` — `open <url>` → `snapshot -i` → akcja na refie → `snapshot -i` po każdej zmianie strony.', '',
    `Trasy z kodu (bez API; względne — segmenty zagnieżdżonego routera): ${trasy.length ? trasy.map((t) => `\`${t}\``).join(', ') : `${ZNACZNIK} trasy aplikacji (router nie dał się odczytać z kodu) -->`}`,
    obcieto ? `${ZNACZNIK} ${obcieto} tras poza listą — dopisz ekrany używane w scenariuszach [E2E] -->` : '', '',
    env?.E2E_TEST_EMAIL
      ? `Logowanie: konto \`E2E_TEST_EMAIL\` / \`E2E_TEST_PASSWORD\` z \`${PLIK_ENV}\` (wartości nie trafiają do logów)${logowanie.length ? ` na ${logowanie.map((t) => `\`${t}\``).join(', ')}` : ''}.`
      : `Logowanie: ${ZNACZNIK} konto testowe i trasa logowania; bez logowania wpisz „nie dotyczy” -->`,
    `${ZNACZNIK} pola formularza logowania i nawigacja do głównych ekranów (etykiety, role, data-testid) -->`, '',
    testId
      ? `Selektory: kod ma ${testId} atrybutów \`data-testid\` — przy niejednoznacznym snapshotcie szukaj po nich (\`agent-browser find testid <id> click\`).`
      : 'Selektory: kod nie ma atrybutów `data-testid` — elementy wskazuj rolą i etykietą ze snapshotu.', '',
    '## Evidence', '',
    'Dowód scenariusza = akcja + stan po akcji + skutek uboczny. Stan: asercja w snapshotcie albo `agent-browser get text` i zrzut',
    '`agent-browser screenshot <folder zadania>/<flow>.png`. Skutek uboczny (zapis, wysyłka): odpowiedź HTTP (`curl -sS`) albo wiersz bazy e2e.',
    'Zrzuty leżą w folderze zadania, więc przeżywają Cleanup.', '',
    '## Cleanup', '',
    '`node .claude/scripts/e2e/e2e.mjs stop` zatrzymuje wyłącznie serwer uruchomiony przez Launch (plik PID); serwer zastany zostaje.',
    '`agent-browser close` zamyka przeglądarkę.', '',
    '## Mapa funkcji', '',
    `[mapa-funkcji.md](mapa-funkcji.md) — ${wpisowMapy} wpis(ów): droga użytkownika, dowód działania i pliki kodu funkcji. Archiwizacja zadania`,
    'dopisuje do niej funkcje ze scenariuszy [E2E] planu (`node .claude/scripts/e2e/e2e.mjs mapa --zadanie <docs/active/zadanie>`);',
    'tester E2E szuka w niej wpisu o flow scenariusza.', '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
}

/**
 * @param {string} projekt
 * @param {{ zapisz: boolean, nadpisz: boolean }} opcje
 * @returns {{ odmowa: string } | { plik: string, zapisano: boolean, tresc?: string, trasy: string[], obcieto: number, uzupelnij: number,
 *   mapa: { plik: string, wpisow: number, dodane: string[], zaktualizowane: string[] } }}
 */
export function generujSkill(projekt, { zapisz, nadpisz }) {
  const sciezkaSkilla = join(projekt, PLIK_SKILLA)
  if (zapisz && existsSync(sciezkaSkilla) && !nadpisz) {
    return { odmowa: `${PLIK_SKILLA} już istnieje — uzupełnione sekcje zostają; nadpisanie szkieletem tylko z --nadpisz` }
  }
  const sciezkaMapy = join(projekt, PLIK_MAPY)
  const obecna = existsSync(sciezkaMapy) ? readFileSync(sciezkaMapy, 'utf8') : null
  const mapa = scalMape(obecna, wpisyZrobionych(projekt), basename(projekt))
  const wpisow = (mapa.tekst.match(/^## `/gm) ?? []).length
  const tresc = szkieletSkilla(projekt, { wpisowMapy: wpisow })
  const { trasy, obcieto } = trasyAplikacji(projekt)
  const wynik = { plik: PLIK_SKILLA, trasy, obcieto, uzupelnij: tresc.split(ZNACZNIK).length - 1, mapa: { plik: PLIK_MAPY, wpisow, dodane: mapa.dodane, zaktualizowane: mapa.zaktualizowane } }
  if (!zapisz) return { ...wynik, zapisano: false, tresc }
  mkdirSync(dirname(sciezkaSkilla), { recursive: true })
  writeFileSync(sciezkaSkilla, tresc)
  if (mapa.tekst !== obecna) writeFileSync(sciezkaMapy, mapa.tekst)
  return { ...wynik, zapisano: true }
}
