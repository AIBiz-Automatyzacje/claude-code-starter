# Wzorce Autentykacji

Wzorce autentykacji Supabase dla Vite SPA - OAuth, email/hasło, zarządzanie sesją.

---

## Dostępne Metody Autentykacji

### PKCE (Proof Key for Code Exchange)

Supabase JS v2 używa PKCE jako domyślnego flow OAuth. Po redirect z providera, URL zawiera parametr `code` ważny **5 minut** (jednorazowy). Klient przeglądarkowy z `createClient` ma domyślnie `detectSessionInUrl: true` i **sam** wymienia ten `code` na sesję — **nie wołaj `exchangeCodeForSession(code)` ręcznie w przeglądarce**. Kod jest jednorazowy, więc podwójna wymiana (auto-detekcja + ręczna) tworzy race i kończy się błędem „code already used". Jeśli świadomie robisz ręczny exchange, ustaw `detectSessionInUrl: false` przy tworzeniu klienta. Zobacz sekcję "Callback OAuth".

PKCE obsługiwane dla: `signInWithOAuth`, `signInWithOtp`, `signUp`, `resetPasswordForEmail`.

### Google OAuth
```typescript
const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });

    if (error) {
        logger.error('Google login error', error);
        toast.error('Błąd logowania przez Google');
    }
};
```

### Facebook OAuth
```typescript
const handleFacebookLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });

    if (error) {
        logger.error('Facebook login error', error);
        toast.error('Błąd logowania przez Facebook');
    }
};
```

### Inne Providery OAuth

Supabase wspiera wiele providerów. Wzorzec jest identyczny:
```typescript
const handleOAuthLogin = async (provider: 'google' | 'facebook' | 'github' | 'discord') => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });

    if (error) {
        logger.error(`${provider} login error`, error);
        toast.error(`Błąd logowania przez ${provider}`);
    }
};
```

### Email/Hasło
```typescript
// Rejestracja
const handleSignUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        logger.error('Sign up error', error);
        toast.error('Błąd rejestracji');
        return;
    }

    toast.success('Sprawdź email, aby potwierdzić konto');
};

// Logowanie
const handleSignIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        logger.error('Sign in error', error);
        toast.error('Nieprawidłowy email lub hasło');
        return;
    }

    toast.success('Zalogowano pomyślnie');
};
```

---

## Hook useAuth

### Implementacja
```typescript
// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    authProvider: {
        provider: string;
        isOAuth: boolean;
    } | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Pobierz bieżącą sesję
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Słuchaj zmian sesji
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Wykryj providera OAuth
    const authProvider = user ? detectAuthProvider(user) : null;

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, isLoading, authProvider, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

// Helper do wykrywania providera
function detectAuthProvider(user: User) {
    const identity = user.identities?.[0];
    const provider = identity?.provider ?? 'email';

    return {
        provider,
        isOAuth: provider !== 'email',
    };
}
```

### Użycie
```typescript
function MyComponent() {
    const { user, isLoading, authProvider, signOut } = useAuth();

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return <LoginPrompt />;
    }

    return (
        <div>
            <p>Zalogowany jako: {user.email}</p>
            <p>Provider: {authProvider?.provider}</p>

            {authProvider?.isOAuth && (
                <p>Zarządzaj kontem w ustawieniach {authProvider.provider}</p>
            )}

            <Button onClick={signOut}>Wyloguj</Button>
        </div>
    );
}
```

### getSession vs getUser vs getClaims

| Metoda | Zachowanie | Kiedy używać |
|--------|------------|--------------|
| `getSession()` | Czyta token lokalnie (szybkie) | UI state, avatar, nawigacja. **Nie ufaj na serwerze!** |
| `getUser()` | Weryfikuje z serwerem Auth | Przed krytycznymi operacjami (zmiana hasła, płatność) |
| `getClaims()` | Weryfikuje JWT przez JWKS (cache) | **Preferowane server-side** — szybsze od `getUser()`, bez sieci |

**Ważne:**
- `getSession()` czyta token z localStorage — nie weryfikuje go. Nigdy nie używaj do autoryzacji server-side.
- `getClaims()` dostępne dla projektów z asymetrycznymi kluczami JWT (domyślne od 1 października 2025). Weryfikuje JWT lokalnie przez WebCrypto API.

Hook `useAuth` używa `getSession()` dla szybkiego UI. Krytyczne operacje powinny używać `getUser()` lub `getClaims()`.

---

## Callback OAuth

### Komponent AuthCallback
```typescript
// components/AuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        // OAuth provider może zwrócić błąd w parametrach URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            logger.error('OAuth callback error', params.get('error_description'));
            navigate('/?error=auth');
            return;
        }

        // Klient przeglądarkowy (detectSessionInUrl: true — domyślnie) SAM
        // wymienia parametr `code` z URL na sesję (PKCE). NIE wołamy
        // exchangeCodeForSession ręcznie — kod jest jednorazowy, a podwójna
        // wymiana kończy się błędem "code already used". Czekamy tylko na
        // ustanowienie sesji przez onAuthStateChange.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                    await ensureUserProfile();
                    navigate('/');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [navigate]);

    return <LoadingOverlay />;
}
```

