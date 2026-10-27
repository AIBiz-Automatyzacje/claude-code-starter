#!/usr/bin/env node
// Hook PreToolUse (Bash): blokuje komende, ktora wypisalaby wartosci z plikow .env* do transkryptu (P20 A10). Sesje vibersi
// wypisaly tak hasla bazy i konta testowego (etap 2, `grep -n "E2E_" .env.e2e`) i adres konta testowego (etap 3,
// `grep '^E2E_TEST_EMAIL=' .env.e2e | cut -d= -f2`). Wartosc w transkrypcie zostaje w nim na zawsze, a agenci workflowu
// czytaja .env* tymi samymi komendami co sesja.
//
// Dozwolone: nazwy kluczy (`grep -oE '^[A-Z0-9_]+='`, `sed 's/=.*//'`, `cut -d= -f1`), liczniki i obecnosc (`grep -c`,
// `grep -q`, `grep -l`), wynik przepuszczony przez taki filtr w potoku, wartosc wczytana do zmiennej bez wypisania
// (`set -a; . .env.e2e`, `T=$(grep … | cut -d= -f2-)`, `--env-file`), pliki wzorcowe (.env.example, .env.e2e.example).
// P22 E1: te same zasady dla komend, ktore wypisuja sekrety bez pliku .env*: `--show-sensitive` (CLI Coolify — runbook
// live-10-demo kazal `--show-sensitive | grep`, haslo bazy trafilo na stdout agenta), `printenv` i gole `env` (wartosci
// zmiennych srodowiska) oraz xtrace (`set -x`, `bash -x`: powloka wypisuje rozwiniete komendy z wartosciami zmiennych).
// Dozwolone jak przy plikach: wynik do zmiennej (`U=$(coolify … --show-sensitive | jq -r .url)`), filtr bez wartosci
// w potoku (`| jq -r 'keys[]'`, `| cut -d= -f1`), przekierowanie do pliku.
// Kod wyjscia 2 = blokada z powodem na stderr (Claude Code przekazuje go modelowi); nieczytelne wejscie = przepuszczenie.

import { readFileSync, realpathSync } from 'node:fs'
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

/** @typedef {'env-plik' | 'show-sensitive' | 'zmienne' | 'xtrace'} Rodzaj */
/** @typedef {{ blokada: false } | { blokada: true, plik: string, komenda: string, rodzaj: Rodzaj }} Ocena */
/** @typedef {{ nazwa: string, argumenty: string[], surowe: string[], plikiWe: string[], doPliku: boolean, stderrDoPliku: boolean, tee: boolean }} Komenda */

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
    const opakowanie = (a[0] ?? '').replace(/^.*\//, '')
    const zArgumentem = OPAKOWANIA.get(opakowanie)
    if (zArgumentem === undefined) return a
    a.shift()
    while (a.length && /^-/.test(a[0])) {
      const flaga = a.shift() ?? ''
      // `env -S 'node x.mjs'`: argument -S to komenda z argumentami, nie opcja.
      if (opakowanie === 'env' && flaga === '-S') { a.unshift(...(a.shift() ?? '').split(/\s+/).filter(Boolean)); break }
      if (/^-[A-Za-z]$/.test(flaga) && zArgumentem.includes(flaga[1])) a.shift()
    }
    // `timeout 5 cmd`: pierwszy argument pozycyjny to czas.
    if (opakowanie === 'timeout' && /^\d/.test(a[0] ?? '')) a.shift()
  }
}

