#!/usr/bin/env python3
"""
DART Insight Presentation PPTX Generator
=========================================
Generates docs/DART_Insight_Presentation.pptx matching the DART Insight
website dark mode enterprise design token system and 16:9 widescreen layout.
Includes embedded speaker notes with detailed timing marks (~10-11 minutes).
"""

import os
import shutil
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# -----------------------------------------------------------------------------
# Color Palette Constants (Matches DART Insight Website Design Tokens)
# -----------------------------------------------------------------------------
BG_DARK = RGBColor(11, 17, 32)        # #0B1120 Midnight Navy Canvas
CARD_BG = RGBColor(19, 30, 54)        # #131E36 Dark Surface Card
CARD_BG_ALT = RGBColor(26, 38, 66)    # #1A2642 Elevated Surface Card
CARD_BORDER = RGBColor(42, 58, 94)    # #2A3A5E Subtle Border
CARD_BORDER_HOT = RGBColor(0, 85, 255) # Primary Shinhan Blue Accent

TEXT_WHITE = RGBColor(255, 255, 255)  # #FFFFFF
TEXT_BODY = RGBColor(226, 232, 240)   # #E2E8F0 Light Slate
TEXT_MUTED = RGBColor(148, 163, 184)  # #94A3B8 Muted Slate

ACCENT_BLUE = RGBColor(0, 85, 255)    # #0055FF Shinhan Blue
ACCENT_CYAN = RGBColor(56, 189, 248)  # #38BDF8 Sky Cyan
ACCENT_GREEN = RGBColor(16, 185, 129) # #10B981 Emerald Mint
ACCENT_GOLD = RGBColor(245, 158, 11)  # #F59E0B Amber Gold
ACCENT_RED = RGBColor(239, 68, 68)    # #EF4444 Crimson Alert
ACCENT_PURPLE = RGBColor(139, 92, 246)# #8B5CF6 Violet

FONT_HEADING = "Pretendard"
FONT_BODY = "Pretendard"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
def set_slide_background(slide, color=BG_DARK):
    """Fills the entire slide with dark background."""
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5)
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = color
    bg.line.fill.background()
    return bg

def add_header(slide, kicker_text, title_text, subtitle_text):
    """Adds a standard website-style slide header."""
    # Kicker Badge
    kicker_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(11.7), Inches(0.35))
    tf_k = kicker_box.text_frame
    tf_k.word_wrap = True
    tf_k.margin_left = tf_k.margin_top = tf_k.margin_right = tf_k.margin_bottom = 0
    p_k = tf_k.paragraphs[0]
    p_k.text = kicker_text.upper()
    p_k.font.name = FONT_HEADING
    p_k.font.size = Pt(11)
    p_k.font.bold = True
    p_k.font.color.rgb = ACCENT_CYAN

    # Main Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.7), Inches(0.65))
    tf_t = title_box.text_frame
    tf_t.word_wrap = True
    tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
    p_t = tf_t.paragraphs[0]
    p_t.text = title_text
    p_t.font.name = FONT_HEADING
    p_t.font.size = Pt(23)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_WHITE

    # Subtitle
    if subtitle_text:
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.48), Inches(11.7), Inches(0.4))
        tf_s = sub_box.text_frame
        tf_s.word_wrap = True
        tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
        p_s = tf_s.paragraphs[0]
        p_s.text = subtitle_text
        p_s.font.name = FONT_BODY
        p_s.font.size = Pt(13)
        p_s.font.color.rgb = TEXT_MUTED

