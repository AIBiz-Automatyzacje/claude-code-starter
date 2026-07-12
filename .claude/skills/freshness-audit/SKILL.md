---
name: freshness-audit
description: "Cykliczny audyt aktualności skilli technicznych względem żywej dokumentacji (oficjalne docs, changelogi GitHub, npm registry). Weryfikuje wersje, pinowane paczki i wzorce API z żywych źródeł, nie z pamięci modelu. Używaj przy: „audyt aktualności", „freshness", „czy skille są aktualne", „sprawdź wersje w skillach", „czy Stripe/React/Zod w skillach jest aktualny", przeglądzie przeterminowań w guidelines technicznych."
argument-hint: "[opcjonalnie: lista skilli do zawężenia, np. 'supabase-dev-guidelines security']"
---

# Audyt aktualności skilli technicznych (freshness)

Sprawdza, czy skille techniczne (`tailwind-react-guidelines`, `ux-ui-guidelines`, `supabase-dev-guidelines`, `security`, `sentry-integration` + ich `resources/`) nie przeterminowały się względem **żywej** dokumentacji. Powstał po tym, jak audyt z pamięci modelu (2026-07-06) przegapił Stripe v22 — dlatego tu **każde ustalenie musi pochodzić z URL żywego źródła**, nie z pamięci modelu.

## Wykonanie

1. **Pobierz bieżącą datę** (workflow nie może użyć `Date.now()` — musi ją dostać w `args`):

```
Bash: date +%Y-%m-%d
```

2. **Ustal zakres.** Jeśli użytkownik podał argument (`$1` = lista nazw skilli) — przekaż go jako `skille`, by zawęzić audyt. Bez argumentu workflow audytuje domyślną piątkę skilli technicznych.

3. **URUCHOM workflow** toolem `Workflow` (z datą z kroku 1):

```
Workflow({scriptPath: ".claude/workflows/freshness-audit-wf.js", args: {data}})
```

lub z zawężeniem:

```
Workflow({scriptPath: ".claude/workflows/freshness-audit-wf.js", args: {data, skille: ["supabase-dev-guidelines", "security"]}})
```

**NIE wykonuj procedury ręcznie** — mechanika (inwentaryzacja twierdzeń o świecie → weryfikacja w żywych źródłach przez WebFetch/WebSearch/context7 → adversarial verify P1/P2 → scribe zapisuje raport) żyje w workflow.

## Po zakończeniu

Workflow zwraca `{raport, statystyki, topRozjazdy}`. Streść użytkownikowi:
- **statystyki:** ile technologii i twierdzeń zaudytowano, liczniki rozjazdów P1/P2/P3, ile obalono w verify,
- **top rozjazdy:** najważniejsze P1/P2 (technologia, plik, twierdzenie → stan faktyczny, URL źródła),
- **ścieżkę raportu:** `docs/reviews/freshness-<data>.md`.

Podkreśl, że **workflow niczego nie zmienił w skillach** — tylko zaraportował. Następnie **zaproponuj naniesienie poprawek** z raportu (po akceptacji użytkownika), zaczynając od P1 (generują błędny/zepsuty kod).

## Cykliczność

Skill nadaje się do odpalania **okresowo** (np. raz w miesiącu) — świat się rusza (nowe majory, deprecacje), a skille techniczne cicho się przeterminowują. Regularny audyt łapie przeterminowania, zanim buildery wygenerują na ich podstawie przestarzały kod.
