// Sygnaly diffu fazy do dossier: flagi warstw (schemat KONTEKST w dev-docs-review-wf.js — decyduja, ktorzy reviewerzy
// startuja) i pre-skan dodanych linii. Flagi licza sie ze sciezek i tresci dodanych linii; pomylka w gore (true) kosztuje
// jednego reviewera wiecej, w dol go gubi — wzorce sa szerokie.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const UI_PLIK = /\.(tsx|jsx|vue|svelte|astro|css|scss|sass|less|html?)$/i
const UI_KATALOG = /(^|\/)public\//
const DANE_PLIK = /\.(sql|prisma)$/i
const DANE_KATALOG = /(^|\/)(supabase|migrations?|prisma|seeds?|db|database)\//i
// Dane/IO w tresci: HTTP, klient bazy, SQL, pliki, pamiec przegladarki, cache, warstwa zapytan.
const DANE_TRESC = /\bfetch\(|\baxios\b|\.from\(\s*['"`]|\.rpc\(|supabase|createClient\(|\b(select\b[^;]*\bfrom|insert\s+into|update\s+\w+\s+set|delete\s+from)\b|\b(readFile|writeFile|appendFile|createReadStream|createWriteStream|readdir)\w*\(|localStorage|sessionStorage|indexedDB|\bcache\b|useQuery|useMutation|prisma\.|\bknex\b|\.query\(|XMLHttpRequest|WebSocket/i
const TYPOWANY_PLIK = /\.(ts|tsx|mts|cts)$/i
const KOD_PLIK = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|py|go|rs)$/i
const PLIK_TESTU = /\.(test|spec)\.[^./]+$|(^|\/)(__tests__|tests?)\//
const PUSTY_CATCH = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g

/** @typedef {import('./zmiany.mjs').PlikFazy} PlikFazy */
/** @typedef {Record<string, { nr: number, tekst: string }[]>} DodaneLinie plik -> linie dodane (numer po stronie nowej) */
/** @typedef {{ ui: boolean, dane: boolean, typowanie: boolean, nowyModul: boolean }} Warstwy */
/** @typedef {{ wzorzec: 'pusty-catch' | 'then-bez-catch', plik: string }} TrafieniePreSkanu */

/**
 * Linie dodane z pelnego diffu (z kontekstem). Naglowki `---`/`+++` tylko miedzy `diff --git` a pierwszym `@@`.
 * @param {string} diff
 * @returns {DodaneLinie}
 */
export function dodaneLinie(diff) {
  /** @type {DodaneLinie} */
  const wynik = {}
  /** @type {string | null} */
  let plik = null
  let wNaglowku = false
  let nr = 0
  for (const linia of diff.split('\n')) {
    if (linia.startsWith('diff --git ')) {
      wNaglowku = true
      plik = null
    } else if (wNaglowku && linia.startsWith('+++ ')) {
      plik = linia.startsWith('+++ b/') ? linia.slice(6) : null
    } else if (linia.startsWith('@@')) {
      wNaglowku = false
      nr = Number((/^@@ -\S+ \+(\d+)/.exec(linia) ?? ['', '0'])[1])
    } else if (!wNaglowku && plik) {
      if (linia.startsWith('+')) (wynik[plik] ??= []).push({ nr: nr++, tekst: linia.slice(1) })
      else if (linia.startsWith(' ')) nr++
    }
  }
  return wynik
}

/**
 * @param {string} projekt
 * @param {PlikFazy[]} pliki
 * @param {DodaneLinie} dodane
 * @returns {Warstwy}
 */
export function warstwy(projekt, pliki, dodane) {
  const sciezki = pliki.map((p) => p.plik)
  return {
    ui: sciezki.some((p) => UI_PLIK.test(p) || UI_KATALOG.test(p)),
    dane: sciezki.some((p) => DANE_PLIK.test(p) || DANE_KATALOG.test(p))
      || Object.values(dodane).some((l) => l.some((x) => DANE_TRESC.test(x.tekst))),
    typowanie: sciezki.some((p) => TYPOWANY_PLIK.test(p)) || existsSync(join(projekt, 'tsconfig.json')),
    nowyModul: pliki.some((p) => p.status === 'A' && KOD_PLIK.test(p.plik) && !PLIK_TESTU.test(p.plik)),
  }
}

/**
 * Ciagle bloki dodanych linii (pusty catch bywa rozbity na dwie linie).
 * @param {{ nr: number, tekst: string }[]} linie
 * @returns {{ od: number, tekst: string }[]}
 */
function bloki(linie) {
  /** @type {{ od: number, do: number, tekst: string }[]} */
  const wynik = []
  for (const l of linie) {
    const ostatni = wynik[wynik.length - 1]
    if (ostatni && l.nr === ostatni.do + 1) Object.assign(ostatni, { do: l.nr, tekst: `${ostatni.tekst}\n${l.tekst}` })
    else wynik.push({ od: l.nr, do: l.nr, tekst: l.tekst })
  }
  return wynik
}

/**
 * Miejsca (nie findingi) w dodanych liniach: pusty catch; `.then(` w pliku, ktory nigdzie nie ma `.catch(`.
 * @param {string} projekt
 * @param {DodaneLinie} dodane
 * @returns {TrafieniePreSkanu[]}
 */
export function preSkan(projekt, dodane) {
  /** @type {TrafieniePreSkanu[]} */
  const wynik = []
  for (const plik of Object.keys(dodane).sort()) {
    // Set: dwa puste catch w jednej linii to jedno miejsce do obejrzenia.
    const linieCatch = new Set(bloki(dodane[plik]).flatMap((blok) =>
      [...blok.tekst.matchAll(PUSTY_CATCH)].map((m) => blok.od + blok.tekst.slice(0, m.index).split('\n').length - 1)))
    for (const nr of linieCatch) wynik.push({ wzorzec: 'pusty-catch', plik: `${plik}:${nr}` })
    const then = dodane[plik].find((l) => l.tekst.includes('.then('))
    const sciezka = join(projekt, plik)
    if (then && existsSync(sciezka) && !readFileSync(sciezka, 'utf8').includes('.catch(')) {
      wynik.push({ wzorzec: 'then-bez-catch', plik: `${plik}:${then.nr}` })
    }
  }
  return wynik
}
