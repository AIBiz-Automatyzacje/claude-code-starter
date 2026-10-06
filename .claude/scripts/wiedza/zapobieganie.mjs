// Klasy zapobiegalne dla buildera (PLAN-POPRAWY P12, D10; ETAP1B „dossier klas ucieczek”): zdanie „co robic zamiast”
// dla klas bledow, ktore review znajduje w kodzie builderow, a ktorych nie pokrywa warstwa stala builderow ani reguly kodu.
// Dobor po plikach jednostki (globy klasy). Kolejnosc wg liczby solutions klasy w projekcie — tabela regeneruje sie
// z compoundow; remis rozstrzyga kolejnosc tabeli (czestosc uwag B w ETAP1B). Wykrywalne klasy maja listy reviewerow
// (P11), mechaniczne — ESLint (P6); tu tylko te, ktorym builder moze zapobiec jednym ruchem przy pisaniu.

import { posix } from 'node:path'

import { pole } from './wpisy.mjs'

export const NAGLOWEK = 'Klasy błędów, które review znajduje w takich plikach — co robić zamiast:'

const KOD = ['**/*.{ts,tsx,js,jsx,mjs,cjs}']
const SQL = ['**/*.sql']
const SERWER = ['supabase/functions/**', '**/server/**', '**/api/**']
const DANE = ['supabase/**', '**/lib/**', '**/hooks/**', '**/services/**', ...SERWER]
const SEEDY = ['e2e/seeds/**', '**/seed*.sql']

/** @typedef {{ klasa: string, paths: string[], zdanie: string }} Zdanie */

/** @type {Zdanie[]} */
export const ZDANIA = [
  { klasa: 'dopasowanie-tekstu', paths: KOD, zdanie: 'Tekst o strukturze (URL, HTML, e-mail, ścieżkę, CSV, nagłówek) rozbierasz parserem (`new URL`, `DOMParser`, biblioteka projektu) i porównujesz po normalizacji wielkości liter i Unicode, bo regex i `includes` przepuszczają warianty zapisu.' },
  { klasa: 'bramka-czarna-lista', paths: [...KOD, ...SQL], zdanie: 'Bramkę dostępu i filtr wejścia piszesz listą tego, co przepuszczasz, a gałąź domyślna odmawia, bo lista zakazanych wartości (ról, ścieżek, statusów, rozszerzeń) przepuszcza każdy wariant, którego nie przewidziała.' },
  { klasa: 'pii-i-sekrety', paths: KOD, zdanie: 'Do komunikatu błędu, logu i kontekstu Sentry wkładasz kod błędu i identyfikatory zamiast wartości wejścia (e-mail, treść, token, URL z parametrami), bo `error.message` z danymi wejścia trafia do Sentry bez redakcji.' },
  { klasa: 'bramka-na-jednej-drodze', paths: [...KOD, ...SQL], zdanie: 'Warunek dostępu stawiasz w miejscu, przez które przechodzi każda droga do operacji (polityka, funkcja serwisu), i wypisujesz te drogi (formularz, API, import, zadanie cykliczne), bo warunek w jednym handlerze omija druga droga.' },
  { klasa: 'wyscig-i-wspolbieznosc', paths: KOD, zdanie: 'Wartość odczytaną przed `await` sprawdzasz po nim (numer generacji żądania, porównanie z bieżącym id), a zapis zależny od odczytu robisz jednym warunkowym zapytaniem, bo dwa kliknięcia albo dwie karty nadpisują nowszy wynik starszym.' },
  { klasa: 'sciezka-bledu', paths: DANE, zdanie: 'Operację w kilku krokach (dwie tabele, baza i Storage, baza i e-mail) zamykasz w transakcji albo funkcji SQL, a krok zewnętrzny wykonujesz po zapisie z obsługą jego porażki, bo przerwanie w połowie zostawia rozjechane dane.' },
  { klasa: 'wartosc-graniczna', paths: [...SQL, ...DANE], zdanie: 'Długość i zakres każdej generowanej wartości (slug, numer, nazwa z sufiksem) liczysz pod ograniczenie kolumny dla najdłuższego wejścia, a test bierze wartość na granicy (0, 1, limit, limit + 1), bo błąd wychodzi dopiero przy rzadkim wejściu.' },
  { klasa: 'limit-czasu-i-ponowien', paths: KOD, zdanie: 'Ponowienie ma sufit prób i rosnący odstęp, ponawia tylko błędy przejściowe (sieć, 429, 5xx), a zapis nieidempotentny idzie z kluczem idempotencji, bo pętla bez sufitu wiesza użytkownika, a ponowiony zapis dubluje dane.' },
  { klasa: 'zaufanie-danym-klienta', paths: SERWER, zdanie: 'Limit i decyzję dostępu liczysz z danych ustalonych przez serwer (rozmiar faktycznie odczytanego ciała, tożsamość z tokenu, adres od zaufanego proxy), bo `content-length`, `x-forwarded-for` i `origin` ustawia klient.' },
  { klasa: 'seed-e2e', paths: SEEDY, zdanie: 'Seed E2E wstawia każdą kolumnę `not null` bez wartości domyślnej i tylko wartości, które produkcja może wytworzyć (status, relacje, właściciel z konta testowego), bo seed z wartością nieosiągalną testuje stan, którego aplikacja nie zna.' },
]

// Klasy pokryte warstwa stala builderow albo regulami kodu (builder czyta je jawnie) — bez zdania, zeby nie dublowac.
// Test sprawdza, ze fraza nadal stoi we wskazanym pliku; po jej usunieciu klasa wraca do ZDANIA.
/** @type {Record<string, { plik: string, fraza: string }>} */
export const POKRYTE = {
  'migracja-bazy': { plik: '.claude/agents/feature-builder-data.md', fraza: 'supabase migration new' },
  'test-niefalsyfikowalny': { plik: '.claude/rules/coding-rules.md', fraza: 'gdyby każda importowana funkcja zwracała `undefined`' },
  'walidacja-granicy-api': { plik: '.claude/rules/coding-rules.md', fraza: 'parsujesz schematem Zod przed użyciem' },
  'kontrakt-wspolny': { plik: '.claude/rules/coding-rules.md', fraza: 'stała albo kontrakt (schemat, typ, próg) w dwóch miejscach' },
  'cykl-zycia-ui': { plik: '.claude/rules/coding-rules.md', fraza: 'Efekt z async w cleanupie unieważnia wynik' },
  'polkniety-blad': { plik: '.claude/rules/coding-rules.md', fraza: 'zostawia ślad dla operatora' },
  'cache-i-zapytania': { plik: '.claude/rules/coding-rules.md', fraza: 'Zapytanie do bazy w pętli to N+1' },
  'tekst-ui': { plik: '.claude/agents/feature-builder-ui.md', fraza: 'obiecujesz w nim tylko to, co robi kod jednostki' },
  'a11y': { plik: '.claude/agents/feature-builder-ui.md', fraza: 'checklistą dostępności skilla ux-ui-guidelines' },
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
  const dobrane = ZDANIA
    .filter((z) => !pominKlasy.includes(z.klasa) && pliki.some((p) => z.paths.some((g) => posix.matchesGlob(p, g))))
    .map((z, i) => ({ z, i }))
    .sort((a, b) => (liczba.get(b.z.klasa) ?? 0) - (liczba.get(a.z.klasa) ?? 0) || a.i - b.i)
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
