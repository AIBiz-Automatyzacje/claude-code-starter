// MR-8c057f
import { z } from 'zod';

/**
 * Notatki handlowca do opublikowanej oferty (IU-MR) — warstwa walidacji
 * i budowy wiersza dla `public.mr_notatki_oferty`
 * (migracja `20260923120000_mr_notatki_oferty.sql`).
 *
 * Wzorzec z `validation.ts`: każda niepoprawna wartość kończy się ODMOWĄ
 * z komunikatem nazywającym problem po imieniu — nigdy cichą korektą
 * (poza przycięciem białych znaków, które jest częścią kontraktu treści).
 *
 * Tożsamość autora NIE pochodzi z wejścia: `autor_id` dokłada wołający z sesji
 * (`zbudujWierszNotatki`), a wejście z polem `autor_id` dostaje odmowę zamiast
 * cichego odrzucenia klucza — żeby nikt nie uwierzył, że podpisał notatkę
 * cudzym identyfikatorem. Drugą barierą jest polityka INSERT w bazie.
 */

/** Znacznik modułu wymagany przez proces MR. */
export const MR_ZNACZNIK = '787f77';

/**
 * Limit treści = `mr_notatki_oferty_tresc_length_check`. Zod liczy jednostki
 * UTF-16, Postgres `char_length` — punkty kodowe, więc ta bramka jest co
 * najwyżej SUROWSZA od bazy: nic, co przejdzie tutaj, nie zostanie odrzucone
 * przez CHECK bez zdania, które da się pokazać handlowcowi.
 */
export const NOTATKA_TRESC_MAX = 2000;

/** Typowana odmowa — jedyny błąd, jaki rzuca albo zwraca ten moduł. */
export class NotatkaOfertyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotatkaOfertyError';
  }
}

/**
 * Kształt wejścia „zapisz notatkę". `strictObject`, bo nieznany klucz
 * (zwłaszcza `autor_id`) ma dać odmowę, a nie zniknąć po cichu.
 */
export const notatkaOfertyInputSchema = z.strictObject(
  {
    oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być poprawnym UUID' }),
    tresc: z
      .string({ error: 'tresc: wymagany tekst notatki' })
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, { error: 'tresc: notatka nie może być pusta' })
          .max(NOTATKA_TRESC_MAX, {
            error: `tresc: notatka przekracza limit ${NOTATKA_TRESC_MAX} znaków`,
          }),
      ),
  },
  { error: 'Wejście notatki musi być obiektem z polami oferta_id i tresc' },
);

export type NotatkaOfertyInput = z.input<typeof notatkaOfertyInputSchema>;

/** Wejście po walidacji — `tresc` już przycięta. */
export interface NotatkaOferty {
  readonly oferta_id: string;
  readonly tresc: string;
}

/** Wynik walidacji jako unia rozróżnialna — bez flag boolowskich. */
export type WynikWalidacjiNotatki =
  | { readonly status: 'poprawna'; readonly notatka: NotatkaOferty }
  | { readonly status: 'odmowa'; readonly blad: NotatkaOfertyError };

/** Wiersz gotowy do `insert` w `public.mr_notatki_oferty`. */
export interface WierszNotatkiOferty {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

function opisProblemu(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') {
    return `Niedozwolone pola w notatce: ${issue.keys.join(', ')} (dozwolone: oferta_id, tresc)`;
  }

  const path = issue.path.map(String).join('.');

  return path.length > 0 && !issue.message.startsWith(path)
    ? `${path}: ${issue.message}`
    : issue.message;
}

/**
 * Waliduje wejście notatki. Zwraca `poprawna` z przyciętą treścią albo
 * `odmowa` z błędem, którego komunikat nazywa każdy problem po polsku.
 *
 * @mr 610fab
 */
export function walidujNotatke(input: unknown): WynikWalidacjiNotatki {
  const result = notatkaOfertyInputSchema.safeParse(input);

  if (result.success) {
    return { status: 'poprawna', notatka: result.data };
  }

  const problemy = result.error.issues.map(opisProblemu);

  return {
    status: 'odmowa',
    blad: new NotatkaOfertyError(`Odmowa zapisu notatki:\n${problemy.join('\n')}`),
  };
}

const autorIdSchema = z.uuid();

/**
 * Składa wiersz do insertu z ZWALIDOWANEJ notatki i identyfikatora autora
 * z sesji (nigdy z wejścia). Rzuca `NotatkaOfertyError`, gdy `autorId` nie
 * jest UUID — pusty albo zniekształcony identyfikator sesji to błąd wołającego,
 * którego nie wolno zamienić w wiersz odrzucony dopiero przez bazę.
 *
 * @mr 610fab
 */
export function zbudujWierszNotatki(notatka: NotatkaOferty, autorId: string): WierszNotatkiOferty {
  if (!autorIdSchema.safeParse(autorId).success) {
    throw new NotatkaOfertyError(
      'Odmowa zapisu notatki: identyfikator autora z sesji nie jest poprawnym UUID',
    );
  }

  return {
    oferta_id: notatka.oferta_id,
    autor_id: autorId,
    tresc: notatka.tresc,
  };
}
