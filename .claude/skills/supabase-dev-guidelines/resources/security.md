# Bezpieczeństwo

Wzorce bezpieczeństwa dla Supabase - RLS, SECURITY DEFINER, audit logging, GDPR compliance.

---

## Row Level Security (RLS)

### Podstawowe Zasady
```sql
-- ZAWSZE włączaj RLS na nowych tabelach
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Bez policies = brak dostępu dla authenticated/anon
-- Tylko service_role ma pełny dostęp
```

> ⚠️ **Autoryzacja NIGDY na `user_metadata`.** `user_metadata` (`raw_user_meta_data`) jest edytowalne przez klienta (`supabase.auth.updateUser({ data: {...} })`) — użycie go w policy = privilege escalation (user podnosi sobie rolę z DevTools). Do ról używaj `app_metadata` (server-side, przez Admin API) lub tabeli ról. Nie używaj też top-level claimu `role` (to zarezerwowana rola Postgres). Pełny wzorzec: skill `security` → `auth-security-patterns.md`.

### Wzorce Policies

#### Publiczny Odczyt
```sql
-- Każdy może czytać (anon + authenticated)
CREATE POLICY "public_read"
ON posts FOR SELECT
TO anon, authenticated
USING (true);
```

#### Dostęp Tylko do Własnych Danych
```sql
-- Użytkownik widzi tylko swoje dane
CREATE POLICY "own_data_select"
ON bookmarks FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Użytkownik może dodawać tylko swoje dane
CREATE POLICY "own_data_insert"
ON bookmarks FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Użytkownik może usuwać tylko swoje dane
CREATE POLICY "own_data_delete"
ON bookmarks FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

#### Warunkowy Dostęp
```sql
-- Publiczne jeśli opublikowane LUB własne
CREATE POLICY "conditional_select"
ON posts FOR SELECT
TO authenticated
USING (
    published = true
    OR (SELECT auth.uid()) = user_id
);
```

#### Brak Modyfikacji (Tylko Service Role)
```sql
-- Tylko service_role może modyfikować
-- Przykład: tabela payments modyfikowana tylko przez webhook

CREATE POLICY "payments_select_own"
ON payments FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);  -- Zawsze UUID, nie email!

-- Brak policies INSERT/UPDATE/DELETE dla authenticated
-- Tylko service_role (Edge Function) może modyfikować
```

---

## SECURITY DEFINER

### Kiedy Używać

SECURITY DEFINER pozwala funkcji działać z uprawnieniami właściciela (zazwyczaj postgres/superuser), omijając RLS.

**Używaj dla:**
- Operacji wymagających dostępu do wielu tabel
- Logiki która musi ominąć RLS
- Funkcji wywoływanych przez trigger
- Wpisów do audit_log

> ⚠️ **`SET search_path = ''` (pusty), nie `= public`.** Funkcja SECURITY DEFINER działa z uprawnieniami właściciela. Jeśli `search_path` zawiera schemat zapisywalny przez atakującego (albo poleganie na domyślnym `public`), może on podstawić własną tabelę/funkcję i przechwycić wykonanie z podniesionymi uprawnieniami (privilege escalation). Pusty `search_path` wymusza rozwiązywanie nazw jednoznacznie — dlatego **wszystkie** obiekty muszą być w pełni kwalifikowane (`public.tabela`, `auth.uid()`).

**Wzorzec:**
```sql
CREATE OR REPLACE FUNCTION public.my_secure_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- Pusty search_path + w pełni kwalifikowane nazwy
AS $$
BEGIN
    -- Sprawdź autentykację
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Logika z pełnymi uprawnieniami
    INSERT INTO public.protected_table ...;
END;
$$;
```

### Widoki a RLS (PostgreSQL 15+)

W PostgreSQL < 15 widoki domyślnie działają jako SECURITY DEFINER (omijają RLS). Od PostgreSQL 15+ możesz użyć `security_invoker = true`:

```sql
-- Widok respektujący RLS (PostgreSQL 15+)
CREATE VIEW public.published_posts
WITH (security_invoker = true)
AS SELECT * FROM posts WHERE published = true;
```

### Przykład: Usuwanie Konta
```sql
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation
AS $$
DECLARE
    current_user_id UUID;
    current_user_email TEXT;
