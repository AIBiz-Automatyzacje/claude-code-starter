// MR-ce6cd7
import { z } from 'zod';

/**
 * Notatki handlowca do własnej oferty (IU-MR).
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po imieniu, nigdy cichą korektą (poza zdjęciem białych
 * znaków z brzegów — zapisujemy dokładnie to, co zmierzyliśmy).
 *
 * Tożsamość autora NIE przychodzi z ładunku: schemat jest ścisły
 * (`z.strictObject`), więc `autor_id` podany przez klienta jest odmową, a do
 * wiersza trafia wyłącznie `autorId` zweryfikowany przez wołającego.
 */

/** Znacznik modułu. */
export const MR_ZNACZNIK = '4cdd71';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql`. Liczony w punktach kodowych, tak
 * jak `char_length` w bazie — `string.length` liczy jednostki UTF-16 i przy
 * emoji odrzucałby treść, którą baza przyjmuje.
 */
export const MR_NOTATKA_MAX_ZNAKOW = 2000;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

const mrNotatkaSchema = z.strictObject({
  oferta_id: z.uuid({ error: 'oferta_id: wymagany identyfikator oferty w formacie uuid' }),
  tresc: z
    .string({ error: 'tresc: wymagany tekst notatki' })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine((value) => value.length > 0, {
          error: 'tresc: notatka nie może być pusta',
        })
        .refine((value) => codePointLength(value) <= MR_NOTATKA_MAX_ZNAKOW, {
          error: `tresc: notatka może mieć najwyżej ${MR_NOTATKA_MAX_ZNAKOW} znaków`,
        }),
    ),
}, {
  // Nazw nieznanych pól nie cytujemy — to tekst zza granicy zaufania.
  error: (issue) =>
    issue.code === 'unrecognized_keys'
      ? 'notatka: dozwolone są wyłącznie pola oferta_id i tresc (autora ustala serwer)'
      : 'notatka: wymagany obiekt z polami oferta_id i tresc',
});

export type MrNotatkaInput = z.input<typeof mrNotatkaSchema>;

export interface ValidatedMrNotatka {
  readonly ofertaId: string;
  /** Treść po trim, 1–`MR_NOTATKA_MAX_ZNAKOW` punktów kodowych. */
  readonly tresc: string;
}

export type MrNotatkaValidationResult =
  | { readonly ok: true; readonly value: ValidatedMrNotatka }
  | { readonly ok: false; readonly message: string };

/** Kolumny, które wolno podać przy INSERT (grant kolumnowy migracji). */
export interface MrNotatkaInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/**
 * Waliduje wejście notatki. Zwraca wynik albo odmowę z komunikatem po polsku,
 * nazywającym każde pole, które nie przeszło.
 *
 * @mr 2f8832
 */
export function validateMrNotatka(input: unknown): MrNotatkaValidationResult {
  const result = mrNotatkaSchema.safeParse(input);

  if (result.success) {
    return { ok: true, value: { ofertaId: result.data.oferta_id, tresc: result.data.tresc } };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return { ok: false, message: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

/**
 * Buduje wiersz do insertu. `autorId` pochodzi ze zweryfikowanej sesji
 * wołającego, nigdy z ładunku; `id` i `created_at` nadaje baza.
 *
 * @mr 2f8832
 */
export function buildMrNotatkaInsertRow(
  notatka: ValidatedMrNotatka,
  autorId: string,
): MrNotatkaInsertRow {
  return { oferta_id: notatka.ofertaId, autor_id: autorId, tresc: notatka.tresc };
}
