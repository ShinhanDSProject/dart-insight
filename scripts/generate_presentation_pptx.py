#!/usr/bin/env python3
"""
DART Insight 발표 PPTX·대본 문서 생성기
=======================================
웹 발표 페이지(frontend/public/easter/three-weeks.html)의 발표 모드 화면을 그대로 PPTX로 옮깁니다.

- 장 순서, 머리말, 발표 대본은 페이지에서 읽습니다.
- 장마다 페이지를 촬영 모드(?slide=<장 id>&capture)로 열어 헤드리스 Chrome으로 16:9 화면을 찍고,
  그 이미지를 슬라이드에 꽉 채워 넣습니다. 발표자 노트에는 그 장의 대본을 넣습니다.
  페이지를 고치고 이 스크립트를 다시 돌리면 PPTX와 대본 문서가 함께 맞춰집니다.

만드는 파일:
  docs/DART_Insight_Presentation.pptx (frontend/public/easter/에도 복사)
  docs/presentation-script-heo-style.md (발표자 노트와 같은 대본 문서)

실행: python3 scripts/generate_presentation_pptx.py
필요한 것: python-pptx, Chrome 또는 Chromium(다른 위치면 CHROME 환경변수로 경로 지정)
"""

import functools
import html
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import tempfile
import threading

from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.util import Inches

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "frontend", "public")
PAGE = os.path.join(PUBLIC, "easter", "three-weeks.html")
OUT_PPTX = os.path.join(ROOT, "docs", "DART_Insight_Presentation.pptx")
OUT_PPTX_COPY = os.path.join(PUBLIC, "easter", "DART_Insight_Presentation.pptx")
OUT_SCRIPT = os.path.join(ROOT, "docs", "presentation-script-heo-style.md")

SLIDE_W, SLIDE_H = 13.333, 7.5
SHOT_W, SHOT_H = 1920, 1080
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
]

# 발표에 쓰는 숫자. 대본 문서 머리에 함께 적습니다.
FACTS = [
    ("기간", "2026-10-19 시작, 약 4주"),
    ("병합한 PR / 닫은 이슈 / 커밋", "461 / 429 / 1,101"),
    ("설계 기록(ADR)", "67"),
    ("공개 API", "약 90개"),
    ("자동 테스트", "약 4,400개(화면 1,910 · AI 1,188 · 백엔드 약 1,300)"),
    ("AI 모델", "Claude Haiku 5.5 기본(ADR-0063), 토큰 단가는 Sonnet의 1/20"),
    ("요약 시간", "요약 한 번 평균 11.6초(로컬 측정)"),
    ("보고서 길이", "한 권 30~65만 자"),
    ("삼성전자 2025 사업보고서(20260310002820)", "매출 +10.9%, 영업이익 +33.2%, 순이익 +31.2%"),
]
AVOID = "'5초 대조', '환각 0%', '100% 원문', '95% 단축', '생산성 400%', '재테크' 등 근거가 없거나 투자 권유로 읽히는 말."

NOTE_MARKERS = {
    "[도발적 질문 Hook]": "[여는 질문]",
    "[1초 용어 통역]": "[쉬운 설명]",
    "[시각 요소 지시어]": "[화면 가리키기]",
    "[숫자 타격감 마무리]": "[마무리 한마디]",
}


# ---------------------------------------------------------------------------
# 페이지 읽기
# ---------------------------------------------------------------------------
def _strip(fragment):
    text = re.sub(r"<br\s*/?>", " ", fragment)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\s+", " ", text).strip()


def _js_object(source, name, first, second):
    start = source.index(f"const {name} = {{")
    body = source[start:source.index("\n  };", start)]
    pattern = r'^\s+"([\w-]+)": \{ ' + first + r': (".*?"), ' + second + r': (".*") \},?$'
    return {key: (json.loads(a), json.loads(b)) for key, a, b in re.findall(pattern, body, re.M)}


def read_page():
    """페이지의 장 순서(표지 + 섹션)대로 머리말·용어·대본을 읽습니다."""
    source = open(PAGE, encoding="utf-8").read()
    speeches = _js_object(source, "SPEECHES_BY_ID", "title", "text")
    sections = re.findall(r'<section id="([\w-]+)"', source)
    # 페이지와 같은 순서: 표지(cover)가 있으면 맨 앞, 그다음 머리말(hero)
    order = (["cover"] if "cover" in sections else []) + ["hero"] + [sid for sid in sections if sid != "cover"]
    missing = [sid for sid in order if sid not in speeches]
    if missing:
        raise SystemExit(f"대본이 없는 장이 있습니다: {', '.join(missing)} (SPEECHES_BY_ID에 추가하세요)")
    slides = []
    for sid in order:
        heading, term, definition = "", "", ""
        start = source.find(f'<section id="{sid}"')
        if start >= 0:
            section = source[start:source.index("</section>", start)]
            h = re.search(r"<h2[^>]*>(.*?)</h2>", section, re.S)
            t = re.search(r'<span class="zone-b-term">(.*?)</span>', section, re.S)
            d = re.search(r'<span class="zone-b-def">(.*?)</span>', section, re.S)
            heading = _strip(h.group(1)) if h else ""
            term, definition = (_strip(t.group(1)) if t else ""), (_strip(d.group(1)) if d else "")
        title, text = speeches[sid]
        for old, new in NOTE_MARKERS.items():
            text = text.replace(old, new)
        slides.append({
            "id": sid, "title": title, "heading": heading or title,
            "term": term.replace("🔍", "").strip(), "def": definition, "notes": text.strip(),
        })
    return slides