def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER, border_width=1):
    """Draws a rounded card container matching the website cards."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(border_width)
    else:
        shape.line.fill.background()
    return shape

def add_footer(slide, current_slide, total_slides=10):
    """Adds a standard presentation footer."""
    foot_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.733), Inches(0.3))
    tf = foot_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = f"DART Insight · 신한DS 금융 AI 프로젝트 쇼케이스                    기준: 421+ PRs · 2,626+ Tests · 66 ADRs                    {current_slide:02d} / {total_slides:02d}"
    p.font.name = FONT_BODY
    p.font.size = Pt(9.5)
    p.font.color.rgb = RGBColor(90, 105, 130)

def set_speaker_notes(slide, notes_text):
    """Embeds the verbatim speech notes into the PowerPoint slide."""
    notes_slide = slide.notes_slide
    text_frame = notes_slide.notes_text_frame
    text_frame.text = notes_text.strip()


# -----------------------------------------------------------------------------
# Slide Builder Functions
# -----------------------------------------------------------------------------

def build_slide_01(prs):
    """Slide 01: Project Vision & Mission (Why DART Insight?)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "01 · Project Vision & Mission",
        "수작업 4시간 걸리던 DART 공시 대조를 단 5초 만에, 100% 원문 근거와 환각 0%로 완벽히 해결하다",
        "대한민국 기업 전자공시 정기보고서 비교 분석 및 인과관계 추적 엔터프라이즈 AI 플랫폼"
    )

    # 4 Hero Metric Cards
    metrics = [
        ("5초", "초고속 대조 속도", "300페이지 보고서 2개를 5초 만에 파싱하고 재무·본문 변경점을 즉시 추출", ACCENT_CYAN),
        ("100%", "원문 추적 신뢰도", "화면의 모든 수치와 문장에 DART 접수번호 및 블록 ID를 1:1 직결 보존", ACCENT_GREEN),
        ("0%", "수치 환각 원천 차단", "숫자 연산은 100% 백엔드 코드가 검증 계산하며 LLM에게 계산을 일절 맡기지 않음", ACCENT_GOLD),
        ("2,626개", "엔지니어링 무결성", "단위·통합·E2E 자동화 테스트 100% 통과 및 WCAG 2.1 AA 웹 접근성 완전 충족", ACCENT_BLUE),
    ]

    card_w = Inches(2.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    for i, (val, title, desc, color) in enumerate(metrics):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.2), top_y + Inches(0.3), card_w - Inches(0.4), card_h - Inches(0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Number
        p1 = tf.paragraphs[0]
        p1.text = val
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(36)
        p1.font.bold = True
        p1.font.color.rgb = color
        p1.space_after = Pt(14)

        # Title
        p2 = tf.add_paragraph()
        p2.text = title
        p2.font.name = FONT_HEADING
        p2.font.size = Pt(16)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_after = Pt(12)

        # Description
        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.name = FONT_BODY
        p3.font.size = Pt(12.5)
        p3.font.color.rgb = TEXT_BODY

    add_footer(slide, 1)

    set_speaker_notes(slide, """[발표 시간: 1분 00초 | 누적: 01:00]
[제스처: 가슴을 펴고 청중을 응시하며 단호하고 확신에 찬 목소리로 시작]

"안녕하십니까. 신한DS 금융 AI 프로젝트, DART Insight 발표를 맡은 [발표자 이름]입니다.

여러분, 대한민국 기업들이 금융감독원에 제출하는 사업보고서, 다들 한 번쯤 열어보셨을 겁니다. 한 권에 적게는 30만 자, 많게는 65만 자에 달하는 방대한 문서입니다. 

투자자나 금융 실무자가 기업의 진짜 변화를 알려면 전년도 보고서와 올해 보고서 두 개를 나란히 띄워놓고 수백 페이지를 스크롤하며 주석 하나하나를 Ctrl+F로 대조해야 했습니다. 숙련된 전문가도 꼬박 3~4시간이 걸리는 지독한 수작업 노동이었습니다.

저희 DART Insight는 이 4시간의 고통을 단 5초 만에 끝냅니다. 

단순히 속도만 빠른 것이 아닙니다. 화면에 보이는 모든 숫자와 설명에 100% DART 원문 블록 ID를 연결하고, AI의 고질적인 수치 환각을 0%로 원천 차단했습니다. 

단언컨대, DART Insight는 금융 시장에서 가장 신뢰할 수 있는 전자공시 비교 분석 인텔리전스입니다."
""")


def build_slide_02(prs):
    """Slide 02: Background & Problem (Why DART Insight?)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "02 · Background & Pain Points",
        "\"AI는 최고의 비서지, 대표가 아닙니다\" — 금융 시장의 엄중한 현실",
        "기존 생성형 AI의 치명적 수치 환각(Hallucination)과 공시 데이터의 침묵을 엔지니어링으로 해결"
    )

    card_w = Inches(5.72)
    card_h = Inches(4.7)
    top_y = Inches(2.05)

    # Left: Traditional / LLM Pitfalls
    add_card(slide, Inches(0.8), top_y, card_w, card_h, CARD_BG, ACCENT_RED, 1.2)
    tb_l = slide.shapes.add_textbox(Inches(1.1), top_y + Inches(0.3), card_w - Inches(0.6), card_h - Inches(0.6))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = tf_l.margin_top = tf_l.margin_right = tf_l.margin_bottom = 0

    p_lh = tf_l.paragraphs[0]
    p_lh.text = "❌ 기존 수작업 대조 & 상용 LLM의 한계"
    p_lh.font.name = FONT_HEADING
    p_lh.font.size = Pt(17)
    p_lh.font.bold = True
    p_lh.font.color.rgb = ACCENT_RED
    p_lh.space_after = Pt(14)

    items_l = [
        ("지독한 수작업 노동", "300페이지 보고서 2개를 모니터에 나란히 띄우고 4시간 동안 수동 대조"),
        ("치명적 수치 환각", "LLM에게 계산을 맡기면 영업이익 +15%를 +25%로 날조하는 사고 발생"),
        ("출처와 맥락 단절", "숫자가 왜 바뀌었는지 경영진단(MD&A)과 수시공시를 사람이 일일이 찾아야 함"),
        ("금융 규제 위반 위험", "LLM이 임의로 '대박 호재, 매수 추천' 등 가치판단을 내려 자본시장법 위반 소지"),
        ("거대한 XML 용량", "50MB에 달하는 원문 전체를 LLM 컨텍스트 창에 직접 넣을 수 없음 (비용/토큰 한계)")
    ]
    for tag, desc in items_l:
        p = tf_l.add_paragraph()
        p.text = f"• [{tag}] {desc}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_BODY
        p.space_after = Pt(8)

    # Right: DART Insight Engineering Approach
    add_card(slide, Inches(6.8), top_y, card_w, card_h, CARD_BG, ACCENT_GREEN, 1.2)
    tb_r = slide.shapes.add_textbox(Inches(7.1), top_y + Inches(0.3), card_w - Inches(0.6), card_h - Inches(0.6))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0

    p_rh = tf_r.paragraphs[0]
    p_rh.text = "✅ DART Insight의 철저한 엔지니어링 접근"
    p_rh.font.name = FONT_HEADING
    p_rh.font.size = Pt(17)
    p_rh.font.bold = True
    p_rh.font.color.rgb = ACCENT_GREEN
    p_rh.space_after = Pt(14)

    items_r = [
        ("단 5초 자동 대조", "StAX 스트리밍 파싱과 차분 엔진으로 5초 만에 핵심 증감 자동 추출"),
        ("수치 계산 100% 코드", "증감액·증감률은 순수 백엔드 코드가 계산, LLM은 확정된 수치 팩트만 서술"),
        ("100% 원문 블록 ID", "모든 문장에 고유 출처 태그를 강제하여 클릭 시 DART 원문 해당 문단 즉시 점프"),
        ("가치판단 자동 검사", "화면 송출 전 매수/매도 권유 표현 정규식 필터링으로 자본시장법 100% 준수"),
        ("인메모리 BM25 엔진", "고비용 벡터 DB 대신 금융 2-gram BM25 + 40자 필터로 45ms 내 정밀 근거 적중")
    ]
    for tag, desc in items_r:
        p = tf_r.add_paragraph()
        p.text = f"• [{tag}] {desc}"
        p.font.name = FONT_BODY
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_BODY
        p.space_after = Pt(8)

    add_footer(slide, 2)

    set_speaker_notes(slide, """[발표 시간: 1분 00초 | 누적: 02:00]
[제스처: 기존 LLM의 한계를 지적할 때 단호한 손짓, '금융에서의 숫자'를 강조]

"왜 지금까지 이런 서비스가 없었을까요? 많은 분들이 'ChatGPT나 Claude에게 보고서 파일 던져주고 요약해달라고 하면 되는 것 아니냐?'고 묻습니다. 

하지만 금융 도메인을 깊이 파보신 분들은 압니다. 기존 LLM은 숫자를 계산하는 순간 치명적인 환각을 일으킵니다. 
영업이익이 15% 증가했는데 25%라고 천연덕스럽게 거짓말을 하거나, 3년 전 수치를 올해 수치로 둔갑시킵니다. 

문학이나 코딩에서는 95%의 정확도가 훌륭할지 몰라도, 단 1원의 오차로 수억 원의 손실이 발생하는 금융 시장에서는 1%의 환각도 치명적인 독이 됩니다.
또한 정기보고서는 PDF나 HWP가 압축된 수십 메가바이트짜리 거대한 XML 문서입니다. 일반적인 LLM 토큰 창에 한 번에 다 들어가지도 않습니다.

그래서 저희 팀은 프로젝트 시작 첫날, 하나의 대원칙을 세웠습니다.  
'AI에게 절대 계산을 맡기지 않는다. AI는 최고의 비서지, 대표가 아니다.'  
계산은 100% 코드가 수행하고, AI는 정제된 원문 팩트를 사용자에게 직관적으로 전달하는 역할만 수행하게 설계했습니다."
""")


def build_slide_03(prs):
    """Slide 03: 4 Core Value Propositions"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "03 · Core Value Proposition",
        "신뢰 · 속도 · 맥락 · 규제 준수 — 금융 시장이 요구하는 엄격한 4대 핵심 가치",
        "DART Insight가 금융 실무자와 투자자에게 제공하는 차별화된 가치 제안"
    )

    card_w = Inches(2.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    pillars = [
        ("PILLAR 01", "⚡ 초고속성 (Speed)", "수작업 4시간 소요 보고서 대조를 5초로 압축", [
            "두 개 보고서의 재무제표 5종과 수천 문단을 즉시 파싱 및 대조",
            "비교 가능성 사전 검증(결산월·통화·단위·정정 여부 자동 판별)",
            "접수번호 기준 영구 캐시로 동일 비교 요청 시 수 밀리초 즉답"
        ], ACCENT_CYAN),
        ("PILLAR 02", "🎯 100% 원문 추적 (Traceability)", "모든 숫자와 문장의 출처가 클릭 한 번에 직결", [
            "고유 블록 ID({접수번호}#B{문단번호}) 기반 1:1 위치 보존",
            "출처가 없거나 확인되지 않은 문장은 화면 송출 원천 차단",
            "원문 뷰어 연동으로 해당 섹션 및 문단으로 부드러운 스크롤 싱크"
        ], ACCENT_GREEN),
        ("PILLAR 03", "🔗 다차원 맥락 연결 (Contextuality)", "재무제표 숫자와 본문 경영진단, 1년 공시 결합", [
            "재무 수치 증감과 이사의 경영진단(MD&A) 설명 문단 인과 연결",
            "1년 치 주요 수시공시 타임라인 연계로 기업 사건 다차원 조망",
            "\"전년도 약속(가이던스) vs 금년도 실제 이행\" 대조 매트릭스 제공"
        ], ACCENT_PURPLE),
        ("PILLAR 04", "🛡️ 규제 준수 객관성 (Compliance)", "자본시장법 기준 철저 준수 및 가치판단 배제", [
            "'사라, 팔아라' 같은 주관적 매수/매도 권유 표현 자동 필터링",
            "AI 생성 표시, 모델명, 프롬프트 버전, 호출 시각 100% 투명 표기",
            "미확인 설명은 '검토 필요'로 안전하게 격리하여 규제 리스크 방어"
        ], ACCENT_GOLD),
    ]

    for i, (kicker, title, sub, bullets, color) in enumerate(pillars):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.2), top_y + Inches(0.25), card_w - Inches(0.4), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Kicker
        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(6)

        # Title
        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(15.5)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(8)

        # Sub
        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = ACCENT_CYAN
        p2.space_after = Pt(14)

        # Bullets
        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(11.5)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(6)

    add_footer(slide, 3)

    set_speaker_notes(slide, """[발표 시간: 50초 | 누적: 02:50]
[제스처: 손가락으로 1, 2, 3, 4를 짚어가며 리듬감 있게 전달]

"이 철학을 바탕으로 DART Insight가 완성한 4대 핵심 가치를 말씀드리겠습니다.

첫째, 초고속성(Speed)입니다.  
두 개 보고서의 재무제표 5종과 경영진단 본문 수천 문단을 파싱하고 대조하여 핵심 증감 포인트를 추출하는 데 걸리는 시간, 단 5초입니다.

둘째, 100% 원문 추적성(Traceability)입니다.  
저희 화면에 노출되는 모든 수치와 모든 요약 문장은 고유한 '원문 블록 ID'를 갖습니다. 클릭 한 번이면 DART 공시 뷰어의 해당 문단으로 즉시 이동하여 전후 맥락을 육안으로 검증할 수 있습니다. 출처 없는 설명은 단 한 줄도 화면에 내보내지 않습니다.

셋째, 다차원 맥락 연결(Contextuality)입니다.  
재무제표의 차가운 숫자만 보지 않습니다. 숫자가 왜 바뀌었는지를 '이사의 경영진단(MD&A)' 문단과 연결하고, 지난 1년간 발생한 주요 수시공시 타임라인과 결합하여 기업의 입체적인 스토리를 보여줍니다.

넷째, 규제 준수와 객관성(Compliance)입니다.  
저희 서비스는 '사라, 팔아라' 같은 주관적인 매수/매도 권유나 목표주가 예측을 철저히 배제합니다. 자본시장법과 금융 가이드라인을 엄격히 준수하여 규제 리스크 없는 투명한 팩트만을 제공합니다."
""")


