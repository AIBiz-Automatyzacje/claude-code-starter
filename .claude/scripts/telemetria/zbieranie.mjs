// Skan maszyny: runy workflowow i epizody skilli sesji glownych → rekordy telemetrii → jeden plik JSONL (dopisywany).
// Wywolanie: zbierz.mjs (CLI, hook Stop) i raport.mjs (siatka przed raportem). Zero agentow, zero tokenow.

import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

import { rekordyRunu } from './skan.mjs'
import { epizodySesji, rekordSkilla, scalEpizody } from './skill.mjs'
import { analizujTranskrypt } from './transkrypt.mjs'
import { dopisz, doZapisu, odczytajRekordy, zapiszBlad, zZamkiem } from './zapis.mjs'
import { czytajJsonl, katalogProjektu, katalogRepo, znajdzRuny } from './zrodla.mjs'

// Podbijana przy kazdej zmianie logiki wyliczania rekordu — skan dopisze wtedy nowe wersje wszystkich rekordow.
// 2: rola bez sufiksu :retry, /exit i inne komendy sesji nie sa skillami, run.start. 3: run.pr z etapu zbierz dev-pr.
// 4: run.walidacja z obiektu walidacji koncowej (odczyt It. 1). 5: epizod dev-plan konczy sie na Workflow, skill.ctx_start (P20 A8).
// 6: projekt = katalog repo (korzen z .git) zamiast katalogu cwd agenta, pole repo (P22 F1). 7: agent.kontekst.narzedzia_n
// i tools_zn z api-request-shape (E5-18). 8: skill pomocniczy narzedziem konczy sie z tura, /clear zamyka epizod,
// epizod „sesja glowna bez skilla”, skill.po_clear (E5-19). 9: run.pr.head i run.pr.klasy[].ucieczka (E5-20).
export const WERSJA_REKORDU = 9
// Zapas tylu minut przed znacznikiem ostatniego skanu: transkrypt bywa dopisywany chwile po hooku Stop.
const ZAPAS_ZNACZNIKA_MS = 10 * 60 * 1000
const SCRATCHPAD = /\/tmp\/claude-[^/]+\/.*\/scratchpad(?:\/|$)/

/**
 * @typedef {object} OpcjeZbierania
 * @property {string} projekty katalog ~/.claude/projects
 * @property {string} plik plik danych JSONL
 * @property {string} bledy log bledow skanu
 * @property {number} terazMs
 * @property {boolean} szybko tylko pliki zmienione po znaczniku (hook)
 * @property {number} [znacznikMs] czas poprzedniego skanu (tryb szybki)
 * @property {Set<string>} sesjeWToku sesje z dzialajacym workflowem (run bez harnessu = w toku)
 * @property {Set<string>} pominSesje sesje, ktorych epizodow skilli nie zapisujemy (zywa sesja hooka)
 */

/** @param {string} sciezka */
const mtime = (sciezka) => (existsSync(sciezka) ? statSync(sciezka).mtimeMs : 0)

// Poczatek transkryptu sesji, w ktorym szukamy cwd — pierwszy wpis z cwd lezy w kilku pierwszych liniach, a plik ma dziesiatki MB.
const POCZATEK_TRANSKRYPTU_B = 64 * 1024

/**
 * cwd sesji glownej z poczatku jej transkryptu (sesja startuje w katalogu projektu) — zapas, gdy cwd agenta jest poza repo.
 * @param {string} projekty @param {string} slug @param {string} sesja @returns {string | null}
 */
function cwdSesji(projekty, slug, sesja) {
  const plik = join(projekty, slug, `${sesja}.jsonl`)
  if (!existsSync(plik)) return null
  const bufor = Buffer.alloc(POCZATEK_TRANSKRYPTU_B)
  const fd = openSync(plik, 'r')
  const n = readSync(fd, bufor, 0, bufor.length, 0)
  closeSync(fd)
  for (const linia of bufor.subarray(0, n).toString('utf8').split('\n')) {
    const cwd = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(linia)?.[1]
    if (cwd) return JSON.parse(`"${cwd}"`)
  }
  return null
}

