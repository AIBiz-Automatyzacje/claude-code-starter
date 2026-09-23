// MR-2da4b9
import { z } from 'zod';

/**
 * Prywatne notatki handlowca do własnej oferty (IU-MR) — warstwa danych.
 *
 * Moduł robi dwie rzeczy: waliduje wejście (odmowa z komunikatem nazywającym
 * problem, nigdy cicha korekta — wzorzec `validation.ts`) i składa wiersz do
 * insertu w `public.mr_notatki_oferty`. `autor_id` pochodzi WYŁĄCZNIE z sesji
 * wołającego, nie z danych wejściowych — schemat odrzuca payload, który
 * próbuje go podać.
 *
 * Baza jest drugą barierą: `mr_notatki_oferty_tresc_length_check` i polityki
 * RLS z migracji `20260923120000_mr_notatki_oferty.sql` pilnują tych samych
 * granic, ale tylko ten moduł potrafi powiedzieć po ludzku, co poszło nie tak.
 */

/** Znacznik modułu. */
export const MR_ZNACZNIK = '21bb51';

/**
 * Limit treści w ZNAKACH (punktach kodowych), tak jak `char_length` w CHECK-u
 * migracji. `String.length` liczy jednostki UTF-16 — notatka z emoji zostałaby
 * odrzucona przez aplikację, choć baza by ją przyjęła.
 */
export const MR_NOTATKA_MAX_ZNAKOW = 2000;

function liczbaZnakow(value: string): number {
  return Array.from(value).length;
}

function nadmiaroweKlucze(issue: object): string {
  const keys: unknown = Reflect.get(issue, 'keys');
  return Array.isArray(keys) ? keys.map(String).join(', ') : 'nieznane';
}

/**
 * Kształt wejścia „zapisz notatkę". `strictObject`: nadmiarowy klucz (zwłaszcza
 * `autor_id`) to odmowa, nie ciche pominięcie — tożsamość autora bierzemy
 * z sesji, a wołający, który ją podaje, ma się o tym dowiedzieć.
 */
export const mrNotatkaInputSchema = z.strictObject(
  {
    oferta_id: z.uuid({ error: 'oferta_id: wymagany identyfikator oferty w formacie UUID' }),
    tresc: z
      .string({ error: 'tresc: wymagany tekst notatki' })
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, { error: 'tresc: notatka nie może być pusta' })
          .refine((value) => liczbaZnakow(value) <= MR_NOTATKA_MAX_ZNAKOW, {
            error: `tresc: limit to ${MR_NOTATKA_MAX_ZNAKOW} znaków`,
          }),
      ),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? `niedozwolone pole (${nadmiaroweKlucze(issue)}) — notatka przyjmuje tylko oferta_id i tresc, autora ustala sesja`
        : 'wejście: oczekiwano obiektu z polami oferta_id i tresc',
  },
);

export type MrNotatkaInput = z.output<typeof mrNotatkaInputSchema>;

/** Wynik walidacji — discriminated union, nie flaga + opcjonalne pola. */
export type MrNotatkaWalidacja =
  | { readonly status: 'ok'; readonly wartosc: MrNotatkaInput }
  | { readonly status: 'odmowa'; readonly komunikat: string };

/** Wiersz do insertu w `public.mr_notatki_oferty` (id i created_at nadaje baza). */
export interface MrNotatkaRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/** Błąd programisty/sesji przy składaniu wiersza — nie odmowa walidacji wejścia. */
export class MrNotatkaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MrNotatkaError';
  }
}

/**
 * Waliduje surowe wejście (granica API). Zwraca znormalizowaną wartość albo
 * odmowę z komunikatem po polsku, który nazywa każdy problem.
 *
 * @mr a98dc0
 */
export function validateMrNotatka(input: unknown): MrNotatkaWalidacja {
  const result = mrNotatkaInputSchema.safeParse(input);
  if (result.success) {
    return { status: 'ok', wartosc: result.data };
  }

  const problemy = result.error.issues.map((issue) => issue.message);
  return { status: 'odmowa', komunikat: `Odmowa zapisu notatki:\n${problemy.join('\n')}` };
}

const autorIdSchema = z.uuid();

/**
 * Składa wiersz do insertu z ZWALIDOWANEGO wejścia i identyfikatora autora
 * z sesji. Fail fast: `autor_id` spoza formatu UUID to błąd wołającego
 * (sesja nie została ustalona), więc rzuca `MrNotatkaError` zamiast wysłać
 * wiersz, który RLS i tak by odrzucił bez czytelnego powodu.
 *
 * @mr a98dc0
 */
export function buildMrNotatkaRow(input: MrNotatkaInput, autorId: string): MrNotatkaRow {
  if (!autorIdSchema.safeParse(autorId).success) {
    throw new MrNotatkaError('autor_id: brak poprawnego identyfikatora zalogowanego użytkownika (UUID)');
  }

  return {
    oferta_id: input.oferta_id,
    autor_id: autorId,
    tresc: input.tresc,
  };
}
