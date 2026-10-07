export const meta = {
  name: 'dev-docs-complete-wf',
  description: 'Archiwizacja ukonczonego zadania: smoke operatora, docs/completed/, commit.',
  whenToUse: 'Wolany przez dev-autopilot-wf; standalone: args {nazwaZadania}.',
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
    rezultaty: { type: 'array', items: { type: 'string' } },
    commit: { type: 'string', description: 'hash commita archiwizacji ("" gdy nie bylo czego commitowac)' },
    decyzje: {
      type: 'object',
      additionalProperties: false,
      properties: {
        plik: { type: 'string', description: 'sciezka docs/decisions/<data>-<zadanie>.md ("" gdy nie powstal)' },
        claudeMd: { type: 'string', description: 'wartosc pola claude_md odczytana z dysku' },
      },
      required: ['plik', 'claudeMd'],
    },
    plikiPr: { type: 'array', items: { type: 'string' }, description: 'git diff --name-only <merge-base z main> HEAD po commicie' },
  },
  required: ['archiwum', 'pliki', 'commit', 'decyzje', 'plikiPr'],
}

const DOPISEK_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: { zapisano: { type: 'boolean' }, commit: { type: 'string' } },
  required: ['zapisano', 'commit'],
}

// ── Archiwum (P4) ─────────────────────────────────────────────────────────
// Archiwizacja nie edytuje CLAUDE.md ani .claude/rules/: CLAUDE.md oferty urosl 3,4k -> 89,7k zn w 4 tygodnie, a czyta go
// kazdy builder i reviewer. Decyzje zadania ida do docs/decisions/<data>-<zadanie>.md z polem claude_md — CLAUDE.md
// uzgadnia sie z kodem po merge'u PR. Funkcje czyste: __tests__/start-koniec.test.mjs.

// Bot recenzji odmowil PR-a z 222 plikami (ETAP1 §5) — prog z zapasem; przekroczenie to UWAGA, nie STOP.
const PROG_PLIKOW_PR = 150

// Mapa funkcji skilla weryfikacji projektu (P14): archiwizacja dopisuje do niej funkcje ze scenariuszy [E2E] zadania.
// Kopia PLIK_MAPY z .claude/scripts/e2e/weryfikacja.mjs (workflowy sa self-contained) — test rownosci w start-koniec.test.mjs.
const MAPA_FUNKCJI = '.claude/skills/weryfikacja/mapa-funkcji.md'

// Pathspec git add: wylacznie sciezki z tej listy. *.bak to kopie robocze operatora (np. stanu przed reczna edycja) —
// nie wchodza do archiwum. Wyjscia compound (solution, indeks wiedzy) przychodza z autopilota. Mapa funkcji jest na liscie
// zawsze; w projekcie bez skilla weryfikacji agent pomija ja jak kazda nieistniejaca sciezke (krok 8).
function pathspecArchiwum(nazwaZadania, smokePlik, dodatkowe) {
  return [
    `docs/active/${nazwaZadania}`, `docs/completed/${nazwaZadania}`,
    ...(smokePlik ? [smokePlik, 'docs/operator'] : []),
    'docs/decisions', ...dodatkowe, MAPA_FUNKCJI, "':(exclude,glob)**/*.bak'",
  ].join(' ')
}

// Komunikat liczony tutaj: agent dal raz commitowi archiwizacji temat commita feature (IT1-ODCZYT §6).
function komunikatArchiwum(nazwaZadania) {
  return `docs(${nazwaZadania}): archiwum`
}

function szkieletDecyzji(nazwaZadania) {
  return `---\nzadanie: ${nazwaZadania}\ndata: <data z \`date +%F\`>\nclaude_md: do-uzgodnienia\n---\n`
}

function sprawdzDecyzje(decyzje, nazwaZadania) {
  const wzor = new RegExp(`^docs/decisions/\\d{4}-\\d{2}-\\d{2}-${nazwaZadania}\\.md$`)
  if (!decyzje || !wzor.test(decyzje.plik)) return `UWAGA: brak pliku decyzji docs/decisions/<data>-${nazwaZadania}.md (zwrocono: ${(decyzje && decyzje.plik) || 'nic'})`
  if (decyzje.claudeMd !== 'do-uzgodnienia') return `UWAGA: ${decyzje.plik} ma claude_md: ${decyzje.claudeMd || 'brak'} zamiast do-uzgodnienia`
  return null
}

