// MR-7307c6
import { z } from 'zod';

/**
 * Prywatne notatki handlowca do własnej oferty (`public.mr_notatki_oferty`).
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po imieniu, nigdy cichą korektą (poza przycięciem
 * białych znaków na brzegach, które nie zmienia sensu notatki). Baza trzyma
 * ten sam sufit `CHECK`-iem — token MCP idzie prosto do PostgREST, więc to
 * ona jest barierą; ten moduł jest pierwszy i to on mówi w rozmowie, co
 * dokładnie poszło nie tak.
 */

export const MR_ZNACZNIK = 'c2bad7';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_shape_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql`. Liczony w PUNKTACH KODOWYCH, jak
 * `char_length` w Postgresie — `String.prototype.length` liczy jednostki
 * UTF-16 i rozjechałby się z bazą dla znaków spoza BMP (emoji).
 */
export const NOTE_MAX_LENGTH = 2000;

function codePointLength(value: string): number {
  return [...value].length;
}

const noteContentSchema = z
  .string({ error: 'wymagany tekst notatki' })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, { error: 'notatka nie może być pusta' })
      .refine((value) => codePointLength(value) <= NOTE_MAX_LENGTH, {
        error: `limit to ${NOTE_MAX_LENGTH} znaków`,
      }),
  );

/** Kształt wywołania „dodaj notatkę". Klucze = kolumny tabeli. */
export const noteInputSchema = z.object(
  {
    oferta_id: z.uuid({ error: 'identyfikator oferty musi być uuid' }),
    tresc: noteContentSchema,
  },
  { error: 'oczekiwano obiektu z polami oferta_id i tresc' },
);

export type NoteInput = z.output<typeof noteInputSchema>;

export type NoteValidationResult =
  | { readonly success: true; readonly data: NoteInput }
  | { readonly success: false; readonly message: string };

/** Wiersz do `insert` — wyłącznie kolumny objęte grantem INSERT migracji. */
export interface NoteInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/**
 * Waliduje wejście notatki. Zwraca dane po przycięciu treści albo odmowę
 * z komunikatem po polsku, który wymienia każde błędne pole.
 *
 * @mr 5bcdd0
 */
export function validateNoteInput(input: unknown): NoteValidationResult {
  const result = noteInputSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, message: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

/**
 * Składa wiersz do wstawienia. `autorId` pochodzi z sesji wołającego
 * (`auth.getUser`), nigdy z wejścia — polityka INSERT i tak odrzuci
 * `autor_id` różny od `auth.uid()`. `id` i `created_at` nadaje baza.
 *
 * @mr 5bcdd0
 */
export function buildNoteRow(input: NoteInput, autorId: string): NoteInsertRow {
  return { oferta_id: input.oferta_id, autor_id: autorId, tresc: input.tresc };
}
