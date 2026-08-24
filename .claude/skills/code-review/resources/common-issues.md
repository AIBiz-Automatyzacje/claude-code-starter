# Common Issues

Częste błędy w projekcie React 19 + TailwindCSS v4 + Supabase z przykładami.

---

## React 19

### 1. Używanie forwardRef (przestarzałe)

**Problem:** W React 19 `ref` to zwykły prop.
```typescript
// ❌ Źle — niepotrzebne forwardRef
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// ✅ Dobrze — ref jako prop
function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

### 2. Używanie Context.Provider (przestarzałe)

**Problem:** W React 19 można używać `<Context>` bezpośrednio.
```typescript
// ❌ Źle — stary sposób
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>

// ✅ Dobrze — nowy sposób
<ThemeContext value={theme}>
  <App />
</ThemeContext>
```

### 3. useEffect do fetchowania danych

**Problem:** `useEffect` + `useState` do fetch — brak cache, dedup, retry, obsługi race conditions.
```typescript
// ❌ Źle — useEffect + useState
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{user?.name}</div>;
}
```
```typescript
// ✅ Dobrze — React Query (preferowane)
function UserProfile({ userId }: Props) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{user?.name}</div>;
}

// ✅ Dobrze — useSuspenseQuery + Suspense
function UserProfile({ userId }: Props) {
  const { data: user } = useSuspenseQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  return <div>{user.name}</div>;
}

// Użycie z Suspense
<Suspense fallback={<Spinner />}>
  <UserProfile userId={userId} />
</Suspense>
```

### 4. Brak useOptimistic dla lepszego UX

**Problem:** UI czeka na odpowiedź serwera.
```typescript
// ❌ Źle — czekanie na mutację
function LikeButton({ postId, likes }: Props) {
  const [isPending, startTransition] = useTransition();

  async function handleLike() {
    startTransition(async () => {
      await likePost(postId);
    });
  }

  return (
    <button onClick={handleLike} disabled={isPending}>
      ❤️ {likes} {isPending && "(...)"}
    </button>
  );
}
```
```typescript
// ✅ Dobrze — optimistic update
function LikeButton({ postId, likes }: Props) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (current) => current + 1
  );

  async function handleLike() {
    addOptimisticLike(null); // natychmiast +1
    await likePost(postId);  // w tle
  }

  return (
    <button onClick={handleLike}>
      ❤️ {optimisticLikes}
    </button>
  );
}
```

> **Nota:** W kontekście React Query, optimistic updates robi się przez `useMutation({ onMutate })` z rollbackiem w `onError`. `useOptimistic` jest bardziej naturalne z native form actions.

### 5. Manualne zarządzanie stanem loading w formularzach

**Problem:** Manualne zarządzanie stanem loading zamiast użycia API frameworka.
```typescript
// ❌ Źle — manualne śledzenie
function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button disabled={isSubmitting}>
      {isSubmitting ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}

// ✅ Dobrze (preferowane) — React Hook Form
function SubmitButton() {
  const { formState: { isSubmitting } } = useFormContext();
  return (
    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}

// ✅ Dobrze (alternatywa) — useFormStatus dla native form actions
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>
      {pending ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}
```

> **Nota:** W projektach z React Hook Form używaj `formState.isSubmitting`. `useFormStatus` działa z native `<form action={}>` i jest alternatywą dla prostych formularzy bez RHF.

---

## Supabase

### 1. Brak RLS policies

**Problem:** Tabela bez RLS — każdy może czytać/pisać.
```sql
-- ❌ Źle — tabela bez RLS
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_id uuid references auth.users(id)
);
-- brak RLS = każdy ma pełny dostęp!
```
```sql
-- ✅ Dobrze — RLS włączony z politykami
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_id uuid references auth.users(id)
);

alter table posts enable row level security;

create policy "Users can read all posts"
  on posts for select
  to authenticated
  using (true);

create policy "Users can insert own posts"
  on posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can delete own posts"
  on posts for delete
  to authenticated
  using (auth.uid() = author_id);
