# 분석 기간(window)의 수시공시 전체 목록을 OpenDART list.json으로 받아 window-<aid>.json에 저장한다. 키는 환경변수로만 받는다
import json, os, sys, time, urllib.request, urllib.parse
key = os.environ['DART_KEY']
for aid, corp in [a.split(':') for a in sys.argv[1:]]:
    rows = json.load(open(f'links-{aid}.json', encoding='utf-8'))
    w = rows[0]['related']['window']
    items = []
    for ty in ('B001', 'I001', 'I002'):
        page = 1
        while True:
            q = urllib.parse.urlencode({'crtfc_key': key, 'corp_code': corp, 'bgn_de': w['from'].replace('-', ''),
                                        'end_de': w['to'].replace('-', ''), 'pblntf_detail_ty': ty, 'last_reprt_at': 'N',
                                        'page_no': page, 'page_count': 100})
            d = json.load(urllib.request.urlopen('https://opendart.fss.or.kr/api/list.json?' + q, timeout=30))
            if d['status'] == '013': break
            if d['status'] != '000': raise SystemExit(f"{aid} {ty} status {d['status']}")
            items += [{'rceptNo': x['rcept_no'], 'reportName': x['report_nm'].strip(), 'receivedDate': x['rcept_dt'], 'type': ty, 'remark': x['rm']} for x in d['list']]
            if page >= d['total_page']: break
            page += 1
            time.sleep(0.2)
    items.sort(key=lambda x: (x['receivedDate'], x['rceptNo']))
    json.dump({'window': w, 'corpCode': corp, 'items': items}, open(f'window-{aid}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(aid, corp, w, len(items))
