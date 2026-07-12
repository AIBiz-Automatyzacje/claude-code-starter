---
name: dev-docs-complete
description: "Archiwizacja ukończonego zadania i wyciągnięcie kluczowych wniosków."
argument-hint: "[nazwa zadania z docs/active/]"
---

Jesteś specjalistą ds. zamykania zadań. Zarchiwizuj i udokumentuj ukończone zadanie: $ARGUMENTS

## Instrukcje

1. **Zlokalizuj zadanie** w `docs/active/$ARGUMENTS/`
   - Jeśli nie znaleziono, wylistuj dostępne zadania w `docs/active/` i poproś o wyjaśnienie

2. **Zweryfikuj ukończenie**:
   - Przeczytaj `[zadanie]-zadania.md` i sprawdź czy wszystkie zadania są oznaczone jako ukończone
   - Jeśli pozostały nieukończone zadania, wylistuj je i zapytaj: "Archiwizować mimo to czy kontynuować pracę?"

3. **Wyciągnij kluczowe wnioski** z `[zadanie]-kontekst.md`:
   - Decyzje architektoniczne warte zachowania
   - Odkryte lub ustalone wzorce
   - Napotkane pułapki/przypadki brzegowe
   - Dodane zależności

4. **Utwórz podsumowanie ukończenia** w `docs/completed/$ARGUMENTS/`:
   - Przenieś wszystkie trzy pliki z `docs/active/$ARGUMENTS/`
   - Dodaj `[zadanie]-podsumowanie.md` zawierający:
     - Data ukończenia
     - Co zostało dostarczone
     - Podjęte kluczowe decyzje (krótko)
     - Utworzone/zmodyfikowane pliki (główne)
     - Wyciągnięte wnioski

5. **Zaktualizuj dokumentację projektu** (jeśli istotne):
   - Dopisz decyzje architektoniczne do `CLAUDE.md`
   - Jeśli odkryto wzorce warte utrwalenia — dodaj regułę do `.claude/rules/learned-patterns.md` (utwórz plik, jeśli nie istnieje) lub zaktualizuj `CLAUDE.md`.

5.5 **Sugestia dokumentowania problemów:**
   - Jeśli podczas pracy napotkano nietrywialne problemy warte udokumentowania:
   - Zapytaj: "Czy chcesz udokumentować rozwiązane problemy? Uruchom `/dev-compound`"

6. **Posprzątaj**:
   - Usuń pusty katalog `docs/active/$ARGUMENTS/`
   - Potwierdź ukończenie użytkownikowi

## Format wyjściowy
```
✅ Zadanie "$ARGUMENTS" zarchiwizowane

📁 Przeniesiono do: docs/completed/$ARGUMENTS/
📄 Pliki: plan.md, kontekst.md, zadania.md, podsumowanie.md

📝 Zaktualizowana dokumentacja:
   - [lista co gdzie dodano, lub "Nie wymagane"]

🎯 Kluczowe rezultaty:
   - [krótkie punkty co zostało dostarczone]

💡 Rozwiązane problemy warte udokumentowania?
   → /dev-compound do zapisu rozwiązania
```