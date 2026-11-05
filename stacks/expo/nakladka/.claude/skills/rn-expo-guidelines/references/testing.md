# Testy

Runner: jest-expo + RNTL 14 + Jest 30, jedyna ścieżka wspierana przez Expo na SDK 58. Konfiguracja Jest i rozgrzewka: `.claude/stack/walidacja.md`.

## Komponent

```tsx
test('dodaje punkt po naciśnięciu', async () => {
  await render(<Licznik />)
  await fireEvent.press(screen.getByRole('button', { name: 'Dodaj' }))
  expect(screen.getByText('Punkty: 1')).toBeOnTheScreen()
})
```

W RNTL 14 `render` i `fireEvent` są asynchroniczne, tak samo jak `renderRouter`.

## Nawigacja

```tsx
import { renderRouter, screen, testRouter } from 'expo-router/testing-library'

test('przechodzi do profilu', async () => {
  await renderRouter({ index: EkranGlowny, 'profil/[id]': EkranProfilu })
  await testRouter.push('/profil/42')
  expect(screen).toHavePathname('/profil/42')
  expect(screen).toHaveSearchParams({ id: '42' })
})
```

Prawdziwy katalog tras ładuje `renderRouter('./src/app')`, a start na trasie daje opcja `{ initialUrl }`.

Przy `experiments.typedRoutes: true` `<Link href>` z fikcyjną trasą nie przechodzi `tsc`, więc w teście nawigujesz przez `testRouter`.

## Miejsce testów

Testy leżą obok plików źródłowych. Wyjątek to katalog tras (`src/app` albo `app`), w którym każdy plik staje się trasą: testy tras idą do `__tests__/`.

## Granica z Maestro

| Test jednostkowy | Maestro |
|---|---|
| Logika, stany komponentu, walidacja, nawigacja w pamięci | Przebieg na urządzeniu: logowanie, deep link, natywny układ, baza e2e |

Jest nie uruchamia natywnego układu, więc nie sprawdzi `lineHeight` w `TextInput` ani safe area. Natywne powierzchnie OS są poza zasięgiem obu: `[Manual]` (`mobile-e2e-maestro`).