/** @param {string[]} k @returns {Komenda} */
function rozbierz(k) {
  /** @type {string[]} */
  const argumenty = []
  /** @type {string[]} */
  const plikiWe = []
  let doPliku = false
  let stderrDoPliku = false
  for (let i = 0; i < k.length; i++) {
    const t = k[i]
    if (t === '<') { if (k[i + 1]) plikiWe.push(k[++i]); continue }
    if (/^(?:\d*|&)>[>|]?$/.test(t)) {
      const cel = k[++i] ?? ''
      if (!/^\d/.test(t) || t.startsWith('1')) doPliku = doPliku || !TERMINAL.test(cel)
      if (t.startsWith('2') || t.startsWith('&')) stderrDoPliku = stderrDoPliku || !TERMINAL.test(cel)
      continue
    }
    if (/^\d*>&\d+$/.test(t)) continue
    argumenty.push(t)
  }
  const wlasciwe = bezOpakowan(argumenty)
  // Gole `env` (bez komendy po przypisaniach i opcjach) wypisuje cale srodowisko — to komenda, nie opakowanie.
  const goleEnv = !wlasciwe.length && argumenty.some((a) => a.replace(/^.*\//, '') === 'env')
  const nazwa = goleEnv ? 'env' : (wlasciwe.shift() ?? '').replace(/^.*\//, '')
  return { nazwa, argumenty: wlasciwe, surowe: argumenty, plikiWe, doPliku, stderrDoPliku, tee: nazwa === 'tee' && wlasciwe.some((a) => TERMINAL.test(a)) }
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
  // Bez `=`: tez powtarzana klasa ze znakami adresu z haslem albo base64 (`[a-zA-Z0-9:@_-]*`, `[A-Za-z0-9+/=]+`) obejmuje wartosc;
  // nazwy kluczy (`^[A-Z0-9_]+`) i host (`https://[a-z]*\.supabase\.co`) przechodza.
  if (i === -1) return !/(?:^|[^\\])\.|\[\^|\[\[:(?:graph|print|alnum|punct):\]\]|\\[SWw]|\[[^\]]*[:@/%+=][^\]]*\][*+]/.test(p)
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
  // jq z sama lista kluczy albo licznikiem (wynik `--show-sensitive --format json` bez wartosci): `keys[]`, `.[].key`, `map(.key)`.
  if (k.nazwa === 'jq') return !zPliku && pozycyjne.length === 1 && FILTR_JQ_BEZ_WARTOSCI.test(pozycyjne[0] ?? '')
  // Skrot (shasum, md5) zamiast wartosci — porownanie bez wypisania.
  return ['wc', 'true', 'test', '[', 'shasum', 'sha1sum', 'sha256sum', 'md5', 'md5sum'].includes(k.nazwa) && !zPliku
}

const FILTR_JQ_BEZ_WARTOSCI = /^\s*(?:\.(?:\[\d*\])?\s*\|\s*)?(?:keys(?:_unsorted)?(?:\[\])?|length|type|\.\[\]\.key|map\(\.key\))\s*$/

/**
 * Filtr, ktory nie wypisze wartosci z tabeli albo JSON-a `--show-sensitive`: licznik, obecnosc, klucze jq. Filtry linii
 * KLUCZ=WARTOSC (`cut -d=`, sed z podstawieniem `=` do konca linii, `awk -F=`) przepuszczaja linie tabeli bez `=` w calosci.
 * @param {Komenda} k @returns {boolean}
 */
function maskaTabeli(k) {
  const { flagi } = opcje(k.nazwa, k.argumenty)
  if (GREP.has(k.nazwa)) {
    // grep -o z wzorcem nazwy klucza: zakonczonym `=` (`^[A-Z_]+=`) albo z samych wielkich liter (`\bVITE_[A-Z_]+`).
    const { wzorce, pozycyjne } = opcje(k.nazwa, k.argumenty)
    const wzorzec = wzorce[0] ?? pozycyjne[0] ?? ''
    const nazwa = /=\$?$/.test(wzorzec) || !/a-z|0-9|\\[wdSW]/.test(wzorzec)
    return ['-c', '-l', '-L', '-q', '--count', '--quiet'].some((f) => flagi.has(f)) || (flagi.has('-o') && nazwa && bezWartosci(k, false))
  }
  return k.nazwa === 'wc' || (k.nazwa === 'jq' && bezWartosci(k, false))
}

// Nazwy zmiennych srodowiska bez sekretow (sciezki, jezyk, terminal) — `printenv PATH` przechodzi.
const ZMIENNE_JAWNE = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'PWD', 'OLDPWD', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'HOSTNAME', 'NODE_ENV', 'CLAUDE_PROJECT_DIR', 'CLAUDE_JOB_DIR', 'EDITOR', 'PAGER'])

