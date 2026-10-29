// Czekanie na recenzje bota CodeRabbit (PLAN-POPRAWY P18): stan bota z pola strukturalnego, nie z tekstu komentarza.
// Zrodlo prawdy = status commita `CodeRabbit` na czubku (pending „Review in progress” → success „Review completed”) albo
// check-run `CodeRabbit` — od vibersi PR #14 (2026-10-29) bot raportuje tylko check-run, statusu commita nie ustawia.
// Tekst „Reviewing files that changed…” to staly element informacji o recenzji w podsumowaniu bota — nie znaczy „w toku”.
// Znaczniki komentarzy czytamy tylko przy braku statusu: bot bez recenzji (pauza, pominiecie, awaria) statusu nie ustawia.

export const KONTEKST_STATUSU = 'CodeRabbit'
export const LOGIN_BOTA = /coderabbit/i
export const PROG_BLEDOW_GH = 3
/** Znaczniki czytamy od tego odpytania (4 × 30 s = 2 min po starcie). */
export const KARENCJA_ODPYTAN = 4
/**
 * Po statusie success czekamy na recenzje bota z commit_id = czubek najwyzej tyle od czasu statusu (P19): CodeRabbit ustawia
 * success przed publikacja recenzji (vibersi PR #2: 07:51:39 vs 07:52:21, PR #1: 12:53:33 vs 12:55:02), a `zbierz` zaraz po
 * „gotowa” dawal recenzjaAktualna: false. Bot bez uwag do czubka recenzji nie publikuje — wtedy gotowa z adnotacja.
 */
export const LIMIT_RECENZJI_MS = 2 * 60_000

/** Znacznik w podsumowaniu bota → stan wyniku. */
const ZNACZNIKI = /** @type {const} */ ([
  ['failure', 'blad'],
  ['skip review', 'pominieta'],
  ['review paused', 'pauza'],
])

/**
 * @typedef {{ context: string, state: string, description?: string | null, created_at: string }} Status
 * @typedef {{ name: string, status: string, conclusion: string | null, started_at: string, completed_at: string | null, output?: { title?: string | null } }} Przebieg
 * @typedef {{ login: string, updated_at: string, body: string }} Komentarz
 * @typedef {{ login: string, commit_id: string, submitted_at: string }} Recenzja
 * @typedef {{ number: number, state: string, headRefOid: string }} StanPr
 * @typedef {'gotowa' | 'blad' | 'pauza' | 'pominieta' | 'pr-zamkniety' | 'limit' | 'blad-gh'} StanBota
 * @typedef {{ stan: StanBota, powod: string, recenzja?: 'jest' | 'brak' }} Rozstrzygniecie
 */

/** Wynik zakonczonego check-runu → stan statusu; `skipped` bez statusu (pominiecie rozstrzyga znacznik w komentarzu). */
const STAN_PRZEBIEGU = /** @type {Record<string, string>} */ ({
  success: 'success', neutral: 'success', failure: 'failure', timed_out: 'failure', action_required: 'failure', cancelled: 'error', stale: 'error',
})

/**
 * Check-run bota jako status commita: w toku = pending od startu, zakonczony = stan z `conclusion` od chwili konca.
 * @param {Przebieg} przebieg
 * @returns {Status | null} null dla cudzego check-runu i wyniku bez stanu (skipped)
 */
export function statusZPrzebiegu(przebieg) {
  if (przebieg.name !== KONTEKST_STATUSU) return null
  const opis = przebieg.output?.title ?? null
  if (przebieg.status !== 'completed') return { context: KONTEKST_STATUSU, state: 'pending', description: opis, created_at: przebieg.started_at }
  const stan = STAN_PRZEBIEGU[przebieg.conclusion ?? '']
  return stan ? { context: KONTEKST_STATUSU, state: stan, description: opis, created_at: przebieg.completed_at ?? przebieg.started_at } : null
}

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
 * Recenzja bota opublikowana dla czubka (pole commit_id recenzji PR) albo null.
 * @param {Recenzja[]} recenzje
 * @param {string | null} czubek
 * @returns {Recenzja | null}
 */
