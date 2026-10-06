# Komponenty UX

Wzorce UX dla modali, formularzy, feedbacku i stanów - React 19 + React Hook Form.

---

## Modale i Dialogi

### Podstawowy Dialog (Radix)
```typescript
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { toast } from 'sonner';

import { logger } from '@/lib/logger';

interface SaveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => Promise<void>;
}

function SaveDialog({ open, onOpenChange, onSave }: SaveDialogProps) {
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            // Odrzucony promise w startTransition trafia do error boundary,
            // dlatego błąd łapiesz tutaj: log z kodem, toast i dialog zostaje otwarty
            try {
                await onSave();
                onOpenChange(false);
            } catch (error) {
                logger.error('SAVE_DIALOG_FAILED', error);
                toast.error('Nie udało się zapisać zmian');
            }
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
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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

### Focus Trap

Kolejność wyboru:

1. **Dialog z shadcn/ui (Radix)** — pierwszy wybór, projekt go już ma. Wbudowany focus trap, zamknięcie Escape, `aria-modal`, powrót fokusu do elementu, który otworzył dialog. Przykłady wyżej.
2. **Natywny `<dialog>` z `showModal()`** — gdy modal ma wyglądać albo zachowywać się inaczej niż Dialog z shadcn/ui. Przeglądarka sama robi resztę strony inert (Tab nie wychodzi do treści pod spodem), zamyka dialog Escape, renderuje go w top layer nad wszystkimi `z-index` i oddaje fokus po zamknięciu. Bez nowej zależności.
3. **react-focus-lock** — nowa zależność, więc najpierw sprawdzasz package.json i zgłaszasz ją operatorowi (w workflowie: w odchyleniach). Sięgasz po nią tylko wtedy, gdy żaden z dwóch powyższych wariantów nie pasuje (np. pułapka fokusu w panelu, który nie jest modalem).

```typescript
import { useEffect, useId, useRef } from 'react';

import { Button } from '@/components/ui/button';

interface NativeModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function NativeModal({ open, onClose, title, children }: NativeModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    // Synchronizacja propsa open z DOM: showModal() daje focus trap, inert tła i top layer
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            // Zdarzenie close przychodzi po Escape i po wysłaniu <form method="dialog">
            onClose={onClose}
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl backdrop:bg-black/50"
        >
            <h2 id={titleId} className="text-lg font-semibold">
                {title}
            </h2>
            <div className="mt-4">{children}</div>
            <form method="dialog" className="mt-6 flex justify-end">
                <Button type="submit" variant="outline">
                    Zamknij
                </Button>
            </form>
        </dialog>
    );
}
```

---

### Popover API (Natywne Popovers)

Dla non-modal tooltipów i menu — bez JS:
```typescript
// Tooltip — React 19 przyjmuje popoverTarget w camelCase; przycisk z samą ikoną ma aria-label
<Button
    variant="ghost"
    size="icon"
    popoverTarget="info-tip"
    className="pointer-coarse:size-11"
    aria-label="Więcej informacji"
>
    <Info className="h-4 w-4" aria-hidden="true" />
</Button>
<div id="info-tip" popover="auto" className="p-3 rounded-lg shadow-lg bg-card border max-w-xs">
    Dodatkowe informacje o tej funkcji.
