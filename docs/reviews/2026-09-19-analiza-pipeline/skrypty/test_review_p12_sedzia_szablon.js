export const meta = {
  name: '__NAZWA__',
  description: 'Slepy test P12: sedzia obecnosci defektow klucza fazy w trzech implementacjach (A, B, C)',
  phases: [{ title: 'Sędzia', detail: 'jeden agent: ocena kazdej pary (defekt, implementacja)' }],
}

// Prompt złożony przez skrypty/test_review_p12_cli.py sedzia (neutralne etykiety A/B/C, bez źródła klucza). Model sesji (claude-opus-5-5), efort high:
// sędzia czyta kod trzech implementacji, nie dopasowuje gotowych findingów jak sędzia P11.
const DANE = __DANE__

const WYNIK = {
  type: 'object', additionalProperties: false,
  properties: {
    oceny: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' },
          wariant: { type: 'string', enum: ['A', 'B', 'C'] },
          ocena: { type: 'string', enum: ['OBECNY', 'ZAPOBIEZONY', 'BRAK_ODPOWIEDNIKA'] },
          dowod: { type: 'string' },
          uzasadnienie: { type: 'string' },
        },
        required: ['id', 'wariant', 'ocena', 'dowod', 'uzasadnienie'],
      },
    },
  },
  required: ['oceny'],
}

phase('Sędzia')
const wynik = await agent(DANE.prompt, { schema: WYNIK, label: DANE.etykieta, effort: 'high', phase: 'Sędzia' })
return wynik