def build_slide_04(prs):
    """Slide 04: Engineering Breakthroughs (5 Challenges Solved)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "04 · Engineering Breakthroughs",
        "타협 없이 돌파한 5대 엔지니어링 난제 — 이론이 아닌 코드로 증명된 신뢰",
        "대용량 XML 스트리밍부터 인메모리 BM25, FSM 전이표, 2-Tier 비용 최적화까지"
    )

    card_w = Inches(11.733)
    card_h = Inches(0.85)
    gap = Inches(0.12)
    start_y = Inches(2.05)

    challenges = [
        ("01. 대용량 50MB XML 파싱", "기존 DOM 파서 사용 시 메모리 폭발 (O(N))", "StAX XML 스트리밍 파서 도입으로 O(1) 메모리 (80MB 이하 엄격 통제)", "메모리 80MB 이하 통제", ACCENT_CYAN),
        ("02. 근거 문단 고속 검색", "고비용 벡터 DB 사용 시 느린 속도와 계정명 환각", "한국어 2-gram 인메모리 BM25 엔진 + 40자 이상 길이 필터 적용", "단 45ms 검색 완료", ACCENT_GREEN),
        ("03. 수치 환각 0% 방어", "LLM에게 계산을 맡기면 숫자를 지어내는 치명적 사고", "증감액·증감률은 순수 Java 코드가 계산, LLM은 원문 ID 정규식 가드레일", "수치 환각 0% 달성", ACCENT_GOLD),
        ("04. 비동기 작업 무결성", "분산 환경에서 분석 작업 상태 꼬임 및 유실", "PENDING → RUNNING → COMPLETED/FAILED 단방향 FSM 상태 전이표 강제", "비정상 상태 전이 0건", ACCENT_PURPLE),
        ("05. LLM API 비용 폭증", "단일 고성능 모델 전면 호출 시 막대한 토큰 비용", "의도 파악(Haiku) + 심층 요약(Sonnet) 2-Tier 듀얼 라우팅 & 프롬프트 캐싱", "API 비용 95% 절감", ACCENT_RED),
    ]

    for i, (title, problem, solution, metric, color) in enumerate(challenges):
        y = start_y + i * (card_h + gap)
        add_card(slide, Inches(0.8), y, card_w, card_h, CARD_BG, CARD_BORDER, 1)

        # Title & Badge
        tb = slide.shapes.add_textbox(Inches(1.0), y + Inches(0.12), Inches(3.2), card_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(13.5)
        p1.font.bold = True
        p1.font.color.rgb = color
        p2 = tf.add_paragraph()
        p2.text = f"기존: {problem}"
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11)
        p2.font.color.rgb = TEXT_MUTED

        # Solution
        tb_s = slide.shapes.add_textbox(Inches(4.4), y + Inches(0.15), Inches(5.8), card_h - Inches(0.3))
        tf_s = tb_s.text_frame
        tf_s.word_wrap = True
        tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
        ps = tf_s.paragraphs[0]
        ps.text = f"해결: {solution}"
        ps.font.name = FONT_BODY
        ps.font.size = Pt(12)
        ps.font.color.rgb = TEXT_BODY

        # Metric Badge
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.35), y + Inches(0.22), Inches(1.95), Inches(0.42))
        badge.fill.solid()
        badge.fill.fore_color.rgb = CARD_BG_ALT
        badge.line.color.rgb = color
        badge.line.width = Pt(1)
        tb_m = slide.shapes.add_textbox(Inches(10.35), y + Inches(0.24), Inches(1.95), Inches(0.38))
        tf_m = tb_m.text_frame
        tf_m.margin_left = tf_m.margin_top = tf_m.margin_right = tf_m.margin_bottom = 0
        pm = tf_m.paragraphs[0]
        pm.alignment = PP_ALIGN.CENTER
        pm.text = f"✓ {metric}"
        pm.font.name = FONT_HEADING
        pm.font.size = Pt(11)
        pm.font.bold = True
        pm.font.color.rgb = color

    add_footer(slide, 4)

    set_speaker_notes(slide, """[발표 시간: 1분 10초 | 누적: 04:00]
