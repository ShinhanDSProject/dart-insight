#!/usr/bin/env python3
"""
DART Insight High-Impact Presentation PPTX Generator (Bright Theme)
===================================================================
Generates docs/DART_Insight_Presentation.pptx in an ultra-clean, modern,
bright enterprise theme (Slate-50 canvas, crisp white cards, Shinhan Blue
and Sky Cyan accents) matching the aesthetics of three-weeks.html.

Includes 24 dynamic, fast-paced slides with embedded Korean speaker notes
meticulously calibrated for a 10~11 minute keynote presentation.
"""

import os
import shutil
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# -----------------------------------------------------------------------------
# Color Palette Constants (Bright / Light Enterprise Theme)
# -----------------------------------------------------------------------------
BG_CANVAS = RGBColor(248, 250, 252)     # #F8FAFC Soft Slate-50 Canvas
CARD_WHITE = RGBColor(255, 255, 255)    # #FFFFFF Pure White Surface
CARD_MUTED = RGBColor(241, 245, 249)    # #F1F5F9 Slate-100 Light Container

BORDER_LIGHT = RGBColor(226, 232, 240)  # #E2E8F0 Subtle Slate Border
BORDER_STRONG = RGBColor(203, 213, 225) # #CBD5E1 Medium Slate Border

TEXT_PRIMARY = RGBColor(15, 23, 42)     # #0F172A Deep Navy / Charcoal
TEXT_SECONDARY = RGBColor(51, 65, 85)   # #334155 Slate-700 Readable Body
TEXT_MUTED = RGBColor(100, 116, 139)    # #64748B Slate-500 Captions

# Accent Tints & Strokes
ACCENT_BLUE = RGBColor(0, 85, 255)      # #0055FF Shinhan DS Blue
TINT_BLUE = RGBColor(239, 246, 255)     # #EFF6FF Blue-50 Tint

ACCENT_CYAN = RGBColor(2, 132, 199)     # #0284C7 Sky Cyan
TINT_CYAN = RGBColor(240, 249, 255)     # #F0F9FF Sky-50 Tint

ACCENT_GREEN = RGBColor(16, 185, 129)   # #10B981 Emerald Mint
TINT_GREEN = RGBColor(236, 253, 245)    # #ECFDF5 Mint-50 Tint

ACCENT_AMBER = RGBColor(217, 119, 6)    # #D97706 Warm Amber
TINT_AMBER = RGBColor(254, 252, 232)    # #FEFCE8 Amber-50 Tint

ACCENT_RED = RGBColor(225, 29, 72)      # #E11D48 Rose Alert
TINT_RED = RGBColor(255, 241, 242)      # #FFF1F2 Rose-50 Tint

ACCENT_PURPLE = RGBColor(124, 58, 237)  # #7C3AED Violet
TINT_PURPLE = RGBColor(245, 243, 255)   # #F5F3FF Violet-50 Tint

FONT_HEADING = "Pretendard"
FONT_BODY = "Pretendard"

# -----------------------------------------------------------------------------
# Base Helper Functions
# -----------------------------------------------------------------------------
def set_slide_background(slide):
    """Sets a crisp bright canvas background."""
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5)
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = BG_CANVAS
    bg.line.fill.background()
    return bg

def add_header(slide, kicker_text, title_text, subtitle_text, kicker_color=ACCENT_BLUE, kicker_tint=TINT_BLUE):
    """Adds a modern website-style header with a colored kicker pill."""
    # Kicker Pill Badge
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.42), Inches(3.2), Inches(0.32))
    pill.fill.solid()
    pill.fill.fore_color.rgb = kicker_tint
    pill.line.color.rgb = kicker_color
    pill.line.width = Pt(1)

    tb_k = slide.shapes.add_textbox(Inches(0.8), Inches(0.44), Inches(3.2), Inches(0.28))
    tf_k = tb_k.text_frame
    tf_k.margin_left = tf_k.margin_top = tf_k.margin_right = tf_k.margin_bottom = 0
    p_k = tf_k.paragraphs[0]
    p_k.alignment = PP_ALIGN.CENTER
    p_k.text = kicker_text.upper()
    p_k.font.name = FONT_HEADING
    p_k.font.size = Pt(10.5)
    p_k.font.bold = True
    p_k.font.color.rgb = kicker_color

    # Main Title
    tb_t = slide.shapes.add_textbox(Inches(0.8), Inches(0.82), Inches(11.733), Inches(0.65))
    tf_t = tb_t.text_frame
    tf_t.word_wrap = True
    tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
    p_t = tf_t.paragraphs[0]
    p_t.text = title_text
    p_t.font.name = FONT_HEADING
    p_t.font.size = Pt(22)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_PRIMARY

    # Subtitle
    if subtitle_text:
        tb_s = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.733), Inches(0.38))
        tf_s = tb_s.text_frame
        tf_s.word_wrap = True
        tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
        p_s = tf_s.paragraphs[0]
        p_s.text = subtitle_text
        p_s.font.name = FONT_BODY
        p_s.font.size = Pt(12.5)
        p_s.font.color.rgb = TEXT_MUTED

def add_card(slide, left, top, width, height, bg_color=CARD_WHITE, border_color=BORDER_LIGHT, border_width=1.0):
    """Draws a crisp card container."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(border_width)
    else:
        shape.line.fill.background()
    return shape

def add_footer(slide, current_slide, total_slides=24):
    """Adds a standard presentation footer with slide counter."""
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(7.02), Inches(11.733), Inches(0.3))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = f"DART Insight · 신한DS 금융 AI 프로젝트 쇼케이스            기준: 421+ PRs · 2,626+ Tests · 66 ADRs            {current_slide:02d} / {total_slides:02d}"
    p.font.name = FONT_BODY
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_MUTED

def set_speaker_notes(slide, notes_text):
    """Sets slide speaker notes."""
    notes_slide = slide.notes_slide
    notes_slide.notes_text_frame.text = notes_text.strip()


# -----------------------------------------------------------------------------
# 24 Slide Builders
# -----------------------------------------------------------------------------

def s01_title_vision(prs):
    """01 · DART Insight 비전 & 개요"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "01 · Project Vision",
        "300페이지 공시 대조를 5초 만에, 100% 원문 근거와 환각 0%로 완벽히 해결하다",
        "신한DS 금융 AI 프로젝트 · 전자공시 정기보고서 비교 분석 및 인과관계 추적 플랫폼"
    )

    metrics = [
        ("5초", "초고속 대조 속도", "300페이지 보고서 2개를 5초 만에 대조하여 재무·본문 변경점 추출", ACCENT_BLUE, TINT_BLUE),
        ("100%", "원문 추적 신뢰도", "모든 수치와 문장에 DART 접수번호 및 블록 ID를 1:1 직결 보존", ACCENT_GREEN, TINT_GREEN),
        ("0%", "수치 환각 원천 차단", "숫자 연산은 100% 백엔드 코드가 계산, LLM에 계산을 일절 맡기지 않음", ACCENT_AMBER, TINT_AMBER),
        ("2,626개", "엔지니어링 무결성", "단위·통합·E2E 자동화 테스트 100% 통과 및 WCAG 2.1 AA 접근성 준수", ACCENT_PURPLE, TINT_PURPLE),
    ]

    card_w = Inches(2.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    for i, (val, title, desc, col, tint) in enumerate(metrics):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, col, 1.5)

        # Top color bar
        bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.2), top_y + Inches(0.2), card_w - Inches(0.4), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = col
        bar.line.fill.background()

        tb = slide.shapes.add_textbox(x + Inches(0.25), top_y + Inches(0.45), card_w - Inches(0.5), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        p1.text = val
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(36)
        p1.font.bold = True
        p1.font.color.rgb = col
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = title
        p2.font.name = FONT_HEADING
        p2.font.size = Pt(16)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_PRIMARY
        p2.space_after = Pt(12)

        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.name = FONT_BODY
        p3.font.size = Pt(12)
        p3.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 1)
    set_speaker_notes(slide, """[발표 시간: 30초 | 누적: 00:30]
"안녕하십니까. 신한DS 금융 AI 프로젝트, DART Insight의 발표를 맡은 [발표자 이름]입니다.
DART Insight는 수작업에 4시간이 걸리던 정기보고서 대조 노동을 단 5초 만에, 100% 원문 근거와 환각 0%로 완벽히 해결한 금융 AI 인텔리전스 시스템입니다."
""")

