// Rola i klasa roli agenta z etykiety workflowu. Port rola()/klasa() z analizy 2026-09 (panel_koszt_dane.py —
// wersja z poprawka przegladu D5: najdluzsza pasujaca nazwa) + klasyfikacja po prompcie dla starych runow bez etykiet.

// Role, ktorych etykieta niesie ogon (`build:IU-2`, `scribe:inspekcja`). Kolejnosc = od najdluzszej, zeby
// `fix:kontrola` nie wpadl w `fix`, a `compound-refresh` w `compound`.
const ROLE_Z_OGONEM = [
  'fix:pre-skan', 'fix:kontrola', 'fix:poprawka', 'compound-refresh', 'smoke-operatora', 'e2e:db-sync',
  'stan:zapis', 'domkniecie', 'telemetria', 'compound', 'complete', 'planner', 'scribe', 'build', 'stop', 'fix',
]

// P7: kontekst:diff (packager) i zwin-do-poprawy wyszly z pipeline'u — dossier liczy skrypt, zwijanie robi fix.
// P14: e2e:precheck i e2e:env-up zastapil e2e:start (skrypt e2e.mjs); stare role zostaja dla starych runow.
const MECHANICZNE = new Set([
  'stan:zapis', 'telemetria', 'dedup:semantyczny', 'e2e:precheck', 'e2e:start', 'dossier:zapas', 'e2e:env-down',
  'fix:pre-skan', 'stop:commit-artefaktow', 'start:p3-known-issues', 'ogrod:pomiar',
])
// P8: fix:pre-skan i verify-fix wyszly z pipeline'u (listy K kontroli fixa), ale rozpoznanie zostaje dla starych runow —
// bez fix:pre-skan w ROLE_Z_OGONEM etykieta sklejalaby sie w `fix`, a fixFazy czytalaby wynik pre-skanu jako commity fixa.
// P15: ocena ogrodnika (klasa-sceptyk, bez edycji) — czyta kod w miejscach z pomiaru i zwraca propozycje.
const SCEPTYCY = new Set(['verify', 'verify-batch', 'verify-fix', 'ogrod:ocena'])
const NAPRAWIACZE = new Set(['fix', 'fix:poprawka'])

/** @typedef {'mechaniczny' | 'orkiestracyjny' | 'reviewer' | 'sceptyk' | 'builder' | 'naprawiacz' | 'tester-e2e'} KlasaRoli */

/**
 * @param {string | null | undefined} etykieta etykieta agenta z journala / pliku harnessu / meta
 * @returns {string | null} rola bez numerow fazy, IU, proby i tury; null gdy etykiety brak
 */
export function rola(etykieta) {
  if (!etykieta) return null
  const sceptyk = etykieta.match(/^(verify-batch|verify-fix|verify):/)
  if (sceptyk) return sceptyk[1]
  const pr = etykieta.match(/^pr:([a-z-]+)/)
  if (pr) return `pr:${pr[1]}`
  const bezNumerow = etykieta.replace(/:retry$/, '').replace(/:faza-\d+$|:IU-\d+(\.\d+)?$|:tura-\d+$|:\d+$/, '')
  return ROLE_Z_OGONEM.find((r) => bezNumerow === r || bezNumerow.startsWith(`${r}:`)) ?? bezNumerow
}

/**
 * Klasa roli (mapa D3 + panel). Agenci dev-pr (`pr:*`) liczeni jako orkiestracyjni — prowadza etap, nie oceniaja kodu.
 * @param {string | null} r rola z `rola()`
 * @returns {KlasaRoli | null}
 */
export function klasaRoli(r) {
  if (!r || r === '?') return null
  if (MECHANICZNE.has(r)) return 'mechaniczny'
  if (SCEPTYCY.has(r)) return 'sceptyk'
  if (r === 'review:e2e') return 'tester-e2e'
  if (r.startsWith('review:')) return 'reviewer'
  if (r === 'build') return 'builder'
  if (NAPRAWIACZE.has(r)) return 'naprawiacz'
  return 'orkiestracyjny'
}

