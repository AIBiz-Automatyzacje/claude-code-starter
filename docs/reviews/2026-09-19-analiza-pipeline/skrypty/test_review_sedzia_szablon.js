export const meta = {
  name: '__NAZWA__',
  description: 'Test review (TEST-REVIEW-PLAN §5.2): ślepy sędzia dopasowania findingów czterech wariantów do kluczy fazy',
  phases: [{ title: 'Sędzia', detail: 'jeden agent: obecność K, dopasowania F, kategorie F bez dopasowania' }],
}

// Prompt złożony przez skrypty/test_review_sedzia.py (neutralne id K/U/F, bez nazw wariantów). Model sesji (claude-opus-5-5), efort medium.
const DANE = __DANE__

const WYNIK = {
  type: 'object', additionalProperties: false,
  properties: {
    klucze: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' },
          obecny: { type: 'string', enum: ['TAK', 'NIE', 'NIEPEWNE'] },
          uzasadnienie_obecnosci: { type: 'string' },
          dopasowania: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: { f: { type: 'string' }, ocena: { type: 'string', enum: ['PEŁNE', 'CZĘŚCIOWE'] }, uzasadnienie: { type: 'string' } },
              required: ['f', 'ocena', 'uzasadnienie'],
            },
          },
        },
        required: ['id', 'obecny', 'uzasadnienie_obecnosci', 'dopasowania'],
      },
    },
    bez_dopasowania: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { f: { type: 'string' }, kategoria: { type: 'string', enum: ['INNA_UWAGA_BOTA', 'POZA_KLUCZEM'] }, uwaga: { type: ['string', 'null'] } },
        required: ['f', 'kategoria', 'uwaga'],
      },
    },
  },
  required: ['klucze', 'bez_dopasowania'],
}

phase('Sędzia')
const wynik = await agent(DANE.prompt, { schema: WYNIK, label: DANE.etykieta, effort: 'medium', phase: 'Sędzia' })
return wynik
