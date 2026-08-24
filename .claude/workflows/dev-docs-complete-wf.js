export const meta = {
  name: 'dev-docs-complete-wf',
  description: 'Archiwizacja ukonczonego zadania: generuje smoke operatora (docs/operator/), przenosi docs/active/<zadanie> -> docs/completed/, tworzy podsumowanie, aktualizuje dokumentacje projektu i commituje archiwizacje.',
  whenToUse: 'Po ukonczeniu wszystkich faz. Wolany przez dev-autopilot lub standalone z args {nazwaZadania}.',
  phases: [{ title: 'Smoke operatora' }, { title: 'Archiwizacja' }],
}

// Smoke operatora = dokument #2 dla czlowieka: "co sprawdzic recznie po tym, jak automat (typecheck,
// testy, E2E w przegladarce) byl zielony". Generowany PRZED archiwizacja, bo wtedy sciezki docs/active/ jeszcze zyja
// i latwo zebrac: sekcje "## Operator checklist faza N", scenariusze [Manual], findingi OPERATOR z raportow
// review, known-issues oraz — jako czerwona flaga — niezaznaczone [E2E] (w autopilocie completion-gate je
// blokuje, ale standalone archiwizacja idzie dalej; operator musi to ZOBACZYC).
const SMOKE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plik: { type: 'string', description: 'sciezka docs/operator/<data>-<zadanie>-smoke.md ("" gdy nic do sprawdzenia recznie)' },
    pozycje: { type: 'integer', description: 'liczba checkboxow do recznego sprawdzenia' },
    e2eNieuruchomione: { type: 'integer', description: 'ile [E2E] z zadania pozostalo NIEZAZNACZONYCH (powinno byc 0 po completion-gate)' },
    zrodla: { type: 'array', items: { type: 'string' }, description: 'skad zebrano pozycje (sekcje/pliki)' },
  },
  required: ['plik', 'pozycje', 'e2eNieuruchomione'],
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

// smokeStatus liczony w JS (agent archiwizacji nie wie tego lepiej niz orkiestrator):
//   'plik'           = smoke powstal (sciezka w smokeOperatora)
//   'brak-pozycji'   = agent przejrzal zrodla i nie bylo nic do recznego sprawdzenia
//   'agent-null'     = agent padl 2x — pozycje Operator checklist/[Manual] NIE zostaly przeniesione; operator
//                      musi wygenerowac smoke recznie (/dev-docs-complete). To NIE jest "brak pozycji".
//   'nie-uruchomiono' = early return (brak args)
const nazwaZadania = typeof args === 'string' ? args : args && args.nazwaZadania
// Dodatkowe sciezki do commita archiwizacji (autopilot przekazuje wyjscia compound/refresh: solution,
// docs/CONCEPTS.md, learned-patterns.md) — nikt inny ich nie commituje.
const dodatkowePathspec = (args && Array.isArray(args.dodatkowePathspec)) ? args.dodatkowePathspec.filter((x) => typeof x === 'string' && x) : []
if (!nazwaZadania) {
  return { archiwum: '', pliki: [], aktualizacje: ['BLAD: brak args {nazwaZadania}'], rezultaty: [], commit: '', smokeOperatora: '', smokeStatus: 'nie-uruchomiono' }
}