</div>
```

**Kiedy Popover API vs Radix Dialog:**
- **Popover:** tooltips, dropdown menu, non-modal panele
- **Dialog:** potwierdzenia, formularze wymagające uwagi, modalne okna

Rozmiar przycisków-ikon według zasady rozmiaru celu z [accessibility.md](accessibility.md#rozmiar-celu): `size="icon"` z shadcn/ui na desktopie, 44 px przy wskaźniku dotykowym.

---

## Formularze

### React Hook Form + Zod

Kanoniczny `ContactForm` — schemat `contactSchema` (`z.strictObject`, `z.email()`), typ `ContactValues`, hook `useSendContact()` z `useMutation` wołający `contactService.send`, `onError` z logiem `CONTACT_SEND_FAILED` i toastem, reset i `onSuccess?.()` po wysłaniu, powiązania `aria-invalid`/`aria-describedby` — jest w [forms.md](../../tailwind-react-guidelines/resources/forms.md) (sekcja Podstawowy Formularz). Ten plik go nie powtarza; poniżej warstwa UX, którą dokładasz do tego samego komponentu:

- **Błąd widoczny nie tylko kolorem.** Pole z błędem dostaje obramowanie `border-destructive`, a pod polem jest tekst komunikatu (`role="alert"`, powiązany przez `aria-describedby`). Sam czerwony kolor nie wystarcza osobom z zaburzeniami widzenia barw.
- **Wysyłka z widocznym postępem.** Przycisk jest zablokowany na czas wysyłki, pokazuje spinner (ukryty przed czytnikiem) i tekst „Wysyłanie...”, więc użytkownik nie klika drugi raz.
- **Przycisk na pełną szerokość na mobile** i z celem 44 px na dotyku ([accessibility.md](accessibility.md#rozmiar-celu)).
- **Wygodne pole wiadomości:** `rows={4}`, żeby od razu było widać, że to pole na dłuższy tekst.
- **Toast sukcesu i błędu** (Sonner): sukces z handlera formularza, błąd z `onError` hooka — jeden komunikat na zdarzenie.

```typescript
// Fragment ContactForm z forms.md z warstwą UX: pole e-mail, pole wiadomości i przycisk wysyłki
// (handler handleValidSubmit, sendContact = useSendContact() i FieldErrorMessage — jak w forms.md)
<div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input
        id="email"
        type="email"
        {...register('email')}
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={errors.email ? 'email-error' : undefined}
        className={cn(errors.email && 'border-destructive')}
    />
    <FieldErrorMessage id="email-error" message={errors.email?.message} />
</div>

<div className="space-y-2">
    <Label htmlFor="message">Wiadomość</Label>
    <Textarea
        id="message"
        rows={4}
        {...register('message')}
        aria-invalid={errors.message ? true : undefined}
        aria-describedby={errors.message ? 'message-error' : undefined}
        className={cn(errors.message && 'border-destructive')}
    />
    <FieldErrorMessage id="message-error" message={errors.message?.message} />
</div>

<Button
    type="submit"
    disabled={sendContact.isPending}
    className="w-full md:w-auto pointer-coarse:min-h-11"
>
    {sendContact.isPending ? (
        <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Wysyłanie...
        </>
    ) : (
        'Wyślij'
    )}
</Button>
```

### Walidacja Hasła (Real-time)

Reguły hasła są kontraktem: ten sam zestaw sprawdza schemat formularza i podpowiada użytkownikowi w UI. Trzymasz je więc w jednej tablicy `PASSWORD_RULES`, z której korzystają oba miejsca — dwie kopie (osobne `.regex()` w schemacie i osobne testy w komponencie) rozjeżdżają się po pierwszej zmianie.
```typescript
// src/schemas/password-schema.ts
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
    {
        id: 'length',
        label: `Minimum ${PASSWORD_MIN_LENGTH} znaków`,
        test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
    },
    { id: 'uppercase', label: 'Duża litera', test: (value: string) => /[A-Z]/.test(value) },
    { id: 'number', label: 'Cyfra', test: (value: string) => /[0-9]/.test(value) },
    { id: 'special', label: 'Znak specjalny', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

// Schemat formularza składany z tych samych reguł
export const passwordSchema = PASSWORD_RULES.reduce<z.ZodString>(
    (schema, rule) => schema.refine(rule.test, { error: rule.label }),
    z.string(),
);
```
```typescript
// src/components/password-input.tsx
import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PASSWORD_RULES } from '@/schemas/password-schema';

const WEAK_PASSWORD_MAX_SCORE = 2;

function getStrengthClass(score: number, level: number): string {
    if (score < level) return 'bg-muted';
    if (score <= WEAK_PASSWORD_MAX_SCORE) return 'bg-destructive';
    if (score < PASSWORD_RULES.length) return 'bg-warning';
    return 'bg-success';
}

