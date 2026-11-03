// Podział reguł kodu na rdzeń i reguły stacku (plan szablonu mobile z rdzenia, IU-1.9, A0.5 §1 i §3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/reguly-stacku.test.mjs
//
// DLACZEGO: `coding-rules.md` czytają buildery, fix i sesja główna każdego projektu. Mechanizm zależny od stacku
// (limit czasu żądania, rozpoznanie React Compilera i trybu aplikacji, budżet paczki, miejsce testów, przypinanie wersji)
// w regule rdzenia psuje kod mobile: `AbortSignal.timeout` nie istnieje w Hermesie, Expo włącza kompilator w app config,
// a plik testu w `app/` Expo Router bierze za trasę. Rdzeń mówi więc „co”, a „czym” odsyła do `.claude/rules/stack.md`
// (slot, nakładka stacku podmienia go w całości). Asercje są kontraktem każdego wariantu; treść wariantu web sprawdza
// stacks/web/__tests__/reguly.test.mjs.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { plikiRdzenia } from '../../../stacks/straznik.mjs'
import { AGENCI, tresc } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const REGULY_KODU = '.claude/rules/coding-rules.md'
const REGULY_STACKU = '.claude/rules/stack.md'
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(REPO, sciezka), 'utf8')
const RDZEN = czytaj(REGULY_KODU)
const STACK = czytaj(REGULY_STACKU)

/** @param {string} tekst @returns {string | undefined} */
const frontmatter = (tekst) => /^---\n([\s\S]*?)\n---\n/.exec(tekst)?.[1]

/**
 * Odesłania „`.claude/rules/stack.md`, sekcja „<nazwa>”” w tekście.
 * @param {string} tekst @returns {string[]}
 */
const sekcjeOdeslan = (tekst) => [...tekst.matchAll(/\.claude\/rules\/stack\.md`?,? sekcj[aeię] „([^”]+)”/g)].map((m) => m[1])

test('reguły stacku: frontmatter z paths (ładowanie po typie pliku jak rdzeń) i nagłówek', () => {
  const fm = frontmatter(STACK)
  assert.ok(fm, 'brak frontmattera')
  assert.match(fm, /^paths:$/m)
  assert.match(STACK.replace(/^---\n[\s\S]*?\n---\n/, ''), /^\s*# \S/)
})

test('rdzeń zapowiada reguły stacku i pierwszeństwo stack.md w kodzie aplikacji', () => {
  const wstep = RDZEN.slice(0, RDZEN.indexOf('\n## '))
  assert.ok(wstep.includes(`\`${REGULY_STACKU}\``), 'wstęp rdzenia nie odsyła do reguł stacku')
  assert.match(wstep, /przy sprzeczności[^.]*wygrywa `stack\.md`/)
})

test('rdzeń nie niesie mechanizmów stacku — odsyła do sekcji stack.md', () => {
  for (const fraza of ['AbortSignal.timeout', 'babel-plugin-react-compiler', 'Testy leżą obok plików źródłowych',
    'przypinasz dokładnie', 'zawężaniu DOM', 'size-limit', 'React.lazy', 'SITE_URL', 'strona → komponent']) {
    assert.ok(!RDZEN.includes(fraza), `rdzeń zawiera mechanizm stacku: ${fraza}`)
  }
  const sekcje = sekcjeOdeslan(RDZEN)
  for (const s of ['Organizacja kodu', 'Zależności', 'Bezpieczeństwo', 'Type safety', 'Performance', 'Async i React']) {
    assert.ok(sekcje.includes(s), `rdzeń nie odsyła do sekcji „${s}” reguł stacku`)
  }
})

