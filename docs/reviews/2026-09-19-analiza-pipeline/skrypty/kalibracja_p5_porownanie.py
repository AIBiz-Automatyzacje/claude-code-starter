# Porownanie wyniku pr:zbierz (kalibracja) z referencja CSV: watek -> id pierwszego komentarza -> wiersz CSV.
import json, sys, collections
wyniki=json.load(open(sys.argv[1]))
ref=json.load(open('referencja.json'))
wiersze=[]
for w in wyniki:
    if not w or not w.get('wynik'): print('BRAK wyniku', w and w.get('nr')); continue
    p=w['nr']
    th={n['id']:n['comments']['nodes'][0]['databaseId'] for n in json.load(open(f'watki-{p}.json'))['data']['repository']['pullRequest']['reviewThreads']['nodes']}
    bez=0
    for x in w['wynik']['watki']:
        cid=th.get(x['id'])
        r=ref.get(str(cid)) if cid else None
        if not r: bez+=1; continue
        wiersze.append((p,x,r))
    print(f"PR {p}: watkow {len(w['wynik']['watki'])}, zlaczonych {len(w['wynik']['watki'])-bez}, bez referencji {bez} (recenzje ogolne / inne)")
n=len(wiersze)
def zg(f): return sum(1 for _,x,r in wiersze if f(x,r))
print(f"\nZLACZONE: {n}")
print(f"klasaBledu zgodna: {zg(lambda x,r:x['klasaBledu']==r['klasa'])}/{n}")
print(f"os zgodna:         {zg(lambda x,r:x['os']==r['os'])}/{n}")
print(f"waga zgodna:       {zg(lambda x,r:x['waga']==r['waga'])}/{n}")
print(f"defekt/nie-defekt: {zg(lambda x,r:(x['waga']=='0')==(r['waga']=='0'))}/{n}")
print(f"P1/P2 vs reszta:   {zg(lambda x,r:(x['waga'] in ('P1','P2'))==(r['waga'] in ('P1','P2')))}/{n}")
print("\nmacierz wag (ref -> zbierz):", sorted(collections.Counter((r['waga'],x['waga']) for _,x,r in wiersze).items()))
print("\nkoszyk ref -> decyzja zbierz:", sorted(collections.Counter((r['koszyk'],x['klasa']) for _,x,r in wiersze).items()))
print("\nrozbieznosci klas (ref -> zbierz):")
for k,v in collections.Counter((r['klasa'],x['klasaBledu']) for _,x,r in wiersze if x['klasaBledu']!=r['klasa']).most_common():
    print(f"  {v}x {k[0]} -> {k[1]}")
json.dump([dict(pr=p, plik=r['plik'], ref_klasa=r['klasa'], ref_stara=r['stara'], ref_waga=r['waga'], ref_koszyk=r['koszyk'], zb_klasa=x['klasaBledu'], zb_os=x['os'], zb_waga=x['waga'], zb_decyzja=x['klasa'], ref_streszczenie=r['streszczenie'], zb_streszczenie=x['streszczenie'], zb_uzasadnienie=x['uzasadnienie']) for p,x,r in wiersze], open('zlaczone.json','w'), ensure_ascii=False, indent=1)