### Route w App.tsx
```typescript
<Route path="/auth/callback" element={<AuthCallback />} />
```

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
```

### Wywołanie na Froncie
```typescript
// lib/supabase.ts
export async function ensureUserProfile() {
    const { error } = await supabase.rpc('ensure_user_profile');

    if (error) {
        logger.error('Error ensuring user profile', error);
        // Nie rzucaj błędu - trigger mógł już utworzyć rekord
    }
}
```

---

## Reset Hasła

### Wysłanie Linku
```typescript
const handleForgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
        logger.error('Password reset error', error);
        toast.error('Błąd wysyłania linku resetującego');
        return;
    }

    toast.success('Sprawdź email, aby zresetować hasło');
};
```

### Strona Reset Hasła
```typescript
// pages/ResetPasswordPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            toast.success('Hasło zostało zmienione');
            navigate('/');
        } catch (error) {
            logger.error('Password update error', error);
            toast.error('Błąd zmiany hasła');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nowe hasło"
                minLength={8}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Zapisywanie...' : 'Zmień hasło'}
            </Button>
        </form>
    );
}
```

---

## Zmiana Hasła/Email

### Hook useProfile

Używa `getUser()` dla weryfikacji przed krytycznymi operacjami.
```typescript
// hooks/useProfile.ts
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export function useProfile() {
    const changePassword = async (currentPassword: string, newPassword: string) => {
        // Weryfikacja tokena z serwerem przed krytyczną operacją
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.email) throw new Error('Sesja wygasła');

        // Re-autentykacja
        const { error: reauthError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (reauthError) {
            throw new Error('Nieprawidłowe aktualne hasło');
        }

        // Zmiana hasła
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) throw error;
    };

    const changeEmail = async (newEmail: string, currentPassword: string) => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.email) throw new Error('Sesja wygasła');

        // Re-autentykacja
        const { error: reauthError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (reauthError) {
            throw new Error('Nieprawidłowe hasło');
        }

        // Zmiana emaila (wymaga potwierdzenia)
        const { error } = await supabase.auth.updateUser({
            email: newEmail,
        });

        if (error) throw error;
    };

    const deleteAccount = async (password?: string) => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Sesja wygasła');

        // Re-autentykacja (tylko dla email users)
        if (password && user.email) {
            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password,
            });

            if (reauthError) {
                throw new Error('Nieprawidłowe hasło');
            }
        }

        // Usuń konto przez RPC (loguje do audit_log)
        const { error } = await supabase.rpc('delete_user_account');

        if (error) throw error;

        await supabase.auth.signOut();
    };

    return { changePassword, changeEmail, deleteAccount };
}
```

---

## Blokada dla OAuth Users

### ProfileSettings
```typescript
function ProfileSettings() {
    const { user, authProvider } = useAuth();
    const { changePassword, changeEmail, deleteAccount } = useProfile();

    return (
        <div className="space-y-6">
            {/* Zmiana hasła - tylko dla email users */}
            {!authProvider?.isOAuth && (
                <Card>
                    <CardHeader>
                        <CardTitle>Zmiana hasła</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChangePasswordForm onSubmit={changePassword} />
                    </CardContent>
                </Card>
            )}

            {/* Zmiana emaila - tylko dla email users */}
            {!authProvider?.isOAuth && (
                <Card>
                    <CardHeader>
                        <CardTitle>Zmiana adresu email</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChangeEmailForm onSubmit={changeEmail} />
                    </CardContent>
                </Card>
            )}

            {/* Info dla OAuth users */}
            {authProvider?.isOAuth && (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground">
                            Zalogowano przez {authProvider.provider}.
                            Zarządzaj hasłem i emailem w ustawieniach {authProvider.provider}.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Usuwanie konta - dla wszystkich */}
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Usuń konto</CardTitle>
                </CardHeader>
                <CardContent>
                    <DeleteAccountForm
                        requirePassword={!authProvider?.isOAuth}
                        onSubmit={deleteAccount}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
```

---

## Podsumowanie

**Checklist Autentykacji:**
- [ ] AuthProvider opakowuje aplikację
- [ ] useAuth() dla dostępu do sesji
- [ ] Callback OAuth w /auth/callback
- [ ] Trigger tworzy profil w public.profiles (z avatar_url, full_name)
- [ ] ensure_user_profile() jako fallback
- [ ] Wykrywanie providera dla blokad
- [ ] Re-autentykacja przed zmianami profilu
- [ ] OAuth users nie zmieniają hasła/emaila
- [ ] `getUser()` przed krytycznymi operacjami

**PKCE:** Klient przeglądarkowy wymienia `code` automatycznie (`detectSessionInUrl: true`) — callback czeka tylko na sesję przez `onAuthStateChange`, bez ręcznego `exchangeCodeForSession`. Zobacz [Callback OAuth](#callback-oauth).

**Uwaga:** Pakiety `@supabase/auth-helpers-*` (nextjs, react, sveltekit, remix) są **deprecated**. Jedynym wspieranym rozwiązaniem SSR jest `@supabase/ssr`. Ten skill dotyczy Vite SPA (client-side), gdzie używamy bezpośrednio `@supabase/supabase-js`.

**Zobacz Także:**
- [database-patterns.md](database-patterns.md) - Tabela profiles
- [security.md](security.md) - Audit logging