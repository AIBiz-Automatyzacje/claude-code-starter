// MR-9effc9
import { z } from 'zod';

/**
 * Notatki handlowca do opublikowanej oferty (IU-MR) — warstwa walidacji.
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po imieniu, nigdy cichą korektą. Jedyne przekształcenie
 * to obcięcie białych znaków z brzegów treści — i to obcięta wartość jest
 * mierzona i zapisywana.
 *
 * Limity są lustrem `mr_notatki_oferty_tresc_length_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql`. Baza jest drugą barierą, ta jest
 * pierwszą i to ona mówi po polsku, co poszło nie tak.
 */

/** @mr a7fa6a Znacznik modułu. */
export const MR_ZNACZNIK = '72072f';

/** Limit treści notatki w znakach (punkty kodowe, jak `char_length` w Postgresie). */
export const MR_NOTATKA_MAX_ZNAKOW = 2000;

/**
 * Długość w punktach kodowych. `String.prototype.length` liczy jednostki
 * UTF-16, więc emoji liczyłoby się podwójnie i serwer odrzucałby notatkę,
 * którą baza (`char_length`) by przyjęła.
 */
function dlugoscZnakow(value: string): number {
  return [...value].length;
}

/**
 * @mr a7fa6a
 * Kształt wejścia „dodaj notatkę". `autor_id` celowo NIE jest częścią wejścia —
 * pochodzi z uwierzytelnionej sesji i dokłada go `zbudujWierszNotatki`.
 */
export const mrNotatkaWejscieSchema = z.object({
  oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być poprawnym UUID' }),
  tresc: z
    .string({ error: 'tresc: wymagany tekst notatki' })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine((value) => dlugoscZnakow(value) >= 1, {
          error: 'tresc: notatka nie może być pusta',
        })
        .refine((value) => dlugoscZnakow(value) <= MR_NOTATKA_MAX_ZNAKOW, {
          error: `tresc: limit to ${MR_NOTATKA_MAX_ZNAKOW} znaków`,
        }),
    ),
});

export type MrNotatkaWejscie = z.input<typeof mrNotatkaWejscieSchema>;

export type MrNotatkaZwalidowana = z.output<typeof mrNotatkaWejscieSchema>;

/** Wynik walidacji — unia rozróżnialna po `rodzaj`, bez flag boolowskich. */
export type MrWynikWalidacjiNotatki =
  | { readonly rodzaj: 'ok'; readonly notatka: MrNotatkaZwalidowana }
  | { readonly rodzaj: 'odmowa'; readonly komunikat: string };

/** Wiersz do `insert` w `public.mr_notatki_oferty`. */
export interface MrWierszNotatki {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/** Błąd programistyczny: próba zbudowania wiersza bez poprawnej tożsamości autora. */
export class MrNotatkaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MrNotatkaError';
  }
}

/**
 * @mr a7fa6a
 * Waliduje wejście „dodaj notatkę". Zwraca notatkę z obciętą treścią albo
 * odmowę z komunikatem po polsku, który wymienia każde naruszone pole.
 */
export function walidujNotatke(input: unknown): MrWynikWalidacjiNotatki {
  const result = mrNotatkaWejscieSchema.safeParse(input);

  if (result.success) {
    return { rodzaj: 'ok', notatka: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return { rodzaj: 'odmowa', komunikat: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

const autorIdSchema = z.uuid();

/**
 * @mr a7fa6a
 * Składa wiersz do insertu z ZWALIDOWANEJ notatki i identyfikatora autora
 * z sesji (JWT). Tożsamość nigdy nie pochodzi z wejścia klienta; polityka RLS
 * `mr_notatki_oferty_insert_owner` wymusza to samo po stronie bazy.
 *
 * @throws {MrNotatkaError} gdy `autorId` nie jest poprawnym UUID.
 */
export function zbudujWierszNotatki(
  notatka: MrNotatkaZwalidowana,
  autorId: string,
): MrWierszNotatki {
  if (!autorIdSchema.safeParse(autorId).success) {
    throw new MrNotatkaError('autor_id: identyfikator autora musi być poprawnym UUID z sesji');
  }

  return {
    oferta_id: notatka.oferta_id,
    autor_id: autorId,
    tresc: notatka.tresc,
  };
}
