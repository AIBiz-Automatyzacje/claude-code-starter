---
name: security
description: "Systematyczny audyt bezpieczeństwa dla React 19 + Supabase + Edge Functions. Używaj przy review bezpieczeństwa, przed deployem, przy pracy z auth/authz, walidacją inputów, RLS policies, XSS, OWASP Top 10."
---

# Security Audit

Skill do przeprowadzania systematycznego audytu bezpieczenstwa w projekcie React 19 + Supabase + Edge Functions.

## Kiedy Uzywac

- Review bezpieczenstwa przed deployem na produkcje
- Dodawanie nowych endpointow (API routes, Edge Functions)
- Zmiany w autentykacji lub autoryzacji (auth/authz)
- Tworzenie nowych tabel w bazie danych (RLS policies)
- Praca z danymi uzytkownikow (PII, GDPR)
- Pre-deploy audit po wiekszych zmianach
- Podejrzenie o luke bezpieczenstwa w istniejacym kodzie

---

## Workflow -- 6-skanowy protokol

### Krok 1: Input Validation

Znajdz wszystkie punkty wejscia danych od uzytkownika i zweryfikuj walidacje.

1. **Zmapuj punkty wejscia:**
   - Form actions (React Hook Form + Zod)
   - API routes / Edge Functions (`req.json()`, `req.text()`, query params)
   - URL parameters (React Router `useParams`, `useSearchParams`)
   - File uploads
2. **Sprawdz walidacje Zod** na kazdym punkcie wejscia:
   - Czy schemat Zod istnieje?
   - Czy walidacja jest na granicy systemu (nie glebiej)?
   - Czy typy sa restrykcyjne (`z.string().email()`, nie `z.string()`)?
   - Czy sa limity dlugosci (`z.string().max(500)`)?
3. **Szukaj brakujacej walidacji** -- kazdy `req.json()` bez Zod parse to finding.

### Krok 2: SQL/Query Safety

Supabase query builder jest domyslnie parametryzowany, ale sa pulapki.

1. **Sprawdz wywolania `.rpc()`** -- czy funkcje PostgreSQL nie konkatenuja stringow w SQL
2. **Sprawdz RLS** na kazdej tabeli:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` -- czy jest?
   - Czy sa policies dla SELECT, INSERT, UPDATE, DELETE?
   - Czy policies uzywaja `(SELECT auth.uid())` (nie `auth.email()`)?
3. **Sprawdz filtry** -- czy zapytania `.from()` maja odpowiednie `.eq()`, `.match()`
4. **Sprawdz `.rpc()` z raw SQL** -- szukaj konkatenacji stringow wewnatrz funkcji PostgreSQL

### Krok 3: XSS Detection

React domyslnie escapuje output, ale istnieja wyjatki.

1. **Szukaj niebezpiecznego renderowania HTML** -- kazde uzycie raw HTML injection to potencjalny XSS
2. **Sprawdz user-generated URLs:**
   - `href={userInput}` -- czy jest walidacja protokolu? (`javascript:` protocol attack)
   - `src={userInput}` -- czy jest whitelist domen?
3. **Content Security Policy** -- czy istnieje i czy jest restrykcyjna?
4. **Third-party content** -- czy jest sandboxowany (iframe sandbox)?
5. **Szukaj renderowania raw HTML** z zewnetrznych zrodel (markdown, CMS)

### Krok 4: Auth/Authz Audit

Zmapuj endpointy vs wymagania autoryzacji.

1. **Stworz macierz dostepu:**

| Endpoint / Akcja | Anon | Authenticated | Owner | Admin |
|-------------------|------|---------------|-------|-------|
| GET /posts        | tak  | tak           | tak   | tak   |
| POST /posts       | nie  | tak           | -     | tak   |
| DELETE /posts/:id | nie  | nie           | tak   | tak   |

2. **Zweryfikuj RLS policies** -- czy odzwierciedlaja macierz dostepu
3. **Edge Functions JWT** -- czy kazda chroniona funkcja wywoluje `supabase.auth.getUser()` / `getClaims()`?
4. **Sprawdz `getSession()` vs `getUser()`** -- `getSession()` nie weryfikuje tokena server-side
5. **Sprawdz role-based access** -- rola z `app_metadata` lub tabeli rol, NIGDY z `user_metadata` (edytowalne przez usera); brak hardcoded email/ID
6. **Fail-closed** -- blad sprawdzenia dostepu = odmowa, nigdy przyznanie (A10:2025)

### Krok 5: Sensitive Data Exposure

Szukaj wyciekow danych wrazliwych.

1. **Hardcoded secrets:**
   - Szukaj: API keys, tokeny, hasla w kodzie zrodlowym
   - Sprawdz `.env.example` -- czy nie zawiera prawdziwych wartosci
   - Sprawdz git history -- `git log --diff-filter=A -- "*.env*"`
2. **Dane w logach:**
   - `console.log` / `console.error` z obiektami user/session/error
   - Struktury bledow Supabase wyciekaja info o schemacie DB
3. **Service role key:**
   - Czy `SUPABASE_SERVICE_ROLE_KEY` jest TYLKO w Edge Functions?
   - Czy nie jest w zmiennych `VITE_*`?
4. **PII w Sentry:**
   - Czy `captureException` nie wysyla danych osobowych?
   - Czy `beforeSend` filtruje wrazliwe dane?
5. **Odpowiedzi API:**
   - Czy endpointy nie zwracaja wiecej danych niz potrzeba? (`select('*')` vs `select('id, name')`)

### Krok 6: OWASP Top 10 Compliance

Przejdz kazda kategorie **OWASP Top 10:2025** pod katem naszego stacku. Zwroc uwage na zmiany 2025: SSRF wchloniety do A01, nowe A03 (Software Supply Chain -- m.in. klucz `service_role` dla agentow AI/MCP) i A10 (Mishandling of Exceptional Conditions -- fail-open, wyciek bledow).

Pelne mapowanie kategorii na stack React + Supabase + Edge Functions:
**[Przewodnik: resources/owasp-react-supabase.md](resources/owasp-react-supabase.md)**

---

## Klasyfikacja Findings

```
CRITICAL -- Exploit mozliwy w produkcji, wymaga natychmiastowej naprawy
   Przyklady: RLS wylaczone na tabeli z PII, service_role key na froncie,
   SQL injection w .rpc(), brak auth na endpoincie z danymi

