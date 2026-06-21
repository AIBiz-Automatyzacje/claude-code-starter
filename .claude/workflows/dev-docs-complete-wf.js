export const meta = {
  name: 'dev-docs-complete-wf',
  description: 'Archiwizacja ukonczonego zadania: przenosi docs/active/<zadanie> -> docs/completed/, tworzy podsumowanie, aktualizuje dokumentacje projektu i commituje archiwizacje.',
  whenToUse: 'Po ukonczeniu wszystkich faz. Wolany przez dev-autopilot lub standalone z args {nazwaZadania}.',
  phases: [{ title: 'Archiwizacja' }],
}

const COMPLETE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    archiwum: { type: 'string', description: 'sciezka docs/completed/<zadanie>/' },
    pliki: { type: 'array', items: { type: 'string' } },
    aktualizacje: { type: 'array', items: { type: 'string' }, description: 'co gdzie dopisano (lub puste)' },
    rezultaty: { type: 'array', items: { type: 'string' } },
    commit: { type: 'string', description: 'hash commita archiwizacji ("" gdy nie bylo czego commitowac)' },
  },
  required: ['archiwum', 'pliki', 'commit'],
}

const nazwaZadania = typeof args === 'string' ? args : args && args.nazwaZadania
if (!nazwaZadania) {
  return { archiwum: '', pliki: [], aktualizacje: ['BLAD: brak args {nazwaZadania}'], rezultaty: [] }
}

phase('Archiwizacja')
const wynik = await agent(
  `Jestes specjalista ds. zamykania zadan. Wykonaj procedure ze skilla .claude/skills/dev-docs-complete/SKILL.md
dla zadania: ${nazwaZadania}.

Kroki (zgodnie ze skillem):
1. Zlokalizuj docs/active/${nazwaZadania}/.
2. Zweryfikuj ukonczenie (czytaj *-zadania.md). Jesli zostaly nieukonczone — i tak archiwizuj (tryb autopilota).
3. Wyciagnij kluczowe wnioski z *-kontekst.md.
4. Przenies wszystkie pliki do docs/completed/${nazwaZadania}/ + dodaj ${nazwaZadania}-podsumowanie.md
   (data ukonczenia, co dostarczono, kluczowe decyzje, glowne pliki, wnioski).
5. Jesli wsrod przenoszonych plikow jest .autopilot-state.json: ustaw w nim "complete": "done"
   (stempel archiwizacji — orkiestrator celowo nie zapisuje stanu po przeniesieniu folderu,
   wiec bez stempla archiwum klamaloby ze complete jest pending).
6. Zaktualizuj dokumentacje projektu jesli istotne (CLAUDE.md / .claude/rules/).
7. Usun pusty katalog docs/active/${nazwaZadania}/.
8. Zacommituj archiwizacje: git add TYLKO plikow ktore zmieniles w krokach 4-7
   (docs/active/, docs/completed/, ew. CLAUDE.md / .claude/rules/) i commit z message
   "docs(${nazwaZadania}): archiwizacja zadania — completed + podsumowanie".
   NIE dodawaj plikow spoza tej listy (zadnego git add -A). Jesli git commit nie powiedzie sie
   lub nie ma zmian — zwroc commit: "" i opisz powod w rezultaty (nie przerywaj archiwizacji).

NIE uruchamiaj /dev-compound (zrobi to orkiestrator). Dzialaj autonomicznie.
Zwroc obiekt zgodny ze schematem CompleteResult (commit = hash z kroku 8 lub "").`,
  { schema: COMPLETE_RESULT, label: `complete:${nazwaZadania}` }
)
return wynik