def s02_painpoint_manual(prs):
    """02 · 공시 대조의 현실: 65만 자의 거대한 침묵"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "02 · The Reality of Disclosure",
        "수작업 4시간 소요 — 300페이지 사업보고서 2개를 띄우고 벌이는 소모적 노동",
        "대한민국 기업들의 정기보고서 한 권은 평균 30만~65만 자의 방대한 분량입니다.",
        ACCENT_RED, TINT_RED
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    problems = [
        ("01", "300페이지 무한 스크롤", "전년도와 올해 보고서 두 창을 모니터에 나란히 띄우고 수백 페이지를 스크롤하며 주석 하나하나를 Ctrl+F로 대조해야 했습니다.", ACCENT_RED),
        ("02", "숙련 전문가도 3~4시간", "5대 재무제표와 본문 수천 개 문단을 육안 대조하다 보면 집중력 저하로 핵심 변경점을 놓치는 인적 오류가 빈번했습니다.", ACCENT_RED),
        ("03", "인과관계 수동 추적", "숫자가 늘어나거나 줄었을 때, 그 원인이 경영진단(MD&A)이나 수시공시 어디에 적혀 있는지 사람이 일일이 찾아다녀야 했습니다.", ACCENT_RED),
    ]

    for i, (num, title, desc, col) in enumerate(problems):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"PAIN POINT {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 2)
    set_speaker_notes(slide, """[발표 시간: 30초 | 누적: 01:00]
"투자자나 금융 실무자가 기업의 진짜 변화를 알려면 300페이지짜리 전년 보고서와 올해 보고서를 나란히 띄우고 수시간 동안 주석을 대조해야 했습니다. 숙련된 전문가도 3~4시간이 걸리는 지독한 수작업 노동이었습니다."
""")

def s03_painpoint_hallucination(prs):
    """03 · 시중 생성형 AI의 한계: 수치 환각"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "03 · AI Limitation in Finance",
        "\"금융 시장에서 1%의 환각은 치명적인 독입니다\"",
        "기존 생성형 AI에게 숫자를 맡기는 순간 발생하는 치명적 계산 왜곡과 규제 위반 위험",
        ACCENT_RED, TINT_RED
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    hazards = [
        ("01", "치명적인 수치 날조", "영업이익이 15% 증가했는데 25%라고 천연덕스럽게 거짓말을 하거나 3년 전 수치를 올해 수치로 둔갑시키는 환각이 발생합니다.", ACCENT_RED),
        ("02", "출처와 근거의 부재", "AI가 요약한 문장이 실제 공시 몇 페이지 몇 문단에 근거한 것인지 알 수 없어, 결국 사람이 다시 찾아보고 검증해야 했습니다.", ACCENT_RED),
        ("03", "자본시장법 위반 소지", "무분별한 LLM 답변이 '대박 호재, 적극 매수' 같은 주관적 매수/매도 권유를 내보내어 금융 자문 규제 리스크를 유발합니다.", ACCENT_RED),
    ]

    for i, (num, title, desc, col) in enumerate(hazards):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, TINT_RED, BORDER_STRONG, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"HAZARD {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 3)
    set_speaker_notes(slide, """[발표 시간: 30초 | 누적: 01:30]
"많은 분들이 'ChatGPT에게 요약해달라고 하면 되는 것 아니냐?'고 묻습니다. 하지만 금융에서 잘못된 숫자는 수억 원의 손실을 초래합니다. 문학에서는 95% 정확도가 훌륭할지 몰라도, 금융 시장에서는 1%의 환각도 치명적인 독이 됩니다."
""")

def s04_philosophy_declaration(prs):
    """04 · DART Insight의 대선언: AI는 비서지 대표가 아니다"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "04 · Core Philosophy",
        "\"AI는 최고의 비서지, 대표가 아닙니다\"",
        "계산은 100% 코드가 검증하고, AI는 정제된 원문 팩트만을 전달한다",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(5.72)
    card_h = Inches(4.7)
    top_y = Inches(2.05)

    # Left: Code Side
    add_card(slide, Inches(0.8), top_y, card_w, card_h, CARD_WHITE, ACCENT_BLUE, 1.8)
    tb_l = slide.shapes.add_textbox(Inches(1.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = tf_l.margin_top = tf_l.margin_right = tf_l.margin_bottom = 0

    p_lh = tf_l.paragraphs[0]
    p_lh.text = "💻 코드가 계산한다 (100% 수치 무결성)"
    p_lh.font.name = FONT_HEADING
    p_lh.font.size = Pt(17)
    p_lh.font.bold = True
    p_lh.font.color.rgb = ACCENT_BLUE
    p_lh.space_after = Pt(14)

    items_l = [
        "증감액·증감률·비율·순위는 백엔드 Java 코드가 100% 연산",
        "이전 값이 null이거나 0이면 나눗셈 오류 대신 명확한 사유 코드 기록",
        "LLM에게 숫자를 1원도 맡기지 않고 확정된 JSON 결과만 전달",
        "동일한 보고서 쌍은 접수번호 기준 영구 캐시로 일관된 수치 보장"
    ]
    for it in items_l:
        p = tf_l.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    # Right: AI Side
    add_card(slide, Inches(6.8), top_y, card_w, card_h, CARD_WHITE, ACCENT_GREEN, 1.8)
    tb_r = slide.shapes.add_textbox(Inches(7.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0

    p_rh = tf_r.paragraphs[0]
    p_rh.text = "🤖 AI는 팩트를 정리한다 (100% 원문 추적)"
    p_rh.font.name = FONT_HEADING
    p_rh.font.size = Pt(17)
    p_rh.font.bold = True
    p_rh.font.color.rgb = ACCENT_GREEN
    p_rh.space_after = Pt(14)

    items_r = [
        "경영진단(MD&A) 원문 문단에서 수치 증감의 '이유'를 검색·인용",
        "생성된 모든 문장에 고유 원문 블록 ID({접수번호}#B{번호}) 강제 부착",
        "화면 송출 전 가치판단·매수추천 금지 표현 정규식 자동 검사",
        "검증 실패 시 최대 2회 재생성 후 '검토 필요'로 안전 격리"
    ]
    for it in items_r:
        p = tf_r.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    add_footer(slide, 4)
    set_speaker_notes(slide, """[발표 시간: 30초 | 누적: 02:00]