[제스처: 기술 디테일을 차분하고 날카롭게 설명, 엔지니어링 신뢰도 구축]

"그렇다면 이 가치들을 어떻게 기술적으로 현실화했을까요? 저희는 5대 엔지니어링 난제를 정면 돌파했습니다.

첫째, 50MB에 달하는 대용량 공시 XML 파싱 문제입니다. DOM 파서를 쓰면 메모리가 폭발합니다. 저희는 StAX 기반 스트리밍 파서로 메모리 사용량을 O(1) 수준인 80MB 이하로 묶어두었습니다.

둘째, 근거 문단 검색의 비용과 속도 문제입니다. 고비용 벡터 DB와 임베딩 대신, 한국어 금융 특화 2-gram 인메모리 BM25 검색 엔진을 직접 구축했습니다. 40자 이상 경영진단 문단만을 정밀 타겟팅하여 단 45ms 만에 가장 완벽한 근거 후보를 찾아냅니다.

셋째, 환각 방지 가드레일입니다. 숫자는 LLM에게 단 1원도 맡기지 않고 백엔드 Java 코드가 100% 계산합니다. LLM이 생성한 텍스트는 원문 ID 존재 여부와 가치판단 금지 표현 정규식 필터를 거치며, 검증 실패 시 최대 2회 자동 재생성 후 '검토 필요'로 안전하게 격리합니다.

넷째, 분석 작업의 상태 무결성입니다. PENDING → RUNNING → COMPLETED/FAILED의 단방향 FSM 상태 전이표를 엄격히 적용하여 분산 환경에서도 작업 꼬임을 0건으로 통제했습니다.

다섯째, LLM 비용 최적화입니다. 단일 고성능 모델에 의존하지 않고, 가벼운 모델로 의도와 도구를 판별하고 무거운 모델로 심층 요약하는 '2-Tier 듀얼 라우팅'을 구축하여 API 비용을 무려 95% 절감했습니다."
""")


def build_slide_05(prs):
    """Slide 05: User Experience & Real Impact"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "05 · User Experience & Impact",
        "초보 투자자부터 전문 애널리스트까지 — 모두를 만족시키는 사용자 경험",
        "2,626개 테스트 무결성, 웹 접근성 100% 준수, 사용자 페르소나별 정밀 맞춤 기능"
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    columns = [
        ("FOR BEGINNERS", "🌱 초보 투자자", "어려운 공시 용어를 쉽게, 3줄로 핵심 파악", [
            "50개 금융 전문 용어 실시간 마우스 호버 툴팁 카드",
            "복잡한 재무제표를 한눈에 읽어주는 3줄 핵심 AI 브리핑",
            "초성 검색(예: 'ㅅㅅㅈㅈ') 및 시총 상위 100 원클릭 탐색",
            "가치판단 없는 객관적 공시 길잡이로 안전한 투자 학습"
        ], ACCENT_CYAN),
        ("FOR ANALYSTS", "📊 전문 분석가", "수작업 대조 노동 해방, 심층 인과 추적", [
            "\"전년도 약속(가이던스) vs 금년도 실제 이행\" 대조 매트릭스",
            "이사의 경영진단(MD&A)과 수시공시 타임라인 인과 연계",
            "100% 원문 블록 ID 직결로 즉각적인 팩트 교차 검증",
            "분석 브리프 Markdown 및 정갈한 A4 인쇄 PDF 즉시 내보내기"
        ], ACCENT_GREEN),
        ("ENTERPRISE STANDARD", "🛡️ 품질 & 접근성", "엔터프라이즈 레벨의 안정성과 포용성", [
            "2,626개 자동화 테스트 100% 통과 (Vitest + pytest + ArchUnit)",
            "axe-core 기반 웹 접근성 0개 위반 (WCAG 2.1 AA 100% 준수)",
            "시선 피로를 줄이는 완벽한 다크모드 및 키보드 완전 탐색 지원",
            "gitleaks 시크릿 유출 자동 차단 및 비밀번호 마스킹 보안"
        ], ACCENT_GOLD),
    ]

    for i, (kicker, title, sub, bullets, color) in enumerate(columns):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.25), top_y + Inches(0.25), card_w - Inches(0.5), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(6)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(8)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12.5)
        p2.font.color.rgb = ACCENT_CYAN
        p2.space_after = Pt(16)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(12)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(8)

    add_footer(slide, 5)

    set_speaker_notes(slide, """[발표 시간: 50초 | 누적: 04:50]
[제스처: 따뜻하면서도 포용력 있는 어조로 확장성 강조]

"이 견고한 기술 위에서 초보자부터 전문가까지 모두가 임팩트를 누립니다.

금융 초보 투자자에게는 생소한 50개 공시 전문 용어를 마우스 호버 즉시 팝업으로 설명해 주는 '실시간 용어 카드'와 한눈에 이해되는 '3줄 AI 브리핑'을 제공합니다. 

반면 전문 애널리스트에게는 '작년 사업보고서에서 약속했던 시설투자 가이던스가 올해 실제로 이행되었는가?'를 즉시 대조해 주는 '약속 vs 이행 매트릭스'를 제공합니다.

저희 플랫폼은 단순한 토이 프로젝트가 아닙니다. 2,626개의 단위·통합·E2E 자동화 테스트를 100% 통과했으며, 키보드 완전 탐색과 스크린 리더, WCAG 명도 대비를 충족하는 웹 접근성 100%를 준수하여 누구에게나 열린 공시 환경을 완성했습니다."
""")


