# Kontekst: smoke-autopilot

To zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf (patrz README w
.claude/templates/smoke-autopilot/). Kod jest celowo trywialny — testujemy MECHANIKE
pipeline'u (bootstrap, stan, delegacje, review, gate'y, archiwizacje), nie kod.

## Designerski kontekst

Brak — zadanie nie dotyka UI.

## Decyzje

- Czysta funkcja w src/lib/ (lekki setup testow — smoke ma byc szybki, bez ciezkiego transformu komponentow).
- Zero nowych zaleznosci.

Ostatnia aktualizacja: (uzupelnia pipeline)