/**
 * Projekt rekordu: nazwa katalogu repo, bez repo — katalogu sesji (cwd), a bez cwd — ze sciezki transkryptu (slug).
 * @param {string} slug @param {string | null} katalog @returns {string}
 */
const nazwaProjektu = (slug, katalog) => (katalog ? basename(katalog) : slug.replace(/^-Users-[^-]+-/, ''))

/**
 * @param {import('./zrodla.mjs').Run} run
 * @param {OpcjeZbierania} op
 * @param {Map<string, Record<string, unknown>>} ostatnie
 */
function czyCzytacRun(run, op, ostatnie) {
  if (!op.szybko || op.znacznikMs === undefined) return true
  if (!run.plikHarnessu && !ostatnie.has(`${run.run}|run|${run.run}`)) return true
  const zmiana = Math.max(mtime(join(run.katalogRunu, 'journal.jsonl')), run.plikHarnessu ? mtime(run.plikHarnessu) : 0)
  return zmiana > op.znacznikMs - ZAPAS_ZNACZNIKA_MS
}

/**
 * @param {import('./zrodla.mjs').Run} run
 * @param {OpcjeZbierania} op
 * @returns {Array<Record<string, unknown> & { klucz: string, typ: string }>}
 */
function rekordyZRunu(run, op) {
  const r = rekordyRunu(run, { terazMs: op.terazMs, sesjeWToku: op.sesjeWToku })
  if (!r) return []
  // Kopia projektu w scratchpadzie sesji (pilot, smoke) znika po sesji: hook zaraz po runie widzialby repo kopii, a pozniejszy
  // pelny skan juz nie, wiec agenci zapisani raz rozjechaliby sie z runem — scratchpad liczymy od razu do projektu sesji.
  const cwdAgenta = katalogProjektu(run)
  const wScratchpadzie = typeof cwdAgenta === 'string' && SCRATCHPAD.test(cwdAgenta)
  const repoAgenta = wScratchpadzie ? null : katalogRepo(cwdAgenta)
  const sesji = repoAgenta ? null : cwdSesji(op.projekty, run.projektSlug, run.sesja)
  const repo = repoAgenta ?? katalogRepo(sesji)
  const wspolne = {
    v: WERSJA_REKORDU, ts: new Date(op.terazMs).toISOString(), projekt: nazwaProjektu(run.projektSlug, repo ?? sesji ?? cwdAgenta), repo,
    run: run.run, sesja: run.sesja, zadanie: r.run.zadanie, workflow: r.run.workflow,
  }
  return [
    { ...wspolne, ...r.run, klucz: `${run.run}|run|${run.run}` },
    ...r.fazy.map((f) => ({ ...wspolne, ...f, klucz: `${run.run}|faza|${f.faza}` })),
    ...r.agenci.map((a) => ({ ...wspolne, ...a, klucz: `${run.run}|agent|${a.id}` })),
  ]
}

/** @param {string} projekty @returns {Array<{ slug: string, sesja: string, plik: string }>} */
function sesjeGlowne(projekty) {
  if (!existsSync(projekty)) return []
  return readdirSync(projekty, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
    readdirSync(join(projekty, d.name)).filter((n) => n.endsWith('.jsonl'))
      .map((n) => ({ slug: d.name, sesja: n.slice(0, -'.jsonl'.length), plik: join(projekty, d.name, n) })))
}

/**
 * Koszt subagenta sesji glownej po id wywolania narzedzia Agent (meta.json → toolUseId).
 * @param {string} katalogSesji
 * @returns {Map<string, number>}
 */
