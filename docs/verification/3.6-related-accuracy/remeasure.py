# 규칙을 바꾼 뒤 받은 links-<분석>.json(이 폴더에서 실행)을 #345 채점표의 판정으로 다시 잰다
# 사용: python remeasure.py <새 links 폴더>   (채점표 precision.csv·recall.csv는 이 스크립트 옆에 있는 것을 읽는다)
# 표본에 없는 새 연결이 '내용 일치'이거나 화면 맨 위에 오면 판정이 없으므로 목록을 찍고 멈춘다
# #345 때 없던 새 연결은 new-links-<규칙 버전>.csv(인자 2, 있으면)에 모두 채점해 두고, 묶음 추정과 따로 그대로 센다
import csv, json, os, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
JUDGE = '판정(O 관련 있음 / X 없음 / ? 모름)'
FOUND = '붙인 것 중 관련 있는 접수번호(쉼표, 없으면 없음)'
MISSED = '놓친 관련 접수번호(쉼표, 없으면 없음)'


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def ratio(hit, total):
    return f'{hit}/{total} = {hit / total:.1%}' if total else f'{hit}/0 = -'


folder = sys.argv[1] if len(sys.argv) > 1 else '.'
links, top, statuses = {}, {}, defaultdict(int)
for aid in '1234':
    with open(os.path.join(folder, f'links-{aid}.json'), encoding='utf-8') as f:
        rows = json.load(f)
    for r in rows:
        statuses[r['related']['status']] += 1
        items = r['related']['items'] if r['related']['status'] == 'FOUND' else []
        for i, it in enumerate(items):
            key = (aid, str(r['change']['changeId']), it['rceptNo'])
            links[key] = (it['matchRule'], it['matchLevel'])
            if i == 0 and any(x['matchLevel'] == 'STRONG' for x in items):
                top[key[:2]] = key

prec = read('precision.csv')
new = read(sys.argv[2]) if len(sys.argv) > 2 else []
new_keys = {(r['분석'], r['변경ID'], r['접수번호']) for r in new}
judged = {(r['분석'], r['변경ID'], r['접수번호']): r for r in prec + new if r[JUDGE].strip().upper() in ('O', 'X')}
ok = lambda key: judged[key][JUDGE].strip().upper() == 'O'

unjudged = [k for k, (_, lvl) in links.items() if lvl == 'STRONG' and k not in judged] + \
           [k for k in top.values() if k not in judged]
if unjudged:
    raise SystemExit(f'판정이 없는 내용 일치·맨 위 연결이 있습니다. precision.csv에 더해 채점해 주세요: {sorted(set(unjudged))}')

total = len(links)
strong = [k for k, (_, lvl) in links.items() if lvl == 'STRONG']
print(f'연결 {total}개(내용 일치 {len(strong)}), 상태 {dict(statuses)}')
changes = sum(statuses.values())
print(f'[찾지 못함 비율] {ratio(statuses["NOT_FOUND"], changes)}')

# 같은 종류: #345의 묶음(분석·원래 규칙)마다, 남은 표본의 정밀도 × 그 묶음에서 남은 같은 종류 연결 수
groups = defaultdict(list)
for r in prec:
    m = re.search(r'같은 종류 표본\((\S+), 전체 (\d+)건 중\)', r['뽑은 이유'])
    if m and r['연결 강도'] == 'TYPE_ONLY':
        groups[(r['분석'], m.group(1))].append((r['분석'], r['변경ID'], r['접수번호']))
left = defaultdict(int)
for key, (rule, lvl) in links.items():
    if lvl == 'TYPE_ONLY' and key not in new_keys:
        left[(key[0], rule)] += 1
print('\n[규칙별 같은 종류 정밀도(남은 표본)]')
hits = n = 0.0
by_rule = defaultdict(lambda: [0.0, 0])
for key in sorted(set(groups) | set(left)):
    kept = [k for k in groups.get(key, []) if k in links and links[k][1] == 'TYPE_ONLY' and k in judged]
    count = left.get(key, 0)
    if count and not kept:
        print(f'  분석 {key[0]} {key[1]}: 남은 연결 {count}개, 남은 표본 없음(추정에서 뺌)')
        continue
    if not count:
        continue
    p = sum(map(ok, kept)) / len(kept)
    print(f'  분석 {key[0]} {key[1]}: {ratio(sum(map(ok, kept)), len(kept))} (남은 연결 {count}개)')
    hits += p * count
    n += count
    by_rule[key[1]][0] += p * count
    by_rule[key[1]][1] += count
for rule, (w, c) in sorted(by_rule.items()):
    print(f'  규칙 {rule} 가중 정밀도: {w / c:.1%} (연결 {c}개)')
fresh = [k for k in new_keys if k in links and links[k][1] == 'TYPE_ONLY']
if any(k not in judged for k in fresh):
    raise SystemExit('새 연결 채점표에 판정이 빈 줄이 있습니다')
if fresh:
    print(f'  새 연결(#345 뒤 생김, 모두 채점): {ratio(sum(map(ok, fresh)), len(fresh))}')
hits += sum(map(ok, fresh))
n += len(fresh)
s_hit = sum(map(ok, strong))
print(f'\n[전체 연결 정밀도(가중 추정)] {(hits + s_hit) / (n + len(strong)):.1%} (추정에 든 연결 {int(n) + len(strong)}개)')
print(f'[내용 일치 표시 정밀도] {ratio(s_hit, len(strong))}')
print(f'[화면 맨 위 공시 정밀도, 내용 일치가 있는 변경 {len(top)}개] {ratio(sum(map(ok, top.values())), len(top))}')

found = missed = 0
for r in read('recall.csv'):
    nums = lambda c: [] if c.strip() in ('', '없음') else [x.strip() for x in c.split(',')]
    for no in nums(r[FOUND]):
        if (r['분석'], r['변경ID'], no) in links:
            found += 1
        else:
            missed += 1
    missed += len(nums(r[MISSED]))
print(f'[재현율(표본 변경 80개)] {ratio(found, found + missed)}')