export function PasswordInput() {
    const [password, setPassword] = useState('');

    const checks = PASSWORD_RULES.map((rule) => ({ ...rule, isValid: rule.test(password) }));
    const score = checks.filter((check) => check.isValid).length;

    return (
        <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-requirements"
            />

            {/* Strength indicator — wizualny, treść niesie lista wymagań */}
            <div className="flex gap-1" aria-hidden="true">
                {PASSWORD_RULES.map((rule, index) => (
                    <div
                        key={rule.id}
                        className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            getStrengthClass(score, index + 1)
                        )}
                    />
                ))}
            </div>

            {/* Requirements — stan każdej reguły także tekstem, nie tylko kolorem i ikoną */}
            <ul id="password-requirements" className="text-xs space-y-1">
                {checks.map((check) => (
                    <li
                        key={check.id}
                        className={cn(
                            'flex items-center gap-1',
                            check.isValid ? 'text-success' : 'text-muted-foreground'
                        )}
                    >
                        {check.isValid ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                        ) : (
                            <X className="h-3 w-3" aria-hidden="true" />
                        )}
                        {check.label}
                        <span className="sr-only">{check.isValid ? ' — spełnione' : ' — niespełnione'}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

### Formularz bez React Query — akcja w hooku

Formularz bez React Hook Form i bez mutacji React Query nie składa stanu z ręcznych flag (`useTransition` + `useState` na błąd): coding-rules (Async i React) każą opisać go przez `useActionState`, a stan wyniku — unią dyskryminowaną. Akcja leży w hooku, który woła serwis, więc komponent nie zna warstwy danych. Dane z `FormData` przechodzą przez schemat Zod, a każdy `catch` zostawia log z kodem błędu.
```typescript
// src/hooks/use-subscribe-newsletter.ts
import { useActionState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { newsletterService } from '@/services/newsletter-service';

export type SubscribeState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string; email: string };

const subscribeSchema = z.strictObject({ email: z.email() });

export function useSubscribeNewsletter() {
    return useActionState<SubscribeState, FormData>(
        async (_previous, formData) => {
            const parsed = subscribeSchema.safeParse(Object.fromEntries(formData));
            const email = z.string().catch('').parse(formData.get('email'));
            if (!parsed.success) {
                return { status: 'error', message: 'Podaj poprawny adres e-mail', email };
            }
            try {
                await newsletterService.subscribe(parsed.data.email);
                return { status: 'success' };
            } catch (error) {
                logger.error('NEWSLETTER_SUBSCRIBE_FAILED', error);
                return { status: 'error', message: 'Nie udało się zapisać', email };
            }
        },
        { status: 'idle' }
    );
}
```

React po zakończeniu akcji resetuje niekontrolowane pola formularza. Stan błędu niesie więc wpisany adres (`email`), a pole dostaje go jako `defaultValue` — użytkownik poprawia literówkę zamiast wpisywać adres od nowa.

### useActionState (React 19) — Proste Formularze
```typescript
// src/components/newsletter-form.tsx
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscribeNewsletter } from '@/hooks/use-subscribe-newsletter';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="pointer-coarse:min-h-11">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
    );
}

export function NewsletterForm() {
    const [state, submitAction] = useSubscribeNewsletter();
    const hasError = state.status === 'error';

    return (
        <form action={submitAction} noValidate className="space-y-2">
            <Label htmlFor="newsletter-email">Email</Label>
            <Input
                id="newsletter-email"
                name="email"
                type="email"
                required
                defaultValue={hasError ? state.email : ''}
                aria-invalid={hasError ? true : undefined}
                aria-describedby={hasError ? 'newsletter-error' : undefined}
            />
            {hasError && (
                <p id="newsletter-error" role="alert" className="text-sm text-destructive">
                    {state.message}
                </p>
            )}
            {/* Region status jest w DOM od początku, zmienia się tylko treść (accessibility.md, aria-live Regions) */}
            <p role="status" className="text-sm text-success">
                {state.status === 'success' && 'Zapisano do newslettera'}
            </p>
            <SubmitButton />
        </form>
    );
}
```

**Kiedy `useActionState` vs React Hook Form:**

| `useActionState` | React Hook Form + Zod |
|------|------|
| Proste formularze (1-3 pola) | Złożone formularze (>3 pola) |
| Walidacja Zod w akcji, po wysłaniu | Walidacja Zod w trakcie wpisywania (resolver) |
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

// Z akcją — ponowienie przez mutację z hooka (sendContact = useSendContact())
toast.error('Nie udało się wysłać', {
    action: {
        label: 'Spróbuj ponownie',
        onClick: () => sendContact.mutate(values),
    },
});

// Promise (najlepszy dla async operations) — promise z mutacji hooka, nie wywołanie serwisu w komponencie.
// Hook użyty z toast.promise nie pokazuje własnego toastu błędu w onError (tylko loguje kod błędu),
// żeby użytkownik nie dostał dwóch komunikatów o tym samym błędzie.
toast.promise(saveTemplate.mutateAsync(values), {
    loading: 'Zapisywanie...',
    success: 'Zapisano!',
    error: 'Błąd zapisu',
});

// Custom duration — czas w nazwanej stałej
const COPY_TOAST_DURATION_MS = 2000;
toast.success('Skopiowano!', { duration: COPY_TOAST_DURATION_MS });
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
            <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">{children}</div>
        </div>
    );
}
```

---

## Loading States

### Button z useTransition

Dla akcji async spoza React Query (np. kopiowanie do schowka, eksport pliku). Odrzucony promise w `startTransition` trafia do najbliższego error boundary i zamienia ekran w stan błędu, dlatego przycisk łapie błąd sam: log ze stałym kodem z propsa `errorCode` i toast dla użytkownika. Mutacji z hooka React Query tu nie przekazujesz — hook już loguje błąd w `onError`, więc używasz wariantu „Button z React Query” niżej (`mutate` + `isPending`).
```typescript
import { Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    onClick: () => Promise<void>;
    errorCode: string;
    errorMessage?: string;
    children: React.ReactNode;
}

