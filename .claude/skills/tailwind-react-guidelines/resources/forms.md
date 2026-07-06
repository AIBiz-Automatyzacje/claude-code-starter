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

Dla prostych formularzy bez zaawansowanej walidacji:
```typescript
import { useActionState } from 'react';

const [state, submitAction, isPending] = useActionState(
    async (_prev, formData: FormData) => {
        const email = formData.get('email') as string;
        if (!email) return { error: 'Email wymagany' };
        await api.subscribe(email);
        return { error: null, success: true };
    },
    { error: null, success: false }
);

<form action={submitAction}>
    <Input name="email" type="email" />
    <Button type="submit" disabled={isPending}>Zapisz</Button>
</form>
```

**Kiedy `useActionState`:** 1-3 pola, brak złożonej walidacji, progressive enhancement.
**Kiedy React Hook Form:** >3 pola, Zod walidacja, wizard, dynamic fields, DevTools.

---

## Setup
```bash
npm install react-hook-form zod @hookform/resolvers
```

---

## Podstawowy Formularz
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 1. SCHEMA
const contactSchema = z.object({
    name: z.string().min(2, 'Minimum 2 znaki'),
    email: z.email('Nieprawidłowy adres email'),
    message: z.string().min(10, 'Minimum 10 znaków').max(500, 'Maximum 500 znaków'),
});

// 2. TYP ZE SCHEMA
type ContactForm = z.infer<typeof contactSchema>;

// 3. KOMPONENT
export function ContactForm() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<ContactForm>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            email: '',
            message: '',
        },
    });

    const onSubmit = async (data: ContactForm) => {
        await api.sendContact(data);
        reset();
        toast.success('Wiadomość wysłana!');
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Imię</Label>
                <Input
                    id="name"
                    {...register('name')}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                    <p id="name-error" role="alert" className="text-sm text-destructive">
                        {errors.name.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                    <p id="email-error" role="alert" className="text-sm text-destructive">
                        {errors.email.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="message">Wiadomość</Label>
                <Textarea
                    id="message"
                    {...register('message')}
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                />
                {errors.message && (
                    <p id="message-error" role="alert" className="text-sm text-destructive">
                        {errors.message.message}
                    </p>
                )}
            </div>

            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Wysyłanie...' : 'Wyślij'}
            </Button>
        </form>
    );
}
```

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
const templateSchema = z.object({
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

type TemplateForm = z.infer<typeof templateSchema>;
```

### Walidacja Warunkowa
```typescript
const paymentSchema = z.object({
    method: z.enum(['card', 'transfer', 'blik']),
    cardNumber: z.string().optional(),
    bankAccount: z.string().optional(),
}).refine(
    (data) => {
        if (data.method === 'card') return !!data.cardNumber;
        if (data.method === 'transfer') return !!data.bankAccount;
        return true;
    },
    {
        message: 'Uzupełnij dane płatności',
        path: ['cardNumber'], // Gdzie pokazać błąd
    }
);

// Lub superRefine dla wielu błędów
const schema = z.object({
    password: z.string(),
    confirmPassword: z.string(),
}).superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Hasła nie są identyczne',
            path: ['confirmPassword'],
        });
    }
});
```

---

## Integracja z React Query

### useMutation dla Submit
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function CreateTemplateForm({ onSuccess }: { onSuccess?: () => void }) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<TemplateForm>({
        resolver: zodResolver(templateSchema),
    });

    const mutation = useMutation({
        mutationFn: api.createTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            reset();
            toast.success('Szablon utworzony!');
            onSuccess?.();
        },
        onError: (error) => {
            toast.error('Nie udało się utworzyć szablonu');
        },
    });

    return (
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            {/* Pola formularza */}

            <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    const queryClient = useQueryClient();

    // Pobierz dane do edycji
    const { data: template, isLoading } = useQuery({
        queryKey: ['template', templateId],
        queryFn: () => api.getTemplate(templateId),
    });

    const form = useForm<TemplateForm>({
        resolver: zodResolver(templateSchema),
        values: template, // Automatycznie wypełnia gdy dane się załadują
    });

    const mutation = useMutation({
        mutationFn: (data: TemplateForm) => api.updateTemplate(templateId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            queryClient.invalidateQueries({ queryKey: ['template', templateId] });
            toast.success('Zapisano zmiany');
        },
    });

    if (isLoading) return <FormSkeleton />;

    return (
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            {/* ... */}
        </form>
    );
}
```

---

## Komponent FormField (Reużywalny)
```typescript
// components/FormField.tsx
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
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'email-error' : undefined}
    />
