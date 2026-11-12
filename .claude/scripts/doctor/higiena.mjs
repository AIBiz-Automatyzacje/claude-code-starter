#!/usr/bin/env node
// Czesc doctor.sh: higiena projektu po wprowadzeniu albo synchronizacji szablonu. Kazda kontrola to przypadek z 02.11, ktory
// przeszedl niezauwazony, bo /sync-template przenosi tylko maszynerie .claude/:
// - stara baza wiedzy .claude/rules/learned-patterns.md bez konwersji (claude-cron 23k zn, dashboard 54k zn) — kazdy agent
//   wczytuje ja cala, a planer nie daje builderowi wycinka regul,
// - kontekst startowy agenta (CLAUDE.md + reguly bez `paths:`) ~110k zn na dashboardzie wobec ~5k na vibersi,
// - pozostalosci starego zestawu w .claude/ (commands/, skill-rules.json, hooki) i hooki w ustawieniach wskazujace usuniete pliki
//   (piszemy_wirale),
// - .claude/.backups/ i CLAUDE.md pluginu claude-mem w podkatalogach poza .gitignore (piszemy_wirale),
// - bajt NUL w wpisie docs/solutions/ — ripgrep pomija plik, agenci go nie znajduja (claude-cron),
// - .coderabbit.yaml bez pliku albo z odwolaniem do starej bazy wiedzy (claude-cron po konwersji).
// Wynik: wiersze TSV (element, stan, szczegol, instalacja) jak zapis-hookow.mjs; problem = UWAGA, nic nie blokuje.
//
// Uzycie: node higiena.mjs <katalog-projektu>

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pozycjaBajtuSterujacego } from '../wiedza/walidacja.mjs'

import { kontraktBota, ostrzezeniaSynca } from '../pr/kontrakt-bota.mjs'
import { PLIK_USTAWIEN, trybRecenzji } from '../pr/tryb-recenzji.mjs'

/** @typedef {{ element: string, stan: 'OK' | 'UWAGA' | 'nie dotyczy', szczegol: string, instalacja: string }} Wiersz */

export const STARA_WIEDZA = '.claude/rules/learned-patterns.md'
export const PROG_KONTEKSTU_ZN = 20_000
export const ELEMENT_WIEDZY = 'wiedza projektu'
export const ELEMENT_KONTEKSTU = 'kontekst startowy agenta'
const KATALOGI_MASZYNERII = ['agents', 'commands', 'hooks', 'rules', 'skills', 'workflows']
// Skille wlasne projektu (np. weryfikacja z /weryfikacja-setup) sa w porzadku; te nazwy to stary zestaw showcase.
const STARE_SKILLE = /^\.claude\/skills\/(skill-rules\.json|skill-developer\/|skill-rules-manager\/)/
const POKAZ_NAJWYZEJ = 6