```

### 2. Brak sprawdzenia auth przed operacją

**Problem:** Zapytanie bez sprawdzenia sesji użytkownika.
```typescript
// ❌ Źle — brak sprawdzenia sesji
async function getUserPosts() {
  const { data } = await supabase
    .from("posts")
    .select("*");
  return data;
}
```
```typescript
// ✅ Dobrze — sprawdzenie auth przed operacją
async function getUserPosts() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", user.id);

  if (error) throw error;
  return data;
}
```

### 3. Używanie service_role w kliencie

**Problem:** Service role key w frontend — omija RLS.
```typescript
// ❌ Źle — service_role w kliencie (omija RLS!)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY // NIGDY w frontend!
);
```
```typescript
// ✅ Dobrze — publishable key w kliencie (podlega RLS; legacy anon key wycofywany do końca 2026)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY // sb_publishable_...
);
```

### 4. Brak obsługi błędów Supabase

**Problem:** Ignorowanie error z odpowiedzi Supabase.
```typescript
// ❌ Źle — ignorowanie error
async function getUser(id: string) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  return data; // może być null przy błędzie!
}
```
```typescript
// ✅ Dobrze — sprawdzenie error
async function getUser(id: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
}
```

---

## Sentry

### 1. Połykanie błędów bez Sentry

**Problem:** Błędy znikają w pustym catch lub trafiają tylko do konsoli.
```typescript
// ❌ Źle — pusty catch
try {
  await processPayment(orderId);
} catch (e) {
  // cicho połknięty błąd
}

// ❌ Źle — tylko console.error
try {
  await processPayment(orderId);
} catch (e) {
  console.error("Payment failed", e); // zniknie w produkcji
}
```
```typescript
// ✅ Dobrze — logowanie + Sentry
import * as Sentry from "@sentry/react";
import { logger } from "@/lib/logger";

try {
  await processPayment(orderId);
} catch (e) {
  logger.error("Payment failed", { orderId, error: e });
  Sentry.captureException(e, {
    tags: { module: "payments" },
    extra: { orderId },
  });
  throw e; // re-throw jeśli caller powinien wiedzieć
}
```

### 2. Wrażliwe dane w kontekście Sentry

**Problem:** Tokeny i hasła w danych wysyłanych do Sentry.
```typescript
// ❌ Źle — wrażliwe dane w Sentry
Sentry.setContext("user", {
  id: user.id,
  email: user.email,
  token: user.accessToken,     // wyciek tokenu!
  password: formData.password, // wyciek hasła!
});

Sentry.captureException(error, {
  extra: {
    request: { headers: req.headers }, // może zawierać Authorization
  },
});
```
```typescript
// ✅ Dobrze — tylko bezpieczne dane
Sentry.setUser({
  id: user.id,
});

Sentry.captureException(error, {
  tags: {
    provider: user.provider,
    module: "auth",
  },
  extra: {
    userId: user.id,
    action: "login",
  },
});
```

---

## Tailwind CSS 4

### 1. Nadużywanie @apply

**Problem:** Trudniejsze do utrzymania, gorsze tree-shaking. `@apply` jest akceptowalne w komponentach shadcn/ui, ale unikaj w kodzie aplikacyjnym.
```css
/* ❌ Źle — @apply w CSS */
.btn-primary {
  @apply bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600;
}
```
```typescript
// ✅ Dobrze — kompozycja w React
const buttonStyles = {
  base: "px-4 py-2 rounded transition-colors",
  primary: "bg-blue-500 text-white hover:bg-blue-600",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
};

function Button({ variant = "primary", children }: Props) {
  return (
    <button className={`${buttonStyles.base} ${buttonStyles[variant]}`}>
      {children}
    </button>
  );
}
```

### 2. Przestarzałe klasy w v4

**Problem:** Niektóre klasy zostały usunięte lub zmienione.
```typescript
// ❌ Źle — przestarzałe w v4
<div className="bg-opacity-50" />      // usunięte
<div className="text-opacity-75" />    // usunięte

// ✅ Dobrze — nowy syntax
<div className="bg-black/50" />        // slash notation
<div className="text-black/75" />
```

### 3. Brak uporządkowania klas

**Problem:** Trudne do czytania i utrzymania.
```typescript
// ❌ Źle — chaos
<div className="hover:bg-blue-600 p-4 bg-blue-500 text-white flex rounded-lg items-center mt-4 justify-between" />

// ✅ Dobrze — uporządkowane (prettier-plugin-tailwindcss)
<div className="mt-4 flex items-center justify-between rounded-lg bg-blue-500 p-4 text-white hover:bg-blue-600" />
```

---

## Radix UI

### 1. Brak aria-label dla icon buttons

**Problem:** Niedostępne dla screen readers.
```typescript
// ❌ Źle — brak opisu
<Button>
  <TrashIcon />
