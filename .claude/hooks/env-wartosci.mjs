#!/usr/bin/env node
// Hook PreToolUse (Bash): blokuje komende, ktora wypisalaby wartosci z plikow .env* do transkryptu (P20 A10). Sesje vibersi
// wypisaly tak hasla bazy i konta testowego (etap 2, `grep -n "E2E_" .env.e2e`) i adres konta testowego (etap 3,
// `grep '^E2E_TEST_EMAIL=' .env.e2e | cut -d= -f2`). Wartosc w transkrypcie zostaje w nim na zawsze, a agenci workflowu
// czytaja .env* tymi samymi komendami co sesja.
//
// Dozwolone: nazwy kluczy (`grep -oE '^[A-Z0-9_]+='`, `sed 's/=.*//'`, `cut -d= -f1`), liczniki i obecnosc (`grep -c`,
// `grep -q`, `grep -l`), wynik przepuszczony przez taki filtr w potoku, wartosc wczytana do zmiennej bez wypisania
// (`set -a; . .env.e2e`, `T=$(grep … | cut -d= -f2-)`, `--env-file`), pliki wzorcowe (.env.example, .env.e2e.example).
// Kod wyjscia 2 = blokada z powodem na stderr (Claude Code przekazuje go modelowi); nieczytelne wejscie = przepuszczenie.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const KOD_BLOKADY = 2
// Plik .env* z wartosciami (takze glob `.env*`); wzorce bez wartosci przechodza.
const PLIK_ENV = /(?:^|\/)\.env[\w.*?~-]*$/
const WZORZEC = /\.(?:example|sample|template|dist)$/i
// Komendy, ktore wypisuja tresc czytanego pliku (calosc albo wybrane linie).
const CZYTAJACE = new Set(['cat', 'bat', 'less', 'more', 'head', 'tail', 'tac', 'nl', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'sed',
  'awk', 'gawk', 'cut', 'sort', 'uniq', 'strings', 'xxd', 'od', 'hexdump', 'diff', 'comm', 'paste', 'column', 'jq', 'yq', 'rev',
  'fold', 'base64', 'tr'])
// Komendy, ktorych argumentem bywa `$(…)` z wartoscia wypisywana wprost.
const WYPISUJACE = new Set(['echo', 'printf', 'print', 'cat', 'tee', 'logger'])
const GREP = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag'])
const OPERATORY = new Set(['|', '||', '&&', ';', '&', '\n', '(', ')'])

/** @typedef {{ blokada: false } | { blokada: true, plik: string, komenda: string }} Ocena */
/** @typedef {{ nazwa: string, argumenty: string[], plikiWe: string[], doPliku: boolean, tee: boolean }} Komenda */

// Cel przekierowania, ktory trafia do transkryptu jak stdout (stderr, deskryptory, process substitution).
const TERMINAL = /^(?:\/dev\/(?:stdout|stderr|tty|fd\/\d+)|\/proc\/self\/fd\/\d+|\()$/
// Slowa powloki i opakowania przed wlasciwa komenda; `null` = bez opcji, inaczej opcje z argumentem.
const OPAKOWANIA = new Map([['then', ''], ['do', ''], ['else', ''], ['elif', ''], ['if', ''], ['while', ''], ['until', ''], ['{', ''],
  ['!', ''], ['command', ''], ['nohup', ''], ['time', ''], ['exec', ''], ['nice', 'n'], ['sudo', 'ugCDhprT'], ['env', 'uCS'],
  ['xargs', 'IEdLnPs'], ['timeout', 'sk'], ['stdbuf', '']])
// Opcje z argumentem per komenda (`grep -A 2 KLUCZ .env`, `sed -f skrypt`, `awk -F =`).
const OPCJE_Z_ARGUMENTEM = { grep: 'efmABCdD', egrep: 'efmABCdD', fgrep: 'efmABCdD', rg: 'efmABCtgM', ag: 'fmABCG', sed: 'efl',
  awk: 'Ffv', gawk: 'Ffv', cut: 'dfcb', head: 'nc', tail: 'nc' }

/** @param {string} t @returns {boolean} */
const czyPlikEnv = (t) => PLIK_ENV.test(t) && !WZORZEC.test(t)

/** @param {string} komenda @returns {string} komenda bez tresci heredoc (cialo to dane programu, nie komendy powloki) */
function bezHeredoc(komenda) {
  return komenda.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, (m) => m.slice(0, m.indexOf('\n')))
}

