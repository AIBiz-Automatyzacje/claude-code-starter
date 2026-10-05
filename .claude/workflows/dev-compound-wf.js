export const meta = {
  name: 'dev-compound-wf',
  description: 'Zapis rozwiazanych problemow zadania do docs/solutions/ (tryb compact).',
  whenToUse: 'Wolany przez dev-autopilot-wf; standalone: args {sciezka}.',
  phases: [{ title: 'Compound' }],
}

// Pola wiedzy zapisanego solution (PLAN-POPRAWY P10) — te same nazwy co we frontmatterze, szczebel_powod jako szczebelPowod.
const WPIS_WIEDZY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plik: { type: 'string', description: 'docs/solutions/<category>/<plik>.md' },
    klasa: { type: 'string', description: 'pole klasa z frontmattera' },
    regula: { type: 'string', description: 'pole regula z frontmattera' },
    szczebel: { type: 'string', enum: ['regula', 'kod', 'lint'] },
    szczebelPowod: { type: 'string', description: 'pole szczebel_powod z frontmattera' },
  },
  required: ['plik', 'klasa', 'regula', 'szczebel', 'szczebelPowod'],
}

const COMPOUND_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plik: { type: ['string', 'null'], description: 'docs/solutions/<category>/<plik>.md lub null gdy nic nietrywialnego albo odmowa zapisu' },
    kategoria: { type: ['string', 'null'] },
    wiedza: { ...WPIS_WIEDZY, type: ['object', 'null'], description: 'pola wiedzy zapisanego solution; null gdy plik=null' },
    odmowa: { type: ['string', 'null'], description: 'bledy z `wiedza.mjs sprawdz`, gdy solution nie przeszedl walidacji i zostal usuniety; inaczej null' },
    indeks: {
      type: 'string',
      enum: ['zapisany', 'bramka', 'bez zmian'],
      description: 'wynik `wiedza.mjs indeks --zapisz`: zapisany / bramka (zapisany=false, plik indeksu bez zmian) / bez zmian (brak solution)',
    },
    slownik: {
      type: 'string',
      description: 'status docs/CONCEPTS.md',
      enum: ['zaktualizowany', 'utworzony', 'brak'],
    },
    // Commit artefaktow bazy wiedzy (dwa runy z rzedu, 2026-07): ten workflow zapisywal solution,
    // regule i CONCEPTS.md, ale NIKT ich nie commitowal — operator dociagal je recznie,
    // a brudne drzewo blokowalo bramke bootstrapu nastepnego runu autopilota (STOP "niezacommitowane
    // zmiany"). W required z tego samego powodu co plikiBinarne w dev-autopilot-wf.js: brak commita
    // musi byc jawny, pole opcjonalne = agent cicho pomija commit i regresja wraca niezauwazona.
    commit: { type: 'string', description: 'hash commita artefaktow bazy wiedzy ("" gdy nie bylo czego commitowac albo commit sie nie udal)' },
    commitPowod: { type: 'string', description: 'powod pustego commita (nic do commitowania / blad) — wypelnij, gdy commit=""' },
  },
  required: ['plik', 'wiedza', 'odmowa', 'indeks', 'commit'],
}

// Szczebel kod/lint = lekcje, ktore pewniej wymusi mechanizm niz tekst (INSPIRACJE A2): operator decyduje o bramce, a do jej
// wdrozenia (pole `bramka`) lekcja idzie do indeksu i wycinka jak regula. Kopia w dev-pr-wf.js (workflowy sa self-contained; rownosc pilnuje compound-wiedza.test.mjs).
function propozycjeBramek(wpisy) {
  return wpisy
    .filter((w) => w.szczebel === 'kod' || w.szczebel === 'lint')
    .map((w) => ({ szczebel: w.szczebel, klasa: w.klasa, propozycja: w.regula, powod: w.szczebelPowod, solution: w.plik }))
}

