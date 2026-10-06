# Formularze

React Hook Form + Zod - walidacja, dostępność, integracja z React Query.

---

## Dlaczego React Hook Form + Zod

| Cecha | React Hook Form | Kontrolowany useState |
|-------|-----------------|----------------------|
| Re-rendery | Minimalne (uncontrolled) | Każdy keystroke |
| Walidacja | Deklaratywna (Zod) | Imperatywna |
| Performance | Świetna | Słaba przy dużych formach |
| DevTools | Tak | Nie |
| Boilerplate | Mały | Duży |

### Alternatywa: useActionState (React 19)

Dla prostych formularzy bez zaawansowanej walidacji. Akcja leży w hooku: parsuje `FormData` schematem Zod (dane z formularza to wejście z zewnątrz), woła serwis i zwraca stan jako unię dyskryminowaną zamiast pary flag `error`/`success`:
```typescript
// src/hooks/use-subscribe.ts
import { useActionState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { newsletterService } from '@/services/newsletter-service';

const subscribeSchema = z.strictObject({
    email: z.email('Nieprawidłowy adres email'),
});

export type SubscribeState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string };

const INITIAL_SUBSCRIBE_STATE: SubscribeState = { status: 'idle' };

async function subscribeAction(_previous: SubscribeState, formData: FormData): Promise<SubscribeState> {
    const parsed = subscribeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
        return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' };
    }
    try {
        await newsletterService.subscribe(parsed.data.email);
        return { status: 'success' };
    } catch (error) {
        logger.error('NEWSLETTER_SUBSCRIBE_FAILED', error);
        return { status: 'error', message: 'Nie udało się zapisać. Spróbuj ponownie.' };
    }
}

export function useSubscribe() {
    return useActionState(subscribeAction, INITIAL_SUBSCRIBE_STATE);
}
```
```typescript
// src/components/newsletter-form.tsx
export function NewsletterForm() {
    const [state, submitAction, isPending] = useSubscribe();
    const hasError = state.status === 'error';

    return (
        <form action={submitAction} className="space-y-2">
            <Label htmlFor="newsletter-email">Email</Label>
            <Input
                id="newsletter-email"
                name="email"
                type="email"
                aria-invalid={hasError ? true : undefined}
                aria-describedby={hasError ? 'newsletter-error' : undefined}
            />
            {state.status === 'error' && (
                <p id="newsletter-error" role="alert" className="text-sm text-destructive">
                    {state.message}
                </p>
            )}
            {state.status === 'success' && (
                <p role="status" className="text-sm text-muted-foreground">Zapisano do newslettera</p>
            )}
            <Button type="submit" disabled={isPending}>Zapisz</Button>
        </form>
    );
}
```

**Kiedy `useActionState`:** 1-3 pola, brak złożonej walidacji, progressive enhancement.
**Kiedy React Hook Form:** >3 pola, Zod walidacja, wizard, dynamic fields, DevTools.

---

## Setup

Pakiety: `react-hook-form`, `zod`, `@hookform/resolvers`. Sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach). Instalujesz menedżerem z lockfile projektu z dokładną wersją, np.:
```bash
pnpm add -E react-hook-form zod @hookform/resolvers
```

---

## Podstawowy Formularz

