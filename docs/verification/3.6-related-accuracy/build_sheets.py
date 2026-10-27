# M8 채점표를 만든다. 정밀도 표본(내용 일치 전부 + 분석·규칙마다 같은 종류 10건 + 내용 일치가 있는 변경의 '날짜순 첫 공시'),
# 재현율 표본(분석마다 문장 변경 20건), 기간 공시 목록. 판정 칸은 비워 둔다. 시드 345로 다시 만들어도 같다
import csv, json, random
AIDS = {1: '삼성전자', 2: '에코프로비엠', 3: '고려아연', 4: '미래산업'}
FIELD = {'NEW_SHARES': '신주 수', 'PLAINTIFF': '원고', 'CASE_NAME': '사건 명칭', 'TARGET_COMPANY': '대상 회사'}
TIMING = {'DURING': '보고 기간 중', 'AFTER': '기간 후~제출 전'}
rng = random.Random(345)

def text_of(c):
    return (c.get('currentPreview') or c.get('previousPreview') or '').replace('\n', ' ')

def app_url(aid, cid):
    return f'http://localhost:5173/analyses/{aid}?tab=text&tc={cid}'

def write(path, header, rows):
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)

prec, recall, window = [], [], []
for aid, name in AIDS.items():
    data = json.load(open(f'links-{aid}.json', encoding='utf-8'))
    links = []  # (change, item, 화면 순서, 날짜순 순서)
    for r in data:
        items = r['related']['items']
        by_date = sorted(items, key=lambda i: (i['receivedDate'], i['rceptNo']), reverse=True)
        for rank, i in enumerate(items, 1):
            links.append((r['change'], i, rank, by_date.index(i) + 1))
    picked = {}
    def pick(l, why):
        key = (l[0]['changeId'], l[1]['rceptNo'])
        picked.setdefault(key, (l, []))[1].append(why)
    for l in links:
        if l[1]['matchLevel'] == 'STRONG':
            pick(l, '내용 일치 전부')
    strong_changes = {l[0]['changeId'] for l in links if l[1]['matchLevel'] == 'STRONG'}
    for l in links:
        if l[0]['changeId'] in strong_changes and l[3] == 1:
            pick(l, '1단계만일 때 첫 공시')
    rules = sorted({l[1]['matchRule'] for l in links})
    for rule in rules:
        pool = [l for l in links if l[1]['matchRule'] == rule and l[1]['matchLevel'] == 'TYPE_ONLY']
        for l in rng.sample(pool, min(10, len(pool))):
            pick(l, f'같은 종류 표본({rule}, 전체 {len(pool)}건 중)')
    for (cid, rno), (l, why) in sorted(picked.items(), key=lambda x: (int(x[0][0]), x[0][1])):
        c, i, rank, drank = l
        prec.append([f'P{aid}-{len(prec)+1:03d}', aid, name, cid, c['changeType'], c['sectionPath'], text_of(c),
                     i['rceptNo'], i['latestRceptNo'], i['reportName'], i['receivedDate'], TIMING[i['timing']],
                     i['matchRuleLabel'], i['matchRule'], i['matchLevel'], '·'.join(FIELD[f] for f in i['matchedFields']),
                     rank, drank, ' / '.join(why), i['dartUrl'], app_url(aid, cid), '', ''])
    for c in [r for r in rng.sample(data, 20)]:
        rel = next(r['related'] for r in data if r['change']['changeId'] == c['change']['changeId'])
        linked = '; '.join(f"{i['rceptNo']} {i['reportName']}" for i in rel['items'])
        cc = c['change']
        recall.append([f'R{aid}-{len(recall)+1:03d}', aid, name, cc['changeId'], cc['changeType'], cc['sectionPath'], text_of(cc),
                       rel['status'], len(rel['items']), linked, app_url(aid, cc['changeId']), '', '', ''])
    win = json.load(open(f'window-{aid}.json', encoding='utf-8'))
    for d in win['items']:
        timing = 'DURING' if d['receivedDate'] <= win['window']['periodEnd'].replace('-', '') else 'AFTER'
        window.append([aid, name, d['rceptNo'], d['reportName'], d['receivedDate'], d['type'], d['remark'], TIMING[timing],
                       f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={d['rceptNo']}"])

write('precision.csv',
      ['번호', '분석', '기업', '변경ID', '변경 유형', '섹션 경로', '변경 글(앞부분)', '접수번호', '최신 정정본', '공시명', '접수일', '기간',
       '규칙', '규칙 키', '연결 강도', '일치한 값', '화면 순서', '1단계만일 때 순서', '뽑은 이유', 'DART', '앱에서 보기',
       '판정(O 관련 있음 / X 없음 / ? 모름)', '메모'], prec)
write('recall.csv',
      ['번호', '분석', '기업', '변경ID', '변경 유형', '섹션 경로', '변경 글(앞부분)', '서비스 상태', '서비스가 붙인 수', '서비스가 붙인 공시',
       '앱에서 보기', '붙인 것 중 관련 있는 접수번호(쉼표, 없으면 없음)', '놓친 관련 접수번호(쉼표, 없으면 없음)', '메모'], recall)
write('window-disclosures.csv', ['분석', '기업', '접수번호', '공시명', '접수일', '상세유형', '비고', '기간', 'DART'], window)
print('precision', len(prec), 'recall', len(recall), 'window', len(window))
import collections
print(collections.Counter((r[1], r[14]) for r in prec))