export function AsyncButton({
    onClick,
    errorCode,
    errorMessage = 'Nie udało się wykonać akcji',
    children,
    ...props
}: AsyncButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            try {
                await onClick();
            } catch (error) {
                logger.error(errorCode, error);
                toast.error(errorMessage);
            }
        });
    };

    return (
        <Button {...props} onClick={handleClick} disabled={props.disabled || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {children}
        </Button>
    );
}

// Użycie
<AsyncButton onClick={exportReport} errorCode="REPORT_EXPORT_FAILED">
    Eksportuj
</AsyncButton>
```

Wariant z celem dotykowym 44 px ([accessibility.md](accessibility.md#rozmiar-celu)), widocznym fokusem i stanem ogłaszanym czytnikom ekranu (`aria-busy`, ikona ukryta przed czytnikiem); obsługa błędu jak w `AsyncButton`:

```typescript
import { Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
    onClick: () => Promise<void>;
    errorCode: string;
    children: React.ReactNode;
    disabled?: boolean;
}

export function ActionButton({ onClick, errorCode, children, disabled }: ActionButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            try {
                await onClick();
            } catch (error) {
                logger.error(errorCode, error);
                toast.error('Nie udało się wykonać akcji');
            }
        });
    };

    return (
        <Button
            onClick={handleClick}
            disabled={disabled || isPending}
            className={cn(
                "inline-flex items-center justify-center gap-2",
                "min-h-11 px-4",  // 44px touch target
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "transition-colors duration-200"
            )}
            aria-busy={isPending}
        >
            {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {children}
        </Button>
    );
}
```

### Button z React Query
```typescript
// useSaveSettings: hook z useMutation → settingsService.save, onError loguje SETTINGS_SAVE_FAILED i pokazuje toast
// Typ danych nazywasz od domeny (SettingsValues), nie FormData — ta nazwa przesłania globalny typ DOM
function SaveButton({ values }: { values: SettingsValues }) {
    const mutation = useSaveSettings();

    return (
        <Button 
            onClick={() => mutation.mutate(values)}
            disabled={mutation.isPending}
        >
            {mutation.isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
// LoadingOverlay bez propsów — to samo API w całym projekcie
export function LoadingOverlay() {
    return (
        <div
            role="status"
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Ładowanie...</p>
            </div>
        </div>
    );
}
```

---

## Empty States

`EmptyState` ma w projekcie jedno API: `{ title, description?, action? }` (patterns.md i loading-and-error-states.md używają tego samego komponentu). Tytuł mówi, co się stało, opis — co użytkownik może zrobić, akcja — następny krok.
```typescript
interface EmptyStateProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
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

> **Uwaga:** setter z `useOptimistic` wywołujesz wewnątrz akcji albo `startTransition`.
> Wywołanie go z `onMutate` React Query (poza transition) jest anty-patternem — React zgłosi
> ostrzeżenie, a stan optymistyczny nie zostanie poprawnie powiązany z trwającą akcją.
> Owiń zarówno `setOptimistic*`, jak i `mutateAsync` w jedną `startTransition`.

Mutacja leży w hooku `useToggleFavorite` (ten sam w całym projekcie): `onError` loguje kod błędu i pokazuje toast, a `onSettled` zwraca promise invalidacji. Dzięki temu `mutateAsync` kończy się dopiero po odświeżeniu danych — transition trwa do chwili, gdy prop `isFavorite` ma już nową wartość, i przycisk nie wraca na moment do starego stanu.
```typescript
// src/hooks/use-toggle-favorite.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { templateKeys } from '@/hooks/use-templates';
import { logger } from '@/lib/logger';
import { templateService } from '@/services/template-service';

export function useToggleFavorite(templateId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => templateService.toggleFavorite(templateId),
        onError: (error) => {
            logger.error('FAVORITE_TOGGLE_FAILED', error);
            toast.error('Nie udało się zapisać ulubionych');
        },
        // Zwracany promise: mutacja kończy się po odświeżeniu źródła prawdy
        onSettled: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
    });
}
```
```typescript
// src/components/favorite-button.tsx
import { Heart } from 'lucide-react';
import { useOptimistic, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToggleFavorite } from '@/hooks/use-toggle-favorite';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
    templateId: string;
    isFavorite: boolean;
}

export function FavoriteButton({ templateId, isFavorite }: FavoriteButtonProps) {
    const toggleFavorite = useToggleFavorite(templateId);
    const [isPending, startTransition] = useTransition();

    // Optimistic state — aktualizowany wyłącznie wewnątrz transition/akcji
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    const handleToggle = () => {
        // setter useOptimistic + mutacja w jednej transition
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite);
            try {
                await toggleFavorite.mutateAsync();
            } catch {
                // Odrzucenie mutateAsync bez catch trafiłoby do error boundary.
                // Błąd zalogował już onError hooka (zdarzenie w Sentry, toast); tu zostaje ślad
                // cofnięcia stanu optymistycznego bez drugiego zdarzenia. Po zakończeniu akcji
                // useOptimistic wraca do bazowego `isFavorite`.
                logger.info('FAVORITE_TOGGLE_ROLLED_BACK', { templateId });
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="pointer-coarse:size-11"
            onClick={handleToggle}
            disabled={isPending}
            aria-pressed={optimisticFavorite}
            aria-label="Ulubiony"
        >
            <Heart
                aria-hidden="true"
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

Wariant bez stanu optymistycznego to ten sam hook i `onClick={() => toggleFavorite.mutate()}` z `disabled={toggleFavorite.isPending}`.

### Optimistic List Update

Lista z elementem tymczasowym potrzebuje invalidacji po mutacji: bez niej element tymczasowy znika po zakończeniu akcji, a prawdziwy element z serwera się nie pojawia. Hook zwraca promise invalidacji z `onSettled`, więc transition trwa, dopóki lista z serwera nie zawiera nowego elementu.
```typescript
// src/hooks/use-create-todo.ts
export const todoKeys = {
    all: ['todos'] as const,
};

export function useCreateTodo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newTodo: NewTodo) => todoService.create(newTodo),
        onError: (error) => {
            logger.error('TODO_CREATE_FAILED', error);
            toast.error('Nie udało się dodać zadania');
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
    });
}
```
```typescript
// src/components/todo-list.tsx
const TEMP_ID_PREFIX = 'temp-';

