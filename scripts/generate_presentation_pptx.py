#!/usr/bin/env python3
"""
DART Insight 발표 PPTX·대본 문서 생성기
=======================================
웹 발표 페이지(frontend/public/easter/three-weeks.html)의 12장을 그대로 PPTX로 옮깁니다.

- 장 순서, 머리말(구분·제목), 용어 카드, 발표 대본은 페이지에서 읽습니다.
  페이지를 고치고 이 스크립트를 다시 돌리면 PPTX와 대본 문서가 함께 맞춰집니다.
- 그림(아이콘 타일, 흐름, 구조도, 실제 화면)은 페이지와 같은 내용으로 여기서 그립니다.
  페이지의 그림을 바꾸면 아래 SLIDE_BUILDERS의 같은 장도 고칩니다.

만드는 파일:
  docs/DART_Insight_Presentation.pptx (frontend/public/easter/에도 복사)
  docs/presentation-script-heo-style.md (발표자 노트와 같은 대본 문서)

실행: python3 scripts/generate_presentation_pptx.py  (python-pptx 필요)
"""

import html
import json
import os
import re
import shutil
import subprocess
import tempfile

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "frontend", "public", "easter", "three-weeks.html")
ASSETS = os.path.dirname(PAGE)
OUT_PPTX = os.path.join(ROOT, "docs", "DART_Insight_Presentation.pptx")
OUT_PPTX_COPY = os.path.join(ASSETS, "DART_Insight_Presentation.pptx")
OUT_SCRIPT = os.path.join(ROOT, "docs", "presentation-script-heo-style.md")

# 디자인 토큰(frontend/src/shared/styles/tokens.css와 같은 값)
CANVAS = RGBColor(0xF6, 0xF7, 0xFA)
CARD = RGBColor(0xFF, 0xFF, 0xFF)
BORDER = RGBColor(0xE4, 0xE6, 0xEB)
PRIMARY = RGBColor(0x14, 0x19, 0x36)
TEXT = RGBColor(0x24, 0x26, 0x30)
MUTED = RGBColor(0x66, 0x66, 0x6E)
ACCENT = RGBColor(0x61, 0x59, 0xB5)
ACCENT_TINT = RGBColor(0xF0, 0xEF, 0xFA)
ACCENT_BORDER = RGBColor(0xD6, 0xD3, 0xE8)
POSITIVE = RGBColor(0x18, 0x76, 0x53)
POSITIVE_TINT = RGBColor(0xEC, 0xF8, 0xF1)
ATTENTION = RGBColor(0x8A, 0x53, 0x00)
ATTENTION_TINT = RGBColor(0xFF, 0xF5, 0xE0)
DANGER = RGBColor(0xB7, 0x42, 0x50)
DANGER_TINT = RGBColor(0xFF, 0xF0, 0xF2)
FONT = "Pretendard"

SLIDE_W, SLIDE_H = 13.333, 7.5

# 발표에 쓰는 숫자. 페이지 표지·일하는 방식 장과 같은 값입니다.
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
    source = open(PAGE, encoding="utf-8").read()
    speeches = _js_object(source, "SPEECHES_BY_ID", "title", "text")
    terms = _js_object(source, "TERMS_BY_ID", "term", "def")
    slides = []
    for sid in speeches:
        kicker, heading = "", ""
        start = source.find(f'<section id="{sid}"')
        if start >= 0:
            section = source[start:source.index("</section>", start)]
            k = re.search(r'<p class="kicker">(.*?)</p>', section, re.S)
            h = re.search(r"<h2[^>]*>(.*?)</h2>", section, re.S)
            kicker, heading = (_strip(k.group(1)) if k else ""), (_strip(h.group(1)) if h else "")
        title, text = speeches[sid]
        for old, new in NOTE_MARKERS.items():
            text = text.replace(old, new)
        term, definition = terms.get(sid, ("", ""))
        slides.append({
            "id": sid, "title": title, "kicker": kicker, "heading": heading or title,
            "term": term.replace("🔍", "").strip(), "def": definition, "notes": text.strip(),
        })
    return slides