BEGIN
    current_user_id := auth.uid();
    current_user_email := auth.email();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Loguj PRZED usunięciem (GDPR compliance)
    INSERT INTO public.audit_log (user_id, user_email, action, metadata)
    VALUES (
        current_user_id,
        current_user_email,
        'ACCOUNT_DELETED',
        jsonb_build_object(
            'deleted_at', NOW(),
            'source', 'user_request'
        )
    );

    -- Usuń z profiles (CASCADE usunie powiązane dane)
    DELETE FROM public.profiles WHERE id = current_user_id;

    -- Usuń z auth.users
    DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
```

---

## Audit Logging

### Tabela audit_log
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_email TEXT,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy dla raportów
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### Izolacja Audit Logu (Krytyczne)

Tabela `audit_log` musi być całkowicie zamknięta dla klienta. Użytkownik **NIE MOŻE** pisać bezpośrednio z przeglądarki - pozwoliłoby to na spamowanie lub maskowanie rzeczywistych działań.
```sql
-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- BRAK policies SELECT/INSERT/UPDATE/DELETE dla authenticated
-- Użytkownik nie może czytać ani pisać do audit_log bezpośrednio

-- Wpisy dodawane WYŁĄCZNIE przez:
-- 1. Funkcje SECURITY DEFINER (RPC)
-- 2. Triggery bazodanowe
-- 3. Edge Functions (service_role)
```

### Logowanie przez SECURITY DEFINER
```sql
-- Funkcja pomocnicza do logowania (wywoływana przez inne funkcje)
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_action TEXT,
    p_table_name TEXT DEFAULT NULL,
    p_record_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation
AS $$
BEGIN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, metadata)
    VALUES (
        auth.uid(),
        auth.email(),
        p_action,
        p_table_name,
        p_record_id,
        p_metadata
    );
END;
$$;