</FormField>
```

---

## Kontrolowane Komponenty (Select, Checkbox, Radio)

### useController dla Custom Components
```typescript
import { useForm, useController, type Control } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ControlledSelectProps {
    name: string;
    control: Control<any>;
    options: { value: string; label: string }[];
    placeholder?: string;
}

function ControlledSelect({ name, control, options, placeholder }: ControlledSelectProps) {
    const {
        field,
        fieldState: { error },
    } = useController({ name, control });

    return (
        <div className="space-y-2">
            <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!error}>
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
                <p role="alert" className="text-sm text-destructive">
                    {error.message}
                </p>
            )}
        </div>
    );
}

// Użycie
const { control, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
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
import { useController, type Control } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';

interface CheckboxGroupProps {
    name: string;
    control: Control<any>;
    options: { value: string; label: string }[];
}

function CheckboxGroup({ name, control, options }: CheckboxGroupProps) {
    const { field, fieldState: { error } } = useController({ name, control });
    const values: string[] = field.value || [];

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
                        onCheckedChange={(checked) => handleChange(opt.value, !!checked)}
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
```typescript
import { useState } from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
    terms: z.literal(true, { error: 'Musisz zaakceptować regulamin' }),
});

// Pełna schema (Zod v4: .extend(shape) zamiast .merge(schema))
const fullSchema = step1Schema.extend(step2Schema.shape).extend(step3Schema.shape);
type WizardForm = z.infer<typeof fullSchema>;

// Schema dla każdego kroku (do walidacji częściowej)
const stepSchemas = [step1Schema, step2Schema, step3Schema];

export function WizardForm() {
    const [step, setStep] = useState(0);

    const methods = useForm<WizardForm>({
        resolver: zodResolver(fullSchema),
        mode: 'onChange',
        defaultValues: {
            name: '',
            email: '',
            company: '',
            role: '',
            plan: 'free',
            terms: false,
        },
    });

    const { handleSubmit, trigger } = methods;

    const nextStep = async () => {
        // Waliduj tylko pola z bieżącego kroku
        const fields = Object.keys(stepSchemas[step].shape) as (keyof WizardForm)[];
        const isValid = await trigger(fields);
        
        if (isValid) {
            setStep((s) => Math.min(s + 1, stepSchemas.length - 1));
        }
    };

    const prevStep = () => {
        setStep((s) => Math.max(s - 1, 0));
    };

    const onSubmit = async (data: WizardForm) => {
        await api.createAccount(data);
        toast.success('Konto utworzone!');
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Progress */}
                <StepIndicator currentStep={step} totalSteps={3} />

                {/* Kroki */}
                {step === 0 && <Step1 />}
                {step === 1 && <Step2 />}
                {step === 2 && <Step3 />}

                {/* Nawigacja */}
                <div className="flex justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={step === 0}
                    >
                        Wstecz
                    </Button>

                    {step < stepSchemas.length - 1 ? (
                        <Button type="button" onClick={nextStep}>
                            Dalej
                        </Button>
                    ) : (
                        <Button type="submit">
                            Zakończ
                        </Button>
                    )}
                </div>
            </form>
        </FormProvider>
    );
}

// Komponenty kroków używają useFormContext
function Step1() {
    const { register, formState: { errors } } = useFormContext<WizardForm>();

    return (
        <div className="space-y-4">
            <FormField name="name" label="Imię" error={errors.name} required>
                <Input id="name" {...register('name')} />
            </FormField>
            <FormField name="email" label="Email" error={errors.email} required>
                <Input id="email" type="email" {...register('email')} />
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
```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const uploadSchema = z.object({
    title: z.string().min(1, 'Wymagane'),
    file: z
        .instanceof(File, { message: 'Wybierz plik' })
        .refine((file) => file.size <= MAX_FILE_SIZE, 'Maksymalny rozmiar to 5MB')
        .refine(
            (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
            'Dozwolone formaty: JPG, PNG, WebP'
        ),
});

// Dla opcjonalnego pliku
const optionalFileSchema = z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, 'Max 5MB')
    .optional();
```

### Kontrolowany File Input
```typescript
import { useForm, useController } from 'react-hook-form';
import { Upload, X } from 'lucide-react';

function FileUploadForm() {
    const { control, handleSubmit, formState: { errors } } = useForm<UploadForm>({
        resolver: zodResolver(uploadSchema),
    });

    const { field, fieldState } = useController({ name: 'file', control });
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            field.onChange(file);
            
            // Preview dla obrazów
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                setPreview(url);
            }
        }
    };

    const handleRemove = () => {
        field.onChange(undefined);
        if (preview) {
            URL.revokeObjectURL(preview);
            setPreview(null);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label>Plik</Label>
                
                {!field.value ? (
                    <label
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-32",
                            "border-2 border-dashed rounded-lg cursor-pointer",
                            "hover:bg-muted/50 transition-colors",
                            fieldState.error && "border-destructive"
                        )}
                    >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                            Kliknij lub przeciągnij plik
                        </span>
                        <input
                            type="file"
                            className="hidden"
                            accept={ACCEPTED_IMAGE_TYPES.join(',')}
                            onChange={handleFileChange}
                        />
                    </label>
                ) : (
                    <div className="relative inline-block">
                        {preview && (
                            <img
                                src={preview}
                                alt="Preview"
                                className="h-32 w-32 object-cover rounded-lg"
                            />
                        )}
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {fieldState.error && (
                    <p role="alert" className="text-sm text-destructive">
                        {fieldState.error.message}
                    </p>
                )}
            </div>

            <Button type="submit">Wyślij</Button>
        </form>
    );
}
```

### Upload z Progress
```typescript
const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    },
});

