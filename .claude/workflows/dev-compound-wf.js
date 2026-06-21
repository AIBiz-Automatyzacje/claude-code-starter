export const meta = {
  name: 'dev-compound-wf',
  description: 'Dokumentuje rozwiazane problemy z sesji do docs/solutions/ (tryb compact) i ocenia rule-worthy do .claude/rules/learned-patterns.md.',
  whenToUse: 'Po ukonczeniu zadania, gdy kontekst napraw jest swiezy. Wolany przez dev-autopilot lub standalone.',
  phases: [{ title: 'Compound' }],
}

const COMPOUND_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plik: { type: ['string', 'null'], description: 'docs/solutions/<category>/<plik>.md lub null gdy nic nietrywialnego' },
    kategoria: { type: ['string', 'null'] },
    regula: {
      type: 'string',
      description: 'status learned-patterns',
      enum: ['dodana', 'pominieta: nie rule-worthy', 'pominieta: duplikat', 'pominieta: limit 50', 'brak'],
    },
  },
  required: ['plik', 'regula'],
}

const sciezka = typeof args === 'string' ? args : args && args.sciezka

phase('Compound')
const wynik = await agent(
  `Jestes czescia pipeline'u dev-autopilot. Dokumentujesz rozwiazane problemy do bazy wiedzy.
Wykonaj procedure ze skilla .claude/skills/dev-compound/SKILL.md w TRYBIE COMPACT (domyslny, autonomiczny, bez pytan).

${sciezka ? `Kontekst zadania: ${sciezka}` : 'Bez dodatkowego kontekstu — wyciagnij z sesji i git diff.'}

Kroki (compact, sekcja "Tryb Compact" skilla):
1. Wyciagnij kontekst z sesji + git diff / git diff --cached.
2. Przeczytaj auto memory MEMORY.md (jesli istnieje) jako uzupelnienie.
3. Sklasyfikuj kategorie (build-errors/runtime-errors/supabase-issues/auth-issues/ui-bugs/
   performance-issues/typescript-errors/deployment-issues/testing-issues).
4. Zapisz JEDEN plik docs/solutions/<category>/YYYY-MM-DD-kebab-title.md (rok 2026) wg formatu ze skilla.
   Jesli nie bylo nietrywialnego problemu wartego dokumentacji — ustaw plik=null.
5. Ocen rule-worthy (min 2 z 5 kryteriow), sprawdz duplikaty i limit 50, ewentualnie dodaj regule
   do .claude/rules/learned-patterns.md i zaktualizuj rule-count.

NIE tworz plikow tymczasowych — tylko finalny plik. Zwroc obiekt zgodny ze schematem CompoundResult.`,
  { schema: COMPOUND_RESULT, label: 'compound' }
)
return wynik