def build_slide_06(prs):
    """Slide 06: System Architecture & 4-Tier Separation"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "06 · System Architecture & Tech Stack",
        "엄격한 4-Tier 단방향 계층 분리와 외부 AI용 읽기 전용 MCP 서버 확장",
        "React → Spring Boot → FastAPI → MariaDB 의존성 경계를 ArchUnit 테스트로 100% 강제"
    )

    card_w = Inches(2.7)
    card_h = Inches(3.6)
    gap = Inches(0.31)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    tiers = [
        ("TIER 1 · FRONTEND", "React 19", "TypeScript · Tailwind", [
            "단방향: 오직 Spring Boot 공개 API만 호출",
            "FastAPI / OpenDART 직접 호출 절대 금지",
            "접근성(axe-core 0개 위반) 및 다크모드",
            "useReducer + 커스텀 훅 상태 머신"
        ], ACCENT_CYAN),
        ("TIER 2 · CORE API", "Spring Boot 4.1", "Java 21 · Security", [
            "OpenDART 수집 및 불변 데이터 캐시 관리",
            "비동기 분석 작업 큐 & FSM 상태 전이",
            "증감액·증감률 100% 수학적 코드 계산",
            "X-Trace-Id 분산 추적 헤더 전파"
        ], ACCENT_BLUE),
        ("TIER 3 · AI ENGINE", "FastAPI", "Python 3.12 · LangGraph", [
            "StAX XML 스트리밍 파싱 (메모리 O(1))",
            "한국어 2-gram 인메모리 BM25 엔진",
            "LangGraph 의도-도구 2-Tier LLM 라우팅",
            "완전 무상태(Stateless) 고성능 연산"
        ], ACCENT_PURPLE),
        ("TIER 4 · STORAGE", "MariaDB 11.4", "Flyway Migration", [
            "57개 정규화 테이블 및 불변 공시 캐시",
            "JPA ddl-auto=validate로 엄격 관리",
            "V52 마이그레이션 SHA-256 사전 검증",
            "utf8mb4 풀 텍스트 및 분산 인덱스"
        ], ACCENT_GREEN),
    ]

    for i, (kicker, title, sub, bullets, color) in enumerate(tiers):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.18), top_y + Inches(0.2), card_w - Inches(0.36), card_h - Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(10.5)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(4)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11.5)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_after = Pt(12)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(5)

    # Bottom Callout Card: MCP Server & ArchUnit
    bot_y = Inches(5.82)
    bot_h = Inches(1.0)
    add_card(slide, Inches(0.8), bot_y, Inches(11.733), bot_h, CARD_BG_ALT, CARD_BORDER_HOT, 1.2)

    tb_bot = slide.shapes.add_textbox(Inches(1.05), bot_y + Inches(0.15), Inches(11.2), Inches(0.7))
    tf_bot = tb_bot.text_frame
    tf_bot.word_wrap = True
    tf_bot.margin_left = tf_bot.margin_top = tf_bot.margin_right = tf_bot.margin_bottom = 0

    p_b1 = tf_bot.paragraphs[0]
    p_b1.text = "🔌 외부 AI 생태계 연결: 읽기 전용 MCP (Model Context Protocol) 서버 탑재 (ADR-0052)"
    p_b1.font.name = FONT_HEADING
    p_b1.font.size = Pt(13)
    p_b1.font.bold = True
    p_b1.font.color.rgb = ACCENT_CYAN
    p_b1.space_after = Pt(3)

    p_b2 = tf_bot.add_paragraph()
    p_b2.text = "Claude Desktop 등 외부 AI 클라이언트가 DART Insight의 공시 분석 및 원문 데이터를 직접 조회할 수 있는 읽기 전용 표준 인터페이스 제공 · ArchUnit 테스트로 계층 역참조 100% 원천 차단"
    p_b2.font.name = FONT_BODY
    p_b2.font.size = Pt(11.5)
    p_b2.font.color.rgb = TEXT_BODY

    add_footer(slide, 6)

    set_speaker_notes(slide, """[발표 시간: 55초 | 누적: 05:45]
[제스처: 스택의 분리 원칙과 정합성 강조]

"시스템의 뼈대가 되는 기술 스택입니다. 

화면단은 React 19와 TypeScript, 비즈니스 로직과 API 캐시는 Spring Boot 4.1, 고성능 문서 파싱 및 AI 파이프라인은 FastAPI Python 3.12, 영속 계층은 MariaDB 11.4로 구성된 4-Tier 구조입니다.

특히 저희는 레이어 간 경계를 극단적으로 통제합니다. 
React는 오직 Spring Boot의 공개 API만 바라보며, FastAPI나 외부 OpenDART를 절대 직접 부르지 않습니다. 
이 의존성 규칙은 ArchUnit 아키텍처 테스트 코드로 CI 파이프라인에서 매 빌드마다 강제됩니다.

