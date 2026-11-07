# Wzorce Autentykacji

Wzorce autentykacji Supabase w aplikacji Expo: OAuth natywnie, email i hasło, sesja. Klient: [klient-i-przeglad.md](klient-i-przeglad.md).

---

## PKCE

Domyślny `flowType` to `implicit`, więc klient ma jawnie `flowType: 'pkce'`: kod wraca w query i wymieniasz go `exchangeCodeForSession`. Klient bez PKCE dostaje tokeny we fragmencie URL, a kod poniżej go nie obsłuży.

## OAuth natywnie

- `scheme` w `app.json` i Redirect URL ze schematem na liście Supabase, bez wildcard. Universal Links i App Links mają pierwszeństwo przed własnym schematem.
- `npx expo install expo-auth-session expo-web-browser`.

```typescript
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

export async function zalogujGoogle() {
    const redirectTo = makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;

    const wynik = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (wynik.type !== 'success') return;

    const { params, errorCode } = QueryParams.getQueryParams(wynik.url);
    if (errorCode) throw new Error(errorCode);
    if (!params.code) throw new Error('Brak kodu logowania w odpowiedzi');
    const { error: bladWymiany } = await supabase.auth.exchangeCodeForSession(params.code);
    if (bladWymiany) throw bladWymiany;
}
```

`makeRedirectUri` daje w Expo Go `exp://…`, a w dev-cliencie schemat aplikacji: oba adresy muszą być na liście Redirect URLs.

## Email i hasło

```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
```

Komunikat błędu logowania i rejestracji jest generyczny, bo inny komunikat dla istniejącego konta ujawnia, kto ma konto.

## Sesja

- Stan sesji trzyma `onAuthStateChange` w providerze, a przekierowanie po logowaniu wynika z efektu na stanie sesji w layoucie grupy (`.claude/rules/stack.md`, sekcja „Nawigacja i cykl życia ekranu (Expo Router)”).
- Tożsamość po stronie serwera: `getClaims()` albo `getUser()`; `getSession()` czyta tylko lokalny zapis.
- Odświeżanie tokenu: `references/stack.md`, sekcja „Auto-refresh i AppState”.

---

## Tworzenie Profilu Użytkownika

### Trigger handle_new_user (Główny mechanizm)

Automatycznie wykonywany przy INSERT do `auth.users`. Pobiera dane z OAuth (avatar, imię).
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation (patrz security.md)
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Funkcję woła tylko trigger: żadna rola API nie potrzebuje EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### Funkcja ensure_user_profile (Fallback)

Defensive programming - safety net dla edge cases (race conditions, migracje).
```sql
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation (patrz security.md)
AS $$
DECLARE
    current_user_id UUID;
    current_user_email TEXT;
    current_user_meta JSONB;
BEGIN
    current_user_id := auth.uid();
    current_user_email := auth.email();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Pobierz metadane użytkownika
    SELECT raw_user_meta_data INTO current_user_meta
    FROM auth.users WHERE id = current_user_id;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
        current_user_id,
        current_user_email,
        current_user_meta->>'full_name',
        current_user_meta->>'avatar_url',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
END;
$$;

-- Funkcja w schemacie API jest wołalna przez .rpc(): EXECUTE tylko dla roli, która ją woła
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;
```

---

## Reset i zmiana hasła

- Link resetu otwiera aplikację: `resetPasswordForEmail(email, { redirectTo })` z adresem Universal Linku albo schematu z listy Redirect URLs.
- Ekran resetu wymienia kod z linku `exchangeCodeForSession`, a potem woła `updateUser({ password })`.
- Użytkownik OAuth bez hasła nie widzi formularza zmiany hasła: sprawdzasz `user.identities`.
