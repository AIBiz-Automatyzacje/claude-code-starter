// Zapis przegladu spojnosci planu (punkt 41, kroki 3 i 5). /dev-plan (krok 6.2b) puszcza agenta `spojnosc-planu` na kazda faze,
// operator rozstrzyga znaleziska, sesja poprawia plan i powtarza przeglad do zera otwartych pozycji, potem zapisuje wynik obok
// planu: `docs/plans/<plan>.spojnosc.json` z odciskiem planu. Bramka gotowosci jest czerwona bez zapisu, przy innym odcisku
// (plan zmieniony po przegladzie), przy otwartych pozycjach albo przy fazie bez przegladu.
//
// Odcisk liczymy bez stanu checkboxow: execute odhacza scenariusze i weryfikacje w planie technicznym po kazdej fazie
// (dev-docs-execute-wf, domkniecie pkt 4), wiec odcisk calego pliku zmienialby sie po fazie 1 i bramka po wznowieniu bylaby
// czerwona na stale. Zmiana tresci planu (Podejscie, Teksty, Granice, nowa pozycja) zmienia odcisk.
//
// Weryfikacja partii 26–45, punkt 53: domkniecie fazy dopisywalo do planu decyzje korygujace i bramka po wznowieniu robila sie
// czerwona bez winy operatora; odcisk zmienialy tez odhaczenia w listach `1.`/`+`/cytacie, spacje koncowe, koncowe `\n` i BOM.
// Decyzje z realizacji ida teraz do osobnej sekcji SEKCJA_REALIZACJI, ktorej odcisk nie liczy (do nastepnego `## ` albo konca
// pliku). Odciski zapisane przed ta zmiana przestaja pasowac; zaden projekt nie mial jeszcze zapisow (punkt 41 nie byl
// synchronizowany), wiec migracji nie ma.
//
// Analiza vibersi audyt-paczki-1-2 (decyzja operatora 2026-11-13): po piatym czytaniu fazy 3 sesja naniosla trzy poprawki
// i zapisala `--otwarte 0` bez ponownego czytania — bramka byla zielona, bo `--otwarte 0` szlo na slowo. Teraz kazde
// uruchomienie recenzenta fazy zapisuje czytanie (`--faza N --czytanie`: odcisk fazy i odciski jej pol), czysty wynik
// recenzenta oznacza je jako czyste (`--faza N --czysta`), a koncowy zapis z `--otwarte 0` porownuje biezacy odcisk kazdej
// fazy z odciskiem jej ostatniego czystego czytania. Faza zmieniona po nim (albo nigdy niezaczytana na czysto) blokuje zapis,
// chyba ze operator zgodzil sie zamknac ja bez czytania (`--bez-czytania N`): wtedy bramka jest zielona „z zastrzezeniem”.
// Odciski pol z dwoch ostatnich czytan daja recenzentowi kolejnej tury liste zmienionych pol (`--faza N --roznica`) zamiast
// calej fazy od zera. Zapisy sprzed tej zmiany (bez `czytania`) bramka czyta jak dawniej.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { pole } from './pola-iu.mjs'
import { NAGLOWEK_FAZY, NAGLOWEK_IU, PLOT } from './plan-techniczny.mjs'

/** Sekcja planu, do ktorej domkniecie fazy pisze decyzje korygujace plan; odcisk jej nie liczy. */
export const SEKCJA_REALIZACJI = '## Decyzje z realizacji'
const NAZWA_SEKCJI_REALIZACJI = /^decyzje z realizacji:?$/i

/**
 * @param {string} tresc
 * @returns {string[]} linie bez BOM i roznic konca linii, bez sekcji realizacji
 */