/**
 * Wycina `$(…)` i `…` (poza apostrofami; apostrof w cudzyslowie to zwykly znak) i zamienia je na znacznik `__PODSTAWIENIE_n__`.
 * @param {string} s
 * @returns {{ zewnetrzna: string, podstawienia: string[] }}
 */
function wytnijPodstawienia(s) {
  /** @type {string[]} */
  const podstawienia = []
  let wynik = ''
  let apostrof = false
  let cudzyslow = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && !apostrof) { wynik += c + (s[i + 1] ?? ''); i++; continue }
    if (c === "'" && !cudzyslow) apostrof = !apostrof
    if (c === '"' && !apostrof) cudzyslow = !cudzyslow
    const start = !apostrof && ((c === '$' && s[i + 1] === '(' && s[i + 2] !== '(') || c === '`')
    if (!start) { wynik += c; continue }
    let glebokosc = 1
    let j = c === '`' ? i + 1 : i + 2
    const poczatek = j
    for (; j < s.length && glebokosc; j++) {
      if (c === '`') { if (s[j] === '`') glebokosc = 0 } else if (s[j] === '(') glebokosc++
      else if (s[j] === ')') glebokosc--
    }
    podstawienia.push(s.slice(poczatek, j - 1))
    wynik += ` __PODSTAWIENIE_${podstawienia.length - 1}__ `
    i = j - 1
  }
  return { zewnetrzna: wynik, podstawienia }
}

const OPERATOR = /^(?:\d*>&\d+|\d*>[>|]?|&>>?|<|\|\||&&|[|;&()\n])$/

/**
 * Tokeny powloki: slowa (cudzyslowy zdjete), operatory i przekierowania (`>`, `>>`, `>|`, `<`, `2>`, `2>&1`).
 * @param {string} s
 * @returns {{ tokeny: string[], reszta: string }} reszta = tekst, ktorego tokenizer nie przeczytal (niedomkniety cudzyslow)
 */
function tokeny(s) {
  /** @type {string[]} */
  const wynik = []
  // Odstep bez nowej linii: nowa linia rozdziela komendy jak `;`; `\` + nowa linia to kontynuacja.
  const tekst = s.replace(/\\\r?\n/g, ' ')
  const re = /[ \t\r]*(\d*>&\d+|\d*>[>|]?|&>>?|<|\|\||&&|[|;&()\n]|(?:[^\s|;&()<>'"\\]|\\.|'[^']*'|"(?:[^"\\]|\\.)*")+)/gy
  let m
  let koniec = 0
  while (re.lastIndex < tekst.length && (m = re.exec(tekst))) {
    koniec = re.lastIndex
    const t = m[1] ?? ''
    wynik.push(OPERATOR.test(t) ? t : t.replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"|\\(.)/g, (_, a, b, c) => a ?? (b === undefined ? c : b.replace(/\\([$`"\\])/g, '$1'))))
  }
  return { tokeny: wynik.filter((t) => t !== ''), reszta: tekst.slice(koniec).trim() }
}

/** @param {string[]} t @returns {string[][][]} komendy (lista potokow, potok = lista komend) */
function potoki(t) {
  /** @type {string[][][]} */
  const wynik = [[[]]]
  for (const tok of t) {
    const potok = wynik[wynik.length - 1]
    if (tok === '|') potok.push([])
    else if (OPERATORY.has(tok)) wynik.push([[]])
    else potok[potok.length - 1].push(tok)
  }
  return wynik.map((p) => p.filter((k) => k.length)).filter((p) => p.length)
}