Kanoniczny `ContactForm` (ten sam komponent opisują component-ux.md i testing.md). Schemat i typ leżą w osobnym module, bo korzystają z nich formularz, hook i serwis. Wysyłka idzie przez hook z `useMutation`, który woła serwis — komponent nie woła API wprost.
```typescript
// src/schemas/contact-schema.ts
import { z } from 'zod';

export const contactSchema = z.strictObject({
    name: z.string().min(2, 'Minimum 2 znaki').max(100, 'Maksymalnie 100 znaków'),
    email: z.email('Nieprawidłowy adres email'),
    message: z.string().min(10, 'Minimum 10 znaków').max(2000, 'Maksymalnie 2000 znaków'),
});

// Typ ze schematu; nazwa `ContactValues`, bo `FormData` przesłania globalny typ DOM, a `ContactForm` to nazwa komponentu
export type ContactValues = z.infer<typeof contactSchema>;
```
```typescript
// src/hooks/use-send-contact.ts
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import type { ContactValues } from '@/schemas/contact-schema';
import { contactService } from '@/services/contact-service';

export function useSendContact() {
    return useMutation({
        mutationFn: (values: ContactValues) => contactService.send(values),
        onError: (error) => {
            logger.error('CONTACT_SEND_FAILED', error);
            toast.error('Nie udało się wysłać wiadomości');
        },
    });
}
```
```typescript
// src/components/contact-form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSendContact } from '@/hooks/use-send-contact';
import { contactSchema, type ContactValues } from '@/schemas/contact-schema';

function FieldErrorMessage({ id, message }: { id: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} role="alert" className="text-sm text-destructive">
            {message}
        </p>
    );
}

export function ContactForm({ onSuccess }: { onSuccess?: () => void }) {
    const sendContact = useSendContact();
    const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: { name: '', email: '', message: '' },
    });

    const handleValidSubmit = (values: ContactValues) => {
        sendContact.mutate(values, {
            onSuccess: () => {
                reset();
                toast.success('Wiadomość wysłana!');
                onSuccess?.();
            },
        });
    };

    return (
        // handleSubmit zwraca promise — `void` mówi lintowi, że wynik świadomie pomijamy
        <form onSubmit={(event) => void handleSubmit(handleValidSubmit)(event)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Imię</Label>
                <Input
                    id="name"
                    {...register('name')}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                />
                <FieldErrorMessage id="name-error" message={errors.name?.message} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                />
                <FieldErrorMessage id="email-error" message={errors.email?.message} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="message">Wiadomość</Label>
                <Textarea
                    id="message"
                    {...register('message')}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                />
                <FieldErrorMessage id="message-error" message={errors.message?.message} />
            </div>

            <Button type="submit" disabled={sendContact.isPending}>
                {sendContact.isPending ? 'Wysyłanie...' : 'Wyślij'}
            </Button>
        </form>
    );
}
```

**Kontrakt dla testów:** pole bez błędu nie ma atrybutu `aria-invalid` (wartość `undefined` usuwa go z DOM, więc test sprawdza `not.toHaveAttribute('aria-invalid')`); pole z błędem ma `aria-invalid="true"` i `aria-describedby` wskazujące na `<p role="alert">`. Przy kilku błędach naraz na stronie jest kilka alertów — test używa `getAllByRole('alert')`. Serwis `contactService.send` korzysta z klienta API z [file-organization.md](./file-organization.md) (sekcja `lib/`).

---

## Zod Schemas - Wzorce

### Podstawowe Walidatory
```typescript
import { z } from 'zod';

// Stringi
z.string().min(1, 'Wymagane')
z.email('Nieprawidłowy email')
z.url('Nieprawidłowy URL')
z.string().regex(/^\d{9}$/, 'Nieprawidłowy numer telefonu')

// Liczby
z.number().min(0, 'Minimum 0').max(100, 'Maximum 100')
z.coerce.number() // Konwertuje string z inputa na number

// Boolean
z.boolean()
z.literal(true, { error: 'Musisz zaakceptować regulamin' })

// Enum
z.enum(['draft', 'published', 'archived'])

// Opcjonalne
z.string().optional()
z.string().nullable()
z.string().nullish() // null | undefined

// Transformacje
z.string().trim()
z.string().toLowerCase()
z.string().transform(val => val.toUpperCase())
```

### Złożone Schema
```typescript
// src/schemas/template-schema.ts
import { z } from 'zod';

export const templateSchema = z.object({
    name: z.string().min(1, 'Nazwa jest wymagana').max(100),
    description: z.string().max(500).optional(),
    category: z.enum(['marketing', 'sales', 'hr', 'other']),
    isPublic: z.boolean().default(false),
    tags: z.array(z.string()).min(1, 'Dodaj przynajmniej jeden tag').max(5),
    settings: z.object({
        notifications: z.boolean(),
        theme: z.enum(['light', 'dark', 'system']),
    }),
});

export type TemplateValues = z.infer<typeof templateSchema>;
```

### Walidacja Warunkowa

Pola zależne od wyboru opisujesz unią dyskryminowaną, nie zestawem pól opcjonalnych z `refine`: typ wymaga numeru karty tylko przy `method: 'card'`, kod po zawężeniu `method` widzi właściwe pole, a błąd trafia do niego bez ręcznego `path`.
```typescript
const paymentSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('card'),
        cardNumber: z.string().min(1, 'Uzupełnij numer karty'),
    }),
    z.object({
        method: z.literal('transfer'),
        bankAccount: z.string().min(1, 'Uzupełnij numer konta'),
    }),
    z.object({
        method: z.literal('blik'),
    }),
]);

// z.infer<typeof paymentSchema>:
// { method: 'card'; cardNumber: string } | { method: 'transfer'; bankAccount: string } | { method: 'blik' }
```

