# 채점한 precision.csv·recall.csv로 M8 지표를 계산한다. '?'와 빈 판정은 계산에서 뺀다
import csv
import re
from collections import defaultdict

JUDGE = '판정(O 관련 있음 / X 없음 / ? 모름)'


def read(path):
    # 엑셀이 CSV를 CP949로 저장하는 경우도 읽는다
    for encoding in ('utf-8-sig', 'cp949'):
        try:
            with open(path, encoding=encoding, newline='') as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise SystemExit(f'{path}: 인코딩을 읽지 못했습니다')


def ratio(hit, total):
    return f'{hit}/{total} = {hit / total:.1%}' if total else f'{hit}/0 = -'


def judged(rows):
    return [r for r in rows if r[JUDGE].strip().upper() in ('O', 'X')]


def ok(r):
    return r[JUDGE].strip().upper() == 'O'


prec = read('precision.csv')
done = judged(prec)
print(f'정밀도 표본 채점: {len(done)}/{len(prec)} (? 또는 빈 칸 {len(prec) - len(done)})')
if not done:
    raise SystemExit('판정(O·X)이 하나도 없습니다. precision.csv를 채점해 저장했는지 확인해 주세요.')

# 규칙별 정밀도: 같은 종류는 묶음(분석·규칙) 크기로 가중, 내용 일치는 전부 채점
# 묶음은 채점 여부와 상관없이 표본 전체에서 만든다. 판정이 하나도 없는 묶음이 있으면 추정이 표본 설계를 다 덮지 못하므로 멈춘다
strata = defaultdict(list)
sizes = {}
for r in prec:
    m = re.search(r'같은 종류 표본\((\S+), 전체 (\d+)건 중\)', r['뽑은 이유'])
    if m and r['연결 강도'] == 'TYPE_ONLY':
        key = (r['분석'], m.group(1))
        sizes[key] = int(m.group(2))
        if r in done:
            strata[key].append(ok(r))
empty = sorted(k for k in sizes if not strata[k])
if empty:
    raise SystemExit(f'판정이 없는 같은 종류 묶음이 있습니다: {empty}. 그 묶음을 채점한 뒤 다시 실행해 주세요.')
strong = [r for r in done if r['연결 강도'] == 'STRONG']
strong_total = sum(1 for r in prec if r['연결 강도'] == 'STRONG')

print('\n[규칙별 같은 종류 정밀도]')
by_rule = defaultdict(lambda: [0.0, 0])
for (aid, rule), hits in sorted(strata.items()):
    p = sum(hits) / len(hits)
    print(f'  분석 {aid} {rule}: {ratio(sum(hits), len(hits))} (전체 {sizes[(aid, rule)]}건)')
    by_rule[rule][0] += p * sizes[(aid, rule)]
    by_rule[rule][1] += sizes[(aid, rule)]
for rule, (w, n) in sorted(by_rule.items()):
    print(f'  규칙 {rule} 가중 정밀도: {w / n:.1%} (연결 {n}건)')

weighted_hits = sum(sum(h) / len(h) * sizes[k] for k, h in strata.items()) + sum(ok(r) for r in strong)
weighted_total = sum(sizes.values()) + len(strong)
print(f'\n[전체 연결 정밀도(가중 추정)] {weighted_hits / weighted_total:.1%} (연결 {weighted_total}건 기준, 1단계만·1+2단계 같음)')
print(f'[내용 일치 표시 정밀도] {ratio(sum(ok(r) for r in strong), len(strong))} (내용 일치 {strong_total}건 중 채점 {len(strong)})')

# 화면 맨 위 공시: 내용 일치가 있는 변경에서 1+2단계는 화면 순서 1, 1단계만은 접수일 최근순 1
changes = {r['변경ID'] + '@' + r['분석'] for r in prec if r['연결 강도'] == 'STRONG'}
top2 = [r for r in done if r['변경ID'] + '@' + r['분석'] in changes and r['화면 순서'] == '1']
top1 = [r for r in done if r['변경ID'] + '@' + r['분석'] in changes and r['1단계만일 때 순서'] == '1']
print(f'\n[화면 맨 위 공시 정밀도, 내용 일치가 있는 변경 {len(changes)}개]')
print(f'  1단계만: {ratio(sum(map(ok, top1)), len(top1))}')
print(f'  1+2단계: {ratio(sum(map(ok, top2)), len(top2))}')

rec = read('recall.csv')
FOUND = '붙인 것 중 관련 있는 접수번호(쉼표, 없으면 없음)'
MISSED = '놓친 관련 접수번호(쉼표, 없으면 없음)'


def numbers(cell):
    cell = cell.strip()
    return [] if cell in ('', '없음') else [x.strip() for x in cell.split(',') if x.strip()]


filled = [r for r in rec if r[FOUND].strip() and r[MISSED].strip()]
found = sum(len(numbers(r[FOUND])) for r in filled)
missed = sum(len(numbers(r[MISSED])) for r in filled)
attached = sum(int(r['서비스가 붙인 수']) for r in filled)
print(f'\n재현율 표본 채점: {len(filled)}/{len(rec)}')
print(f'[재현율] {ratio(found, found + missed)}')
print(f'[이 표본의 정밀도] {ratio(found, attached)}')
