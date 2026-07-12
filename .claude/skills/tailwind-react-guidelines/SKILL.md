---
name: tailwind-react-guidelines
description: Frontend React 19 + TypeScript 5.7+ + TailwindCSS v4 + shadcn/ui dla Vite SPA. Komponenty, React Query, formularze (RHF + Zod), testowanie (Vitest + RTL + MSW), lazy loading, Suspense, Sonner. Używaj przy tworzeniu komponentów, stron, stylowaniu, data fetchingu, formularzach, testach, optymalizacji.
paths:
  - "**/*.tsx"
  - "**/*.css"
  - "src/**/*.ts"
  - "vite.config.*"
  - "vitest.config.*"
---

# Tailwind React Guidelines

## Cel

Przewodnik dla Vite + React 19 SPA - nowoczesny stack zgodny ze standardami Marzec 2026.

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

## Quick Start Checklist

### Nowy Komponent
- [ ] TypeScript interface dla props
- [ ] Funkcja (nie `React.FC`)
- [ ] Ref jako prop (nie forwardRef) - React 19
- [ ] Import aliasy: `@/components`, `@/lib`, `@/hooks`
- [ ] TailwindCSS utility classes
- [ ] Default export na dole (dla lazy loading)

### Memoizacja
- [ ] **React Compiler 1.0 (rekomendowany):** Nie używaj useCallback/useMemo - Compiler optymalizuje automatycznie
- [ ] **Bez React Compiler:** useCallback tylko gdy przekazujesz handler do `memo()` child

### Data Fetching
- [ ] React Query (`useQuery`, `useMutation`) - nie useEffect
- [ ] `useSuspenseQuery` dla Suspense-based data fetching (data zawsze zdefiniowane)
- [ ] `queryOptions()` helper dla reużywalnych query configs
- [ ] Early returns: loading → error → empty → data
- [ ] `toast.promise()` dla feedback użytkownika

### Formularze
- [ ] React Hook Form + Zod (`zodResolver`) — złożone formularze
- [ ] `useActionState` (React 19) — proste formularze bez RHF
- [ ] `aria-invalid` i `aria-describedby` dla a11y
- [ ] `useMutation` dla submit

### Nowa Strona
- [ ] Lazy load: `const Page = lazy(() => import('@/pages/Page'))`
- [ ] Suspense wrapper z fallback
- [ ] Error Boundary (react-error-boundary)
- [ ] Route w App.tsx

---

## Import Aliasy

| Alias | Ścieżka | Przykład |
|-------|---------|----------|
| `@/` | `src/` | `import { api } from '@/lib/api'` |
| `@/components` | `src/components` | `import { Button } from '@/components/ui/button'` |
| `@/hooks` | `src/hooks` | `import { useTemplates } from '@/hooks/useTemplates'` |
| `@/lib` | `src/lib` | `import { cn } from '@/lib/utils'` |
| `@/test` | `src/test` | `import { render } from '@/test/utils'` |

Zdefiniowane w: `vite.config.ts` i `tsconfig.json`

---

## Topic Guides

### Wzorce Komponentów
React 19 patterns, ref jako prop (nie forwardRef), Error Boundaries z react-error-boundary.
**[Pełny przewodnik: resources/component-patterns.md](resources/component-patterns.md)**

---

### Stylowanie z TailwindCSS
Tailwind v4 (CSS-first config z `@theme`), OKLCH colors, container queries, shadcn/ui, `cn()` dla kompozycji.
**[Pełny przewodnik: resources/styling-guide.md](resources/styling-guide.md)**

---

### Organizacja Plików i Routing
```
src/
  components/
    ui/              # shadcn/ui primitives
    [Feature].tsx    # Komponenty aplikacji
  pages/             # Route-level components
  hooks/             # React Query hooks
  lib/               # api.ts, utils.ts, queryClient.ts
  types/             # TypeScript types
  test/              # Setup, utils, mocks
```
Protected routes, useSearchParams, nested routes.
**[Pełny przewodnik: resources/file-organization.md](resources/file-organization.md)**

---

### Formularze
React Hook Form + Zod, walidacja client-side, kontrolowane komponenty, multi-step wizardy, upload plików.
**[Pełny przewodnik: resources/forms.md](resources/forms.md)**

---

### Stany Ładowania i Błędów

**Suspense dla lazy-loaded components:**
```typescript
<Suspense fallback={<LoadingOverlay />}>
    <LazyComponent />
</Suspense>
```

**Early returns dla data fetching (React Query):**
```typescript
const { data, isLoading, error } = useTemplates();

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data?.length) return <EmptyState />;

return <TemplateList data={data} />;
```

**[Pełny przewodnik: resources/loading-and-error-states.md](resources/loading-and-error-states.md)**

---

### Testowanie
Vitest + React Testing Library + MSW v2. Testy komponentów, hooków React Query, formularzy, a11y.
**[Pełny przewodnik: resources/testing.md](resources/testing.md)**

---

### Wydajność
React Compiler 1.0 (rekomendowany), React Query caching, useTransition, useOptimistic, lazy loading.
**[Pełny przewodnik: resources/performance.md](resources/performance.md)**

---

### TypeScript Standards
Strict mode, `moduleResolution: "bundler"`, inline type imports, `satisfies` operator, Zod dla runtime validation.
**[Pełny przewodnik: resources/typescript-standards.md](resources/typescript-standards.md)**

---

## Główne Zasady 2026

1. **React Query dla data fetchingu** - nie useEffect; `useSuspenseQuery` dla Suspense
2. **React Hook Form + Zod dla formularzy** - `useActionState` dla prostych; nie useState
3. **React Compiler 1.0** - standardowo włączony; bez Compiler: memoizacja tylko dla memo children
4. **Suspense dla lazy components** - nie dla data (React Query obsługuje)
5. **Tailwind v4** - konfiguracja w CSS (`@theme`), OKLCH colors
6. **TypeScript strict** - no `any`, Zod dla runtime validation
7. **Error Boundaries** - react-error-boundary dla unexpected errors
8. **Sonner dla toasts** - `toast.success()`, `toast.promise()`
9. **Vitest + RTL + MSW dla testów** - behavioral testing, MemoryRouter
10. **Logger dla błędów** - `logger.error()` (production-safe)

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Stworzyć komponent | [component-patterns.md](resources/component-patterns.md) |
| Stylować z Tailwind v4 | [styling-guide.md](resources/styling-guide.md) |
| Organizować pliki, routing | [file-organization.md](resources/file-organization.md) |
| Formularze (RHF + Zod) | [forms.md](resources/forms.md) |
| Obsłużyć loading/błędy | [loading-and-error-states.md](resources/loading-and-error-states.md) |
| Testować (Vitest + RTL + MSW) | [testing.md](resources/testing.md) |
| Optymalizować | [performance.md](resources/performance.md) |
| TypeScript patterns | [typescript-standards.md](resources/typescript-standards.md) |