# dev-plan — fragmenty stacku web (React + Vite + Supabase)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Routing builderów i scenariusze E2E są we wspólnych slotach
`.claude/stack/buildery.md` i `.claude/stack/plan-e2e.md`; tu leży to, czego używa tylko planowanie.

## Przygotowanie operatora

- Klucze klienta (publiczne, trafiają do paczki): `VITE_*`.
- Assety i treści: favicon, ikony, ilustracje stanów pustych; IU z assetami pracują w `public/` i `src/assets/`.
- Środowisko E2E: tryb `--mode e2e` Vite. Dowód działania: `<pm> run dev -- --mode e2e --port 5174` startuje,
  a localhost:5174 loguje się kontem `E2E_TEST_EMAIL`.