"그래서 저희 팀은 프로젝트 첫날 선언했습니다. 'AI는 최고의 비서지, 대표가 아니다!' 숫자는 100% 코드가 계산하고, AI는 정제된 원문 팩트를 사용자에게 직관적으로 연결하는 역할만 수행하게 설계했습니다."
""")

def s05_pillar_speed(prs):
    """05 · Pillar 01: ⚡ 초고속성 (Speed)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "05 · Value Pillar 01",
        "수작업 4시간 소요 대조를 단 5초로 압축한 초고속 분석 엔진",
        "5대 재무제표와 수천 개 본문 문단을 5초 만에 파싱하고 차분을 추출합니다.",
        ACCENT_CYAN, TINT_CYAN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    steps = [
        ("01", "비교 가능성 자동 검증", "결산월 일치, 통화 일치, 정정보고서 반영 여부를 사전에 자동 점검하여 비교 불가능한 데이터의 왜곡을 원천 방지합니다.", ACCENT_CYAN),
        ("02", "5대 재무제표 5초 대조", "재무상태표, 손익계산서, 포괄손익계산서, 자본변동표, 현금흐름표의 전 계정을 5초 만에 매핑하고 증감액과 증감률을 산출합니다.", ACCENT_CYAN),
        ("03", "영구 캐시 밀리초 응답", "한 번 파싱된 보고서 쌍은 로컬 DB에 영구 적재되어, 두 번째 조회부터는 외부 API 호출 0회 및 밀리초 단위 즉답을 보장합니다.", ACCENT_CYAN),
    ]

    for i, (num, title, desc, col) in enumerate(steps):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"FEATURE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 5)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 02:25]
"첫 번째 가치는 초고속성입니다. 두 개 보고서의 재무제표 5종과 수천 문단을 대조하여 핵심 증감 포인트를 추출하는 데 걸리는 시간은 단 5초에 불과합니다."
""")

def s06_pillar_traceability(prs):
    """06 · Pillar 02: 🎯 100% 원문 추적성 (Traceability)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "06 · Value Pillar 02",
        "화면에 표시되는 모든 숫자와 문장에 고유 블록 ID 1:1 직결",
        "원문 근거가 없으면 단 한 줄도 화면에 내보내지 않는 무결성 원칙을 고수합니다.",
        ACCENT_GREEN, TINT_GREEN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    steps = [
        ("01", "고유 블록 ID 영구 보존", "원문 파싱 단계에서 모든 표와 문단에 '{접수번호}#B{블록번호}' 형식의 식별자를 매겨 데이터베이스에 영구 보존합니다.", ACCENT_GREEN),
        ("02", "원클릭 원문 점프 동기화", "화면의 근거 뱃지를 누르면 우측 DART 공시 뷰어가 해당 문단으로 즉시 부드럽게 스크롤되며 노란색으로 하이라이트됩니다.", ACCENT_GREEN),
        ("03", "미검증 문장 화면 송출 차단", "AI가 작성한 문장에 유효한 원문 ID가 없거나 실제 원문 위치와 불일치하면 백엔드 검증기에서 즉시 탈락 처리합니다.", ACCENT_GREEN),
    ]

    for i, (num, title, desc, col) in enumerate(steps):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"FEATURE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 6)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 02:50]
"두 번째 가치는 100% 원문 추적성입니다. 화면에 보이는 모든 수치와 문장은 원문 블록 ID를 가집니다. 클릭 한 번이면 원문의 정확한 위치로 즉시 점프하며, 출처 없는 설명은 단 한 줄도 화면에 내보내지 않습니다."
""")

def s07_pillar_context(prs):
    """07 · Pillar 03: 🔗 다차원 맥락 연결 (Contextuality)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "07 · Value Pillar 03",
        "재무제표 숫자 + 본문 경영진단 + 1년 치 수시공시를 하나로 꿰뚫다",
        "차가운 숫자 증감을 넘어 기업의 진짜 변화 스토리를 입체적으로 연결합니다.",
        ACCENT_PURPLE, TINT_PURPLE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    steps = [
        ("01", "재무 증감 ↔ 본문 MD&A 연결", "영업이익이 왜 올랐는지, 매출이 왜 줄었는지를 '이사의 경영진단(MD&A)' 문단과 자동으로 매핑하여 인과관계를 설명합니다.", ACCENT_PURPLE),
        ("02", "1년 수시공시 타임라인 융합", "두 정기보고서 사이에 발생한 대규모 공급계약, 유상증자, 특허 등 핵심 수시공시를 시간순 타임라인으로 결합합니다.", ACCENT_PURPLE),
        ("03", "약속 vs 실제 이행 대조", "전년도 사업보고서에서 경영진이 공언했던 시설투자나 사업 계획이 올해 실제로 지켜졌는지를 즉시 대조해 보여줍니다.", ACCENT_PURPLE),
    ]

    for i, (num, title, desc, col) in enumerate(steps):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"FEATURE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 7)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 03:15]
"세 번째 가치는 다차원 맥락 연결입니다. 차가운 숫자만 보지 않고, 숫자가 왜 바뀌었는지를 경영진단 본문 및 지난 1년간 발생한 주요 수시공시와 결합하여 입체적으로 조망합니다."
""")

def s08_pillar_compliance(prs):
    """08 · Pillar 04: 🛡️ 규제 준수 & 객관성 (Compliance)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "08 · Value Pillar 04",
        "자본시장법 준수와 주관적 가치판단 배제의 원칙",
        "매수/매도 권유 없이 객관적인 팩트만을 전달하는 컴플라이언스 가드레일을 구축했습니다.",
        ACCENT_AMBER, TINT_AMBER
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    steps = [
        ("01", "투자 권유 표현 자동 필터링", "'대박 호재', '적극 매수', '목표주가' 등 투자 판단을 유도하는 주관적 표현을 화면 송출 전 정규식으로 자동 차단합니다.", ACCENT_AMBER),
        ("02", "AI 생성 메타데이터 투명 표기", "모든 AI 요약본에 모델명, 프롬프트 버전, 호출 시각을 함께 영구 저장하여 설명 가능성과 감사 추적성을 확보했습니다.", ACCENT_AMBER),
        ("03", "미확인 설명의 안전 격리", "공시 근거가 없거나 검증에 실패한 항목은 '검토 필요' 배지로 투명하게 표시하여 거짓 정보를 참으로 둔갑시키지 않습니다.", ACCENT_AMBER),
    ]

    for i, (num, title, desc, col) in enumerate(steps):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"FEATURE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 8)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 03:40]
