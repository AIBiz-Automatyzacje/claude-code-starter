// Test plikow klas rol i allowlist `tools:` agentow pipeline'u (PLAN-POPRAWY P3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/klasy-rol.test.mjs
//
// DLACZEGO: agent bez `tools:` dziedziczy wszystkie narzedzia sesji razem z MCP — start ~62k tokenow zamiast ~12k
// (POMIARY-ROZSTRZYGNIECIE §1). Allowliste gubi sie po cichu: nowy plik agenta bez `tools:`, MCP dopisane nie temu
// agentowi, mechaniczny bez `omitClaudeMd`. Kazde sprawdzenie ma test na podlozonym zlym pliku w katalogu tymczasowym,
// zeby zielony wynik na repo znaczyl "allowlista jest", a nie "sprawdzenie niczego nie widzi".

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const AGENCI = '.claude/agents'

// Klasy mechaniczne (haiku, bez CLAUDE.md). Wariant `-odczyt` dla rol, ktore tylko czytaja (dedup, inspekcja) — N1:
// haiku wykonuje przekazana wiadomosc operatora, wiec rola bez potrzeby zapisu nie dostaje Bash/Edit/Write.
const KLASY_MECHANICZNE = ['klasa-mechaniczny', 'klasa-mechaniczny-odczyt']

/**
 * Pola frontmattera jako mapa klucz → surowa wartosc (jedna linia).
 * @param {string} tekst
 * @returns {Map<string, string>}
 */
function frontmatter(tekst) {
  const blok = tekst.split(/^---$/m)[1] ?? ''
  return new Map(blok.split('\n')
    .map((linia) => linia.match(/^([\w-]+):\s*(.*)$/))
    .filter((m) => m !== null)
    .map((m) => [m[1] ?? '', (m[2] ?? '').trim()]))
}

/**
 * @param {string} korzen
 * @returns {Map<string, Map<string, string>>}  nazwa agenta → frontmatter
 */
function agenci(korzen) {
  const katalog = join(korzen, AGENCI)
  if (!existsSync(katalog)) return new Map()
  return new Map(readdirSync(katalog)
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p.slice(0, -'.md'.length), frontmatter(readFileSync(join(katalog, p), 'utf8'))]))
}

/**
 * Klasy mechaniczne istnieja, maja `omitClaudeMd: true` i `model: haiku`; nikt poza nimi nie wycina CLAUDE.md.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaMechanicznych(korzen) {
  const wszyscy = agenci(korzen)
  /** @type {string[]} */
  const wyniki = []
  for (const nazwa of KLASY_MECHANICZNE) {
    const fm = wszyscy.get(nazwa)
    if (!fm) {
      wyniki.push(`${nazwa}: brak pliku klasy`)
      continue
    }
    if (fm.get('omitClaudeMd') !== 'true') wyniki.push(`${nazwa}: brak omitClaudeMd: true`)
    if (fm.get('model') !== 'haiku') wyniki.push(`${nazwa}: model inny niz haiku`)
  }
  for (const [nazwa, fm] of wszyscy) {
    if (!KLASY_MECHANICZNE.includes(nazwa) && fm.has('omitClaudeMd')) wyniki.push(`${nazwa}: omitClaudeMd poza klasa mechaniczna`)
  }
  return wyniki
}

/**
 * @param {Record<string, string>} drzewo  sciezka wzgledna → tresc
 * @param {(korzen: string) => string[]} sprawdzenie
 * @returns {string[]}
 */
function naPodlozonym(drzewo, sprawdzenie) {
  const korzen = mkdtempSync(join(tmpdir(), 'klasy-rol-'))
  try {
    for (const [sciezka, tresc] of Object.entries(drzewo)) {
      mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
      writeFileSync(join(korzen, sciezka), tresc)
    }
    return sprawdzenie(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('mechaniczni: podlozony brak omitClaudeMd, model opus i omitClaudeMd u reviewera sa zglaszane', () => {
  const wynik = naPodlozonym({
    [`${AGENCI}/klasa-mechaniczny.md`]: '---\nname: klasa-mechaniczny\nmodel: opus\n---\n',
    [`${AGENCI}/klasa-mechaniczny-odczyt.md`]: '---\nname: klasa-mechaniczny-odczyt\nmodel: haiku\nomitClaudeMd: true\n---\n',
    [`${AGENCI}/reviewer.md`]: '---\nname: reviewer\nomitClaudeMd: true\n---\n',
  }, naruszeniaMechanicznych)
  assert.deepEqual(wynik, [
    'klasa-mechaniczny: brak omitClaudeMd: true',
    'klasa-mechaniczny: model inny niz haiku',
    'reviewer: omitClaudeMd poza klasa mechaniczna',
  ])
})

test('mechaniczni: repo szablonu ma obie klasy mechaniczne na haiku bez CLAUDE.md', () => {
  assert.deepEqual(naruszeniaMechanicznych(REPO), [])
})