Relację między polami (np. powtórzone hasło) sprawdzasz w `superRefine`, który dodaje błąd do wskazanego pola:
```typescript
const schema = z.object({
    password: z.string(),
    confirmPassword: z.string(),
}).superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({
            code: 'custom',
            message: 'Hasła nie są identyczne',
            path: ['confirmPassword'],
        });
    }
});
```

---

## Integracja z React Query

### Hooki szablonów (zapytanie, mutacje, klucze)

Definicje `useQuery`/`useMutation` leżą w hooku, który woła serwis; formularz wywołuje tylko hook. Klucze zapytań pochodzą z jednej fabryki, a `onSuccess` zwraca promise invalidacji, więc mutacja kończy się dopiero po odświeżeniu danych. `invalidateQueries({ queryKey: templateKeys.all })` odświeża listę i szczegóły naraz, bo oba klucze zaczynają się od `templateKeys.all`.
```typescript
// src/hooks/use-templates.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import type { TemplateValues } from '@/schemas/template-schema';
import { templateService, type TemplateFilters } from '@/services/template-service';

export const templateKeys = {
    all: ['templates'] as const,
    list: (filters: TemplateFilters) => [...templateKeys.all, 'list', filters] as const,
    detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
};

export function useTemplate(templateId: string) {
    return useQuery({
        queryKey: templateKeys.detail(templateId),
        queryFn: ({ signal }) => templateService.get(templateId, signal),
    });
}

export function useCreateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (values: TemplateValues) => templateService.create(values),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
        onError: (error) => {
            logger.error('TEMPLATE_CREATE_FAILED', error);
            toast.error('Nie udało się utworzyć szablonu');
        },
    });
}

export function useUpdateTemplate(templateId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (values: TemplateValues) => templateService.update(templateId, values),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
        onError: (error) => {
            logger.error('TEMPLATE_UPDATE_FAILED', error);
            toast.error('Nie udało się zapisać zmian');
        },
    });
}
```

### useMutation dla Submit
```typescript
// src/components/create-template-form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCreateTemplate } from '@/hooks/use-templates';
import { templateSchema, type TemplateValues } from '@/schemas/template-schema';

export function CreateTemplateForm({ onSuccess }: { onSuccess?: () => void }) {
    const createTemplate = useCreateTemplate();
    const { register, handleSubmit, formState: { errors }, reset } = useForm<TemplateValues>({
        resolver: zodResolver(templateSchema),
    });

    const handleValidSubmit = (values: TemplateValues) => {
        createTemplate.mutate(values, {
            onSuccess: () => {
                reset();
                toast.success('Szablon utworzony!');
                onSuccess?.();
            },
        });
    };

    return (
        <form onSubmit={(event) => void handleSubmit(handleValidSubmit)(event)}>
            {/* Pola formularza: register(...) i errors jak w ContactForm */}

            <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Tworzenie...
                    </>
                ) : (
                    'Utwórz szablon'
                )}
            </Button>
        </form>
    );
}
```

### Edycja z Prefill
```typescript
export function EditTemplateForm({ templateId }: { templateId: string }) {
    const template = useTemplate(templateId);
    const updateTemplate = useUpdateTemplate(templateId);

    const form = useForm<TemplateValues>({
        resolver: zodResolver(templateSchema),
        values: template.data, // Wypełnia formularz, gdy dane się załadują
    });

    const handleValidSubmit = (values: TemplateValues) => {
        updateTemplate.mutate(values, {
            onSuccess: () => toast.success('Zapisano zmiany'),
        });
    };

    if (template.isPending) return <FormSkeleton />;

    if (template.isError) {
        return (
            <div role="alert" className="space-y-2">
                <p className="text-sm text-destructive">Nie udało się wczytać szablonu</p>
                <Button variant="outline" onClick={() => void template.refetch()}>
                    Spróbuj ponownie
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={(event) => void form.handleSubmit(handleValidSubmit)(event)}>
            {/* ... */}
        </form>
    );
}
```

---