# ---------------------------------------------------------------------------
# 발표 화면 촬영
# ---------------------------------------------------------------------------
def find_chrome():
    for candidate in [os.environ.get("CHROME")] + CHROME_CANDIDATES:
        if candidate and os.path.isfile(candidate):
            return candidate
        if candidate and shutil.which(candidate):
            return shutil.which(candidate)
    raise SystemExit("Chrome을 찾지 못했습니다. CHROME 환경변수에 Chrome·Chromium 실행 파일 경로를 넣어 주세요.")


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def capture_slides(slides, out_dir):
    """frontend/public을 잠시 띄우고, 장마다 촬영 모드로 열어 PNG로 찍습니다."""
    chrome = find_chrome()
    handler = functools.partial(_QuietHandler, directory=PUBLIC)
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        port = server.server_address[1]
        threading.Thread(target=server.serve_forever, daemon=True).start()
        profile = tempfile.mkdtemp(prefix="dart-insight-chrome-")
        try:
            paths = []
            for n, slide in enumerate(slides, 1):
                path = os.path.join(out_dir, f"{n:02d}-{slide['id']}.png")
                url = f"http://127.0.0.1:{port}/easter/three-weeks.html?slide={slide['id']}&capture"
                subprocess.run([
                    chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={profile}",
                    f"--window-size={SHOT_W},{SHOT_H}", "--force-device-scale-factor=1",
                    "--virtual-time-budget=5000", f"--screenshot={path}", url,
                ], check=True, capture_output=True, timeout=120)
                if not os.path.isfile(path):
                    raise SystemExit(f"{slide['id']} 장을 찍지 못했습니다.")
                paths.append(path)
            return paths
        finally:
            server.shutdown()
            shutil.rmtree(profile, ignore_errors=True)


# ---------------------------------------------------------------------------
# 만들기
# ---------------------------------------------------------------------------
def add_notes_master_list(prs):
    """python-pptx는 노트 마스터를 만들 때 presentation.xml에 notesMasterIdLst를 적지 않습니다.
    PowerPoint는 그대로 열지만 Keynote는 열지 못하므로 목록을 채워 넣습니다."""
    pres = prs.part._element
    if pres.find(qn("p:notesMasterIdLst")) is not None:
        return
    rids = [rid for rid, rel in prs.part.rels.items() if rel.reltype.endswith("/notesMaster")]
    if not rids:
        return
    lst = pres.makeelement(qn("p:notesMasterIdLst"), {})
    item = lst.makeelement(qn("p:notesMasterId"), {qn("r:id"): rids[0]})
    lst.append(item)
    pres.find(qn("p:sldMasterIdLst")).addnext(lst)


def build_pptx(slides, images):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SLIDE_W), Inches(SLIDE_H)
    for info, image in zip(slides, images):
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.shapes.add_picture(image, 0, 0, prs.slide_width, prs.slide_height)
        slide.notes_slide.notes_text_frame.text = info["notes"]
    add_notes_master_list(prs)
    prs.save(OUT_PPTX)
    shutil.copyfile(OUT_PPTX, OUT_PPTX_COPY)


def build_script(slides):
    out = [
        "# DART Insight 발표 대본",
        "",
        "> 같은 회사의 정기보고서 두 개를 비교해, 바뀐 숫자와 문장을 원문 위치와 함께 보여 주는 서비스입니다. 투자 조언이 아닙니다.",
        "",
        f"- 웹 발표 페이지(`frontend/public/easter/three-weeks.html`)의 발표 모드와 PPTX(`docs/DART_Insight_Presentation.pptx`)는 같은 {len(slides)}장입니다.",
        "- **이 문서와 PPTX는 `python3 scripts/generate_presentation_pptx.py`가 페이지에서 만듭니다.** 화면·대본은 페이지에서 고치고 스크립트를 다시 돌립니다.",
        "- 대본 형식: ① 여는 질문 → ② 쉬운 설명 → ③ 화면 가리키기 → ④ 마무리 한마디. 장마다 30~45초.",
        "",
        "## 발표에 쓰는 숫자 (2026-11-13 기준, 저장소·GitHub·로컬 DB에서 직접 센 값)",
        "",
        "| 항목 | 값 |",
        "| --- | --- |",
        *[f"| {k} | {v} |" for k, v in FACTS],
        "",
        f"**쓰지 않는 표현**: {AVOID}",
        "",
        "## 장 목록",
        "",
        "| 장 | 제목 | 화면 머리말 | 용어 |",
        "| --- | --- | --- | --- |",
    ]
    for n, s in enumerate(slides, 1):
        term = f"{s['term']} = {s['def']}" if s["term"] else "—"
        out.append(f"| {n:02d} | {s['title']} | {s['heading']} | {term} |")
    out += ["", "## 장별 대본", ""]
    for n, s in enumerate(slides, 1):
        out += [f"### {n:02d} · {s['title']}", f"**{s['heading']}**", "", s["notes"], ""]
    with open(OUT_SCRIPT, "w", encoding="utf-8") as f:
        f.write("\n".join(out).rstrip() + "\n")


def main():
    slides = read_page()
    with tempfile.TemporaryDirectory(prefix="dart-insight-slides-") as shots:
        images = capture_slides(slides, shots)
        build_pptx(slides, images)
    build_script(slides)
    print(f"{len(slides)}장: {os.path.relpath(OUT_PPTX, ROOT)}, {os.path.relpath(OUT_SCRIPT, ROOT)}")


if __name__ == "__main__":
    main()