def image_path(name):
    """python-pptx가 webp를 못 읽어 png로 바꿔 씁니다(Pillow, 없으면 macOS sips)."""
    path = os.path.join(ASSETS, name)
    if not name.endswith(".webp"):
        return path
    out = os.path.join(tempfile.gettempdir(), name.replace(".webp", ".png"))
    try:
        from PIL import Image
        Image.open(path).save(out)
    except ImportError:
        subprocess.run(["sips", "-s", "format", "png", path, "--out", out], check=True, capture_output=True)
    return out


# ---------------------------------------------------------------------------
# 그리기 도구
# ---------------------------------------------------------------------------
def box(slide, x, y, w, h, fill=CARD, line=BORDER, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08):
    shp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(1)
    shp.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    return shp


def text(slide, x, y, w, h, lines, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    """lines: [(글, 크기, 색, 굵게)] 한 줄씩."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.04)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    for i, (content, size, color, bold) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = content
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def tile(slide, x, y, w, h, icon, title, caption, fill=CARD, line=BORDER, icon_size=34):
    box(slide, x, y, w, h, fill, line)
    text(slide, x + 0.1, y + 0.12, w - 0.2, h - 0.24,
         [(icon, icon_size, TEXT, False), (title, 16, PRIMARY, True), (caption, 11.5, MUTED, False)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def tiles(slide, y, h, items, x0=0.6, x1=SLIDE_W - 0.6, gap=0.22, **kw):
    w = (x1 - x0 - gap * (len(items) - 1)) / len(items)
    for i, (icon, title, caption) in enumerate(items):
        tile(slide, x0 + i * (w + gap), y, w, h, icon, title, caption, **kw)


def flow(slide, y, h, items, x0=0.6, x1=SLIDE_W - 0.6, arrow=0.45, **kw):
    n = len(items)
    w = (x1 - x0 - arrow * (n - 1)) / n
    for i, (icon, title, caption) in enumerate(items):
        x = x0 + i * (w + arrow)
        tile(slide, x, y, w, h, icon, title, caption, icon_size=28, **kw)
        if i < n - 1:
            text(slide, x + w, y, arrow, h, [("→", 20, MUTED, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def chips(slide, y, items, tone="neutral", size=12):
    fill, color = {
        "neutral": (CARD, TEXT), "danger": (DANGER_TINT, DANGER),
        "accent": (ACCENT_TINT, ACCENT), "ok": (POSITIVE_TINT, POSITIVE),
    }[tone]
    widths = [0.42 + 0.155 * len(item) * size / 12 for item in items]
    gap = 0.18
    x = (SLIDE_W - sum(widths) - gap * (len(items) - 1)) / 2
    for item, w in zip(items, widths):
        box(slide, x, y, w, 0.42, fill, BORDER if tone == "neutral" else None, radius=0.5)
        text(slide, x, y, w, 0.42, [(item, size, color, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        x += w + gap


def picture(slide, name, x, y, w, h):
    """상자 안에 비율을 지켜 가운데 놓습니다."""
    pic = slide.shapes.add_picture(image_path(name), Inches(x), Inches(y))
    ratio = min(Inches(w) / pic.width, Inches(h) / pic.height)
    pic.width, pic.height = int(pic.width * ratio), int(pic.height * ratio)
    pic.left = int(Inches(x) + (Inches(w) - pic.width) / 2)
    pic.top = int(Inches(y) + (Inches(h) - pic.height) / 2)
    return pic


def arrow_line(slide, x1, y1, x2, y2, label=""):
    conn = slide.shapes.add_connector(1, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    conn.line.color.rgb = ACCENT
    conn.line.width = Pt(1.75)
    conn.line._get_or_add_ln().append(
        conn.line._get_or_add_ln().makeelement(
            "{http://schemas.openxmlformats.org/drawingml/2006/main}tailEnd", {"type": "triangle"}))
    if label:
        mid = (x1 + x2) / 2
        text(slide, mid - 0.6, min(y1, y2) - 0.3, 1.2, 0.28, [(label, 10, MUTED, False)], align=PP_ALIGN.CENTER)


def frame(prs, info, number, total):
    """배경, 머리말(구분·제목), 용어 카드, 아래 쪽번호, 발표자 노트."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = CANVAS
    if info["kicker"]:
        text(slide, 0.6, 0.38, 7.6, 0.32, [(info["kicker"], 12, ACCENT, True)])
        size = 28 if len(info["heading"]) <= 20 else 22
        text(slide, 0.6, 0.68, 7.95, 0.75, [(info["heading"], size, PRIMARY, True)], anchor=MSO_ANCHOR.MIDDLE)
    if info["term"]:
        box(slide, 8.75, 0.4, 3.98, 1.0, ACCENT_TINT, ACCENT_BORDER)
        text(slide, 8.9, 0.45, 3.7, 0.9,
             [("🔍 " + info["term"], 14, ACCENT, True), (info["def"], 11, TEXT, False)], anchor=MSO_ANCHOR.MIDDLE)
    text(slide, 0.6, 7.05, 6, 0.3, [("DART Insight · 신한DS Academy 2차 프로젝트", 10, MUTED, False)])
    text(slide, SLIDE_W - 2.6, 7.05, 2.0, 0.3, [(f"{number:02d} / {total:02d}", 10, MUTED, True)], align=PP_ALIGN.RIGHT)
    slide.notes_slide.notes_text_frame.text = info["notes"]
    return slide


# ---------------------------------------------------------------------------
# 장별 그림(페이지의 같은 장과 같은 내용)
# ---------------------------------------------------------------------------
def hero(s):
    picture(s, "dart-insight-logo.png", 0.6, 0.5, 0.7, 0.7)
    text(s, 1.4, 0.55, 8, 0.6, [("신한DS 금융 AI 프로젝트 · 2026", 13, ACCENT, True)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 1.6, 12.1, 1.9,
         [("두 보고서 사이, 바뀐 것만.", 46, PRIMARY, True), ("원문 근거와 함께.", 46, ACCENT, True)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 1.5, 3.55, 10.3, 0.5,
         [("같은 회사의 정기보고서 두 개를 비교해, 바뀐 숫자와 문장을 원문 위치와 함께 보여 줍니다.", 16, MUTED, False)],
         align=PP_ALIGN.CENTER)
    stats = [("461", "병합한 PR"), ("1,101", "커밋"), ("67", "설계 기록(ADR)"), ("약 90", "공개 API"), ("약 4,400", "자동 테스트")]
    x0, gap = 0.9, 0.2
    w = (SLIDE_W - 2 * x0 - gap * 4) / 5
    for i, (num, label) in enumerate(stats):
        x = x0 + i * (w + gap)
        box(s, x, 4.45, w, 1.45)
        text(s, x, 4.5, w, 1.35, [(num, 32, ACCENT, True), (label, 13, MUTED, False)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 6.1, 12.1, 0.35, [("2026-10-19 시작 · 2026-11-13 기준", 12, MUTED, False)], align=PP_ALIGN.CENTER)


def glossary(s):
    box(s, 0.6, 1.75, 5.7, 4.35)
    picture(s, "jensen-huang-avatar.png", 0.85, 1.95, 0.85, 0.85)
    picture(s, "nvidia-logo.png", 1.85, 2.15, 1.9, 0.45)
    box(s, 3.85, 2.18, 2.3, 0.4, ACCENT_TINT, None, radius=0.5)
    text(s, 3.85, 2.18, 2.3, 0.4, [("🇺🇸 SEC 8-K · 2026-11-12 제출", 10, ACCENT, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.85, 3.0, 5.25, 3.0, [
        ("“The Board accepted the resignation of Jen-Hsun (Jensen) Huang as President, CEO, and Director, effective immediately.”", 14, MUTED, False),
        ("", 8, MUTED, False),
        ("“이사회는 젠슨 황의 사장·CEO·이사직 사임을 즉시 수락한다.”", 16, PRIMARY, True),
    ], anchor=MSO_ANCHOR.MIDDLE)
    text(s, 6.3, 1.75, 0.73, 4.35, [("=", 40, MUTED, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box(s, 7.03, 1.75, 5.7, 4.35)
    picture(s, "dart-cover.png", 7.3, 1.95, 5.15, 2.95)
    text(s, 7.2, 5.0, 5.35, 1.0, [("🇰🇷 금융감독원 DART", 13, ACCENT, True),
                                    ("우리나라 상장사의 공식 공시가 모두 올라오는 곳", 15, PRIMARY, True)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 6.3, 12.1, 0.5, [("📰 뉴스보다 먼저, 📜 법에 따라 공식으로", 18, PRIMARY, True)], align=PP_ALIGN.CENTER)


def why(s):
    box(s, 0.6, 1.7, 5.95, 2.75, DANGER_TINT, None)
    text(s, 0.8, 1.8, 5.55, 2.55, [("한계 ① 너무 길다", 14, DANGER, True), ("📕📗📘📙", 32, TEXT, False),
                                    ("65만 자", 40, DANGER, True), ("보고서 한 권(최대) · 두 권을 사람이 나란히 비교", 12, MUTED, False)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box(s, 6.78, 1.7, 5.95, 2.75, DANGER_TINT, None)
    text(s, 6.95, 1.8, 2.6, 0.4, [("한계 ② 믿기 어렵다", 14, DANGER, True)])
    picture(s, "pinocchio-hallucination.jpg", 6.95, 2.2, 2.7, 2.1)
    text(s, 9.75, 2.2, 2.85, 2.1, [("AI 환각", 26, DANGER, True), ("그럴듯한 거짓말", 15, PRIMARY, True),
                                    ("출처 없는 숫자, 확인할 수 없는 요약", 12, MUTED, False)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 4.45, 12.1, 0.45, [("⬇", 22, MUTED, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box(s, 0.6, 4.9, 12.13, 1.95, ACCENT_TINT, ACCENT_BORDER)
    text(s, 0.6, 4.95, 12.13, 0.3, [("DART Insight", 13, ACCENT, True)], align=PP_ALIGN.CENTER)
    tiles(s, 5.3, 1.4, [("⚖️", "두 보고서 자동 비교", "바뀐 숫자·문장만 골라냄"),
                        ("🧮", "숫자는 코드가 계산", "AI는 계산하지 않음"),
                        ("📍", "문장마다 원문 위치", "누르면 공시 원문으로 이동")], x0=0.85, x1=12.48, icon_size=24)


def value(s):
    tiles(s, 1.75, 2.15, [("⚖️", "자동 비교", "두 보고서, 바뀐 것만"), ("📍", "원문 위치", "문장마다 출처"),
                          ("🧩", "한 화면 맥락", "숫자 + 설명 + 수시공시"), ("🛡️", "추천하지 않음", "사실과 기준표 신호만")], icon_size=40)
    flow(s, 4.1, 1.45, [("🔎", "검색", ""), ("🏢", "기업 개요", ""), ("📑", "보고서 두 개", ""),
                       ("⏳", "분석", ""), ("📊", "결과", ""), ("💬", "채팅·노트", "")], x0=1.2, x1=12.13, arrow=0.35)
    box(s, 2.0, 5.8, 4.4, 0.9, ACCENT_TINT, ACCENT_BORDER)
    text(s, 2.0, 5.8, 4.4, 0.9, [("결과 화면 · 요약 문장", 11, MUTED, False), ("영업이익 ▲ +33.2%  📍 원문", 16, PRIMARY, True)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 6.4, 5.8, 0.9, 0.9, [("➜", 26, ACCENT, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box(s, 7.3, 5.8, 4.0, 0.9)
    text(s, 7.3, 5.8, 4.0, 0.9, [("📄 DART 공시 원문의 그 문단", 16, PRIMARY, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def activity_financial(s):
    text(s, 0.6, 1.65, 12.1, 0.4, [("실제 공시 값 · 연결 손익계산서 · 2024 → 2025", 13, MUTED, True)], align=PP_ALIGN.CENTER)
    rows = [("매출액", "300.9조", "333.6조", "▲ +10.9%", "+32.7조 원"),
            ("영업이익", "32.7조", "43.6조", "▲ +33.2%", "+10.9조 원"),
            ("당기순이익", "34.5조", "45.2조", "▲ +31.2%", "+10.8조 원")]
    w, gap = 3.85, 0.29
    for i, (name, before, after, rate, diff) in enumerate(rows):
        x = 0.6 + i * (w + gap)
        box(s, x, 2.15, w, 3.55)
        text(s, x, 2.3, w, 0.45, [(name, 18, PRIMARY, True)], align=PP_ALIGN.CENTER)
        text(s, x, 2.85, w, 1.2, [("2024년  " + before, 15, MUTED, False), ("↓", 16, MUTED, True), ("2025년  " + after, 22, PRIMARY, True)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        box(s, x + 0.45, 4.35, w - 0.9, 1.1, POSITIVE_TINT, None)
        text(s, x + 0.45, 4.35, w - 0.9, 1.1, [(rate, 26, POSITIVE, True), (diff, 12, POSITIVE, False)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    chips(s, 6.05, ["🧮 증감은 코드가 계산", "📍 출처 사업보고서(2025.12) · 접수번호 20260310002820"], tone="accent")


TIMELINE = [
    ("2025.11.26", "⚠️", "위험", "종속회사 Harman, 미국 법무부 벌금"),
    ("2025.12.23", "⚠️", "위험", "아산 캠퍼스 사고로 부분작업중지"),
    ("2026.01.29", "💰", "자금", "임직원 보상용 자사주 2,200만 주 취득 결정"),
    ("2026.02.20", "⚠️", "위험", "부분작업중지 해제"),
    ("2026.03.18", "🏛️", "지배구조", "정기주총 · 자사주 추가 취득 결정"),
    ("2026.04.30", "🧭", "투자", "국가 AI컴퓨팅센터 컨소시엄 출자 의결"),
]


def activity_flow(s):
    text(s, 0.6, 1.62, 12.1, 0.4, [("📥 모으기  →  📝 요약·타임라인  →  🎯 관점별 보기  →  🚦 사실과 전망 분리", 15, PRIMARY, True)],
         align=PP_ALIGN.CENTER)
    box(s, 0.6, 2.15, 4.9, 4.55)
    text(s, 0.8, 2.25, 4.5, 0.4, [("🗓️ 1년 타임라인 · 24건 중 6건", 14, PRIMARY, True)])
    for i, (date, icon, cat, label) in enumerate(TIMELINE):
        y = 2.72 + i * 0.6
        text(s, 0.8, y, 1.05, 0.5, [(date, 10.5, MUTED, False)], anchor=MSO_ANCHOR.MIDDLE)
        text(s, 1.85, y, 3.55, 0.5, [(f"{icon} {cat} · {label}", 11.5, TEXT, False)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.8, 6.33, 4.5, 0.3, [("사건마다 공시 원문 근거가 붙어 있어요.", 10, MUTED, False)])
    box(s, 5.72, 2.15, 7.01, 4.55)
    picture(s, "samsung-fact-vs-forecast.webp", 5.85, 2.25, 6.75, 2.6)
    for i, (label, desc, fill, color) in enumerate([("① 공시에 적힌 사실", "원문 문장 그대로 + 근거 위치", ACCENT_TINT, ACCENT),
                                                    ("② 앞으로의 영향", "'AI 전망 · 공시 사실 아님' 표시를 따로", ATTENTION_TINT, ATTENTION)]):
        y = 5.15 + i * 0.6
        box(s, 5.95, y, 2.2, 0.45, fill, None, radius=0.5)
        text(s, 5.95, y, 2.2, 0.45, [(label, 12, color, True)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, 8.25, y, 4.3, 0.45, [(desc, 13, TEXT, False)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 6.72, 12.1, 0.3, [("실제 결과 · 삼성전자 반기보고서 2025.06 → 2026.06", 10.5, MUTED, False)], align=PP_ALIGN.CENTER)


def methods(s):
    flow(s, 1.75, 1.75, [("✅", "비교해도 되나", "같은 회사·맞는 기간"), ("🧮", "코드가 계산", "증감액·증감률"),
                         ("🔍", "바뀐 문장 찾기", "목차·문단 맞추기"), ("📍", "근거 없으면 버림", "원문 위치 필수")])
    box(s, 2.4, 3.95, 8.53, 0.9, CARD, BORDER)
    text(s, 2.4, 3.95, 8.53, 0.9, [("검사 실패   →   🔁 최대 2번 다시 만들기   →   ⚠️ 검토 필요", 17, PRIMARY, True)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.6, 5.2, 12.1, 0.35, [("화면에 나가기 전에 자동으로 막는 표현", 12, MUTED, True)], align=PP_ALIGN.CENTER)
    chips(s, 5.65, ["🚫 매수·매도 추천", "🚫 목표주가", "🚫 주가 예측", "🚫 '저평가' 같은 가치판단"], tone="danger", size=13)


def impact(s):
    tiles(s, 1.85, 2.9, [("🙋", "개인 투자자", "어려운 용어 → 용어 카드"), ("💼", "금융 실무자", "엑셀 대조 → 자동 비교"),
                         ("💬", "커뮤니티", "출처 없는 말 → 원문 인용"), ("🎓", "취업 준비생", "홍보 문구 → 실제 사업 방향"),
                         ("🤝", "거래 검토 기업", "소송·제재 미리 확인")], icon_size=40)
    chips(s, 5.35, ["🧪 자동 테스트 약 4,400개", "♿ 접근성 자동 검사(axe-core)", "🔐 PR마다 비밀정보 검사"], size=13)


STACK = [
    (["react", "typescript"], "화면", "React · TypeScript"),
    (["springboot", "openjdk"], "서비스 API", "Spring Boot · Java 21"),
    (["fastapi", "python", "langgraph"], "AI 처리", "FastAPI · LangGraph"),
    (["claude"], "AI 모델", "Claude (Haiku 기본)"),
    (["mariadb", "flyway"], "데이터", "MariaDB · Flyway"),
    (["modelcontextprotocol"], "외부 AI 연결", "MCP 서버 · 읽기 전용"),
]


def stack(s):
    x0, gap = 0.6, 0.18
    w = (SLIDE_W - 2 * x0 - gap * 5) / 6
    for i, (logos, name, caption) in enumerate(STACK):
        x = x0 + i * (w + gap)
        box(s, x, 1.85, w, 2.7)
        size, lgap = 0.55, 0.12
        lx = x + (w - (size * len(logos) + lgap * (len(logos) - 1))) / 2
        for k, logo in enumerate(logos):
            picture(s, os.path.join("stack", logo + ".png"), lx + k * (size + lgap), 2.25, size, size)
        text(s, x, 3.05, w, 1.3, [(name, 16, PRIMARY, True), (caption, 11, MUTED, False)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box(s, 2.6, 5.05, 8.13, 0.85, ACCENT_TINT, ACCENT_BORDER)
    text(s, 2.6, 5.05, 8.13, 0.85, [("🖥️ 화면  →  ☕ 백엔드  →  🐍 AI 서버, 한 방향으로만", 18, PRIMARY, True)],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def _node(s, x, y, w, h, title, caption, strong=False):
    box(s, x, y, w, h, ACCENT_TINT if strong else CARD, ACCENT if strong else BORDER)
    text(s, x, y, w, h, [(title, 15, PRIMARY, True), (caption, 10.5, MUTED, False)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def architecture(s):
    h = 0.95
    _node(s, 0.6, 2.35, 1.9, h, "👤 사용자", "브라우저")
    _node(s, 3.0, 2.35, 2.1, h, "🖥️ 화면", "React · TS")
    _node(s, 5.6, 2.2, 2.5, 1.25, "☕ 백엔드", "Spring Boot\n작업·캐시·권한·한도", strong=True)
    _node(s, 8.6, 2.35, 2.2, h, "🐍 AI 서버", "FastAPI · LangGraph")
    _node(s, 11.1, 2.35, 1.63, h, "🤖 LLM", "Claude")
    _node(s, 3.0, 4.15, 2.1, h, "🔌 MCP 서버", "외부 AI 에이전트 · 읽기 전용")
    _node(s, 5.35, 4.15, 1.45, h, "🗄️ DB", "MariaDB")
    _node(s, 6.95, 4.15, 1.45, h, "📄 OpenDART", "공시 원문")
    _node(s, 8.6, 4.15, 2.2, h, "📰 NAVER", "뉴스 · 시세")
    arrow_line(s, 2.5, 2.83, 3.0, 2.83)
    arrow_line(s, 5.1, 2.83, 5.6, 2.83, "/api")
    arrow_line(s, 8.1, 2.83, 8.6, 2.83, "/internal")
    arrow_line(s, 10.8, 2.83, 11.1, 2.83)
    arrow_line(s, 5.1, 4.45, 5.75, 3.45)
    for x2 in (6.08, 7.6, 9.3):
        arrow_line(s, 6.85 if x2 < 8 else 7.85, 3.45, x2, 4.15)
    tiles(s, 5.45, 1.35, [("🔑", "열쇠는 한 곳에", "키·권한·한도는 백엔드만"), ("📦", "공시는 한 번만", "접수번호로 저장, 다시 받지 않음"),
                          ("🤖", "AI는 한 문으로", "AI 호출은 AI 서버 한 모듈만")], icon_size=22)


WEEK_STEPS = [("🎯", "성공 기준", "👤 사람"), ("📝", "기획서·수용 기준", "🤖 초안 → 👤 확인"),
              ("🏛️", "설계 기록(ADR)", "🤖 초안 → 👤 확인"), ("🧩", "이슈 쪼개기", "🤖 초안 → 👤 확인"),
              ("💻", "구현", "👤 + 🤖"), ("🧪", "자동 검사", "⚙️ 자동"), ("✅", "수용 검증", "🤖 초안 → 👤 확인")]
ROLES = [
    ("👤 사람이 정한다", CARD, BORDER, ["🎯 무엇을 왜 만들지(성공 기준·범위)", "✔️ 기획서·설계 기록 최종 확인",
                                       "🔀 커밋·PR·병합 결정", "📚 공시 용어·숫자의 사실 확인"]),
    ("🤖 AI가 만든다", ACCENT_TINT, ACCENT_BORDER, ["📝 기획서·이슈·설계 기록 초안(스킬)", "💻 코드와 테스트 작성",
                                                  "🧾 수용 기준마다 증빙 모으기", "🔁 다른 AI와 교차 검토"]),
    ("⚙️ 기계가 막는다", CANVAS, BORDER, ["🧪 자동 테스트 약 4,400개", "♿ 접근성 검사(axe-core)",
                                          "🔐 비밀정보 검사(gitleaks)", "🧭 호출 방향 검사(ArchUnit)"]),
]
AI_STOPS = ["기획서가 없으면 구현을 시작하지 않음", "공시 용어를 추측하지 않음", "설계 기록과 다르면 먼저 물음", "키가 보이면 즉시 멈춤"]


def weeks(s):
    x0, gap = 0.6, 0.12
    w = (SLIDE_W - 2 * x0 - gap * 6) / 7
    for i, (icon, name, owner) in enumerate(WEEK_STEPS):
        x = x0 + i * (w + gap)
        box(s, x, 1.65, w, 1.55)
        text(s, x, 1.7, w, 1.45, [(f"{i + 1:02d}", 9, MUTED, True), (icon, 20, TEXT, False), (name, 11.5, PRIMARY, True), (owner, 9.5, ACCENT, True)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    w, gap = (SLIDE_W - 2 * x0 - 0.22 * 2) / 3, 0.22
    for i, (title, fill, line, items) in enumerate(ROLES):
        x = x0 + i * (w + gap)
        box(s, x, 3.4, w, 2.45, fill, line)
        text(s, x + 0.2, 3.5, w - 0.4, 2.3, [(title, 18, PRIMARY, True)] + [(item, 14.5, TEXT, False) for item in items])
    box(s, x0, 6.0, SLIDE_W - 2 * x0, 0.85, ATTENTION_TINT, None)
    text(s, x0, 6.0, SLIDE_W - 2 * x0, 0.85, [("🛑 AI가 멈추고 사람에게 묻는 때", 12.5, ATTENTION, True),
                                             ("  ·  ".join(AI_STOPS), 12, TEXT, False)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


SLIDE_BUILDERS = {
    "hero": hero, "glossary": glossary, "why": why, "value": value,
    "activity-financial": activity_financial, "activity-flow": activity_flow, "methods": methods,
    "impact": impact, "stack": stack, "architecture": architecture, "weeks": weeks,
}


# ---------------------------------------------------------------------------
# 만들기
# ---------------------------------------------------------------------------
def build_pptx(slides):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SLIDE_W), Inches(SLIDE_H)
    for number, info in enumerate(slides, 1):
        slide = frame(prs, info, number, len(slides))
        builder = SLIDE_BUILDERS.get(info["id"])
        if builder is None:
            raise SystemExit(f"그림이 없는 장입니다: {info['id']} (SLIDE_BUILDERS에 추가하세요)")
        builder(slide)
    add_notes_master_list(prs)
    prs.save(OUT_PPTX)
    shutil.copyfile(OUT_PPTX, OUT_PPTX_COPY)


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


def build_script(slides):
    out = [
        "# DART Insight 발표 대본",
        "",
        "> 같은 회사의 정기보고서 두 개를 비교해, 바뀐 숫자와 문장을 원문 위치와 함께 보여 주는 서비스입니다. 투자 조언이 아닙니다.",
        "",
        f"- 웹 발표 페이지(`frontend/public/easter/three-weeks.html`)와 PPTX(`docs/DART_Insight_Presentation.pptx`)는 같은 {len(slides)}장입니다.",
        "- **이 문서와 PPTX는 `python3 scripts/generate_presentation_pptx.py`가 페이지의 대본에서 만듭니다.** 대본은 페이지에서 고치고 스크립트를 다시 돌립니다.",
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
        out.append(f"| {n:02d} | {s['title']} | {s['heading']} | {s['term']} = {s['def']} |")
    out += ["", "## 장별 대본", ""]
    for n, s in enumerate(slides, 1):
        out += [f"### {n:02d} · {s['title']}", f"**{s['heading']}**", "", s["notes"], ""]
    with open(OUT_SCRIPT, "w", encoding="utf-8") as f:
        f.write("\n".join(out).rstrip() + "\n")


def main():
    slides = read_page()
    build_pptx(slides)
    build_script(slides)
    print(f"{len(slides)}장: {os.path.relpath(OUT_PPTX, ROOT)}, {os.path.relpath(OUT_SCRIPT, ROOT)}")


if __name__ == "__main__":
    main()
