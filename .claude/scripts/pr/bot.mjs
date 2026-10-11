// Czekanie na recenzje bota CodeRabbit (PLAN-POPRAWY P18): stan bota z pola strukturalnego, nie z tekstu komentarza.
// Zrodlo prawdy = status commita `CodeRabbit` na czubku (pending „Review in progress” → success „Review completed”).
// Tekst „Reviewing files that changed…” to staly element informacji o recenzji w podsumowaniu bota — nie znaczy „w toku”.
// Znaczniki komentarzy czytamy tylko przy braku statusu: bot bez recenzji (pauza, pominiecie, awaria) statusu nie ustawia.

export const KONTEKST_STATUSU = 'CodeRabbit'
export const LOGIN_BOTA = /coderabbit/i
export const PROG_BLEDOW_GH = 3
/** Znaczniki czytamy od tego odpytania (4 × 30 s = 2 min po starcie). */
export const KARENCJA_ODPYTAN = 4

/** Znacznik w podsumowaniu bota → stan wyniku. */
const ZNACZNIKI = /** @type {const} */ ([
  ['failure', 'blad'],
  ['skip review', 'pominieta'],
  ['review paused', 'pauza'],
])

/**
 * @typedef {{ context: string, state: string, description?: string | null, created_at: string }} Status
 * @typedef {{ login: string, updated_at: string, body: string }} Komentarz
 * @typedef {{ number: number, state: string, headRefOid: string }} StanPr
 * @typedef {'gotowa' | 'blad' | 'pauza' | 'pominieta' | 'pr-zamkniety' | 'limit' | 'blad-gh'} StanBota
 * @typedef {{ stan: StanBota, powod: string }} Rozstrzygniecie
 */

/**
 * Najnowszy status kontekstu bota (API zwraca historie: kazda zmiana stanu to nowy wpis).
 * @param {Status[]} statusy
 * @returns {Status | null}
 */
export function najnowszyStatus(statusy) {
  const bota = statusy.filter((s) => s.context === KONTEKST_STATUSU)
  if (bota.length === 0) return null
  return bota.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a))
}

/**
 * Pierwsza niepusta linia tresci bloku znacznika po naglowku `## …` (np. „The pull request is closed.”).
 * @param {string} blok
 */
function opisZnacznika(blok) {
  const linie = blok.split('\n').map((l) => l.replace(/^>\s?/, '').trim())
  const naglowek = linie.findIndex((l) => l.startsWith('## '))
  const tytul = naglowek >= 0 ? linie[naglowek].slice(3) : ''
  const tresc = linie.slice(naglowek + 1).find((l) => l && !l.startsWith('<') && !l.startsWith('-')) || ''
  return [tytul, tresc].filter(Boolean).join(': ')
}

/**
 * SHA ostatniej recenzji z informacji bota („between <od> and <do>”) albo null.
 * @param {string} body
 */
function zrecenzowanyCommit(body) {
  const trafienia = [...body.matchAll(/between ([0-9a-f]{40}) and ([0-9a-f]{40})/g)]
  return trafienia.length ? trafienia[trafienia.length - 1][2] : null
}

/**
 * Znacznik stanu specjalnego w komentarzach bota dotyczacych czubka: podsumowanie wskazuje czubek („between … and <czubek>”)
 * albo bylo edytowane po dacie commita czubka. Bot edytuje jedno podsumowanie w miejscu, wiec starszy komentarz nosi stan
 * poprzedniego czubka; SHA chroni przed zegarem commitera, ktory sie spieszy.
 * @param {Komentarz[]} komentarze
 * @param {{ dataCommita: string | null, czubek: string | null }} czubka dataCommita null = bez filtra daty
 * @returns {Rozstrzygniecie | null}
 */
export function znacznikSpecjalny(komentarze, { dataCommita, czubek }) {
  const od = dataCommita ? Date.parse(dataCommita) : -Infinity
  const dotyczaCzubka = komentarze
    .filter((k) => LOGIN_BOTA.test(k.login))
    .filter((k) => Date.parse(k.updated_at) >= od || (czubek !== null && zrecenzowanyCommit(k.body) === czubek))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
  for (const k of dotyczaCzubka) {
    for (const [nazwa, stan] of ZNACZNIKI) {
      const start = `<!-- This is an auto-generated comment: ${nazwa} by coderabbit.ai -->`
      const i = k.body.indexOf(start)
      if (i < 0) continue
      const koniec = k.body.indexOf(`<!-- end of auto-generated comment: ${nazwa} by coderabbit.ai -->`, i)
      const opis = opisZnacznika(k.body.slice(i + start.length, koniec < 0 ? undefined : koniec))
      return { stan, powod: `znacznik „${nazwa}” w komentarzu bota (${k.updated_at})${opis ? ` — ${opis}` : ''}` }
    }
  }
  return null
}

