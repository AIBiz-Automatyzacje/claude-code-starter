// Odczyt plikow zakresami u builderow i fixa (P21 B4, HANDOFF 6a pkt 86 h).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/odczyt-zakresami.test.mjs
//
// DLACZEGO: w etapie 3 vibersi cale pliki czytane przez `cat` (5–9 naraz) byly 35–48% wejscia buildera i 48–72% wejscia fixa,
// a przetrwale wyniki narzedzi > 30k zn (`tool-results/*.txt` po `cat` wielu plikow albo pelnym `git diff`) agenci czytali
// w calosci (8 w etapie 3 wobec 3 w etapie 2). Kazda przeczytana linia jedzie w kontekscie przez wszystkie kolejne tury.
// Polecenie siedzi w pliku roli (warstwa stala) — builderow i klasy naprawiacza (fix, poprawka fixa, naprawy PR).

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, naPodlozonym, tresc } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ROLE_Z_KODEM = ['feature-builder-data', 'feature-builder-ui', 'feature-builder-fullstack', 'feature-builder-ui-figma',
  'feature-builder-fullstack-figma', 'klasa-naprawiacz']
// Elementy polecenia: zakres zamiast calego pliku, jeden plik na komende, przetrwale wyniki zakresami.
// Zdanie otwierajace polecenie („Pliki czytasz zakresami” / „Pliki kodu czytasz zakresami”) — sama fraza „czytasz zakresami” wystepuje
// tez przy wynikach narzedzi, wiec nie wystarcza.
const OTWARCIE = /(?:^|\n)-? ?Pliki (?:kodu )?czytasz zakresami:/
const WYMAGANE = ['krótszy niż 200 linii', 'ten sam fragment czytasz ponownie dopiero po jego zmianie', "`sed -n 'od,dop'`", '`offset` i `limit`', 'bez `cat a b c`', '`tool-results`', '`grep -n`']

/**
 * @param {string} korzen
 * @returns {string[]}  role zmieniajace kod bez polecenia odczytu zakresami
 */
function roleBezZakresow(korzen) {
  return ROLE_Z_KODEM.flatMap((nazwa) => {
    const tekst = tresc(readFileSync(join(korzen, AGENCI, `${nazwa}.md`), 'utf8'))
    const braki = WYMAGANE.filter((w) => !tekst.includes(w)).map((w) => `${nazwa}: brak „${w}”`)
    return OTWARCIE.test(tekst) ? braki : [`${nazwa}: brak polecenia „Pliki czytasz zakresami”`, ...braki]
  })
}

test('podlozona rola z „cat” calych plikow i bez przetrwalych wynikow jest zglaszana', () => {
  const dobry = `- Pliki czytasz zakresami: \`grep -n\`, \`sed -n 'od,dop'\` albo Read z \`offset\` i \`limit\`; w całości plik krótszy niż 200 linii; bez \`cat a b c\`; ten sam fragment czytasz ponownie dopiero po jego zmianie; wynik w \`tool-results\` zakresami.`
  const drzewo = Object.fromEntries(ROLE_Z_KODEM.map((n) => [`${AGENCI}/${n}.md`, `---\nname: ${n}\n---\n${dobry}\n`]))
  drzewo[`${AGENCI}/klasa-naprawiacz.md`] = '---\nname: klasa-naprawiacz\n---\nPrzed naprawa przeczytaj pliki z findingow (`cat`).\n'
  drzewo[`${AGENCI}/feature-builder-ui.md`] = `---\nname: feature-builder-ui\n---\n${dobry.replace('`tool-results`', 'wyniki')}\n`
  const wynik = naPodlozonym(drzewo, roleBezZakresow)
  assert.ok(wynik.includes('feature-builder-ui: brak „`tool-results`”'), wynik.join('\n'))
  assert.equal(wynik.filter((w) => w.startsWith('klasa-naprawiacz:')).length, WYMAGANE.length + 1)
  assert.equal(wynik.length, WYMAGANE.length + 2)
})

test('buildery i klasa naprawiacza czytaja pliki zakresami (tresc pliku roli, warstwa stala)', () => {
  assert.deepEqual(roleBezZakresow(REPO), [])
  // Klasa naprawiacza czyta tez diff fixa i kontroli: per plik, nie calosc (fix:poprawka — pelny diff 51% wejscia).
  assert.match(tresc(readFileSync(join(REPO, AGENCI, 'klasa-naprawiacz.md'), 'utf8')), /diff czytasz per plik \(`git diff <zakres> -- <plik>`/)
})

test('fix czyta z raportu review tylko wpisy swoich findingow, nie caly raport', () => {
  const autopilot = readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8')
  const start = autopilot.indexOf('function fixPrompt(')
  const fix = autopilot.slice(start, autopilot.indexOf('\n}', start))
  assert.match(fix, /review-faza-\$\{numerFazy\}\.md — czytasz tylko wpisy swoich findingow/)
  assert.match(fix, /potem zakres \\`sed -n\\`\), nie caly raport/)
})
