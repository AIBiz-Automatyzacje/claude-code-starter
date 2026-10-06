#!/bin/zsh
# Ślepy test P12 (PLAN-POPRAWY §3 P12) — przebieg jednej fazy: build obu wariantów (każdy w swojej kopii na bazie buildu, .claude wariantu),
# review z main na obu wynikach, sędzia obecności defektu na trzech implementacjach (stary, nowy, historyczny), wynik.
# `faza` URUCHAMIA AGENTÓW — WYŁĄCZNIE PO ZGODZIE OPERATORA (koszt ≈ 9 M na fazę, 6a pkt 67 a).
#
# Użycie (z dowolnego katalogu):
#   test_review_p12.sh przygotuj <et>   — zero agentów: .claude wariantów (git archive), kopie na bazie buildu, skrypty buildu + kontrola bajtowa
#   test_review_p12.sh suchy <et>       — zero agentów: suchy bieg obu skryptów buildu (atrapa agent(); prompty plannera i domknięcia
#                                         w ~/test-review/p12/<et>/zrzut-<w>.txt), nakładka każdego wariantu na jego kopii, blok reguł/D10
#                                         per IU planu (skrypt wiedzy wariantu), ustawienia deny i bezpiecznik budżetu
#   test_review_p12.sh faza <et>        — agenci: build obu wariantów (kolejność z hasha fazy), review z main na obu, sędzia p1, wynik
# Wznowienie = to samo polecenie: krok zrobiony (run completed, sesja bez błędu, zero błędów API) i ze skanem zapisanym z kodem 0 jest
# pomijany; zrobiony bez skanu — skan teraz; skan ze STOP/przeciekiem — STOP (decyzja, nie powtórka). Niedokończony build: próba
# i kopia do ~/test-review/odrzucone/, nowa kopia na bazie, build od nowa. Na czas buildu drugi wariant i kopia historyczna mają chmod 000.
set -uo pipefail
S=${0:A:h}
TR=$HOME/test-review
py() { (cd $S/.. && python3 -B skrypty/$@) }
pyc() { (cd $S && python3 -B -c "$1") }

krok() {   # $1 et, $2 krok, $3 wariant — sesja headless + zbiór + skan; kod 0 = zrobiony, 4 = przeciek, inny = STOP
  local et=$1 k=$2 w=$3
  if py test_review_sesja.py gotowy $et $k $w; then
    py test_review_p12_cli.py werdykt $et $k $w; local v=$?
    (( v == 0 )) && { echo "$et $k $w: zrobiony, skan 0 — pomijam"; return 0 }
    (( v == 1 )) && { echo "$et $k $w: zrobiony bez skanu — skan teraz"; py test_review_p12_cli.py skan $et $k $w; return $? }
    echo "STOP: $et $k $w ma skan z kodem ≠ 0 (~/test-review/p12/$et/skan-$k-$w.json) — decyzja operatora"; return 2
  fi
  py test_review_sesja.py odrzuc $et $k $w
  py test_review_sesja.py start $et $k $w
  py test_review_sesja.py zbierz $et $k $w || return 2
  py test_review_sesja.py gotowy $et $k $w || { echo "STOP: $et $k $w niedokończony (limit konta, awaria API) — wznowienie tym samym poleceniem"; return 2 }
  py test_review_p12_cli.py skan $et $k $w
}

kolejnosc() { pyc "import test_review_p12 as P; print(' '.join(P.kolejnosc('$1')))" }

case ${1:-} in
przygotuj)
  py test_review_p12_cli.py claude || exit 2
  py test_review_p12_cli.py przygotuj $2 || exit 2
  ;;
suchy)
  et=$2; d=$TR/p12/$et
  for w in stary nowy; do
    rm -f $d/zrzut-$w.txt
    out=$(ZRZUT=$d/zrzut-$w.txt node $S/test_review_p12_suchy_bieg.mjs $TR/p12-kopie/$et/$w-pliki/wariant-build.js 2>&1) || { echo "STOP: suchy bieg $w"; echo $out; exit 2 }
    print -r -- "$out" | grep -E 'agentów|agenci:' | sed "s/^/$w: /"
    py test_review_p12_cli.py nakladka $et $w $w || exit 2
    diff -rq $TR/p12/claude-$w/.claude/agents $TR/p12-kopie/$et/$w/.claude/agents || { echo "STOP: agenci kopii ≠ agenci wariantu $w"; exit 2 }
    py test_review_p12_cli.py wycinki $et $w
    pyc "import test_review_sesja as T; u = T.ustawienia('$et', 'p12-build', '$w'); print('  build: deny %d, budzet sesji %.2f USD | review: budzet %.2f USD' % (len(u['permissions']['deny']), T.budzet('$et', 'p12-build', '$w'), T.budzet('$et', 'p12-review', '$w')))"
  done
  ;;
faza)
  et=$2
  py test_review_p12_cli.py otworz $et
  trap "py test_review_p12_cli.py otworz $et" EXIT
  for w in $(kolejnosc $et); do
    [[ -f $TR/p12-kopie/$et/$w-pliki/wariant-build.js ]] || { echo "STOP: brak skryptu buildu $w — najpierw przygotuj $et"; exit 2 }
    if ! py test_review_sesja.py gotowy $et p12-build $w; then
      echo "=== $et build $w ($(date '+%H:%M'))"
      py test_review_p12_cli.py reset $et $w || exit 2
      py test_review_p12_cli.py przed-buildem $et || exit 2
      py test_review_p12_cli.py nakladka $et $w $w || exit 2
      py test_review_p12_cli.py zamknij $et $w || exit 2
      krok $et p12-build $w; k=$?
      py test_review_p12_cli.py otworz $et
      (( k == 0 )) || { echo "PRZERWANE: $et p12-build $w (kod $k)"; exit $k }
    else
      krok $et p12-build $w || { echo "PRZERWANE: $et p12-build $w (skan)"; exit 2 }
    fi
    [[ -f $TR/p12/$et/po-buildzie-$w.json ]] || py test_review_p12_cli.py po-buildzie $et $w || exit 2
  done
  for w in $(kolejnosc $et); do
    echo "=== $et review $w ($(date '+%H:%M'))"
    py test_review_sesja.py gotowy $et p12-review $w || py test_review_p12_cli.py nakladka $et $w stary || exit 2
    krok $et p12-review $w; k=$?
    (( k == 0 )) || { echo "PRZERWANE: $et p12-review $w (kod $k)"; exit $k }
  done
  [[ -f $TR/p12/$et/sedzia/sedzia-p1.js ]] || py test_review_p12_cli.py sedzia $et || exit 2
  krok $et p12-sedzia-p1 S; k=$?
  (( k == 0 )) || { echo "PRZERWANE: sędzia $et (kod $k)"; exit $k }
  py test_review_p12_cli.py wynik
  ;;
*) sed -n 2,14p $0; exit 1 ;;
esac