export function TodoList() {
    const { data: todos } = useTodos();
    const createTodo = useCreateTodo();
    const [, startTransition] = useTransition();
    const [optimisticTodos, addOptimisticTodo] = useOptimistic(
        todos ?? [],
        (state, newTodo: Todo) => [...state, newTodo]
    );

    const handleCreate = (newTodo: NewTodo) => {
        // setter useOptimistic + mutacja w jednej transition (nie w onMutate)
        startTransition(async () => {
            addOptimisticTodo({ ...newTodo, id: `${TEMP_ID_PREFIX}${crypto.randomUUID()}` });
            try {
                await createTodo.mutateAsync(newTodo);
            } catch {
                // onError hooka zalogował błąd i pokazał toast; element tymczasowy znika po zakończeniu akcji
                logger.info('TODO_CREATE_ROLLED_BACK');
            }
        });
    };

    return (
        <>
        <NewTodoForm onCreate={handleCreate} />
        <ul>
            {optimisticTodos.map((todo) => (
                <li 
                    key={todo.id}
                    className={cn(
                        todo.id.startsWith(TEMP_ID_PREFIX) && 'opacity-50'
                    )}
                >
                    {todo.title}
                </li>
            ))}
        </ul>
        </>
    );
}
```

---

## Confirm Before Action

Akcja destrukcyjna (usunięcie, nadpisanie, wylogowanie innych sesji) ma jedno z dwóch zabezpieczeń:

- **Potwierdzenie** — dla operacji nieodwracalnych (trwałe usunięcie). Dialog nazywa skutek i ma przycisk z czasownikiem akcji („Usuń”), nie „OK”.
- **„Cofnij”** — dla operacji odwracalnych (archiwizacja, przeniesienie do kosza). Akcja wykonuje się od razu, a toast przez kilka sekund daje „Cofnij”; mniej tarcia niż dialog przy częstych akcjach.

Dotyczy to także akcji uruchamianych gestem (swipe w liście, responsive-design.md, sekcja Swipe Actions): gest łatwo wykonać przypadkiem, więc usunięcie z gestu przechodzi przez potwierdzenie albo daje „Cofnij”.

### useConfirm Hook

Dialog potwierdzenia jest jednym komponentem w providerze, a `useConfirm` tylko zwraca funkcję `confirm`. Komponent zdefiniowany wewnątrz hooka byłby nowym typem przy każdym renderze, więc React odmontowywałby i montował dialog od nowa (utrata fokusu i animacji). Stan dialogu to unia dyskryminowana: zamknięty albo otwarty z opcjami i funkcją `resolve`.
```typescript
// src/lib/errors.ts — obok ApiError
export class ContextMissingError extends Error {
    readonly code: string;
    constructor(code: string) {
        super(code);
        this.name = 'ContextMissingError';
        this.code = code;
    }
}
```
```typescript
// src/contexts/confirm-context.ts — kontekst osobno, żeby plik komponentu eksportował tylko komponent (Fast Refresh)
import { createContext } from 'react';