## Komponent FormField (Reużywalny)
```typescript
// src/components/form-field.tsx
import { type FieldError } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
    name: string;
    label: string;
    error?: FieldError;
    required?: boolean;
    children: React.ReactNode;
    description?: string;
}

export function FormField({
    name,
    label,
    error,
    required,
    children,
    description,
}: FormFieldProps) {
    const errorId = `${name}-error`;
    const descriptionId = `${name}-description`;

    return (
        <div className="space-y-2">
            <Label htmlFor={name} className={cn(required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
                {label}
            </Label>
            
            {description && (
                <p id={descriptionId} className="text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            
            {children}
            
            {error && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error.message}
                </p>
            )}
        </div>
    );
}

// Użycie
<FormField name="email" label="Email" error={errors.email} required>
    <Input
        id="email"
        type="email"
        {...register('email')}
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={errors.email ? 'email-error' : undefined}
    />
</FormField>
```

---

## Kontrolowane Komponenty (Select, Checkbox, Radio)

### useController dla Custom Components

Komponent jest generyczny po typie wartości formularza: `Control<T>` i `FieldPath<T>` zamiast `Control<any>`, więc literówka w `name` to błąd kompilacji. `field.value` ma typ zależny od `T`, dlatego zawężasz go type guardem do typu, którego oczekuje kontrolka.
```typescript
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ControlledSelectProps<T extends FieldValues> {
    name: FieldPath<T>;
    control: Control<T>;
    options: { value: string; label: string }[];
    placeholder?: string;
}

function ControlledSelect<T extends FieldValues>({ name, control, options, placeholder }: ControlledSelectProps<T>) {
    const {
        field,
        fieldState: { error },
    } = useController({ name, control });
    const value = typeof field.value === 'string' ? field.value : undefined;
    const errorId = `${name}-error`;

    return (
        <div className="space-y-2">
            <Select value={value} onValueChange={field.onChange}>
                {/* ref z useController pozwala RHF ustawić fokus na polu z błędem */}
                <SelectTrigger
                    ref={field.ref}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {error && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error.message}
                </p>
            )}
        </div>
    );
}

// Użycie — T wynika z `control`, więc `name` podpowiada tylko pola TemplateValues
const { control, handleSubmit } = useForm<TemplateValues>({
    resolver: zodResolver(templateSchema),
});

<ControlledSelect
    name="category"
    control={control}
    options={[
        { value: 'marketing', label: 'Marketing' },
        { value: 'sales', label: 'Sprzedaż' },
    ]}
    placeholder="Wybierz kategorię"
/>
```

### Checkbox Group
```typescript
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';

interface CheckboxGroupProps<T extends FieldValues> {
    name: FieldPath<T>;
    control: Control<T>;
    options: { value: string; label: string }[];
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function CheckboxGroup<T extends FieldValues>({ name, control, options }: CheckboxGroupProps<T>) {
    const { field, fieldState: { error } } = useController({ name, control });
    const values = isStringArray(field.value) ? field.value : [];

    const handleChange = (value: string, checked: boolean) => {
        if (checked) {
            field.onChange([...values, value]);
        } else {
            field.onChange(values.filter((v) => v !== value));
        }
    };

    return (
        <div className="space-y-3">
            {options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        checked={values.includes(opt.value)}
                        onCheckedChange={(checked) => handleChange(opt.value, checked === true)}
                    />
                    <span className="text-sm">{opt.label}</span>
                </label>
            ))}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error.message}
                </p>
            )}
        </div>
    );
}
```

---

## Multi-Step Forms (Wizard)

Pola każdego kroku trzymasz w stałej `STEP_FIELDS` (`as const satisfies`): `trigger` dostaje nazwy pól sprawdzone przez kompilator, bez rzutowania `Object.keys(...) as ...`. Utworzenie konta idzie przez hook `useCreateAccount()` (mutacja z logiem błędu, wzorzec jak `useSendContact`).
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm, useFormContext, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useCreateAccount } from '@/hooks/use-create-account';

// Schema dla każdego kroku
const step1Schema = z.object({
    name: z.string().min(1, 'Wymagane'),
    email: z.email('Nieprawidłowy email'),
});

const step2Schema = z.object({
    company: z.string().min(1, 'Wymagane'),
    role: z.string().min(1, 'Wymagane'),
});

const step3Schema = z.object({
    plan: z.enum(['free', 'pro', 'enterprise']),
    // boolean z refine zamiast z.literal(true): wartość domyślna false zgadza się z typem formularza
    terms: z.boolean().refine((value) => value, { error: 'Musisz zaakceptować regulamin' }),
});

// Pełna schema (Zod v4: .extend(shape) zamiast .merge(schema))
const fullSchema = step1Schema.extend(step2Schema.shape).extend(step3Schema.shape);
type WizardValues = z.infer<typeof fullSchema>;

