// MR-3088cd
import { z } from 'zod';

/**
 * Notatki handlowca do własnej oferty (IU-MR): walidacja wejścia i wiersz do
 * insertu w `public.mr_notatki_oferty`.
 *
 * Wzorem `validation.ts` każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem — nigdy cichą korektą (poza obcięciem białych znaków
 * na brzegach, które nie zmienia treści notatki).
 *
 * Tożsamość autora NIE pochodzi z ładunku: `buildNoteRow` bierze `autor_id`
 * wyłącznie z argumentu (zweryfikowana sesja), a schemat usuwa nieznane
 * klucze (strip), więc `autor_id` z ładunku nie przechodzi dalej. RLS w bazie
 * i tak wymaga `autor_id = auth.uid()`.
 */

export const MR_ZNACZNIK = '68b43c';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql`. Baza liczy `char_length`, czyli
 * PUNKTY KODOWE, więc serwer liczy tą samą jednostką — `z.string().max`
 * liczy jednostki UTF-16 i odmawiałby notatek, które baza przyjmuje
 * (1001 emoji = 1001 znaków w bazie, 2002 jednostki w JS).
 */
const NOTE_MAX_LENGTH = 2000;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

const noteTextSchema = z
  .string({ error: 'tresc: wymagany tekst notatki' })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, { error: 'tresc: notatka nie może być pusta' })
      .refine((value) => codePointLength(value) <= NOTE_MAX_LENGTH, {
        error: `tresc: limit to ${NOTE_MAX_LENGTH} znaków`,
      }),
  );

/** Kształt wejścia notatki. Klucze polskie jak kolumny tabeli. */
export const noteInputSchema = z
  .object({
    oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być UUID' }),
    tresc: noteTextSchema,
  })
  .brand<'ZwalidowanaNotatka'>();

/** Wejście po walidacji — marka typu wymusza przejście przez `validateNoteInput`. */
export type ValidNoteInput = z.output<typeof noteInputSchema>;

export type NoteValidationResult =
  | { readonly status: 'ok'; readonly note: ValidNoteInput }
  | { readonly status: 'odmowa'; readonly message: string };

/** Kolumny, które rola `authenticated` ma prawo podać przy INSERT (grant kolumnowy). */
export interface NoteInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/**
 * Waliduje wejście notatki. Zwraca notatkę gotową do zapisu albo odmowę
 * z komunikatem po polsku nazywającym każde złamane pole.
 *
 * @mr b65463
 */
export function validateNoteInput(input: unknown): NoteValidationResult {
  const result = noteInputSchema.safeParse(input);

  if (result.success) {
    return { status: 'ok', note: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return { status: 'odmowa', message: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

/**
 * Składa wiersz do insertu. `authorId` MUSI pochodzić ze zweryfikowanej sesji
 * (`auth.getUser`), nigdy z ładunku wołającego.
 *
 * @mr b65463
 */
export function buildNoteRow(note: ValidNoteInput, authorId: string): NoteInsertRow {
  return {
    oferta_id: note.oferta_id,
    autor_id: authorId,
    tresc: note.tresc,
  };
}
