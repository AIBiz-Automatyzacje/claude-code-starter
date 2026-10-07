# Przygotowanie operatora (dev-plan 3.7 i 5.2b)

Lista rzeczy, których autopilot nie zrobi sam, a bez których przebieg utknie: bramka setupu zatrzyma run albo builder zaimplementuje funkcję bez kluczy i danych. To inna kategoria niż `Operator checklist` w IU: tamta to weryfikacja **po** implementacji, ta — przygotowanie **przed**.

## Co wpisujesz

| Kategoria | Typowe pozycje | Skąd wiesz |
|---|---|---|
| Konta i konsole zewnętrzne | OAuth (Google Cloud), Sentry DSN, Stripe, klucze map, konta w zewnętrznych API | IU z `supabase/functions/`, auth, integracje; `sentry-integration` w Skills in play |
| Sekrety i zmienne środowiskowe | nowe klucze w `.env.local` / `.env.e2e` / `supabase secrets`, `VITE_*` | tabela plików z `.env.example`, Edge Functions czytające `Deno.env` |
| Środowisko E2E | plan z ≥ 1 `[E2E]`, a `ls .env.e2e` nic nie zwraca → pozycja „setup wg `.claude/templates/e2e-env/README.md` (~30 min)” albo świadomy opt-out `[E2E]` → `[Manual]`; z `.env.e2e` nic nie wpisujesz (dev server, migracje i seedy na projekt e2e robi autopilot) | 3.4b, stan repo |
| Assety i treści | favicon, ikony, ilustracje stanów pustych, wideo, teksty prawne, tłumaczenia od klienta | IU w `public/`, `src/assets/`, treści prawne |
| Dane na projekcie głównym | dane wejściowe lub backfill potrzebne buildera do implementacji (np. istniejące rekordy do migracji danych) | IU z migracjami danych |
| Dostępy do implementacji | dashboard Supabase lub Sentry, konto w zewnętrznym API | IU integracyjne |

Nie wpisujesz:

- dostępu do Figmy — rozstrzyga go 1.6 (pobranie się udało albo zapadło „projektujemy z głowy”);
- fizycznego urządzenia do `[Manual]` — to smoke po implementacji, niczego nie blokuje przed startem;
- czynności po zakończeniu zadania (`supabase db push` na dev/prod po merge'u, rollout, monitoring, sprzątanie danych testowych) — te idą do `Operator checklist` IU, która je wywołuje, a stamtąd do smoke'u operatora przy archiwizacji;
- decyzji produktowych czekających na wybór — to bloker planowania z 0.5, nie przygotowanie;
- tego, co autopilot robi sam: typecheck, testy, dev server, migracje i seedy na projekt e2e, `git`.

Każda pozycja jest wykonalna przed fazą, którą blokuje, i ma marker z jednej rodziny: `**[blokuje: planowanie]**` (bez tego dev-plan nie napisze IU) albo `**[blokuje: faza N]**` (bez tego nie ruszy faza N). Bramka gotowości grepuje `^- \[ \].*\[blokuje:` — pozycja zapisana inaczej jest dla niej niewidoczna. `[blokuje: faza 1]` = gotowe przed startem autopilota.

## Delta wobec checklisty z `/dev-prep`

Checklista znaleziona w 0.3 jest dziennikiem ustaleń operatora — uzupełniasz ją narzędziem Edit, bez przepisywania:

- pozycje `[x]` zostają bez zmian (z wartościami i datami);
- pozycje nieodhaczone dostają numer blokowanej fazy przez **podmianę markera**: `**[blokuje: planowanie]**` → `**[blokuje: faza 2]** (IU-3)`; pozycja bez markera dostaje `**[blokuje: faza N]**`; treść zostaje;
- pozycje wynikające z konkretnych IU, których tam nie ma (nowy klucz w `.env.example`, sekret Edge Function, środowisko E2E), dopisujesz do właściwej sekcji („Konta, konsole, sekrety” / „Assety i treści” / nowa „Środowisko E2E”);
- układ sekcji i nagłówek zostają; pod nagłówkiem jedna linia: `Uzupełnione przez /dev-plan YYYY-MM-DD — pozycje z Implementation Units oznaczone numerem blokowanej fazy.` (data z `date +%F`).

## Nowa checklista

Bez checklisty z 0.3: `mkdir -p docs/operator/` i plik `docs/operator/<feature-slug>-przygotowanie.md` (seria checklist o innej konwencji nazw w `docs/operator/` → dopasuj nazwę do serii). Ścieżkę wpisz do `operator_prep:` planu.

```markdown
---
feature_slug: <feature-slug>
origin: <origin planu>
---

# Przygotowanie dla operatora — <Tytuł planu>

Plan: `docs/plans/YYYY-MM-DD-NNN-<type>-<feature-slug>-plan.md` · Utworzono: YYYY-MM-DD
Status: **do zrobienia przed autopilotem** — odhaczaj `[ ]` → `[x]`. `/dev-plan` sprawdza tę listę w bramce gotowości.

Lista rzeczy, których autopilot nie zrobi sam. Każda pozycja ma marker **[blokuje: faza N]** z numerem pierwszej fazy,
która bez niej nie ruszy; `[blokuje: faza 1]` = gotowe przed startem autopilota.

## 1. <Kategoria, np. Konta i konsole zewnętrzne>

- [ ] **<Co zrobić>** — **[blokuje: faza N]** (IU-K)
  - Po co: <co się stanie bez tego>
  - Jak: <gdzie wejść, co kliknąć, jaką wartość skopiować, do jakiej zmiennej>
  - Dowód: <komenda lub obserwacja, np. `grep GOOGLE_CLIENT_ID .env.local` zwraca wartość>

## 2. Środowisko E2E

- [ ] **Postaw środowisko E2E wg `.claude/templates/e2e-env/README.md` (~30 min, jednorazowo)** — **[blokuje: faza 1]** (bramka setupu autopilota)
  - Po co: plan ma N scenariuszy `[E2E]`; bez `.env.e2e` autopilot zatrzyma przebieg przed fazą 1.
  - Jak: README prowadzi przez dedykowany projekt Supabase e2e (nie ref dev/prod), `.env.e2e` z `.env.e2e.example`, wpis do `.gitignore`, konto testowe, tryb `--mode e2e` Vite. Opt-out: `[E2E]` → `[Manual]` w planie.
  - Dowód: `test -f .env.e2e && git check-ignore -q .env.e2e && echo OK` → OK; `<pm> run dev -- --mode e2e --port 5173` startuje, a localhost:5173 loguje się kontem `E2E_TEST_EMAIL`

---
Po odhaczeniu wszystkiego: `plan.mjs gotowosc docs/active/<zadanie>` → autopilot.
```

Sekcję „Środowisko E2E” dodajesz tylko, gdy plan ma `[E2E]`, a `.env.e2e` nie istnieje. Każda pozycja ma trzy pola (Po co / Jak / Dowód); sekrety opisujesz nazwą zmiennej, nigdy wartością; `Operator checklist` z IU tu nie wraca.