// Pola każdego kroku (do walidacji częściowej przez trigger)
const STEP_FIELDS = [
    ['name', 'email'],
    ['company', 'role'],
    ['plan', 'terms'],
] as const satisfies readonly (readonly FieldPath<WizardValues>[])[];

const LAST_STEP = STEP_FIELDS.length - 1;

const WIZARD_DEFAULT_VALUES: WizardValues = {
    name: '',
    email: '',
    company: '',
    role: '',
    plan: 'free',
    terms: false,
};

export function WizardForm() {
    const [step, setStep] = useState(0);
    const createAccount = useCreateAccount();

    const methods = useForm<WizardValues>({
        resolver: zodResolver(fullSchema),
        mode: 'onChange',
        defaultValues: WIZARD_DEFAULT_VALUES,
    });

    const { handleSubmit, trigger } = methods;

    const goToNextStep = async () => {
        // Waliduj tylko pola z bieżącego kroku
        const isValid = await trigger(STEP_FIELDS[step]);
        if (isValid) {
            setStep((current) => Math.min(current + 1, LAST_STEP));
        }
    };

    const goToPreviousStep = () => {
        setStep((current) => Math.max(current - 1, 0));
    };

    const handleValidSubmit = (values: WizardValues) => {
        createAccount.mutate(values, {
            onSuccess: () => toast.success('Konto utworzone!'),
        });
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={(event) => void handleSubmit(handleValidSubmit)(event)} className="space-y-6">
                {/* Progress */}
                <StepIndicator currentStep={step} totalSteps={STEP_FIELDS.length} />

                {/* Kroki */}
                {step === 0 && <Step1 />}
                {step === 1 && <Step2 />}
                {step === 2 && <Step3 />}

                <WizardNavigation
                    isFirstStep={step === 0}
                    isLastStep={step === LAST_STEP}
                    isSubmitting={createAccount.isPending}
                    onPrevious={goToPreviousStep}
                    onNext={() => void goToNextStep()}
                />
            </form>
        </FormProvider>
    );
}

interface WizardNavigationProps {
    isFirstStep: boolean;
    isLastStep: boolean;
    isSubmitting: boolean;
    onPrevious: () => void;
    onNext: () => void;
}

// Nawigacja jako osobny komponent: krok formularza i przyciski mają osobne odpowiedzialności
function WizardNavigation({ isFirstStep, isLastStep, isSubmitting, onPrevious, onNext }: WizardNavigationProps) {
    return (
        <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onPrevious} disabled={isFirstStep}>
                Wstecz
            </Button>

            {isLastStep ? (
                <Button type="submit" disabled={isSubmitting}>
                    Zakończ
                </Button>
            ) : (
                <Button type="button" onClick={onNext}>
                    Dalej
                </Button>
            )}
        </div>
    );
}