"네 번째 가치는 규제 준수입니다. 자본시장법 가이드라인에 따라 매수나 매도 추천을 철저히 배제하고 객관적인 팩트만 제공합니다. AI가 모르는 것은 '검토 필요'로 안전하게 격리합니다."
""")

def s09_tech_xml_streaming(prs):
    """09 · 엔지니어링 난제 01: 50MB XML 스트리밍 파서"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "09 · Breakthrough 01",
        "DOM 메모리 폭발을 극복한 StAX 스트리밍 파서 도입",
        "50MB 대용량 공시 XML 문서를 O(1) 메모리인 80MB 이하로 완벽히 통제했습니다.",
        ACCENT_CYAN, TINT_CYAN
    )

    card_w = Inches(5.72)
    card_h = Inches(4.7)
    top_y = Inches(2.05)

    # Left: DOM Failure
    add_card(slide, Inches(0.8), top_y, card_w, card_h, TINT_RED, BORDER_STRONG, 1.2)
    tb_l = slide.shapes.add_textbox(Inches(1.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = tf_l.margin_top = tf_l.margin_right = tf_l.margin_bottom = 0

    p_lh = tf_l.paragraphs[0]
    p_lh.text = "❌ 기존 DOM 파서 방식 (메모리 폭발)"
    p_lh.font.name = FONT_HEADING
    p_lh.font.size = Pt(17)
    p_lh.font.bold = True
    p_lh.font.color.rgb = ACCENT_RED
    p_lh.space_after = Pt(14)

    items_l = [
        "50MB XML 문서 전체를 메모리에 트리 구조로 일괄 적재",
        "파싱 과정에서 메모리 사용량이 500MB~1GB까지 급증 (O(N))",
        "동시 요청 발생 시 서버 Out Of Memory (OOM) 셧다운 유발",
        "대형 상장사 보고서 처리 시 수십 초 이상의 병목 지연 발생"
    ]
    for it in items_l:
        p = tf_l.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    # Right: StAX Solution
    add_card(slide, Inches(6.8), top_y, card_w, card_h, TINT_GREEN, ACCENT_GREEN, 1.5)
    tb_r = slide.shapes.add_textbox(Inches(7.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0

    p_rh = tf_r.paragraphs[0]
    p_rh.text = "✅ StAX XML 스트리밍 파서 (O(1) 통제)"
    p_rh.font.name = FONT_HEADING
    p_rh.font.size = Pt(17)
    p_rh.font.bold = True
    p_rh.font.color.rgb = ACCENT_GREEN
    p_rh.space_after = Pt(14)

    items_r = [
        "이벤트 기반(Pull Parser)으로 필요한 태그만 순차 소비",
        "문서 크기와 무관하게 메모리 사용량을 80MB 이하로 유지 (O(1))",
        "섹션·표·문단 단위로 즉시 분해하여 고유 블록 ID 매핑",
        "대용량 공시 파싱 속도를 3초 이내로 단축 완료"
    ]
    for it in items_r:
        p = tf_r.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    add_footer(slide, 9)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 04:05]
"50MB에 달하는 대용량 공시 XML을 일반적인 DOM 파서로 열면 메모리가 폭발합니다. 저희는 StAX 스트리밍 파서를 도입하여 메모리 사용량을 O(1) 수준인 80MB 이하로 묶어두었습니다."
""")

def s10_tech_bm25_search(prs):
    """10 · 엔지니어링 난제 02: 한국어 2-gram 인메모리 BM25"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "10 · Breakthrough 02",
        "고비용 벡터 DB를 대체한 한국어 2-gram 인메모리 BM25 엔진",
        "금융 계정명의 엄밀성을 지키고 단 45ms 안에 가장 완벽한 설명 문단을 적중합니다.",
        ACCENT_GREEN, TINT_GREEN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    specs = [
        ("01", "계정명 엄밀성 보존", "벡터 임베딩은 '매출채권충당금'과 '기타대손충당금'을 유사 계정으로 뭉개는 환각을 유발합니다. BM25는 회계 고유명사를 100% 엄격 일치시킵니다.", ACCENT_GREEN),
        ("02", "40자 이상 경영진단 필터", "'※ 출처: 2024년 12월' 같은 20자 미만 단순 출처 단문이 1위로 올라오는 현상을 40자 길이 필터로 원천 차단했습니다.", ACCENT_GREEN),
        ("03", "단 45ms 초고속 적중", "외부 임베딩 API 호출 지연(2~3초) 없이 인메모리 상에서 45ms 안에 매출액·영업이익 증감의 원인 문단을 정확히 찾아냅니다.", ACCENT_GREEN),
    ]

    for i, (num, title, desc, col) in enumerate(specs):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"SPEC {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 10)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 04:30]
"근거 검색에서는 고비용 벡터 DB 대신 금융에 특화된 2-gram 인메모리 BM25 엔진을 직접 구축했습니다. 40자 이상 길이 필터를 결합하여 단 45ms 만에 정확한 경영진단 근거 문단을 적중합니다."
""")

def s11_tech_fsm_guard(prs):
    """11 · 엔지니어링 난제 03 & 04: 환각 방지 가드레일 & FSM 전이표"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "11 · Breakthrough 03 & 04",
        "수치 환각 0% 가드레일과 작업 무결성을 보장하는 단방향 FSM",
        "아키텍처 수준에서 물리적으로 강제한 데이터 무결성과 비동기 작업 통제",
        ACCENT_PURPLE, TINT_PURPLE
    )

    card_w = Inches(5.72)
    card_h = Inches(4.7)
    top_y = Inches(2.05)

    # Left: FSM
    add_card(slide, Inches(0.8), top_y, card_w, card_h, CARD_WHITE, ACCENT_PURPLE, 1.5)
    tb_l = slide.shapes.add_textbox(Inches(1.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = tf_l.margin_top = tf_l.margin_right = tf_l.margin_bottom = 0

    p_lh = tf_l.paragraphs[0]
    p_lh.text = "⚙️ 단방향 FSM 상태 전이표 (ADR-0042)"
    p_lh.font.name = FONT_HEADING
    p_lh.font.size = Pt(17)
    p_lh.font.bold = True
    p_lh.font.color.rgb = ACCENT_PURPLE
    p_lh.space_after = Pt(14)

    items_l = [
        "허용 경로: PENDING → RUNNING → COMPLETED 또는 FAILED",
        "비정상 전이(RUNNING → PENDING 등) 시도 시 즉시 '400 에러' 차단",
        "결과를 DB에 영속 저장하기 전에는 COMPLETED로 변경 불가",
        "분산 환경 및 서버 재시작 중에도 분석 작업 상태 꼬임 0건 통제"
    ]
    for it in items_l:
        p = tf_l.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    # Right: Guardrail
    add_card(slide, Inches(6.8), top_y, card_w, card_h, CARD_WHITE, ACCENT_AMBER, 1.5)
    tb_r = slide.shapes.add_textbox(Inches(7.1), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0

    p_rh = tf_r.paragraphs[0]
    p_rh.text = "🛡️ 사실 추출 정규식 가드레일 (ADR-0008)"
    p_rh.font.name = FONT_HEADING
    p_rh.font.size = Pt(17)
    p_rh.font.bold = True
    p_rh.font.color.rgb = ACCENT_AMBER
    p_rh.space_after = Pt(14)

    items_r = [
        "AI 응답 텍스트 내 원문 블록 ID({접수번호}#B{번호}) 존재 여부 전수 검사",
        "해당 블록이 실제 DB 원문에 존재하는지 백엔드 검증기가 교차 확인",
        "'매수 추천', '대박 호재' 등 불법 자문성 키워드 즉시 적발 차단",
        "2회 재생성 실패 시 '검토 필요'로 안전 격리하여 환각 0% 달성"
    ]
    for it in items_r:
        p = tf_r.add_paragraph()
        p.text = f"• {it}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_SECONDARY
        p.space_after = Pt(8)

    add_footer(slide, 11)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 04:55]
"작업 상태는 엄격한 단방향 FSM 전이표로 통제하여 분산 환경에서도 작업 꼬임을 0건으로 막았습니다. 또한 AI가 생성한 문장은 원문 ID 정규식 가드레일을 통과해야만 화면에 노출됩니다."
""")

def s12_tech_dual_routing(prs):
    """12 · 엔지니어링 난제 05: 2-Tier 듀얼 라우팅 & 비용 95% 절감"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "12 · Breakthrough 05",
        "2-Tier 듀얼 라우팅으로 상용 서비스 대비 API 비용 95% 절감",
        "경량 모델과 고성능 모델의 역할 분담 및 프롬프트 캐싱으로 토큰 비용을 최소화했습니다.",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    tiers = [
        ("TIER 1", "경량 모델 의도 파악", "질문 분석, 툴 선택, 단순 경로 탐색 등 1차 작업에는 토큰당 단가가 저렴한 경량 모델(Haiku)을 투입합니다.", ACCENT_BLUE),
        ("TIER 2", "고성능 모델 심층 합성", "정제된 원문 근거를 바탕으로 정밀한 요약 보고서를 작성할 때만 상위 모델(Sonnet)을 제한적으로 호출합니다.", ACCENT_PURPLE),
        ("SAVINGS", "프롬프트 캐싱 95% 절감", "반복되는 시스템 프롬프트 캐싱을 적용해 중복 토큰 비용 90% 이상을 절감, 보고서 1건당 실질 비용을 수십 원으로 낮췄습니다.", ACCENT_GREEN),
    ]

    for i, (kicker, title, desc, col) in enumerate(tiers):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 12)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 05:20]
"LLM 비용 최적화 역시 2-Tier 듀얼 라우팅으로 해결했습니다. 경량 모델로 도구를 고르고 고성능 모델로 보고서를 작성하며, 프롬프트 캐싱을 더해 API 비용을 95% 절감했습니다."
""")

def s13_arch_4tier(prs):
    """13 · 시스템 아키텍처: 엄격한 4-Tier 단방향 계층 분리"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "13 · Architecture 01",
        "React → Spring Boot → FastAPI → MariaDB 단방향 의존성",
        "계층 역참조를 원천 차단하고 ArchUnit 아키텍처 단위 테스트로 100% 강제합니다.",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(2.7)
    card_h = Inches(4.7)
    gap = Inches(0.31)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    tiers = [
        ("TIER 1", "React 19", "화면 프론트엔드", [
            "단방향: 오직 Spring Boot 공개 API만 호출",
            "FastAPI / OpenDART 직접 호출 절대 금지",
            "axe-core 웹 접근성 0개 위반 준수",
            "Figma 디자인 토큰 기반 심플 통일 UI"
        ], ACCENT_CYAN),
        ("TIER 2", "Spring Boot", "코어 백엔드 API", [
            "OpenDART 수집 및 불변 공시 캐시 관리",
            "비동기 분석 작업 큐 & FSM 상태 전이",
            "증감액·증감률 100% 수학적 코드 계산",
            "X-Trace-Id 분산 추적 헤더 동기화"
        ], ACCENT_BLUE),
        ("TIER 3", "FastAPI", "고성능 AI 연산", [
            "StAX XML 스트리밍 파싱 (메모리 O(1))",
            "한국어 2-gram 인메모리 BM25 엔진",
            "LangGraph 의도-도구 2-Tier LLM 라우팅",
            "완전 무상태(Stateless) 고성능 연산"
        ], ACCENT_PURPLE),
        ("TIER 4", "MariaDB", "영속성 데이터베이스", [
            "57개 정규화 테이블 및 불변 공시 캐시",
            "Flyway V52 마이그레이션 SHA-256 검증",
            "utf8mb4 문자셋 및 복합 인덱스 최적화",
            "외부 포트 노출 없이 내부망 전용 바인딩"
        ], ACCENT_GREEN),
    ]

    for i, (kicker, title, sub, bullets, col) in enumerate(tiers):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, col, 1.4)

        tb = slide.shapes.add_textbox(x + Inches(0.2), top_y + Inches(0.25), card_w - Inches(0.4), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(4)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_after = Pt(14)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(11.5)
            p.font.color.rgb = TEXT_SECONDARY
            p.space_after = Pt(6)

    add_footer(slide, 13)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 05:45]
"시스템 아키텍처는 React, Spring Boot, FastAPI, MariaDB로 구성된 엄격한 4-Tier 단방향 구조입니다. React는 오직 Spring Boot만 바라보며, 이 의존성 경계는 ArchUnit 테스트로 매 빌드마다 검증됩니다."
""")

def s14_arch_mcp(prs):
    """14 · 외부 AI 에이전트용 읽기 전용 MCP 서버"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "14 · Architecture 02",
        "외부 AI 생태계 연결: 읽기 전용 MCP (Model Context Protocol) 탑재",
        "외부 AI 에이전트 및 LLM 클라이언트가 DART Insight의 공시 분석을 안전하게 조회합니다.",
        ACCENT_PURPLE, TINT_PURPLE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    mcp_features = [
        ("01", "표준 MCP 오픈 프로토콜", "차세대 AI 에이전트 표준인 Model Context Protocol Python SDK를 활용하여 외부 클라이언트가 직접 도구로 호출할 수 있는 독립 서버 구축", ACCENT_PURPLE),
        ("02", "읽기 전용(Read-Only) 안전 격리", "외부 AI에게는 데이터 수정·삭제 권한이 일절 없는 순수 조회 도구(기업 검색, 보고서 비교 결과, 수치 근거 조회)만 선별 제공 (ADR-0052)", ACCENT_PURPLE),
        ("03", "단방향 보안 게이트 준수", "MCP 서버는 내부 AI 서버나 DB에 직접 접근하지 않고, Spring Boot 공개 API만을 경유하여 권한과 일일 한도를 일관 통제", ACCENT_PURPLE),
    ]

    for i, (num, title, desc, col) in enumerate(mcp_features):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"MCP ADVANTAGE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 14)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 06:10]
"나아가 외부 AI 클라이언트와의 확장을 위해 읽기 전용 MCP 서버를 독립 구축했습니다. 외부 LLM 에이전트가 DART Insight의 공시 분석 데이터를 안전하게 호출할 수 있습니다."
""")

def s15_perf_cache(prs):
    """15 · 접수번호(rcept_no) 기준 영구 캐시 전략"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "15 · Data Performance",
        "공시 데이터 불변성을 활용하여 일일 2만 회 한도를 무력화하다",
        "최초 1회만 OpenDART에서 파싱한 후 로컬 DB에 영구 캐시하여 초저지연 서빙을 달성했습니다.",
        ACCENT_GREEN, TINT_GREEN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    pipeline = [
        ("PHASE 01", "최초 1회 불변 수집", "14자리 고유 접수번호(rcept_no)를 키로 삼아 OpenDART API에서 최초 1회만 XML을 다운로드하고 파싱합니다.", ACCENT_GREEN),
        ("PHASE 02", "로컬 DB 영구 적재", "공시 데이터는 정정되지 않는 한 영구히 불변합니다. MariaDB에 적재된 이후에는 10만 명이 요청해도 외부 호출 0회 즉답을 제공합니다.", ACCENT_GREEN),
        ("PHASE 03", "전 구간 X-Trace-Id", "사용자 브라우저부터 AI 작업 큐까지 고유한 추적 ID를 헤더로 동기화하여 이상 징후 발생 시 1분 이내에 문제 구간을 격리합니다.", ACCENT_GREEN),
    ]

    for i, (kicker, title, desc, col) in enumerate(pipeline):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 15)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 06:35]
