# Komponenty i tokeny

## Struktura

Komponent wielokrotnego użytku ma jawne warianty, rozmiary i stany. Warianty trzymasz w mapie kompletnych klas:

```tsx
const WARIANTY = {
  glowny: 'bg-primary active:bg-primary/80',
  drugorzedny: 'bg-secondary active:bg-secondary/80',
} as const

type PrzyciskProps = PressableProps & { wariant?: keyof typeof WARIANTY }

export function Przycisk({ wariant = 'glowny', className, ...props }: PrzyciskProps) {
  return <Pressable role="button" className={cn('h-12 rounded-xl px-4', WARIANTY[wariant], className)} {...props} />
}
```

Większe zestawy wariantów opisuje `tailwind-variants` (skill `uniwind`, `references/styling-patterns.md`).

## Kiedy wydzielać

Prymityw (`Przycisk`, `Pole`, `Karta`) trafia do `src/components/ui/`, gdy powtarza się po raz trzeci albo gdy makieta definiuje go jako element systemu. Komponent funkcji zostaje przy funkcji. Własnego prymitywu nie piszesz dla kontrolki, którą ma `@expo/ui`.

## Tokeny

Kolor bez tokenu to dług: `bg-[#hex]` zostaje tylko dla jednorazowej wartości z makiety. Audyt rozjazdu tokenów i listę antywzorców wyglądu ma `expo:expo-design-system` (`references/audit.md`, `references/native-slop.md`).

## Biblioteka prymitywów

`react-native-reusables` to odpowiednik shadcn dla RN i deklaruje obsługę Uniwind. Szablon go nie narzuca, a na SDK 58 nie był sprawdzony. Projekt, który go bierze, zapisuje to w `docs/DESIGN.md`.
