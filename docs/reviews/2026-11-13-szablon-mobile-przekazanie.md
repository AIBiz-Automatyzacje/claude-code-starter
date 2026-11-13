# Szablon mobile — przekazanie kontekstu (2026-11-13)

Zapis na koniec sesji, która domknęła pilot i plan szablonu mobile z rdzenia. Nowa sesja zaczyna od tego pliku.

## Stan

- **Plan** `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`: Etapy 0–5 zamknięte. Etap 4 (pilot) — 5 runów na
  kopii Nawykometru, run 5 bez STOP-u od planu do zmergowanego PR. Etap 5 — `stacks/expo/SWIEZOSC.md` i `stacks/expo/swiezosc.mjs`.
- **Szablon** (`AIBiz-Automatyzacje/claude-code-starter`): `main` = `origin/main` = `a14b64c` (merge `popr/po-pilocie-usterki`),
  CI `maszyneria` zielone (run `43469982211`).
- **Repo mobile** (`AIBiz-Automatyzacje/workspace-template-mobile`): `main` = `e6dfb5d` (`sync: rdzeń a14b64c…`), strażnik zielony.
- **Automat publikacji włączony** (decyzja operatora 2026-11-13): każda zmiana `.claude/`, `stacks/`, `output-styles/` na `main`
  po zielonej `maszynerii` trafia do repo mobile sama (`.github/workflows/publikuj-mobile.yml`). Wyłączenie: `false &&` na początku
  gałęzi `workflow_run` w warunku joba. Dotychczasowe przebiegi automatu: `43455138738`, `43470294424` — oba zielone.
- **Bramki na `a14b64c`:** `pnpm -s test` 1985/1985, typecheck 0, lint 0, `node stacks/testuj-wariant.mjs expo` 1493/1495
  (2 pominięte), także bez Maestro w `PATH`.
- **Maestro na maszynie operatora:** 2.12.1 (zaktualizowane 2026-11-13; cały pilot szedł na 2.5.1).

## Dokumenty

- Wnioski pilota W1–W37 ze statusami: `docs/reviews/2026-11-pilot-nawykometr-wnioski.md`.
- Analiza runu 4 i wynik runu 5 (sekcja 5): `docs/reviews/2026-11-13-pilot-run4-analiza.md`.
- Materiał wejściowy analizy: `docs/reviews/2026-11-13-pilot-run4-do-analizy.md`.
- Publikacja i deploy key: `stacks/expo/PUBLIKACJA.md`. Świeżość źródeł: `stacks/expo/SWIEZOSC.md`.
- Lokalna notatka źródeł (gitignored, tylko na tej maszynie): `ZRODLA-SZABLONU.md`, wpisy 5 i 6 (expo/skills, Uniwind).

## Środowisko pilota (zostaje do decyzji o sprzątaniu)

| Element | Stan |
|---|---|
| Kopia `../_pilot-mobile/Nawykometr-kopia` | `main` `79d3608`, o 1 commit przed `origin/main` (`d22c9a7`) — commit etapu `claude-md` z `--bez-push`, celowo niewypchnięty (dowód W35). Maszyneria `9794dfb`, bez poprawek z `a14b64c` (wymaga `/sync-template`). |
| Repo testowe `AIBiz-Automatyzacje/nawykometr-kopia-pilot` | prywatne, PR #1 i #2 zmergowane; `origin` kopii. Zdalne `nawykometr-lokalny` = `../Nawykometr` z `pushurl` `BRAK`. |
| Lokalny Supabase kopii | 11 kontenerów `supabase_*_nawykometr-kopia` (porty 54321/54322) |
| Symulator „Nawykometr-kopia” | UDID `928F81C8-13E6-43A6-9305-A5C640A0C466` |
| Marketplace `claude-code-starter` | dodany w Claude Code (plugin `expo@claude-code-starter`) |
| Gałęzie szablonu | `popr/pilot-run4-kopie-repo-testowe`, `popr/pilot-run5-usterki`, `popr/po-pilocie-usterki` (zmergowane), `popr/e2e-ekran`, `claude/popr-dev-plan-spojnosc-8e8d8d` (innych sesji) |
| Worktree | `.claude/worktrees/plan-szablon-mobile` (`popr/po-pilocie-usterki`) |