"OpenDART는 일일 2만 회 호출 한도가 있습니다. 저희는 공시의 데이터 불변성을 활용해 '접수번호 기준 영구 캐시 전략'을 세웠습니다. 최초 1회만 적재되면 하루 10만 명이 접속해도 외부 API 소모는 0회입니다."
""")

def s16_infra_reliability(prs):
    """16 · 2-VM 물리적 격리 토폴로지 & Flyway 자동 롤백"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "16 · Infrastructure & Safety",
        "프로덕션 수준의 안정성을 보장하는 2-VM 물리적 격리 인프라",
        "웹 서빙과 고부하 AI 연산 노드를 물리적으로 분리하고, 스키마 사전 검증 롤백을 구축했습니다.",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    infra_cols = [
        ("VM 1", "웹 & 코어 백엔드 노드", "Nginx(:80/443) 웹 프록시 + Spring Boot(:8080) + MariaDB 11.4 영속 볼륨 탑재. AI 연산 부하가 폭증해도 메인 웹 서빙 지연 0ms 보장", ACCENT_BLUE),
        ("VM 2", "고부하 AI & 빌드 노드", "FastAPI(:8000) 연산 서버 + Jenkins CI/CD 빌드 파이프라인. VM1 내부 네트워크에서만 AI 포트 접근을 허용하여 외부 위협 완벽 차단", ACCENT_PURPLE),
        ("SAFETY", "무중단 롤백 파이프라인", "Flyway 마이그레이션 SQL SHA-256 사전 대조. 미승인 SQL 감지 시 배포 안전 대기, 헬스체크 실패 시 직전 도커 이미지로 100% 자동 롤백", ACCENT_GREEN),
    ]

    for i, (kicker, title, desc, col) in enumerate(infra_cols):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 16)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 07:00]
