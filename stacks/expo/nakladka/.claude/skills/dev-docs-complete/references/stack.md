# dev-docs-complete — fragmenty stacku Expo (React Native + Maestro)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Wstawki do dokumentu smoke'u operatora, które zależą od stacku;
układ dokumentu, źródła pozycji i hierarchia stanu są w SKILL.md.

## Smoke operatora

- Narzędzie jazdy automatu (nagłówek smoke'u): „<M> scenariuszy E2E w Maestro”.
- Czego automat nie sprawdzi: natywne powierzchnie (Alert, ActionSheet, schowek, wheel picker), haptyka, biometria, powiadomienia
  push, odczucie animacji, czytnik ekranu (VoiceOver, TalkBack). Pozycje wymagające telefonu oznaczasz **[fizyczne urządzenie]**.
- Klasa błędów niewidocznych w testach (przykład do „Dlaczego to nie jest formalność”): `lineHeight` w `TextInput` przesuwa na iOS
  wpisany tekst poniżej środka pola, a Android tego nie pokazuje; Jest nie uruchamia natywnego układu.
- Start aplikacji w sekcji 0: `- [ ] Metro uruchomione (\`npx expo start\`), dev-client aktualny (przebudowany po <data zmiany natywnej>), aplikacja otwiera się na symulatorze`.
- Kontrola przed zapisem sekcji 0: `node .claude/scripts/e2e/expo-swiezosc.mjs`. Bramka natywna biegnie tylko przed testerem fazy ze
  scenariuszami, więc zmiana natywna z ostatniej fazy bez scenariuszy albo z fixa wychodzi dopiero tutaj. Przy `przebudowa: true` pierwszą
  pozycją sekcji 0 jest `- [ ] Przebuduj dev-client: <naprawa>` z powodem z `detal`; datę w pozycji startu aplikacji bierzesz z
  ostatniego commita zmieniającego `package.json`, lockfile albo `app.json`. Przy `ok: false` bez przebudowy (urządzenie wyłączone)
  pierwszą pozycją sekcji 0 jest `- [ ] Włącz urządzenie i sprawdź dev-client (\`node .claude/scripts/e2e/expo-swiezosc.mjs\`): <naprawa>`, bo świeżości nie sprawdzono.
- Warunek środowiskowy, który nie wchodzi do smoke'u: tymczasowy `.env.development.local` z kluczami e2e.

## Punkty wizualne

Punkty wizualne przechodzi operator ręcznie, bez osobnego narzędzia: aplikacji natywnej nie da się osadzić w ramce obok makiety (D2).
Makieta to `visual-diff/<ekran>-figma.png`; zrzut testera, jeśli powstał, to `visual-diff/<ekran>-actual.png`.

- Zdanie przed pierwszym punktem wizualnym smoke'u: „Punkty wizualne przejdziesz ręcznie: ekran na symulatorze obok pliku `visual-diff/<ekran>-figma.png`.”
- Kontrola po zapisie pliku: każdy punkt wizualny ma istniejący `visual-diff/<ekran>-figma.png`; punkt bez pliku poprawiasz albo usuwasz.
