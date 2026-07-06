# Komponenty UX

Wzorce UX dla modali, formularzy, feedbacku i stanów - React 19 + React Hook Form.

---

## Modale i Dialogi

### Podstawowy Dialog (Radix)
```typescript
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    destructive?: boolean;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = 'Potwierdź',
    destructive = false,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Anuluj</Button>
                    </DialogClose>
                    <Button 
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

### Blokowanie Zamknięcia Podczas Operacji
```typescript
import { useTransition } from 'react';

function SaveDialog({ open, onOpenChange, onSave }: Props) {
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            await onSave();
            onOpenChange(false);
        });
    };

    return (
        <Dialog 
            open={open} 
            onOpenChange={(open) => {
                // Blokuj zamknięcie podczas operacji
                if (!isPending) onOpenChange(open);
            }}
        >
            <DialogContent 
                // Blokuj Escape podczas operacji
                onEscapeKeyDown={(e) => {
                    if (isPending) e.preventDefault();
                }}
                // Blokuj kliknięcie overlay
                onInteractOutside={(e) => {
                    if (isPending) e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>Zapisz zmiany</DialogTitle>
                </DialogHeader>
                
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isPending}>
                            Anuluj
                        </Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Zapisywanie...
                            </>
                        ) : (
                            'Zapisz'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

### Focus Trap (react-focus-lock)

Radix Dialog ma wbudowany focus trap. Dla custom modali:
```typescript
import FocusLock from 'react-focus-lock';

function CustomModal({ open, children }: Props) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black/50" />
            <FocusLock returnFocus>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl shadow-xl max-w-lg w-full">
                        {children}
                    </div>
                </div>
            </FocusLock>
        </div>
    );
}
```

---

### Popover API (Natywne Popovers)

Dla non-modal tooltipów i menu — bez JS:
```typescript
// Tooltip
<Button popovertarget="info-tip">
    <Info className="h-4 w-4" />
</Button>
<div id="info-tip" popover className="p-3 rounded-lg shadow-lg bg-card border max-w-xs">
    Dodatkowe informacje o tej funkcji.
</div>
```

**Kiedy Popover API vs Radix Dialog:**
- **Popover:** tooltips, dropdown menu, non-modal panele
- **Dialog:** potwierdzenia, formularze wymagające uwagi, modalne okna

---

## Formularze

### React Hook Form + Zod (Standard 2026)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

// Schema
const contactSchema = z.object({
    email: z.string().email('Nieprawidłowy format email'),
    name: z.string().min(2, 'Minimum 2 znaki'),
    message: z.string().min(10, 'Minimum 10 znaków'),
});

type ContactForm = z.infer<typeof contactSchema>;

// Component
export function ContactForm() {
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ContactForm>({
        resolver: zodResolver(contactSchema),
    });

    const mutation = useMutation({
        mutationFn: api.submitContact,
        onSuccess: () => {
            toast.success('Wiadomość wysłana!');
            reset();
        },
        onError: () => {
            toast.error('Nie udało się wysłać');
        },
    });

    const onSubmit = (data: ContactForm) => {
        mutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={!!errors.email}
                    className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                    <p id="email-error" role="alert" className="text-sm text-destructive">
                        {errors.email.message}
                    </p>
                )}
            </div>

            {/* Name */}
            <div className="space-y-2">
                <Label htmlFor="name">Imię</Label>
                <Input
                    id="name"
                    {...register('name')}
                    aria-invalid={!!errors.name}
                    className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                    <p role="alert" className="text-sm text-destructive">
                        {errors.name.message}
                    </p>
                )}
            </div>

            {/* Message */}
            <div className="space-y-2">
                <Label htmlFor="message">Wiadomość</Label>
                <Textarea
                    id="message"
                    {...register('message')}
                    rows={4}
                    aria-invalid={!!errors.message}
                    className={errors.message ? 'border-destructive' : ''}
                />
                {errors.message && (
                    <p role="alert" className="text-sm text-destructive">
                        {errors.message.message}
                    </p>
                )}
            </div>

            {/* Submit */}
            <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="w-full"
            >
                {mutation.isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wysyłanie...
                    </>
                ) : (
                    'Wyślij'
                )}
            </Button>
        </form>
    );
}
```

### Walidacja Hasła (Real-time)
```typescript
const passwordSchema = z.string()
    .min(8, 'Minimum 8 znaków')
    .regex(/[A-Z]/, 'Wymaga dużej litery')
    .regex(/[0-9]/, 'Wymaga cyfry')
    .regex(/[^A-Za-z0-9]/, 'Wymaga znaku specjalnego');

