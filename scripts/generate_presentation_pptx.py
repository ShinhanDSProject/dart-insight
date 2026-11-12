#!/usr/bin/env python3
"""
DART Insight High-Impact 4-Zone Presentation PPTX Generator (Slide Walkthrough)
===================================================================================
Generates docs/DART_Insight_Presentation.pptx directly expressing
frontend/public/easter/three-weeks.html with sequential slides for every button click!

Features:
1. High-Fidelity 16:9 Widescreen Slides (13.333" x 7.5").
2. 4-Zone Visual Layout:
   - Zone A: Top Kicker Pill + One-Liner Headline (<25자).
   - Zone B: 1-Second Term Translator Callout (🔍 용어 = 1줄 비유).
   - Zone C: Visual Diagram Canvas mirroring three-weeks.html widgets.
             Interactive buttons are drawn in a segmented bar with the active button
             visibly highlighted and its resulting UI state / callout displayed!
   - Zone D: Bottom Proof Bar (ADR Badges + Key Metrics + Slide Counter NN / total, renumbered before save).
3. Design System Tokens (tokens.css / design-system.md):
   - Light: Canvas #F6F7FA, Card #FFFFFF, Primary #141936, Purple #6159B5,
            Positive #187653, Attention #8A5300, Danger #B74250, Neutral #E4E6EB
   - Dark: Canvas #0C0F1D, Card #151A2E, Raised #1D2340, Purple #C4BFFF, Text #ECEEFB
4. Horang (허성범) Style 4-Step Speaker Notes for all slides.
"""

import os
import re
import shutil
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# -----------------------------------------------------------------------------
# Design System Color Tokens (Strict tokens.css Alignment)
# -----------------------------------------------------------------------------
LIGHT_CANVAS = RGBColor(246, 247, 250)     # #F6F7FA --color-bg-subtle
LIGHT_CARD = RGBColor(255, 255, 255)       # #FFFFFF --color-bg
LIGHT_BORDER = RGBColor(228, 230, 235)     # #E4E6EB --color-border
LIGHT_BORDER_STR = RGBColor(142, 143, 153) # #8E8F99 --color-border-strong

LIGHT_TEXT_PRIMARY = RGBColor(20, 25, 54)  # #141936 --color-primary
LIGHT_TEXT_BODY = RGBColor(36, 38, 48)     # #242630 --color-text
LIGHT_TEXT_MUTED = RGBColor(102, 102, 110) # #66666E --color-text-muted

LIGHT_PURPLE = RGBColor(97, 89, 181)       # #6159B5 --color-accent
LIGHT_PURPLE_TINT = RGBColor(240, 239, 250)# #F0EFFA --color-accent-subtle
LIGHT_PURPLE_BORDER = RGBColor(214, 211, 232) # #D6D3E8 --color-border-accent

LIGHT_POSITIVE = RGBColor(24, 118, 83)     # #187653 --color-increase / --color-positive
LIGHT_POSITIVE_TINT = RGBColor(236, 248, 241) # #ECF8F1 --color-increase-subtle

LIGHT_ATTENTION = RGBColor(138, 83, 0)     # #8A5300 --color-attention
LIGHT_ATTENTION_TINT = RGBColor(255, 245, 224) # #FFF5E0 --color-attention-subtle

LIGHT_DANGER = RGBColor(183, 66, 80)       # #B74250 --color-decrease / --color-danger
LIGHT_DANGER_TINT = RGBColor(255, 240, 242)# #FFF0F2 --color-decrease-subtle

# Dark Palette (Architecture & AX Highlight Slides)
DARK_CANVAS = RGBColor(12, 15, 29)         # #0C0F1D Dark Backdrop
DARK_CARD = RGBColor(21, 26, 46)           # #151A2E Dark Surface 1
DARK_CARD_RAISED = RGBColor(29, 35, 64)    # #1D2340 Dark Surface 2
DARK_BORDER = RGBColor(42, 50, 80)         # Subtle Dark Border

DARK_TEXT_PRIMARY = RGBColor(236, 238, 251)# #ECEEFB Dark High Contrast
DARK_TEXT_BODY = RGBColor(200, 205, 230)   # Readable Body
DARK_TEXT_MUTED = RGBColor(140, 145, 170)  # Muted Dark

DARK_PURPLE = RGBColor(196, 191, 255)      # #C4BFFF Dark Accent Primary
DARK_PURPLE_TINT = RGBColor(38, 43, 78)    # Deep Violet Container

FONT_HEADING = "Pretendard"
FONT_BODY = "Pretendard"
FONT_NUM = "Pretendard"

TOTAL_SLIDES = 40

# -----------------------------------------------------------------------------
# Base 4-Zone Helpers
# -----------------------------------------------------------------------------
def set_slide_background(slide, is_dark=False):
    """Sets slide canvas background color."""
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_CANVAS if is_dark else LIGHT_CANVAS
    bg.line.fill.background()
    return bg

def add_zone_a_header(slide, kicker_text, oneliner_title, is_dark=False, kicker_color=None, kicker_tint=None):
    """Zone A: Top Kicker Pill + One-Liner Headline (<25자)."""
    k_col = kicker_color or (DARK_PURPLE if is_dark else LIGHT_PURPLE)
    k_tint = kicker_tint or (DARK_PURPLE_TINT if is_dark else LIGHT_PURPLE_TINT)
    t_col = DARK_TEXT_PRIMARY if is_dark else LIGHT_TEXT_PRIMARY

    # Kicker Pill Badge
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.4), Inches(3.2), Inches(0.32))
    pill.fill.solid()
    pill.fill.fore_color.rgb = k_tint
    pill.line.color.rgb = k_col
    pill.line.width = Pt(1)

    tb_k = slide.shapes.add_textbox(Inches(0.8), Inches(0.42), Inches(3.2), Inches(0.28))
    tf_k = tb_k.text_frame
    tf_k.margin_left = tf_k.margin_top = tf_k.margin_right = tf_k.margin_bottom = 0
    p_k = tf_k.paragraphs[0]
    p_k.alignment = PP_ALIGN.CENTER
    p_k.text = kicker_text.upper()
    p_k.font.name = FONT_HEADING
    p_k.font.size = Pt(10.5)
    p_k.font.bold = True
    p_k.font.color.rgb = k_col

    # One-Liner Headline
    tb_t = slide.shapes.add_textbox(Inches(0.8), Inches(0.78), Inches(7.6), Inches(0.62))
    tf_t = tb_t.text_frame
    tf_t.word_wrap = True
    tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
    p_t = tf_t.paragraphs[0]
    p_t.text = oneliner_title
    p_t.font.name = FONT_HEADING
    p_t.font.size = Pt(20)
    p_t.font.bold = True
    p_t.font.color.rgb = t_col

def add_zone_b_glossary(slide, term, metaphor, is_dark=False):
    """Zone B: 1-Second Term Translator Callout Box (우측 상단 고정)."""
    card_bg = DARK_CARD_RAISED if is_dark else LIGHT_PURPLE_TINT
    border_col = DARK_PURPLE if is_dark else LIGHT_PURPLE_BORDER
    title_col = DARK_PURPLE if is_dark else LIGHT_PURPLE
    body_col = DARK_TEXT_PRIMARY if is_dark else LIGHT_TEXT_BODY

    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.55), Inches(0.4), Inches(3.98), Inches(0.96))
    box.fill.solid()
    box.fill.fore_color.rgb = card_bg
    box.line.color.rgb = border_col
    box.line.width = Pt(1.2)

    tb = slide.shapes.add_textbox(Inches(8.75), Inches(0.48), Inches(3.6), Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

    p1 = tf.paragraphs[0]
    p1.text = f"🔍 용어 · {term}"
    p1.font.name = FONT_HEADING
    p1.font.size = Pt(11)
    p1.font.bold = True
    p1.font.color.rgb = title_col
    p1.space_after = Pt(4)

    p2 = tf.add_paragraph()
    p2.text = metaphor
    p2.font.name = FONT_BODY
    p2.font.size = Pt(11.5)
    p2.font.bold = True
    p2.font.color.rgb = body_col

def add_zone_d_proof_bar(slide, current_slide, total_slides, adr_list=None, metrics_list=None, is_dark=False):
    """Zone D: Bottom Proof Bar with Key Metrics and Slide Counter (ADR tags removed per UX refinement)."""
    line_col = DARK_BORDER if is_dark else LIGHT_BORDER
    txt_muted = DARK_TEXT_MUTED if is_dark else LIGHT_TEXT_MUTED

    # Divider Line
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.8), Inches(11.733), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = line_col
    line.line.fill.background()

    # Left: Quantitative Metrics (Full width across bottom bar)
    if metrics_list:
        metrics_str = "    •    ".join(metrics_list)
        tb_m = slide.shapes.add_textbox(Inches(0.8), Inches(6.92), Inches(9.5), Inches(0.26))
        tf_m = tb_m.text_frame
        tf_m.margin_left = tf_m.margin_top = tf_m.margin_right = tf_m.margin_bottom = 0
        p_m = tf_m.paragraphs[0]
        p_m.alignment = PP_ALIGN.LEFT
        p_m.text = f"실측 핵심 지표: {metrics_str}"
        p_m.font.name = FONT_BODY
        p_m.font.size = Pt(10.5)
        p_m.font.bold = True
        p_m.font.color.rgb = txt_muted

    # Right: Slide Counter
    tb_c = slide.shapes.add_textbox(Inches(10.5), Inches(6.92), Inches(2.033), Inches(0.26))
    tf_c = tb_c.text_frame
    tf_c.margin_left = tf_c.margin_top = tf_c.margin_right = tf_c.margin_bottom = 0
    p_c = tf_c.paragraphs[0]
    p_c.alignment = PP_ALIGN.RIGHT
    p_c.text = f"{current_slide:02d} / {total_slides:02d}"
    p_c.font.name = FONT_NUM
    p_c.font.size = Pt(10.5)
    p_c.font.bold = True
    p_c.font.color.rgb = txt_muted

def renumber_slide_counters(prs):
    """Rewrites every 'NN / NN' counter from the real slide order, so removed slides never leave gaps."""
    total = len(prs.slides)
    for idx, slide in enumerate(prs.slides, start=1):
        for shape in slide.shapes:
            if shape.has_text_frame and re.fullmatch(r"\d{2} / \d{2}", shape.text_frame.text.strip()):
                shape.text_frame.paragraphs[0].runs[0].text = f"{idx:02d} / {total:02d}"

def set_speaker_notes(slide, notes_text):
    """Sets slide speaker notes."""
    notes_slide = slide.notes_slide
    notes_slide.notes_text_frame.text = notes_text.strip()

