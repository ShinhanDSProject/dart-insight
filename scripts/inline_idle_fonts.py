#!/usr/bin/env python3
"""
시연 대기 화면(frontend/public/easter/idle.html)에 글꼴을 넣는 도구
================================================================
대기 화면은 행사장 인터넷이 없어도 같은 모양으로 보여야 해서 글꼴을 파일 안에 담는다.
페이지에 쓴 글자만 Google Fonts에서 잘라 받아(text= 매개변수) woff2를 base64로
<style id="idle-fonts"> 안에 넣는다. 글꼴은 Noto Sans KR·Inter(둘 다 SIL OFL).

페이지의 글자를 고친 뒤 다시 돌린다(인터넷 필요): python3 scripts/inline_idle_fonts.py
"""

import base64
import pathlib
import re
import urllib.parse
import urllib.request

PAGE = pathlib.Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'easter' / 'idle.html'
FAMILIES = ['Noto Sans KR:wght@400;500;700;800;900', 'Inter:wght@700;800']
# woff2를 돌려받으려면 최신 브라우저처럼 보여야 한다
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
BLOCK = re.compile(r'(<style id="idle-fonts">)(.*?)(</style>)', re.S)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as res:
        return res.read()


def main() -> None:
    html = PAGE.read_text(encoding='utf-8')
    # 글꼴 블록을 뺀 파일 전체의 글자(주석·스크립트 안내 문구 포함)를 담는다. 조금 남아도 빠지는 글자는 없다
    chars = ''.join(sorted(set(BLOCK.sub('', html)) - set('\n\r\t')))
    rules = []
    for family in FAMILIES:
        query = urllib.parse.urlencode({'family': family, 'text': chars, 'display': 'block'})
        css = fetch(f'https://fonts.googleapis.com/css2?{query}').decode('utf-8')
        for face in re.findall(r'@font-face\s*{.*?}', css, re.S):
            url = re.search(r'url\((.*?)\)', face).group(1)
            data = base64.b64encode(fetch(url)).decode('ascii')
            rules.append(re.sub(r'url\(.*?\)\s*format\([\'"]woff2[\'"]\)', f"url(data:font/woff2;base64,{data}) format('woff2')", face))
    block = '\n' + '\n'.join(re.sub(r'\s+', ' ', r) for r in rules) + '\n'
    PAGE.write_text(BLOCK.sub(lambda m: m.group(1) + block + m.group(3), html), encoding='utf-8')
    print(f'{len(rules)}개 글꼴, 글자 {len(chars)}개, 파일 {PAGE.stat().st_size // 1024}KB')


if __name__ == '__main__':
    main()