Zasady operatora, które dalej obowiązują: szablon testujemy wyłącznie na kopiach (prawdziwy Nawykometr, `gramywpadla`, `vibersi`
— bez syncu, gałęzi, baz i `.claude/`); bez EAS, nowych kont i zdalnych baz; w shellu operatora są prawdziwe `SUPABASE_ACCESS_TOKEN`
i `EXPO_TOKEN` — komendy `supabase`/`expo` w kopii z `env -u SUPABASE_ACCESS_TOKEN -u EXPO_TOKEN`; merge i push do `main` szablonu
tylko za zgodą operatora (od włączenia automatu merge = publikacja do repo mobile).

## Co zostało

1. **Run 6 na kopii (rekomendowany jako pierwszy).** `/sync-template` kopii do `e6dfb5d`, jedno małe zadanie z `[E2E]` na iOS
   z Maestro 2.12.1. Sprawdza na żywo poprawki, które w runie 5 nie wystąpiły albo przyszły po nim: doctor (tokeny kont, własny
   ESLint, advisors przy bazie lokalnej), smoke z bazą lokalną, P3 E2E w `known-issues`, canary z nowym Maestro (czas w wyniku),
   komunikat STOP-u przy żywym środowisku, bramka natywna z paczkami zagnieżdżonymi. Przed syncem: wypchnąć albo porzucić commit
   `79d3608` w kopii (bramka czystości `/dev-pr` liczy rozjazd z `origin`).
2. **Decyzja: Android.** Cały pilot na symulatorze iOS. Albo run na emulatorze Androida (adapter wspiera `android`, nigdy nie
   uruchomiony na żywo), albo zapis w README repo mobile „najpierw iOS”.
3. **Decyzje otwarte z wniosków:** W13 (próg 360 linii w projekcie z już dużymi plikami: tylko nowe pliki albo przyrost),
   W30 (stopka `Co-Authored-By` z modelem agenta workflowu w commitach mechanicznych). W27 bez zmian (decyzja operatora).
   W20 (koszt runu) — obserwacja, bez zmiany. Stary defekt D5 (`stan:zapis` odmawia nadpisania) — niska waga, nieruszany.
4. **Niesprawdzone na żywo:** recenzja z botem CodeRabbit (instalacja aplikacji GitHub przez admina i warunki cenowe dla repo
   prywatnych), merge z działającym CI, PR wieloczęściowy (`--czesc`), `--bez-merge`, limit canary z ubiciem potomków i ponowienie
   przy „Failed to connect” (W37 — nie wystąpiły), treść STOP-u przy limicie (W36), bramka spójności w autopilocie w wariancie
   czerwonym, twarda blokada pushu w `--bez-push` (świadomie bez niej: zakaz w poleceniu + niezależny pomiar).
5. **Plugin `expo`:** zostaje na `a9e5bd3` (1.14.3). Upstream 1.15.1 kieruje komendy przez `npx --yes @expo/agent-cli@latest`,
   zablokowane w `permissions.deny`. Wrócić, gdy agent-cli wyjdzie z fazy eksperymentalnej (`node stacks/expo/swiezosc.mjs`).
6. **Opcjonalnie:** „makieta obok aplikacji” dla mobile (zrzut z symulatora obok makiety; dziś punkty wizualne ręcznie).
7. **Sprzątanie po pilocie (każde osobno, za zgodą):** repo testowe `nawykometr-kopia-pilot`, `claude plugin marketplace remove
   claude-code-starter` (uwaga: usuwa też plugin `expo` z projektów, które go używają), kontenery i wolumeny
   `supabase_*_nawykometr-kopia`, symulator „Nawykometr-kopia”, katalog `../_pilot-mobile`, gałęzie `popr/pilot-*` i
   `popr/po-pilocie-usterki`, worktree `.claude/worktrees/plan-szablon-mobile`. Sprzątanie po runie 6 i decyzji o Androidzie,
   bo oba potrzebują kopii.
