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
    slownik: {
      type: 'string',
      description: 'status docs/CONCEPTS.md',
      enum: ['zaktualizowany', 'utworzony', 'brak'],
    },
    // Commit artefaktow bazy wiedzy (dwa runy z rzedu, 2026-07): ten workflow zapisywal solution,
    // learned-patterns.md i CONCEPTS.md, ale NIKT ich nie commitowal — operator dociagal je recznie,
    // a brudne drzewo blokowalo bramke bootstrapu nastepnego runu autopilota (STOP "niezacommitowane
    // zmiany"). W required z tego samego powodu co plikiBinarne w dev-autopilot-wf.js: brak commita
    // musi byc jawny, pole opcjonalne = agent cicho pomija commit i regresja wraca niezauwazona.
    commit: { type: 'string', description: 'hash commita artefaktow bazy wiedzy ("" gdy nie bylo czego commitowac albo commit sie nie udal)' },
    commitPowod: { type: 'string', description: 'powod pustego commita (nic do commitowania / blad) — wypelnij TYLKO gdy commit=""' },
  },
  required: ['plik', 'regula', 'commit'],
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
6. Slownik domenowy (Krok 4.5 skilla): jesli w sesji pojawil sie/uscisnil termin domenowy o znaczeniu
   PROJEKTOWO-SPECYFICZNYM (encja, nazwany proces, status/enum o niestandardowym sensie) — dodaj/zaktualizuj
   JEDNO haslo w docs/CONCEPTS.md (cienki indeks: 1-2 zdania + link do CLAUDE.md; tylko domenowe, nie techniczne;
   alfabetycznie, dedup). Jesli plik nie istnieje a domena jest bogata — utworz go z naglowkiem. Inaczej slownik=brak.
7. ZACOMMITUJ to, co zapisales w krokach 4-6. Kto zapisuje, ten commituje: dwa runy z rzedu zostawily
   te artefakty niezacommitowane (operator dociagal je recznie), a brudne drzewo blokuje bramke
   bootstrapu nastepnego runu autopilota (STOP "niezacommitowane zmiany") — czyli compound sabotuje
   kolejne uruchomienie pipeline'u.
   - Staguj WYLACZNIE po whiteliscie sciezek tego workflow:
     \`git add docs/solutions/ docs/CONCEPTS.md .claude/rules/learned-patterns.md\`
     Pomin w komendzie sciezki, ktorych nie ma na dysku (git przerwie na "pathspec did not match").
     ZAKAZ \`git add -A\` i \`git add .\` — reszta drzewa nalezy do innych krokow pipeline'u.
   - Message w konwencji repo: \`docs(solutions): <tytul zapisanego solution>\` (przyklad:
     "docs(solutions): sekret w drzewie czytanym przez agenta — eksfiltracja przez prompt injection").
     Gdy plik=null, a zmienila sie regula albo slownik: \`docs(knowledge): <co zaktualizowano>\`.
   - Gdy plik=null ORAZ regula i slownik nietkniete — nie ma czego commitowac: zwroc commit: ""
     i commitPowod: "brak artefaktow do commitowania". To poprawna odpowiedz, nie blad.
   - Gdy \`git commit\` nie powiedzie sie (pusty stage, hook, konflikt) — NIE przerywaj: zwroc
     commit: "" i krotki powod w commitPowod.

NIE tworz plikow tymczasowych — tylko finalny plik. Zwroc obiekt zgodny ze schematem CompoundResult
(commit = hash z kroku 7 lub "").`,
  { schema: COMPOUND_RESULT, label: 'compound' }
)
return wynik