function linieBezRealizacji(tresc) {
  const linie = tresc.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')
  // Walidacja 51–55, punkt 61: sekcje pisze agent domkniecia, wiec naglowek bywa o poziom nizej (`###`), z dwukropkiem albo
  // inna wielkoscia liter — taka sekcja tez nie wchodzi do odcisku. Konczy ja naglowek tego samego albo wyzszego poziomu.
  let poziomSekcji = 0
  return linie.filter((l) => {
    const naglowek = /^(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(l)
    if (naglowek) {
      const poziom = (naglowek[1] ?? '').length
      if ((poziom === 2 || poziom === 3) && NAZWA_SEKCJI_REALIZACJI.test(naglowek[2] ?? '')) poziomSekcji = poziom
      else if (poziomSekcji && poziom <= poziomSekcji) poziomSekcji = 0
    }
    return !poziomSekcji
  })
}

/** @param {string[]} linie @returns {string} sha256 linii bez stanu checkboxow i bialych znakow na koncach */
function odciskLinii(linie) {
  const znormalizowany = linie.join('\n')
    // Checkbox w komorce tabeli (znalezisko 53 go wymienialo): odhaczenie nie zmienia odcisku, jak w listach.
    .replace(/(\|[ \t]*)\[[xX]\](?=[ \t]*\|)/g, '$1[ ]')
    .replace(/^([ \t]*(?:>[ \t]*)*(?:[-*+]|\d+[.)])[ \t]+)\[[xX]\]/gm, '$1[ ]')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '')
  return createHash('sha256').update(znormalizowany).digest('hex')
}

/**
 * @param {string} tresc plan techniczny
 * @returns {string} sha256 tresci bez sekcji realizacji, stanu checkboxow, BOM, roznic konca linii i bialych znakow na koncach
 */
export function odciskPlanu(tresc) {
  return odciskLinii(linieBezRealizacji(tresc))
}

/**
 * Linie sekcji fazy: od naglowka `### Faza N — …` do naglowka nastepnej fazy albo do naglowka `#`/`##` (konca sekcji
 * Implementation Units); naglowki w blokach kodu sie nie licza.
 * @param {string} tresc plan techniczny
 * @returns {Map<string, string[]>} oznaczenie fazy → jej linie
 */
