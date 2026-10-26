import json,sys
for et in sys.argv[1:]:
    d=json.load(open(f'/Users/kacper_trzepiecinski/Documents/Kodowanie/vibersi/docs/completed/{et}/.autopilot-state.json'))
    print('==',et, 'klucze:',[k for k in d if k!='fazy'])
    tot={}
    for f in d['fazy']:
        m=f.get('metryki',{}); l=m.get('liczniki',{}); p=m.get('przebieg',{}); s=p.get('sceptyk',{})
        row=dict(p1=l.get('p1'),p2=l.get('p2'),p3=l.get('p3'),op=l.get('operator'),zn=p.get('znalezione'),sem=p.get('poDedupSem'),wer=p.get('weryfikowane'),obal=p.get('obalone'),agree=s.get('agree'),dc=s.get('disagree_concern'),de=s.get('disagree_evidence'),e2e=p.get('e2eCheckboxy'),pas=p.get('e2ePass'),fail=p.get('e2eFail'),skip=p.get('e2eSkip'),man=p.get('e2eManual'))
        print(f['numer'],f['nazwa'][:28].ljust(28),row)
        for k,v in row.items():
            if isinstance(v,int): tot[k]=tot.get(k,0)+v
    print('SUMA',tot)
    for k in d:
        if k not in('fazy','wersja','zadanie'): print(k, json.dumps(d[k],ensure_ascii=False)[:600])