// Stary format journala (przed etykietami): rola z poczatku promptu delegacji. Kolejnosc ma znaczenie.
/** @type {Array<[RegExp, string]>} */
const OSIE_REVIEWERA = [
  [/auth, RLS/, 'review:security'], [/zgodnosc implementacji ze spec/, 'review:spec-compliance'], [/N\+1 queries/, 'review:performance'],
  [/YAGNI/, 'review:simplicity'], [/SOLID, wzorce/, 'review:architecture'], [/type safety/, 'review:typescript'],
  [/POPRAWNOSC WYKONANIA/, 'review:correctness'], [/jakosc wewnetrzna kodu/, 'review:code-quality'],
]
/** @type {Array<[RegExp, string]>} */
const POCZATKI_PROMPTU = [
  [/^Jestes plannerem/, 'planner'], [/^Jestes domknieciem/, 'domkniecie'], [/^Dopisz JEDNA linie telemetrii/, 'telemetria'],
  [/^Jestes precheck-agentem E2E/, 'e2e:precheck'], [/^Jestes bootstrapem/, 'bootstrap'], [/^Adwersaryjnie OBAL ten finding/, 'verify'],
  [/^Adwersaryjnie OBAL ponizsze findingi/, 'verify-batch'], [/^Jestes agentem srodowiska E2E/, 'e2e:env-up'], [/^Zapisz plik stanu/, 'stan:zapis'],
  [/^Jestes specjalista ds\. zamykania/, 'complete'], [/Utrzymujesz baze wiedzy PO zapisie/, 'compound-refresh'],
  [/Dokumentujesz rozwiazane problemy/, 'compound'], [/To JEDYNA tura poprawek po kontroli/, 'fix:poprawka'],
  [/Naprawiasz problemy z review fazy/, 'fix'], [/^Sprzatanie srodowiska E2E/, 'e2e:env-down'], [/^Pipeline dev-autopilot zatrzymuje sie/, 'stop'],
  [/^Jestes agentem synchronizacji bazy e2e/, 'e2e:db-sync'], [/^Uruchom w korzeniu repo dokladnie jedno polecenie i przepisz jego wynik/, 'e2e:start'], [/^Ponizej ponumerowana lista findingow/, 'dedup:semantyczny'],
  [/^Jestes scribe review/, 'scribe'], [/^Jestes testerem E2E w przegladarce/, 'review:e2e'],
  [/^Jestes testerem scenariuszy\/coverage/, 'review:test-coverage'], [/^Mechaniczny skan commitow fix/, 'fix:pre-skan'],
  [/^Jestes NIEZALEZNYM kontrolerem commitow fix/, 'fix:kontrola'], [/^Uruchom w korzeniu repo \(Bash\): `node \.claude\/scripts\/dossier\/dossier\.mjs/, 'dossier:zapas'],
  [/^Jestes rozgrzewka cache/, 'warmup:vitest'], [/^Wykonaj pelna walidacje calego projektu/, 'walidacja-koncowa'],
  [/^Jestes autorem checklisty smoke/, 'smoke-operatora'], [/Weryfikujesz poprawke findingu|verify-fix/, 'verify-fix'],
  [/(Ścieżka zadania|Ścieżka dokumentacji zadania|^Zadanie: docs\/active\/|Implementation Unit|Numer IU)/, 'build'],
]

// ile znakow poczatku promptu wystarcza do rozpoznania roli (jak w koszt_agentow.py)
const DLUGOSC_POCZATKU = 700

/**
 * @param {string | null} prompt pierwszy prompt agenta
 * @returns {string | null}
 */
export function klasyfikujPoPrompcie(prompt) {
  const tekst = (prompt ?? '').replace(/\s+/g, ' ')
  if (tekst.startsWith('Jestes reviewerem')) {
    const os = OSIE_REVIEWERA.find(([re]) => re.test(tekst))
    return os ? os[1] : 'review:?'
  }
  const poczatek = tekst.slice(0, DLUGOSC_POCZATKU)
  const trafienie = POCZATKI_PROMPTU.find(([re]) => re.test(poczatek))
  return trafienie ? trafienie[1] : null
}
