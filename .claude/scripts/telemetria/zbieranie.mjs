// Skan maszyny: runy workflowow i epizody skilli sesji glownych → rekordy telemetrii → jeden plik JSONL (dopisywany).
// Wywolanie: zbierz.mjs (CLI, hook Stop) i raport.mjs (siatka przed raportem). Zero agentow, zero tokenow.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

import { rekordyRunu } from './skan.mjs'
import { epizodySesji, rekordSkilla, scalEpizody } from './skill.mjs'
import { analizujTranskrypt } from './transkrypt.mjs'
import { dopisz, doZapisu, odczytajRekordy, zapiszBlad, zZamkiem } from './zapis.mjs'
import { czytajJsonl, katalogProjektu, znajdzRuny } from './zrodla.mjs'

// Podbijana przy kazdej zmianie logiki wyliczania rekordu — skan dopisze wtedy nowe wersje wszystkich rekordow.
// 2: rola bez sufiksu :retry, /exit i inne komendy sesji nie sa skillami, run.start. 3: run.pr z etapu zbierz dev-pr.
// 4: run.walidacja z obiektu walidacji koncowej (odczyt It. 1).
export const WERSJA_REKORDU = 4
// Zapas tylu minut przed znacznikiem ostatniego skanu: transkrypt bywa dopisywany chwile po hooku Stop.
const ZAPAS_ZNACZNIKA_MS = 10 * 60 * 1000

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

/** @param {string} slug @param {string | null} repo */
const nazwaProjektu = (slug, repo) => (repo ? basename(repo) : slug.replace(/^-Users-[^-]+-/, ''))

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
  const wspolne = {
    v: WERSJA_REKORDU, ts: new Date(op.terazMs).toISOString(), projekt: nazwaProjektu(run.projektSlug, katalogProjektu(run)),
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
    const epizody = scalEpizody(wpisy.flatMap(({ s, wpisy: w }) => epizodySesji(w, s.sesja)))
    /** @type {Map<string, Map<string, number>>} */
    const kosztyPerSesja = new Map()
    for (const e of epizody) {
      if (!e.odpowiedzi.size) continue
      if (!kosztyPerSesja.has(e.sesja)) kosztyPerSesja.set(e.sesja, kosztySubagentow(join(op.projekty, slug, e.sesja)))
      const koszty = kosztyPerSesja.get(e.sesja) ?? new Map()
      const r = rekordSkilla(e, (id) => koszty.get(id) ?? null)
      rekordy.push({
        v: WERSJA_REKORDU, ts: new Date(op.terazMs).toISOString(), projekt: nazwaProjektu(slug, typeof cwd === 'string' ? cwd : null),
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