const smokePrompt = `Jestes autorem checklisty smoke dla OPERATORA (czlowieka) po zamknieciu zadania: ${nazwaZadania}.
Procedura i format: .claude/skills/dev-docs-complete/SKILL.md, krok 3 "Smoke operatora" — przeczytaj go W CALOSCI
(zrodla, hierarchia stanu i dedup, skad brac dane do naglowka, uklad pliku).

Folder zadania: docs/active/${nazwaZadania}/ (jeszcze NIE archiwizuj — to robi nastepna faza).

Zbierz WYLACZNIE to, czego automat nie sprawdzil:
1. Wszystkie NIEZAZNACZONE checkboxy z sekcji "## Operator checklist faza N" w *-zadania.md (kazda faza).
   Ta sekcja jest JEDYNYM zrodlem stanu: pozycja [x] tam = temat zamkniety, pomin jej odpowiedniki w (2)-(4).
2. Scenariusze z markerem [Manual] (z *-zadania.md i z planu technicznego wskazanego w "Plan techniczny:").
3. Findingi typu OPERATOR z review-faza-*.md — tylko jako wzbogacenie krokow pozycji z (1); pozycja spoza (1)
   wchodzi wylacznie, gdy w zadaniach nie ma jej wcale (dopasowanie po IU-K / pliku / ekranie). Warunki
   srodowiskowe (dev server w trybie e2e, seedy na projekt e2e) NIE sa pozycjami smoke'u: uruchomienie apki
   to tylko check "aplikacja wstaje (dev server)" w sekcji 0; kroki pod przebieg E2E pomin calkowicie
   (smoke leci na projekcie GLOWNYM, nie e2e).
4. Otwarte wpisy z docs/active/${nazwaZadania}/known-issues.md (jesli plik istnieje) i otwarte P3 z
   "## Do poprawy po review fazy N". "Otwarte" = poza sekcja "## Zamkniete"; gdy sekcji nie ma — pomin wpisy,
   ktore same lub pozniejsza faza oznaczaja jako ZAMKNIETY/naprawione. Z OBU zrodel bierz WYLACZNIE wpisy
   opisujace zachowanie na ekranie/w przegladarce lub flow do recznego przejscia; notatki srodowiskowe, dane
   testowe i pulapki narzedziowe pomin.
5. CZERWONA FLAGA: niezaznaczone checkboxy [E2E] (\`grep -nE '^- \\[ \\].*\\[E2E\\]' docs/active/${nazwaZadania}/*-zadania.md | grep -vE 'Operator:|\\[P[123]\\]'\`
   — ten sam grep co completion-gate autopilota; kopie "Operator:" w Operator checklist i pozycje findingow [P1]/[P2]/[P3] w "Do poprawy" nie sa scenariuszami;
   brak trafien = exit 1, to NIE blad). Rozdziel: linie z suffixem "(FAIL:" -> sekcja "## ⚠️ E2E przebieglo i padlo (znany defekt)" z odeslaniem
   do known-issues (NIE radz zmiany na [Manual]); pozostale -> sekcja "## ⚠️ E2E nieuruchomione". Obie na poczatku
   dokumentu; obie licz w e2eNieuruchomione. NIE odhaczaj ich.

DEDUP: kazdy temat raz — Test [Manual] z IU, jego kopia w Operator checklist i wzmianka w findingu OPERATOR
to JEDEN checkbox w sekcji ekranu; kroki scal, nie powielaj.

Jesli po zastosowaniu hierarchii (1)-(5) nie ma ANI JEDNEJ pozycji — nie tworz pliku, zwroc plik:"" i pozycje:0.

DANE DO NAGLOWKA I SEKCJI 0 — NIE uruchamiaj testow ani scenariuszy E2E (wynik juz jest w artefaktach):
- <N> testow: docs/active/${nazwaZadania}/.autopilot-state.json -> walidacjaWynik.testy ("PASS X/Y"); brak -> "testy zielone wg walidacji koncowej" bez liczby.
- <M> scenariuszy E2E: \`grep -hE '^- \\[x\\].*\\[E2E\\]' docs/active/${nazwaZadania}/*-zadania.md | grep -vcE 'Operator:|\\[P[123]\\]'\` (bez kopii "Operator:" i pozycji findingow; brak trafien = 0).
- marker projektu glownego / ref e2e: TYLKO pierwsze 6 znakow hosta: \`grep -ohE 'SUPABASE_URL=https://[a-z0-9]{6}' .env .env.local .env.e2e 2>/dev/null\`.
- nazwa zmiennej z haslem konta testowego: TYLKO nazwy: \`grep -oE '^[A-Z0-9_]*(PASSWORD|PASS|HASLO)[A-Z0-9_]*=' .env .env.local .env.e2e 2>/dev/null | cut -d= -f1 | sort -u\`.
ZAKAZ cat/Read calego .env* — nigdy nie wczytuj wartosci sekretow do kontekstu.

W przeciwnym razie zapisz docs/operator/<YYYY-MM-DD>-${nazwaZadania}-smoke.md (data z \`date +%F\`,
\`mkdir -p docs/operator\`) wedlug ukladu ze skilla: naglowek ze statusem, akapit "dlaczego to nie jest
formalnosc", sekcja "0. Przygotowanie" (ktory projekt/baza po markerze; jak uruchomic apke; jakie dane/konta
potrzebne), potem sekcje per wymaganie/ekran w kolejnosci przechodzenia apki (nie per faza) z checkboxami,
kazdy z konkretnym oczekiwanym wynikiem. Pozycje wymagajace fizycznego urzadzenia (np. realny telefon
zamiast mobilnego viewportu) oznacz **[fizyczne urzadzenie]**.
Na koncu sekcja "Jak kontynuowac w nowej sesji" z jedna ramka do wklejenia jako pierwsza wiadomosc.
Jesli w projekcie istnieje wczesniejszy docs/operator/*-smoke.md — trzymaj sie jego ukladu sekcji.

W CALYM pliku zadnych wartosci hasel/tokenow/kluczy — takze gdy cytujesz known-issues lub review;
zastap nazwa zmiennej lub fraza "<haslo w .env.e2e>". E-mail konta testowego moze zostac.

Nie wymyslaj pozycji spoza zrodel (1)-(5). Nie modyfikuj *-zadania.md ani raportow review.
Zwroc obiekt zgodny ze schematem.`