"인프라 역시 웹/DB VM과 AI 연산 VM을 물리적으로 분리하여 트래픽 간섭을 차단했습니다. DB 마이그레이션은 SHA-256 해시 검증과 자동 롤백 파이프라인으로 무결성을 확보했습니다."
""")

def s17_ux_terminology(prs):
    """17 · 초보자를 위한 50개 용어 카드 & 3줄 브리핑"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "17 · UX Spotlight 01",
        "어려운 금융 공시 용어를 마우스 호버 한 번에 쉽게 풀이",
        "50개 공시 전문 용어 실시간 툴팁 카드와 한눈에 파악하는 3줄 AI 브리핑을 제공합니다.",
        ACCENT_CYAN, TINT_CYAN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    ux_items = [
        ("01", "50개 공시 용어 호버 카드", "충당부채, 이연법인세, 유동비율 등 어려운 회계 용어에 마우스를 올리면 백과사전식 해설 카드가 즉시 팝업되어 이해를 돕습니다.", ACCENT_CYAN),
        ("02", "3줄 핵심 AI 브리핑", "수백 페이지의 보고서에서 가장 중요한 재무 및 사업 변경 포인트를 3줄의 객관적 팩트 문장으로 정제하여 빠르게 브리핑합니다.", ACCENT_CYAN),
        ("03", "초성 검색 & 시총 100 탐색", "'ㅅㅅㅈㅈ' 초성 검색과 시가총액 상위 100대 기업 및 이번 시즌 변화가 큰 Top 10 기업을 메인에서 원클릭으로 탐색합니다.", ACCENT_CYAN),
    ]

    for i, (num, title, desc, col) in enumerate(ux_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"UX DETAIL {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 17)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 07:25]
"사용자 경험 측면에서는 금융 초보자를 위해 50개 공시 전문 용어 실시간 호버 툴팁과 한눈에 이해되는 3줄 AI 브리핑을 제공하여 문턱을 대폭 낮췄습니다."
""")

def s18_ux_matrix(prs):
    """18 · 전문 분석가를 위한 '약속 vs 실제 이행' 매트릭스"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "18 · UX Spotlight 02",
        "\"작년에 밝힌 시설투자 약속, 올해 실제로 지켰습니까?\"",
        "전년도 사업보고서의 가이던스와 올해 실제 실적을 나란히 대조해 경영진 신뢰도를 측정합니다.",
        ACCENT_PURPLE, TINT_PURPLE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    matrix_items = [
        ("01", "전년도 가이던스 자동 추출", "작년 사업보고서의 '이사의 경영진단' 및 '사업의 내용' 섹션에서 회사가 밝힌 설비투자 계획과 목표치를 자동 추출합니다.", ACCENT_PURPLE),
        ("02", "올해 실제 실적과 1:1 대조", "올해 보고서의 실제 집행 금액 및 신제품 양산 현황과 1:1로 매핑하여 약속의 이행률을 정밀 검증 매트릭스로 제시합니다.", ACCENT_PURPLE),
        ("03", "분석 브리프 즉시 내보내기", "원문 출처가 포함된 비교 결과를 정갈한 A4 인쇄 PDF 및 Markdown 브리프로 즉시 다운로드하여 실무 보고서로 활용할 수 있습니다.", ACCENT_PURPLE),
    ]

    for i, (num, title, desc, col) in enumerate(matrix_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"ANALYST TOOL {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 18)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 07:50]
"반면 전문 분석가를 위해서는 '작년 사업보고서의 시설투자 약속 vs 올해 실제 이행' 대조 매트릭스를 제공하여 경영진의 공언이 실제로 지켜졌는지 즉시 검증할 수 있도록 지원합니다."
""")

def s19_quality_metrics(prs):
    """19 · 품질 무결성: 2,626개 테스트 & 웹 접근성 100%"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "19 · Quality Standards",
        "토이 프로젝트를 넘어선 엔터프라이즈급 품질 검증 기준",
        "2,626개 자동화 테스트 100% 통과 및 axe-core 웹 접근성 0개 위반을 달성했습니다.",
        ACCENT_GREEN, TINT_GREEN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    quality_items = [
        ("2,626개", "자동화 테스트 100% 통과", "Vitest 1,892개, pytest 926개, ArchUnit 아키텍처 규칙 검사를 CI 파이프라인에서 매 PR마다 100% 전수 통과합니다.", ACCENT_BLUE),
        ("0건", "axe-core 웹 접근성 위반", "WCAG 2.1 AA 기준을 100% 준수하여 스크린 리더 음성 지원, 완전 키보드 탐색, 명도 대비 표준을 기계적으로 입증했습니다.", ACCENT_GREEN),
        ("0건", "시크릿 유출 및 보안 사고", "모든 커밋에 대해 gitleaks 보안 스캔을 강제하여 API 인증키 유출을 원천 차단하고 비밀번호 마스킹 보안을 완비했습니다.", ACCENT_AMBER),
    ]

    for i, (metric, title, desc, col) in enumerate(quality_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, col, 1.4)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = metric
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(36)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(14)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 19)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 08:15]
"저희 시스템은 단순한 프로토타입이 아닙니다. 2,626개의 단위·통합·E2E 자동화 테스트를 100% 통과했으며, axe-core 기준 웹 접근성 위반 0건으로 실전 금융 플랫폼의 완성도를 증명했습니다."
""")

def s20_ax_overview(prs):
    """20 · AX 일하는 방식의 혁신: 7단계 라이프사이클 조망"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "20 · AX Way of Working",
        "AI와 사람이 어떻게 협업하여 3주 만에 엔터프라이즈 시스템을 완성했는가?",
        "기획부터 배포·검증까지 AI 에이전트를 내재화한 DART Insight 팀의 7단계 AX 라이프사이클",
        ACCENT_BLUE, TINT_BLUE
    )

    top_y = Inches(2.05)
    step_w = Inches(2.7)
    step_h = Inches(2.15)
    gap_x = Inches(0.31)

    steps_r1 = [
        ("01", "성공 기준 (SC)", "비즈니스 목표 수립", "사람 주도 핵심 지표 정의\n어느 SC에도 기여하지 않는\n불필요한 기능 사전 원천 차단", ACCENT_CYAN, TINT_CYAN),
        ("02", "AI 기획 (FS & AC)", "수용 기준 정밀 도출", "사람 🤝 AI 공동 명세\n상황-행동-결과 형식의\n검증 가능한 AC 100% 도출", ACCENT_BLUE, TINT_BLUE),
        ("03", "아키텍처 (ADR)", "선행 문서화 원칙", "코드 작성 전 66개 ADR,\nAPI 명세, DB ERD 선행 확정\n아키텍처 부채 제로화", ACCENT_PURPLE, TINT_PURPLE),
        ("04", "WBS 작업 분해", "AC 1:1 이슈 분할", "AI 스킬 기반 자동 분해\n모든 AC가 GitHub 이슈의\n완료 기준에 1:1 매핑", ACCENT_AMBER, TINT_AMBER),
    ]

    for i, (num, title, sub, desc, col, tint) in enumerate(steps_r1):
        x = Inches(0.8) + i * (step_w + gap_x)
        add_card(slide, x, top_y, step_w, step_h, CARD_WHITE, col, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.2), top_y + Inches(0.2), step_w - Inches(0.4), step_h - Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"STEP {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(4)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11)
        p2.font.color.rgb = col
        p2.space_after = Pt(8)

        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.name = FONT_BODY
        p3.font.size = Pt(10.5)
        p3.font.color.rgb = TEXT_SECONDARY

    # Row 2 (3 core steps)
    r2_y = top_y + step_h + Inches(0.22)
    r2_w = Inches(3.7)

    steps_r2 = [
        ("05", "자율 페어 코딩 (Core)", "자율 AI 에이전트 협업", "AGENTS.md 규칙 헌장 엄수 · What/How 분리(SLAP) 준수 · 421개 PR Rebase 선형 병합", ACCENT_BLUE, TINT_BLUE),
        ("06", "자동화 품질 게이트", "2,626개 테스트 · 웹 접근성", "GitHub Actions CI 전수 통과 · axe-core 접근성 0개 위반 · gitleaks 보안 차단", ACCENT_GREEN, TINT_GREEN),
        ("07", "수용기준 검증 (Done)", "AC 100% 실측 증빙 대조", "모든 기능 기획서 완료 판정 · 자동 테스트 및 PR 번호 대조 후 노션 승인", ACCENT_AMBER, TINT_AMBER),
    ]

    for i, (num, title, sub, desc, col, tint) in enumerate(steps_r2):
        x = Inches(0.8) + i * (r2_w + Inches(0.31))
        add_card(slide, x, r2_y, r2_w, step_h, tint if i == 0 else CARD_WHITE, col, 1.8 if i == 0 else 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.25), r2_y + Inches(0.2), r2_w - Inches(0.5), step_h - Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"STEP {num} (EXECUTION)" if i == 0 else f"STEP {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(4)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(15)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11.5)
        p2.font.color.rgb = col
        p2.space_after = Pt(8)

        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.name = FONT_BODY
        p3.font.size = Pt(11)
        p3.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 20)
    set_speaker_notes(slide, """[발표 시간: 30초 | 누적: 08:45]
"DART Insight의 진짜 차별점은 'AI를 활용해 일하는 방식을 근본적으로 혁신(AX)'했다는 점입니다. 기획 단계의 스펙 엔지니어링부터 자율 페어 코딩, 자동화 품질 게이트, 수용 기준 전수 검증까지 이어지는 7단계 라이프사이클을 구축했습니다."
""")