function PasswordInput() {
    const [password, setPassword] = useState('');
    
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    
    const strength = Object.values(checks).filter(Boolean).length;

    return (
        <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            
            {/* Strength indicator */}
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                    <div
                        key={level}
                        className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            strength >= level 
                                ? strength <= 2 ? 'bg-destructive' 
                                : strength === 3 ? 'bg-warning' 
                                : 'bg-success'
                                : 'bg-muted'
                        )}
                    />
                ))}
            </div>
            
            {/* Requirements */}
            <ul className="text-xs space-y-1">
                {Object.entries(checks).map(([key, valid]) => (
                    <li 
                        key={key}
                        className={cn(
                            'flex items-center gap-1',
                            valid ? 'text-success' : 'text-muted-foreground'
                        )}
                    >
                        {valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {key === 'length' && 'Minimum 8 znaków'}
                        {key === 'uppercase' && 'Duża litera'}
                        {key === 'number' && 'Cyfra'}
                        {key === 'special' && 'Znak specjalny'}
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

### Form z useTransition (bez React Query)
```typescript
import { useTransition } from 'react';

function SimpleForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        startTransition(async () => {
            try {
                await submitForm(formData);
                toast.success('Zapisano!');
            } catch (err) {
                setError('Nie udało się zapisać');
            }
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* inputs */}
            <Button type="submit" disabled={isPending}>
                {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
        </form>
    );
}
```

### useActionState (React 19) — Proste Formularze
```typescript
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
    );
}

function SimpleContactForm() {
    const [state, submitAction, isPending] = useActionState(
        async (_prev: { error: string | null }, formData: FormData) => {
            const email = formData.get('email') as string;
            try {
                await api.subscribe(email);
                return { error: null };
            } catch {
                return { error: 'Nie udało się zapisać' };
            }
        },
        { error: null }
    );

    return (
        <form action={submitAction}>
            <Input name="email" type="email" required />
            {state.error && (
                <p role="alert" className="text-sm text-destructive">{state.error}</p>
            )}
            <SubmitButton />
        </form>
    );
}
```

**Kiedy `useActionState` vs React Hook Form:**

| `useActionState` | React Hook Form + Zod |
|------|------|
| Proste formularze (1-3 pola) | Złożone formularze (>3 pola) |
| Brak client-side walidacji | Zaawansowana walidacja (Zod) |
| Natywny `<form action>` | Kontrolowane komponenty |
| Progressive enhancement | Wizard, dynamic fields, DevTools |

---

## Feedback Użytkownika

### Toast Notifications (Sonner)
```typescript
import { toast } from 'sonner';

// Basic
toast.success('Zapisano pomyślnie');
toast.error('Nie udało się zapisać');
toast.info('Nowa wersja dostępna');
toast.warning('Sesja wygasa za 5 minut');

// Z opisem
toast.error('Błąd połączenia', {
    description: 'Sprawdź połączenie internetowe',
});

// Z akcją
toast.error('Nie udało się wysłać', {
    action: {
        label: 'Spróbuj ponownie',
        onClick: () => retry(),
    },
});

// Promise (najlepszy dla async operations)
toast.promise(saveData(), {
    loading: 'Zapisywanie...',
    success: 'Zapisano!',
    error: 'Błąd zapisu',
});

// Custom duration
toast.success('Skopiowano!', { duration: 2000 });
```

### Alert Inline
```typescript
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
    variant: 'success' | 'error' | 'info' | 'warning';
    children: React.ReactNode;
}

const alertStyles = {
    success: 'bg-success/10 border-success/20 text-success',
    error: 'bg-destructive/10 border-destructive/20 text-destructive',
    info: 'bg-primary/10 border-primary/20 text-primary',
    warning: 'bg-warning/10 border-warning/20 text-warning-foreground',
};

const alertIcons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

export function Alert({ variant, children }: AlertProps) {
    const Icon = alertIcons[variant];
    // role="alert" tylko dla pilnych komunikatów (błąd/ostrzeżenie);
    // sukces/info używają role="status" (grzeczne, nieprzerywające).
    const isUrgent = variant === 'error' || variant === 'warning';

    return (
        <div
            role={isUrgent ? 'alert' : 'status'}
            className={cn(
                'p-4 rounded-lg border flex items-start gap-3',
                alertStyles[variant]
            )}
        >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">{children}</div>
        </div>
    );
}
```

---

## Loading States

### Button z useTransition
```typescript
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    onClick: () => Promise<void>;
    children: React.ReactNode;
}

export function AsyncButton({ onClick, children, ...props }: AsyncButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            await onClick();
        });
    };

    return (
        <Button onClick={handleClick} disabled={isPending} {...props}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </Button>
    );
}
```

### Button z React Query
```typescript
function SaveButton({ data }: { data: FormData }) {
    const mutation = useSaveData();

    return (
        <Button 
            onClick={() => mutation.mutate(data)}
            disabled={mutation.isPending}
        >
            {mutation.isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                </>
            ) : (
                'Zapisz'
            )}
        </Button>
    );
}
```

### Skeleton
```typescript
import { Skeleton } from '@/components/ui/skeleton';

function CardSkeleton() {
    return (
        <div className="p-4 bg-card rounded-lg border space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
        </div>
    );
}

function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }, (_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}
```

### Loading Overlay
```typescript
export function LoadingOverlay() {
    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Ładowanie...</p>
            </div>
        </div>
    );
}
```

---

## Empty States
```typescript
interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {icon && (
                <div className="mb-4 text-muted-foreground">{icon}</div>
            )}
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
                <p className="mt-2 text-muted-foreground max-w-md">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

// Użycie
<EmptyState
    icon={<SearchX className="h-12 w-12" />}
    title="Brak wyników"
    description="Nie znaleziono szablonów pasujących do kryteriów."
    action={
        <Button variant="outline" onClick={clearFilters}>
            Wyczyść filtry
        </Button>
    }
/>
```

---

## Optimistic Updates (React 19)

### useOptimistic Hook

> **Uwaga:** setter z `useOptimistic` MUSI być wywołany wewnątrz akcji lub `startTransition`.
> Wywołanie go z `onMutate` React Query (poza transition) jest anty-patternem — React zgłosi
> ostrzeżenie, a stan optymistyczny nie zostanie poprawnie powiązany z trwającą akcją.
> Owiń zarówno `setOptimistic*`, jak i `mutateAsync` w jedną `startTransition`.

```typescript
import { useOptimistic, useTransition } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function FavoriteButton({ templateId, isFavorite }: Props) {
    const queryClient = useQueryClient();
    const [isPending, startTransition] = useTransition();

    // Optimistic state — aktualizowany wyłącznie wewnątrz transition/akcji
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    const mutation = useMutation({
        mutationFn: () => api.toggleFavorite(templateId),
        onError: () => {
            // Gdy akcja się kończy, useOptimistic wraca do bazowego `isFavorite`;
            // toast informuje użytkownika o niepowodzeniu.
            toast.error('Nie udało się zapisać');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
        },
    });

    const handleToggle = () => {
        // setter useOptimistic + mutacja w jednej transition
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite);
            await mutation.mutateAsync();
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={isPending}
            aria-label={optimisticFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        >
            <Heart
                className={cn(
                    'h-5 w-5 transition-colors',
                    optimisticFavorite
                        ? 'fill-red-500 text-red-500'
                        : 'text-muted-foreground'
                )}
            />
        </Button>
    );
}
```

### Optimistic List Update
```typescript
function TodoList() {
    const { data: todos } = useTodos();
    const [isPending, startTransition] = useTransition();
    const [optimisticTodos, addOptimisticTodo] = useOptimistic(
        todos ?? [],
        (state, newTodo: Todo) => [...state, newTodo]
    );

    const mutation = useMutation({ mutationFn: api.createTodo });

    const handleCreate = (newTodo: NewTodo) => {
        // setter useOptimistic + mutacja w jednej transition (nie w onMutate)
        startTransition(async () => {
            addOptimisticTodo({ ...newTodo, id: `temp-${Date.now()}` });
            await mutation.mutateAsync(newTodo);
        });
    };

    return (
        <ul>
            {optimisticTodos.map((todo) => (
                <li 
                    key={todo.id}
                    className={cn(
                        todo.id.startsWith('temp-') && 'opacity-50'
                    )}
                >
                    {todo.title}
                </li>
            ))}
        </ul>
    );
}
```

---

## Confirm Before Action

### useConfirm Hook
```typescript
import { useState, useCallback } from 'react';

interface ConfirmOptions {
    title: string;
    description: string;
    confirmText?: string;
    destructive?: boolean;
}

export function useConfirm() {
    const [state, setState] = useState<{
        open: boolean;
        options: ConfirmOptions | null;
        resolve: ((value: boolean) => void) | null;
    }>({
        open: false,
        options: null,
        resolve: null,
    });

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        state.resolve?.(true);
        setState({ open: false, options: null, resolve: null });
    };

    const handleCancel = () => {
        state.resolve?.(false);
        setState({ open: false, options: null, resolve: null });
    };

    const ConfirmDialog = () => (
        <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{state.options?.title}</DialogTitle>
                    <DialogDescription>{state.options?.description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Anuluj
                    </Button>
                    <Button 
                        variant={state.options?.destructive ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                    >
                        {state.options?.confirmText ?? 'Potwierdź'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { confirm, ConfirmDialog };
}

// Użycie
function DeleteButton({ id }: { id: string }) {
    const { confirm, ConfirmDialog } = useConfirm();
    const deleteMutation = useDeleteItem();

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: 'Usuń element',
            description: 'Czy na pewno chcesz usunąć? Tej operacji nie można cofnąć.',
            confirmText: 'Usuń',
            destructive: true,
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <>
            <Button variant="destructive" onClick={handleDelete}>
                Usuń
            </Button>
            <ConfirmDialog />
        </>
    );
}
```

---

## Podsumowanie

| Wzorzec | Implementacja |
|---------|---------------|
| **Loading w formularzu** | React Query `isPending` lub `useTransition` |
| **Walidacja** | React Hook Form + Zod |
| **Optimistic updates** | `useOptimistic` + React Query |
| **Feedback** | Sonner toast |
| **Confirm dialogs** | Custom `useConfirm` hook |
| **Focus trap** | Radix Dialog lub react-focus-lock |

---

## Zobacz Także

- [accessibility.md](accessibility.md) - ARIA dla formularzy
- [animations.md](animations.md) - Loading animations
- [loading-and-error-states.md](../loading-and-error-states.md) - Patterns dla stanów