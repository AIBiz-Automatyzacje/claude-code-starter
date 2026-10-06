#!/usr/bin/env python3
"""Testy wyboru faz ślepego testu P12 (test_review_p12_fazy.py): IU z planu, klasa uwagi bota, ranking.

Uruchomienie: python3 -m unittest skrypty/test_review_p12_fazy_test.py (z katalogu analizy)."""
import os, sys, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p12_fazy as F

PLAN = '''## Fazy
### Faza 1 — Dane

- [x] **IU-1: Tabela**

**Pliki:**
- Stwórz: `supabase/migrations/001_a.sql`

**Delegate to:** feature-builder-data

### Faza 2 — Widok

**Zależy od:** Faza 1

- [ ] **IU-3: Hook**

**Pliki:**
- Stwórz: `apps/dashboard/src/hooks/use-a.ts`, `apps/dashboard/src/hooks/use-a.test.ts`

**Delegate to:** feature-builder-data

- [ ] **IU-4: Ekran**

**Pliki:**
- Stwórz: `apps/dashboard/src/features/a/a-view.tsx`
- Modyfikuj: `apps/dashboard/src/lib/api.ts` (eksport)

**Delegate to:** feature-builder-fullstack-figma

- [ ] **IU-5: Przycisk (plan starszy niż delegacja)**

**Pliki:**
- Stwórz: `apps/dashboard/src/components/b.tsx`

## Granice
- nic
'''


class IuFazy(unittest.TestCase):
    def test_bierze_tylko_jednostki_wskazanej_fazy_z_delegacja_i_plikami(self):
        iu = F.iu_fazy(PLAN, 2)
        self.assertEqual([x['id'] for x in iu], ['IU-3', 'IU-4', 'IU-5'])
        self.assertEqual(iu[0]['agentType'], 'feature-builder-data')
        self.assertEqual(iu[1]['pliki'], ['apps/dashboard/src/features/a/a-view.tsx', 'apps/dashboard/src/lib/api.ts'])

    def test_bez_delegacji_typ_po_plikach_jak_planner(self):
        self.assertEqual(F.iu_fazy(PLAN, 2)[2]['agentType'], 'feature-builder-ui')
        self.assertEqual(F.typ_po_plikach(['apps/a/src/lib/x.ts', 'apps/a/src/components/y.tsx']), 'feature-builder-fullstack')
        self.assertEqual(F.typ_po_plikach(['supabase/migrations/1.sql']), 'feature-builder-data')

    def test_warstwa_ui_obejmuje_warianty_figma(self):
        self.assertTrue(F.ma_ui([{'agentType': 'feature-builder-fullstack-figma'}]))
        self.assertFalse(F.ma_ui([{'agentType': 'feature-builder-data'}]))


class KlasaKlucza1(unittest.TestCase):
    def test_przypadek_bota_przez_slownik_i_nadpisania(self):
        uwagi = {('9', '22'): 'polkniety-blad-stara-nazwa', ('4', '95'): 'cache-limiter'}
        mapa = {'polkniety-blad-stara-nazwa': 'sciezka-bledu', 'cache-limiter': 'cache-i-zapytania'}
        self.assertEqual(F.klasa_klucza1('B-09-22', uwagi, mapa, {('9', '22'): 'polkniety-blad'}), 'polkniety-blad')
        self.assertEqual(F.klasa_klucza1('B-04-95', uwagi, mapa, {}), 'cache-i-zapytania')
        self.assertIsNone(F.klasa_klucza1('B-04-999', uwagi, mapa, {}))


class BazaBuildu(unittest.TestCase):
    def test_rodzic_ostatniego_commita_feat_w_zakresie_fazy(self):
        log = ['1de5a4c fix(claude): sonda', '257df3d docs(x): stan', 'a2a296a feat(faza-7): IU-13', '9999999 feat(faza-7): IU-1']
        self.assertEqual(F.commit_fazy(log), 'a2a296a')
        self.assertIsNone(F.commit_fazy(['1de5a4c fix(claude): sonda']))

    def test_klucz_w_zakresie_gdy_plik_zmieniony_w_fazie(self):
        zmienione = {'apps/a/src/x.ts', 'supabase/migrations/1.sql'}
        self.assertTrue(F.w_zakresie({'plik': 'apps/a/src/x.ts'}, zmienione))
        self.assertTrue(F.w_zakresie({'plik': 'apps/a/src/x.ts:12'}, zmienione))
        self.assertFalse(F.w_zakresie({'plik': 'apps/a/src/y.ts'}, zmienione))


class Ranking(unittest.TestCase):
    D10 = {'zdania': ['wartosc-graniczna', 'sciezka-bledu'], 'pokryte': ['walidacja-granicy-api']}

    def faza(self, et, k2, ui=True, linie=1000, k1=()):
        return {'et': et, 'klucz2': [{'klasa': k} for k in k2], 'klucz1': [{'klasa': k} for k in k1], 'ui': ui, 'linie_diff': linie}

    def test_kolejnosc_d10_potem_pokryte_potem_tanszy(self):
        r = F.ranking([self.faza('a', ['wartosc-graniczna']), self.faza('b', ['wartosc-graniczna', 'sciezka-bledu']),
                       self.faza('c', ['wartosc-graniczna', 'walidacja-granicy-api'], linie=3000),
                       self.faza('d', ['wartosc-graniczna', 'walidacja-granicy-api'], linie=900)], self.D10)
        self.assertEqual([x['et'] for x in r], ['b', 'd', 'c', 'a'])
        self.assertEqual(r[0]['k2_d10'], 2)

    def test_faza_bez_iu_ui_ani_fullstack_na_koncu(self):
        r = F.ranking([self.faza('a', ['wartosc-graniczna', 'sciezka-bledu'], ui=False), self.faza('b', ['wartosc-graniczna'])], self.D10)
        self.assertEqual([x['et'] for x in r], ['b', 'a'])

    def test_osiagalne_tylko_gdy_zdanie_klasy_trafia_do_pliku_klucza(self):
        f = self.faza('a', [])
        f['klucz2'] = [{'klasa': 'wartosc-graniczna', 'osiagalny': False}, {'klasa': 'sciezka-bledu', 'osiagalny': True}]
        r = F.ranking([f, self.faza('b', ['wartosc-graniczna', 'sciezka-bledu'])], self.D10)
        self.assertEqual([(x['et'], x['k2_d10'], x['k2_d10_osiagalne']) for x in r], [('b', 2, 2), ('a', 2, 1)])

    def test_klucz1_w_d10_liczony_obok(self):
        r = F.ranking([self.faza('a', [], k1=['sciezka-bledu', 'inna'])], self.D10)
        self.assertEqual((r[0]['k1_d10'], r[0]['k2_d10']), (1, 0))


if __name__ == '__main__':
    unittest.main()