HIGH -- Powazna luka, exploit mozliwy przy okreslonych warunkach
   Przyklady: brak walidacji inputow na Edge Function, XSS przez
   niebezpieczne renderowanie HTML z user content, getSession() do autoryzacji server-side

MEDIUM -- Potencjalne ryzyko, wymaga analizy kontekstu
   Przyklady: brak rate limiting, zbyt szerokie CORS, select('*') zamiast
   konkretnych kolumn, brak CSP headers

LOW -- Hardening, defense-in-depth
   Przyklady: brak Strict-Transport-Security header, outdated dependencies
   bez znanych CVE, brak audit logging dla niekrytycznych operacji
```

---

## Format Raportu

```markdown
## Security Audit Report: [nazwa projektu / scope]

### Executive Summary
[1-3 zdania: ogolna ocena bezpieczenstwa, liczba findings, najwazniejsze ryzyka]

### Findings

#### CRITICAL
1. **[plik:linia]** -- [tytul]
   - Impact: [co moze sie stac]
   - Remediation: [jak naprawic, z przykladem kodu]

#### HIGH
[jak wyzej]

#### MEDIUM
[jak wyzej]

#### LOW
[jak wyzej]

### Risk Matrix

| Kategoria          | Status | Findings |
|--------------------|--------|----------|
| Input Validation   | [OK/WARN/FAIL] | X |
| SQL/Query Safety   | [OK/WARN/FAIL] | X |
| XSS                | [OK/WARN/FAIL] | X |
| Auth/Authz         | [OK/WARN/FAIL] | X |
| Data Exposure      | [OK/WARN/FAIL] | X |
| OWASP Compliance   | [OK/WARN/FAIL] | X |

### Remediation Roadmap
1. [CRITICAL] [opis] -- termin: natychmiast
2. [HIGH] [opis] -- termin: przed deployem
3. [MEDIUM] [opis] -- termin: nastepny sprint
4. [LOW] [opis] -- termin: backlog
```

---

## Zasady

1. **Mysl jak atakujacy** -- zakladaj najgorszy scenariusz, nie optymistyczny
2. **Worst-case scenario** -- kazdy finding opisuj przez pryzmat "co najgorszego moze sie stac"
3. **Zawsze podawaj rozwiazanie** -- finding bez remediation jest bezuzyteczny
4. **Nie dismissuj jako pre-existing** -- istniejace luki sa nadal lukami
5. **Weryfikuj, nie zakladaj** -- "Supabase domyslnie to robi" nie wystarczy, sprawdz konfiguracje
6. **Najmniejsze uprawnienia** -- kazdy komponent powinien miec minimum potrzebnych uprawnien
7. **Defense in depth** -- jedna warstwa ochrony to za malo, waliduj na kazdej granicy
8. **Dokumentuj scope** -- jasno okresl co zostalo sprawdzone, a co nie

---

## Dokumentacja Referencyjna

- **OWASP Top 10 dla naszego stacku** -- `resources/owasp-react-supabase.md`
- **Wzorce auth i bezpieczenstwa** -- `resources/auth-security-patterns.md`