export interface ConfirmOptions {
    title: string;
    description: string;
    confirmText?: string;
    destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
```
```typescript
// src/components/confirm-provider.tsx
import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from '@/contexts/confirm-context';

type ConfirmState =
    | { status: 'closed' }
    | { status: 'open'; options: ConfirmOptions; resolve: (isConfirmed: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConfirmState>({ status: 'closed' });

    const confirm: ConfirmFn = (options) =>
        new Promise((resolve) => {
            setState({ status: 'open', options, resolve });
        });

    const close = (isConfirmed: boolean) => {
        // Drugie wywołanie resolve (onConfirm, potem onOpenChange(false)) nic nie zmienia —
        // promise jest już rozstrzygnięty
        if (state.status === 'open') state.resolve(isConfirmed);
        setState({ status: 'closed' });
    };

    return (
        <ConfirmContext value={confirm}>
            {children}
            {state.status === 'open' && (
                <ConfirmDialog
                    open
                    onOpenChange={(isOpen) => {
                        if (!isOpen) close(false);
                    }}
                    onConfirm={() => close(true)}
                    title={state.options.title}
                    description={state.options.description}
                    confirmText={state.options.confirmText}
                    destructive={state.options.destructive}
                />
            )}
        </ConfirmContext>
    );
}
```
```typescript
// src/hooks/use-confirm.ts
import { use } from 'react';

import { ConfirmContext, type ConfirmFn } from '@/contexts/confirm-context';
import { ContextMissingError } from '@/lib/errors';

export function useConfirm(): ConfirmFn {
    const confirm = use(ConfirmContext);
    if (!confirm) throw new ContextMissingError('CONFIRM_CONTEXT_MISSING');
    return confirm;
}
```

`ConfirmDialog` to komponent z sekcji „Podstawowy Dialog (Radix)” na górze pliku. Przy React Compilerze `confirm` nie potrzebuje `useCallback`; w projekcie bez Compilera owijasz go w `useCallback` dopiero wtedy, gdy trafia do zależności efektu albo do dziecka w `memo()`.

```typescript
// Użycie — ConfirmProvider owija aplikację (np. w src/app.tsx)
function DeleteButton({ id }: { id: string }) {
    const confirm = useConfirm();
    const deleteItem = useDeleteItem(); // hook z useMutation, onError loguje ITEM_DELETE_FAILED

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: 'Usuń element',
            description: 'Czy na pewno chcesz usunąć? Tej operacji nie można cofnąć.',
            confirmText: 'Usuń',
            destructive: true,
        });