function compoundPrompt(sciezka) {
  const material = sciezka
    ? `raporty review \`${sciezka}/review-faza-*.md\` (findingi i obalenia), \`${sciezka}/known-issues.md\`,
   sekcja \`## Dziennik\` w \`${sciezka}/*-kontekst.md\` oraz commity galezi zadania od odejscia od galezi glownej
   (\`git log --oneline\`, diffy commitow \`fix(\`).`
    : `commity biezacej galezi od odejscia od galezi glownej (\`git log --oneline\`, diffy commitow \`fix(\`).`
  return `Dokumentujesz rozwiazane problemy zadania do bazy wiedzy projektu (pipeline dev-autopilot).
Wykonaj procedure ze skilla .claude/skills/dev-compound/SKILL.md w TRYBIE COMPACT (domyslny, autonomiczny, bez pytan).

${sciezka ? `Kontekst zadania: ${sciezka}` : 'Bez katalogu zadania — material bierz z historii gita biezacej galezi.'}

Nie widzisz rozmowy sesji glownej: jedynym kontekstem sa pliki i historia gita. W chwili compoundu zmiany
zadania sa juz zacommitowane, wiec sam \`git diff\` jest zwykle pusty.

Kroki (compact, sekcja "Tryb Compact" skilla):
1. Material: ${material}
2. Przeczytaj auto memory MEMORY.md (jesli istnieje) jako uzupelnienie.
3. Sklasyfikuj kategorie (build-errors/runtime-errors/supabase-issues/auth-issues/ui-bugs/
   performance-issues/typescript-errors/deployment-issues/testing-issues).
4. Zapisz JEDEN plik docs/solutions/<category>/YYYY-MM-DD-kebab-title.md (data z \`date +%F\`) wg formatu ze skilla,
   razem z polami wiedzy we frontmatterze (klasa, regula, paths, waga, szczebel, szczebel_powod, zrodlo, ucieczki — sekcja
   "Pola wiedzy" skilla). Jesli nie bylo nietrywialnego problemu wartego dokumentacji — ustaw plik=null, wiedza=null.
5. Sprawdzenie pol: \`node .claude/scripts/wiedza/wiedza.mjs sprawdz <plik>\`. Kod 1 = popraw pola wg \`bledy\` i sprawdz
   drugi raz. Gdy dalej kod 1 — usun plik (solution bez poprawnych pol wiedzy nie zostaje w bazie), zwroc plik=null,
   wiedza=null i bledy w odmowa.
6. Indeks po kazdym zapisanym solution: \`node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz\` — skrypt generuje docs/learned-patterns.md
   z solutions (szczebel regula oraz kod/lint bez pola bramka — do wdrozenia bramki lekcja dziala jak regula). \`zapisany: true\` -> indeks=zapisany;
   \`zapisany: false\` (bramka koszyka "zawsze" albo rozmiaru) -> indeks=bramka, indeksu nie edytujesz recznie. Brak solution -> indeks="bez zmian".
   Szczebel kod albo lint jest tez propozycja bramki dla operatora. Pola bramka nie ustawiasz: dopisuje je wdrozenie bramki.
7. Slownik domenowy (sekcja skilla o docs/CONCEPTS.md): jesli w materiale pojawil sie/uscisnil termin domenowy o znaczeniu
   PROJEKTOWO-SPECYFICZNYM (encja, nazwany proces, status/enum o niestandardowym sensie) — dodaj/zaktualizuj
   JEDNO haslo w docs/CONCEPTS.md (cienki indeks: 1-2 zdania + link do CLAUDE.md; tylko domenowe, nie techniczne;
   alfabetycznie, dedup). Jesli plik nie istnieje a domena jest bogata — utworz go z naglowkiem. Inaczej slownik=brak.
8. Zacommituj to, co zapisales w krokach 4-7: brudne drzewo zatrzymuje bramke startu nastepnego runu autopilota
   (STOP "niezacommitowane zmiany").
   - Staguj po whiteliscie sciezek tego workflowu:
     \`git add docs/solutions/ docs/CONCEPTS.md docs/learned-patterns.md\`
     Pomin w komendzie sciezki, ktorych nie ma na dysku (git przerwie na "pathspec did not match").
     Bez \`git add -A\` i \`git add .\` — reszta drzewa nalezy do innych krokow pipeline'u.
   - Message w konwencji repo: \`docs(solutions): <tytul zapisanego solution>\` (przyklad:
     "docs(solutions): sekret w drzewie czytanym przez agenta — eksfiltracja przez prompt injection").
     Gdy plik=null, a zmienil sie slownik: \`docs(knowledge): <co zaktualizowano>\`.
   - Gdy plik=null i slownik nietkniety — nie ma czego commitowac: zwroc commit: ""
     i commitPowod: "brak artefaktow do commitowania". To poprawna odpowiedz, nie blad.
   - Gdy \`git commit\` sie nie powiedzie (pusty stage, hook, konflikt), zwroc commit: "" i powod w commitPowod.

Plikow tymczasowych nie tworzysz — tylko finalny plik. Zwroc obiekt zgodny ze schematem CompoundResult
(commit = hash z kroku 8 lub "").`
}

const sciezka = typeof args === 'string' ? args : args && args.sciezka

phase('Compound')
const wynik = await agent(compoundPrompt(sciezka || null), { schema: COMPOUND_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'compound' })
if (!wynik) return null
const bramki = propozycjeBramek(wynik.wiedza ? [wynik.wiedza] : [])
if (wynik.odmowa) log(`compound: odmowa zapisu solution — ${wynik.odmowa}`)
if (wynik.indeks === 'bramka') log('compound: bramka indeksu docs/learned-patterns.md — indeks bez zmian, porzadkuje dev-compound-refresh')
return { ...wynik, propozycjeBramek: bramki }