# -----------------------------------------------------------------------------
# Common UI Widget Renderers (Segmented Buttons, Arrows, Cards)
# -----------------------------------------------------------------------------
def draw_segmented_bar(slide, x, y, total_w, h, items, active_index, is_dark=False):
    """Draws a segmented button bar mirroring three-weeks.html .seg buttons."""
    n = len(items)
    btn_w = (total_w - Inches(0.08) * (n - 1)) / n
    for i, label in enumerate(items):
        is_active = (i == active_index)
        bx = x + (btn_w + Inches(0.08)) * i
        btn = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bx, y, btn_w, h)
        btn.fill.solid()
        if is_active:
            btn.fill.fore_color.rgb = DARK_PURPLE if is_dark else LIGHT_PURPLE
            btn.line.color.rgb = DARK_PURPLE if is_dark else LIGHT_PURPLE
        else:
            btn.fill.fore_color.rgb = DARK_CARD if is_dark else LIGHT_CARD
            btn.line.color.rgb = DARK_BORDER if is_dark else LIGHT_BORDER
        btn.line.width = Pt(1.5 if is_active else 1)

        tb = slide.shapes.add_textbox(bx, y + Inches(0.05), btn_w, h - Inches(0.1))
        tf = tb.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        prefix = "👉 " if is_active else ""
        p.text = f"{prefix}{label}"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11 if n <= 4 else 10)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255) if is_active else (DARK_TEXT_MUTED if is_dark else LIGHT_TEXT_BODY)

def draw_card(slide, x, y, w, h, bg_col=LIGHT_CARD, border_col=LIGHT_BORDER, line_w=1):
    """Draws a rounded rectangular card."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_col
    card.line.color.rgb = border_col
    card.line.width = Pt(line_w)
    return card

def draw_horizontal_arrow(slide, x, y, w, h, text="", fill_color=LIGHT_PURPLE):
    """Draws a prominent right arrow shape."""
    arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x, y, w, h)
    arrow.fill.solid()
    arrow.fill.fore_color.rgb = fill_color
    arrow.line.fill.background()
    if text:
        tf = arrow.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.text = text
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
    return arrow

# -----------------------------------------------------------------------------
# Slide Generation Routines
# -----------------------------------------------------------------------------

def build_presentation():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    print("Generating High-Impact 4-Zone Presentation Slides...")

    # =========================================================================
    # PART 1. 타이틀 & 비전 (Hero)
    # =========================================================================
    # SLIDE 01: 히어로 비전 & 4대 메트릭
    s01 = prs.slides.add_slide(blank_layout)
    set_slide_background(s01, is_dark=False)
    add_zone_a_header(s01, "01 · 프로젝트 비전 & 핵심 성과", "두 보고서 사이, 바뀐 것만. 원문 근거와 함께.")
    add_zone_b_glossary(s01, "공시(DART)", "회사가 법에 따라 공식으로 알리는 문서. 회사의 생활기록부")
    
    # Zone C: Hero 4-Bento Grid
    bento_data = [
        ("461", "병합한 PR", "약 4주 동안(2026-10-19~)\n닫은 이슈 429개 · 커밋 1,101개", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("67", "설계 기록(ADR)", "구조 결정마다\n이유와 검토한 대안을 기록", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("약 90", "공개 API", "화면과 MCP 서버가\n함께 쓰는 백엔드 API", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("약 4,400", "자동 테스트", "화면 1,910 · AI 1,188 · 백엔드 약 1,300\nPR마다 모두 통과해야 병합", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
    ]
    coords = [
        (Inches(0.8), Inches(1.65)),
        (Inches(6.88), Inches(1.65)),
        (Inches(0.8), Inches(4.15)),
        (Inches(6.88), Inches(4.15)),
    ]
    for (num, title, desc, col, tint), (x, y) in zip(bento_data, coords):
        draw_card(s01, x, y, Inches(5.65), Inches(2.35), tint, col, 1.5)
        tb = s01.shapes.add_textbox(x + Inches(0.4), y + Inches(0.2), Inches(4.85), Inches(1.95))
        tf = tb.text_frame
        p0 = tf.paragraphs[0]
        p0.text = num
        p0.font.name = FONT_NUM
        p0.font.size = Pt(36)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(2)
        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = LIGHT_TEXT_PRIMARY
        p1.space_after = Pt(4)
        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11)
        p2.font.color.rgb = LIGHT_TEXT_MUTED
    add_zone_d_proof_bar(s01, 1, TOTAL_SLIDES, ["ADR-0004", "ADR-0008"], ["PR 461", "ADR 67", "테스트 약 4,400"])
    set_speaker_notes(s01, """[여는 질문]
"보고서 두 권을 놓고 '무엇이 바뀌었는지' 찾는 데 얼마나 걸릴까요?"

[쉬운 설명]
"DART Insight는 같은 회사의 정기보고서 두 개를 비교해, 바뀐 숫자와 문장을 원문 위치와 함께 보여 주는 서비스입니다. 투자를 추천하지 않고, 확인을 돕습니다."

[화면 가리키기]
"네 숫자를 가리킵니다. 약 4주 동안 PR 461개, 설계 기록(ADR) 67개, 공개 API 약 90개, 자동 테스트 약 4,400개."

[마무리 한마디]
"왜 만들었는지, 무엇이 다른지, 어떻게 만들었는지 순서로 보여 드리겠습니다."
""")

    # =========================================================================
    # PART 1-B. 도메인 통역: 클라이언트를 위한 1초 공시 용어 사전
    # =========================================================================
    # SLIDE 03: 전자공시란 무엇인가? 엔비디아 젠슨 황 사임 공시 & DART 팩트 쇼케이스
    s02 = prs.slides.add_slide(blank_layout)
    set_slide_background(s02, is_dark=False)
    add_zone_a_header(s02, "00 · 도메인 통역 가이드", "전자공시(DART)란? 기업의 공식 종합 생활기록부")
    add_zone_b_glossary(s02, "전자공시(DART)", "기업이 법에 따라 실적과 사건을 금융감독원에 투명하게 공개하는 공식 생활기록부")

    # Zone C: 2열 대칭 쇼케이스 (좌: 엔비디아 젠슨 황 사임 SEC Form 8-K vs 우: 대한민국 DART 100% 팩트)
    jensen_avatar_path = os.path.join(project_root, "frontend", "public", "easter", "jensen-huang-avatar.png")
    nvidia_logo_path = os.path.join(project_root, "frontend", "public", "easter", "nvidia-logo.png")
    dart_img_path = os.path.join(project_root, "frontend", "public", "easter", "dart-cover.png")

    # [좌측 카드]: 글로벌 실전 공시 사례 (엔비디아 젠슨 황 사임 Form 8-K)
    draw_card(s02, Inches(0.8), Inches(1.65), Inches(5.65), Inches(3.6), LIGHT_CARD, LIGHT_BORDER, 1.5)
    
    # 상단 뱃지
    tb_badge = s02.shapes.add_textbox(Inches(1.0), Inches(1.72), Inches(5.25), Inches(0.35))
    tf_badge = tb_badge.text_frame; tf_badge.word_wrap = True
    tf_badge.margin_left = tf_badge.margin_top = tf_badge.margin_right = tf_badge.margin_bottom = 0
    p_b = tf_badge.paragraphs[0]; p_b.text = "🔥 글로벌 실전 사례 · 2026.11.12 공식 접수 (SEC Form 8-K)"
    p_b.font.name = FONT_HEADING; p_b.font.size = Pt(10.5); p_b.font.bold = True; p_b.font.color.rgb = RGBColor(21, 128, 61)

    # 젠슨 황 아바타 & 엔비디아 로고 헤더
    if os.path.exists(jensen_avatar_path):
        s02.shapes.add_picture(jensen_avatar_path, Inches(1.0), Inches(2.08), Inches(0.8), Inches(0.8))
    if os.path.exists(nvidia_logo_path):
        s02.shapes.add_picture(nvidia_logo_path, Inches(1.95), Inches(2.1), Inches(1.3), Inches(0.25))

    tb_nv_title = s02.shapes.add_textbox(Inches(1.95), Inches(2.38), Inches(4.3), Inches(0.55))
    tf_nv = tb_nv_title.text_frame; tf_nv.word_wrap = True
    tf_nv.margin_left = tf_nv.margin_top = tf_nv.margin_right = tf_nv.margin_bottom = 0
    p_nv1 = tf_nv.paragraphs[0]; p_nv1.text = "젠슨 황 CEO 사임 수시공시 (Item 5.02)"
    p_nv1.font.name = FONT_HEADING; p_nv1.font.size = Pt(13); p_nv1.font.bold = True; p_nv1.font.color.rgb = LIGHT_TEXT_PRIMARY

    # 공시 원문 발췌 다크 박스
    draw_card(s02, Inches(1.0), Inches(2.95), Inches(5.25), Inches(1.15), RGBColor(15, 23, 42), RGBColor(118, 185, 0), 1.0)
    tb_sec = s02.shapes.add_textbox(Inches(1.15), Inches(3.02), Inches(4.95), Inches(1.0))
    tf_sec = tb_sec.text_frame; tf_sec.word_wrap = True
    tf_sec.margin_left = tf_sec.margin_top = tf_sec.margin_right = tf_sec.margin_bottom = 0
    p_s1 = tf_sec.paragraphs[0]; p_s1.text = "[SEC Form 8-K | Item 5.02 Departure of CEO / NVIDIA CORP]"
    p_s1.font.name = FONT_BODY; p_s1.font.size = Pt(9.5); p_s1.font.bold = True; p_s1.font.color.rgb = RGBColor(118, 185, 0)
    p_s1.space_after = Pt(2)
    p_s2 = tf_sec.add_paragraph()
    p_s2.text = '"The Board accepted the resignation of Jen-Hsun (Jensen) Huang as President, CEO, and Director, effective immediately." (CFO Colette Kress interim CEO)'
    p_s2.font.name = FONT_BODY; p_s2.font.size = Pt(9); p_s2.font.color.rgb = RGBColor(241, 245, 249)

    # 하단 공시 원문 한글 번역 박스
    tb_sec_pt = s02.shapes.add_textbox(Inches(1.0), Inches(4.18), Inches(5.25), Inches(0.95))
    tf_sec_pt = tb_sec_pt.text_frame; tf_sec_pt.word_wrap = True
    tf_sec_pt.margin_left = tf_sec_pt.margin_top = tf_sec_pt.margin_right = tf_sec_pt.margin_bottom = 0
    p_pt0 = tf_sec_pt.paragraphs[0]
    p_pt0.text = "🇰🇷 공시 원문 한글 번역:"
    p_pt0.font.name = FONT_HEADING; p_pt0.font.size = Pt(9.5); p_pt0.font.bold = True; p_pt0.font.color.rgb = LIGHT_TEXT_PRIMARY
    p_pt0.space_after = Pt(2)
    p_pt1 = tf_sec_pt.add_paragraph()
    p_pt1.text = "• 사임 수락: \"이사회는 젠슨 황의 사장, CEO 및 이사직 사임을 즉시 수락함\""
    p_pt1.font.name = FONT_BODY; p_pt1.font.size = Pt(9); p_pt1.font.color.rgb = LIGHT_TEXT_BODY
    p_pt1.space_after = Pt(2)
    p_pt2 = tf_sec_pt.add_paragraph()
    p_pt2.text = "• 임시 CEO: \"콜레트 크레스 CFO를 임시 최고경영자(Interim CEO)로 임명함\""
    p_pt2.font.name = FONT_BODY; p_pt2.font.size = Pt(9); p_pt2.font.color.rgb = LIGHT_TEXT_BODY
    p_pt2.space_after = Pt(2)
    p_pt3 = tf_sec_pt.add_paragraph()
    p_pt3.text = "✓ 법적 구속력을 지닌 공식 공시 단 1장이 전 세계 시장을 결정"
    p_pt3.font.name = FONT_BODY; p_pt3.font.size = Pt(9); p_pt3.font.bold = True; p_pt3.font.color.rgb = RGBColor(21, 128, 61)

    # [우측 카드]: 대한민국 전자공시 DART (금융감독원 100% 공인 팩트)
    draw_card(s02, Inches(6.8), Inches(1.65), Inches(5.65), Inches(3.6), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 2.0)
    
    # 상단 뱃지
    tb_r_badge = s02.shapes.add_textbox(Inches(7.05), Inches(1.72), Inches(5.15), Inches(0.35))
    tf_r_badge = tb_r_badge.text_frame; tf_r_badge.word_wrap = True
    tf_r_badge.margin_left = tf_r_badge.margin_top = tf_r_badge.margin_right = tf_r_badge.margin_bottom = 0
    p_rb = tf_r_badge.paragraphs[0]; p_rb.text = "🏛️ 대한민국 국가 공인 시스템 · DART 주요사항보고서"
    p_rb.font.name = FONT_HEADING; p_rb.font.size = Pt(10.5); p_rb.font.bold = True; p_rb.font.color.rgb = LIGHT_POSITIVE

    # DART 공식 커버 이미지
    if os.path.exists(dart_img_path):
        draw_card(s02, Inches(7.05), Inches(2.1), Inches(5.15), Inches(1.85), LIGHT_CARD, LIGHT_BORDER, 1.0)
        s02.shapes.add_picture(dart_img_path, Inches(7.15), Inches(2.15), Inches(4.95), Inches(1.75))

    tb_r = s02.shapes.add_textbox(Inches(7.05), Inches(4.05), Inches(5.15), Inches(1.1))
    tf_r = tb_r.text_frame; tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0
    p = tf_r.paragraphs[0]
    p.text = "🏛️ 전자공시 DART (금융감독원)"
    p.font.name = FONT_HEADING; p.font.size = Pt(14); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE
    p.space_after = Pt(2)
    p_sub = tf_r.add_paragraph()
    p_sub.text = "금융감독원이 운영하는 공식 공시 시스템"
    p_sub.font.name = FONT_BODY; p_sub.font.size = Pt(11); p_sub.font.bold = True; p_sub.font.color.rgb = LIGHT_TEXT_PRIMARY
    p_sub.space_after = Pt(4)

    p_r_tag = tf_r.add_paragraph()
    p_r_tag.text = "✓ 우리나라 상장사의 공식 공시가 모두 올라오는 곳"
    p_r_tag.font.name = FONT_BODY; p_r_tag.font.size = Pt(9.5); p_r_tag.font.bold = True; p_r_tag.font.color.rgb = LIGHT_POSITIVE

    # 하단 3대 시스템 원칙 배지 바
    draw_card(s02, Inches(0.8), Inches(5.4), Inches(11.65), Inches(1.15), LIGHT_CARD, LIGHT_PURPLE, 1.2)
    tb_b = s02.shapes.add_textbox(Inches(1.0), Inches(5.5), Inches(11.25), Inches(0.95))
    tf_b = tb_b.text_frame; tf_b.word_wrap = True
    pb = tf_b.paragraphs[0]
    pb.text = "🛡️ DART Insight가 공시를 다루는 3대 철칙"
    pb.font.name = FONT_HEADING; pb.font.size = Pt(11); pb.font.bold = True; pb.font.color.rgb = LIGHT_PURPLE
    pb.space_after = Pt(3)
    pb2 = tf_b.add_paragraph()
    pb2.text = "1️⃣ OpenDART 공식 API로 수집    2️⃣ 요약 문장마다 원문 위치(접수번호·문단) 연결    3️⃣ 증감 수치는 코드가 계산"
    pb2.font.name = FONT_BODY; pb2.font.size = Pt(10.5); pb2.font.bold = True; pb2.font.color.rgb = LIGHT_TEXT_PRIMARY

    add_zone_d_proof_bar(s02, 2, TOTAL_SLIDES, metrics_list=["글로벌 SEC Form 8-K 실전 확정", "금융감독원 DART", "OpenDART API 실시간 직결"])
    set_speaker_notes(s02, """[여는 질문]
