# Wzorce Bazy Danych

Wzorce PostgreSQL, RLS policies, generowane typy i operacje CRUD dla Supabase.

---

## Generowane Typy

### Automatyczne Typy z CLI

Nie pisz typów tabel ręcznie. Używaj Supabase CLI:
```bash
# Generuj typy z bazy danych
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

# Lub z lokalnej bazy
supabase gen types typescript --local > src/types/database.ts
```

### Konfiguracja Klienta
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Typy pomocnicze
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];
```

### Użycie Typów
```typescript
import type { Tables } from '@/lib/supabase';

// Automatycznie typowane
type Profile = Tables<'profiles'>;
type Post = Tables<'posts'>;

// Funkcja z typami
async function getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}
```

### Regeneracja po Zmianach
```bash
# Po każdej migracji - regeneruj typy
supabase db push
supabase gen types typescript --local > src/types/database.ts
```

---

## Wzorce Tabel

### Tabela profiles (1:1 z auth.users)
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Każdy może czytać profile (publiczne)
CREATE POLICY "profiles_select_public"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Użytkownik może aktualizować tylko siebie
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);
```

### Tabela posts (własność użytkownika)
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Publiczne posty - każdy może czytać
CREATE POLICY "posts_select_published"
ON posts FOR SELECT
TO anon, authenticated
USING (published = true);

-- Własne posty - autor widzi wszystkie (też drafty)
CREATE POLICY "posts_select_own"
ON posts FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Autor może tworzyć
CREATE POLICY "posts_insert_own"
ON posts FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Autor może aktualizować
CREATE POLICY "posts_update_own"
ON posts FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Autor może usuwać
CREATE POLICY "posts_delete_own"
ON posts FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Tabela comments (relacja)
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Każdy może czytać komentarze opublikowanych postów
CREATE POLICY "comments_select_public"
ON comments FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM posts
        WHERE posts.id = comments.post_id
        AND posts.published = true
    )
);

-- Zalogowani mogą dodawać
CREATE POLICY "comments_insert_authenticated"
ON comments FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Autor może usuwać swoje komentarze
CREATE POLICY "comments_delete_own"
ON comments FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Tabela bookmarks (many-to-many)
```sql
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Indeksy
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_post_id ON bookmarks(post_id);

-- RLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi tylko swoje
CREATE POLICY "bookmarks_select_own"
ON bookmarks FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Użytkownik może dodawać swoje
CREATE POLICY "bookmarks_insert_own"
ON bookmarks FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Użytkownik może usuwać swoje
CREATE POLICY "bookmarks_delete_own"
ON bookmarks FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Tabela audit_log (tylko zapis)
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

-- Indeksy
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Tylko service_role może czytać (ochrona prywatności)
-- Brak SELECT policy dla authenticated

-- BRAK policies INSERT/UPDATE/DELETE dla authenticated
-- Wpisy WYŁĄCZNIE przez: SECURITY DEFINER functions, triggery, service_role
-- Zobacz: security.md → Audit Logging

-- Brak UPDATE/DELETE - audit log jest immutable
```

---

## Wzorce RLS

### 1. Publiczny Odczyt
```sql
-- Każdy (anon + authenticated) może czytać
CREATE POLICY "public_read"
ON table_name FOR SELECT
TO anon, authenticated
USING (true);
```

