"""Ile uwag CodeRabbita (klasyfikacja 574, etap 1b) dotyczy komentarzy w kodzie — tło dla tezy z wystąpienia poteto
(agenci używają komentarzy jako usprawiedliwienia obejść; w Dune komentarze są zakazane).

Dopasowanie po słowach w klasie i streszczeniu (komentarz, JSDoc, docstring, TODO, comment). Heurystyka słowna:
wynik sprawdzić czytaniem wypisanych streszczeń (plik wyniku zawiera je wszystkie).
Wynik: dane/insp-komentarze.txt
"""
import csv
import re
from collections import Counter
from pathlib import Path

KATALOG = Path(__file__).resolve().parent.parent
WEJSCIE = KATALOG / "dane" / "coderabbit" / "klasyfikacja-574.csv"
WYNIK = KATALOG / "dane" / "insp-komentarze.txt"
WZORZEC = re.compile(r"komentarz|jsdoc|docstring|\btodo\b|comment", re.IGNORECASE)


def main() -> None:
    wiersze = list(csv.DictReader(WEJSCIE.open(encoding="utf-8")))
    trafione = [w for w in wiersze if WZORZEC.search(w["klasa"] + " " + w["streszczenie"])]
    out = [
        f"uwag razem: {len(wiersze)}; o komentarzach (heurystyka słowna): {len(trafione)}",
        "koszyk: " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(w["koszyk"] for w in trafione).items())),
        "severity: " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(w["severity"] for w in trafione).items())),
        "klasy: " + ", ".join(f"{k} {v}" for k, v in Counter(w["klasa"] for w in trafione).most_common()),
        "",
        "wszystkie trafienia (pr | koszyk | severity | klasa | streszczenie):",
    ]
    out += [f"{w['pr']} | {w['koszyk']} | {w['severity']} | {w['klasa']} | {w['streszczenie']}" for w in trafione]
    WYNIK.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n".join(out[:5]))


if __name__ == "__main__":
    main()