// Komponenty kroków używają useFormContext
function Step1() {
    const { register, formState: { errors } } = useFormContext<WizardValues>();

    return (
        <div className="space-y-4">
            <FormField name="name" label="Imię" error={errors.name} required>
                <Input
                    id="name"
                    {...register('name')}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                />
            </FormField>
            <FormField name="email" label="Email" error={errors.email} required>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                />
            </FormField>
        </div>
    );
}
```

### Step Indicator
```typescript
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
    labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
    return (
        <div className="flex items-center justify-between">
            {Array.from({ length: totalSteps }).map((_, index) => (
                <div key={index} className="flex items-center">
                    {/* Krok */}
                    <div
                        className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                            index < currentStep && "bg-primary text-primary-foreground",
                            index === currentStep && "border-2 border-primary text-primary",
                            index > currentStep && "border-2 border-muted text-muted-foreground"
                        )}
                    >
                        {index < currentStep ? (
                            <Check className="h-4 w-4" />
                        ) : (
                            index + 1
                        )}
                    </div>

                    {/* Linia łącząca */}
                    {index < totalSteps - 1 && (
                        <div
                            className={cn(
                                "w-12 h-0.5 mx-2",
                                index < currentStep ? "bg-primary" : "bg-muted"
                            )}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
```

---

## Upload Plików

### Schema z File

Zod v4 ma `z.file()` z wbudowanymi sprawdzeniami rozmiaru (`.max`) i typu MIME (`.mime`), więc nie potrzebujesz `z.instanceof(File)` z ręcznymi `refine`.
```typescript
// src/schemas/upload-schema.ts
import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const uploadSchema = z.object({
    title: z.string().min(1, 'Wymagane'),
    file: z
        .file({ error: 'Wybierz plik' })
        .max(MAX_FILE_SIZE_BYTES, 'Maksymalny rozmiar to 5 MB')
        .mime([...ACCEPTED_IMAGE_TYPES], 'Dozwolone formaty: JPG, PNG, WebP'),
});

export type UploadValues = z.infer<typeof uploadSchema>;

// Dla opcjonalnego pliku
export const optionalFileSchema = z
    .file()
    .max(MAX_FILE_SIZE_BYTES, 'Maksymalny rozmiar to 5 MB')
    .optional();
```

### Kontrolowany File Input

Podgląd obrazka to adres `blob:` z `URL.createObjectURL`; efekt zwalnia go przy zmianie pliku i przy odmontowaniu, więc podgląd nie zostaje w pamięci. Input pliku ma klasę `sr-only` (nie `hidden`), żeby był osiągalny klawiaturą, a przycisk usuwania ma widoczne 24×24 px i pole trafienia 44×44 px rozszerzone pseudo-elementem (próg rozmiaru celu: [accessibility.md](../../ux-ui-guidelines/resources/accessibility.md)).
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useController, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useUploadFile } from '@/hooks/use-upload-file';
import { cn } from '@/lib/utils';
import { ACCEPTED_IMAGE_TYPES, uploadSchema, type UploadValues } from '@/schemas/upload-schema';

export function FileUploadForm() {
    const uploadFile = useUploadFile();
    const { control, handleSubmit } = useForm<UploadValues>({
        resolver: zodResolver(uploadSchema),
    });
    const { field, fieldState } = useController({ name: 'file', control });
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!preview) return;
        return () => URL.revokeObjectURL(preview);
    }, [preview]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        field.onChange(file);
        // Preview dla obrazów
        setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    };

    const handleRemove = () => {
        field.onChange(undefined);
        setPreview(null);
    };

    const handleValidSubmit = (values: UploadValues) => {
        uploadFile.mutate(values.file);
    };

    return (
        <form onSubmit={(event) => void handleSubmit(handleValidSubmit)(event)} className="space-y-4">
            <div className="space-y-2">
                <Label>Plik</Label>
                {field.value ? (
                    <FilePreview preview={preview} onRemove={handleRemove} />
                ) : (
                    <FileDropzone hasError={fieldState.error !== undefined} onChange={handleFileChange} />
                )}
                {fieldState.error && (
                    <p role="alert" className="text-sm text-destructive">
                        {fieldState.error.message}
                    </p>
                )}
            </div>

            <Button type="submit" disabled={uploadFile.isPending}>Wyślij</Button>
        </form>
    );
}

interface FileDropzoneProps {
    hasError: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function FileDropzone({ hasError, onChange }: FileDropzoneProps) {
    return (
        <label
            className={cn(
                "flex flex-col items-center justify-center w-full h-32",
                "border-2 border-dashed rounded-lg cursor-pointer",
                "hover:bg-muted/50 transition-colors focus-within:ring-2 focus-within:ring-ring",
                hasError && "border-destructive"
            )}
        >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
                Kliknij lub przeciągnij plik
            </span>
            <input
                type="file"
                className="sr-only"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={onChange}
            />
        </label>
    );
}

function FilePreview({ preview, onRemove }: { preview: string | null; onRemove: () => void }) {
    return (
        <div className="relative inline-block">
            {preview && (
                <img
                    src={preview}
                    alt="Podgląd wybranego pliku"
                    className="h-32 w-32 object-cover rounded-lg"
                />
            )}
            <button
                type="button"
                onClick={onRemove}
                aria-label="Usuń plik"
                className={cn(
                    "absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full",
                    "bg-destructive text-destructive-foreground",
                    // Pole trafienia 44×44 px przy widocznych 24×24 px
                    "after:absolute after:-inset-2.5 after:content-['']"
                )}
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
```

### Upload z Progress

Odpowiedź serwera ma kopertę `{ data, error: { code, message } }`, którą parsujesz `z.strictObject`; przy `error` rzucasz `ApiError` z kodem. Klient JSON z [file-organization.md](./file-organization.md) ustawia nagłówek JSON, dlatego upload `FormData` ma własne wywołanie — z tymi samymi zasadami: limit czasu, parsowanie Zod, typowany błąd.
```typescript
// src/services/upload-service.ts
import { z } from 'zod';

import { ApiError } from '@/lib/errors';

const UPLOAD_URL = '/api/upload';
const UPLOAD_TIMEOUT_MS = 60_000;

const uploadResultSchema = z.strictObject({
    url: z.url(),
    size: z.number().int().nonnegative(),
});

export type UploadResult = z.infer<typeof uploadResultSchema>;

const uploadEnvelopeSchema = z.strictObject({
    data: uploadResultSchema.nullable(),
    error: z.strictObject({ code: z.string(), message: z.string() }).nullable(),
});

function parseUploadResponse(status: number, body: unknown): UploadResult {
    const envelope = uploadEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
        throw new ApiError('UPLOAD_INVALID_RESPONSE', 'Nieprawidłowa odpowiedź serwera', status);
    }
    const { data, error } = envelope.data;
    if (error) throw new ApiError(error.code, error.message, status);
    if (!data) throw new ApiError('UPLOAD_EMPTY_RESPONSE', 'Odpowiedź bez danych', status);
    return data;
}

function toFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
}

export async function uploadFile(file: File): Promise<UploadResult> {
    const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: toFormData(file),
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new ApiError('UPLOAD_INVALID_RESPONSE', 'Odpowiedź serwera nie jest JSON', response.status);
    }
    const body: unknown = await response.json();
    return parseUploadResponse(response.status, body);
}

// Dla progress potrzebujesz XMLHttpRequest (fetch nie raportuje postępu wysyłki)
export function uploadFileWithProgress(file: File, onProgress: (percent: number) => void): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = UPLOAD_TIMEOUT_MS;
        xhr.responseType = 'json';

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const body: unknown = xhr.response;
                resolve(parseUploadResponse(xhr.status, body));
            } catch (error) {
                reject(error); // Błąd idzie dalej, do onError mutacji
            }
        });

        xhr.addEventListener('error', () => {
            reject(new ApiError('UPLOAD_NETWORK_ERROR', 'Błąd sieci podczas wysyłki'));
        });
        xhr.addEventListener('timeout', () => {
            reject(new ApiError('UPLOAD_TIMEOUT', 'Przekroczono limit czasu wysyłki'));
        });

        xhr.open('POST', UPLOAD_URL);
        xhr.send(toFormData(file));
    });
}
```
```typescript
// src/hooks/use-upload-file.ts
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { uploadFile } from '@/services/upload-service';

export function useUploadFile() {
    return useMutation({
        mutationFn: (file: File) => uploadFile(file),
        onError: (error) => {
            logger.error('UPLOAD_FAILED', error);
            toast.error('Nie udało się wysłać pliku');
        },
    });
}
```

---

## Dostępność (A11y)

### Wymagane Atrybuty

Komunikat błędu wiążesz z polem przez `aria-describedby` — ma najszersze wsparcie czytników ekranu; `aria-errormessage` możesz dodać jako uzupełnienie, nie zamiast. `aria-invalid` ustawiasz tylko przy błędzie (`undefined` usuwa atrybut z DOM).
```typescript
<Input
    id="email"                                    // Powiązanie z Label
    {...register('email')}
    aria-invalid={errors.email ? true : undefined} // Stan błędu (bez błędu atrybutu nie ma)
    aria-describedby={errors.email ? 'email-error' : undefined}  // Powiązanie z komunikatem
    aria-required="true"                          // Wymagane pole
/>

{errors.email && (
    <p 
        id="email-error"                          // ID dla aria-describedby
        role="alert"                              // Ogłasza screen readerom
        className="text-sm text-destructive"
    >
        {errors.email.message}
    </p>
)}
```

### Focus na Pierwszym Błędzie

React Hook Form sam ustawia fokus na pierwszym polu z błędem po nieudanym submit (`shouldFocusError: true` jest domyślne), więc nie szukasz pierwszego błędu ręcznie przez `Object.keys(errors)` i rzutowanie. Warunek: pole przekazuje `ref` — `register` robi to sam, a komponent kontrolowany przekazuje `field.ref` z `useController` (jak `SelectTrigger` w `ControlledSelect`).
```typescript
const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    shouldFocusError: true, // wartość domyślna, zapisana tu dla czytelności
});

// Ręczny fokus — gdy błąd przychodzi spoza walidacji schematu (np. z serwera)
form.setError(
    'email',
    { type: 'server', message: 'Ten adres jest już zapisany' },
    { shouldFocus: true }
);

// Albo fokus na konkretnym polu po akcji użytkownika
form.setFocus('message');
```

### Live Validation Feedback
```typescript
const { register, formState: { errors, dirtyFields } } = useForm({
    mode: 'onChange', // Walidacja przy każdej zmianie
});

// Pokaż błąd tylko gdy pole było edytowane
{dirtyFields.email && errors.email && (
    <p role="alert">{errors.email.message}</p>
)}
```

---

## Tryby Walidacji

| Mode | Kiedy waliduje | Użycie |
|------|---------------|--------|
| `onSubmit` | Tylko przy submit | Domyślne, większość formularzy |
| `onChange` | Każda zmiana | Real-time feedback |
| `onBlur` | Opuszczenie pola | Balans UX/performance |
| `onTouched` | Po pierwszym blur, potem onChange | Najlepszy UX |
| `all` | Wszystko | Rzadko potrzebne |
```typescript
const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched', // Rekomendowane dla UX
});
```

---

## Obsługa Błędów Serwera

Serwer zwraca błąd w kopercie `{ data, error: { code, message } }`, a serwis rzuca `ApiError` z tym kodem. Formularz łapie konkretny typ (`instanceof ApiError`), mapuje kod na pole przez stałą mapę (bez rzutowania `as keyof`) i rozróżnia oczekiwaną odmowę (4xx z kodem biznesowym: ślad `logger.info` bez zdarzenia Sentry) od awarii (`logger.error`). Mutacja leży w hooku `useLogin()` (`mutationFn: (values: LoginValues) => authService.login(values)`); `onError` przy wywołaniu `mutate`, bo potrzebuje `form`.
```typescript
const FIRST_SERVER_ERROR_STATUS = 500;

// Kod błędu z API → pole formularza; kod spoza mapy trafia do błędu ogólnego (root)
const LOGIN_FIELD_BY_ERROR_CODE: Partial<Record<string, FieldPath<LoginValues>>> = {
    EMAIL_NOT_FOUND: 'email',
    INVALID_PASSWORD: 'password',
};

const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
});
const login = useLogin();

const handleLoginError = (error: Error) => {
    const isRejection =
        error instanceof ApiError && error.status !== undefined && error.status < FIRST_SERVER_ERROR_STATUS;
    if (!isRejection) {
        logger.error('LOGIN_FAILED', error);
        form.setError('root', { type: 'server', message: 'Nie udało się zalogować. Spróbuj ponownie.' });
        return;
    }
    logger.info('LOGIN_REJECTED', { status: error.status, code: error.code });
    // Błąd konkretnego pola albo, gdy kod nie wskazuje pola, błąd ogólny
    const field = LOGIN_FIELD_BY_ERROR_CODE[error.code] ?? 'root';
    form.setError(field, { type: 'server', message: error.message }, { shouldFocus: true });
};

const handleValidSubmit = (values: LoginValues) => {
    login.mutate(values, { onError: handleLoginError });
};

// Wyświetlanie błędu root
{form.formState.errors.root && (
    <div role="alert" className="p-3 rounded-md bg-destructive/10 text-destructive">
        {form.formState.errors.root.message}
    </div>
)}
```

---

## Reset i Wartości Domyślne
```typescript
// Typ wartości z nazwą domenową (ContactValues), nie `FormData` — ta nazwa przesłania globalny typ DOM
const form = useForm<ContactValues>({
    defaultValues: {
        name: '',
        email: '',
        message: '',
    },
});

// Reset do defaultValues
form.reset();

// Reset do konkretnych wartości
form.reset({ name: 'Jan', email: 'jan@example.com' });

// Reset pojedynczego pola
form.resetField('name');

// Zachowaj niektóre wartości
form.reset(undefined, { keepDirtyValues: true });
```

---

## DevTools

`@hookform/devtools` to osobny pakiet: sprawdź package.json, a nową zależność zgłoś (w workflowie: w odchyleniach) i instaluj jako zależność deweloperską z dokładną wersją (`pnpm add -D -E @hookform/devtools`).
```typescript
// Tylko w development
import { DevTool } from '@hookform/devtools';

function MyForm() {
    const { control } = useForm();

    return (
        <>
            <form>{/* ... */}</form>
            {import.meta.env.DEV && <DevTool control={control} />}
        </>
    );
}
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Kontrolowane komponenty
- [loading-and-error-states.md](./loading-and-error-states.md) - useMutation patterns
- [typescript-standards.md](./typescript-standards.md) - Zod schemas