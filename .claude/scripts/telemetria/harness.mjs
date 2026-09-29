// Odczyt listy agentow i grup z pliku harnessu Claude Code (`<sesja>/workflows/<run>.json`, pole workflowProgress).
// Harness zapisuje ten plik po zakonczeniu KAZDEGO runu (156/156 w przegladzie D5) — dla obu formatow journala.

/**
 * @typedef {object} WpisHarnessu
 * @property {string | null} etykieta
 * @property {string | null} grupa
 * @property {number | null} proba
 * @property {string | null} stan done | error | progress
 * @property {string | null} model
 * @property {string | null} agentType
 */

/** @param {unknown} x @returns {string | null} */
const tekstLubNull = (x) => (typeof x === 'string' ? x : null)
/** @param {unknown} x @returns {number | null} */
const liczbaLubNull = (x) => (typeof x === 'number' ? x : null)

/** @param {unknown[]} postep @returns {Array<Record<string, unknown>>} */
function wpisy(postep) {
  return postep.filter((x) => x !== null && typeof x === 'object').map((x) => Object.fromEntries(Object.entries(x)))
}

// Dzieci, ktore pracuja NA fazie (reszta — compound, complete — biegnie w zakonczeniu runu).
const DZIECI_FAZY = /dev-docs-(execute|review)-wf/

/**
 * Numer fazy kazdego agenta. Grupa „Faza N” = N; dziecko execute/review = najblizsza wczesniejsza (po indeksie)
 * grupa nie-dziecko, jesli to „Faza N” („#N” w nazwie dziecka to numer wywolania, nie fazy); reszta = null (poziom runu).
 * @param {unknown[]} postep workflowProgress z pliku harnessu
 * @returns {Map<string, number | null>}
 */
export function fazyAgentow(postep) {
  const w = wpisy(postep)
  const grupy = w.filter((x) => x.type === 'workflow_phase').sort((a, b) => Number(a.index) - Number(b.index))
  /** @param {unknown} tytul */
  const numerFazy = (tytul) => {
    const m = typeof tytul === 'string' ? tytul.match(/^Faza (\d+)/) : null
    return m ? Number(m[1]) : null
  }
  /** @type {Map<number, number | null>} */
  const fazaGrupy = new Map()
  let ostatniaGlowna = null
  for (const g of grupy) {
    const indeks = Number(g.index)
    if (g.kind !== 'child') {
      ostatniaGlowna = numerFazy(g.title)
      fazaGrupy.set(indeks, ostatniaGlowna)
    } else {
      fazaGrupy.set(indeks, DZIECI_FAZY.test(String(g.title)) ? ostatniaGlowna : null)
    }
  }
  /** @type {Map<string, number | null>} */
  const wynik = new Map()
  for (const a of w.filter((x) => x.type === 'workflow_agent')) {
    const id = tekstLubNull(a.agentId)
    if (id) wynik.set(id, fazaGrupy.get(Number(a.phaseIndex)) ?? null)
  }
  return wynik
}

/**
 * @param {unknown[]} postep workflowProgress z pliku harnessu
 * @returns {Map<string, WpisHarnessu>}
 */
export function agenciHarnessu(postep) {
  /** @type {Map<string, WpisHarnessu>} */
  const wynik = new Map()
  for (const a of wpisy(postep).filter((x) => x.type === 'workflow_agent')) {
    const id = tekstLubNull(a.agentId)
    if (!id) continue
    wynik.set(id, {
      etykieta: tekstLubNull(a.label),
      grupa: tekstLubNull(a.phaseTitle),
      proba: liczbaLubNull(a.attempt),
      stan: tekstLubNull(a.state),
      model: tekstLubNull(a.model),
      agentType: tekstLubNull(a.agentType),
    })
  }
  return wynik
}