/** @param {string[]} argumenty @returns {string[]} argumenty bez przypisan, slow powloki i opakowan (`sudo -u x`, `env -i`) */
function bezOpakowan(argumenty) {
  const a = [...argumenty]
  for (;;) {
    if (a.length && /^[A-Za-z_]\w*=/.test(a[0])) { a.shift(); continue }
    const zArgumentem = OPAKOWANIA.get(a[0] ?? '')
    if (zArgumentem === undefined) return a
    a.shift()
    while (a.length && /^-/.test(a[0])) {
      const flaga = a.shift() ?? ''
      if (/^-[A-Za-z]$/.test(flaga) && zArgumentem.includes(flaga[1])) a.shift()
    }
  }
}

/** @param {string[]} k @returns {Komenda} */
function rozbierz(k) {
  /** @type {string[]} */
  const argumenty = []
  /** @type {string[]} */
  const plikiWe = []
  let doPliku = false
  for (let i = 0; i < k.length; i++) {
    const t = k[i]
    if (t === '<') { if (k[i + 1]) plikiWe.push(k[++i]); continue }
    if (/^(?:\d*|&)>[>|]?$/.test(t)) {
      const cel = k[++i] ?? ''
      if (!/^\d/.test(t) || t.startsWith('1')) doPliku = doPliku || !TERMINAL.test(cel)
      continue
    }
    if (/^\d*>&\d+$/.test(t)) continue
    argumenty.push(t)
  }
  const wlasciwe = bezOpakowan(argumenty)
  const nazwa = (wlasciwe.shift() ?? '').replace(/^.*\//, '')
  return { nazwa, argumenty: wlasciwe, plikiWe, doPliku, tee: nazwa === 'tee' && wlasciwe.some((a) => TERMINAL.test(a)) }
}

/**
 * @param {string} nazwa komenda (opcje z argumentem z OPCJE_Z_ARGUMENTEM)
 * @param {string[]} a
 * @returns {{ flagi: Map<string, string>, pozycyjne: string[], wzorce: string[] }} wzorce = `-e`; flaga `-f` = skrypt z pliku
 */
function opcje(nazwa, a) {
  const zArgumentem = OPCJE_Z_ARGUMENTEM[/** @type {keyof typeof OPCJE_Z_ARGUMENTEM} */ (nazwa)] ?? ''
  /** @type {Map<string, string>} */
  const flagi = new Map()
  /** @type {string[]} */
  const pozycyjne = []
  /** @type {string[]} */
  const wzorce = []
  for (let i = 0; i < a.length; i++) {
    const t = a[i]
    if (/^--(?:regexp|expression)$/.test(t)) { wzorce.push(a[++i] ?? ''); continue }
    if (/^--(?:regexp|expression)=/.test(t)) { wzorce.push(t.slice(t.indexOf('=') + 1)); continue }
    if (/^--/.test(t)) { flagi.set(t.replace(/=.*$/, ''), t.includes('=') ? t.slice(t.indexOf('=') + 1) : ''); continue }
    if (!/^-[A-Za-z]/.test(t)) { pozycyjne.push(t); continue }
    for (let j = 1; j < t.length; j++) {
      const f = t[j]
      if (!zArgumentem.includes(f)) { flagi.set(`-${f}`, ''); continue }
      const wartosc = t.slice(j + 1) || (a[++i] ?? '')
      if (f === 'e') wzorce.push(wartosc)
      else flagi.set(`-${f}`, wartosc)
      break
    }
  }
  return { flagi, pozycyjne, wzorce }
}

/** @param {string} p @returns {boolean} wzorzec grep -o, ktory nie obejmie wartosci po `=` (najwyzej kilka znakow, np. host) */
function wzorzecBezWartosci(p) {
  const i = p.indexOf('=')
  if (i === -1) return !/(?:^|[^\\])\.|\[\^|\[\[:(?:graph|print|alnum|punct):\]\]|\\[SWw]/.test(p)
  return !/(?:^|[^\\])[*+]|\{\d*,\d*\}|\{\d{2,}\}/.test(p.slice(i + 1))
}

// Podstawienie usuwajace wartosc kazdej linii: lewa strona to `=.*` z prefiksem pustym, `^` albo klasa nazwy klucza, prawa bez `&`.
const PREFIKS_KLUCZA = String.raw`\^?(?:\\?\(?\[[A-Za-z0-9_-]+\][*+]\\?\)?)?`
const PODSTAWIENIE = new RegExp(String.raw`^s(.)(${PREFIKS_KLUCZA})=\.\*\1([^]*?)\1[gp]*$`)

/** @param {string} skrypt @returns {boolean} skrypt sed z podstawieniem usuwajacym wartosci; usuwanie linii (`/^#/d`) tylko obok niego */
function sedBezWartosci(skrypt) {
  const polecenia = skrypt.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
  const podstawienie = (/** @type {string} */ s) => {
    const m = PODSTAWIENIE.exec(s)
    return Boolean(m && !(m[3] ?? '').includes('&') && !(m[3] ?? '').includes(m[1] ?? '/'))
  }
  return polecenia.some(podstawienie) && polecenia.every((s) => podstawienie(s) || /^\/[^/]*\/d$/.test(s) || /^\d+d$/.test(s))
}

/**
 * Komenda z potoku nie wypisuje wartosci: liczy, sprawdza obecnosc, zostawia nazwy kluczy albo ucina wartosc.
 * @param {Komenda} k
 * @param {boolean} zPliku true = komenda sama czyta plik .env (inaczej filtr na wyjsciu poprzedniej komendy)
 * @returns {boolean}
 */
function bezWartosci(k, zPliku) {
  const { flagi, pozycyjne, wzorce } = opcje(k.nazwa, k.argumenty)
  if (GREP.has(k.nazwa)) {
    if (['-c', '-l', '-L', '-q', '--count', '--files-with-matches', '--files-without-match', '--quiet'].some((f) => flagi.has(f))) return true
    if (flagi.has('-f')) return false
    const wzorzec = wzorce[0] ?? pozycyjne[0] ?? ''
    return (flagi.has('-o') || flagi.has('--only-matching')) && wzorzecBezWartosci(wzorzec)
  }
  if (k.nazwa === 'sed') {
    if (flagi.has('-i') && zPliku) return true
    if (flagi.has('-f')) return false
    const skrypty = wzorce.length ? wzorce : pozycyjne.slice(0, 1)
    return skrypty.length > 0 && skrypty.every(sedBezWartosci)
  }
  const separator = flagi.get('-d') ?? flagi.get('-F')
  if (k.nazwa === 'cut') return separator === '=' && flagi.get('-f') === '1'
  if (k.nazwa === 'awk' || k.nazwa === 'gawk') {
    return separator === '=' && !flagi.has('-f') && /^(?:!?\/[^/]*\/)?\s*\{\s*print \$1;?\s*\}$/.test(pozycyjne[0] ?? '')
  }
  return ['wc', 'true', 'test', '['].includes(k.nazwa) && !zPliku
}

/** @param {Komenda} k @returns {string[]} pliki czytane przez komende (argumenty pozycyjne poza wzorcem i skryptem, wejscie `<`) */
function plikiKomendy(k) {
  const { flagi, pozycyjne, wzorce } = opcje(k.nazwa, k.argumenty)
  const pierwszyToWzorzec = (GREP.has(k.nazwa) || ['sed', 'awk', 'gawk', 'jq'].includes(k.nazwa)) && !wzorce.length && !flagi.has('-f')
  return [...(pierwszyToWzorzec ? pozycyjne.slice(1) : pozycyjne), ...k.plikiWe]
}

/**
 * @param {string} komenda tresc wywolania narzedzia Bash
 * @param {boolean} [wypisuje] komenda jest argumentem komendy wypisujacej (`echo $(…)`)
 * @returns {Ocena}
 */
export function ocenKomende(komenda, wypisuje = true) {
  const { zewnetrzna, podstawienia } = wytnijPodstawienia(bezHeredoc(komenda))
  const { tokeny: t, reszta } = tokeny(zewnetrzna)
  // Tekst, ktorego tokenizer nie przeczytal (niedomkniety cudzyslow), z odwolaniem do .env = blokada zamiast cichego konca.
  const nieprzeczytany = /(?:^|[\s/'"])\.env/.exec(reszta)
  if (wypisuje && nieprzeczytany) return { blokada: true, plik: '.env*', komenda: reszta.slice(0, 80) }
  for (const potok of potoki(t)) {
    const komendy = potok.map(rozbierz)
    for (const [i, k] of komendy.entries()) {
      for (const n of k.argumenty.flatMap((a) => [...a.matchAll(/__PODSTAWIENIE_(\d+)__/g)].map((m) => Number(m[1])))) {
        const wnetrze = ocenKomende(podstawienia[n] ?? '', WYPISUJACE.has(k.nazwa))
        if (wnetrze.blokada) return wnetrze
      }
      if (['bash', 'sh', 'zsh', 'eval'].includes(k.nazwa)) {
        const kod = k.nazwa === 'eval' ? k.argumenty.join(' ') : (k.argumenty[k.argumenty.indexOf('-c') + 1] ?? '')
        const wnetrze = k.nazwa === 'eval' || k.argumenty.includes('-c') ? ocenKomende(kod, wypisuje) : null
        if (wnetrze?.blokada) return wnetrze
      }
      if (!wypisuje || !CZYTAJACE.has(k.nazwa)) continue
      const plik = plikiKomendy(k).find(czyPlikEnv)
      if (!plik || bezWartosci(k, true)) continue
      const dalej = komendy.slice(i + 1)
      const maska = dalej.findIndex((d) => bezWartosci(d, false))
      const przedMaska = maska === -1 ? dalej : dalej.slice(0, maska)
      if (przedMaska.some((d) => d.tee)) return { blokada: true, plik, komenda: [k.nazwa, ...k.argumenty].join(' ') }
      if (maska !== -1 || [k, ...dalej].some((d) => d.doPliku)) continue
      return { blokada: true, plik, komenda: [k.nazwa, ...k.argumenty].join(' ') }
    }
  }
  return { blokada: false }
}

/** @param {string} plik @returns {string} */
export function powodBlokady(plik) {
  return `Hook env-wartosci: ta komenda wypisałaby wartości z ${plik} do transkryptu (sekrety zostają w nim na zawsze).\n`
    + `Nazwy kluczy: grep -oE '^[A-Z0-9_]+=' ${plik}. Obecność wartości: grep -c '^KLUCZ=.' ${plik}.\n`
    + `Wartość do komendy bez wypisania: set -a; . ${plik}; set +a — albo T=$(grep '^KLUCZ=' ${plik} | cut -d= -f2-).`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let komenda = ''
  try {
    const wejscie = JSON.parse(readFileSync(0, 'utf8'))
    komenda = typeof wejscie?.tool_input?.command === 'string' ? wejscie.tool_input.command : ''
  } catch {
    process.stderr.write('env-wartosci: nieczytelne wejście hooka — komenda przepuszczona\n')
    process.exit(0)
  }
  const ocena = ocenKomende(komenda)
  if (ocena.blokada) {
    process.stderr.write(`${powodBlokady(ocena.plik)}\n`)
    process.exit(KOD_BLOKADY)
  }
}