"11월 11일, 엔비디아 젠슨 황이 CEO에서 물러났습니다. 이 사실이 처음 '공식'으로 확정된 곳은 어디였을까요?"

[쉬운 설명]
"바로 공시입니다. 회사가 법에 따라 공식적으로 알리는 문서이고, 우리나라에서는 금융감독원 DART에 올라옵니다. 회사의 생활기록부라고 생각하시면 됩니다."

[화면 가리키기]
"왼쪽의 8-K 원문 한 문장과 한글 번역, 오른쪽의 DART를 차례로 가리킵니다."

[마무리 한마디]
"뉴스가 아니라 원문. 그래서 저희는 공시 원문을 출발점으로 삼았습니다."
""")

    # =========================================================================
    # PART 2. 추진 배경 & 사용자 여정 6단계 (Why & Userflow Stepper)
    # =========================================================================
    # SLIDE 03: 추진 배경: 65만 자 공시의 압박과 LLM 환각
    s03 = prs.slides.add_slide(blank_layout)
    set_slide_background(s03, is_dark=False)
    add_zone_a_header(s03, "02 · 추진 배경 및 문제의식", "최대 65만 자의 압박, 그리고 믿기 어려운 AI 요약")
    add_zone_b_glossary(s03, "MD&A", "경영진이 숫자의 원인을 해설해 놓은 공식 성적표 해설서")

    pinocchio_img_path = os.path.join(project_root, "frontend", "public", "easter", "pinocchio-hallucination.jpg")

    # Zone C: 1:1 Split (좌: 65만 자 수작업 대조 vs 우: AI 환각 피노키오)
    # [좌측 카드]: 한계 1 - 65만 자 수작업 대조
    draw_card(s03, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.5)
    tb_l = s03.shapes.add_textbox(Inches(1.1), Inches(1.85), Inches(5.05), Inches(4.4))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True

    p_l0 = tf_l.paragraphs[0]
    p_l0.text = "❌ 한계 ① 너무 길다 (수작업의 고통)"
    p_l0.font.name = FONT_HEADING; p_l0.font.size = Pt(15); p_l0.font.bold = True; p_l0.font.color.rgb = LIGHT_DANGER
    p_l0.space_after = Pt(20)

    p_l1 = tf_l.add_paragraph(); p_l1.alignment = PP_ALIGN.CENTER
    p_l1.text = "📕 📗 📘 📙"
    p_l1.font.size = Pt(28); p_l1.space_after = Pt(6)

    p_l2 = tf_l.add_paragraph(); p_l2.alignment = PP_ALIGN.CENTER
    p_l2.text = "650,000자"
    p_l2.font.name = FONT_HEADING; p_l2.font.size = Pt(40); p_l2.font.bold = True; p_l2.font.color.rgb = LIGHT_DANGER
    p_l2.space_after = Pt(4)

    p_l3 = tf_l.add_paragraph(); p_l3.alignment = PP_ALIGN.CENTER
    p_l3.text = "보고서 한 권 분량 (소설책 4권)"
    p_l3.font.name = FONT_BODY; p_l3.font.size = Pt(13); p_l3.font.bold = True; p_l3.font.color.rgb = LIGHT_TEXT_PRIMARY
    p_l3.space_after = Pt(18)

    p_l4 = tf_l.add_paragraph(); p_l4.alignment = PP_ALIGN.CENTER
    p_l4.text = "작년과 올해 두 권을 나란히 띄우고 사람이 일일이 비교\n집중력 저하로 주석 속 핵심 수치 변경 누락 위험"
    p_l4.font.name = FONT_BODY; p_l4.font.size = Pt(11.5); p_l4.font.color.rgb = LIGHT_TEXT_MUTED

    # [우측 카드]: 한계 2 - AI 환각 (피노키오)
    draw_card(s03, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_ATTENTION_TINT, LIGHT_ATTENTION, 1.5)
    tb_r = s03.shapes.add_textbox(Inches(7.18), Inches(1.85), Inches(5.05), Inches(0.45))
    tf_r = tb_r.text_frame; tf_r.word_wrap = True
    p_r0 = tf_r.paragraphs[0]
    p_r0.text = "⚠️ 한계 ② 믿기 어렵다 (AI 환각의 위험)"
    p_r0.font.name = FONT_HEADING; p_r0.font.size = Pt(15); p_r0.font.bold = True; p_r0.font.color.rgb = LIGHT_ATTENTION

    # 피노키오 이미지 삽입 (카드 중앙 정렬)
    if os.path.exists(pinocchio_img_path):
        s03.shapes.add_picture(pinocchio_img_path, Inches(8.3), Inches(2.4), Inches(2.8), Inches(2.19))

    tb_r_desc = s03.shapes.add_textbox(Inches(7.18), Inches(4.75), Inches(5.05), Inches(1.5))
    tf_r_desc = tb_r_desc.text_frame; tf_r_desc.word_wrap = True

    p_r1 = tf_r_desc.paragraphs[0]; p_r1.alignment = PP_ALIGN.CENTER
    p_r1.text = "AI 환각 (Hallucination)"
    p_r1.font.name = FONT_HEADING; p_r1.font.size = Pt(15); p_r1.font.bold = True; p_r1.font.color.rgb = LIGHT_ATTENTION
    p_r1.space_after = Pt(4)

    p_r2 = tf_r_desc.add_paragraph(); p_r2.alignment = PP_ALIGN.CENTER
    p_r2.text = "피노키오의 긴 코처럼 그럴듯하지만 출처가 없는 거짓말\n영업이익 증감 날조 및 근거 없는 가치판단 위험"
    p_r2.font.name = FONT_BODY; p_r2.font.size = Pt(11.5); p_r2.font.color.rgb = LIGHT_TEXT_MUTED

    add_zone_d_proof_bar(s03, 3, TOTAL_SLIDES, ["ADR 67개", "신뢰 기반 AI", "100% 원문 위치"], ["보고서 한 권 최대 65만 자", "두 권을 사람이 비교", "숫자는 코드가 계산"])
    set_speaker_notes(s03, """[여는 질문]
