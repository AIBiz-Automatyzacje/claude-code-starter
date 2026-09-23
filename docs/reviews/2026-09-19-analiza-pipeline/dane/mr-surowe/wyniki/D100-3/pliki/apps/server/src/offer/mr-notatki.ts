// MR-85d1df
import { z } from 'zod';

/**
 * Prywatne notatki handlowca do własnej oferty (IU-MR) — warstwa danych.
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po polsku, nigdy cichą korektą (poza obcięciem białych
 * znaków na brzegach, które nie zmienia sensu treści). Limity są lustrem
 * `mr_notatki_oferty_tresc_length_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql` — baza jest drugą barierą, ta pierwszą.
 *
 * `autor_id` NIGDY nie pochodzi z wejścia: schemat go nie przyjmuje, a
 * `buildNotatkaRow` bierze go osobnym argumentem z sesji (JWT).
 */

/** @mr b5feb2 Znacznik modułu. */
export const MR_ZNACZNIK = '81b36e';

/** @mr b5feb2 Górny limit treści notatki — równy CHECK-owi w bazie. */
export const NOTATKA_TRESC_MAX = 2000;

/**
 * @mr b5feb2
 * Wejście dodania notatki: `oferta_id` (uuid) i `tresc` (po trim 1–2000 znaków).
 * Obiekt ścisły — nadmiarowy klucz (np. podrzucony `autor_id`) to odmowa,
 * nie ciche pominięcie.
 */
export const notatkaInputSchema = z.strictObject(
  {
    oferta_id: z.uuid({ error: 'oferta_id: wymagany identyfikator oferty w formacie uuid' }),
    tresc: z
      .string({ error: 'tresc: wymagany tekst notatki' })
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, { error: 'tresc: notatka nie może być pusta' })
          .max(NOTATKA_TRESC_MAX, {
            error: `tresc: limit to ${NOTATKA_TRESC_MAX} znaków`,
          }),
      ),
  },
  { error: 'Notatka: nieznane pole w danych wejściowych' },
);

export type NotatkaInput = z.input<typeof notatkaInputSchema>;
export type NotatkaDane = z.output<typeof notatkaInputSchema>;

/** Wynik walidacji — unia rozłączna zamiast flagi `ok: boolean` + opcjonalnych pól. */
export type NotatkaWalidacja =
  | { readonly status: 'poprawna'; readonly dane: NotatkaDane }
  | { readonly status: 'odmowa'; readonly komunikat: string };

/** Wiersz do `insert` w `public.mr_notatki_oferty` (id i created_at nadaje baza). */
export interface NotatkaRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/** Błąd budowy wiersza — wołający podał tożsamość, której nie da się zapisać. */
export class NotatkaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotatkaError';
  }
}

const autorIdSchema = z.uuid({ error: 'autor_id: wymagany identyfikator użytkownika w formacie uuid' });

function komunikatZ(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return `Odmowa zapisu notatki:\n${issues.join('\n')}`;
}

/**
 * @mr b5feb2
 * Waliduje wejście notatki. Nie rzuca: zwraca dane po trim albo odmowę
 * z komunikatem po polsku nazywającym każdy problem.
 */
export function validateNotatka(input: unknown): NotatkaWalidacja {
  const result = notatkaInputSchema.safeParse(input);

  if (result.success) {
    return { status: 'poprawna', dane: result.data };
  }

  return { status: 'odmowa', komunikat: komunikatZ(result.error) };
}

/**
 * @mr b5feb2
 * Buduje wiersz do insertu z ZWALIDOWANEGO wejścia i id autora z sesji.
 * Fail fast: `autor_id` spoza formatu uuid to `NotatkaError`, nie wiersz,
 * który odbije się dopiero od bazy. Właściciela oferty sprawdza RLS.
 */
export function buildNotatkaRow(dane: NotatkaDane, autorId: string): NotatkaRow {
  const autor = autorIdSchema.safeParse(autorId);

  if (!autor.success) {
    throw new NotatkaError(komunikatZ(autor.error));
  }

  return {
    oferta_id: dane.oferta_id,
    autor_id: autor.data,
    tresc: dane.tresc,
  };
}