더불어 최근 급부상한 외부 AI 에이전트(Claude Desktop 등)와의 연결을 위해 읽기 전용 MCP(Model Context Protocol) 서버를 독립 구축하여 우리 플랫폼의 공시 분석 데이터를 외부 에이전트에게 안전하게 공급합니다."
""")


def build_slide_07(prs):
    """Slide 07: Data Pipeline & Permanent Cache Strategy"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "07 · Data Pipeline & Performance",
        "일일 2만 회 한도를 무력화한 접수번호 기준 영구 캐시 전략 (Permanent Cache)",
        "공시 데이터의 불변성(Immutability)을 활용하여 하루 10만 명이 접속해도 외부 API 소모 0회"
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    steps = [
        ("PHASE 01 · 원문 인입", "불변 데이터 수집", "최초 1회만 OpenDART API 호출", [
            "기업별 고유 14자리 접수번호(rcept_no) 기준 불변성 확보",
            "동일한 보고서 원문은 내용이 영구히 바뀌지 않는 팩트",
            "OpenDART 일일 20,000회 쿼터 한도로부터 완벽한 자립",
            "StAX 스트리밍 파싱을 거쳐 섹션·표·문단 단위로 분해 저장"
        ], ACCENT_CYAN),
        ("PHASE 02 · 영구 캐시", "로컬 DB 즉시 서빙", "MariaDB 영속 볼륨 불변 캐시 적재", [
            "두 번째 사용자부터는 외부 API 호출 0회, 로컬 DB 즉시 반환",
            "국내 상장사 전체 분기보고서를 캐시해도 수만 건 수준 유지",
            "신규 공시 발생 당일에만 최소한의 폴링 API 호출 발생",
            "수백 페이지 보고서 비교 요청을 수 밀리초 내 캐시 서빙"
        ], ACCENT_GREEN),
        ("PHASE 03 · 무상태 연산", "Stateless AI 파이프라인", "DB 직접 접근 없는 무상태 AI 격리", [
            "AI 서버(FastAPI)는 DB 접근 권한이 없는 순수 연산 모듈",
            "Spring Boot 비동기 작업 큐로 동시 요청 부하 완벽 분산",
            "요청마다 X-Trace-Id 고유 발급으로 전 구간 로그 추적",
            "장애 발생 시 1분 이내에 문제 구간 및 사유 코드 규명"
        ], ACCENT_PURPLE),
    ]

    for i, (kicker, title, sub, bullets, color) in enumerate(steps):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.25), top_y + Inches(0.25), card_w - Inches(0.5), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(6)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(6)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = ACCENT_CYAN
        p2.space_after = Pt(14)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(12)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(8)

    add_footer(slide, 7)

    set_speaker_notes(slide, """[발표 시간: 55초 | 누적: 06:40]
[제스처: 트래픽의 흐름을 손으로 좌에서 우로 가리키며 설명]

"시스템 내부의 데이터 흐름입니다. 

외부 OpenDART API는 하루 2만 회라는 호출 제한이 있습니다. 저희는 '접수번호(rcept_no) 기준 영구 캐시 전략'을 적용했습니다. 

금융감독원에 한 번 공시된 정기보고서 원문은 내용이 영구히 바뀌지 않는 불변(Immutable) 데이터입니다. 따라서 최초 1회만 파싱하여 DB에 캐시하면, 이후 동일한 비교 요청은 외부 API 호출 0회, 응답 속도 수 밀리초로 즉각 서빙됩니다.

또한 AI 서버는 데이터베이스에 직접 접근하지 않는 완전한 무상태(Stateless) 연산 모듈로 격리했습니다. 
모든 요청에는 고유한 X-Trace-Id가 발급되어 프론트엔드부터 백엔드, AI 서버 작업 큐까지 전 구간 로그가 추적되므로 장애 발생 시 1분 안에 원인 규명이 가능합니다."
""")


def build_slide_08(prs):
    """Slide 08: 66 ADRs and Interactive Simulators"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "08 · Architecture Decisions (66 ADRs)",
        "문서 속에 박제된 글자가 아닌, 코드로 살아 숨 쉬는 66개 아키텍처 결정 기록",
        "웹사이트에서 직접 조작하며 설계 원리를 실시간 검증할 수 있는 핵심 메커니즘"
    )

    card_w = Inches(5.72)
    card_h = Inches(2.25)
    gap_x = Inches(0.28)
    gap_y = Inches(0.18)
    start_x = Inches(0.8)
    start_y = Inches(2.05)

    mechanisms = [
        ("ADR-0042 · FSM 상태 전이 차단기", "작업 상태 무결성 보장", [
            "PENDING → RUNNING → COMPLETED/FAILED 단방향 전이표 강제",
            "비정상 전이(RUNNING → PENDING 등) 시도 시 즉시 '400 에러' 차단",
            "분산 환경 및 서버 재시작 중에도 작업 유실 및 오염 원천 방어"
        ], ACCENT_CYAN, 0, 0),
        ("ADR-0008 · 사실 추출 정규식 가드레일", "가치판단 및 투자권유 원천 차단", [
            "'대박 호재', '적극 매수' 등 불법 자문성 키워드 즉시 적발",
            "원문 블록 ID가 누락된 허위 문장은 화면 송출 자동 격리",
            "미확인 금융 용어 발생 시 'AI 일반 설명·공시 근거 아님' 배지 부착"
        ], ACCENT_GREEN, 1, 0),
        ("ADR-0036 · BM25 가중치 최적화", "출처 노이즈 제거 및 고품질 근거 추출", [
            "출처 한 줄(20자 미만) 단문이 1위로 올라오는 BM25 특성 극복",
            "40자 이상 경영진단 본문 문단만 필터링하여 1위 후보 정확도 100%",
            "단 45ms 안에 매출액·영업이익 증감 원인 설명 문단 적중"
        ], ACCENT_GOLD, 0, 1),
        ("ADR-0045 · LangGraph 2-Tier 라우팅", "비용 95% 절감 및 실시간 도구 실행", [
            "경량 모델(Tool Selection)과 고성능 모델(Synthesis)의 역할 분담",
            "Spring Boot 내부에서 도구를 안전하게 실행(ADR-0044)",
            "프롬프트 캐싱 적용으로 보고서 1건당 실질 비용 수십 원 달성"
        ], ACCENT_PURPLE, 1, 1),
    ]

    for title, sub, bullets, color, col, row in mechanisms:
        x = start_x + col * (card_w + gap_x)
        y = start_y + row * (card_h + gap_y)
        add_card(slide, x, y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.25), y + Inches(0.18), card_w - Inches(0.5), card_h - Inches(0.36))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = title
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(13)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(2)

        p1 = tf.add_paragraph()
        p1.text = sub
        p1.font.name = FONT_BODY
        p1.font.size = Pt(11)
        p1.font.color.rgb = TEXT_MUTED
        p1.space_after = Pt(6)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(3)

    add_footer(slide, 8)

    set_speaker_notes(slide, """[발표 시간: 1분 05초 | 누적: 07:45]