"사업보고서 한 권은 몇 글자일까요? 최대 65만 자, 소설책 네 권입니다."

[쉬운 설명]
"작년 것과 올해 것을 비교하려면 사람이 두 권을 넘겨 가며 찾아야 합니다. 오른쪽의 피노키오를 보십시오. AI에게 요약을 맡기면 3초 만에 그럴듯한 답변을 내놓지만, 코가 길어지는 피노키오처럼 없는 숫자를 날조하고 출처를 밝히지 못합니다. 금융에서 거짓말은 치명적입니다."

[화면 가리키기]
"왼쪽의 65만 자 수작업 대조의 한계와 오른쪽의 피노키오 AI 환각을 차례로 가리킵니다."

[마무리 한마디]
"그래서 DART Insight는 두 가지 철칙을 세웠습니다. 숫자는 100% 코드가 계산하고, 문장은 반드시 공시 원문 위치를 직결합니다!\"""")

    # Userflow Stepper 6 Steps (Slides 04 ~ 09)
    stepper_names = ["01 탐색", "02 개요", "03 선택", "04 분석", "05 결과", "06 확장"]
    stepper_details = [
        ("회사 검색 및 시즌 Top 10 목록 진입",
         "🔍 [01 탐색] 기능 동작 상세",
         [("초성·종목코드 즉시 검색", "삼성전자, 005930, 'ㅅㅅㅇㅈ' 입력 시 인메모리 트라이 색인으로 즉시 자동완성"),
          ("시총 상위 100 대표 기업", "공공데이터포털 연동으로 KOSPI/KOSDAQ 주요 기업 원클릭 진입 지원"),
          ("시즌 변화 Top 10 랭킹", "정기공시 시즌마다 전년 대비 매출액·영업이익이 급변한 상위 10개사 실시간 집계"),
          ("접수번호 캐시 연동", "한 번 받은 기업 정보는 DB에 저장해 다시 받지 않음")],
         "ADR-0024 · 0046"),
        ("기업 개요와 다기간 재무·수시공시 타임라인",
         "📊 [02 개요] 기능 동작 상세",
         [("다기간 재무 & 비율 추이", "최근 5개년 매출·영업이익·부채비율 차트 및 체크포인트 실시간 계산"),
          ("수시공시 타임라인 1년", "소송, 유상증자, 전환사채(CB), 최대주주 변경 등 주요 사건을 날짜순 시각화"),
          ("AI 기업 3줄 브리핑", "공시 사실에 기반한 3문장 객관적 요약 (매수/매도 권유 원천 배제)"),
          ("전년도 전망 대비 이행 대조", "작년 사업보고서 공약과 금년도 실제 집행 실적을 1:1 대조 준비")],
         "FS-53 · 54 · ADR-0050"),
        ("비교할 보고서 두 개와 비교 가능 조건 검증",
         "⚖️ [03 선택] 비교 가능 조건 검증 표",
         [("보고서 2권 선택 (당기 vs 전기)", "예: 삼성전자 2024년 3분기보고서 vs 2023년 3분기보고서 선택"),
          ("기업 고유번호 일치 확인 (✓)", "동일 기업의 보고서인지 corp_code 기준 기계적 전수 검증"),
          ("기간 순서 유효성 확인 (✓)", "당기 보고서가 전기 보고서보다 앞선 기간인지 선후 관계 검증"),
          ("회계 기준 & 통화 일치 (✓)", "연결/별도 재무제표 기준 및 원화(KRW) 통화 단위 일치 확인")],
         "ADR-0004 · FS-55"),
        ("비동기 분석 작업 번호 발급 및 캐시 재사용",
         "⚙️ [04 분석] 비동기 작업 큐 & 캐시 정책",
         [("작업 번호(Job ID) 발급", "요청 즉시 UUID 발급 후 화면은 폴링 상태로 전환하여 타임아웃 방지"),
          ("단방향 FSM 상태 제어", "PENDING → RUNNING → COMPLETED/FAILED 전이표 엄격 준수"),
          ("동일 보고서 쌍 영구 캐시", "이미 분석한 보고서 쌍은 저장된 결과를 바로 재사용"),
          ("새 분석은 작업으로 처리", "원문 구조화 + 근거 문단 검색 + 코드 증감 계산 (요약만 평균 11.6초)")],
         "ADR-0004 · 0024 · 0042"),
        ("요약·재무·문장 변화와 W-03 원문 뷰어 점프",
         "🎯 [05 결과] 원문 위치로 바로 이동",
         [("재무제표 증감 계산", "증감액·증감률 및 흑자전환 상태를 코드가 오차 없이 산출"),
          ("문장 변화 5대 분류", "추가, 삭제, 수정, 숫자만 변경, 위치 이동을 색상과 태그로 구분"),
          ("#접수번호#B042 원문 딥링크", "모든 문장에 고유 블록 ID 부여, 클릭 시 원문 해당 위치 형광펜 점프"),
          ("AI 요약 설명 등급화", "STATED(직접원인) · RELATED(관련언급) · NONE 3등급 투명 노출")],
         "ADR-0008 · 0015 · 0036"),
        ("우측 AI 에이전트 채팅과 내 판단 노트 담기",
         "💬 [06 확장] 에이전트 채팅 & 멀티 비교",
         [("LangGraph 기반 에이전트 채팅", "보고서 맥락을 유지한 상태에서 심층 질의응답 (24개 백엔드 Tool 실행)"),
          ("내 판단 노트 담기", "검증된 원문 근거와 수치를 원클릭으로 개인 리서치 노트에 보관"),
          ("최대 4개사 멀티 비교", "여러 경쟁 기업의 재무 수치를 방사형 그래프와 표로 한눈에 대조"),
          ("외부 AI MCP 연동", "검증된 공시 분석 데이터를 Claude 등 외부 AI 클라이언트에 안전하게 제공")],
         "ADR-0044 · 0045 · 0052")
    ]

    for step_idx, (headline, card_title, card_items, adr_str) in enumerate(stepper_details):
        slide_no = 4 + step_idx
        sn = prs.slides.add_slide(blank_layout)
        set_slide_background(sn, is_dark=False)
        add_zone_a_header(sn, f"02 · 사용자 여정 {step_idx+1}/6", headline)
        add_zone_b_glossary(sn, "연결재무제표" if step_idx < 3 else ("원문 구조화" if step_idx == 4 else "단방향 FSM"),
                           "자회사 실적까지 합친 성적표" if step_idx < 3 else ("공시 원문을 목차·문단·표로 나눠 위치를 매기는 일" if step_idx == 4 else "역주행 불가능 일방통행"))
        
        # Zone C: Stepper Bar + Result Card
        draw_segmented_bar(sn, Inches(0.8), Inches(1.6), Inches(11.733), Inches(0.42), stepper_names, step_idx, is_dark=False)
        
        # Result Card Container
        draw_card(sn, Inches(0.8), Inches(2.18), Inches(11.733), Inches(4.35), LIGHT_CARD, LIGHT_BORDER, 1.5)
        
        # If Step 5 (Index 4), Draw Special W-03 Jump Arrow!
        if step_idx == 4:
            # Left Sub-card: Summary
            draw_card(sn, Inches(1.1), Inches(2.35), Inches(4.6), Inches(4.0), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.2)
            tb_s = sn.shapes.add_textbox(Inches(1.3), Inches(2.5), Inches(4.2), Inches(3.7))
            tf_s = tb_s.text_frame; tf_s.word_wrap = True
            p = tf_s.paragraphs[0]; p.text = "📋 W-03 AI 검증 요약문"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(8)
            p1 = tf_s.add_paragraph(); p1.text = "매출액은 66조 1,930억 원으로 전년 대비 12.4% 증가하였으며, 이는 HBM 메모리 공급 확대에 기인합니다."
            p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(14)
            p2 = tf_s.add_paragraph(); p2.text = "🏷️ 클릭 근거: [#20250319000665#B042]"
            p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = LIGHT_PURPLE
            
            # Center Prominent Purple Arrow
            draw_horizontal_arrow(sn, Inches(5.95), Inches(3.8), Inches(1.4), Inches(0.7), "#접수번호\n점프 ➔", LIGHT_PURPLE)
            
            # Right Sub-card: DART Original Viewer
            draw_card(sn, Inches(7.6), Inches(2.35), Inches(4.6), Inches(4.0), LIGHT_CARD, LIGHT_BORDER_STR, 1.2)
            tb_v = sn.shapes.add_textbox(Inches(7.8), Inches(2.5), Inches(4.2), Inches(3.7))
            tf_v = tb_v.text_frame; tf_v.word_wrap = True
            p = tf_v.paragraphs[0]; p.text = "🔍 DART 공시 원문 뷰어"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_TEXT_PRIMARY; p.space_after = Pt(8)
            p1 = tf_v.add_paragraph(); p1.text = "II. 사업의 내용 > 2. 주요 제품 및 서비스"
            p1.font.size = Pt(11); p1.font.color.rgb = LIGHT_TEXT_MUTED; p1.space_after = Pt(10)
            p2 = tf_v.add_paragraph(); p2.text = "당사 매출액은 66조 1,930억원으로, 글로벌 AI 수요 급증에 따른 고성능 메모리 공급이 주요하게 작용하였습니다."
            p2.font.size = Pt(12); p2.font.bold = True; p2.font.color.rgb = LIGHT_POSITIVE
            p3 = tf_v.add_paragraph(); p3.text = "✨ [원문 뷰어 형광펜 하이라이트 위치로 즉시 스크롤 완료]"
            p3.font.size = Pt(11.5); p3.font.bold = True; p3.font.color.rgb = LIGHT_PURPLE
        else:
            tb_main = sn.shapes.add_textbox(Inches(1.2), Inches(2.35), Inches(10.9), Inches(4.0))
            tf_m = tb_main.text_frame; tf_m.word_wrap = True
            p = tf_m.paragraphs[0]; p.text = card_title; p.font.size = Pt(17); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(12)
            for h, d in card_items:
                p1 = tf_m.add_paragraph(); p1.text = f"• {h}"; p1.font.size = Pt(13); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY
                p2 = tf_m.add_paragraph(); p2.text = f"   {d}"; p2.font.size = Pt(11.5); p2.font.color.rgb = LIGHT_TEXT_MUTED; p2.space_after = Pt(8)

        add_zone_d_proof_bar(sn, slide_no, TOTAL_SLIDES, adr_str.split(" · "), ["단계별 자동화", "작업 번호로 진행 확인", "사용자 동선 6단계"])
        set_speaker_notes(sn, f"""[여는 질문]
"사용자 여정 {step_idx+1}단계 '{stepper_names[step_idx]}' 버튼을 누르면 화면에 무엇이 나타날까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 이 단계는 사용자가 복잡한 공시 정보를 직관적으로 제어할 수 있도록 돕는 핵심 관문입니다."

[화면 가리키기]
"상단 세그먼트 버튼의 활성화 표시와 중앙 결과 카드를 보십시오. {headline}이 실시간으로 구동됩니다."

[마무리 한마디]
"추측할 필요 없이 클릭 한 번으로 모든 상태를 투명하게 확인하는 엔터프라이즈 UX입니다!\"""")

    # =========================================================================
    # PART 3. 핵심 가치 제안 & Before vs After 세그먼트 (Value)
    # =========================================================================
    bna_views = [
        ("전체 보기", "사람이 넘겨 보던 대조를 자동 비교와 원문 위치로",
         [("소요 시간", "보고서 두 권을 사람이 직접 대조"),
          ("대조 범위", "물리적 한계로 주요 재무 몇 줄만 확인하고 본문 포기"),
          ("환각 위험", "시중 LLM이 없는 숫자를 계산하거나 임의로 지어냄"),
          ("출처 확인", "어느 문단에서 나온 설명인지 원문 검색 불가")],
         [("소요 시간", "두 보고서를 자동으로 대조·구조화 (요약만 평균 11.6초)"),
          ("대조 범위", "5대 재무제표 + 본문 문단 + 표 셀 + 수시공시 전수 분석"),
          ("숫자는 코드", "증감은 코드가 계산하고, AI는 근거 있는 설명만 씀"),
          ("원문 위치", "모든 문장에 접수번호·문단 위치, 누르면 원문으로")]),
        ("속도 중심", "사람의 수작업 대조를 자동 비교로",
         [("수작업 대조", "30~65만 자 본문을 일일이 스크롤하며 수작업 대조"),
          ("자료 준비", "DART 전자공시에서 압축본을 내려받아 표를 엑셀에 손으로 재입력"),
          ("병목 현상", "분기 마감 시 수백 개 기업의 변화를 제때 파악하지 못해 의사결정 지연")],
         [("자동 산출", "재무제표 + 본문 + 표 차이를 한 번에 산출"),
          ("단일 창구", "OpenDART 공식 API + 접수번호로 저장해 다시 받지 않음"),
          ("실시간 큐", "비동기 작업 큐로 시즌 변화 Top 10까지 실시간 파악")]),
        ("신뢰 중심", "숫자는 코드가, 문장은 원문 위치와 함께",
         [("수치 오류", "계산을 LLM에 맡겨 잘못된 증감액과 거짓 백분율이 빈번하게 발생"),
          ("허위 근거", "본문에 전혀 없는 가짜 출처 문장을 지어내 금융 리서치 신뢰도 훼손"),
          ("가치 판단", "'호재', '저평가' 등 규제에 어긋나는 주관적 매수/매도 권유 노출")],
         [("수치는 코드", "코드가 증감을 계산하고, AI는 계산된 수치로 설명만 작성"),
          ("원문 위치", "모든 문장에 원문 위치, 검증 실패 시 최대 2회 다시 생성"),
          ("규제 준수", "가치판단 어휘 자동 검사 및 코드 기준표 기반 신호(긍정/주의/보류)만 노출")])
    ]

    for bna_idx, (bna_label, bna_headline, before_items, after_items) in enumerate(bna_views):
        slide_no = 10 + bna_idx
        sb = prs.slides.add_slide(blank_layout)
        set_slide_background(sb, is_dark=False)
        add_zone_a_header(sb, f"03 · 핵심 가치 제안 [{bna_label}]", bna_headline)
        add_zone_b_glossary(sb, "할루시네이션", "AI가 그럴듯하게 숫자를 지어내는 거짓말")
        
        # Segment Bar
        draw_segmented_bar(sb, Inches(0.8), Inches(1.6), Inches(11.733), Inches(0.42), ["전체 보기", "속도 중심", "신뢰 중심"], bna_idx, is_dark=False)
        
        # Left (Before)
        draw_card(sb, Inches(0.8), Inches(2.18), Inches(5.65), Inches(4.35), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.5)
        tb_b = sb.shapes.add_textbox(Inches(1.1), Inches(2.35), Inches(5.05), Inches(4.0))
        tf_b = tb_b.text_frame; tf_b.word_wrap = True
        p = tf_b.paragraphs[0]; p.text = "❌ 기존 수작업 & 일반 LLM 방식"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER; p.space_after = Pt(10)
        for tag, txt in before_items:
            p1 = tf_b.add_paragraph(); p1.text = f"[{tag}]"; p1.font.bold = True; p1.font.size = Pt(12.5); p1.font.color.rgb = LIGHT_DANGER
            p2 = tf_b.add_paragraph(); p2.text = txt; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_PRIMARY; p2.space_after = Pt(6)

        # Right (After)
        draw_card(sb, Inches(6.88), Inches(2.18), Inches(5.65), Inches(4.35), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 1.5)
        tb_a = sb.shapes.add_textbox(Inches(7.18), Inches(2.35), Inches(5.05), Inches(4.0))
        tf_a = tb_a.text_frame; tf_a.word_wrap = True
        p = tf_a.paragraphs[0]; p.text = "✨ DART Insight 엔터프라이즈 솔루션"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE; p.space_after = Pt(10)
        for tag, txt in after_items:
            p1 = tf_a.add_paragraph(); p1.text = f"[{tag}]"; p1.font.bold = True; p1.font.size = Pt(12.5); p1.font.color.rgb = LIGHT_POSITIVE
            p2 = tf_a.add_paragraph(); p2.text = txt; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_PRIMARY; p2.space_after = Pt(6)

        add_zone_d_proof_bar(sb, slide_no, TOTAL_SLIDES, ["ADR-0004", "ADR-0008", "ADR-0015"], ["자동 비교", "숫자는 코드가 계산", "문장마다 원문 위치"])
        set_speaker_notes(sb, f"""[여는 질문]
"핵심 가치 탭에서 '{bna_label}' 버튼을 눌렀을 때, 업무 효율은 얼마나 급상승할까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. '할루시네이션'이란 금융에서 절대로 허용될 수 없는 AI의 거짓말입니다."

[화면 가리키기]
"화면 좌측의 붉은색 Before 카드와 우측 녹색 After 카드를 직접 비교해 보십시오. {bna_headline}의 변화가 확연합니다."

[마무리 한마디]
"사람이 넘겨 보던 대조를 자동 비교로 바꾸고, 문장마다 원문 위치를 붙였습니다!\"""")

    # =========================================================================
    # PART 4. 공시 분석 & 분석 방법과 기준 (Activity & Methods)
    # =========================================================================
    # SLIDE 17: 공시 분석 (삼성전자 실례)
    s17 = prs.slides.add_slide(blank_layout)
    set_slide_background(s17, is_dark=False)
    add_zone_a_header(s17, "04 · 공시 분석 실전", "두 정기보고서 사이 활동을 타임라인과 영향으로 요약")
    add_zone_b_glossary(s17, "정기 vs 수시", "분기별 정기 건강검진표 vs 갑자기 터진 응급 속보")
    # Zone C: Timeline + Event Card
    draw_card(s17, Inches(0.8), Inches(1.65), Inches(4.5), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    tb = s17.shapes.add_textbox(Inches(1.0), Inches(1.85), Inches(4.1), Inches(4.3))
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = "📅 삼성전자 수시공시 타임라인 (24건)"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    events = [
        ("2024.11.15", "자기주식 취득 결정 (10조 원)"),
        ("2024.10.31", "3분기 연결 실적 공시"),
        ("2024.07.11", "신규 시설투자 결정 (기흥 R&D)"),
        ("2024.04.30", "1분기 배당금 지급 결정"),
        ("2024.03.20", "정기주주총회 결과 보고")
    ]
    for d, title in events:
        p1 = tf.add_paragraph(); p1.text = f"{d}  •  {title}"; p1.font.size = Pt(11); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(4)

    draw_card(s17, Inches(5.6), Inches(1.65), Inches(6.933), Inches(4.85), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.5)
    tb2 = s17.shapes.add_textbox(Inches(5.9), Inches(1.85), Inches(6.3), Inches(4.3))
    tf2 = tb2.text_frame; tf2.word_wrap = True
    p = tf2.paragraphs[0]; p.text = "💡 공시에 적힌 사실과 앞으로의 영향"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    p1 = tf2.add_paragraph(); p1.text = "• 한 문단 브리핑: 두 분기 동안 자사주 매입과 R&D 시설 투자를 병행하며 주주가치 제고 및 차세대 반도체 경쟁력 강화 집중"; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(10)
    p2 = tf2.add_paragraph(); p2.text = "• 긍정 신호 (코드 기준표 판정): 주주환원 정책 확대 (자사주 10조 소각 추진)"; p2.font.bold = True; p2.font.size = Pt(12); p2.font.color.rgb = LIGHT_POSITIVE; p2.space_after = Pt(8)
    p3 = tf2.add_paragraph(); p3.text = "• 주의 신호 (코드 기준표 판정): 반도체 설비 투자에 따른 일시적 현금흐름 둔화"; p3.font.bold = True; p3.font.size = Pt(12); p3.font.color.rgb = LIGHT_ATTENTION; p3.space_after = Pt(8)
    p4 = tf2.add_paragraph(); p4.text = "⚠️ 안내: 'AI 전망'은 공시 사실이 아니며, 신호는 LLM이 아닌 사전 승인된 코드 기준표로만 부여됩니다."; p4.font.size = Pt(11); p4.font.color.rgb = LIGHT_TEXT_MUTED
    add_zone_d_proof_bar(s17, 18, TOTAL_SLIDES, ["ADR-0050", "ADR-0065", "ADR-0066"], ["기간 안 수시공시 연결", "코드 기준표 신호", "문장마다 원문 위치"])
    set_speaker_notes(s17, """[여는 질문]
"두 정기보고서 사이에 이 회사가 도대체 무슨 일을 벌였는지 1분 만에 파악할 수 있을까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 정기공시가 정기 건강검진표라면, 수시공시는 그 사이 터진 응급 속보입니다."

[화면 가리키기]
"화면 좌측의 24건 타임라인과 우측의 사실·영향 카드를 보십시오. 긍정·주의 신호는 AI가 아닌 코드 기준표가 붙입니다."

[마무리 한마디]
"파편화된 1년 치 공시를 단 하나의 스토리라인으로 완벽히 꿰뚫어 줍니다!\"""")

    # SLIDE 18: 분석 방법과 기준 -> 4단계 팩트 검증 기준
    s18 = prs.slides.add_slide(blank_layout)
    set_slide_background(s18, is_dark=False)
    add_zone_a_header(s18, "04 · 4단계 검증 기준", "코드 기반 4단계 팩트 검증 파이프라인")
    add_zone_b_glossary(s18, "4대 판정 규칙", "계산 못 하는 경우는 사유 코드로 & 금지 표현 자동 검사")
    # Zone C: 4 Rule Cards
    rules = [
        ("01. 비교 조건 검증", "동일 기업(corp_code), 기간 선후, 연결/별도 기준, 통화(KRW) 일치 확인 후 비교 진행", LIGHT_PURPLE),
        ("02. 재무 수치 증감", "코드가 증감액·증감률 계산, 흑자전환·이전값 0 등은 사유 코드로 기록", LIGHT_POSITIVE),
        ("03. 문장 변화 5대 분류", "숫자를 가린 글을 맞춰 추가, 삭제, 수정, 숫자만 바뀜, 위치 이동으로 정밀 분류", LIGHT_ATTENTION),
        ("04. 근거 가드레일 & 표현", "모든 문장에 원문 블록 ID 필수, 최대 2회 재생성, 매수·매도 추천 같은 금지 표현 자동 차단", LIGHT_DANGER)
    ]
    for i, (rtitle, rdesc, rcol) in enumerate(rules):
        rx = Inches(0.8) + Inches(2.98) * i
        draw_card(s18, rx, Inches(1.65), Inches(2.8), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        tb_r = s18.shapes.add_textbox(rx + Inches(0.2), Inches(1.85), Inches(2.4), Inches(4.3))
        tf_r = tb_r.text_frame; tf_r.word_wrap = True
        p = tf_r.paragraphs[0]; p.text = rtitle; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = rcol; p.space_after = Pt(10)
        p1 = tf_r.add_paragraph(); p1.text = rdesc; p1.font.size = Pt(11.5); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(10)
        p2 = tf_r.add_paragraph(); p2.text = "✓ 코드 강제 원칙\n✓ 무결성 보증"; p2.font.size = Pt(10.5); p2.font.color.rgb = LIGHT_TEXT_MUTED
    add_zone_d_proof_bar(s18, 19, TOTAL_SLIDES, ["ADR-0004", "ADR-0036", "AGENTS.md"], ["계산 못 하면 사유 코드", "문장 변화 분류", "금지 표현 자동 검사"])
    set_speaker_notes(s18, """[여는 질문]
"AI에게 분석을 맡기는 것과, 코드 규칙이 분석을 지배하는 것의 차이는 무엇일까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 합격했는지 기계적으로 판정하는 채점표입니다."

[화면 가리키기]
"화면의 4개 규칙 카드를 보십시오. 조건 검증부터 수치 증감, 문장 변화, 표현 가드레일까지 분석의 전 과정이 코드의 규칙으로 묶여 있습니다."

[마무리 한마디]
"증감은 코드가 계산하고, 추천·예측 같은 표현은 자동으로 걸러냅니다!\"""")

    # =========================================================================
    # PART 5. 사용자 임팩트 (Impact)
    # =========================================================================
    # SLIDE 19: 사용자 임팩트
    s19 = prs.slides.add_slide(blank_layout)
    set_slide_background(s19, is_dark=False)
    add_zone_a_header(s19, "05 · 사용자 임팩트 & 접근성", "초보 투자자부터 전문 분석가까지 정보 장벽 해소")
    add_zone_b_glossary(s19, "WCAG", "장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트")
    # Zone C: 3 Persona Bento
    personas = [
        ("주식 초보 투자자", "난해한 공시 용어 장벽 완전 해소",
         "• 어려운 금융 용어 카드\n• 사실 기반 AI 브리핑(근거 포함)\n• 위험 신호 체크 포인트", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("전문 애널리스트", "기업 신뢰도 및 공약 이행 검증",
         "• '작년 사업 공약 vs 금년도 실제 이행' 1:1 대조 매트릭스\n• 5대 재무제표 전체 엑셀/CSV 추출 지원\n• 관점별(실적·사업·위험) 골라 보기", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("품질 & 웹 표준", "누구나 차별 없이 쓰는 접근성",
         "• 자동 테스트 약 4,400개, PR마다 통과해야 병합\n• axe-core 접근성 자동 검사\n• 다크모드 완비 및 키보드 완전 탐색 지원", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT)
    ]
    for i, (pname, psub, pbody, pcol, ptint) in enumerate(personas):
        px = Inches(0.8) + Inches(3.98) * i
        draw_card(s19, px, Inches(1.65), Inches(3.8), Inches(4.85), ptint, pcol, 1.5)
        tb_p = s19.shapes.add_textbox(px + Inches(0.25), Inches(1.85), Inches(3.3), Inches(4.3))
        tf_p = tb_p.text_frame; tf_p.word_wrap = True
        p = tf_p.paragraphs[0]; p.text = pname; p.font.size = Pt(17); p.font.bold = True; p.font.color.rgb = pcol; p.space_after = Pt(4)
        p0 = tf_p.add_paragraph(); p0.text = psub; p0.font.size = Pt(12); p0.font.bold = True; p0.font.color.rgb = LIGHT_TEXT_PRIMARY; p0.space_after = Pt(12)
        p1 = tf_p.add_paragraph(); p1.text = pbody; p1.font.size = Pt(11.5); p1.font.color.rgb = LIGHT_TEXT_BODY
    add_zone_d_proof_bar(s19, 20, TOTAL_SLIDES, ["FS-53", "FS-60", "FS-69"], ["용어 카드", "약속·이행 대조", "접근성 자동 검사"])
    set_speaker_notes(s19, """[여는 질문]
"주식 초보자와 전문 분석가가 같은 화면에서 모두 만족할 수 있을까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 'WCAG'는 장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트입니다."

[화면 가리키기]
"화면의 3대 사용자 임팩트 카드를 보십시오. 초보자에게는 용어 카드를, 전문가에게는 약속-이행 대조표를, 시스템 전체에는 약 4,400개 자동 테스트를 제공합니다."

[마무리 한마디]
"초보자부터 실무자까지, 각자 필요한 방식으로 공시를 읽게 했습니다!\"""")

    # =========================================================================
    # PART 6. 아키텍처 & 데이터 파이프라인 (Stack & Architecture)
    # =========================================================================
    # SLIDE 20: 4-Tier 아키텍처 (Dark Theme)
    s20 = prs.slides.add_slide(blank_layout)
    set_slide_background(s20, is_dark=True)
    add_zone_a_header(s20, "06 · 시스템 아키텍처", "React → Spring Boot → FastAPI 단방향 계층 분리", is_dark=True)
    add_zone_b_glossary(s20, "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길", is_dark=True)
    # Zone C: 4-Tier Conveyor Box
    tiers = [
        ("화면 (React 19)", "TypeScript · SPA\n공개 API만 호출\n1,910개 자동 테스트", DARK_PURPLE, DARK_PURPLE_TINT),
        ("백엔드 (Spring Boot 4.1)", "Java 21 · 중심 허브\nOpenDART 캐시 관리\n에이전트 24개 Tool 실행", RGBColor(100, 200, 255), RGBColor(20, 40, 70)),
        ("AI 서버 (FastAPI)", "Python 3.12 · 무상태\n원문 구조화 · BM25 검색\nLangGraph 1단계 실행", RGBColor(120, 230, 160), RGBColor(20, 60, 40)),
        ("운영 DB (MariaDB 11.4)", "표 약 58개\nFlyway 마이그레이션 54개\n고유번호/접수번호 색인", RGBColor(255, 180, 100), RGBColor(60, 40, 20))
    ]
    for i, (tname, tdesc, tcol, ttint) in enumerate(tiers):
        tx = Inches(0.8) + Inches(2.98) * i
        draw_card(s20, tx, Inches(1.85), Inches(2.6), Inches(4.3), ttint, tcol, 1.5)
        tb_t = s20.shapes.add_textbox(tx + Inches(0.15), Inches(2.1), Inches(2.3), Inches(3.8))
        tf_t = tb_t.text_frame; tf_t.word_wrap = True
        p = tf_t.paragraphs[0]; p.text = tname; p.font.size = Pt(14); p.font.bold = True; p.font.color.rgb = tcol; p.space_after = Pt(8)
        p1 = tf_t.add_paragraph(); p1.text = tdesc; p1.font.size = Pt(11); p1.font.color.rgb = DARK_TEXT_PRIMARY; p1.space_after = Pt(12)
        if i < 3:
            p2 = tf_t.add_paragraph(); p2.text = "➔ 단방향 호출"; p2.font.bold = True; p2.font.size = Pt(11); p2.font.color.rgb = DARK_PURPLE
    add_zone_d_proof_bar(s20, 21, TOTAL_SLIDES, ["ADR-0002", "ADR-0004", "ADR-0052"], ["ArchUnit 계층 검사", "단방향 호출", "X-Trace-Id 추적"], is_dark=True)
    set_speaker_notes(s20, """[여는 질문]
"수많은 개발자가 협업하는 대규모 금융 프로젝트에서 어떻게 스파게티 코드를 원천 차단했을까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 시스템 호출 역시 단 한 방향으로만 흘러야 상태가 꼬이지 않습니다."

[화면 가리키기]
"화면의 4-Tier 아키텍처를 보십시오. React는 오직 Spring Boot만 바라보며, FastAPI와 MariaDB는 내부망에 안전하게 격리되어 있습니다."

[마무리 한마디]
"ArchUnit 테스트가 계층 규칙을 빌드마다 검사합니다!\"""")

    # SLIDE 21: 데이터 파이프라인 & 캐시 전략 (Dark Theme)
    s21 = prs.slides.add_slide(blank_layout)
    set_slide_background(s21, is_dark=True)
    add_zone_a_header(s21, "07 · 데이터 파이프라인", "받은 공시는 접수번호로 저장해 다시 받지 않습니다", is_dark=True)
    add_zone_b_glossary(s21, "MCP 서버", "외부 AI가 우리 공시 데이터를 안전하게 읽는 전용 플러그인", is_dark=True)
    # Zone C: Cache Strategy Diagram
    draw_card(s21, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), DARK_CARD, DARK_BORDER, 1.5)
    tb_c1 = s21.shapes.add_textbox(Inches(1.1), Inches(1.9), Inches(5.05), Inches(4.3))
    tf_c1 = tb_c1.text_frame; tf_c1.word_wrap = True
    p = tf_c1.paragraphs[0]; p.text = "📦 OpenDART 2단계 캐시 정책"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = DARK_PURPLE; p.space_after = Pt(10)
    p1 = tf_c1.add_paragraph(); p1.text = "• 보고서 귀속 자료 (접수번호 키): 접수번호로 저장해 다시 받지 않음\n• 기업개황 및 공시목록: 정해진 주기로 다시 받음\n• OpenDART 하루 호출 한도(2만 회)를 아껴 씀"; p1.font.size = Pt(12); p1.font.color.rgb = DARK_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_c1.add_paragraph(); p2.text = "⚡ 저장된 자료는 바로 응답"; p2.font.bold = True; p2.font.size = Pt(13); p2.font.color.rgb = RGBColor(120, 230, 160)

    draw_card(s21, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), DARK_CARD_RAISED, DARK_BORDER, 1.5)
    tb_c2 = s21.shapes.add_textbox(Inches(7.18), Inches(1.9), Inches(5.05), Inches(4.3))
    tf_c2 = tb_c2.text_frame; tf_c2.word_wrap = True
    p = tf_c2.paragraphs[0]; p.text = "🔌 독립 MCP 서버 연동 (ADR-0052)"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = RGBColor(100, 200, 255); p.space_after = Pt(10)
    p1 = tf_c2.add_paragraph(); p1.text = "• 외부 AI 에이전트를 위한 읽기 전용 7대 도구 제공\n• Spring Boot 공개 API만 경유하여 원본 DB 직접 접근 원천 차단\n• 내부 서비스와 동일한 권한 및 일일 쿼터 규칙 적용"; p1.font.size = Pt(12); p1.font.color.rgb = DARK_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_c2.add_paragraph(); p2.text = "🛡️ 외부 AI는 읽기 전용, 백엔드와 같은 권한·한도"; p2.font.bold = True; p2.font.size = Pt(13); p2.font.color.rgb = RGBColor(120, 230, 160)
    add_zone_d_proof_bar(s21, 22, TOTAL_SLIDES, ["ADR-0024", "ADR-0046", "ADR-0052"], ["같은 자료 다시 안 받음", "외부 AI 읽기 전용", "MCP 도구 7종"], is_dark=True)
    set_speaker_notes(s21, """[여는 질문]
"OpenDART의 하루 호출 한도가 2만 회인데, 수만 명이 동시 접속하면 서비스가 멈출까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 'MCP 서버'란 외부 AI가 안전하게 데이터를 가져갈 수 있도록 만든 전용 플러그인입니다."

[화면 가리키기]
"화면 좌우 카드를 보십시오. 접수번호 영구 캐시로 일일 한도를 완벽히 방어하고, 외부 AI 연동까지 읽기 전용으로 안전하게 구축했습니다."

[마무리 한마디]
"같은 자료는 다시 받지 않아, OpenDART 하루 한도와 응답 시간을 함께 아낍니다!\"""")

    # =========================================================================
    # PART 7. 인프라 & 운영 안전 (Infra & Quota Simulator)
    # =========================================================================
    # SLIDE 34: 2-VM 인프라 물리 격리 & 배포 파이프라인
    s34 = prs.slides.add_slide(blank_layout)
    set_slide_background(s34, is_dark=False)
    add_zone_a_header(s34, "08 · 인프라 & 운영 안전", "서버 두 대, 실패하면 자동으로 되돌립니다")
    add_zone_b_glossary(s34, "Flyway", "DB 스키마 변경 이력을 코드처럼 커밋하는 버전 관리기")
    # Zone C: 2-VM Layout
    draw_card(s34, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    tb_vm1 = s34.shapes.add_textbox(Inches(1.1), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_vm1 = tb_vm1.text_frame; tf_vm1.word_wrap = True
    p = tf_vm1.paragraphs[0]; p.text = "🖥️ VM1 · 사용자 웹 & 백엔드 & DB"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    p1 = tf_vm1.add_paragraph(); p1.text = "• Nginx 웹 프록시 (:80, :443 HTTPS)\n• Spring Boot 4.1 백엔드 (:8080)\n• MariaDB 11.4 운영 데이터베이스\n• 외부 사용자의 정적 자산 및 API 요청을 전담 처리"; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_vm1.add_paragraph(); p2.text = "🛡️ AI 서버를 따로 두어 웹·DB 서버와 부하를 나눔"; p2.font.bold = True; p2.font.size = Pt(12.5); p2.font.color.rgb = LIGHT_POSITIVE

    draw_card(s34, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.5)
    tb_vm2 = s34.shapes.add_textbox(Inches(7.18), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_vm2 = tb_vm2.text_frame; tf_vm2.word_wrap = True
    p = tf_vm2.paragraphs[0]; p.text = "⚡ VM2 · AI 연산 노드 & 배포 파이프라인"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    p1 = tf_vm2.add_paragraph(); p1.text = "• FastAPI AI 서버 (:8000, 내부망 전용)\n• Jenkins CI/CD 빌드 파이프라인 (Poll SCM 5분)\n• 새 DB 변경은 검토된 해시와 같을 때만 반영\n• 이상 감지 시 이전 이미지로 자동 복구"; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_vm2.add_paragraph(); p2.text = "🔄 배포 실패 시 이전 버전으로 자동 복구 (11/9 실제 동작)"; p2.font.bold = True; p2.font.size = Pt(12.5); p2.font.color.rgb = LIGHT_POSITIVE
    add_zone_d_proof_bar(s34, 35, TOTAL_SLIDES, ["ADR-0007", "ADR-0017", "ADR-0020"], ["서버 2대 분리", "새 DB 변경 해시 검토", "실패 시 자동 복구"])
    set_speaker_notes(s34, """[여는 질문]
"새벽 배포 중 DB 마이그레이션이 실패하면 시스템을 이전 상태로 되돌리는 데 얼마나 걸릴까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 'Flyway'는 DB의 모든 변경 이력을 코드처럼 통제합니다."

[화면 가리키기]
"화면 좌우의 2-VM 분리도를 보십시오. AI 서버를 따로 두고, 배포 전 DB를 백업하며, 이상하면 이전 버전으로 자동 복구합니다."

[마무리 한마디]
"배포가 실패해도 이전 버전으로 스스로 돌아옵니다. 11월 9일 실제로 동작했습니다!\"""")

    # SLIDE 35: 일일 질문 한도 시뮬레이터 (비로그인 vs 회원)
    s35 = prs.slides.add_slide(blank_layout)
    set_slide_background(s35, is_dark=False)
    add_zone_a_header(s35, "08 · 일일 질문 한도 시뮬레이터", "비로그인 20회 vs 회원 100회 초과 시 429 안전 제어")
    add_zone_b_glossary(s35, "컴플라이언스", "매수/매도 투자 권유를 막는 법적 안전 차단막")
    # Zone C: Quota Simulator
    draw_card(s35, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    draw_segmented_bar(s35, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.42), ["비로그인 사용자 (하루 20회)", "회원 로그인 (하루 100회)", "서비스 전체 상한 (하루 3,000회)"], 0, is_dark=False)

    # Meter Box (20 / 20 Limit Reached)
    draw_card(s35, Inches(1.2), Inches(2.6), Inches(10.933), Inches(1.6), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.2)
    tb_m = s35.shapes.add_textbox(Inches(1.5), Inches(2.75), Inches(10.3), Inches(1.3))
    tf_m = tb_m.text_frame; tf_m.word_wrap = True
    p = tf_m.paragraphs[0]; p.text = "오늘 사용한 질문: 20 / 20 회 (일일 한도 도달)"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER; p.space_after = Pt(8)
    p1 = tf_m.add_paragraph(); p1.text = "⚠️ HTTP 429 Too Many Requests: 오늘 질문 한도를 모두 소진하였습니다. 내일 자정(KST)에 다시 초기화됩니다."; p1.font.size = Pt(12); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY

    # Action / Upsell Callout
    draw_card(s35, Inches(1.2), Inches(4.45), Inches(10.933), Inches(1.75), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.2)
    tb_u = s35.shapes.add_textbox(Inches(1.5), Inches(4.6), Inches(10.3), Inches(1.4))
    tf_u = tb_u.text_frame; tf_u.word_wrap = True
    p = tf_u.paragraphs[0]; p.text = "👉 [회원 로그인 시 즉시 100회로 확장]"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(6)
    p1 = tf_u.add_paragraph(); p1.text = "• 소셜 로그인(구글/카카오) 시 회원별 100회 쿼터가 즉시 새로 적용됩니다.\n• 이미 생성된 분석 결과를 다시 열람하는 것은 질문 쿼터를 소모하지 않습니다."; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY
    add_zone_d_proof_bar(s35, 36, TOTAL_SLIDES, ["ADR-0054", "ADR-0056"], ["비로그인 20회", "회원 100회", "전체 3,000회 상한"])
    set_speaker_notes(s35, """[여는 질문]
"무료 사용자가 질문을 무한정 보내서 AI 서버를 다운시키려고 하면 어떻게 될까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 악의적 트래픽이나 과다 호출을 차단하는 쿼터 방어막입니다."

[화면 가리키기]
"화면의 게이지와 429 안내 박스를 보십시오. 비로그인 20회 한도 도달 시 즉시 차단되며, 로그인 유도와 함께 안전하게 방어됩니다."

[마무리 한마디]
"비로그인 20회, 회원 100회, 서비스 전체 하루 3,000회로 AI 비용을 막습니다!\"""")

    # =========================================================================
    # PART 8. AX 일하는 방식 & 피날레 (Weeks)
    # =========================================================================
    # SLIDE 36: AX 7단계 라이프사이클 - Phase 1 정밀 기획 & 선행 설계
    s36 = prs.slides.add_slide(blank_layout)
    set_slide_background(s36, is_dark=False)
    add_zone_a_header(s36, "09 · AX 라이프사이클 (Phase 1)", "성공기준 수립부터 ADR 선행 설계 및 WBS 분해")
    add_zone_b_glossary(s36, "수용 기준(AC)", "기능 합격 여부를 판정하는 기계적 채점표")
    # Zone C: Phase 1 4 Nodes
    ax_p1_nodes = [
        ("01. 성공 기준 (SC)", "비즈니스 성공 지표\n사람 주도 수립\nSC-1~4 정의", LIGHT_PURPLE),
        ("02. AI 기획 (FS & AC)", "기능 기획서 작성\n수용기준(AC) 명세\n사람 🤝 AI 공동", LIGHT_POSITIVE),
        ("03. 아키텍처 (ADR)", "67개 ADR 선행\nAPI/DB 스펙 선행\n단방향 호출 규칙", LIGHT_ATTENTION),
        ("04. WBS 작업 분해", "AC 1:1 이슈 분해\n선행 의존성 매핑\nAI 스킬 자동화", LIGHT_PURPLE)
    ]
    for i, (aname, adesc, acol) in enumerate(ax_p1_nodes):
        ax = Inches(0.8) + Inches(2.98) * i
        draw_card(s36, ax, Inches(1.65), Inches(2.8), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        tb_a = s36.shapes.add_textbox(ax + Inches(0.2), Inches(1.85), Inches(2.4), Inches(4.3))
        tf_a = tb_a.text_frame; tf_a.word_wrap = True
        p = tf_a.paragraphs[0]; p.text = aname; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = acol; p.space_after = Pt(10)
        p1 = tf_a.add_paragraph(); p1.text = adesc; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
        if i < 3:
            p2 = tf_a.add_paragraph(); p2.text = "➔ 다음 단계 전진"; p2.font.bold = True; p2.font.size = Pt(11); p2.font.color.rgb = acol
    add_zone_d_proof_bar(s36, 37, TOTAL_SLIDES, ["SC-1~4", "FS-1~74", "67 ADRs"], ["기획서·수용 기준 먼저", "AC를 이슈로", "설계 기록 67개"])
    set_speaker_notes(s36, """[여는 질문]
"코딩을 시작하기 전, 기획과 설계 단계에서 AI와 사람은 어떻게 손발을 맞췄을까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 통과했는지 채점하는 명확한 기준표입니다."

[화면 가리키기]
"화면의 4단계 컨베이어 벨트를 보십시오. 성공 기준 수립부터 AI 스펙 명세, 67개 ADR 선행 설계, WBS 분해까지 한 치의 오차 없이 연결됩니다."

[마무리 한마디]
"설계 없이 코딩하지 않도록, 기획과 설계를 먼저 남겼습니다!\"""")

    # SLIDE 37: AX 7단계 라이프사이클 - Phase 2 에이전틱 자율 구현 & 품질 게이트
    s37 = prs.slides.add_slide(blank_layout)
    set_slide_background(s37, is_dark=False)
    add_zone_a_header(s37, "09 · AX 라이프사이클 (Phase 2)", "AI와 함께 구현하고, 자동 검사를 통과해야 병합")
    add_zone_b_glossary(s37, "WCAG & axe-core", "장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트")
    # Zone C: Phase 2 3 Nodes
    ax_p2_nodes = [
        ("05. 에이전틱 페어 코딩", "AI 에이전트 자율 협업\nAGENTS.md 규칙 헌장 엄수\n브랜치 격리 & Rebase Merge", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("06. 자동화 품질 게이트", "자동 테스트 약 4,400개\naxe-core 접근성 검사\ngitleaks 비밀정보 검사", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("07. 수용기준 검증 (Done)", "AC마다 증빙 대조\nPR 번호 & 테스트 대조\n기능 완료 최종 판정", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT)
    ]
    for i, (aname, adesc, acol, atint) in enumerate(ax_p2_nodes):
        ax = Inches(0.8) + Inches(3.98) * i
        draw_card(s37, ax, Inches(1.65), Inches(3.8), Inches(4.85), atint, acol, 1.5)
        tb_a = s37.shapes.add_textbox(ax + Inches(0.25), Inches(1.85), Inches(3.3), Inches(4.3))
        tf_a = tb_a.text_frame; tf_a.word_wrap = True
        p = tf_a.paragraphs[0]; p.text = aname; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = acol; p.space_after = Pt(10)
        p1 = tf_a.add_paragraph(); p1.text = adesc; p1.font.size = Pt(12.5); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
        p2 = tf_a.add_paragraph(); p2.text = "✓ 기계적 품질 보증 통과"; p2.font.bold = True; p2.font.size = Pt(11.5); p2.font.color.rgb = acol
    add_zone_d_proof_bar(s37, 38, TOTAL_SLIDES, ["AGENTS.md", "테스트 약 4,400", "PR 461"], ["PR마다 테스트", "접근성 검사", "비밀정보 검사"])
    set_speaker_notes(s37, """[여는 질문]
"약 4주 만에 테스트 약 4,400개를 갖춘 서비스, 품질은 어떻게 지켰을까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 'axe-core'는 단 하나의 접근성 오류도 용납하지 않는 품질 채점기입니다."

[화면 가리키기]
"화면의 3대 실행 카드를 보십시오. AGENTS.md 헌장 아래 자율 페어 코딩을 거쳐 PR마다 약 4,400개 테스트와 보안 검사를 통과해야만 병합됩니다."

[마무리 한마디]
"수용 기준을 하나씩 확인하고 나서야 '완료'로 표시합니다!\"""")

    # SLIDE 38: AX Before vs After 비교
    s38 = prs.slides.add_slide(blank_layout)
    set_slide_background(s38, is_dark=False)
    add_zone_a_header(s38, "09 · AX 임팩트 비교", "전통적 개발 방식 vs DART Insight AX 협업 혁신")
    add_zone_b_glossary(s38, "수용 기준(AC)", "기능 합격 여부를 판정하는 기계적 채점표")
    # Zone C: 1:1 Split
    draw_card(s38, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.5)
    tb_b = s38.shapes.add_textbox(Inches(1.1), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_b = tb_b.text_frame; tf_b.word_wrap = True
    p = tf_b.paragraphs[0]; p.text = "❌ 기존 전통적 개발 방식"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER; p.space_after = Pt(10)
    items_tb = [
        ("기획 병목", "기획서 작성 및 WBS 작업 분해에만 수일 소요"),
        ("AI 환각", "단순 코드 생성 시 아키텍처 규칙과 타입 시스템 파괴"),
        ("품질 부채", "단위 테스트 없는 빠른 코딩으로 배포 후 대규모 결함 발생"),
        ("설계 휘발", "구두 논의로 결정된 아키텍처가 코드에 반영되지 않고 유실")
    ]
    for tag, txt in items_tb:
        p1 = tf_b.add_paragraph(); p1.text = f"[{tag}]  {txt}"; p1.font.size = Pt(11.5); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(8)

    draw_card(s38, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 1.5)
    tb_a = s38.shapes.add_textbox(Inches(7.18), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_a = tb_a.text_frame; tf_a.word_wrap = True
    p = tf_a.paragraphs[0]; p.text = "✨ DART Insight AX 일하는 방식"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE; p.space_after = Pt(10)
    items_ta = [
        ("스킬 자동화", "성공 기준(SC)에서 수용 기준(AC)·WBS 이슈 30분 만에 도출"),
        ("규칙 헌장", "AGENTS.md로 AI와 사람 모두 단방향 계층 분리 엄수"),
        ("품질 게이트", "PR마다 테스트 약 4,400개 + 접근성 + 비밀정보 검사"),
        ("67개 ADR", "구조 결정을 ADR로 남겨 이유와 대안을 기록")
    ]
    for tag, txt in items_ta:
        p1 = tf_a.add_paragraph(); p1.text = f"[{tag}]  {txt}"; p1.font.size = Pt(11.5); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(8)
    p_sum = tf_a.add_paragraph(); p_sum.text = "📈 약 4주 · PR 461 · 이슈 429 · ADR 67"; p_sum.font.bold = True; p_sum.font.size = Pt(13); p_sum.font.color.rgb = LIGHT_POSITIVE
    add_zone_d_proof_bar(s38, 39, TOTAL_SLIDES, ["SC-1~4", "PR 461", "커밋 1,101"], ["규칙 한 파일", "자동 검사", "결정 기록"])
    set_speaker_notes(s38, """[여는 질문]
"단순히 AI 코딩 도구를 쓰는 것과, 일하는 방식 자체를 AI 중심으로 혁신(AX)하는 것의 결정적 차이는 무엇일까요?"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 합격했는지 판정하는 객관적 채점표입니다."

[화면 가리키기]
"화면 좌우 비교를 보십시오. 기획 병목과 환각을 낳던 전통 방식에서, 스킬 자동화와 약 4,400개 테스트 게이트로 품질을 지켰습니다."

[마무리 한마디]
"PR 461개, ADR 67개, 테스트 약 4,400개. 이것이 저희 팀의 기록입니다!\"""")

    # SLIDE 39: 그랜드 피날레 & 4대 정량 성과 (Q&A)
    s39 = prs.slides.add_slide(blank_layout)
    set_slide_background(s39, is_dark=False)
    add_zone_a_header(s39, "09 · 피날레 & 질의응답 (Q&A)", "금융의 미래를 여는 DART Insight, 질문을 받겠습니다")
    add_zone_b_glossary(s39, "DART Insight", "두 보고서 사이 바뀐 것을 원문 근거와 함께 보여 주는 서비스")
    # Zone C: Grand Finale Bento
    draw_card(s39, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    tb_fin = s39.shapes.add_textbox(Inches(1.2), Inches(1.9), Inches(10.933), Inches(4.3))
    tf_fin = tb_fin.text_frame; tf_fin.word_wrap = True
    p = tf_fin.paragraphs[0]; p.alignment = PP_ALIGN.CENTER; p.text = '"AI는 최고의 비서지, 대표가 아닙니다."'; p.font.size = Pt(28); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(16)
    
    # 4 Pillars recap
    p_recap = tf_fin.add_paragraph(); p_recap.alignment = PP_ALIGN.CENTER
    p_recap.text = "📜 ADR 67개    |    🔀 PR 461개    |    🧪 테스트 약 4,400개    |    🧮 숫자는 코드가 계산"
    p_recap.font.name = FONT_HEADING; p_recap.font.size = Pt(15); p_recap.font.bold = True; p_recap.font.color.rgb = LIGHT_TEXT_PRIMARY; p_recap.space_after = Pt(24)

    p_qa = tf_fin.add_paragraph(); p_qa.alignment = PP_ALIGN.CENTER
    p_qa.text = "경청해 주셔서 대단히 감사합니다.\n질문을 받겠습니다."
    p_qa.font.name = FONT_HEADING; p_qa.font.size = Pt(20); p_qa.font.bold = True; p_qa.font.color.rgb = LIGHT_POSITIVE

    add_zone_d_proof_bar(s39, 40, TOTAL_SLIDES, ["ADR 67개", "FS-1~74", "PR 461"], ["원문 근거", "숫자는 코드가 계산", "Q&A"])
    set_speaker_notes(s39, """[여는 질문]
"우리는 금융 AI에서 가장 중요한 질문을 던졌습니다. 'AI를 믿을 수 있는가?'"

[쉬운 설명]
"우측 상단 돋보기를 보시죠. 'DART Insight'는 거짓말하지 않는 원문 직결 금융 인텔리전스입니다."

[화면 가리키기]
"화면 중앙의 비전 선언문을 보십시오. 'AI는 최고의 비서지, 대표가 아닙니다.' 코드가 숫자를 철저히 계산하고, AI는 정제된 원문 근거만 꿰뚫습니다."

[마무리 한마디]
"PR 461개, ADR 67개, 테스트 약 4,400개로 만든 DART Insight였습니다. 발표를 마치겠습니다. 경청해 주셔서 대단히 감사합니다. 질문을 받겠습니다!\"""")

    # -------------------------------------------------------------------------
    # Save PPTX to docs/ and copy to frontend/public/easter/
    # -------------------------------------------------------------------------
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    docs_output = os.path.join(project_root, "docs", "DART_Insight_Presentation.pptx")
    web_output = os.path.join(project_root, "frontend", "public", "easter", "DART_Insight_Presentation.pptx")

    renumber_slide_counters(prs)
    prs.save(docs_output)
    print(f"✓ Saved {len(prs.slides)}-slide PowerPoint presentation to: {docs_output}")

    os.makedirs(os.path.dirname(web_output), exist_ok=True)
    shutil.copyfile(docs_output, web_output)
    print(f"✓ Copied to web easter directory: {web_output}")

if __name__ == "__main__":
    build_presentation()