/** @param {Komenda} k @returns {Rodzaj | null} komenda sama wypisuje sekrety (bez pliku .env*) */
function zrodloSekretow(k) {
  // Flaga CLI (Coolify, krotko `-s`), nie tekst: w wzorcu grep, liscie petli for albo argumencie echo nic nie wypisuje.
  const tekstowe = CZYTAJACE.has(k.nazwa) || WYPISUJACE.has(k.nazwa) || ['for', 'case', 'test', '[', 'git'].includes(k.nazwa)
  const flaga = (/** @type {string} */ a) => a === '--show-sensitive' || a.startsWith('--show-sensitive=') || (k.nazwa === 'coolify' && a === '-s')
  if (!tekstowe && k.argumenty.some(flaga)) return 'show-sensitive'
  if (k.nazwa === 'env') return 'zmienne'
  const nazwy = k.argumenty.filter((a) => !a.startsWith('-'))
  if (k.nazwa === 'printenv') return nazwy.length && nazwy.every((n) => ZMIENNE_JAWNE.has(n)) ? null : 'zmienne'
  // `export`, `export -p`, `declare -x`, `declare -p KLUCZ`, `typeset -x`, gole `set` — wypisuja zmienne z wartosciami.
  if (k.nazwa === 'export') return nazwy.length ? null : 'zmienne'
  if (k.nazwa === 'declare' || k.nazwa === 'typeset') {
    return nazwy.some((n) => n.includes('=')) || k.argumenty.some((a) => /^-[a-z]*f/.test(a)) ? null : 'zmienne'
  }
  if (k.nazwa === 'set') return k.argumenty.length ? null : 'zmienne'
  // `docker inspect … .Config.Env` — zmienne kontenera.
  if (k.nazwa === 'docker' && k.argumenty[0] === 'inspect' && k.argumenty.some((a) => a.includes('.Config.Env'))) return 'zmienne'
  return null
}

/**
 * Komenda uruchamiana gdzie indziej, ktorej wynik wraca na stdout: `ssh host <komenda>`, `docker|podman exec <kontener>
 * <komenda>`, `docker compose exec <usluga> <komenda>`, `kubectl exec … -- <komenda>`.
 * @param {Komenda} k @returns {string | null}
 */
function komendaZdalna(k) {
  const a = k.argumenty
  /** @param {number} od @param {string} zArgumentem @returns {string | null} reszta po pierwszym argumencie pozycyjnym (cel) */
  const poCelu = (od, zArgumentem) => {
    for (let i = od; i < a.length; i++) {
      const t = a[i] ?? ''
      if (['--env', '--user', '--workdir', '--env-file', '--index'].includes(t)) { i++; continue }
      if (t.startsWith('-')) { if (/^-[A-Za-z]$/.test(t) && zArgumentem.includes(t[1] ?? '')) i++; continue }
      return a.slice(i + 1).join(' ') || null
    }
    return null
  }
  if (k.nazwa === 'ssh') return poCelu(0, 'bcDEeFIiJLlmOopQRSWw')
  if ((k.nazwa === 'docker' || k.nazwa === 'podman') && a[0] === 'exec') return poCelu(1, 'euw')
  if (k.nazwa === 'docker' && a[0] === 'compose' && a[1] === 'exec') return poCelu(2, 'euw')
  if (k.nazwa === 'docker-compose' && a[0] === 'exec') return poCelu(1, 'euw')
  if (k.nazwa === 'kubectl' && a[0] === 'exec' && a.includes('--')) return a.slice(a.indexOf('--') + 1).join(' ') || null
  return null
}

/** @param {Komenda} k @returns {boolean} komenda wlacza xtrace (`set -x`, `set -eux`, `set -o xtrace`, `bash -x skrypt`) */
function wlaczaXtrace(k) {
  const krotkie = (/** @type {string} */ a) => /^-[A-Za-z]*x[A-Za-z]*$/.test(a)
  const xtrace = (/** @type {string[]} */ flagi) => flagi.some((a, i) => krotkie(a) || (/^-[A-Za-z]*o$/.test(a) && flagi[i + 1] === 'xtrace'))
  if (k.nazwa === 'set') return xtrace(k.argumenty)
  if (['bash', 'sh', 'zsh', 'dash', 'ksh'].includes(k.nazwa)) {
    // Opcje powloki tylko przed skryptem (`bash skrypt.sh -x` to argument skryptu); xtrace ze stderr w pliku nie trafia do transkryptu.
    const skrypt = k.argumenty.findIndex((a, i) => !a.startsWith('-') && !a.startsWith('+') && !/^-[A-Za-z]*o$/.test(k.argumenty[i - 1] ?? ''))
    return !k.stderrDoPliku && xtrace(skrypt === -1 ? k.argumenty : k.argumenty.slice(0, skrypt))
  }
  return false
}