/** @param {string} projekt @param {string[]} argumenty @returns {string | null} */
function git(projekt, argumenty) {
  try {
    return execFileSync('git', argumenty, { cwd: projekt, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

/** @param {string} katalog @returns {string[]} sciezki plikow wzgledem katalogu */
function plikiRekurencyjnie(katalog) {
  if (!existsSync(katalog)) return []
  return readdirSync(katalog, { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && d.name !== '.DS_Store')
    .map((d) => relative(katalog, join(d.parentPath, d.name)))
}

/** @param {string} tekst @returns {boolean} */
function maPaths(tekst) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(tekst)
  return Boolean(fm && /^paths:/m.test(fm[1] ?? ''))
}

/** @param {string[]} lista @returns {string} */
function skrot(lista) {
  const reszta = lista.length - POKAZ_NAJWYZEJ
  return lista.slice(0, POKAZ_NAJWYZEJ).join(', ') + (reszta > 0 ? ` i ${reszta} innych` : '')
}

/** @param {number} n @returns {string} */
const zn = (n) => n.toLocaleString('pl-PL')

/** @param {string} projekt @returns {Wiersz} */
export function wiedzaProjektu(projekt) {
  const plik = join(projekt, STARA_WIEDZA)
  if (!existsSync(plik)) return { element: ELEMENT_WIEDZY, stan: 'OK', szczegol: 'reguly w polach docs/solutions/ (bez starego pliku)', instalacja: '—' }
  return {
    element: ELEMENT_WIEDZY, stan: 'UWAGA',
    szczegol: `stara baza wiedzy ${STARA_WIEDZA} (${zn(readFileSync(plik, 'utf8').length)} zn) — kazdy agent wczytuje ja cala, planer nie daje builderowi wycinka regul`,
    instalacja: '/dev-compound-refresh --konwersja (przy czystym drzewie)',
  }
}

/** @param {string} projekt @returns {Wiersz} */
export function kontekstStartowy(projekt) {
  /** @type {Array<{ plik: string, zn: number }>} */
  const skladniki = []
  for (const plik of ['CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md']) {
    if (existsSync(join(projekt, plik))) skladniki.push({ plik, zn: readFileSync(join(projekt, plik), 'utf8').length })
  }
  for (const n of plikiRekurencyjnie(join(projekt, '.claude/rules')).filter((x) => x.endsWith('.md'))) {
    const tekst = readFileSync(join(projekt, '.claude/rules', n), 'utf8')
    if (!maPaths(tekst)) skladniki.push({ plik: `.claude/rules/${n}`, zn: tekst.length })
  }
  const suma = skladniki.reduce((s, x) => s + x.zn, 0)
  const opis = skrot(skladniki.sort((a, b) => b.zn - a.zn).map((x) => `${x.plik} ${zn(x.zn)}`))
  if (suma <= PROG_KONTEKSTU_ZN) return { element: ELEMENT_KONTEKSTU, stan: 'OK', szczegol: `${zn(suma)} zn (prog ${zn(PROG_KONTEKSTU_ZN)})${opis ? `: ${opis}` : ''}`, instalacja: '—' }
  return {
    element: ELEMENT_KONTEKSTU, stan: 'UWAGA',
    szczegol: `${zn(suma)} zn na start kazdego agenta (prog ${zn(PROG_KONTEKSTU_ZN)}): ${opis}`,
    instalacja: 'CLAUDE.md: szczegoly obszarow do docs/architektura/; regula bez paths: dostaje paths: albo idzie do docs/',
  }
}

/** @param {string} projekt @returns {Wiersz} */
export function plikiSpozaSzablonu(projekt) {
  const element = 'pliki .claude spoza szablonu'
  const manifest = join(projekt, '.claude/.template-manifest')
  if (!existsSync(manifest)) return { element, stan: 'nie dotyczy', szczegol: 'brak .claude/.template-manifest (projekt bez /sync-template)', instalacja: '—' }
  const zSzablonu = new Set(readFileSync(manifest, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
  const obce = KATALOGI_MASZYNERII.flatMap((k) => plikiRekurencyjnie(join(projekt, '.claude', k)).map((n) => `.claude/${k}/${n}`))
    .filter((p) => !zSzablonu.has(p) && p !== STARA_WIEDZA)
  const podejrzane = obce.filter((p) => !p.startsWith('.claude/skills/') || STARE_SKILLE.test(p))
  if (!podejrzane.length) {
    return { element, stan: 'OK', szczegol: obce.length ? `wlasne skille projektu: ${skrot(obce)}` : 'brak', instalacja: '—' }
  }
  return {
    element, stan: 'UWAGA',
    szczegol: `${podejrzane.length} plikow poza manifestem szablonu: ${skrot(podejrzane)}`,
    instalacja: 'pozostalosc starego zestawu (commands/, skill-rules.json, stare hooki i agenci) — usun; wlasny plik projektu — zostaw',
  }
}

/** @param {string} projekt @returns {Wiersz} */
export function hookiWUstawieniach(projekt) {
  const element = 'hooki w ustawieniach'
  /** @type {string[]} */
  const brakujace = []
  for (const plik of ['.claude/settings.json', '.claude/settings.local.json']) {
    if (!existsSync(join(projekt, plik))) continue
    for (const m of readFileSync(join(projekt, plik), 'utf8').matchAll(/\.claude\/hooks\/[\w./-]+/g)) {
      if (!existsSync(join(projekt, m[0]))) brakujace.push(`${plik}: ${m[0]}`)
    }
  }
  if (!brakujace.length) return { element, stan: 'OK', szczegol: 'kazdy hook wskazuje istniejacy plik', instalacja: '—' }
  return { element, stan: 'UWAGA', szczegol: `hook wskazuje usuniety plik: ${skrot([...new Set(brakujace)])}`, instalacja: 'usun wpis hooka z pliku ustawien' }
}

/** @param {string} projekt @returns {Wiersz} */
export function ignorowanePliki(projekt) {
  const element = 'pliki poza .gitignore'
  if (git(projekt, ['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') return { element, stan: 'nie dotyczy', szczegol: 'katalog poza repo git', instalacja: '—' }
  /** @type {string[]} */
  const problemy = []
  if (existsSync(join(projekt, '.claude/.backups')) && git(projekt, ['check-ignore', '-q', '.claude/.backups/']) === null) {
    problemy.push('.claude/.backups/ (kopie z /sync-template)')
  }
  const zagniezdzone = (git(projekt, ['ls-files', '--others', '--exclude-standard', '--', ':(glob)**/CLAUDE.md']) ?? '')
    .split('\n').filter((l) => l && l !== 'CLAUDE.md')
  if (zagniezdzone.length) problemy.push(`CLAUDE.md w podkatalogach (np. plugin claude-mem): ${skrot(zagniezdzone)}`)
  if (!problemy.length) return { element, stan: 'OK', szczegol: 'brak niesledzonych plikow maszynerii', instalacja: '—' }
  return { element, stan: 'UWAGA', szczegol: problemy.join('; '), instalacja: 'dopisz do .gitignore (`.claude/.backups/`, `**/CLAUDE.md` z wyjatkiem `!/CLAUDE.md`)' }
}

/** @param {string} projekt @returns {Wiersz} */
export function bajtySterujace(projekt) {
  const element = 'bajty sterujace w wiedzy'
  const pliki = ['CLAUDE.md', 'docs/learned-patterns.md', 'docs/CONCEPTS.md']
    .concat(plikiRekurencyjnie(join(projekt, 'docs/solutions')).filter((n) => n.endsWith('.md')).map((n) => `docs/solutions/${n}`))
    .filter((p) => existsSync(join(projekt, p)) && statSync(join(projekt, p)).isFile())
  const zle = pliki.filter((p) => pozycjaBajtuSterujacego(readFileSync(join(projekt, p))) >= 0)
  if (!zle.length) return { element, stan: 'OK', szczegol: `${pliki.length} plikow bez bajtow sterujacych`, instalacja: '—' }
  return {
    element, stan: 'UWAGA',
    szczegol: `${skrot(zle)} — git widzi plik jako binarny, a ripgrep (Grep agentow) go pomija`,
    instalacja: 'zamien bajt na zapis tekstowy (np. NUL w przykladzie regexu → \\x00)',
  }
}

/** @param {string} projekt @returns {Wiersz} */
export function konfiguracjaCodeRabbit(projekt) {
  const element = 'CodeRabbit'
  const plik = join(projekt, '.coderabbit.yaml')
  // Punkt 39: bot recenzji jest opcjonalny, a wybor „bez bota” operator zapisuje w pliku ustawien projektu.
  const tryb = trybRecenzji(projekt)
  if (tryb.blad) return { element, stan: 'UWAGA', szczegol: tryb.blad, instalacja: `popraw ${PLIK_USTAWIEN} (recenzjaPr: "bot" albo "bez-bota")` }
  if (tryb.recenzjaPr === 'bez-bota') {
    return existsSync(plik)
      ? { element, stan: 'UWAGA', szczegol: `${PLIK_USTAWIEN} mowi „bez bota”, a .coderabbit.yaml istnieje — /dev-pr pojdzie bez recenzji bota`, instalacja: 'node .claude/scripts/pr/tryb-recenzji.mjs --ustaw bot albo usun .coderabbit.yaml' }
      : { element, stan: 'nie dotyczy', szczegol: `projekt bez bota recenzji (${PLIK_USTAWIEN})`, instalacja: '—' }
  }
  if (!existsSync(plik)) return { element, stan: 'UWAGA', szczegol: 'brak .coderabbit.yaml — bot recenzji PR jest opcjonalny: z botem /coderabbit-setup, bez bota /dev-pr --bez-bota', instalacja: '/coderabbit-setup' }
  if (readFileSync(plik, 'utf8').includes(STARA_WIEDZA) && !existsSync(join(projekt, STARA_WIEDZA))) {
    return { element, stan: 'UWAGA', szczegol: `.coderabbit.yaml wskazuje usuniety ${STARA_WIEDZA}`, instalacja: 'zamien na docs/learned-patterns.md' }
  }
  const { odstepstwa } = kontraktBota(projekt)
  if (odstepstwa.length) return { element, stan: 'UWAGA', szczegol: `niezgodny z kontraktem /dev-pr: ${odstepstwa.join('; ')}`, instalacja: '/coderabbit-setup (nadpisanie po potwierdzeniu)' }
  // Weryfikacja partii, punkt 55 (28): ostrzezenie synca widzial tylko etap start /dev-pr, przez ktory PR synca nie idzie.
  // Ostrzezenia o bazie PR (inny temat) tu nie przenosimy.
  const synca = ostrzezeniaSynca(readFileSync(plik, 'utf8'))
  if (synca.length) return { element, stan: 'UWAGA', szczegol: synca.join('; '), instalacja: 'dopisz "chore(szablon)" do ignore_title_keywords albo /coderabbit-setup' }
  return { element, stan: 'OK', szczegol: '.coderabbit.yaml zgodny z kontraktem /dev-pr', instalacja: '—' }
}

const LINIA_CLAUDE_MD_ZN = 500

/** Akapit w jednej linii wrzuca do kazdej zmiany cala tresc do recenzji i do konfliktow (dashboard PR #110, CLAUDE.md:91). @param {string} projekt @returns {Wiersz} */
export function dlugieLinieClaudeMd(projekt) {
  const element = 'CLAUDE.md: dlugie linie'
  const plik = join(projekt, 'CLAUDE.md')
  const dlugie = existsSync(plik) ? readFileSync(plik, 'utf8').split('\n').filter((l) => l.length > LINIA_CLAUDE_MD_ZN && !l.trimStart().startsWith('|')).length : 0
  return dlugie
    ? { element, stan: 'UWAGA', szczegol: `${dlugie} linii ponad ${LINIA_CLAUDE_MD_ZN} zn poza tabelami`, instalacja: 'jedna regula na linie' }
    : { element, stan: 'OK', szczegol: 'bez dlugich akapitow', instalacja: '—' }
}

/** Testy komponentow bez biblioteki z reguly stacku: bot zglasza je przy kazdym PR (aa-exam PR #51). @param {string} projekt @returns {Wiersz} */
export function bibliotekaTestowKomponentow(projekt) {
  const element = 'testy komponentow'
  const plik = join(projekt, 'package.json')
  if (!existsSync(plik)) return { element, stan: 'OK', szczegol: 'brak package.json', instalacja: '—' }
  const tresc = readFileSync(plik, 'utf8')
  /** @type {Wiersz} */
  const ok = { element, stan: 'OK', szczegol: 'biblioteka jest albo brak frontendu', instalacja: '—' }
  return /"react(-native)?"\s*:/.test(tresc) && !tresc.includes('@testing-library/')
    ? { element, stan: 'UWAGA', szczegol: 'projekt z React bez @testing-library/*: decyzja operatora, dodac biblioteke albo zapisac wyjatek w .coderabbit.yaml', instalacja: 'decyzja operatora' }
    : ok
}

/** @param {string} projekt @returns {Wiersz[]} */
export function higienaProjektu(projekt) {
  return [wiedzaProjektu, kontekstStartowy, plikiSpozaSzablonu, hookiWUstawieniach, ignorowanePliki, bajtySterujace, konfiguracjaCodeRabbit, dlugieLinieClaudeMd, bibliotekaTestowKomponentow]
    .map((kontrola) => kontrola(projekt))
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projekt = process.argv[2]
  if (!projekt) {
    process.stderr.write('Uzycie: node higiena.mjs <katalog-projektu>\n')
    process.exit(2)
  }
  for (const w of higienaProjektu(projekt)) process.stdout.write(`${[w.element, w.stan, w.szczegol, w.instalacja].join('\t')}\n`)
}
