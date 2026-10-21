// Rejestr stalych planu technicznego (P20 A6): tabela `## Rejestr stałych` i uwaga, gdy stala powstaje w fazie wczesniejszej
// niz wszyscy jej konsumenci. vibersi etap 3: plan dal stale `src/config/konto.ts` do IU-1 (faza 1), konsumenci byli w fazach
// 2–5 — knip w domknieciu fazy 1 zglosil 8 eksportow bez konsumenta, builder je usunal, a IU-3–IU-8 dopisaly je ponownie.
// P22 C1: kolumna IU-zrodlo (`| Stała | Wartość | Plik | IU-źródło | Konsumenci |`). vibersi etap 4: zgadywanie IU-zrodla
// (pierwsza IU z plikiem, ktorej opis wymienia stala) wskazalo IU-2, ktora tworzy plik i zapowiada „… dopisuje IU-5”, a stale
// dopisywaly IU-5 i IU-10 — falszywa uwaga. Plan bez kolumny (sprzed P22) = stara heurystyka.

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {{ stala: string, zrodlo: string, konsumenci: number[], iuZrodlo: number | null, kolumnaIu: boolean, problem: string | null }} StalaRejestru
 *   iuZrodlo null przy kolumnaIu = stala juz jest w repo (w kolumnie „—”), zadna IU jej nie tworzy; problem = komorka
 *   IU-zrodla nieczytelna (pusta, kilka IU) albo wiersz bez naglowka tabeli
 */

const SEKCJA = /^##\s+Rejestr sta[lł]ych\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m

