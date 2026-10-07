// Klasy zapobiegalne dla buildera (PLAN-POPRAWY P12, D10; ETAP1B „dossier klas ucieczek”): zdanie „co robic zamiast”
// dla klas bledow, ktore review znajduje w kodzie builderow, a ktorych nie pokrywa warstwa stala builderow ani reguly kodu.
// Dobor po plikach produkcyjnych jednostki (globy klasy; zdania o warstwie danych nie trafiaja do czystego IU UI). Tresc zdan jest stala,
// z compoundow projektu pochodzi kolejnosc: liczba solutions klasy; przy remisie zdanie o wezszym globie (seed, SQL, serwer)
// idzie przed szerszym (dane, caly kod), bo szerokie zdania pasuja do kazdego pliku i wypieralyby waskie z limitu; dalej
// kolejnosc tabeli (czestosc uwag B w ETAP1B). Wykrywalne klasy maja listy reviewerow
// (P11), mechaniczne — ESLint (P6); tu tylko te, ktorym builder moze zapobiec jednym ruchem przy pisaniu.

import { posix } from 'node:path'

import { pole } from './wpisy.mjs'

export const NAGLOWEK = 'Klasy błędów, które review znajduje w takich plikach — co robić zamiast:'

const KOD = ['**/*.{ts,tsx,js,jsx,mjs,cjs}']
const SQL = ['**/*.sql']
const SERWER = ['supabase/functions/**', '**/server/**', '**/api/**']
// Hook, klient API i serwis w folderze funkcji (features/<x>/use-*.ts) to ta sama warstwa co lib/ i hooks/ — w projektach
// z podzialem na funkcje defekty tej warstwy lezaly wlasnie tam.
const KLIENT_DANYCH = ['**/lib/**', '**/hooks/**', '**/services/**', '**/model/**', '**/use-*.ts', '**/*-api.ts', '**/*-service.ts']
const WIDOKI = ['**/components/**', '**/pages/**', '**/features/**']
const DANE = ['supabase/**', ...KLIENT_DANYCH, ...SERWER]
// Warstwa, przez ktora przechodzi kazda droga do operacji (serwer, baza, serwis, klient API): tu stoja bramki i zapisy
// w kilku krokach. Hook UI tylko wola serwis — zdania o bramkach wypieralyby z limitu zdanie o wyscigu, ktore go dotyczy.
const ZAPLECZE = ['supabase/**', ...SERWER, '**/services/**', '**/*-service.ts', '**/*-api.ts']
// Test, spec i __tests__ nie dobieraja zdan: zdanie dotyczy kodu produkcyjnego, a IU z samym testem pliku z innego IU
// dostalby zdania tamtej warstwy.
const TEST = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/
const SEEDY = ['e2e/seeds/**', '**/seed*.sql']

/** @typedef {{ klasa: string, paths: string[], zdanie: string }} Zdanie */

/** @type {Zdanie[]} */
export const ZDANIA = [
  { klasa: 'dopasowanie-tekstu', paths: KOD, zdanie: 'Tekst o strukturze (URL, HTML, e-mail, ścieżkę, CSV, nagłówek) rozbierasz parserem (`new URL`, `DOMParser`, biblioteka projektu) i porównujesz po normalizacji wielkości liter i Unicode, bo regex i `includes` przepuszczają warianty zapisu.' },
  { klasa: 'bramka-czarna-lista', paths: [...ZAPLECZE, ...SQL], zdanie: 'Bramkę dostępu i filtr wejścia (role, statusy, rozszerzenia plików, ścieżki) piszesz listą tego, co przepuszczasz, a gałąź domyślna odmawia, bo lista zakazanych wartości przepuszcza każdy wariant, którego nie przewidziała.' },
  { klasa: 'pii-i-sekrety', paths: [...KLIENT_DANYCH, ...SERWER, ...WIDOKI], zdanie: 'Do `new Error(...)` i komunikatu w logu wkładasz kod błędu i identyfikator zasobu zamiast wartości wejścia (e-mail, treść, token, URL z parametrami), bo komunikat błędu trafia do Sentry jako tytuł zdarzenia, poza redakcją kontekstu.' },
  { klasa: 'bramka-na-jednej-drodze', paths: [...ZAPLECZE, ...SQL], zdanie: 'Warunek dostępu stawiasz w miejscu, przez które przechodzi każda droga do operacji (polityka, funkcja serwisu), i wypisujesz te drogi (formularz, API, import, zadanie cykliczne), bo warunek w jednym handlerze omija druga droga.' },
  { klasa: 'wyscig-i-wspolbieznosc', paths: KOD, zdanie: 'Wartość odczytaną przed `await` sprawdzasz po nim (numer generacji żądania, porównanie z bieżącym id), a zapis zależny od odczytu robisz jednym warunkowym zapytaniem, bo dwa kliknięcia albo dwie karty nadpisują nowszy wynik starszym.' },
  { klasa: 'sciezka-bledu', paths: ZAPLECZE, zdanie: 'Operację w kilku krokach (dwie tabele, baza i Storage, baza i e-mail) zamykasz w transakcji albo funkcji SQL, a krok zewnętrzny wykonujesz po zapisie z obsługą jego porażki, bo przerwanie w połowie zostawia rozjechane dane.' },
  { klasa: 'wartosc-graniczna', paths: [...SQL, ...DANE, '**/schemas/**'], zdanie: 'Długość i zakres każdej generowanej wartości (slug, numer, nazwa z sufiksem) liczysz pod ograniczenie kolumny dla najdłuższego wejścia, a test bierze wartość na granicy (0, 1, limit, limit + 1), bo błąd wychodzi dopiero przy rzadkim wejściu.' },
  { klasa: 'limit-czasu-i-ponowien', paths: [...KLIENT_DANYCH, ...SERWER], zdanie: 'Ponowienie ma sufit prób i rosnący odstęp, ponawia tylko błędy przejściowe (sieć, 429, 5xx), a zapis nieidempotentny idzie z kluczem idempotencji, bo pętla bez sufitu wiesza użytkownika, a ponowiony zapis dubluje dane.' },
  { klasa: 'zaufanie-danym-klienta', paths: SERWER, zdanie: 'Limit i decyzję dostępu liczysz z danych ustalonych przez serwer (rozmiar faktycznie odczytanego ciała, tożsamość z tokenu, adres od zaufanego proxy), bo `content-length`, `x-forwarded-for` i `origin` ustawia klient.' },
  { klasa: 'migracja-bazy', paths: ['**/migrations/**'], zdanie: 'Migrację piszesz tak, żeby przeszła drugi raz (`if not exists`, `create or replace`) i w kolejności zależności, a zmianę blokującą dużą tabelę (indeks, zmiana typu, `not null` z uzupełnieniem) dzielisz na osobne migracje, bo blokada zatrzymuje aplikację.' },
  { klasa: 'seed-e2e', paths: SEEDY, zdanie: 'Seed E2E wstawia każdą kolumnę `not null` bez wartości domyślnej i tylko wartości, które produkcja może wytworzyć (status, relacje, właściciel z konta testowego), bo seed z wartością nieosiągalną testuje stan, którego aplikacja nie zna.' },
]

