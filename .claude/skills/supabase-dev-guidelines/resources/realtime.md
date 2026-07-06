# Realtime Subscriptions

Wzorce dla Supabase Realtime - subscriptions, presence, broadcast.

---

## Podstawy Realtime

### Typy Realtime

1. **Postgres Changes** - Zmiany w tabelach (INSERT, UPDATE, DELETE)
2. **Presence** - Status uzytkownikow online
3. **Broadcast** - Custom eventy miedzy klientami

---

## Postgres Changes

### Subskrypcja na Zmiany Tabeli

```typescript
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function useRealtimeFavorites(userId: string) {
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        // Pobierz poczatkowe dane
        loadFavorites();

        // Subskrybuj na zmiany
        const channel = supabase
            .channel('favorites-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',  // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'favorites',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    handleChange(payload);
                }
            )
            .subscribe();

        // Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const handleChange = (payload: any) => {
        switch (payload.eventType) {
            case 'INSERT':
                setFavorites(prev => [...prev, payload.new.template_id]);
                break;
            case 'DELETE':
                setFavorites(prev =>
                    prev.filter(id => id !== payload.old.template_id)
                );
                break;
        }
    };

    return favorites;
}
```

### Filtrowanie Zmian

```typescript
// Tylko INSERT
.on(
    'postgres_changes',
    {
        event: 'INSERT',
        schema: 'public',
        table: 'templates',
    },
    handleInsert
)

// Tylko dla konkretnej kategorii
.on(
    'postgres_changes',
    {
        event: '*',
        schema: 'public',
        table: 'templates',
        filter: 'kategoria=eq.AI / ML',
    },
    handleChange
)
```

---

## Konfiguracja Publikacji

### Wlaczenie Realtime dla Tabeli

```sql
-- W Supabase Dashboard: Database > Replication
-- Lub przez SQL:

-- Wlacz realtime dla tabeli
ALTER PUBLICATION supabase_realtime ADD TABLE favorites;

-- Sprawdz ktore tabele maja realtime
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

### RLS a Realtime

Realtime respektuje RLS policies:
- Uzytkownik otrzymuje tylko zmiany ktore moze SELECT

```sql
-- Ta policy ogranicza tez realtime
CREATE POLICY "favorites_select_own"
ON favorites FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Uzytkownik otrzyma tylko zmiany SWOICH ulubionych
```

## Realtime Authorization (Public Beta)

Od `supabase-js >= v2.44.0` dostępna jest autoryzacja kanałów Realtime przez RLS na tabeli `realtime.messages`.

### Konfiguracja

```sql
-- Broadcast: kto może wysyłać
CREATE POLICY "broadcast_insert"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
    extension = 'broadcast'
    AND realtime.topic() = 'room:' || (SELECT auth.uid())::text
);

-- Presence: kto może subskrybować
CREATE POLICY "presence_select"
ON realtime.messages FOR SELECT
TO authenticated
USING (
    extension = 'presence'
    AND realtime.topic() = 'room:' || (SELECT auth.uid())::text
);
```

### Użycie z Klientem

```typescript
// Kanał prywatny (wymaga RLS policy)
const channel = supabase.channel('room:' + userId, {
    config: { private: true },
});
```

> **Uwaga:** Realtime Authorization jest w Public Beta — API może się zmienić.

---

## Presence

### Sledzenie Uzytkownikow Online

```typescript
function useOnlineUsers() {
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = Object.keys(state);
                setOnlineUsers(userIds);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', key);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', key);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return onlineUsers;
}
```

---

## Broadcast

### Wysylanie Custom Eventow

```typescript
// Wyslij event
const channel = supabase.channel('room-1');

channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
        channel.send({
            type: 'broadcast',
            event: 'cursor-move',
            payload: { x: 100, y: 200, userId: user.id },
        });
    }
});

// Odbierz event
channel
    .on('broadcast', { event: 'cursor-move' }, (payload) => {
        console.log('Cursor moved:', payload);
    })
    .subscribe();
```

---

## Wzorce Uzycia

### Hook useRealtimeSubscription

```typescript
function useRealtimeSubscription<T>(
    table: string,
    filter?: string,
    onInsert?: (record: T) => void,
    onUpdate?: (record: T) => void,
    onDelete?: (record: T) => void
) {
    useEffect(() => {
        const channel = supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    filter,
                },
                (payload) => {
                    switch (payload.eventType) {
                        case 'INSERT':
                            onInsert?.(payload.new as T);
                            break;
                        case 'UPDATE':
                            onUpdate?.(payload.new as T);
                            break;
                        case 'DELETE':
                            onDelete?.(payload.old as T);
                            break;
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, filter]);
}

// Uzycie
useRealtimeSubscription<Template>(
    'templates',
    undefined,
    (template) => {
        toast.info(`Nowy szablon: ${template.nazwa}`);
    }
);
```

### Cleanup Pattern

```typescript
useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // Utworz kanaly
    const favoritesChannel = supabase
        .channel('favorites')
        .on('postgres_changes', { ... }, handler)
        .subscribe();
    channels.push(favoritesChannel);

    const templatesChannel = supabase
        .channel('templates')
        .on('postgres_changes', { ... }, handler)
        .subscribe();
    channels.push(templatesChannel);

    // Cleanup wszystkich kanalow
    return () => {
        channels.forEach(channel => {
            supabase.removeChannel(channel);
        });
    };
}, []);
```

---

## Kiedy Uzywac Realtime

### Dobre Przypadki Uzycia

- Wspolne edytowanie dokumentow
- Czat / komentarze
- Live notifications
- Dashboardy z aktualizacjami na zywo
- Multiplayer games

### Kiedy NIE Uzywac

- Dane rzadko sie zmieniaja
- Polling wystarczy
- Zbyt wiele subskrypcji (skalowanie)
- Dane publiczne (lepiej cache)

---

## Limity i Uwagi

### Limity Supabase

- Max 200 concurrent connections per project (Free tier)
- Max 500 channels per connection
- RLS policies musza przepuszczac SELECT

### Optymalizacje

```typescript
// Filtruj po stronie serwera (nie klienta)
.on('postgres_changes', {
    filter: `user_id=eq.${userId}`,  // Filtr w bazie
})

// Zamiast
.on('postgres_changes', {}, (payload) => {
    if (payload.new.user_id === userId) {  // Filtr na kliencie
        // ...
    }
})
```

---

## Podsumowanie

**Checklist Realtime:**
- Wlacz publikacje dla tabeli (Database > Replication)
- RLS policies pozwalaja na SELECT
- Cleanup kanalow w useEffect return
- Filtruj po stronie serwera (filter param)
- Ogranicz liczbe subskrypcji
- Uzyj presence dla statusu online
- Uzyj broadcast dla custom eventow

**Zobacz Takze:**
- [database-patterns.md](database-patterns.md) - RLS dla realtime
- [security.md](security.md) - RLS policies