function linieFaz(tresc) {
  /** @type {Map<string, string[]>} */
  const fazy = new Map()
  /** @type {string[] | null} */
  let biezaca = null
  let kod = false
  for (const l of linieBezRealizacji(tresc)) {
    const plot = PLOT.test(l)
    const f = kod || plot ? null : NAGLOWEK_FAZY.exec(l)
    if (plot) kod = !kod
    if (f) {
      biezaca = []
      fazy.set(f[2] ?? '', biezaca)
    } else if (!kod && !plot && /^#{1,2}\s/.test(l)) biezaca = null
    biezaca?.push(l)
  }
  return fazy
}

/**
 * @param {string} tresc plan techniczny @param {string} faza oznaczenie fazy
 * @returns {string | null} odcisk sekcji fazy liczony jak odcisk planu; null = planu nie ma takiej fazy
 */
export function odciskFazy(tresc, faza) {
  const linie = linieFaz(tresc).get(faza)
  return linie ? odciskLinii(linie) : null
}

/**
 * Odciski pol fazy: `faza/naglowek` (naglowek fazy, „Zależy od:”), `IU-K/naglowek` (linia jednostki i tekst przed pierwszym
 * polem), `IU-K/<pole>` (klucz pola bez ogonkow, jak w parserze). Kazde pogrubione pole konczy poprzednie, takze nieznane.
 * @param {string} tresc @param {string} faza
 * @returns {Record<string, string> | null} klucz → 16 znakow sha256; null = brak fazy
 */
export function polaFazy(tresc, faza) {
  const linie = linieFaz(tresc).get(faza)
  if (!linie) return null
  /** @type {Map<string, string[]>} */
  const pola = new Map([['faza/naglowek', []]])
  let iu = 'faza'
  let klucz = 'faza/naglowek'
  let kod = false
  for (const l of linie) {
    const plot = PLOT.test(l)
    const j = kod || plot ? null : NAGLOWEK_IU.exec(l)
    const p = kod || plot || j ? null : pole(l)
    if (plot) kod = !kod
    if (j) {
      iu = `IU-${j[1] ?? j[3]}`
      klucz = `${iu}/naglowek`
    } else if (p && iu !== 'faza') klucz = `${iu}/${p.klucz}`
    if (!pola.has(klucz)) pola.set(klucz, [])
    pola.get(klucz)?.push(l)
  }
  return Object.fromEntries([...pola].map(([k, v]) => [k, odciskLinii(v).slice(0, 16)]))
}

/** @typedef {{ pole: string, zmiana: 'zmienione' | 'dodane' | 'usunięte' }} ZmianaPola */

/**
 * @param {Record<string, string> | null} przed @param {Record<string, string>} po
 * @returns {ZmianaPola[]} pola fazy zmienione miedzy czytaniami
 */
export function roznicaPol(przed, po) {
  if (!przed) return []
  /** @type {ZmianaPola[]} */
  const zmiany = []
  for (const k of new Set([...Object.keys(przed), ...Object.keys(po)])) {
    if (!(k in przed)) zmiany.push({ pole: k, zmiana: 'dodane' })
    else if (!(k in po)) zmiany.push({ pole: k, zmiana: 'usunięte' })
    else if (przed[k] !== po[k]) zmiany.push({ pole: k, zmiana: 'zmienione' })
  }
  return zmiany
}

/** @param {string} planRel sciezka planu wzgledem projektu @returns {string} sciezka zapisu przegladu obok planu */
export function plikPrzegladu(planRel) {
  return planRel.replace(/\.md$/, '') + '.spojnosc.json'
}

/** Po tylu turach przegladu fazy do operatora wracaja tylko pozycje widoczne dla uzytkownika (dev-plan 6.2b). */
export const LIMIT_TUR = 3

/**
 * @typedef {{ tura: number, data: string, odcisk: string, pola: Record<string, string>, poprzednie: Record<string, string> | null,
 *   czysta: string | null }} Czytanie  ostatnie czytanie fazy przez recenzenta; czysta = odcisk fazy z ostatniego czystego czytania
 * @typedef {{ plan?: string, odcisk?: unknown, data?: string, fazy?: unknown, otwarte?: unknown, bezCzytania?: unknown,
 *   zastrzezenie?: unknown, czytania?: Record<string, Czytanie> }} Zapis
 */

/** @param {string} projekt @param {string} plik @returns {Zapis} zapis przegladu albo pusty obiekt; nie-JSON = wyjatek */
function wczytajZapis(projekt, plik) {
  if (!existsSync(join(projekt, plik))) return {}
  const zapis = JSON.parse(readFileSync(join(projekt, plik), 'utf8'))
  return zapis && typeof zapis === 'object' ? zapis : {}
}

/** @param {string} projekt @param {string} plik @param {Zapis} zapis */
function zapiszPlik(projekt, plik, zapis) {
  writeFileSync(join(projekt, plik), `${JSON.stringify(zapis, null, 2)}\n`)
}

/**
 * Czytanie fazy przez recenzenta (wolane przed uruchomieniem agenta `spojnosc-planu` tej fazy): odcisk fazy i odciski jej pol,
 * poprzednie odciski pol zostaja do roznicy dla recenzenta, tura rosnie o jeden. Czystosc poprzedniego czytania przepada.
 * @param {string} projekt @param {string} planRel @param {string} faza @param {string} data
 * @returns {{ ok: boolean, faza: string, tura: number, poLimicie: boolean, roznica: ZmianaPola[] | null, bledy?: string[] }}
 */
export function zapiszCzytanie(projekt, planRel, faza, data) {
  const tresc = readFileSync(join(projekt, planRel), 'utf8')
  const pola = polaFazy(tresc, faza)
  const odciskF = odciskFazy(tresc, faza)
  if (!pola || !odciskF) return { ok: false, faza, tura: 0, poLimicie: false, roznica: null, bledy: [`plan nie ma fazy ${faza}`] }
  const plik = plikPrzegladu(planRel)
  const zapis = wczytajZapis(projekt, plik)
  const poprzednie = zapis.czytania?.[faza]
  const tura = (poprzednie?.tura ?? 0) + 1
  zapis.czytania = { ...zapis.czytania, [faza]: { tura, data, odcisk: odciskF, pola, poprzednie: poprzednie?.pola ?? null, czysta: null } }
  zapiszPlik(projekt, plik, { plan: planRel, ...zapis })
  return { ok: true, faza, tura, poLimicie: tura > LIMIT_TUR, roznica: poprzednie ? roznicaPol(poprzednie.pola, pola) : null }
}

/**
 * Czysty wynik recenzenta („Faza N: brak otwartych pozycji.”): ostatnie czytanie fazy staje sie czyste. Odcisk bierzemy z chwili
 * czytania, nie z dysku — poprawka naniesiona w trakcie czytania i tak wyjdzie przy koncowym zapisie.
 * @param {string} projekt @param {string} planRel @param {string} faza
 * @returns {{ ok: boolean, faza: string, tura: number, bledy: string[], uwagi: string[] }}
 */
export function oznaczCzysta(projekt, planRel, faza) {
  const plik = plikPrzegladu(planRel)
  const zapis = wczytajZapis(projekt, plik)
  const czytanie = zapis.czytania?.[faza]
  if (!czytanie) {
    return { ok: false, faza, tura: 0, uwagi: [], bledy: [`faza ${faza} bez zapisanego czytania — przed uruchomieniem recenzenta: plan.mjs spojnosc ${planRel} --faza ${faza} --czytanie`] }
  }
  czytanie.czysta = czytanie.odcisk
  zapiszPlik(projekt, plik, zapis)
  const teraz = odciskFazy(readFileSync(join(projekt, planRel), 'utf8'), faza)
  const uwagi = teraz === czytanie.odcisk ? [] : [`faza ${faza} zmieniła się od czytania w turze ${czytanie.tura} — końcowy zapis jej nie przepuści bez kolejnego czytania`]
  return { ok: true, faza, tura: czytanie.tura, bledy: [], uwagi }
}

/**
 * Roznica dla recenzenta tury 2+: pola fazy zmienione miedzy dwoma ostatnimi czytaniami (sesja zapisuje czytanie przed
 * uruchomieniem recenzenta, wiec ostatnie = to, ktore recenzent wlasnie robi).
 * @param {string} projekt @param {string} planRel @param {string} faza
 * @returns {{ ok: boolean, faza: string, tura: number, roznica: ZmianaPola[] | null, uwagi: string[] }}
 *   roznica null = pierwsze czytanie (cala faza)
 */
export function roznicaFazy(projekt, planRel, faza) {
  const czytanie = wczytajZapis(projekt, plikPrzegladu(planRel)).czytania?.[faza]
  if (!czytanie) return { ok: true, faza, tura: 0, roznica: null, uwagi: [`faza ${faza} bez zapisanego czytania — czytasz całą fazę`] }
  const teraz = odciskFazy(readFileSync(join(projekt, planRel), 'utf8'), faza)
  const uwagi = teraz === czytanie.odcisk ? [] : [`faza ${faza} zmieniła się od zapisu czytania w turze ${czytanie.tura} — porównaj też obecną treść pól`]
  return { ok: true, faza, tura: czytanie.tura, roznica: czytanie.poprzednie ? roznicaPol(czytanie.poprzednie, czytanie.pola) : null, uwagi }
}

/**
 * Fazy, ktorych biezacy odcisk rozni sie od ostatniego czystego czytania (albo czystego czytania nie bylo).
 * @param {string} tresc @param {Zapis} zapis @param {string[]} fazy
 * @returns {{ faza: string, powod: string }[]}
 */
function fazyBezCzystegoCzytania(tresc, zapis, fazy) {
  return fazy.flatMap((f) => {
    const czysta = zapis.czytania?.[f]?.czysta ?? null
    if (!czysta) return [{ faza: f, powod: 'bez czystego czytania' }]
    return czysta === odciskFazy(tresc, f) ? [] : [{ faza: f, powod: 'zmieniona po ostatnim czytaniu' }]
  })
}

/**
 * Koncowy zapis przegladu. Przy `otwarte` 0 kazda faza musi miec czyste czytanie zgodne z obecna trescia; wyjatek to fazy
 * z `bezCzytania` (zgoda operatora) — trafiaja do zapisu jako zastrzezenie. Czytania z poprzednich wywolan zostaja w pliku.
 * @param {string} projekt
 * @param {string} planRel
 * @param {{ fazy: string[], otwarte: number, data: string, bezCzytania?: string[] }} o
 * @returns {{ ok: boolean, plik: string, odcisk: string, bledy: string[], zastrzezenie: string }}
 */
export function zapiszPrzeglad(projekt, planRel, { fazy, otwarte, data, bezCzytania = [] }) {
  const tresc = readFileSync(join(projekt, planRel), 'utf8')
  const odcisk = odciskPlanu(tresc)
  const plik = plikPrzegladu(planRel)
  const poprzedni = wczytajZapis(projekt, plik)
  const unikalne = [...new Set(fazy)]
  const nieczytane = otwarte === 0 ? fazyBezCzystegoCzytania(tresc, poprzedni, unikalne) : []
  const zablokowane = nieczytane.filter((n) => !bezCzytania.includes(n.faza))
  if (zablokowane.length) {
    return { ok: false, plik, odcisk, zastrzezenie: '', bledy: [`fazy ${zablokowane.map((n) => `${n.faza} (${n.powod})`).join(', ')}`
      + ` — przed zapisem z --otwarte 0 przeczytaj je recenzentem (plan.mjs spojnosc ${planRel} --faza N --czytanie, po czystym`
      + ' wyniku --faza N --czysta); zamknięcie bez czytania tylko za zgodą operatora: --bez-czytania <numery> (dev-plan 6.2b)'] }
  }
  const zastrzezenie = nieczytane.map((n) => `faza ${n.faza} ${n.powod}`).join(', ')
  const zapis = { plan: planRel, odcisk, data, fazy: unikalne, otwarte,
    ...(nieczytane.length ? { bezCzytania: nieczytane.map((n) => n.faza), zastrzezenie: `${zastrzezenie} (decyzja operatora)` } : {}),
    ...(poprzedni.czytania ? { czytania: poprzedni.czytania } : {}) }
  zapiszPlik(projekt, plik, zapis)
  return { ok: true, plik, odcisk, bledy: [], zastrzezenie: zapis.zastrzezenie ?? '' }
}

/**
 * @typedef {{ ok: boolean, plik: string | null, odcisk: string | null, zapisany: string | null, otwarte: number | null,
 *   fazyBez: string[], zastrzezenie: string, powod: string }} StanPrzegladu  zastrzezenie niepuste = ok z fazami zamknietymi bez
 *   czytania (decyzja operatora); powod mowi wtedy „OK z zastrzezeniem: …”
 */

/**
 * @param {string} projekt
 * @param {string | null} planRel
 * @param {string[]} fazyPlanu oznaczenia faz planu (`1`, `2a`; kazda wymaga przegladu)
 * @returns {StanPrzegladu}
 */
export function stanPrzegladu(projekt, planRel, fazyPlanu) {
  const pusty = { plik: null, odcisk: null, zapisany: null, otwarte: null, fazyBez: [], zastrzezenie: '' }
  if (!planRel || !existsSync(join(projekt, planRel))) return { ok: false, ...pusty, powod: 'brak planu technicznego — przegląd spójności niemożliwy' }
  const plik = plikPrzegladu(planRel)
  const odcisk = odciskPlanu(readFileSync(join(projekt, planRel), 'utf8'))
  const naprawa = `/dev-plan krok 6.2b: przegląd spójności każdej fazy, potem plan.mjs spojnosc ${planRel} --zapisz --fazy <numery> --otwarte 0`
  if (!existsSync(join(projekt, plik))) return { ok: false, ...pusty, plik, odcisk, fazyBez: fazyPlanu, powod: `brak zapisu przeglądu spójności planu → ${naprawa}` }
  /** @type {Zapis} */
  let zapis
  try {
    zapis = wczytajZapis(projekt, plik)
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return { ok: false, ...pusty, plik, odcisk, fazyBez: fazyPlanu, powod: `zapis przeglądu nie jest JSON-em → ${naprawa}` }
  }
  const zapisany = typeof zapis.odcisk === 'string' ? zapis.odcisk : null
  const otwarte = typeof zapis.otwarte === 'number' ? zapis.otwarte : null
  const przejrzane = Array.isArray(zapis.fazy) ? zapis.fazy.map(String) : []
  const fazyBez = fazyPlanu.filter((f) => !przejrzane.includes(f))
  const powod = !zapisany ? `przegląd spójności w toku — brak końcowego zapisu w ${plik} → ${naprawa}`
    : zapisany !== odcisk ? `plan zmieniony po przeglądzie spójności (odcisk inny niż w ${plik}) → ${naprawa}`
      : otwarte !== 0 ? `przegląd spójności ma otwarte pozycje (${otwarte ?? 'brak liczby'}) → rozstrzygnij je z operatorem, popraw plan i powtórz przegląd`
        : fazyBez.length ? `fazy bez przeglądu spójności: ${fazyBez.join(', ')} → ${naprawa}`
          : ''
  // Zapis sprzed odciskow faz nie ma bezCzytania — zielony jak dawniej.
  const bez = Array.isArray(zapis.bezCzytania) ? zapis.bezCzytania.map(String) : []
  const zastrzezenie = powod || !bez.length ? ''
    : typeof zapis.zastrzezenie === 'string' && zapis.zastrzezenie ? zapis.zastrzezenie
      : `faza ${bez.join(', ')} zamknięta bez czytania (decyzja operatora)`
  return { ok: !powod, plik, odcisk, zapisany, otwarte, fazyBez, zastrzezenie, powod: powod || (zastrzezenie ? `OK z zastrzeżeniem: ${zastrzezenie}` : '') }
}
