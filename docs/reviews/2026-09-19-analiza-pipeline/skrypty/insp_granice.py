"""Przykład do tematu „granice w kodzie pilnowane automatem” (INSPIRACJE B6): ile plików .tsx w dashboardzie
oferty-online importuje klienta Supabase wprost i jakie wywołania robi (baza: .from/.rpc/.storage vs auth).
coding-rules §14: „komponent UI nie woła bazy bezpośrednio, idzie przez serwis/hook”.

Użycie: python3 insp_granice.py <repo oferty-online>
Wynik: dane/insp-granice.txt (HEAD repo, pliki, wywołania z numerem linii). Pliki testów pominięte.
"""
import re
import subprocess
import sys
from pathlib import Path

WYNIK = Path(__file__).resolve().parent.parent / "dane" / "insp-granice.txt"
IMPORT = re.compile(r"import\s+\{[^}]*\bsupabase\b[^}]*\}\s+from\s+'[^']*lib/supabase(\.js)?'")
WYWOLANIE = re.compile(r"supabase\.(from|rpc|storage|auth|functions|channel)\b[.(]?(\w*)")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    repo = Path(sys.argv[1])
    head = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%h %ad", "--date=short"],
                          capture_output=True, text=True, check=True).stdout.strip()
    pliki = sorted(p for p in (repo / "apps" / "dashboard" / "src").rglob("*.tsx") if ".test." not in p.name)
    out = [f"oferty-online HEAD {head}; plików .tsx (bez testów): {len(pliki)}"]
    baza = auth = 0
    for p in pliki:
        tekst = p.read_text(encoding="utf-8")
        if not IMPORT.search(tekst):
            continue
        wywolania = []
        for nr, linia in enumerate(tekst.splitlines(), 1):
            for m in WYWOLANIE.finditer(linia):
                rodzaj = "baza" if m.group(1) in ("from", "rpc", "storage", "functions", "channel") else "auth"
                baza += rodzaj == "baza"
                auth += rodzaj == "auth"
                wywolania.append(f"{nr}: supabase.{m.group(1)}{('.' + m.group(2)) if m.group(2) else ''} [{rodzaj}]")
        out.append(f"{p.relative_to(repo)} — " + "; ".join(wywolania))
    out.insert(1, f"plików .tsx z importem klienta: {len(out) - 1}; wywołań bazy: {baza}; wywołań auth: {auth}")
    WYNIK.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