phase('Smoke operatora')
let smoke = await agent(smokePrompt, { schema: SMOKE_RESULT, label: `smoke-operatora:${nazwaZadania}` })
if (!smoke) {
  // Jeden retry po null (wzorzec env-up w autopilocie): null to realny, obslugiwany stan agenta, a smoke jest
  // JEDYNYM kanalem, ktorym Operator checklist/[Manual] docieraja do czlowieka — bez retry cicho gina.
  log('Smoke operatora: agent zwrocil null — retry raz')
  smoke = await agent(smokePrompt, { schema: SMOKE_RESULT, label: `smoke-operatora-retry:${nazwaZadania}` })
}
const smokePlik = (smoke && smoke.plik) || ''
const smokeStatus = !smoke ? 'agent-null' : (smokePlik ? 'plik' : 'brak-pozycji')
log(`Smoke operatora: ${smokeStatus === 'plik'
  ? `${smokePlik} (${smoke.pozycje} pozycji${smoke.e2eNieuruchomione ? `, UWAGA: ${smoke.e2eNieuruchomione} [E2E] nieuruchomionych` : ''})`
  : smokeStatus === 'brak-pozycji'
    ? 'brak pozycji do recznego sprawdzenia — plik nie powstal'
    : 'agent padl 2x — plik NIE powstal, pozycje Operator checklist/[Manual] NIE zostaly przeniesione; wygeneruj recznie: /dev-docs-complete ' + nazwaZadania}`)

// Tresc dla agenta archiwizacji — rozroznia trzy stany, zeby podsumowanie nie utrwalilo falszywego
// "brak pozycji recznych" po awarii agenta smoke'u.
const smokeInfo = smokeStatus === 'plik'
  ? `Smoke operatora zostal wygenerowany w poprzedniej fazie: ${smokePlik}. NIE generuj go ponownie. Przed git add sprawdz \`test -f ${smokePlik}\`; jesli pliku nie ma — pomin go w git add, nie linkuj w podsumowaniu i opisz to w rezultaty.`
  : smokeStatus === 'brak-pozycji'
    ? 'Smoke operatora NIE powstal, bo po przejrzeniu zrodel nie bylo zadnej pozycji do recznego sprawdzenia. NIE generuj go. W podsumowaniu napisz: "smoke operatora: brak pozycji do recznego sprawdzenia".'
    : `Smoke operatora NIE zostal wygenerowany — agent padl 2x (awaria, NIE "brak pozycji"). NIE generuj go sam (to osobna faza). W podsumowaniu zapisz WPROST: "smoke operatora do wygenerowania recznie: /dev-docs-complete ${nazwaZadania} — checklisty Operator checklist i [Manual] z *-zadania.md NIE zostaly przeniesione do docs/operator/". NIE pisz, ze brak pozycji recznych.`

const podsumowanieSmoke = smokeStatus === 'plik'
  ? `, link do smoke'u operatora: ${smokePlik} + liczba pozycji (${smoke.pozycje})`
  : smokeStatus === 'agent-null'
    ? ', jawna informacja o NIEWYGENEROWANYM smoke operatora (patrz wyzej)'
    : ''

// Pathspec git add: WYLACZNIE istniejace sciezki — nieistniejacy pathspec (np. docs/operator/ w projekcie bez
// tego katalogu) daje `fatal` i git add NIE stage'uje NICZEGO (archiwizacja zostaje niezacommitowana, a bramka
// czystosci nastepnego runu blokuje start). docs/active/<zadanie> jest bezpieczne po zwyklym `mv`/`rm` (wpisy
// zostaja w indeksie, git dopasowuje pathspec do indeksu) — ale NIE po `git mv`/`git rm` (wpisy znikaja z indeksu
// i pathspec pada). Dlatego prompt zakazuje `git mv`/`git rm`, a krok 8 kaze sprawdzic `git ls-files`.
// docs/operator katalogowo obok dokladnej sciezki smoke'u: agent mogl zapisac plik pod inna data/nazwa niz zwrocil.
const pathspec = `docs/active/${nazwaZadania} docs/completed/${nazwaZadania}${smokeStatus === 'plik' ? ` ${smokePlik} docs/operator` : ''}${dodatkowePathspec.length ? ` ${dodatkowePathspec.join(' ')}` : ''}`

