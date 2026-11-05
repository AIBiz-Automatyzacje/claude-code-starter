# dev-plan — fragmenty stacku Expo (React Native + Maestro + Supabase)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Routing builderów i scenariusze E2E są we wspólnych slotach
`.claude/stack/buildery.md` i `.claude/stack/plan-e2e.md`; tu leży to, czego używa tylko planowanie.

## Przygotowanie operatora

- Klucze klienta (publiczne, trafiają do paczki): `EXPO_PUBLIC_*`.
- Assety i treści: ikona i splash w `app.json` z wymogami sklepów, ilustracje stanów pustych; IU z assetami pracują w `assets/`.
- Konta i konsole, gdy plan ich używa: Apple Developer, App Store Connect, Play Console, RevenueCat, Firebase/FCM. Kolejność ma znaczenie:
  App ID przed capability push, a SHA-1 dla Google Sign-In dopiero z builda.
- Fizyczne urządzenie do haptyki, biometrii i push to `Operator checklist`: nie blokuje startu.
- Środowisko E2E: Metro i dev-client stawia adapter. Dowód działania: `node .claude/scripts/e2e/e2e.mjs start` kończy się statusem `gotowe`,
  a canary `.maestro/_canary.yaml` przechodzi logowanie kontem `E2E_TEST_EMAIL`.
