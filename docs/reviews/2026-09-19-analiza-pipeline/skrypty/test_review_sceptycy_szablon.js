export const meta = {
  name: '__NAZWA__',
  description: 'Test review (TEST-REVIEW-PLAN §6): sceptycy projektu __PROJEKT__ na findingach dopasowanych przez sędziego (fazy __ETYKIETA__)',
  phases: [{ title: 'Verify', detail: 'sceptycy wg projektu: P2 grupy/batch, P1 ×n' }],
}

// Grupy i prompty złożone przez skrypty/test_review_sceptycy.py z katalogu projektu (SC-*/V-*/S-01 + warstwa stała sceptyka).
const DANE = __DANE__

const WERDYKTY = {
  type: 'object', additionalProperties: false,
  properties: {
    werdykty: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          indeks: { type: 'integer' },
          etykieta: { type: 'string', enum: ['AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN'] },
          dowod: { type: 'string', description: 'plik:linia kodu albo test, który przeczy tezie (wymagane przy DISAGREE_EVIDENCE)' },
          uzasadnienie: { type: 'string' },
        },
        required: ['indeks', 'etykieta', 'dowod', 'uzasadnienie'],
      },
    },
  },
  required: ['werdykty'],
}

// DISAGREE_EVIDENCE bez wskazania dowodu: A — liczy się jak AGREE (SC-1), B i C — jak DISAGREE_CONCERN (V-01, S-01).
const normalizuj = (w) => {
  if (!w) return null
  if (w.etykieta === 'DISAGREE_EVIDENCE' && !String(w.dowod || '').trim()) return { ...w, etykieta: DANE.projekt === 'A' ? 'AGREE' : 'DISAGREE_CONCERN' }
  return w
}

phase('Verify')
const wyniki = await parallel(DANE.zadania.map((z) => () =>
  agent(z.prompt, { schema: WERDYKTY, label: z.etykieta, effort: z.effort, phase: 'Verify' })
    .then((w) => ({ z, werdykty: ((w && w.werdykty) || []).map(normalizuj) }))))

// zbiór głosów per finding (indeks globalny)
const glosy = {}
for (const r of wyniki.filter(Boolean)) {
  r.z.indeksy.forEach((g, i) => {
    const w = r.werdykty.find((v) => v && v.indeks === i)
    ;(glosy[g] = glosy[g] || []).push(w ? w.etykieta : null)
  })
}
const decyzje = DANE.findingi.map((f, g) => {
  const g_ = (glosy[g] || []).filter(Boolean)
  const ev = g_.filter((x) => x === 'DISAGREE_EVIDENCE').length
  const conc = g_.filter((x) => x === 'DISAGREE_CONCERN').length
  let zabity, waga = f.waga
  if (g_.length === 0) zabity = false                                   // 0 głosów = niezweryfikowany, nie zabity
  else if (f.waga === 'P1' && DANE.p1_n > 1) zabity = ev >= 2           // A, B: 3 sceptyków, kasacja przy 2/3 DISAGREE_EVIDENCE
  else zabity = ev >= 1                                                  // P2 (i P1 w C): pojedynczy głos z dowodem kasuje
  if (!zabity && conc && f.waga === 'P2' && DANE.projekt === 'C') waga = 'P3'   // C: CONCERN obniża P2 → P3
  return { f: f.id, waga_przed: f.waga, waga_po: waga, zabity, glosy: glosy[g] || [] }
})
return { projekt: DANE.projekt, etykieta: DANE.etykieta, decyzje }