// Dla progress potrzebujesz XMLHttpRequest lub axios
const uploadWithProgress = (file: File, onProgress: (percent: number) => void) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error('Upload failed'));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    });
};
```

---

## Dostępność (A11y)

### Wymagane Atrybuty
```typescript
<Input
    id="email"                                    // Powiązanie z Label
    {...register('email')}
    aria-invalid={!!errors.email}                 // Stan błędu
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
```typescript
const { handleSubmit, setFocus } = useForm<FormData>({
    resolver: zodResolver(schema),
});

const onSubmit = handleSubmit(
    (data) => {
        // Success
    },
    (errors) => {
        // Focus na pierwszym błędzie
        const firstError = Object.keys(errors)[0] as keyof FormData;
        if (firstError) {
            setFocus(firstError);
        }
    }
);
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
```typescript
const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
});

const mutation = useMutation({
    mutationFn: api.login,
    onError: (error: ApiError) => {
        // Błąd konkretnego pola
        if (error.field) {
            form.setError(error.field as keyof LoginForm, {
                type: 'server',
                message: error.message,
            });
        } else {
            // Błąd ogólny
            form.setError('root', {
                type: 'server',
                message: error.message,
            });
        }
    },
});

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
const form = useForm<FormData>({
    defaultValues: {
        name: '',
        email: '',
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