// Klasy pokryte warstwa stala builderow albo regulami kodu (builder czyta je jawnie) — bez zdania, zeby nie dublowac.
// Test sprawdza, ze fraza stoi w kazdym wskazanym pliku; po jej usunieciu klasa wraca do ZDANIA. Pokrycie
// `cache-i-zapytania` jest czesciowe (N+1; cache i limiter lapie performance-oracle).
const REGULY = ['.claude/rules/coding-rules.md']
const BUILDERY_UI = ['.claude/agents/feature-builder-ui.md', '.claude/agents/feature-builder-fullstack.md']
/** @type {Record<string, { pliki: string[], fraza: string }>} */
export const POKRYTE = {
  'test-niefalsyfikowalny': { pliki: REGULY, fraza: 'gdyby każda importowana funkcja zwracała `undefined`' },
  'walidacja-granicy-api': { pliki: REGULY, fraza: 'parsujesz schematem Zod przed użyciem' },
  'kontrakt-wspolny': { pliki: REGULY, fraza: 'stała albo kontrakt (schemat, typ, próg) w dwóch miejscach' },
  'cykl-zycia-ui': { pliki: REGULY, fraza: 'Efekt z async w cleanupie unieważnia wynik' },
  'polkniety-blad': { pliki: REGULY, fraza: 'zostawia ślad dla operatora' },
  'cache-i-zapytania': { pliki: REGULY, fraza: 'Zapytanie do bazy w pętli to N+1' },
  'tekst-ui': { pliki: BUILDERY_UI, fraza: 'obiecujesz w nim tylko to, co robi kod jednostki' },
  'a11y': { pliki: BUILDERY_UI, fraza: 'checklistą dostępności skilla ux-ui-guidelines' },
}

// Szerokosc globu zdania: 0 seed/SQL/migracje, 1 serwer, 2 warstwa danych albo widoki, 3 caly kod.
/** @param {Zdanie} z @returns {number} */
function szerokosc(z) {
  if (z.paths.some((g) => KOD.includes(g))) return 3
  if (z.paths.some((g) => KLIENT_DANYCH.includes(g) || WIDOKI.includes(g))) return 2
  if (z.paths.some((g) => SERWER.includes(g))) return 1
  return 0
}

/** @param {Zdanie} z @returns {string} */
function linia(z) {
  return `- ${z.klasa}: ${z.zdanie}`
}

/**
 * @param {import('./wpisy.mjs').Wpis[]} wpisy wpisy solutions projektu (liczba na klase ustala kolejnosc)
 * @param {string[]} pliki sciezki plikow jednostki (wzgledem repo)
 * @param {{ pominKlasy?: string[], limitZn?: number }} [opcje] pominKlasy — klasy z regula projektu juz w wycinku
 * @returns {{ tresc: string, zn: number, klasy: string[], pominiete: number }}
 */
export function zapobieganie(wpisy, pliki, { pominKlasy = [], limitZn = Number.POSITIVE_INFINITY } = {}) {
  /** @type {Map<string, number>} */
  const liczba = new Map()
  for (const w of wpisy) liczba.set(pole(w, 'klasa'), (liczba.get(pole(w, 'klasa')) ?? 0) + 1)
  const produkcyjne = pliki.filter((p) => !TEST.test(p))
  const dobrane = ZDANIA
    .filter((z) => !pominKlasy.includes(z.klasa) && produkcyjne.some((p) => z.paths.some((g) => posix.matchesGlob(p, g))))
    .map((z, i) => ({ z, i }))
    .sort((a, b) => (liczba.get(b.z.klasa) ?? 0) - (liczba.get(a.z.klasa) ?? 0) || szerokosc(a.z) - szerokosc(b.z) || a.i - b.i)
    .map(({ z }) => z)
  /** @type {Zdanie[]} */
  const wziete = []
  let zn = NAGLOWEK.length
  for (const z of dobrane) {
    if (zn + 1 + linia(z).length > limitZn) break
    wziete.push(z)
    zn += 1 + linia(z).length
  }
  const tresc = wziete.length ? [NAGLOWEK, ...wziete.map(linia)].join('\n') : ''
  return { tresc, zn: tresc.length, klasy: wziete.map((z) => z.klasa), pominiete: dobrane.length - wziete.length }
}
