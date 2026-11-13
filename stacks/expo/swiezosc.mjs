// Świeżość źródeł wariantu Expo (plan szablonu mobile z rdzenia, Etap 5). Zestawia to, co szablon przypiął, z bieżącym stanem
// upstreamu: plugin `expo` (marketplace szablonu, `sha` w `.claude-plugin/marketplace.json`), skill Uniwind (`ZRODLO.md`),
// SDK Expo z tabeli wersji w `rn-expo-guidelines` i Maestro (najnowsze wydanie). Skrypt niczego nie zmienia: wynik to lista
// pozycji do przeglądu, a podbicie przypięcia wymaga przeglądu treści (skille trafiają do kontekstu builderów), opis w SWIEZOSC.md.
//
// Uruchomienie (z korzenia repo szablonu, potrzebne `gh` zalogowane i `npm`): node stacks/expo/swiezosc.mjs
// Wynik: JSON w jednej linii { ok, pozycje: [{ zrodlo, przypiete, upstream, aktualne, uwaga }] }; kod 0 zawsze, gdy sprawdzenie
// się wykonało (nieaktualne źródło to wynik, nie awaria), 3 = wyjątek.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** @typedef {{ zrodlo: string, przypiete: string, upstream: string, aktualne: boolean, uwaga: string }} Pozycja */
/** @typedef {{ gh: (sciezka: string) => string, npm: (argumenty: string[]) => string }} Siec */

/** @type {Siec} */
const SIEC = {
  gh: (sciezka) => execFileSync('gh', ['api', sciezka], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  npm: (argumenty) => execFileSync('npm', argumenty, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
}

/**
 * Przypięcia odczytane z plików szablonu.
 * @param {string} korzen @returns {{ expo: { url: string, sciezka: string, sha: string }, uniwind: string, sdk: number }}
 */
export function przypiecia(korzen = KORZEN) {
  const rynek = JSON.parse(readFileSync(join(korzen, '.claude-plugin/marketplace.json'), 'utf8'))
  const expo = rynek.plugins.find((/** @type {{ name: string }} */ p) => p.name === 'expo')?.source
  if (!expo?.sha) throw new Error('brak pluginu expo z sha w .claude-plugin/marketplace.json')
  const zrodlo = readFileSync(join(korzen, 'stacks/expo/nakladka/.claude/skills/uniwind/ZRODLO.md'), 'utf8')
  const uniwind = /\| Commit \| `([0-9a-f]{40})`/.exec(zrodlo)?.[1]
  if (!uniwind) throw new Error('brak commita w skills/uniwind/ZRODLO.md')
  const wytyczne = readFileSync(join(korzen, 'stacks/expo/nakladka/.claude/skills/rn-expo-guidelines/SKILL.md'), 'utf8')
  const sdk = Number(/\| `expo` \/ `react-native` \/ `react` \| (\d+)\./.exec(wytyczne)?.[1])
  if (!sdk) throw new Error('brak wersji expo w tabeli „Wersje stosu” rn-expo-guidelines')
  return { expo: { url: expo.url, sciezka: expo.path, sha: expo.sha }, uniwind, sdk }
}

/** @param {string} url @returns {string} owner/repo z adresu GitHuba */
const repo = (url) => url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')

/**
 * @param {Siec} siec @param {string} korzen @returns {Pozycja[]}
 */
export function sprawdzSwiezosc(siec = SIEC, korzen = KORZEN) {
  const p = przypiecia(korzen)
  /** @type {Pozycja[]} */
  const pozycje = []

  const expoRepo = repo(p.expo.url)
  const ostatniExpo = JSON.parse(siec.gh(`repos/${expoRepo}/commits?path=${p.expo.sciezka}&per_page=1`))[0]?.sha ?? ''
  const porownanie = JSON.parse(siec.gh(`repos/${expoRepo}/compare/${p.expo.sha}...${ostatniExpo}`))
  const zmienione = (porownanie.files ?? []).filter((/** @type {{ filename: string }} */ f) => f.filename.startsWith(`${p.expo.sciezka}/`)).length
  pozycje.push({
    zrodlo: `plugin expo (${expoRepo}/${p.expo.sciezka})`, przypiete: p.expo.sha.slice(0, 7), upstream: ostatniExpo.slice(0, 7),
    aktualne: ostatniExpo === p.expo.sha || zmienione === 0,
    uwaga: zmienione ? `${porownanie.total_commits ?? '?'} commitów, ${zmienione} plików pluginu do przeglądu (SWIEZOSC.md, „Plugin expo”)` : '',
  })

  const ostatniUniwind = JSON.parse(siec.gh('repos/uni-stack/uniwind/commits?path=skills/uniwind&per_page=1'))[0]?.sha ?? ''
  pozycje.push({
    zrodlo: 'skill uniwind (uni-stack/uniwind/skills/uniwind)', przypiete: p.uniwind.slice(0, 7), upstream: ostatniUniwind.slice(0, 7),
    aktualne: ostatniUniwind === p.uniwind, uwaga: ostatniUniwind === p.uniwind ? '' : 'nowszy commit skilla — porównaj katalog i popraw ZRODLO.md',
  })

  const latest = JSON.parse(siec.npm(['view', 'expo', 'dist-tags', '--json'])).latest ?? ''
  const major = Number(String(latest).split('.')[0])
  pozycje.push({
    zrodlo: 'Expo SDK (tabela „Wersje stosu” w rn-expo-guidelines)', przypiete: `SDK ${p.sdk}`, upstream: `SDK ${major} (${latest})`,
    aktualne: major === p.sdk, uwaga: major === p.sdk ? '' : `nowy SDK: przegląd skilli mobile i tabeli wersji (SWIEZOSC.md, „Nowy SDK”)`,
  })

  const maestro = JSON.parse(siec.gh('repos/mobile-dev-inc/maestro/releases/latest')).tag_name ?? ''
  pozycje.push({
    zrodlo: 'Maestro (najnowsze wydanie)', przypiete: '—', upstream: String(maestro).replace(/^cli-/, ''), aktualne: true,
    uwaga: 'szablon nie przypina Maestro: porównaj z `maestro --version` na maszynie operatora i z mobile-e2e-maestro',
  })
  return pozycje
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const pozycje = sprawdzSwiezosc()
    process.stdout.write(`${JSON.stringify({ ok: pozycje.every((p) => p.aktualne), pozycje })}\n`)
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, wyjatek: e instanceof Error ? e.message : String(e) })}\n`)
    process.exitCode = 3
  }
}