/** @param {string} komorka @returns {string} tresc komorki bez backtickow */
const bezBacktickow = (komorka) => komorka.replace(/`/g, '').trim()

/** @param {string} komorka @returns {string} nazwa kolumny bez diakrytykow, wyroznien i odmian kresek, malymi literami */
const nazwaKolumny = (komorka) => bezBacktickow(komorka).replace(/[*_]/g, '').replace(/[–—]/g, '-').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim()

/** Plan sprzed P22: `| Stała | Wartość | Źródło | Konsumenci |` bez naglowka — pozycje domyslne. */
const KOLUMNY_DOMYSLNE = { plik: 2, iuZrodlo: -1, konsumenci: 3, zNaglowka: false }

/**
 * Kolumny z naglowka tabeli (kolejnosc dowolna; `IU-źródło`, `IU źródło`, `**IU-źródło**`, `Źródło (IU)`).
 * @param {string[]} naglowek @returns {{ plik: number, iuZrodlo: number, konsumenci: number, zNaglowka: boolean }}
 */
function kolumny(naglowek) {
  const nazwy = naglowek.map(nazwaKolumny)
  const iuZrodlo = nazwy.findIndex((n) => /^iu\W*zrodl|^zrodlo\W*\(?iu/.test(n))
  const plik = nazwy.findIndex((n, i) => i !== iuZrodlo && (n === 'plik' || n.startsWith('zrodlo')))
  const konsumenci = nazwy.findIndex((n) => n.startsWith('konsumenci'))
  return { plik: plik === -1 ? KOLUMNY_DOMYSLNE.plik : plik, iuZrodlo, konsumenci: konsumenci === -1 ? KOLUMNY_DOMYSLNE.konsumenci : konsumenci, zNaglowka: true }
}

/** @param {string} komorka @returns {number[]} numery IU spoza nawiasow (dopiski i wpisy spoza planu pomijane) */
const numeryIu = (komorka) => [...komorka.replace(/\([^)]*\)/g, '').matchAll(/\bIU-(\d+)\b/g)].map((m) => Number(m[1]))

/** @param {string} komorka @returns {string} pierwsza sciezka w backtickach, bez backtickow — pierwsze slowo komorki; bez `./` */
const sciezkaPliku = (komorka) => (/`([^`]+)`/.exec(komorka)?.[1] ?? bezBacktickow(komorka).split(/\s+/)[0] ?? '').trim().replace(/^\.\//, '')

/**
 * IU-zrodlo z komorki: jedna IU, „—” (stala juz w repo) albo problem do uwagi planu.
 * @param {string} komorka @returns {{ iu: number | null, problem: string | null }}
 */
function komorkaIu(komorka) {
  const numery = numeryIu(komorka)
  if (numery.length > 1) return { iu: numery[0] ?? null, problem: `kilka IU w kolumnie IU-źródło (${numery.map((n) => `IU-${n}`).join(', ')}) — jedna IU-źródło na wiersz, rozbij wiersz` }
  if (numery.length === 1) return { iu: numery[0] ?? null, problem: null }
  if (/^[—–-]$/.test(bezBacktickow(komorka))) return { iu: null, problem: null }
  return { iu: null, problem: `kolumna IU-źródło pusta albo nieczytelna („${bezBacktickow(komorka)}”) — wpisz IU-N albo „—” (stała już w repo)` }
}

/**
 * Wiersze tabeli `| Stała | Wartość | Plik | IU-źródło | Konsumenci |` (kolumny po naglowku; plan sprzed P22 — `| Stała |
 * Wartość | Źródło | Konsumenci |`, iuZrodlo null). Konsumenci = numery IU z kolumny (dopiski w nawiasach i wpisy spoza planu,
 * np. „szablony maili”, pomijane).
 * @param {string} md tresc planu
 * @returns {StalaRejestru[]}
 */
export function rejestrStalych(md) {
  const sekcja = SEKCJA.exec(md)?.[1] ?? ''
  /** @type {StalaRejestru[]} */
  const wiersze = []
  let k = KOLUMNY_DOMYSLNE
  for (const linia of sekcja.split('\n')) {
    if (!/^\s*\|/.test(linia) || /^\s*\|\s*:?-{3,}/.test(linia)) continue
    const komorki = linia.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/)
    if (nazwaKolumny(komorki[0] ?? '').startsWith('stala')) {
      k = kolumny(komorki)
      continue
    }
    if (komorki.length < 4) continue
    const iu = k.iuZrodlo === -1 ? { iu: null, problem: null } : komorkaIu(komorki[k.iuZrodlo] ?? '')
    const bezNaglowka = !k.zNaglowka && komorki.length > 4 ? 'tabela rejestru bez wiersza nagłówka — kolumny nieznane, dodaj nagłówek `| Stała | Wartość | Plik | IU-źródło | Konsumenci |`' : null
    wiersze.push({
      stala: bezBacktickow(komorki[0] ?? ''), zrodlo: sciezkaPliku(komorki[k.plik] ?? ''), konsumenci: numeryIu(komorki[k.konsumenci] ?? ''),
      iuZrodlo: iu.iu, kolumnaIu: k.iuZrodlo !== -1, problem: bezNaglowka ?? iu.problem,
    })
  }
  return wiersze
}

/**
 * IU-zrodlo stalej: jawna z kolumny IU-źródło; plan bez kolumny — pierwsza IU z plikiem zrodla w tabeli plikow, ktorej opis
 * (Cel, Podejscie) wymienia stala, a bez takiej pierwsza IU z tym plikiem. Kolumna z „—” = stala juz w repo, bez IU-zrodla.
 * @param {StalaRejestru} stala @param {Jednostka[]} jednostki @returns {Jednostka | undefined}
 */
function iuZrodla({ stala, zrodlo, iuZrodlo, kolumnaIu }, jednostki) {
  if (kolumnaIu) return iuZrodlo === null ? undefined : jednostki.find((iu) => iu.numer === iuZrodlo)
  const zPlikiem = jednostki.filter((iu) => iu.pliki.some((p) => p.sciezka === zrodlo))
  return zPlikiem.find((iu) => iu.opis.includes(stala)) ?? zPlikiem[0]
}

// P25 C1 (vibersi etap 5): etykiety powodow zgloszen w pliku komponentow, a szablony maili serwera mialy je stamtad brac.
const WARSTWA_UI = /^src\/(?:components|pages|hooks)\/|^src\/features\/[^/]+\/(?:components|pages|hooks)\//
const PLIK_SERWERA = /^server\/|^supabase\/functions\//

/**
 * Stala z plikiem w warstwie UI, a konsument z plikami serwera — serwer nie importuje komponentow, stron ani hookow.
 * @param {StalaRejestru} wiersz @param {Jednostka[]} jednostki @returns {string[]}
 */
function uwagiWarstwy({ stala, zrodlo, konsumenci }, jednostki) {
  if (!WARSTWA_UI.test(zrodlo)) return []
  return jednostki.filter((iu) => konsumenci.includes(iu.numer)).flatMap((iu) => {
    const serwer = iu.pliki.map((p) => p.sciezka).filter((s) => PLIK_SERWERA.test(s))
    return serwer.length ? [`rejestr stałych: ${stala} — plik ${zrodlo} jest w warstwie UI, a ${iu.id} ma pliki serwera (${serwer.join(', ')});`
      + ' wartość czytaną przez serwer i klienta trzymaj w module bez Reacta (src/config/…, src/lib/…)'] : []
  })
}

/**
 * Uwagi rejestru: stala, ktorej IU-zrodlo jest w fazie wczesniejszej niz wszyscy konsumenci (IU-zrodlo na liscie konsumentow =
 * konsument w jej fazie, wiec bez uwagi) — jedna uwaga na IU-zrodlo, z lista stalych i najwczesniejszym konsumentem; jawna
 * IU-zrodlo spoza planu albo bez pliku stalej w tabeli plikow.
 * @param {Plan} plan
 * @param {Jednostka[]} jednostki IU planu w kolejnosci pliku
 * @returns {string[]}
 */
export function uwagiRejestru(plan, jednostki) {
  const faza = new Map(jednostki.map((iu) => [iu.numer, iu.faza]))
  /** @type {string[]} */
  const jawne = []
  /** @type {Map<Jednostka, { stale: string[], pierwszy: number, kolumna: boolean }>} */
  const zaWczesnie = new Map()
  for (const wiersz of plan.rejestr) {
    const { stala, zrodlo, konsumenci, iuZrodlo, kolumnaIu, problem } = wiersz
    if (problem) jawne.push(`rejestr stałych: ${stala} — ${problem}`)
    jawne.push(...uwagiWarstwy(wiersz, jednostki))
    const iu = iuZrodla(wiersz, jednostki)
    const fazyKonsumentow = konsumenci.map((n) => faza.get(n)).filter((f) => typeof f === 'number')
    if (kolumnaIu && iuZrodlo !== null && !iu) jawne.push(`rejestr stałych: ${stala} — IU-źródło IU-${iuZrodlo} nie ma w planie`)
    if (kolumnaIu && iu && !iu.pliki.some((p) => p.sciezka === zrodlo)) {
      jawne.push(`rejestr stałych: ${stala} — ${iu.id} (IU-źródło) nie ma ${zrodlo} w tabeli plików`)
    }
    // Jawna IU-zrodlo po pierwszym konsumencie: konsument importuje stala, ktorej jeszcze nie ma (takze pole obiektu).
    if (kolumnaIu && iu && iu.faza !== null && fazyKonsumentow.length && Math.min(...fazyKonsumentow) < iu.faza) {
      jawne.push(`rejestr stałych: ${stala} — ${iu.id} (IU-źródło, faza ${iu.faza}) jest po pierwszym konsumencie (faza ${Math.min(...fazyKonsumentow)}) — źródło w IU pierwszego konsumenta`)
    }
    // `TRASY.potwierdz` to pole obiektu, nie eksport — knip nie zglasza nieuzywanych pol, a sam obiekt ma juz konsumentow.
    if (stala.includes('.')) continue
    if (!iu || iu.faza === null || !fazyKonsumentow.length) continue
    const pierwsza = Math.min(...fazyKonsumentow)
    if (pierwsza <= iu.faza) continue
    const wpis = zaWczesnie.get(iu) ?? { stale: [], pierwszy: pierwsza, kolumna: kolumnaIu }
    wpis.stale.push(stala)
    wpis.pierwszy = Math.min(wpis.pierwszy, pierwsza)
    zaWczesnie.set(iu, wpis)
  }
  return [...jawne, ...[...zaWczesnie].map(([iu, { stale, pierwszy, kolumna }]) => `${iu.id} (faza ${iu.faza}) definiuje stałe z rejestru ${stale.join(', ')},`
    + ` a ich konsumenci zaczynają się w fazie ${pierwszy} — knip w domknięciu fazy ${iu.faza} zgłosi eksporty bez konsumenta;`
    + (kolumna ? ' stała powstaje w IU pierwszego konsumenta (kolumna IU-źródło i wiersz pliku w jej tabeli plików)'
      : ' stała powstaje w IU pierwszego konsumenta (wiersz pliku źródła w jej tabeli plików; IU-źródło wskaż kolumną IU-źródło w rejestrze)'))]
}