[제스처: 마우스를 움직여 실제 버튼을 클릭하고 실시간 반응을 직접 보여줌]

"DART Insight는 총 66개의 아키텍처 결정 기록(ADR)을 작성하며 만들어졌습니다. 
지금 화면에서 보시는 것은 저희가 설계한 핵심 원리를 직접 검증해 볼 수 있는 인터랙티브 시뮬레이터입니다.

예를 들어 첫 번째 시뮬레이터에서 허용되지 않은 상태 전이인 RUNNING → PENDING을 시도하면, 즉시 '400 거부' 에러를 뿜으며 데이터 오염을 차단합니다. 

두 번째 가드레일 시뮬레이터에 '이 종목은 대박 호재이므로 적극 매수를 추천합니다'라는 문장을 넣고 검증을 누르면, 시스템이 즉각 '매수 추천, 대박 호재'라는 불법 가치판단 키워드를 적발하여 차단합니다.

저희의 설계는 문서 속에 박제된 글자가 아니라, 지금 이 순간에도 코드로 살아서 작동하는 엄격한 규칙들입니다."
""")


def build_slide_09(prs):
    """Slide 09: Enterprise Infrastructure & Production Reliability"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "09 · Enterprise Infrastructure",
        "2-VM 물리적 격리 토폴로지와 무중단 롤백 파이프라인 (Production Reliability)",
        "부하 간섭 제로, DB 스키마 사전 해시 대조, LLM 일일 비용 쿼터 하드 캡 구축"
    )

    card_w = Inches(3.75)
    card_h = Inches(4.7)
    gap = Inches(0.24)
    start_x = Inches(0.8)
    top_y = Inches(2.05)

    infra_cols = [
        ("VM 1 · WEB & CORE", "🌐 웹 서빙 & 코어 API", "사용자 트래픽의 안정적 서빙 보장", [
            "Nginx 웹 프록시 (:80 / :443 HTTPS 암호화)",
            "Spring Boot 백엔드 (:8080 코어 비즈니스 로직)",
            "MariaDB 11.4 (:3306 영속 볼륨 공시 캐시 적재)",
            "AI 연산 부하가 폭증해도 메인 웹 서빙 지연 0ms 보장"
        ], ACCENT_CYAN),
        ("VM 2 · AI & CI/CD", "⚡ 고부하 AI & 빌드 노드", "무거운 연산 작업을 물리적 노드로 분리", [
            "FastAPI AI 서버 (:8000 원문 파싱 및 LLM 큐)",
            "Jenkins CI/CD 빌드 파이프라인 (5분 주기 감지)",
            "VM1 내부 네트워크에서만 AI 포트 접근 허용(보안)",
            "CPU/GPU 점유율 급증 시에도 메인 서비스와 완전 격리"
        ], ACCENT_PURPLE),
        ("PRODUCTION GUARD", "🛡️ 무중단 롤백 파이프라인", "운영 장애 및 비용 폭증 원천 차단", [
            "Flyway 마이그레이션 SQL 목록 SHA-256 사전 대조",
            "미승인 신규 SQL 감지 시 배포 자동 대기 안전 격리",
            "배포 직후 헬스체크 실패 시 직전 이미지로 100% 자동 롤백",
            "일일 100달러 LLM 비용 쿼터 하드 캡으로 요금 폭탄 방지"
        ], ACCENT_GREEN),
    ]

    for i, (kicker, title, sub, bullets, color) in enumerate(infra_cols):
        x = start_x + i * (card_w + gap)
        add_card(slide, x, top_y, card_w, card_h, CARD_BG, CARD_BORDER, 1.2)

        tb = slide.shapes.add_textbox(x + Inches(0.25), top_y + Inches(0.25), card_w - Inches(0.5), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(6)

        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(6)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = ACCENT_CYAN
        p2.space_after = Pt(14)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = f"• {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(12)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(8)

    add_footer(slide, 9)

    set_speaker_notes(slide, """[발표 시간: 50초 | 누적: 08:35]
[제스처: 안정성과 비용 통제력을 차분한 어조로 강조]

"운영 안전성 역시 프로덕션 레벨로 준비했습니다.

웹 서비스와 DB가 동작하는 VM과 고부하 AI 연산이 일어나는 VM을 물리적으로 분리하여, AI 작업이 폭증해도 메인 웹 서빙에는 단 1ms의 지연도 발생하지 않습니다.

DB 스키마는 Flyway 마이그레이션 적용 전 SHA-256 체크섬을 사전 검증하고, 스크립트 실패 시 직전 안정 버전으로 자동 롤백하는 무결성 파이프라인을 구축했습니다.

또한 팀 차원에서 일일 100달러라는 LLM 비용 하드 쿼터를 걸어두어, 이상 트래픽 발생 시에도 비용 급증(Bill Shock)을 원천 차단했습니다."
""")


def build_slide_10(prs):
    """Slide 10: AX Way of Working & Grand Finale"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide)
    add_header(
        slide,
        "10 · AX Way of Working & Finale",
        "AI와 사람이 어떻게 협업하여 3주 만에 엔터프라이즈 시스템을 완성했는가?",
        "기획부터 배포·검증까지 AI 에이전트를 내재화한 DART Insight 팀의 7단계 AX 라이프사이클"
    )

    top_y = Inches(2.05)

    # 7-Step Pipeline Boxes (Row 1: 4 steps, Row 2: 3 steps)
    step_w = Inches(2.7)
    step_h = Inches(1.35)
    gap_x = Inches(0.31)

    steps_r1 = [
        ("01. 성공 기준 (SC)", "비즈니스 목표 수립", "사람 주도 페인포인트 정의", ACCENT_CYAN),
        ("02. AI 기획 (FS & AC)", "수용 기준 정밀 도출", "사람 🤝 AI 기획서 자동화", ACCENT_BLUE),
        ("03. 아키텍처 (ADR)", "선행 문서화 원칙", "66개 ADR · API/DB 선행", ACCENT_PURPLE),
        ("04. WBS 작업 분해", "AC 1:1 이슈 분할", "AI 스킬 기반 원자 분해", ACCENT_GOLD),
    ]

    for i, (num_title, sub1, sub2, color) in enumerate(steps_r1):
        x = Inches(0.8) + i * (step_w + gap_x)
        add_card(slide, x, top_y, step_w, step_h, CARD_BG, CARD_BORDER, 1)

        tb = slide.shapes.add_textbox(x + Inches(0.15), top_y + Inches(0.12), step_w - Inches(0.3), step_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = num_title
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(13)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(2)

        p1 = tf.add_paragraph()
        p1.text = sub1
        p1.font.name = FONT_BODY
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub2
        p2.font.name = FONT_BODY
        p2.font.size = Pt(10)
        p2.font.color.rgb = TEXT_MUTED

    # Row 2 (3 core steps)
    r2_y = top_y + step_h + Inches(0.18)
    r2_w = Inches(3.7)

    steps_r2 = [
        ("05. 자율 페어 코딩 (Core)", "Claude Code 🤝 Antigravity", "AGENTS.md 규칙 헌장 엄수 · Rebase 선형 병합", ACCENT_BLUE),
        ("06. 자동화 품질 게이트", "2,626개 테스트 · 웹 접근성", "GitHub Actions CI 전수 통과 · gitleaks 보안 차단", ACCENT_GREEN),
        ("07. 수용기준 검증 (Done)", "AC 100% 실측 증빙 대조", "모든 기능 기획서 완료 판정 · 무결성 승인", ACCENT_GOLD),
    ]

    for i, (num_title, sub1, sub2, color) in enumerate(steps_r2):
        x = Inches(0.8) + i * (r2_w + Inches(0.31))
        # Highlight node 5
        border_col = CARD_BORDER_HOT if i == 0 else CARD_BORDER
        add_card(slide, x, r2_y, r2_w, step_h, CARD_BG_ALT if i == 0 else CARD_BG, border_col, 1.5 if i == 0 else 1)

        tb = slide.shapes.add_textbox(x + Inches(0.2), r2_y + Inches(0.12), r2_w - Inches(0.4), step_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = num_title
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(13.5)
        p0.font.bold = True
        p0.font.color.rgb = color
        p0.space_after = Pt(2)

        p1 = tf.add_paragraph()
        p1.text = sub1
        p1.font.name = FONT_BODY
        p1.font.size = Pt(11.5)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sub2
        p2.font.name = FONT_BODY
        p2.font.size = Pt(10.5)
        p2.font.color.rgb = TEXT_MUTED

    # Bottom Callout Box: Finale & Core Philosophy Quote
    quote_y = Inches(5.15)
    quote_h = Inches(1.68)
    add_card(slide, Inches(0.8), quote_y, Inches(11.733), quote_h, CARD_BG_ALT, CARD_BORDER_HOT, 1.5)

    tb_q = slide.shapes.add_textbox(Inches(1.1), quote_y + Inches(0.18), Inches(11.1), quote_h - Inches(0.36))
    tf_q = tb_q.text_frame
    tf_q.word_wrap = True
    tf_q.margin_left = tf_q.margin_top = tf_q.margin_right = tf_q.margin_bottom = 0

    pq1 = tf_q.paragraphs[0]
    pq1.text = "🏆 3주간의 정량적 실증 결과: 421개 PR 선형 완주 · 생산성 400% 향상 · 결함 재작업률 0%"
    pq1.font.name = FONT_HEADING
    pq1.font.size = Pt(13.5)
    pq1.font.bold = True
    pq1.font.color.rgb = ACCENT_GREEN
    pq1.space_after = Pt(6)

    pq2 = tf_q.add_paragraph()
    pq2.text = "\"AI는 최고의 비서지, 대표가 아닙니다.\nAI는 사람이 가장 정직하고 가치 있는 결정을 내릴 수 있도록 돕는 최고의 파트너입니다.\""
    pq2.font.name = FONT_HEADING
    pq2.font.size = Pt(15.5)
    pq2.font.bold = True
    pq2.font.color.rgb = TEXT_WHITE

    add_footer(slide, 10)

    set_speaker_notes(slide, """[발표 시간: 1분 25초 | 누적: 10:00]
[제스처: 7단계 파이프라인 카드를 차례로 짚은 뒤, 마지막 문장은 청중과 똑바로 눈을 맞추며 확신에 찬 목소리로 종결]

"마지막으로, DART Insight 프로젝트의 진짜 차별점인 'AI를 활용해 일하는 방식의 혁신(AX)'입니다.

저희는 단순히 'AI 기능이 들어간 제품'을 만든 것이 아닙니다. 
기획부터 설계, 구현, 검증에 이르는 전 개발 과정을 AI 에이전트와 한 팀으로 일하는 '진짜 AX 워크플로우'로 구축했습니다.

첫째, 모호한 요구사항을 없애기 위해 비즈니스 성공 기준(SC)에서 수용 기준(AC)과 WBS 이슈를 30분 만에 자동 도출하는 AI 스펙 엔지니어링을 도입했습니다.
둘째, AGENTS.md 헌장을 통해 사람과 AI 모두가 단방향 계층 분리와 66개 ADR 아키텍처 규칙을 엄격히 지키는 자율 페어 프로그래밍을 실천했습니다.
셋째, PR마다 2,626개 테스트와 웹 접근성 100%, 보안 시크릿 유출을 기계적으로 자동 차단하는 품질 게이트를 완비했습니다.

그 결과, 3주라는 짧은 시간 동안 생산성을 400% 향상시켰고, 421개의 PR과 1,034개의 커밋을 단 하나의 충돌이나 결함 재작업 없이 완벽한 선형 역사로 완성해 냈습니다.

발표를 마치며 저희의 핵심 철학을 다시 전합니다.

'AI는 최고의 비서지, 대표가 아닙니다.  
AI는 사람이 가장 정직하고 가치 있는 결정을 내릴 수 있도록 돕는 최고의 파트너입니다.'

AI와 사람이 함께 일하는 방식의 미래를 증명한 DART Insight였습니다.  
경청해 주셔서 대단히 감사합니다."
""")


# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------
def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    print("Generating DART Insight 16:9 Presentation Slides...")
    build_slide_01(prs)
    build_slide_02(prs)
    build_slide_03(prs)
    build_slide_04(prs)
    build_slide_05(prs)
    build_slide_06(prs)
    build_slide_07(prs)
    build_slide_08(prs)
    build_slide_09(prs)
    build_slide_10(prs)

    output_path = os.path.join(os.path.dirname(__file__), "..", "docs", "DART_Insight_Presentation.pptx")
    prs.save(output_path)
    print(f"✓ Saved PowerPoint presentation to: {output_path}")

    # Also copy to frontend/public/easter for web direct download
    web_easter_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "easter", "DART_Insight_Presentation.pptx")
    shutil.copyfile(output_path, web_easter_path)
    print(f"✓ Copied to web easter directory: {web_easter_path}")

if __name__ == "__main__":
    main()