/**
 * Wynik komendy `i` z potoku trafia do transkryptu: bez filtra bez wartosci dalej w potoku i bez przekierowania do pliku;
 * `tee` na terminal przed filtrem tez wypisuje.
 * @param {Komenda[]} komendy @param {number} i @param {boolean} [tabela] wynik to tabela albo JSON (`--show-sensitive`)
 * @returns {boolean}
 */
function wypiszeWynik(komendy, i, tabela = false) {
  const dalej = komendy.slice(i + 1)
  const maska = dalej.findIndex((d) => (tabela ? maskaTabeli(d) : bezWartosci(d, false)))
  const przedMaska = maska === -1 ? dalej : dalej.slice(0, maska)
  if (przedMaska.some((d) => d.tee)) return true
  return maska === -1 && ![komendy[i], ...dalej].some((d) => d?.doPliku)
}

/** @param {Komenda} k @returns {string[]} pliki czytane przez komende (argumenty pozycyjne poza wzorcem i skryptem, wejscie `<`) */
function plikiKomendy(k) {
  const { flagi, pozycyjne, wzorce } = opcje(k.nazwa, k.argumenty)
  const pierwszyToWzorzec = (GREP.has(k.nazwa) || ['sed', 'awk', 'gawk', 'jq'].includes(k.nazwa)) && !wzorce.length && !flagi.has('-f')
  return [...(pierwszyToWzorzec ? pozycyjne.slice(1) : pozycyjne), ...k.plikiWe]
}

/**
 * Zmienne przypisane z podstawienia, ktore czyta sekret bez pliku (`U=$(… --show-sensitive …)`, `U=$(printenv KLUCZ)`):
 * podstawienie wypisane wprost zostaloby zablokowane.
 * @param {Komenda} k @param {string[]} podstawienia @returns {Array<[string, Ocena & { blokada: true }]>}
 */
function zmienneZSekretem(k, podstawienia) {
  /** @type {Array<[string, Ocena & { blokada: true }]>} */
  const wynik = []
  for (const [i, a] of k.surowe.entries()) {
    const nazwa = /^([A-Za-z_]\w*)=$/.exec(a)?.[1]
    const znacznik = /^__PODSTAWIENIE_(\d+)__$/.exec(k.surowe[i + 1] ?? '')
    if (!nazwa || !znacznik) continue
    const ocena = ocenKomende(podstawienia[Number(znacznik[1])] ?? '', true)
    // Tylko sekrety bez pliku: wartosc z .env* w zmiennej (`T=$(grep … .env | cut -d= -f2-)`) to dozwolony wzorzec od P20.
    if (ocena.blokada && ocena.rodzaj !== 'env-plik') wynik.push([nazwa, ocena])
  }
  return wynik
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
  if (wypisuje && nieprzeczytany) return { blokada: true, plik: '.env*', komenda: reszta.slice(0, 80), rodzaj: 'env-plik' }
  /** @type {Map<string, Ocena & { blokada: true }>} zmienne z sekretem przypisane wczesniej w tej komendzie */
  const skazone = new Map()
  for (const potok of potoki(t)) {
    const komendy = potok.map(rozbierz)
    for (const [i, k] of komendy.entries()) {
      // `U=$(… sekret …); echo "$U"` — wartosc wraca do transkryptu w drugim kroku (pelna wartosc: $U, ${U}; ${#U} to dlugosc).
      const wypisanaZmienna = WYPISUJACE.has(k.nazwa) && [...skazone.keys()].find((n) => k.argumenty.some((a) => new RegExp(`\\$(?:${n}\\b|\\{${n}\\})`).test(a)))
      if (wypisuje && wypisanaZmienna && wypiszeWynik(komendy, i)) return skazone.get(wypisanaZmienna) ?? { blokada: false }
      for (const [nazwa, ocena] of zmienneZSekretem(k, podstawienia)) skazone.set(nazwa, ocena)
      // Podstawienie w przypisaniu (`T=$(…)`) nie wypisuje wyniku, ale jego xtrace idzie na stderr — oceniane bez wypisania.
      for (const a of k.surowe) {
        const wypisujeWynik = wypisuje && WYPISUJACE.has(k.nazwa) && k.argumenty.includes(a)
        for (const m of a.matchAll(/__PODSTAWIENIE_(\d+)__/g)) {
          const wnetrze = ocenKomende(podstawienia[Number(m[1])] ?? '', wypisujeWynik)
          if (wnetrze.blokada) return wnetrze
        }
      }
      // `bash -c`, `bash -lc`, `sh -ec`, `eval`, `ssh host …`, `docker exec …` — kod oceniany jak komenda lokalna.
      const zC = k.argumenty.findIndex((a) => /^-[A-Za-z]*c[A-Za-z]*$/.test(a))
      const kod = k.nazwa === 'eval' ? k.argumenty.join(' ')
        : ['bash', 'sh', 'zsh', 'dash', 'ksh'].includes(k.nazwa) && zC !== -1 ? (k.argumenty[zC + 1] ?? '') : komendaZdalna(k)
      const wnetrze = kod ? ocenKomende(kod, wypisuje) : null
      if (wnetrze?.blokada) return wnetrze
      const tekst = [k.nazwa, ...k.argumenty].join(' ')
      if (wlaczaXtrace(k)) return { blokada: true, plik: k.nazwa, komenda: tekst, rodzaj: 'xtrace' }
      if (!wypisuje) continue
      const zrodlo = zrodloSekretow(k)
      if (zrodlo && wypiszeWynik(komendy, i, zrodlo === 'show-sensitive')) return { blokada: true, plik: zrodlo === 'show-sensitive' ? '--show-sensitive' : k.nazwa, komenda: tekst, rodzaj: zrodlo }
      if (!CZYTAJACE.has(k.nazwa)) continue
      const plik = plikiKomendy(k).find(czyPlikEnv)
      if (!plik || bezWartosci(k, true)) continue
      if (wypiszeWynik(komendy, i)) return { blokada: true, plik, komenda: tekst, rodzaj: 'env-plik' }
    }
  }
  return { blokada: false }
}

