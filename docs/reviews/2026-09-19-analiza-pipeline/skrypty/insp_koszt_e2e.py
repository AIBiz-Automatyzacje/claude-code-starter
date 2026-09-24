"""Punkt odniesienia kosztu dla tematu „skill weryfikacji z mapą funkcji” (INSPIRACJE B1): ile dziś kosztują role E2E
w runach (etap 0, `dane/agents.csv`), żeby wycenić przejście regresyjne (wariant c) jako ułamek istniejącego kosztu.

Wynik: dane/insp-koszt-e2e.txt. Koszt w jednostkach modelu kosztu etapu 0 (kolumna `koszt`), czas z kolumny `sekundy`.
"""
import csv
import statistics
from collections import defaultdict
from pathlib import Path

KATALOG = Path(__file__).resolve().parent.parent
WEJSCIE = KATALOG / "dane" / "agents.csv"
WYNIK = KATALOG / "dane" / "insp-koszt-e2e.txt"


def liczba(w: str) -> float:
    return float(w) if w else 0.0


def main() -> None:
    wiersze = list(csv.DictReader(WEJSCIE.open(encoding="utf-8")))
    razem = sum(liczba(w["koszt"]) for w in wiersze)
    per_rola = defaultdict(list)
    for w in wiersze:
        if "e2e" in w["rola"].lower():
            per_rola[w["rola"]].append(w)
    e2e_razem = sum(liczba(w["koszt"]) for ws in per_rola.values() for w in ws)
    out = [
        f"agentów razem: {len(wiersze)}; koszt razem: {razem:,.0f}",
        f"role E2E razem: {sum(len(v) for v in per_rola.values())} wywołań, koszt {e2e_razem:,.0f} = {100 * e2e_razem / razem:.1f}% całości",
        "per rola: wywołania | udział w całości | mediana kosztu | mediana sekund | p90 sekund",
    ]
    for rola, ws in sorted(per_rola.items(), key=lambda kv: -sum(liczba(w["koszt"]) for w in kv[1])):
        koszty = [liczba(w["koszt"]) for w in ws]
        sekundy = sorted(liczba(w["sekundy"]) for w in ws)
        p90 = sekundy[int(0.9 * (len(sekundy) - 1))]
        out.append(f"  {rola}: {len(ws)} | {100 * sum(koszty) / razem:.1f}% | {statistics.median(koszty):,.0f} | "
                   f"{statistics.median(sekundy):.0f} | {p90:.0f}")
    WYNIK.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
