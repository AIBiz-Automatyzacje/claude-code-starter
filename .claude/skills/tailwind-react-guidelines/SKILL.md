---
name: tailwind-react-guidelines
description: Frontend React 19 + TypeScript + TailwindCSS v4 + shadcn/ui dla Vite SPA. Komponenty, React Query, formularze (RHF + Zod), testowanie (Vitest + RTL + MSW), lazy loading, Suspense, Sonner. Używaj przy tworzeniu komponentów, stron, stylowaniu, data fetchingu, formularzach, testach, optymalizacji.
paths:
  - "**/*.tsx"
  - "**/*.css"
  - "src/**/*.ts"
  - "vite.config.*"
  - "vitest.config.*"
---

# Tailwind React Guidelines

## Cel

Przewodnik dla Vite + React 19 SPA z Tailwind v4 i shadcn/ui. Ten plik to checklisty i zasady stałe; przykłady kodu i szczegóły są w `resources/` (tabela na końcu). Reguły pisania kodu (Async i React, Type safety, Testowanie, Architektura) są w `.claude/rules/coding-rules.md` — tu stoją tylko odwołania do nich.

## Kiedy Używać Tego Skilla

- Tworzenie nowych komponentów React
- Stylowanie z TailwindCSS v4 + shadcn/ui
- Data fetching z React Query
- Formularze z React Hook Form + Zod
- Testowanie z Vitest + React Testing Library + MSW
- Routing z React Router
- Obsługa błędów i loading states
- Optymalizacja wydajności

---

## Checklisty

### Nowy komponent

- [ ] Interfejs TypeScript dla propsów, funkcja zamiast `React.FC`
- [ ] Ref jako zwykły prop (React 19), bez `forwardRef`
- [ ] Importy przez aliasy `@/components`, `@/lib`, `@/hooks`
- [ ] Klasy Tailwind z tokenów projektu, kompozycja przez `cn()`
- [ ] Prymityw z `src/components/ui/` (shadcn/ui), gdy taki istnieje
- [ ] Default export na dole pliku strony ładowanej przez `lazy()`

### Memoizacja

- [ ] Projekt z React Compilerem (`babel-plugin-react-compiler` w package.json i konfiguracji Vite): bez ręcznych `useMemo` i `useCallback` — wyjątek według sekcji Async i React reguł kodu
- [ ] Projekt bez Compilera: `useCallback` dla handlera przekazywanego do komponentu w `memo()`, `useMemo` dla obliczenia, którego koszt pokazał pomiar

### Data fetching

- [ ] React Query (`useQuery`, `useMutation`) zamiast `useEffect`
- [ ] `useSuspenseQuery` dla pobierania pod Suspense (dane zawsze zdefiniowane)
- [ ] `queryOptions()` dla konfiguracji zapytania używanej w kilku miejscach
- [ ] Kolejność gałęzi w widoku: ładowanie → błąd → pusto → dane
- [ ] `toast.promise()` dla informacji zwrotnej o operacji

### Formularze

- [ ] React Hook Form + Zod (`zodResolver`) dla formularzy złożonych
- [ ] `useActionState` dla prostych formularzy bez RHF
- [ ] `aria-invalid` i `aria-describedby` przy polach z błędem
- [ ] Wysyłka przez `useMutation`

### Nowa strona

- [ ] Lazy load: `const Page = lazy(() => import('@/pages/page'))`
- [ ] Suspense z fallbackiem
- [ ] Error Boundary (react-error-boundary)
- [ ] Trasa w konfiguracji routera

---

## Główne zasady

1. **Dane z serwera przez React Query** — `useQuery` i `useMutation` zamiast `useEffect`, bo biblioteka obsługuje cache, ponowienia, unieważnianie i wyścigi odpowiedzi, które ręczny efekt musi odtwarzać sam.
2. **Formularze przez React Hook Form + Zod** — `useActionState` dla prostych, bo jeden schemat Zod waliduje w przeglądarce i typuje dane, a ręczne flagi `useState` rozjeżdżają się ze stanem wysyłki.
3. **Memoizacja według Compilera** — z React Compilerem bez ręcznej memoizacji, bez niego tylko dla dzieci w `memo()` i po pomiarze, bo memoizacja na zapas dokłada zależności, które trzeba utrzymywać.
4. **Suspense dla komponentów ładowanych leniwie** — dane obsługuje React Query, bo Suspense na danych bez `useSuspenseQuery` zostawia stan ładowania w dwóch miejscach.
5. **Tailwind v4 z konfiguracją w CSS** — tokeny w `@theme`, kolory OKLCH, bo zmiana tokenu w jednym miejscu zmienia cały motyw.
6. **TypeScript strict i Zod na granicy** — według sekcji Type safety i Bezpieczeństwo reguł kodu, bo typ nie sprawdza danych, które przyszły z sieci.
7. **Error Boundary dla błędów nieoczekiwanych** — react-error-boundary, bo nieobsłużony wyjątek w renderze odmontowuje całe drzewo.
8. **Sonner dla powiadomień** — `toast.success()`, `toast.promise()`, bo jeden mechanizm daje spójne komunikaty i obsługę czytników ekranu.
9. **Testy przez zachowanie** — Vitest + Testing Library + MSW, `MemoryRouter` dla tras, bo test przez role i nazwy dostępne sprawdza to, co widzi użytkownik.
10. **Błędy przez logger** — `logger.error()` dla błędu nieoczekiwanego, bo logger wysyła zdarzenie do Sentry z kontekstem (skill sentry-integration).

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Stworzyć komponent, Error Boundary | [component-patterns.md](resources/component-patterns.md) |
| Stylować z Tailwind v4, shadcn/ui, `cn()` | [styling-guide.md](resources/styling-guide.md) |
| Organizować pliki, aliasy importów, routing | [file-organization.md](resources/file-organization.md) |
| Formularze (RHF + Zod), wizardy, upload | [forms.md](resources/forms.md) |
| Obsłużyć ładowanie, błędy, puste stany, Suspense | [loading-and-error-states.md](resources/loading-and-error-states.md) |
| Testować (Vitest + RTL + MSW) | [testing.md](resources/testing.md) |
| Optymalizować (Compiler, cache, `useTransition`) | [performance.md](resources/performance.md) |
| Wzorce TypeScript (`satisfies`, importy typów) | [typescript-standards.md](resources/typescript-standards.md) |

Zanim zaczniesz pisać kod tematu, czytasz jego sekcję w przewodniku (nagłówki przez `grep -n '^##'`, potem Read z `offset` i `limit`), bo pliki mają 15–45k znaków, a każdy temat ma pułapki, których nie widać w samym API (ref jako prop zamiast `forwardRef`, `@theme` zamiast `tailwind.config.js` w Tailwind v4, `useSuspenseQuery` bez gałęzi ładowania).