</Button>

// ✅ Dobrze — aria-label
<Button aria-label="Usuń element">
  <TrashIcon aria-hidden />
</Button>
```

### 2. Brak Portal dla overlays

**Problem:** Z-index issues, clipping.
```typescript
// ❌ Źle — bez Portal
<Dialog.Content className="...">
  Modal content
</Dialog.Content>

// ✅ Dobrze — z Portal
<Dialog.Portal>
  <Dialog.Overlay className="..." />
  <Dialog.Content className="...">
    Modal content
  </Dialog.Content>
</Dialog.Portal>
```

> **Nota:** Komponenty shadcn/ui (Dialog, Popover, DropdownMenu) automatycznie używają Portal. Ten issue dotyczy raw Radix UI.

### 3. Niespójne rozmiary ikon

**Problem:** Ikony różnej wielkości.
```typescript
// ❌ Źle — różne rozmiary
<HomeIcon />                    // default
<SettingsIcon size={24} />      // 24px
<UserIcon className="w-6 h-6" /> // 24px ale inaczej

// ✅ Dobrze — spójny system
const ICON_SIZE = 20;

<HomeIcon size={ICON_SIZE} />
<SettingsIcon size={ICON_SIZE} />
<UserIcon size={ICON_SIZE} />

// lub wrapper
function Icon({ icon: IconComponent, size = 20 }: Props) {
  return <IconComponent size={size} aria-hidden />;
}
```

---

## Bezpieczeństwo

### 1. Brak walidacji danych wejściowych

**Problem:** Niezaufany input trafia do bazy.
```typescript
// ❌ Źle — brak walidacji
async function createPost(formData: FormData) {
  const { error } = await supabase.from("posts").insert({
    title: formData.get("title") as string, // może być cokolwiek!
    content: formData.get("content") as string,
  });
}
```
```typescript
// ✅ Dobrze — walidacja Zod
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

async function createPost(formData: FormData) {
  const result = createPostSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const { error } = await supabase.from("posts").insert(result.data);
  if (error) throw error;
}
```

### 2. Wyciek danych server → client

**Problem:** Wrażliwe dane trafiają do klienta.
```typescript
// ❌ Źle — cały obiekt user (RLS nie filtruje kolumn!)
async function getUserProfile(userId: string) {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  // user może zawierać wrażliwe kolumny!
  return user;
}
```
```typescript
// ✅ Dobrze — tylko publiczne dane
async function getUserProfile(userId: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, avatar")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return user;
}
```

### 3. Brak sprawdzenia uprawnień (poleganie tylko na RLS)

**Problem:** RLS chroni bazę, ale logika aplikacji powinna też walidować uprawnienia.
```typescript
// ❌ Źle — brak auth check w aplikacji
async function deletePost(postId: string) {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);
  // RLS może odrzucić, ale brak informacji dla użytkownika
}
```
```typescript
// ✅ Dobrze — sprawdzenie uprawnień + RLS jako druga warstwa
async function deletePost(postId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (post?.author_id !== user.id) {
    throw new Error("Forbidden");
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (error) throw error;
}
```

---

## TypeScript

### 1. Używanie `any`

**Problem:** Brak type safety.
```typescript
// ❌ Źle
function processData(data: any) {
  return data.value.nested.property; // może crashnąć
}

// ✅ Dobrze
interface DataPayload {
  value: {
    nested: {
      property: string;
    };
  };
}

function processData(data: DataPayload) {
  return data.value.nested.property;
}

// lub unknown + type guard
function processData(data: unknown) {
  if (isDataPayload(data)) {
    return data.value.nested.property;
  }
  throw new Error("Invalid data format");
}
```

---

## React Query

### 1. Brak invalidateQueries po mutacji

**Problem:** Stale dane po zapisie — UI pokazuje nieaktualne dane.
```typescript
// ❌ Źle — brak invalidacji po mutacji
const mutation = useMutation({
  mutationFn: (data: CreatePostInput) => createPost(data),
  onSuccess: () => {
    toast.success("Post utworzony!");
    // dane w liście są stale!
  },
});
```
```typescript
// ✅ Dobrze — invalidacja powiązanych queries
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (data: CreatePostInput) => createPost(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    toast.success("Post utworzony!");
  },
});
```

### 2. useEffect + fetch zamiast useQuery

**Problem:** Brak cache, dedup, retry, background refetch.
```typescript
// ❌ Źle — manualne fetchowanie
function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts().then(setPosts).finally(() => setLoading(false));
  }, []);

  // brak obsługi error, brak retry, brak cache
}
```
```typescript
// ✅ Dobrze — useQuery
function PostList() {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  if (isLoading) return <PostListSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!posts?.length) return <EmptyState message="Brak postów" />;

  return posts.map((post) => <PostCard key={post.id} post={post} />);
}
```

### 3. Brak obsługi stanów loading/error/empty

**Problem:** Komponent zakłada że dane zawsze istnieją.
```typescript
// ❌ Źle — brak obsługi stanów
function UserProfile({ userId }: Props) {
  const { data: user } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  return <div>{user.name}</div>; // crash gdy user undefined!
}
```
```typescript
// ✅ Dobrze — pełna obsługa stanów
function UserProfile({ userId }: Props) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return <NotFound message="Użytkownik nie znaleziony" />;

  return <div>{user.name}</div>;
}
```

---

## React Hook Form + Zod

### 1. Manualna walidacja zamiast zodResolver

**Problem:** Duplikacja logiki walidacji, niespójne komunikaty błędów.
```typescript
// ❌ Źle — manualna walidacja
function ContactForm() {
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = (data: any) => {
    if (!data.email.includes("@")) {
      setError("email", { message: "Nieprawidłowy email" });
      return;
    }
    if (data.name.length < 2) {
      setError("name", { message: "Imię za krótkie" });
      return;
    }
    // ...
  };
}
```
```typescript
// ✅ Dobrze — zodResolver
import { zodResolver } from "@hookform/resolvers/zod";