/**
 * Jedno odpytanie → stan koncowy albo null (czekamy dalej). Kolejnosc: PR zamkniety, status commita, znaczniki.
 * @param {{ pr: StanPr, statusy: Status[], komentarze: Komentarz[], dataCommita: string | null, czubek: string | null }} odczyt
 * @returns {Rozstrzygniecie | null}
 */
export function rozstrzygnij({ pr, statusy, komentarze, dataCommita, czubek }) {
  if (pr.state !== 'OPEN') return { stan: 'pr-zamkniety', powod: `PR #${pr.number} ma stan ${pr.state}` }
  const status = najnowszyStatus(statusy)
  if (status) {
    const opis = `status ${KONTEKST_STATUSU} ${status.state} „${status.description || ''}” (${status.created_at})`
    if (status.state === 'success') return { stan: 'gotowa', powod: opis }
    if (status.state === 'failure' || status.state === 'error') return { stan: 'blad', powod: opis }
    return null
  }
  return znacznikSpecjalny(komentarze, { dataCommita, czubek })
}

/**
 * Petla czekania. Zrodlo i zegar wstrzykiwane — test odtwarza nagrane odpowiedzi bez sieci.
 * @param {{
 *   zrodlo: {
 *     pr: () => Promise<StanPr>,
 *     dataCommita: (sha: string) => Promise<string>,
 *     statusy: (sha: string) => Promise<Status[]>,
 *     komentarze: (numer: number) => Promise<Komentarz[]>,
 *   },
 *   zegar: { teraz: () => number, spij: (ms: number) => Promise<void> },
 *   sha?: string | null,
 *   limitMin: number,
 *   coS: number,
 *   ostrzez?: (tresc: string) => void,
 * }} op
 * @returns {Promise<Rozstrzygniecie & { sha: string | null, minuty: number }>}
 */
export async function czekajNaBota({ zrodlo, zegar, sha = null, limitMin, coS, ostrzez = () => {} }) {
  const start = zegar.teraz()
  const limitMs = limitMin * 60_000
  const minuty = () => Math.round((zegar.teraz() - start) / 6000) / 10
  /** @type {string | null} */
  let czubek = sha
  /** @type {string | null} */
  let dataCommita = null
  /** @type {Status | null} */
  let ostatni = null
  /** @type {string | null} */
  let czubekPr = null
  let bledyZRzedu = 0
  for (;;) {
    try {
      const pr = await zrodlo.pr()
      czubek = czubek || pr.headRefOid
      czubekPr = pr.headRefOid
      if (!dataCommita) dataCommita = await zrodlo.dataCommita(czubek)
      const statusy = await zrodlo.statusy(czubek)
      ostatni = najnowszyStatus(statusy) || ostatni
      // Komentarze tylko przy otwartym PR bez statusu bota i po karencji: bot, ktory recenzuje, ustawia pending w sekundy
      // po pushu, a do tego czasu podsumowanie moze jeszcze nosic znacznik poprzedniego czubka.
      const poKarencji = zegar.teraz() - start >= KARENCJA_ODPYTAN * coS * 1000
      const komentarze = pr.state === 'OPEN' && !najnowszyStatus(statusy) && poKarencji ? await zrodlo.komentarze(pr.number) : []
      bledyZRzedu = 0
      const wynik = rozstrzygnij({ pr, statusy, komentarze, dataCommita, czubek })
      if (wynik) return { ...wynik, sha: czubek, minuty: minuty() }
    } catch (e) {
      bledyZRzedu += 1
      const tresc = (e instanceof Error ? e.message : String(e)).split('\n')[0]
      ostrzez(`blad gh ${bledyZRzedu}/${PROG_BLEDOW_GH}: ${tresc}`)
      if (bledyZRzedu >= PROG_BLEDOW_GH) {
        return { stan: 'blad-gh', powod: `${PROG_BLEDOW_GH} kolejne bledy gh: ${tresc}`, sha: czubek, minuty: minuty() }
      }
    }
    if (zegar.teraz() - start + coS * 1000 > limitMs) {
      const powod = ostatni
        ? `po ${limitMin} min status ${KONTEKST_STATUSU} nadal ${ostatni.state} „${ostatni.description || ''}”`
        : `po ${limitMin} min brak statusu ${KONTEKST_STATUSU} na czubku i brak znacznika stanu bota`
      // Czekamy na podany --sha, a PR wskazuje inny commit: niewypchniety commit albo pozniejszy push.
      const rozjazd = czubekPr && czubek && czubekPr !== czubek ? ` (czubek PR to ${czubekPr.slice(0, 8)}, nie ${czubek.slice(0, 8)})` : ''
      return { stan: 'limit', powod: powod + rozjazd, sha: czubek, minuty: minuty() }
    }
    await zegar.spij(coS * 1000)
  }
}