function kosztySubagentow(katalogSesji) {
  const katalog = join(katalogSesji, 'subagents')
  /** @type {Map<string, number>} */
  const koszty = new Map()
  if (!existsSync(katalog)) return koszty
  for (const n of readdirSync(katalog).filter((x) => x.endsWith('.meta.json'))) {
    const meta = czytajJsonl(join(katalog, n)).wpisy[0]
    const transkrypt = join(katalog, n.replace(/\.meta\.json$/, '.jsonl'))
    if (typeof meta?.toolUseId === 'string' && existsSync(transkrypt)) {
      koszty.set(meta.toolUseId, analizujTranskrypt(czytajJsonl(transkrypt).wpisy).koszt_jedn)
    }
  }
  return koszty
}

/**
 * @param {OpcjeZbierania} op
 * @returns {{ rekordy: Array<Record<string, unknown> & { klucz: string, typ: string }>, sesji: number }}
 */
function rekordySkilli(op) {
  const sesje = sesjeGlowne(op.projekty).filter((s) => !op.pominSesje.has(s.sesja))
    .filter((s) => !op.szybko || op.znacznikMs === undefined || mtime(s.plik) > op.znacznikMs - ZAPAS_ZNACZNIKA_MS)
  const rekordy = []
  for (const [slug, lista] of Map.groupBy(sesje, (s) => s.slug)) {
    const wpisy = lista.map((s) => ({ s, wpisy: czytajJsonl(s.plik).wpisy }))
    const cwd = wpisy.flatMap((x) => x.wpisy).find((w) => typeof w.cwd === 'string')?.cwd
    const repo = katalogRepo(typeof cwd === 'string' ? cwd : null)
    const epizody = scalEpizody(wpisy.flatMap(({ s, wpisy: w }) => epizodySesji(w, s.sesja)))
    /** @type {Map<string, Map<string, number>>} */
    const kosztyPerSesja = new Map()
    for (const e of epizody) {
      if (!e.odpowiedzi.size) continue
      if (!kosztyPerSesja.has(e.sesja)) kosztyPerSesja.set(e.sesja, kosztySubagentow(join(op.projekty, slug, e.sesja)))
      const koszty = kosztyPerSesja.get(e.sesja) ?? new Map()
      const r = rekordSkilla(e, (id) => koszty.get(id) ?? null)
      rekordy.push({
        v: WERSJA_REKORDU, ts: new Date(op.terazMs).toISOString(), projekt: nazwaProjektu(slug, repo ?? (typeof cwd === 'string' ? cwd : null)), repo,
        run: null, zadanie: null, workflow: null, ...r, otwarty: !e.zamkniety, klucz: `skill|${e.klucz}`,
      })
    }
  }
  return { rekordy, sesji: sesje.length }
}

/**
 * Pelny cykl: odczyt pliku, skan, dopisanie zmian. null = inny skan trzyma zamek.
 * @param {OpcjeZbierania} op
 * @returns {{ runow: number, sesji: number, dopisanych: number, bledow: number } | null}
 */
export function zbierzWszystko(op) {
  return zZamkiem(op.plik, () => {
    const { ostatnie } = odczytajRekordy(op.plik)
    let bledow = 0
    /** @type {Array<Record<string, unknown> & { klucz: string, typ: string }>} */
    const rekordy = []
    const runy = znajdzRuny(op.projekty).filter((r) => czyCzytacRun(r, op, ostatnie))
    for (const run of runy) {
      try {
        rekordy.push(...rekordyZRunu(run, op))
      } catch (e) {
        bledow++
        zapiszBlad(op.bledy, `run ${run.run}`, e)
      }
    }
    let sesji = 0
    try {
      const s = rekordySkilli(op)
      rekordy.push(...s.rekordy)
      sesji = s.sesji
    } catch (e) {
      bledow++
      zapiszBlad(op.bledy, 'epizody skilli', e)
    }
    return { runow: runy.length, sesji, dopisanych: dopisz(op.plik, doZapisu(rekordy, ostatnie)), bledow }
  })
}