// Katalog do propozycji podzialu: dwa pierwsze segmenty (apps/web, src/lib), plik w korzeniu osobno.
function bramkaRozmiaruPr(pliki) {
  if (pliki.length <= PROG_PLIKOW_PR) return null
  const grupy = {}
  for (const p of pliki) {
    const s = p.split('/')
    const k = s.length > 2 ? `${s[0]}/${s[1]}` : s.length === 2 ? s[0] : '(korzen)'
    grupy[k] = (grupy[k] || 0) + 1
  }
  const lista = Object.entries(grupy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(', ')
  return `UWAGA: PR ma ${pliki.length} plików (próg ${PROG_PLIKOW_PR}) — bot recenzji takiego PR-a nie obejmie. Propozycja podziału: osobne PR-y per obszar (${lista}).`
}
// ── Koniec archiwum ───────────────────────────────────────────────────────

// smokeStatus liczony w JS (agent archiwizacji nie wie tego lepiej niz orkiestrator):
//   'plik'           = smoke powstal (sciezka w smokeOperatora)
//   'brak-pozycji'   = agent przejrzal zrodla i nie bylo nic do recznego sprawdzenia
//   'agent-null'     = agent padl 2x — pozycje Operator checklist/[Manual] NIE zostaly przeniesione; operator
//                      musi wygenerowac smoke recznie (/dev-docs-complete). To NIE jest "brak pozycji".
//   'nie-uruchomiono' = early return (brak args)
const nazwaZadania = typeof args === 'string' ? args : args && args.nazwaZadania
// Dodatkowe sciezki do commita archiwizacji (autopilot przekazuje wyjscia compound/refresh: solution,
// docs/CONCEPTS.md, docs/learned-patterns.md) — nikt inny ich nie commituje.
const dodatkowePathspec = (args && Array.isArray(args.dodatkowePathspec)) ? args.dodatkowePathspec.filter((x) => typeof x === 'string' && x) : []
if (!nazwaZadania) {
  return { archiwum: '', pliki: [], rezultaty: ['BLAD: brak args {nazwaZadania}'], commit: '', uwagi: [], smokeOperatora: '', smokeStatus: 'nie-uruchomiono' }
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
4. Otwarte wpisy z docs/active/${nazwaZadania}/known-issues.md (jesli plik istnieje) i otwarte [P1]/[P2] z
   "## Do poprawy po review fazy N". Z known-issues sekcje "## P3 faza N" pomin — nity zostaja w known-issues
   (opis PR, bot), smoke ich nie sprawdza. "Otwarte" = poza sekcja "## Zamkniete"; gdy sekcji nie ma — pomin wpisy,
   ktore same lub pozniejsza faza oznaczaja jako ZAMKNIETY/naprawione. Z OBU zrodel bierz WYLACZNIE wpisy
   opisujace zachowanie na ekranie/w przegladarce lub flow do recznego przejscia; notatki srodowiskowe, dane
   testowe i pulapki narzedziowe pomin.
4b. Scenariusze [E2E] przeniesione w trakcie runu na [Manual] (srodowisko padlo, limit zewnetrzny, harness, pad testera — automat
   ich nie wykonal): \`node .claude/scripts/e2e/e2e.mjs lista-manual --zadanie docs/active/${nazwaZadania}\` (JSON: pozycje z faza,
   tresc, przyczyna, powod). Sekcja "## E2E do odegrania recznie (srodowisko w trakcie runu)" na poczatku dokumentu, po czerwonych
   flagach z (5): jeden checkbox na pozycje — scenariusz i oczekiwany stan z tresci linii, powod ("<przyczyna>: <powod>").
   To nie jest czerwona flaga: run swiadomie oddal je czlowiekowi. W sekcjach ekranow ich nie powtarzaj.
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
let smoke = await agent(smokePrompt, { schema: SMOKE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `smoke-operatora:${nazwaZadania}` })
if (!smoke) {
  // Jeden retry po null (wzorzec env-up w autopilocie): null to realny, obslugiwany stan agenta, a smoke jest
  // JEDYNYM kanalem, ktorym Operator checklist/[Manual] docieraja do czlowieka — bez retry cicho gina.
  log('Smoke operatora: agent zwrocil null — retry raz')
  smoke = await agent(smokePrompt, { schema: SMOKE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `smoke-operatora-retry:${nazwaZadania}` })
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
const pathspec = pathspecArchiwum(nazwaZadania, smokeStatus === 'plik' ? smokePlik : '', dodatkowePathspec)
const komunikat = komunikatArchiwum(nazwaZadania)

phase('Archiwizacja')
const wynik = await agent(
  `Jestes specjalista ds. zamykania zadan. Wykonaj procedure ze skilla .claude/skills/dev-docs-complete/SKILL.md
dla zadania: ${nazwaZadania}.

${smokeInfo}

Kroki (zgodnie ze skillem):
1. Zlokalizuj docs/active/${nazwaZadania}/.
2. Zweryfikuj ukonczenie (czytaj *-zadania.md wg puli z kroku 2 skilla). Jesli zostaly nieukonczone — i tak archiwizuj (tryb autopilota), ale wypisz je w rezultaty.
3. Wyciagnij kluczowe wnioski z *-kontekst.md.
3a. Mapa funkcji (przed krokiem 4 — skrypt czyta plan zadania z docs/active/):
   \`node .claude/scripts/e2e/e2e.mjs mapa --zadanie docs/active/${nazwaZadania}\`. JSON z \`pominieto\` (projekt bez skilla
   weryfikacji), z \`dodane\`/\`zaktualizowane\` (flow dopisane do ${MAPA_FUNKCJI}) albo kod 1 z \`blad\` — w kazdym przypadku
   jedna linia w rezultaty i archiwizacja idzie dalej.
4. Przenies wszystkie pliki poza *.bak do docs/completed/${nazwaZadania}/ przez zwykle \`mv\` (NIE \`git mv\`, NIE \`git rm\` —
   pathspec w kroku 8 zaklada, ze wpisy docs/active/ sa nadal w indeksie) + dodaj ${nazwaZadania}-podsumowanie.md
   (data ukonczenia, co dostarczono, kluczowe decyzje, glowne pliki, wnioski${podsumowanieSmoke}).
   Pliki *.bak to kopie robocze operatora: zostaja w docs/active/${nazwaZadania}/, wypisz je w rezultaty.
5. Jesli wsrod przenoszonych plikow jest .autopilot-state.json: ustaw w nim "complete": "done"
   (stempel archiwizacji — orkiestrator celowo nie zapisuje stanu po przeniesieniu folderu,
   wiec bez stempla archiwum klamaloby ze complete jest pending).
6. Nie edytuj CLAUDE.md ani .claude/rules/ — CLAUDE.md uzgadnia sie z kodem po merge'u pull requesta, a reguly
   zapisal juz compound. Decyzje zadania ida do pliku z kroku 6a.
6a. Plik decyzji (krok 6a skilla): docs/decisions/<data>-${nazwaZadania}.md (data z \`date +%F\`, \`mkdir -p docs/decisions\`),
   zaczynajacy sie dokladnie od frontmattera (z data wstawiona w miejsce znacznika):
${szkieletDecyzji(nazwaZadania)}   Tresc: sekcje "## Decyzje" i "## Do CLAUDE.md po merge'u" wg skilla, zrodlo — sekcja "## Dziennik" w *-kontekst.md.
   Na koniec docs/decisions/README.md dopisz jedna linie indeksu wg skilla (brak pliku — utworz go z naglowkiem ze skilla).
   Odczytaj pole z dysku: \`grep -m1 '^claude_md:' <plik>\` -> decyzje.claudeMd (sama wartosc), decyzje.plik = sciezka.
7. Usun katalog docs/active/${nazwaZadania}/, jesli jest pusty (zostaly w nim *.bak — zostaw go).
8. Zacommituj archiwizacje. Pathspec do git add (NIC poza tym, zadnego git add -A):
   ${pathspec}
   PRZED git add: dla kazdej sciezki z listy (poza wpisem ':(exclude…)') sprawdz, ze istnieje na dysku (\`test -e\`) LUB jest w indeksie
   (\`git ls-files <sciezka> | grep -q .\`); sciezke, ktora nie spelnia zadnego warunku, POMIN i opisz w rezultaty
   (nieistniejacy pathspec = fatal i git add nie stage'uje NICZEGO). Pomin tez sciezke ignorowana przez git
   (\`git check-ignore -q <sciezka>\` = 0, np. .claude/ w .gitignore projektu) — git add konczy sie wtedy kodem 1. Jesli docs/active/${nazwaZadania} nie ma juz
   w indeksie (uzyles git mv wbrew krokowi 4) — pomin te sciezke, rename'y sa juz zestage'owane.
   SIATKA BEZPIECZENSTWA: sprawdz \`git status --porcelain\` i jesli wisza niezacommitowane
   artefakty bazy wiedzy — docs/solutions/, docs/CONCEPTS.md, docs/learned-patterns.md
   — dolacz je do TEGO commita (compound albo compound-refresh nie domknal swojego commita);
   takze tutaj dodawaj wylacznie sciezki istniejace na dysku lub w indeksie.
   Powod: dwa runy z rzedu zostawily te pliki w drzewie, a brudne drzewo blokuje bramke bootstrapu
   nastepnego runu autopilota (STOP "niezacommitowane zmiany").
   Commit: \`git commit -m "${komunikat}"\` — temat dokladnie taki, w jednej linii; stopke (np. Co-Authored-By) dopisujesz
   wylacznie drugim \`-m\` (git oddzieli ja pusta linia). Sprawdz \`git log -1 --format=%s\` = "${komunikat}".
   Jesli git commit nie powiedzie sie lub nie ma zmian — zwroc commit: "" i opisz powod w rezultaty (nie przerywaj archiwizacji).
9. Pliki PR-a: \`git diff --name-only "$(git merge-base HEAD main)" HEAD\` (brak galezi main -> master; brak obu -> []) -> plikiPr[].

NIE uruchamiaj /dev-compound (zrobi to orkiestrator). Dzialaj autonomicznie.
Zwroc obiekt zgodny ze schematem CompleteResult (commit = hash z kroku 8 lub "").`,
  { schema: COMPLETE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `complete:${nazwaZadania}` }
)
if (!wynik) {
  return { archiwum: '', pliki: [], rezultaty: ['BLAD: agent archiwizacji zwrocil null'], commit: '', uwagi: [], smokeOperatora: smokePlik, smokeStatus }
}

// Uwagi archiwizacji liczone w JS: brak pliku decyzji psuje krok CLAUDE.md po merge'u, a PR ponad progiem omija bot.
const uwagaPr = bramkaRozmiaruPr(wynik.plikiPr || [])
const uwagi = [sprawdzDecyzje(wynik.decyzje, nazwaZadania), uwagaPr].filter(Boolean)
for (const u of uwagi) log(u)
if (uwagaPr && wynik.commit) {
  const dopisek = await agent(
    `Dopisz na koncu pliku docs/completed/${nazwaZadania}/${nazwaZadania}-podsumowanie.md sekcje (tresc 1:1):

## Rozmiar PR — uwaga

${uwagaPr}

Potem \`git add docs/completed/${nazwaZadania}/${nazwaZadania}-podsumowanie.md\` i \`git commit -m "docs(${nazwaZadania}): rozmiar PR w podsumowaniu"\`
(stopka tylko drugim \`-m\`). Nic poza tym nie zmieniaj. Zwroc {zapisano, commit} (commit = krotki hash albo "").`,
    { schema: DOPISEK_RESULT, agentType: 'klasa-mechaniczny', label: `complete:uwaga-pr:${nazwaZadania}` }
  )
  if (!dopisek || !dopisek.zapisano) log('UWAGA: sekcja o rozmiarze PR nie trafila do podsumowania — jest w wyniku runu')
}
return { ...wynik, uwagi, smokeOperatora: smokePlik, smokeStatus }
