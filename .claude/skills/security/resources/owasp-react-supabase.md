# OWASP Top 10 (2025) — Mapowanie na React + Supabase + Edge Functions

Przewodnik mapujący każdą kategorię **OWASP Top 10:2025** (finalna wersja: styczeń 2026) na konkretne scenariusze, checklisty i wzorce kodu dla stacku React 19 + Supabase + Edge Functions.

**Co zmieniło się względem 2021 (istotne dla nas):**
- **SSRF** nie jest już osobną kategorią — wchłonięty do **A01 Broken Access Control**.
- **Security Misconfiguration** awansuje z #5 na **A02**.
- **A03 Software Supply Chain Failures** — NOWA, szersza kategoria (zastępuje „Vulnerable and Outdated Components").
- **A10 Mishandling of Exceptional Conditions** — NOWA (błędna obsługa błędów, fail-open, wyciek stack trace).
- Injection spada z #3 na **A05**, Insecure Design na **A06**.

---

## A01:2025 — Broken Access Control

Najczęstszy problem bezpieczeństwa (#1 od lat). W naszym stacku manifestuje się głównie przez błędną/brakującą konfigurację RLS, autoryzację na danych edytowalnych przez usera oraz — od 2025 — **SSRF** (traktowany jako obejście kontroli dostępu do zasobów wewnętrznych).

**Scenariusze w naszym stacku:**
- RLS wyłączone na tabeli — każdy z anon key ma pełny dostęp
- Brak policy na operację DELETE — użytkownik może usuwać cudze dane
- `service_role` key w zmiennych `VITE_*` — przeglądarka omija RLS
- Edge Function bez weryfikacji JWT — anonimowy dostęp do chronionych operacji
- Policy oparta na `auth.email()` lub `user_metadata` zamiast `auth.uid()` / `app_metadata`
- **SECURITY DEFINER function z mutowalnym `search_path`** — privilege escalation przez podstawienie schematu
- **SSRF**: Edge Function fetchująca URL od użytkownika → dostęp do metadata endpoint / usług wewnętrznych

**Checklist:**
- [ ] Każda tabela ma `ENABLE ROW LEVEL SECURITY`
- [ ] Policies pokrywają SELECT, INSERT, UPDATE, DELETE
- [ ] Policies używają `(SELECT auth.uid()) = user_id`
- [ ] Autoryzacja NIGDY na `user_metadata` (edytowalne przez usera) — używaj `app_metadata` lub tabeli ról (patrz `auth-security-patterns.md`)
- [ ] `service_role` key NIE jest w zmiennych `VITE_*`
- [ ] Edge Functions weryfikują JWT przez `supabase.auth.getUser()` / `getClaims()`
- [ ] Każda funkcja SECURITY DEFINER ma `SET search_path = ''` i nazwy schematyczne (`public.tabela`)
- [ ] SSRF: walidacja URL + blokada redirectów + blokada adresów wewnętrznych (patrz niżej)
- [ ] Macierz dostępu (kto może co) jest udokumentowana i zweryfikowana

**Dobry wzorzec — RLS własności danych:**
```sql
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_documents"
ON user_documents FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "users_insert_own_documents"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "users_delete_own_documents"
ON user_documents FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

**SECURITY DEFINER — pinuj `search_path` (privilege escalation):**
```sql
-- ŹLE: mutowalny search_path -> atakujący podstawia własny schemat z funkcją "spoofującą"
CREATE FUNCTION public.get_secret() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN (SELECT secret FROM vault); END; $$;

-- DOBRZE: pusty search_path + nazwy w pełni kwalifikowane
CREATE FUNCTION public.get_secret() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''            -- kluczowe
AS $$
BEGIN RETURN (SELECT secret FROM public.vault); END; $$;
```

**SSRF — hardened (2025: część A01):**
```typescript
// Blokuj: metadata endpoint, localhost, sieci prywatne, kodowania IP obchodzące filtr
const ALLOWED_HOSTS = new Set(['api.example.com', 'cdn.example.com']);

function isBlockedHost(host: string): boolean {
    const h = host.toLowerCase();
    if (['localhost', '0.0.0.0', '::1', '[::1]'].includes(h)) return true;
    if (h === '169.254.169.254') return true;                       // cloud metadata
    if (/^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return true; // prywatne
    if (/^(0x|0b|\d{8,})/.test(h)) return true;                     // hex/decimal IP encoding
    if (h.startsWith('[::ffff:') || h.startsWith('[fc') || h.startsWith('[fd')) return true; // IPv6
    return false;
}

Deno.serve(async (req) => {
    const { url } = await req.json();
    let parsed: URL;
    try { parsed = new URL(url); } catch { return new Response('Bad URL', { status: 400 }); }

    if (parsed.protocol !== 'https:') return new Response('Forbidden', { status: 403 });
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return new Response('Forbidden', { status: 403 });
    if (isBlockedHost(parsed.hostname)) return new Response('Forbidden', { status: 403 });

    const res = await fetch(parsed, {
        redirect: 'manual',                         // 302 -> 169.254.169.254 nie przejdzie
        signal: AbortSignal.timeout(5000),
        // NIE przekazuj nagłówka Authorization do zewnętrznego hosta
    });
    if (res.status >= 300 && res.status < 400) return new Response('Redirect blocked', { status: 403 });
    return new Response(res.body);
});
```
> Uwaga: filtr po hostname nie chroni w 100% przed **DNS rebinding** (host rozwiązuje się do IP prywatnego po walidacji). Przy wysokim ryzyku — rozwiąż DNS, zwaliduj IP i pinuj je do połączenia.

---

## A02:2025 — Security Misconfiguration

Awans z #5 (2021). Domyślne lub błędne ustawienia otwierające luki — w naszym stacku najczęściej CORS, brak nagłówków bezpieczeństwa i konfiguracja Supabase Dashboard.

**Scenariusze w naszym stacku:**
- CORS `Access-Control-Allow-Origin: *` na Edge Functions
- Brak Content Security Policy / nagłówków bezpieczeństwa (Vite SPA)
- Redirect URLs / OAuth w Supabase Dashboard nieograniczone do znanych domen
- Debug mode / źródła map / verbose błędy na produkcji
- Zmienne środowiskowe niedopasowane między dev/staging/prod

**Checklist:**
- [ ] CORS ograniczony do konkretnych domen (nie `*`)
- [ ] **CSP dla Vite SPA** z `connect-src` obejmującym domenę Supabase (inaczej klient się nie połączy)
- [ ] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (lub CSP `frame-ancestors 'none'`)
- [ ] `Strict-Transport-Security` na custom domenie
- [ ] Supabase Dashboard: email enumeration protection + leaked-password protection włączone
- [ ] Supabase Dashboard: Redirect URLs ograniczone do znanych domen
- [ ] Brak `console.log` / debug output na produkcji

**CSP dla Vite SPA (ustawiane w nagłówkach hostingu, nie w `<meta>` dla dyrektyw wymagających nagłówka):**
```
Content-Security-Policy:
  default-src 'self';
  connect-src 'self' https://<PROJECT>.supabase.co wss://<PROJECT>.supabase.co https://*.sentry.io;
  img-src 'self' data: https:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  frame-ancestors 'none';
  base-uri 'self'
```
> Vite buduje statyczne assety z hashowanymi nazwami — unikaj `'unsafe-inline'` dla `script-src`. `connect-src` MUSI zawierać REST (`https://…supabase.co`) i Realtime (`wss://…`), inaczej aplikacja nie działa.

**CORS — restrykcyjny:**
```typescript
// _shared/cors.ts
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://myapp.com';
export const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

---

## A03:2025 — Software Supply Chain Failures (NOWA)

Rozszerzenie dawnego „Vulnerable and Outdated Components" o **cały łańcuch dostaw**: zależności, lockfile, rejestry, narzędzia buildu, a dla nas — także **dostęp AI/MCP z kluczem `service_role`**.

**Scenariusze w naszym stacku:**
- Outdated `@supabase/supabase-js` / React z znanymi CVE
- Brak commitowanego lockfile → niereprodukowalny build, ryzyko podmiany wersji
- Niepinowane importy Deno w Edge Functions (`npm:pkg` bez wersji, `https://` bez integrity)
- Typosquatting / złośliwe paczki w `dependencies`
- **Prompt injection przez dane w bazie** przy agentach AI z MCP na `service_role` (udokumentowane 2025) — złośliwy wiersz instruuje agenta do wykonania SQL

**Checklist:**
- [ ] `npm audit` / `bun audit` bez krytycznych luk (w CI)
- [ ] Lockfile (`bun.lockb` / `package-lock.json`) commitowany
- [ ] Importy Deno w Edge Functions **pinowane do wersji** (`npm:stripe@18.x`, nie `npm:stripe`)
- [ ] Dependabot / Renovate skonfigurowany
- [ ] Brak `dependencies`, które powinny być `devDependencies`
- [ ] **Agent AI / MCP NIE dostaje klucza `service_role`** — tylko anon/ograniczony zakres, tryb read-only gdzie się da
- [ ] Weryfikacja źródła paczek przed dodaniem (pobrania, maintainer, data ostatniej publikacji)

```bash
bun audit          # lub: npm audit
bun outdated       # przegląd przestarzałych
```

---

## A04:2025 — Cryptographic Failures

Wycieki danych wrażliwych przez brak/błędne szyfrowanie lub zarządzanie secretami.

**Scenariusze w naszym stacku:**
- Secrets (API keys, `service_role`) commitowane do repozytorium
- PII (email, imię) w logach `console.error` lub payloadach Sentry
- Tokeny w URL query params (widoczne w logach serwera, referer)
- Custom domena bez ważnego SSL

**Checklist:**
- [ ] `.env` / `.env.local` w `.gitignore`; `.env.example` bez wartości
- [ ] Brak secretów w kodzie (szukaj: `sk_`, `secret`, `password`, `token`)
- [ ] `console.*` nie loguje obiektów user/session
- [ ] Sentry `beforeSend` filtruje PII; `sendDefaultPii: false`
- [ ] Tokeny nie w URL query params

```typescript
// DOBRZE: secret server-side, anon key na froncie, log bez PII
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabase = createClient(url, import.meta.env.VITE_SUPABASE_ANON_KEY);
logger.error('Błąd aktualizacji profilu', { userId: user.id, errorCode: error.code });
```

---

## A05:2025 — Injection

SQL injection i XSS — dwa główne wektory. Spadek z #3, ale wciąż krytyczny dla `.rpc()` i renderowania user content.

**Scenariusze w naszym stacku:**
- Konkatenacja stringów w funkcjach PostgreSQL / `EXECUTE format()` bez `%L`
- Niebezpieczne renderowanie raw HTML z user content (XSS)
- User-generated URLs w `href` — `javascript:` protocol injection

**Checklist:**
- [ ] Brak konkatenacji stringów w funkcjach PostgreSQL (parametry `$1`, `$2`)
- [ ] `EXECUTE format(...)` używa `%L` (literal) / `%I` (identifier) dla user input
- [ ] Brak renderowania niesanityzowanego HTML (DOMPurify, gdy konieczne)
- [ ] Walidacja protokołu URL (whitelist `https:`/`http:`)
- [ ] CSP blokuje inline scripts

```sql
-- BEZPIECZNE: parametryzacja / format z %L
RETURN QUERY SELECT * FROM posts WHERE title ILIKE '%' || search_term || '%';
-- lub: EXECUTE format('SELECT * FROM posts WHERE title ILIKE %L', '%' || search_term || '%');
```
```typescript
import DOMPurify from 'dompurify';
function Comment({ content }: { content: string }) {
    const sanitized = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    return <div>{sanitized}</div>;
}
function UserLink({ url }: { url: string }) {
    if (!/^https?:\/\//i.test(url)) return null;          // blokuj javascript:
    return <a href={url} rel="noopener noreferrer">Link</a>;
}
```

---

## A06:2025 — Insecure Design

Brak mechanizmów bezpieczeństwa na poziomie architektury (rate limiting, throttling, limity).

**Scenariusze w naszym stacku:**
- Brak rate limiting na publicznych Edge Functions (brute force, enumeration, DDoS)
- Brak limitu prób logowania / lockout
- Brak limitów rozmiaru inputów / plików

**Checklist:**
- [ ] Rate limiting na publicznych Edge Functions
- [ ] Limit prób logowania (Supabase wbudowany — zweryfikuj konfigurację)
- [ ] Timeout na operacjach (`AbortController`, `statement_timeout`)
- [ ] Limity długości inputów (Zod `.max()`), limity rozmiaru uploadu

```typescript
Deno.serve(async (req) => {
    const origin = req.headers.get('Origin') ?? '';
    if (!allowedOrigins.includes(origin)) return new Response('Forbidden', { status: 403 });

    const parsed = z.object({ email: z.email().max(255) }).safeParse(await req.json());
    if (!parsed.success) return new Response('Bad Request', { status: 400 });
    // + rate limiting przed operacją wrażliwą (np. reset hasła)
    return new Response('OK', { headers: corsHeaders });
});
```

---

## A07:2025 — Authentication Failures

(Przemianowane z „Identification and Authentication Failures".) Słabe mechanizmy autentykacji i zarządzania sesjami.

**Scenariusze w naszym stacku:**
- `getSession()` używane do autoryzacji server-side (token nieweryfikowany)
- Brak MFA / brak weryfikacji AAL w policy dla operacji wrażliwych
- Brak re-autentykacji przed krytycznymi operacjami
- Komunikaty ujawniające istnienie konta

**Checklist:**
- [ ] `getUser()` lub `getClaims()` do autoryzacji server-side (NIE `getSession()`)
- [ ] Minimalna długość hasła ≥ 8 + leaked-password protection (Dashboard)
- [ ] Re-autentykacja przed: zmianą hasła/email, usunięciem konta
- [ ] Generyczne komunikaty błędów logowania
- [ ] OAuth redirect URLs ograniczone do znanych domen

```typescript
// getUser() weryfikuje token z serwerem (getSession() tylko czyta lokalny stan)
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) return new Response('Unauthorized', { status: 401 });
await performCriticalAction(user.id);
```
> **`getClaims()` + asymetryczne JWT signing keys** (ECC/P-256, GA 2025): przy asymetrycznym podpisie `getClaims()` weryfikuje token **lokalnie** (bez round-tripu do Auth), co jest dziś rekomendowanym, szybkim wzorcem w Edge Functions. Przy secrecie symetrycznym `getClaims()` i tak wykona weryfikację zdalną.

---

## A08:2025 — Software or Data Integrity Failures

Brak weryfikacji integralności danych z zewnętrznych źródeł.

**Scenariusze w naszym stacku:**
- Stripe webhook bez weryfikacji sygnatury — fałszywe eventy
- Dopasowanie usera po `email` (mutowalny) zamiast `metadata.user_id`
- Dane z zewnętrznych API użyte bez walidacji Zod

**Checklist:**
- [ ] Stripe webhooks weryfikowane przez `constructEventAsync` z webhook secret
- [ ] Powiązanie usera po **`metadata.user_id`** (UUID), nigdy po email
- [ ] Dane z zewnętrznych API walidowane Zod przed użyciem
- [ ] Brak dynamicznego wykonywania kodu z user input

```typescript
import Stripe from 'npm:stripe@18';                        // pinowana wersja
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    if (event.type === 'checkout.session.completed') {
        const userId = event.data.object.metadata?.user_id;  // NIE email
        if (userId) await activateSubscription(userId);
    }
    return new Response('OK');
});
```

---

## A09:2025 — Security Logging and Alerting Failures

(Rozszerzone o **alerting**.) Brak logowania zdarzeń bezpieczeństwa i brak alertów na incydenty.

**Scenariusze w naszym stacku:**
- Brak audit logu dla krytycznych operacji (usunięcie konta, zmiana uprawnień)
- PII w logach (email, IP, session tokens)
- `console.log` zamiast structured logging
- Brak alertów Sentry na skoki błędów / podejrzaną aktywność

**Checklist:**
- [ ] Audit log dla krytycznych operacji (lista w `supabase-dev-guidelines`)
- [ ] `logger.error()` zamiast `console.error()` na produkcji
- [ ] Logi bez: haseł, tokenów, pełnych obiektów sesji, PII
- [ ] Sentry `beforeSend` filtruje wrażliwe dane
- [ ] **Alerty Sentry** skonfigurowane (spike błędów, nowy typ błędu w auth/płatnościach)

```typescript
logger.error('Login failed', { userId: user?.id, errorCode: error.code });   // bez PII
await supabase.rpc('delete_user_account');   // SECURITY DEFINER loguje do audit_log PRZED usunięciem
```

---

## A10:2025 — Mishandling of Exceptional Conditions (NOWA)

Nowa kategoria: błędna obsługa błędów prowadząca do luk — **fail-open** (błąd = dostęp przyznany), wyciek szczegółów błędu do klienta, ciche połknięcie wyjątków, złe kody statusu.

**Scenariusze w naszym stacku:**
- **Fail-open w autoryzacji**: `try { await checkAccess() } catch { /* przepuszcza */ }`
- Pusty `catch {}` — błąd RLS/auth zignorowany, flow leci dalej
- Wyciek stack trace / błędu Postgres do klienta (ujawnia schemat, nazwy tabel)
- Edge Function zwraca `200` mimo błędu → klient myśli, że operacja się udała
- Nieobsłużone rejection w Promise → isolate pada, stan niespójny

**Checklist:**
- [ ] Autoryzacja **fail-closed** — błąd sprawdzenia = odmowa dostępu, nigdy przyznanie
- [ ] Zero pustych `catch {}` — loguj albo re-throw (patrz `coding-rules` §4)
- [ ] Klient dostaje generyczny komunikat + kod; szczegóły błędu tylko do logu/Sentry
- [ ] Edge Function zwraca poprawny status (4xx/5xx) przy błędzie, nie `200`
- [ ] `Promise.allSettled` dla operacji, które mogą niezależnie failować

```typescript
// ŹLE: fail-open — błąd sprawdzenia przepuszcza użytkownika
try {
    const allowed = await checkAccess(userId, resourceId);
    if (allowed) return resource;
} catch { return resource; }                 // KATASTROFA: błąd = dostęp

// DOBRZE: fail-closed + generyczny błąd dla klienta, szczegóły do logu
try {
    if (!(await checkAccess(userId, resourceId))) {
        return new Response('Forbidden', { status: 403 });
    }
    return new Response(JSON.stringify(resource), { status: 200 });
} catch (err) {
    logger.error('Access check failed', { userId, errorCode: (err as Error).name });
    return new Response('Internal Error', { status: 500 });   // brak stack trace dla klienta
}
```

---

## Podsumowanie — najwyższe ryzyko w stacku React + Supabase + Edge Functions

| Priorytet | Kategoria 2025 | Główne ryzyko w naszym stacku |
|-----------|----------------|-------------------------------|
| 1 | A01 Broken Access Control | RLS wyłączone/błędne, authz na `user_metadata`, SECURITY DEFINER bez `search_path`, SSRF |
| 2 | A07 Authentication Failures | `getSession()` zamiast `getUser()`/`getClaims()` server-side |
| 3 | A02 Security Misconfiguration | CORS `*`, brak CSP z `connect-src` Supabase |
| 4 | A05 Injection | Raw SQL w `.rpc()`, XSS przez user content |
| 5 | A08 Data Integrity | Stripe webhook bez sygnatury / dopasowanie po email |
| 6 | A10 Mishandling of Exceptional Conditions | Fail-open w autoryzacji, wyciek błędów do klienta |

**Zobacz także:**
- [auth-security-patterns.md](auth-security-patterns.md) — wzorce auth, RLS, `app_metadata` vs `user_metadata`