const contactSchema = z.object({
  name: z.string().min(2, "Imię musi mieć min. 2 znaki"),
  email: z.string().email("Nieprawidłowy email"),
  message: z.string().min(10, "Wiadomość musi mieć min. 10 znaków"),
});

type ContactFormData = z.infer<typeof contactSchema>;

function ContactForm() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = (data: ContactFormData) => {
    // data jest już zwalidowane i typowane
  };
}
```

### 2. Brak obsługi błędów serwera w formularzu

**Problem:** Błędy API nie są mapowane na pola formularza.
```typescript
// ❌ Źle — brak mapowania błędów API
const onSubmit = async (data: FormData) => {
  try {
    await createUser(data);
  } catch (e) {
    toast.error("Coś poszło nie tak"); // generyczny komunikat
  }
};
```
```typescript
// ✅ Dobrze — mapowanie błędów API na pola
const onSubmit = async (data: FormData) => {
  try {
    await createUser(data);
    toast.success("Użytkownik utworzony!");
  } catch (e) {
    if (e instanceof ApiError && e.fieldErrors) {
      // mapowanie błędów serwera na pola formularza
      for (const [field, message] of Object.entries(e.fieldErrors)) {
        form.setError(field as keyof FormData, { message });
      }
    } else {
      form.setError("root", {
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      });
    }
  }
};
```

---

## Race Conditions w React

### 1. useEffect bez cleanup (brak AbortController)

**Problem:** Komponent odmontowany w trakcie fetcha — state update na odmontowanym komponencie, memory leak.
```typescript
// ❌ Źle — brak cleanup
useEffect(() => {
  fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then(setUser); // crash jeśli komponent odmontowany
}, [userId]);
```
```typescript
// ✅ Dobrze — AbortController w cleanup
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((res) => res.json())
    .then(setUser)
    .catch((err) => {
      if (err.name !== "AbortError") throw err;
    });

  return () => controller.abort();
}, [userId]);
```

> **Nota:** W większości przypadków używaj React Query zamiast useEffect + fetch. React Query zarządza cleanup automatycznie.

### 2. setTimeout/setInterval bez cleanup

**Problem:** Timer wykonuje się po odmontowaniu komponentu — state update na ghost component.
```typescript
// ❌ Źle — brak cleanup
useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1);
  }, 1000);
  // brak clearInterval!
}, []);
```
```typescript
// ✅ Dobrze — cleanup w return
useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

### 3. Wiele booleanów zamiast state machine

**Problem:** Kombinatoryczna eksplozja stanów — można mieć `isLoading: true` i `isError: true` jednocześnie.
```typescript
// ❌ Źle — niezależne booleany
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
// 8 możliwych kombinacji, większość nieprawidłowa!
```
```typescript
// ✅ Dobrze — discriminated union
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

const [state, setState] = useState<FetchState<User>>({ status: "idle" });

// Użycie — TypeScript gwarantuje poprawny dostęp
if (state.status === "success") {
  return <div>{state.data.name}</div>;
}
```