        if (isConfirmed) {
            deleteItem.mutate(id);
        }
    };

    return (
        <Button variant="destructive" onClick={() => void handleDelete()}>
            Usuń
        </Button>
    );
}
```

### Cofnij zamiast potwierdzenia

Dla akcji odwracalnej toast z „Cofnij” pokazujesz w callbacku hooka, nie w callbacku przekazanym do `mutate(...)`: wiersz listy znika po invalidacji, a callbacki z `mutate(...)` nie wykonują się po odmontowaniu komponentu. Callbacki z definicji `useMutation` działają niezależnie od tego.
```typescript
// src/hooks/use-archive-item.ts
export function useArchiveItem() {
    const queryClient = useQueryClient();
    const restoreItem = useRestoreItem(); // hook z useMutation → itemService.restore, onError loguje ITEM_RESTORE_FAILED

    return useMutation({
        mutationFn: (id: string) => itemService.archive(id),
        onSuccess: (_result, id) => {
            toast('Przeniesiono do archiwum', {
                action: { label: 'Cofnij', onClick: () => restoreItem.mutate(id) },
            });
        },
        onError: (error) => {
            logger.error('ITEM_ARCHIVE_FAILED', error);
            toast.error('Nie udało się zarchiwizować');
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
    });
}

// Użycie: jedno kliknięcie, bez dialogu
<Button variant="outline" onClick={() => archiveItem.mutate(item.id)}>
    Archiwizuj
</Button>
```

---

## Podsumowanie

| Wzorzec | Implementacja |
|---------|---------------|
| **Loading w formularzu** | `isPending` mutacji z hooka (React Hook Form) albo `useActionState` + `useFormStatus` (formularz bez React Query) |
| **Loading poza formularzem** | `isPending` mutacji; akcja spoza React Query — `useTransition` z obsługą błędu (`AsyncButton`) |
| **Walidacja** | React Hook Form + Zod |
| **Optimistic updates** | `useOptimistic` + mutacja z hooka (`onSettled` zwraca promise invalidacji) |
| **Feedback** | Sonner toast |
| **Akcje destrukcyjne** | `useConfirm` z `ConfirmProvider` (nieodwracalne) albo toast z „Cofnij” (odwracalne) |
| **Focus trap** | Dialog z shadcn/ui (Radix) albo natywny `<dialog>` z `showModal()`; react-focus-lock tylko jako zgłoszona nowa zależność |

---

## Zobacz Także

- [accessibility.md](accessibility.md) - ARIA dla formularzy, rozmiar celu
- [animations.md](animations.md) - Loading animations
- [forms.md](../../tailwind-react-guidelines/resources/forms.md) - Kanoniczny `ContactForm`, React Hook Form + Zod
- [loading-and-error-states.md](../../tailwind-react-guidelines/resources/loading-and-error-states.md) - Patterns dla stanów