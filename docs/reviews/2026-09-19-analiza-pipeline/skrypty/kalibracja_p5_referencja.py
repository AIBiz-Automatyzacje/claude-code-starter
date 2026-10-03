# Referencja kalibracji: wiersz klasyfikacja-574.csv -> id komentarza GitHuba (pozycyjnie w PR; sciezki zgodne dla PR 2, 4, 16)
# -> klasa ze slownika It1 (mapa stara->nowa + nadpisania), os, waga.
import csv, json, sys
D='/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane/'
j=[json.loads(l) for l in open(D+'coderabbit/bot-comments.jsonl')]
r=list(csv.DictReader(open(D+'coderabbit/klasyfikacja-574.csv')))
mapa={x['stara']:(x['nowa'],x['os']) for x in csv.DictReader(open(D+'it1-slownik-klas.csv'))}
nadp={(x['pr'],x['id']):x['nowa'] for x in csv.DictReader(open(D+'it1-slownik-nadpisania.csv'))}
osie={v[0]:v[1] for v in mapa.values()}
ref={}
for p in [2,4,16]:
    jj=[x for x in j if x['pr']==p]
    rr=sorted([x for x in r if int(x['pr'])==p], key=lambda x:int(x['id']))
    assert [x['path'] for x in jj]==[x['plik'].split(':')[0] for x in rr]
    for c,w in zip(jj,rr):
        nowa=nadp.get((w['pr'],w['id']), mapa[w['klasa']][0])
        ref[c['id']]=dict(pr=p, csv_id=w['id'], koszyk=w['koszyk'], klasa=nowa, os=osie[nowa], waga=w['severity'], plik=w['plik'], stara=w['klasa'], streszczenie=w['streszczenie'])
json.dump(ref, open('referencja.json','w'), ensure_ascii=False, indent=1)
print(len(ref))