> **Nota:** React Query robi to automatycznie (status: "pending" | "error" | "success"). Używaj discriminated unions dla custom async logic.

### 4. Brak guardu na mutually exclusive operations

**Problem:** User klika 5 razy "Załaduj" — 5 równoległych requestów, wyścig o to który finish ostatni.
```typescript
// ❌ Źle — brak guardu
async function handleLoad() {
  setIsLoading(true);
  const data = await fetchData(); // 5 równoległych!
  setData(data); // ostatni wygrywa, niekoniecznie najnowszy
  setIsLoading(false);
}
```
```typescript
// ✅ Dobrze — guard z flagą stanu
const [status, setStatus] = useState<"idle" | "loading">("idle");

async function handleLoad() {
  if (status === "loading") return; // guard
  setStatus("loading");
  try {
    const data = await fetchData();
    setData(data);
  } finally {
    setStatus("idle");
  }
}
```

### 5. Brak cleanup dla subscriptions

**Problem:** Memory leak — subscription żyje po odmontowaniu.
```typescript
// ❌ Źle — brak unsubscribe
useEffect(() => {
  const channel = supabase
    .channel("posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, handleChange)
    .subscribe();
  // brak cleanup!
}, []);
```
```typescript
// ✅ Dobrze — unsubscribe w cleanup
useEffect(() => {
  const channel = supabase
    .channel("posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, handleChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Performance

### 1. N+1 query w pętli

**Problem:** Zapytanie do bazy w pętli — 100 iteracji = 100 requestów.
```typescript
// ❌ Źle — fetch w pętli
async function getPostsWithAuthors(postIds: string[]) {
  const posts = [];
  for (const id of postIds) {
    const { data: post } = await supabase
      .from("posts")
      .select("*, author:users(*)")
      .eq("id", id)
      .single();
    posts.push(post);
  }
  return posts;
}
```
```typescript
// ✅ Dobrze — batch query
async function getPostsWithAuthors(postIds: string[]) {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, author:users(*)")
    .in("id", postIds);

  if (error) throw error;
  return posts;
}
```

### 2. Brak lazy loading dla dużych komponentów

**Problem:** Cały bundle ładowany upfront — wolny initial load.
```typescript
// ❌ Źle — static import dużego komponentu
import { HeavyChart } from "@/components/heavy-chart";
import { AdminPanel } from "@/components/admin-panel";

function App() {
  return (
    <div>
      <HeavyChart />
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```
```typescript
// ✅ Dobrze — lazy loading z Suspense
import { lazy, Suspense } from "react";

const HeavyChart = lazy(() => import("@/components/heavy-chart"));
const AdminPanel = lazy(() => import("@/components/admin-panel"));

function App() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart />
      </Suspense>
      {isAdmin && (
        <Suspense fallback={<PanelSkeleton />}>
          <AdminPanel />
        </Suspense>
      )}
    </div>
  );
}
```

### 3. select("*") zamiast konkretnych kolumn

**Problem:** Transfer niepotrzebnych danych — wolniejsze zapytania, większy payload.
```typescript
// ❌ Źle — wszystkie kolumny (może zawierać blob, JSON, wrażliwe dane)
const { data } = await supabase
  .from("users")
  .select("*");

// ✅ Dobrze — tylko potrzebne kolumny
const { data } = await supabase
  .from("users")
  .select("id, name, avatar_url");
```

---

### 2. Brak typów dla props

**Problem:** Niejasne API komponentu.
```typescript
// ❌ Źle
function UserCard({ user, onEdit, showActions }) {
  // co to są za typy?
}

// ✅ Dobrze
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  showActions?: boolean;
}

function UserCard({ user, onEdit, showActions = true }: UserCardProps) {
  // jasne API
}
```

### 3. Non-null assertion bez uzasadnienia

**Problem:** Potencjalny runtime crash.
```typescript
// ❌ Źle — ślepe !
const user = users.find((u) => u.id === id)!;
console.log(user.name); // crash jeśli nie znaleziono

// ✅ Dobrze — explicit handling
const user = users.find((u) => u.id === id);
if (!user) {
  throw new Error(`User ${id} not found`);
}
console.log(user.name);
```