/** @param {Ocena & { blokada: true }} ocena @returns {string} powod blokady z bezpieczna alternatywa */
export function powodOceny(ocena) {
  if (ocena.rodzaj === 'show-sensitive') {
    return 'Hook env-wartosci: --show-sensitive wypisałoby sekrety do transkryptu (zostają w nim na zawsze).\n'
      + 'Wartość do komendy bez wypisania: U=$(coolify app env list <uuid> --format json --show-sensitive | jq -r \'.[] | select(.key=="KLUCZ") | .value\'). '
      + "Nazwy: coolify app env list <uuid> --format json | jq -r '.[].key' (bez --show-sensitive CLI maskuje wartości)."
  }
  if (ocena.rodzaj === 'zmienne') {
    return `Hook env-wartosci: ${ocena.plik} wypisałoby wartości zmiennych środowiska (także sekrety) do transkryptu.\n`
      + "Nazwy: env | grep -oE '^[A-Za-z_][A-Za-z0-9_]*='. Obecność: [ -n \"$KLUCZ\" ] && echo ustawiona. Wartość do komendy: używaj \"$KLUCZ\" bez wypisania."
  }
  if (ocena.rodzaj === 'xtrace') {
    return 'Hook env-wartosci: xtrace (set -x, bash -x) wypisuje rozwinięte komendy z wartościami zmiennych, także wczytanych z .env*.\n'
      + 'Diagnostyka bez xtrace: echo z nazwą kroku i kodem wyjścia ($?), wartości zmiennych tylko jako obecność ([ -n "$KLUCZ" ]).'
  }
  return powodBlokady(ocena.plik)
}

/** @param {string} plik @returns {string} */
export function powodBlokady(plik) {
  return `Hook env-wartosci: ta komenda wypisałaby wartości z ${plik} do transkryptu (sekrety zostają w nim na zawsze).\n`
    + `Nazwy kluczy: grep -oE '^[A-Z0-9_]+=' ${plik}. Obecność wartości: grep -c '^KLUCZ=.' ${plik}.\n`
    + `Wartość do komendy bez wypisania: set -a; . ${plik}; set +a — albo T=$(grep '^KLUCZ=' ${plik} | cut -d= -f2-).`
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    process.stderr.write(`${powodOceny(ocena)}\n`)
    process.exit(KOD_BLOKADY)
  }
}