test('każde odesłanie rdzenia do sekcji reguł stacku trafia w nagłówek ## wariantu', () => {
  let liczba = 0
  for (const plik of plikiRdzenia(REPO).filter((p) => p !== REGULY_STACKU)) {
    for (const sekcja of sekcjeOdeslan(czytaj(plik))) {
      assert.match(STACK, new RegExp(`^## ${sekcja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${plik}: brak sekcji „${sekcja}” w stack.md`)
      liczba++
    }
  }
  assert.ok(liczba >= 10, `za mało odesłań do sekcji reguł stacku (${liczba}) — wzorzec testu wymaga aktualizacji`)
})

// Buildery i klasa naprawiacza czytają reguły jawnie narzędziem Read (reguly-naprawiacza.test.mjs) — bez drugiego odczytu
// zostałyby z regułą rdzenia „mechanizm: stack.md” i bez mechanizmu, gdy pracują Bashem.
test('role zmieniające kod czytają narzędziem Read także reguły stacku', () => {
  const role = ['feature-builder-data', 'feature-builder-ui', 'feature-builder-fullstack', 'feature-builder-ui-figma',
    'feature-builder-fullstack-figma', 'klasa-naprawiacz']
  const bez = role.filter((r) => !tresc(czytaj(`${AGENCI}/${r}.md`)).includes(`cały plik \`${REGULY_STACKU}\``))
  assert.deepEqual(bez, [])
})

test('reviewerzy, hook i config bota odsyłają do reguł stacku zamiast cytować mechanizm web', () => {
  assert.match(czytaj('.claude/agents/architecture-strategist.md'), /`as const` i wyjątkami z `\.claude\/rules\/stack\.md`, sekcja „Type safety”/)
  assert.match(czytaj('.claude/agents/security-sentinel.md'), /\.claude\/rules\/stack\.md`, sekcja „Bezpieczeństwo”/)
  assert.match(czytaj('.claude/agents/performance-oracle.md'), /\.claude\/rules\/stack\.md`, sekcja „Performance”/)
  assert.match(czytaj('.claude/hooks/stop-build-check-enhanced.sh'), /rules\/stack\.md, sekcja Type safety/)
  assert.match(czytaj('.claude/skills/dev-pr/SKILL.md'), /`\.claude\/rules\/stack\.md`/)
})

// Lekcje projektów (A0.6 przez A0.5 §3): 6 nowych reguł i 3 rozszerzenia istniejących, wspólne dla obu wariantów.
test('nowe reguły rdzenia z lekcji projektów', () => {
  /** @param {string} n */
  const sekcja = (n) => {
    const start = RDZEN.indexOf(`\n## ${n}\n`)
    assert.notEqual(start, -1, `brak sekcji ${n}`)
    const koniec = RDZEN.indexOf('\n## ', start + 1)
    return RDZEN.slice(start, koniec === -1 ? undefined : koniec)
  }
  const oczekiwane = {
    'Async i React': [/Zależności efektu to prymitywy \(`user\?\.id`\)[^.]*TOKEN_REFRESHED/,
      /Hook danych użytkownika przy braku `userId` zwraca stan pusty synchronicznie, już w renderze/,
      /licznik generacji w `useRef`[^.]*przed każdym zapisem w pętli `await`/,
      /Sprzątanie danych użytkownika wisi na wygaśnięciu sesji/],
    'Type safety': [/Kontekst bez sensownej wartości domyślnej tworzysz z `null`/,
      /Awaria odczytu jest osobnym wariantem unii, nie pustym wynikiem/],
    Testowanie: [/Callback `waitFor` kończy każdą ścieżkę asercją albo `throw`/,
      /Wartość oczekiwaną wyprowadzasz niezależnie od implementacji/,
      /Kształt odpowiedzi w atrapie bierzesz z dokumentacji albo serializera SDK/],
    'Organizacja kodu': [/Wartości zależnej od czasu \(`Date\.now\(\)`, bieżący rok\) nie liczysz na poziomie modułu/],
  }
  for (const [nazwa, wzorce] of Object.entries(oczekiwane)) {
    for (const w of wzorce) assert.match(sekcja(nazwa), w)
  }
})