### 2. Dostęp Tylko do Własnych Danych
```sql
-- SELECT
CREATE POLICY "own_select"
ON table_name FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- INSERT
CREATE POLICY "own_insert"
ON table_name FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "own_update"
ON table_name FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "own_delete"
ON table_name FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### 3. Warunkowy Dostęp (np. published)
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

### 4. Dostęp przez Relację
```sql
-- Komentarze widoczne jeśli post jest publiczny
CREATE POLICY "relation_select"
ON comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM posts
        WHERE posts.id = comments.post_id
        AND (posts.published = true OR posts.user_id = (SELECT auth.uid()))
    )
);
```

### 5. Tylko Service Role (brak policies)
```sql
-- Tabela bez policies dla authenticated = tylko service_role
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
-- Brak CREATE POLICY = authenticated nie ma dostępu
```

---

## Operacje CRUD

### SELECT
```typescript
// Pobierz listę
export async function getPosts(options?: {
    published?: boolean;
    limit?: number;
}) {
    let query = supabase
        .from('posts')
        .select('*, profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false });

    if (options?.published !== undefined) {
        query = query.eq('published', options.published);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        logger.error('Error fetching posts', error);
        throw error;
    }

    return data;
}

// Pobierz pojedynczy rekord
export async function getPost(id: string) {
    const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(full_name, avatar_url), comments(*, profiles(full_name))')
        .eq('id', id)
        .single();

    if (error) {
        logger.error('Error fetching post', error);
        throw error;
    }

    return data;
}
```

### INSERT
```typescript
export async function createPost(post: InsertTables<'posts'>) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('posts')
        .insert({
            ...post,
            user_id: user.id,
        })
        .select()
        .single();

    if (error) {
        logger.error('Error creating post', error);
        throw error;
    }

    return data;
}
```

### UPDATE
```typescript
export async function updatePost(id: string, updates: UpdateTables<'posts'>) {
    const { data, error } = await supabase
        .from('posts')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        logger.error('Error updating post', error);
        throw error;
    }

    return data;
}
```

### DELETE
```typescript
export async function deletePost(id: string) {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('Error deleting post', error);
        throw error;
    }
}
```

### UPSERT
```typescript
export async function upsertBookmark(postId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('bookmarks')
        .upsert(
            {
                user_id: user.id,
                post_id: postId,
            },
            {
                onConflict: 'user_id,post_id',
                ignoreDuplicates: true,
            }
        )
        .select()
        .single();

    if (error) {
        logger.error('Error upserting bookmark', error);
        throw error;
    }

    return data;
}
```

---

## RPC (Remote Procedure Call)

### Funkcja SECURITY DEFINER
```sql
-- Funkcja z uprawnieniami właściciela (omija RLS)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation (patrz security.md)
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

    -- Loguj do audit PRZED usunięciem
    INSERT INTO public.audit_log (user_id, user_email, action, metadata)
    VALUES (
        current_user_id,
        current_user_email,
        'ACCOUNT_DELETED',
        jsonb_build_object('deleted_at', NOW())
    );

    -- Usuń z public (CASCADE usunie powiązane dane)
    DELETE FROM public.profiles WHERE id = current_user_id;

    -- Usuń z auth.users
    DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
```

### Wywołanie z Frontendu
```typescript
export async function deleteAccount() {
    const { error } = await supabase.rpc('delete_user_account');

    if (error) {
        logger.error('Error deleting account', error);
        throw error;
    }

    await supabase.auth.signOut();
}
```

### Funkcja Tylko dla Edge Functions

Niektóre operacje powinny być wykonywane tylko z service_role (np. webhook):
```sql
-- Aktywacja płatnego dostępu (tylko service_role)
CREATE OR REPLACE FUNCTION public.activate_subscription(
    p_user_id UUID,
    p_stripe_customer_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- pusty: chroni przed privilege escalation (patrz security.md)
AS $$
BEGIN
    -- Ta funkcja jest wywoływana przez Edge Function (service_role)
    -- NIE przez frontend
    
    UPDATE public.profiles
    SET
        is_premium = true,
        stripe_customer_id = p_stripe_customer_id,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO public.audit_log (user_id, action, metadata)
    VALUES (
        p_user_id,
        'SUBSCRIPTION_ACTIVATED',
        jsonb_build_object('stripe_customer_id', p_stripe_customer_id)
    );
END;
$$;
```

---

## Migracje

### Struktura Plików
```
supabase/migrations/
├── 20250101000001_create_profiles.sql
├── 20250101000002_create_posts.sql
├── 20250101000003_create_comments.sql
├── 20250101000004_create_bookmarks.sql
├── 20250101000005_create_audit_log.sql
└── 20250102000001_add_posts_published_index.sql
```

### Przykład Migracji
```sql
-- 20250101000002_create_posts.sql

-- Tabela
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published) WHERE published = true;

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "posts_select_published"
ON posts FOR SELECT
TO anon, authenticated
USING (published = true);