def s21_ax_phase1(prs):
    """21 · AX Phase 1: 성공기준(SC) 기반 AI 스펙 엔지니어링"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "21 · AX Phase 01",
        "\"모호한 요구사항은 환각과 재작업의 주원인입니다\"",
        "비즈니스 성공 기준(SC)에서 정밀 기능 기획서(FS-n)와 수용 기준(AC)을 도출했습니다.",
        ACCENT_CYAN, TINT_CYAN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    phase1_items = [
        ("01", "성공 기준 (SC) 수립", "수작업 4시간 소요 및 LLM 환각 해결을 위한 4대 핵심 지표 수립. 어느 성공 기준에도 기여하지 않는 기능은 기획 단계에서 원천 차단했습니다.", ACCENT_CYAN),
        ("02", "AI 스펙 엔지니어링", "AI 기획 스킬 규약을 통해 '상황-행동-결과' 형식의 기계적 검증이 가능한 수용 기준(AC)을 정상·예외 흐름까지 빈틈없이 도출했습니다.", ACCENT_CYAN),
        ("03", "66개 ADR 선행 설계", "코드 한 줄 작성하기 전 API 명세, DB ERD, 66개 아키텍처 결정 기록(ADR)을 먼저 확정하여 팀 내 설계 불일치를 사전에 제로화했습니다.", ACCENT_CYAN),
    ]

    for i, (num, title, desc, col) in enumerate(phase1_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"SPEC PILLAR {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 21)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 09:10]
"1단계는 스펙 엔지니어링입니다. 모호한 요구사항은 환각과 재작업의 주원인입니다. AI 스킬을 통해 검증 가능한 수용 기준을 명세하고, 66개 ADR을 코드보다 먼저 확정했습니다."
""")