-- Użycie w innych funkcjach
PERFORM log_audit_event(
    'PASSWORD_CHANGED',
    'auth.users',
    auth.uid(),
    jsonb_build_object('changed_at', NOW())
);
```

### Logowanie przez Trigger
```sql
-- Automatyczne logowanie zmian w krytycznych tabelach
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_log (user_id, action, table_name, record_id, metadata)
        VALUES (
            NEW.id,
            'PROFILE_UPDATED',
            'profiles',
            NEW.id,
            jsonb_build_object(
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(to_jsonb(NEW))
                    WHERE to_jsonb(OLD) ->> key IS DISTINCT FROM value::text
                )
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_change
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_profile_changes();
```

### Logowane Akcje

| Akcja | Kiedy | Wymagane |
|-------|-------|----------|
| `ACCOUNT_CREATED` | Nowa rejestracja | Opcjonalne |
| `ACCOUNT_DELETED` | Usunięcie konta | **Wymagane (GDPR)** |
| `PASSWORD_CHANGED` | Zmiana hasła | Zalecane |
| `EMAIL_CHANGED` | Zmiana emaila | Zalecane |
| `PAYMENT_COMPLETED` | Płatność | **Wymagane** |
| `SUBSCRIPTION_ACTIVATED` | Aktywacja subskrypcji | Zalecane |
| `SUBSCRIPTION_CANCELLED` | Anulowanie subskrypcji | Zalecane |
| `DATA_EXPORTED` | Export danych (GDPR) | **Wymagane** |

### GDPR Compliance

Audit log:
- Przechowuje historię krytycznych operacji
- **NIE** jest usuwany przy usunięciu konta (Art. 30 GDPR - obowiązek dokumentacji)
- Dostępny tylko dla service_role (ochrona prywatności)
- Zawiera minimalne dane (id, email, akcja, timestamp)
- Retencja: zazwyczaj 2-7 lat (zależnie od regulacji)

---

## Production-Safe Logging

### Problem
```typescript
// ❌ NIE - Wycieka info o strukturze DB
console.error('DB error:', {
    code: 'PGRST116',
    message: 'foreign key violation',
    details: 'Key (user_id)=(...) is not present in table "auth.users"'
});
```

### Rozwiązanie: lib/logger.ts
```typescript
const isDev = import.meta.env.DEV;

export const logger = {
    error: (message: string, error?: unknown) => {
        if (isDev) {
            console.error(message, error);
        } else {
            // Produkcja: wyślij do Sentry/LogRocket (bez szczegółów DB)
            // Sentry.captureException(error);
        }
    },
    warn: (message: string, ...args: unknown[]) => {
        if (isDev) console.warn(message, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
        if (isDev) console.info(message, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
        if (isDev) console.debug(message, ...args);
    },
};
```

### Użycie
```typescript
try {
    await supabase.from('profiles').update(data).eq('id', userId);
} catch (error) {
    logger.error('Error updating profile', error);
    toast.error('Wystąpił błąd');  // Generyczny komunikat dla użytkownika
}
```

---

## Service Role Key

### Bezpieczeństwo
```typescript
// ❌ NIGDY na froncie
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ✅ TYLKO w Edge Functions
const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### Kiedy Używać

| Kontekst | Klucz |
|----------|-------|
| Frontend (przeglądarka) | `ANON_KEY` |
| Mobile app | `ANON_KEY` |
| Edge Functions (webhook) | `SERVICE_ROLE_KEY` |
| Backend server | `SERVICE_ROLE_KEY` |
| Migracje, seedy | `SERVICE_ROLE_KEY` |

---

## Zapobieganie User Enumeration

### Problem
```typescript
// ❌ NIE - Ujawnia czy email istnieje
const exists = await checkEmailExists(email);
if (exists) {
    setError('Email już istnieje');  // Atakujący wie że email jest zarejestrowany
}
```

### Rozwiązanie

1. **Nie sprawdzaj istnienia emaila** przed rejestracją
2. **Włącz ochronę w Dashboard**: Supabase Dashboard → Auth → Settings → Enable email enumeration protection
3. **Generyczne komunikaty błędów**:
```typescript
const { error } = await supabase.auth.signUp({ email, password });

if (error) {
    // Generyczny błąd - nie mów czy email istnieje
    toast.error('Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.');
}
```

---

## Checklist Bezpieczeństwa

### Nowa Tabela

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Policies dla wszystkich operacji (SELECT, INSERT, UPDATE, DELETE)
- [ ] Przetestuj dostęp jako anon, authenticated, service_role
- [ ] Zweryfikuj izolację danych między użytkownikami
- [ ] Użyj UUID (`auth.uid()`), nie email do relacji

### Nowa Funkcja RPC

- [ ] Użyj `SECURITY DEFINER` jeśli wymaga elevated access
- [ ] Ustaw `SET search_path = ''` (pusty) + w pełni kwalifikowane nazwy (`public.tabela`)
- [ ] Sprawdź `auth.uid() IS NOT NULL`
- [ ] Loguj krytyczne operacje do audit_log (przez funkcję, nie bezpośrednio)

### Nowa Edge Function

- [ ] Weryfikuj JWT dla autentykowanych endpointów
- [ ] Użyj service_role tylko gdy konieczne
- [ ] Nie loguj wrażliwych danych (tokeny, hasła, PII)
- [ ] Ustaw secrets przez CLI/Dashboard

### Frontend

- [ ] Użyj anon key (nie service_role!)
- [ ] Użyj `logger.error()` zamiast `console.error()`
- [ ] Nie sprawdzaj istnienia emaila przed rejestracją
- [ ] Toast z generycznym komunikatem (bez technicznych szczegółów)

### Supabase Dashboard

- [ ] Auth → Settings → Enable email enumeration protection
- [ ] Auth → URL Configuration → Prawidłowe redirect URLs
- [ ] Database → Replication → Tylko potrzebne tabele dla Realtime

---

## Podsumowanie

**Główne Zasady:**
1. **RLS zawsze włączony** - każda tabela
2. **UUID do relacji** - nigdy email (email jest mutowalny)
3. **SECURITY DEFINER z pustym search_path** - `SET search_path = ''` + w pełni kwalifikowane nazwy (privilege escalation)
4. **Audit log izolowany** - wpisy tylko przez triggery/funkcje, nie z klienta
5. **Service role tylko server-side** - Edge Functions, backend
6. **Production-safe logging** - nie wyciekaj struktury DB
7. **Email enumeration protection** - włącz w Dashboard

**Zobacz Także:**
- [database-patterns.md](database-patterns.md) - Wzorce RLS
- [edge-functions.md](edge-functions.md) - Service role w funkcjach
- [auth-patterns.md](auth-patterns.md) - Autentykacja