CREATE POLICY "posts_select_own"
ON posts FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_insert_own"
ON posts FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_update_own"
ON posts FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_delete_own"
ON posts FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Komendy Migracji
```bash
# Utwórz nową migrację
supabase migration new add_feature_x

# Zastosuj migracje lokalnie
supabase db push

# Zastosuj migracje na produkcji
supabase db push --linked

# Resetuj lokalną bazę
supabase db reset
```

---

## Indeksy

### Kiedy Dodawać
```sql
-- Kolumny w WHERE
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Kolumny w ORDER BY
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Kolumny w JOIN (foreign keys)
CREATE INDEX idx_comments_post_id ON comments(post_id);

-- Partial index (tylko subset danych)
CREATE INDEX idx_posts_published ON posts(published) WHERE published = true;

-- Composite index (wielokolumnowy)
CREATE INDEX idx_posts_user_published ON posts(user_id, published);
```

### Kiedy NIE Dodawać

- Małe tabele (<1000 wierszy)
- Kolumny rzadko używane w zapytaniach
- Kolumny z niską selektywnością (np. boolean z 50/50)
- Tabele z częstymi INSERT/UPDATE (indeksy spowalniają zapis)

---

## Triggery

### Updated_at Automatyczny
```sql
-- Funkcja
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Zastosuj do innych tabel
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Tworzenie Profilu przy Rejestracji
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

---

## Connection Pooling (Supavisor)

Supabase udostępnia Postgres przez pooler **Supavisor**. Wybór portu zależy od tego, czy połączenia są liczne i krótkotrwałe (serverless), czy trwałe:

| Tryb | Port | Kiedy używać |
|------|------|--------------|
| **Transaction** | `6543` | Serverless / Edge Functions / Lambda — wiele krótkich połączeń. Połączenie z puli jest przydzielane na czas pojedynczej transakcji. **Nie wspiera** prepared statements ani stanu sesyjnego (`SET`, `LISTEN/NOTIFY`). |
| **Session** | `5432` | Długo żyjące backendy, migracje, `psql`, narzędzia wymagające pełnej sesji (prepared statements, `SET`, advisory locks). |

Zasada: **serverless → 6543 (transaction)**, **stały serwer / migracje → 5432 (session)**. Bezpośrednie połączenie do bazy (direct connection, z pominięciem poolera) rezerwuj dla operacji administracyjnych. W trybie transaction wyłącz prepared statements po stronie klienta (np. `prepare: false` w postgres.js, `?pgbouncer=true` w Prisma).

---

## Podsumowanie

**Checklist Nowej Tabeli:**
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Policies dla SELECT, INSERT, UPDATE, DELETE
- [ ] Indeksy dla kolumn w WHERE/ORDER BY/JOIN
- [ ] Trigger dla `updated_at` (jeśli potrzebny)
- [ ] Regeneruj typy: `supabase gen types typescript`

**Wzorce RLS:**
- Public read: `USING (true)`
- Own data: `USING ((SELECT auth.uid()) = user_id)`
- Conditional: `USING (published = true OR (SELECT auth.uid()) = user_id)`
- Relational: `USING (EXISTS (SELECT 1 FROM ...))`
- Service only: Brak policies

**Zobacz Także:**
- [auth-patterns.md](auth-patterns.md) - Trigger dla nowych użytkowników
- [security.md](security.md) - SECURITY DEFINER, audit logging