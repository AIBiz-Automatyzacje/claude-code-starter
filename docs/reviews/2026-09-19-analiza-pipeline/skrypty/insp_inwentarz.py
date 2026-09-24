"""Inwentarz dwóch źródeł inspiracji (temat operatora 2026-09-24): mattpocock/skills i pstack (cursor/plugins).

Użycie: python3 insp_inwentarz.py <klon mattpocock/skills> <klon cursor/plugins z katalogiem pstack>
Wynik: dane/insp-inwentarz.txt (SHA i data HEAD, liczba skilli per kategoria, linie .md, agenci, playbooki, zasady).
Klony leżą w scratchpadzie sesji (znikają) — SHA w wyniku pozwala odtworzyć stan.
"""
import subprocess
import sys
from collections import Counter
from pathlib import Path

WYNIK = Path(__file__).resolve().parent.parent / "dane" / "insp-inwentarz.txt"


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


def linie(pliki: list[Path]) -> int:
    return sum(len(p.read_text(encoding="utf-8").splitlines()) for p in pliki)


def mattpocock(repo: Path) -> list[str]:
    skille = sorted(repo.glob("skills/*/*/SKILL.md"))
    per_kat = Counter(p.parts[-3] for p in skille)
    md = [p for p in repo.glob("skills/**/*.md")]
    out = [
        "== mattpocock/skills",
        f"HEAD {git(repo, 'rev-parse', '--short', 'HEAD')} z {git(repo, 'log', '-1', '--format=%ad', '--date=short')}, commitów {git(repo, 'rev-list', '--count', 'HEAD')}",
        f"skille (SKILL.md): {len(skille)} — " + ", ".join(f"{k} {v}" for k, v in sorted(per_kat.items())),
        f"linie .md w skills/: {linie(md)}",
        "agenci (osobne pliki subagentów): 0",
        "skille wg kategorii:",
    ]
    for kat in sorted(per_kat):
        out.append(f"  {kat}: " + ", ".join(p.parts[-2] for p in skille if p.parts[-3] == kat))
    return out


def pstack(repo: Path) -> list[str]:
    root = repo / "pstack"
    skille = sorted(root.glob("skills/*/SKILL.md"))
    zasady = [p for p in skille if p.parts[-2].startswith("principle-")]
    playbooki = sorted(root.glob("skills/poteto-mode/playbooks/*.md"))
    agenci = sorted(root.glob("agents/*.md"))
    md = list(root.glob("**/*.md"))
    return [
        "== pstack (cursor/plugins/pstack)",
        f"HEAD {git(repo, 'rev-parse', '--short', 'HEAD')}, ostatnia zmiana pstack {git(repo, 'log', '-1', '--format=%ad %s', '--date=short', '--', 'pstack')}",
        f"skille (SKILL.md): {len(skille)}, w tym zasady principle-*: {len(zasady)}, pozostałe: {len(skille) - len(zasady)}",
        f"playbooki poteto-mode: {len(playbooki)}",
        f"agenci: {len(agenci)} — " + ", ".join(p.stem for p in agenci),
        f"linie .md w pstack/: {linie(md)}",
        "skille (bez zasad): " + ", ".join(p.parts[-2] for p in skille if p not in zasady),
        "playbooki: " + ", ".join(p.stem for p in playbooki),
    ]


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    wiersze = mattpocock(Path(sys.argv[1])) + [""] + pstack(Path(sys.argv[2]))
    WYNIK.write_text("\n".join(wiersze) + "\n", encoding="utf-8")
    print("\n".join(wiersze))


if __name__ == "__main__":
    main()