export function recenzjaCzubka(recenzje, czubek) {
  return recenzje.find((r) => LOGIN_BOTA.test(r.login) && r.commit_id === czubek) ?? null
}

/**
 * Recenzje PR; blad odczytu = brak recenzji ze sladem na stderr — status success juz rozstrzygnal gotowosc, a 3 bledy /reviews
 * nie moga zamienic jej w blad-gh.
 * @param {{ recenzje: (numer: number) => Promise<Recenzja[]> }} zrodlo
 * @param {number} numer
 * @param {(tresc: string) => void} ostrzez
 * @returns {Promise<Recenzja[]>}
 */
async function recenzjeBezBledu(zrodlo, numer, ostrzez) {
  try {
    return await zrodlo.recenzje(numer)
  } catch (e) {
    ostrzez(`odczyt recenzji PR nieudany (traktuje jak brak recenzji czubka): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`)
    return []
  }
}

/** @param {Rozstrzygniecie} wynik @returns {Rozstrzygniecie} gotowa bez recenzji czubka — adnotacja dla skilla */
const bezRecenzji = (wynik) => ({
  ...wynik, recenzja: 'brak',
  powod: `${wynik.powod}; recenzji bota z commit_id = czubek brak ${LIMIT_RECENZJI_MS / 60_000} min po statusie — bot mogl nie miec uwag do czubka, zbierz moze dac recenzjaAktualna: false`,
})

/**
 * Petla czekania. Zrodlo i zegar wstrzykiwane — test odtwarza nagrane odpowiedzi bez sieci.
 * @param {{
 *   zrodlo: {
 *     pr: () => Promise<StanPr>,
 *     dataCommita: (sha: string) => Promise<string>,
 *     statusy: (sha: string) => Promise<Status[]>,
 *     komentarze: (numer: number) => Promise<Komentarz[]>,
 *     recenzje: (numer: number) => Promise<Recenzja[]>,
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
      const wynik = rozstrzygnij({ pr, statusy, komentarze, dataCommita, czubek })
      // Status success: gotowa dopiero z recenzja czubka albo po LIMIT_RECENZJI_MS od statusu (P19).
      const recenzja = wynik?.stan === 'gotowa' ? recenzjaCzubka(await recenzjeBezBledu(zrodlo, pr.number, ostrzez), czubek) : null
      bledyZRzedu = 0
      if (wynik?.stan === 'gotowa' && !recenzja) {
        if (zegar.teraz() - Date.parse(ostatni?.created_at ?? '') >= LIMIT_RECENZJI_MS) return { ...bezRecenzji(wynik), sha: czubek, minuty: minuty() }
      } else if (wynik) return { ...wynik, ...(recenzja ? { recenzja: 'jest' } : {}), sha: czubek, minuty: minuty() }
    } catch (e) {
      bledyZRzedu += 1
      const tresc = (e instanceof Error ? e.message : String(e)).split('\n')[0]
      ostrzez(`blad gh ${bledyZRzedu}/${PROG_BLEDOW_GH}: ${tresc}`)
      if (bledyZRzedu >= PROG_BLEDOW_GH) {
        return { stan: 'blad-gh', powod: `${PROG_BLEDOW_GH} kolejne bledy gh: ${tresc}`, sha: czubek, minuty: minuty() }
      }
    }
    if (zegar.teraz() - start + coS * 1000 > limitMs) {
      // Limit w trakcie czekania na recenzje po success: status mowi „gotowa”, brakuje tylko recenzji czubka.
      if (ostatni?.state === 'success') {
        return { ...bezRecenzji({ stan: 'gotowa', powod: `status ${KONTEKST_STATUSU} success „${ostatni.description || ''}” (${ostatni.created_at})` }), sha: czubek, minuty: minuty() }
      }
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