def s22_ax_phase2(prs):
    """22 · AX Phase 2: 자율 AI 에이전트 페어 프로그래밍"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "22 · AX Phase 02",
        "AGENTS.md 규칙 헌장 기반의 사람과 AI, AI와 AI의 실시간 자율 협업",
        "자율 AI 에이전트(구현·리뷰)와 사람 개발자가 실시간 동기화로 협업했습니다.",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    phase2_items = [
        ("01", "AGENTS.md 규칙 헌장", "'추측 코딩 절대 금지, 가치판단 배제, 로컬 DB 실측 검증 우선'이라는 명문화된 규칙 헌장을 사람과 AI 도구가 동일하게 준수했습니다.", ACCENT_BLUE),
        ("02", "에이전틱 자율 페어 코딩", "AI 에이전트가 기능을 구현하고 66개 ADR 및 SLAP(What/How 분리) 원칙을 상호 교차 검토하는 페어 프로그래밍을 가동했습니다.", ACCENT_BLUE),
        ("03", "421개 PR 선형 완주", "feature 브랜치 단위 1이슈 1PR 원칙과 충돌 없는 Rebase Merge 전략을 고수하여, 421개 PR을 완벽한 단일 선형 역사로 완성했습니다.", ACCENT_BLUE),
    ]

    for i, (num, title, desc, col) in enumerate(phase2_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, col, 1.4)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"COLLABORATION {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 22)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 09:35]
"2단계는 자율 페어 코딩입니다. AGENTS.md 헌장 아래 자율 AI 에이전트가 사람 개발자와 실시간 협업하며, 421개 PR을 단 하나의 충돌 없이 Rebase Merge 선형 히스토리로 완주했습니다."
""")

def s23_ax_phase3(prs):
    """23 · AX Phase 3: 기계적 품질 게이트 & 수용기준 100% 검증"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "23 · AX Phase 03",
        "\"AI가 만든 코드는 사람이 짠 코드보다 2배 더 엄격히 검증합니다\"",
        "GitHub Actions CI 파이프라인의 기계적 전수 검사와 기획서 수용 기준(AC) 증빙 대조",
        ACCENT_GREEN, TINT_GREEN
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    phase3_items = [
        ("01", "기계적 CI 품질 게이트", "모든 PR은 2,626개 테스트, ArchUnit 아키텍처 규칙, axe-core 접근성, gitleaks 시크릿 검사를 통과해야만 병합을 허용했습니다.", ACCENT_GREEN),
        ("02", "수용 기준 (AC) 전수 검증", "기능 기획서(FS-n)에 적힌 모든 수용 기준(AC)에 대해 자동화 테스트 파일명과 PR 번호, 실측 화면 캡처 증빙을 1:1로 매핑했습니다.", ACCENT_GREEN),
        ("03", "생산성 400% & 재작업 0%", "스펙-구현-게이트-검증의 완결형 워크플로우를 통해 3주 만에 생산성을 400% 향상시키고 결함 재작업률 0%를 실증했습니다.", ACCENT_GREEN),
    ]

    for i, (num, title, desc, col) in enumerate(phase3_items):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_WHITE, BORDER_LIGHT, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"GATE & DONE {num}"
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 23)
    set_speaker_notes(slide, """[발표 시간: 25초 | 누적: 10:00]
"3단계는 기계적 품질 게이트입니다. PR마다 2,626개 테스트와 접근성, 보안을 전수 검증하고 기획서 수용 기준에 테스트 증빙을 100% 매핑하여 결함 재작업률 0%를 달성했습니다."
""")

def s24_finale_qa(prs):
    """24 · 그랜드 피날레 & 질의응답 (Q&A)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "24 · Grand Finale & Q&A",
        "\"AI는 최고의 비서지, 대표가 아닙니다\"",
        "AI는 사람이 가장 정직하고 가치 있는 결정을 내릴 수 있도록 돕는 최고의 파트너입니다.",
        ACCENT_BLUE, TINT_BLUE
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    final_cards = [
        ("CORE VALUE", "수작업 4시간을 단 5초로", "100% 원문 추적성과 0% 수치 환각으로 완성한 대한민국 최고의 전자공시 비교 분석 인텔리전스", ACCENT_BLUE, TINT_BLUE),
        ("AX PROOF", "3주 만에 421개 PR 완주", "기획-구현-게이트-검증의 7단계 AX 라이프사이클로 입증한 생산성 400% 향상과 결함 재작업 0%", ACCENT_GREEN, TINT_GREEN),
        ("Q & A", "심사위원 질의응답", "경청해 주셔서 대단히 감사합니다.\n시스템 아키텍처 및 서비스에 대한 질의응답을 시작하겠습니다.", ACCENT_PURPLE, TINT_PURPLE),
    ]

    for i, (kicker, title, desc, col, tint) in enumerate(final_cards):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, tint if i == 2 else CARD_WHITE, col, 1.8 if i == 2 else 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(12)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(18)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_PRIMARY
        p1.space_after = Pt(14)

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_SECONDARY

    add_footer(slide, 24)
    set_speaker_notes(slide, """[발표 시간: 35초 | 누적: 10:35 ~ 11:00]
[제스처: 청중과 똑바로 눈을 맞추며 확신에 찬 목소리로 종결]

"발표를 마치며 저희의 핵심 철학을 다시 전합니다.
'AI는 최고의 비서지, 대표가 아닙니다. AI는 사람이 가장 정직하고 가치 있는 결정을 내릴 수 있도록 돕는 최고의 파트너입니다.'
AI와 사람이 함께 일하는 방식의 미래를 증명한 DART Insight였습니다. 경청해 주셔서 대단히 감사합니다. 질의응답을 시작하겠습니다."
""")


# -----------------------------------------------------------------------------
# Main Runner
# -----------------------------------------------------------------------------
def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    print("Generating 24 High-Impact Presentation Slides in Bright Theme...")
    s01_title_vision(prs)
    s02_painpoint_manual(prs)
    s03_painpoint_hallucination(prs)
    s04_philosophy_declaration(prs)
    s05_pillar_speed(prs)
    s06_pillar_traceability(prs)
    s07_pillar_context(prs)
    s08_pillar_compliance(prs)
    s09_tech_xml_streaming(prs)
    s10_tech_bm25_search(prs)
    s11_tech_fsm_guard(prs)
    s12_tech_dual_routing(prs)
    s13_arch_4tier(prs)
    s14_arch_mcp(prs)
    s15_perf_cache(prs)
    s16_infra_reliability(prs)
    s17_ux_terminology(prs)
    s18_ux_matrix(prs)
    s19_quality_metrics(prs)
    s20_ax_overview(prs)
    s21_ax_phase1(prs)
    s22_ax_phase2(prs)
    s23_ax_phase3(prs)
    s24_finale_qa(prs)

    output_path = os.path.join(os.path.dirname(__file__), "..", "docs", "DART_Insight_Presentation.pptx")
    prs.save(output_path)
    print(f"✓ Saved 24-slide PowerPoint presentation to: {output_path}")

    # Copy to web easter directory for instant direct download
    web_easter_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "easter", "DART_Insight_Presentation.pptx")
    shutil.copyfile(output_path, web_easter_path)
    print(f"✓ Copied to web easter directory: {web_easter_path}")

if __name__ == "__main__":
    main()
