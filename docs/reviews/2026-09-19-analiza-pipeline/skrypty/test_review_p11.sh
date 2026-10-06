#!/bin/zsh
# Ślepy test P11 (PLAN-POPRAWY §3 P11) — przebieg jednej fazy na jej kopii z ~/test-review/kopie/<et>: warianty „stary” (.claude z main)
# i „nowy” (.claude z gałęzi P11) po kolei na tej samej kopii (nakładka .claude → sesja headless → zbiór → skan), potem sędzia p1 i wynik.
# `faza` URUCHAMIA AGENTÓW — WYŁĄCZNIE PO ZGODZIE OPERATORA (koszt).
#
# Użycie (z dowolnego katalogu):
#   test_review_p11.sh przygotuj <et>   — zero agentów: .claude wariantów (git archive), bramki (adapter), dossier, skrypty wariantów + kontrola bajtowa
#   test_review_p11.sh suchy <et>       — zero agentów: suchy bieg obu skryptów (atrapa agent()), obie nakładki na kopii (git status czysty),
#                                         ustawienia deny i bezpiecznik budżetu każdej sesji
#   test_review_p11.sh faza <et>        — agenci: oba warianty w kolejności z hasha fazy, sędzia p1, wynik wszystkich faz z wyrokiem
#                                         (dane/test-review/p11-wynik.*)
# Wznowienie = to samo polecenie: krok zrobiony (run completed, sesja bez błędu, zero błędów API) jest pomijany, niedokończony — przeniesiony
# do ~/test-review/odrzucone/ i uruchomiony od nowa (test_review_sesja.py gotowy/odrzuc).
set -uo pipefail
S=${0:A:h}
TR=$HOME/test-review
py() { (cd $S/.. && python3 -B skrypty/$@) }
pyc() { (cd $S && python3 -B -c "$1") }

krok() {   # $1 et, $2 krok, $3 wariant — sesja headless + zbiór + skan; kod 0 = zrobiony, 4 = przeciek, inny = STOP
  local et=$1 k=$2 w=$3
  if py test_review_sesja.py gotowy $et $k $w; then echo "$et $k $w: zrobiony — pomijam"; return 0; fi
  py test_review_sesja.py odrzuc $et $k $w
  py test_review_sesja.py start $et $k $w
  py test_review_sesja.py zbierz $et $k $w || return 2
  py test_review_sesja.py gotowy $et $k $w || { echo "STOP: $et $k $w niedokończony (limit konta, awaria API) — wznowienie tym samym poleceniem"; return 2 }
  py test_review_p11_cli.py skan $et $k $w
}

case ${1:-} in
przygotuj)
  py test_review_p11_cli.py claude || exit 2
  py test_review_p11_cli.py przygotuj $2 || exit 2
  ;;
suchy)
  et=$2; d=$TR/p11/$et
  for w in stary nowy; do
    out=$(node $S/test_review_suchy_bieg.mjs $d/wariant-$w.js 2>&1) || { echo "STOP: suchy bieg $w"; echo $out; exit 2 }
    print -r -- "$out" | grep -E 'agentów|agenci:' | sed "s/^/$w: /"
    py test_review_p11_cli.py nakladka $et $w || exit 2
    diff -rq $TR/p11/claude-$w/.claude/agents $TR/kopie/$et/.claude/agents || { echo "STOP: agenci kopii ≠ agenci wariantu $w"; exit 2 }
    pyc "import test_review_sesja as T; u = T.ustawienia('$et'); print('  deny %d (p11 innych faz %d), budzet sesji %.2f USD' % (len(u['permissions']['deny']), sum('/p11/' in x for x in u['permissions']['deny']), T.budzet('$et', 'p11', '$w')))"
  done
  ;;
faza)
  et=$2
  [[ -f $TR/p11/$et/wariant-stary.js && -f $TR/p11/$et/wariant-nowy.js ]] || { echo "STOP: brak skryptów wariantów — najpierw przygotuj $et"; exit 2 }
  for w in $(pyc "import test_review_p11 as P; print(' '.join(P.kolejnosc('$et')))"); do
    echo "=== $et wariant $w ($(date '+%H:%M'))"
    py test_review_sesja.py gotowy $et p11 $w || py test_review_p11_cli.py nakladka $et $w || exit 2
    krok $et p11 $w; k=$?
    (( k == 0 )) || { echo "PRZERWANE: $et p11 $w (kod $k)"; exit $k }
  done
  py test_review_p11_cli.py pula $et 1 || exit 2
  krok $et p11-sedzia-p1 S; k=$?
  (( k == 0 )) || { echo "PRZERWANE: sędzia $et (kod $k)"; exit $k }
  py test_review_p11_cli.py wynik
  ;;
*) sed -n 2,13p $0; exit 1 ;;
esac