phase('Archiwizacja')
const wynik = await agent(
  `Jestes specjalista ds. zamykania zadan. Wykonaj procedure ze skilla .claude/skills/dev-docs-complete/SKILL.md
dla zadania: ${nazwaZadania}.

${smokeInfo}

Kroki (zgodnie ze skillem):
1. Zlokalizuj docs/active/${nazwaZadania}/.
2. Zweryfikuj ukonczenie (czytaj *-zadania.md wg puli z kroku 2 skilla). Jesli zostaly nieukonczone — i tak archiwizuj (tryb autopilota), ale wypisz je w rezultaty.
3. Wyciagnij kluczowe wnioski z *-kontekst.md.
4. Przenies wszystkie pliki do docs/completed/${nazwaZadania}/ przez zwykle \`mv\` (NIE \`git mv\`, NIE \`git rm\` —
   pathspec w kroku 8 zaklada, ze wpisy docs/active/ sa nadal w indeksie) + dodaj ${nazwaZadania}-podsumowanie.md
   (data ukonczenia, co dostarczono, kluczowe decyzje, glowne pliki, wnioski${podsumowanieSmoke}).
5. Jesli wsrod przenoszonych plikow jest .autopilot-state.json: ustaw w nim "complete": "done"
   (stempel archiwizacji — orkiestrator celowo nie zapisuje stanu po przeniesieniu folderu,
   wiec bez stempla archiwum klamaloby ze complete jest pending).
6. Zaktualizuj dokumentacje projektu jesli istotne (CLAUDE.md / .claude/rules/).
7. Usun pusty katalog docs/active/${nazwaZadania}/.
8. Zacommituj archiwizacje. Pathspec do git add (NIC poza tym, zadnego git add -A):
   ${pathspec}
   oraz ew. CLAUDE.md / .claude/rules/<plik> — te TYLKO jesli faktycznie je zmieniles w kroku 6.
   PRZED git add: dla kazdej sciezki z listy sprawdz, ze istnieje na dysku (\`test -e\`) LUB jest w indeksie
   (\`git ls-files <sciezka> | grep -q .\`); sciezke, ktora nie spelnia zadnego warunku, POMIN i opisz w rezultaty
   (nieistniejacy pathspec = fatal i git add nie stage'uje NICZEGO). Jesli docs/active/${nazwaZadania} nie ma juz
   w indeksie (uzyles git mv wbrew krokowi 4) — pomin te sciezke, rename'y sa juz zestage'owane.
   SIATKA BEZPIECZENSTWA: sprawdz \`git status --porcelain\` i jesli wisza niezacommitowane
   artefakty bazy wiedzy — docs/solutions/, docs/CONCEPTS.md, .claude/rules/learned-patterns.md
   — dolacz je do TEGO commita (compound albo compound-refresh nie domknal swojego commita);
   takze tutaj dodawaj wylacznie sciezki istniejace na dysku lub w indeksie.
   Powod: dwa runy z rzedu zostawily te pliki w drzewie, a brudne drzewo blokuje bramke bootstrapu
   nastepnego runu autopilota (STOP "niezacommitowane zmiany").
   Commit z message "docs(${nazwaZadania}): archiwizacja zadania — completed + podsumowanie${smokeStatus === 'plik' ? ' + smoke operatora' : ''}".
   Jesli git commit nie powiedzie sie lub nie ma zmian — zwroc commit: "" i opisz powod w rezultaty (nie przerywaj archiwizacji).

NIE uruchamiaj /dev-compound (zrobi to orkiestrator). Dzialaj autonomicznie.
Zwroc obiekt zgodny ze schematem CompleteResult (commit = hash z kroku 8 lub "").`,
  { schema: COMPLETE_RESULT, label: `complete:${nazwaZadania}` }
)
if (!wynik) {
  return { archiwum: '', pliki: [], aktualizacje: ['BLAD: agent archiwizacji zwrocil null'], rezultaty: [], commit: '', smokeOperatora: smokePlik, smokeStatus }
}
return { ...wynik, smokeOperatora: smokePlik, smokeStatus }
