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
const PLIK_ENV = /(?:^|\/)\.env[\w.*?-]*$/
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

/** @param {string} t @returns {boolean} */
const czyPlikEnv = (t) => PLIK_ENV.test(t) && !WZORZEC.test(t)

/** @param {string} komenda @returns {string} komenda bez tresci heredoc (cialo to dane programu, nie komendy powloki) */
function bezHeredoc(komenda) {
  return komenda.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, (m) => m.slice(0, m.indexOf('\n')))
}

/**
 * Wycina `$(…)` i `…` (poza apostrofami) i zamienia je na znacznik `__PODSTAWIENIE_n__`.
 * @param {string} s
 * @returns {{ zewnetrzna: string, podstawienia: string[] }}
 */
function wytnijPodstawienia(s) {
  /** @type {string[]} */
  const podstawienia = []
  let wynik = ''
  let apostrof = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "'" && s[i - 1] !== '\\') apostrof = !apostrof
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

/**
 * Tokeny powloki: slowa (cudzyslowy zdjete), operatory i przekierowania (`>`, `>>`, `<`, `2>`, `2>&1`).
 * @param {string} s
 * @returns {string[]}
 */
function tokeny(s) {
  /** @type {string[]} */
  const wynik = []
  // Odstep bez nowej linii: nowa linia rozdziela komendy jak `;`.
  const re = /[ \t\r]*(\d*>&\d+|\d*>>?|&>>?|<|\|\||&&|[|;&()\n]|(?:[^\s|;&()<>'"\\]|\\.|'[^']*'|"(?:[^"\\]|\\.)*")+)/gy
  let m
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    const t = m[1] ?? ''
    const slowo = !/^(?:\d*>&\d+|\d*>>?|&>>?|<|\|\||&&|[|;&()\n])$/.test(t)
    wynik.push(slowo ? t.replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"|\\(.)/g, (_, a, b, c) => a ?? b ?? c) : t)
  }
  return wynik.filter((t) => t !== '')
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

/** @param {string[]} k @returns {{ nazwa: string, argumenty: string[], plikiWe: string[], doPliku: boolean }} */
function rozbierz(k) {
  /** @type {string[]} */
  const argumenty = []
  /** @type {string[]} */
  const plikiWe = []
  let doPliku = false
  for (let i = 0; i < k.length; i++) {
    const t = k[i]
    if (t === '<') { if (k[i + 1]) plikiWe.push(k[++i]); continue }
    if (/^(?:\d*|&)>>?$/.test(t)) {
      const cel = k[++i] ?? ''
      if (!/^\d/.test(t) || t.startsWith('1')) doPliku = doPliku || !/^\/dev\/(?:stdout|tty)$/.test(cel)
      continue
    }
    if (/^\d*>&\d+$/.test(t)) continue
    argumenty.push(t)
  }
  while (argumenty.length && (/^[A-Za-z_]\w*=/.test(argumenty[0]) || ['sudo', 'command', 'nohup', 'time', 'env'].includes(argumenty[0]))) argumenty.shift()
  const nazwa = (argumenty.shift() ?? '').replace(/^.*\//, '')
  return { nazwa, argumenty, plikiWe, doPliku }
}

/** @param {string[]} a @returns {{ flagi: Set<string>, pozycyjne: string[], wzorce: string[] }} */
function opcje(a) {
  const flagi = new Set()
  /** @type {string[]} */
  const pozycyjne = []
  /** @type {string[]} */
  const wzorce = []
  for (let i = 0; i < a.length; i++) {
    const t = a[i]
    if (t === '-e' || t === '--regexp' || t === '--expression') { wzorce.push(a[++i] ?? ''); continue }
    if (/^--(?:regexp|expression)=/.test(t)) { wzorce.push(t.slice(t.indexOf('=') + 1)); continue }
    if (/^--/.test(t)) { flagi.add(t.replace(/=.*$/, '')); continue }
    if (/^-[A-Za-z]/.test(t)) {
      const m = /^-([A-Za-z]+)(.*)$/.exec(t) ?? []
      for (const f of m[1] ?? '') flagi.add(`-${f}`)
      if (m[2]) flagi.add(`-${(m[1] ?? '').slice(-1)}=${m[2]}`)
      continue
    }
    pozycyjne.push(t)
  }
  return { flagi, pozycyjne, wzorce }
}

/** @param {string} p @returns {boolean} wzorzec grep -o, ktory nie obejmie calej wartosci po `=` */
function wzorzecBezWartosci(p) {
  const i = p.indexOf('=')
  if (i === -1) return !/(?:^|[^\\])\.|\[\^|\\[SW]/.test(p)
  return !/(?:^|[^\\])[*+]|\{\d*,\}/.test(p.slice(i + 1))
}

// Skrypt sed usuwajacy wartosci: podstawienie `=.*` na tekst bez `&` (np. na pusty albo `=<…>`) i usuwanie linii `/^#/d`.
/** @param {string} skrypt @returns {boolean} */
function sedBezWartosci(skrypt) {
  return skrypt.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).every((s) => {
    const m = /^s(.)(.*?)=\.\*\1(.*?)\1g?$/.exec(s)
    return (m && !(m[3] ?? '').includes('&')) || /^\/.*\/d$/.test(s) || /^\d+d$/.test(s)
  })
}

/**
 * Komenda z potoku nie wypisuje wartosci: liczy, sprawdza obecnosc, zostawia nazwy kluczy albo ucina wartosc.
 * @param {{ nazwa: string, argumenty: string[] }} k
 * @param {boolean} zPliku true = komenda sama czyta plik .env (inaczej filtr na wyjsciu poprzedniej komendy)
 * @returns {boolean}
 */
function bezWartosci(k, zPliku) {
  const { flagi, pozycyjne, wzorce } = opcje(k.argumenty)
  if (GREP.has(k.nazwa)) {
    if (['-c', '-l', '-L', '-q', '--count', '--files-with-matches', '--files-without-match', '--quiet'].some((f) => flagi.has(f))) return true
    const wzorzec = wzorce[0] ?? pozycyjne[0] ?? ''
    return (flagi.has('-o') || flagi.has('--only-matching')) && wzorzecBezWartosci(wzorzec)
  }
  if (k.nazwa === 'sed') {
    if (flagi.has('-i') && zPliku) return true
    const skrypty = wzorce.length ? wzorce : pozycyjne.slice(0, 1)
    return skrypty.length > 0 && skrypty.every(sedBezWartosci)
  }
  const separatorRowna = [...flagi].some((f) => /^-[dF]==$/.test(f)) || /(?:^|\s)-[dF]\s*=(?:\s|$)/.test(k.argumenty.join(' '))
    || k.argumenty.some((a, i) => /^-[dF]$/.test(a) && k.argumenty[i + 1] === '=')
  if (k.nazwa === 'cut') return separatorRowna && k.argumenty.some((a, i) => a === '-f1' || (a === '-f' && k.argumenty[i + 1] === '1'))
  if (k.nazwa === 'awk' || k.nazwa === 'gawk') return separatorRowna && k.argumenty.some((a) => /^\{?\s*print \$1;?\s*\}?$/.test(a))
  return ['wc', 'true', 'test', '['].includes(k.nazwa) && !zPliku
}

/**
 * @param {string} komenda tresc wywolania narzedzia Bash
 * @param {boolean} [wypisuje] komenda jest argumentem komendy wypisujacej (`echo $(…)`)
 * @returns {Ocena}
 */
export function ocenKomende(komenda, wypisuje = true) {
  const { zewnetrzna, podstawienia } = wytnijPodstawienia(bezHeredoc(komenda))
  for (const potok of potoki(tokeny(zewnetrzna))) {
    const komendy = potok.map(rozbierz)
    for (const [i, k] of komendy.entries()) {
      for (const n of k.argumenty.flatMap((a) => [...a.matchAll(/__PODSTAWIENIE_(\d+)__/g)].map((m) => Number(m[1])))) {
        const wnetrze = ocenKomende(podstawienia[n] ?? '', WYPISUJACE.has(k.nazwa))
        if (wnetrze.blokada) return wnetrze
      }
      if (!wypisuje || !CZYTAJACE.has(k.nazwa)) continue
      const { pozycyjne } = opcje(k.argumenty)
      const pliki = [...(GREP.has(k.nazwa) || ['sed', 'awk', 'gawk', 'jq'].includes(k.nazwa) ? pozycyjne.slice(1) : pozycyjne), ...k.plikiWe]
      const plik = pliki.find(czyPlikEnv)
      if (!plik || bezWartosci(k, true)) continue
      const dalej = komendy.slice(i + 1)
      if (dalej.some((d) => bezWartosci(d, false)) || [k, ...dalej].some((d) => d.doPliku)) continue
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
