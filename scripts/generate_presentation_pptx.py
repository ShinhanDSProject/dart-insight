#!/usr/bin/env python3
"""
DART Insight High-Impact 4-Zone Presentation PPTX Generator (39-Slide Walkthrough)
===================================================================================
Generates docs/DART_Insight_Presentation.pptx directly expressing
frontend/public/easter/three-weeks.html with sequential slides for every button click!

Features:
1. 39 High-Fidelity 16:9 Widescreen Slides (13.333" x 7.5").
2. 4-Zone Visual Layout:
   - Zone A: Top Kicker Pill + One-Liner Headline (<25자).
   - Zone B: 1-Second Term Translator Callout (🔍 용어 = 1줄 비유).
   - Zone C: Visual Diagram Canvas mirroring three-weeks.html widgets.
             Interactive buttons are drawn in a segmented bar with the active button
             visibly highlighted and its resulting UI state / callout displayed!
   - Zone D: Bottom Proof Bar (ADR Badges + Key Metrics + Slide Counter 01/39 ~ 39/39).
3. Design System Tokens (tokens.css / design-system.md):
   - Light: Canvas #F6F7FA, Card #FFFFFF, Primary #141936, Purple #6159B5,
            Positive #187653, Attention #8A5300, Danger #B74250, Neutral #E4E6EB
   - Dark: Canvas #0C0F1D, Card #151A2E, Raised #1D2340, Purple #C4BFFF, Text #ECEEFB
4. Horang (허성범) Style 4-Step Speaker Notes for all 39 slides.
"""

import os
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

TOTAL_SLIDES = 41

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
    p1.text = f"🔍 1초 통역 · {term}"
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
# 39 Slide Generation Routines
# -----------------------------------------------------------------------------

def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    print("Generating 40 High-Impact 4-Zone Presentation Slides...")

    # =========================================================================
    # PART 1. 타이틀 & 비전 (Hero)
    # =========================================================================
    # SLIDE 01: 히어로 비전 & 4대 메트릭
    s01 = prs.slides.add_slide(blank_layout)
    set_slide_background(s01, is_dark=False)
    add_zone_a_header(s01, "01 · 프로젝트 비전 & 핵심 성과", "300페이지 공시 대조를 5초 만에 원문 직결 자동화")
    add_zone_b_glossary(s01, "공시(DART)", "기업의 모든 진실이 담긴 '공식 생활기록부' (전자공시 도서관)")
    
    # Zone C: Hero 4-Bento Grid
    bento_data = [
        ("5초", "초고속 전수 대조", "수작업 4시간 소요를 단 5초 만에 완료\n5대 재무제표 및 본문 변경점 일괄 추출", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("100%", "원문 직결 근거율", "모든 요약 문장에 #{접수번호}#B{n} 딥링크 부여\n클릭 시 원문 형광펜 하이라이트 점프", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("0.00%", "수치 환각 원천 차단", "숫자는 백엔드 코드가 100% 계산 수행\nLLM은 정제된 근거 요약만 작성", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("4,405+", "자동화 테스트 무결성", "화면 1,907 · AI 1,188 · 백엔드 1,310개\naxe-core 웹 접근성 0개 위반 검증", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
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
    add_zone_d_proof_bar(s01, 1, TOTAL_SLIDES, ["ADR-0004", "ADR-0008"], ["대조 시간 4시간→5초", "환각 0.00%", "테스트 4,405개 통과"])
    set_speaker_notes(s01, """[도발적 질문 Hook]
"여러분, 가만히 숨만 쉬어도 통장 잔고의 실질 가치가 깎여나가는 고물가·인플레이션 시대, 여러분은 내 자산을 지키기 위해 어떤 재테크를 하고 계십니까?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '공시(DART)'란 금융감독원에 제출하는 기업의 공식 생활기록부입니다. 복리의 마법을 누리기 위해선 소문이 아닌 이 공시 속 진짜 기업 실적과 해자를 읽어야 합니다."

[시각 요소 지시어]
"화면 중앙의 4대 벤토 지표 카드를 보십시오. DART Insight는 300페이지짜리 공시 대조를 단 5초 만에, 100% 원문 근거와 환각 0%로 완벽히 끝내주는 스마트 재테크 AI 비서입니다."

[숫자 타격감 마무리]
"수작업 4시간을 단 5초로 단축하고 환각 0.00%를 달성한, 성공적인 재테크를 위한 나의 가장 확실한 공시 분석 파트너입니다!\"""")

    # =========================================================================
    # =========================================================================
    # PART 1-A. 왜 지금 재테크와 기업 분석인가? (인플레이션 방어 & 3대 비주얼 로드맵)
    # =========================================================================
    # SLIDE 02: 인플레이션 시대 재테크와 3대 비주얼 로드맵
    s02_wealth = prs.slides.add_slide(blank_layout)
    set_slide_background(s02_wealth, is_dark=False)
    add_zone_a_header(s02_wealth, "00-A · 왜 재테크인가?", "숨만 쉬어도 돈 가치가 떨어지는 시대, 왜 기업 분석과 재테크인가?")
    add_zone_b_glossary(s02_wealth, "인플레이션 & 복리의 마법", "화폐 가치 하락 방어 & 우량 기업 팩트 분석 기반 자산 증식")

    # Zone C: 3대 비주얼 카드 (인플레이션 차트 -> 피노키오 AI 환각 -> DART Insight 팩트 비서)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    chart_img_path = os.path.join(project_root, "frontend", "public", "easter", "inflation-chart.png")
    pinocchio_img_path = os.path.join(project_root, "frontend", "public", "easter", "pinocchio-hallucination.jpg")
    logo_img_path = os.path.join(project_root, "frontend", "public", "easter", "dart-insight-logo.png")

    from PIL import Image as PILImage

    w_visual_cards = [
        ("💸 Stage 01 · 위기 인식", "인플레이션 시대의 생존", "시간이 흐를수록 급락하는 현금 가치",
         chart_img_path, "📉 현금 실질 가치 -72% 폭락 (가만히 있으면 손실)", LIGHT_DANGER, LIGHT_DANGER_TINT),
        ("🤥 Stage 02 · 기존의 함정", "찌라시 투자 & AI 환각의 덫", "거짓말하면 코가 늘어나는 피노키오와 시중 AI",
         pinocchio_img_path, "🤥 챗GPT의 수치 왜곡 · 피 같은 투자금 손실 위험", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("🛡️ Stage 03 · 시스템 해답", "DART Insight 팩트 비서", "100% 원문 직결 & 환각 없는 5초 대조",
         logo_img_path, "✓ 100% 원문 직결 & 환각 없는 5초 대조", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT)
    ]

    for i, (wstage, wtitle, wsub, img_path, wtag, wcol, wtint) in enumerate(w_visual_cards):
        wx = Inches(0.8) + Inches(3.98) * i
        # 카드 배경
        draw_card(s02_wealth, wx, Inches(1.65), Inches(3.8), Inches(4.85), wtint, wcol, 1.5)
        # 텍스트 헤더
        tb_w = s02_wealth.shapes.add_textbox(wx + Inches(0.2), Inches(1.78), Inches(3.4), Inches(0.8))
        tf_w = tb_w.text_frame; tf_w.word_wrap = True
        tf_w.margin_left = tf_w.margin_top = tf_w.margin_right = tf_w.margin_bottom = 0
        p = tf_w.paragraphs[0]; p.text = wstage; p.font.name = FONT_HEADING; p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = wcol; p.space_after = Pt(2)
        p0 = tf_w.add_paragraph(); p0.text = wtitle; p0.font.name = FONT_HEADING; p0.font.size = Pt(14); p0.font.bold = True; p0.font.color.rgb = LIGHT_TEXT_PRIMARY; p0.space_after = Pt(2)
        p1 = tf_w.add_paragraph(); p1.text = wsub; p1.font.name = FONT_BODY; p1.font.size = Pt(9.5); p1.font.color.rgb = LIGHT_TEXT_MUTED

        # 미디어 이미지
        if os.path.exists(img_path):
            img_box_y = Inches(2.7)
            img_box_h = Inches(2.8)
            img_box_w = Inches(3.4)
            img_box_x = wx + Inches(0.2)
            draw_card(s02_wealth, img_box_x, img_box_y, img_box_w, img_box_h, LIGHT_CARD, LIGHT_BORDER, 1.0)
            
            with PILImage.open(img_path) as pimg:
                pw, ph = pimg.size
                aspect = pw / ph
            
            avail_w = 3.2
            avail_h = 2.6
            if avail_w / avail_h > aspect:
                target_h = avail_h
                target_w = target_h * aspect
            else:
                target_w = avail_w
                target_h = target_w / aspect
            
            img_left = img_box_x + Inches((3.4 - target_w) / 2)
            img_top = img_box_y + Inches((2.8 - target_h) / 2)
            s02_wealth.shapes.add_picture(img_path, img_left, img_top, Inches(target_w), Inches(target_h))

        # 하단 단일 타격감 뱃지
        badge_y = Inches(5.68)
        draw_card(s02_wealth, wx + Inches(0.2), badge_y, Inches(3.4), Inches(0.62), LIGHT_CARD, wcol, 1.2)
        tb_tag = s02_wealth.shapes.add_textbox(wx + Inches(0.25), badge_y + Inches(0.06), Inches(3.3), Inches(0.5))
        tf_tag = tb_tag.text_frame; tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]; p_tag.text = wtag; p_tag.font.name = FONT_BODY; p_tag.font.size = Pt(9.5); p_tag.font.bold = True; p_tag.font.color.rgb = wcol
        p_tag.alignment = PP_ALIGN.CENTER

    add_zone_d_proof_bar(s02_wealth, 2, TOTAL_SLIDES, ["인플레이션 방어", "수치 환각 0.00%", "공인 팩트 100%"], ["현금 실질가치 -72% 방어", "AI 환각 위험 0.00%", "100% 원문 직결"])
    set_speaker_notes(s02_wealth, """[도발적 질문 Hook]
"월급 빼고 다 오르는 고물가 시대, 가만히 숨만 쉬고 있어도 내 통장의 실질 구매력은 어떻게 변할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '인플레이션'이란 시간이 흐를수록 돈의 가치가 녹아내리는 현상이고, '복리의 마법'은 우량 기업의 성장에 편승해 내 자산을 지키는 생존 공식입니다."

[시각 요소 지시어]
"화면의 3대 시각 로드맵을 보십시오.
첫째, 좌측 붉은색 '화폐 가치 하락 그래프'입니다. 10년 전 100이던 현금 가치가 현재 54, 10년 뒤 28로 무려 -72% 폭락합니다. 가만히 있으면 실질 자산은 증발합니다.
둘째, 가운데 거짓말하면 코가 늘어나는 '피노키오'를 보십시오. 300쪽 공시가 어렵다고 유튜브 찌라시나 시중 생성 AI에 물어보면, 피노키오처럼 가짜 숫자를 지어내는 환각 때문에 소중한 원금을 날리게 됩니다.
셋째, 우측 'DART Insight 팩트 비서'를 보십시오. 저희는 소문이나 생성 AI의 거짓말이 아니라, 100% 공인 원문 직결과 수치 환각 0.00%로 안전하게 자산을 지키는 스마트 재테크 AI 비서입니다."

[숫자 타격감 마무리]
"현금 실질 가치 -72% 폭락의 위기를 수치 환각 0.00%의 100% DART 공인 팩트 직결로 해결했습니다!"
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

    # 하단 팩트 포인트
    tb_sec_pt = s02.shapes.add_textbox(Inches(1.0), Inches(4.18), Inches(5.25), Inches(0.95))
    tf_sec_pt = tb_sec_pt.text_frame; tf_sec_pt.word_wrap = True
    tf_sec_pt.margin_left = tf_sec_pt.margin_top = tf_sec_pt.margin_right = tf_sec_pt.margin_bottom = 0
    p_pt1 = tf_sec_pt.paragraphs[0]
    p_pt1.text = "• 풍문 종결: 수많은 찌라시 속에서 SEC Form 8-K로 전 세계 시장 최종 확정"
    p_pt1.font.name = FONT_BODY; p_pt1.font.size = Pt(9); p_pt1.font.color.rgb = LIGHT_TEXT_BODY
    p_pt1.space_after = Pt(2)
    p_pt2 = tf_sec_pt.add_paragraph()
    p_pt2.text = "• 시장 반영: 공시 접수 즉시 시간외 주가 -10% 급변 (법적 효력 증명)"
    p_pt2.font.name = FONT_BODY; p_pt2.font.size = Pt(9); p_pt2.font.color.rgb = LIGHT_TEXT_BODY
    p_pt2.space_after = Pt(4)
    p_pt3 = tf_sec_pt.add_paragraph()
    p_pt3.text = "✓ 법적 구속력을 지닌 공식 공시 단 1장이 전 세계 시장을 결정"
    p_pt3.font.name = FONT_BODY; p_pt3.font.size = Pt(9); p_pt3.font.bold = True; p_pt3.font.color.rgb = RGBColor(21, 128, 61)

    # [우측 카드]: 대한민국 전자공시 DART (금융감독원 100% 공인 팩트)
    draw_card(s02, Inches(6.8), Inches(1.65), Inches(5.65), Inches(3.6), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 2.0)
    
    # DART 공식 커버 이미지
    if os.path.exists(dart_img_path):
        draw_card(s02, Inches(7.05), Inches(1.78), Inches(5.15), Inches(1.05), LIGHT_CARD, LIGHT_BORDER, 1.0)
        s02.shapes.add_picture(dart_img_path, Inches(7.15), Inches(1.83), Inches(4.95), Inches(0.95))

    tb_r = s02.shapes.add_textbox(Inches(7.05), Inches(2.95), Inches(5.15), Inches(2.2))
    tf_r = tb_r.text_frame; tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_top = tf_r.margin_right = tf_r.margin_bottom = 0
    p = tf_r.paragraphs[0]
    p.text = "🏛️ 전자공시 DART (금융감독원)"
    p.font.name = FONT_HEADING; p.font.size = Pt(14); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE
    p.space_after = Pt(2)
    p_sub = tf_r.add_paragraph()
    p_sub.text = "국가 공인 법적 100% 팩트 데이터"
    p_sub.font.name = FONT_BODY; p_sub.font.size = Pt(11); p_sub.font.bold = True; p_sub.font.color.rgb = LIGHT_TEXT_PRIMARY
    p_sub.space_after = Pt(8)

    items_r = [
        ("100% 공인 팩트", "자본시장법에 따라 허위 기재 시 형사 처벌을 받는 공식 문서"),
        ("기업의 모든 진실", "5대 재무제표, 경영진 해설(MD&A), 소송·지배구조 원문 수록"),
        ("DART Insight 연동", "OpenDART 공식 API로 1초 만에 원문 수집 및 위변조 방어")
    ]
    for title, desc in items_r:
        p_t = tf_r.add_paragraph()
        p_t.text = f"• {title}: {desc}"
        p_t.font.name = FONT_BODY; p_t.font.size = Pt(9.5); p_t.font.color.rgb = LIGHT_TEXT_BODY
        p_t.space_after = Pt(4)
    p_r_tag = tf_r.add_paragraph()
    p_r_tag.text = "✓ 국가 공인 법적 100% 팩트 · 대한민국 상장사 무결성 보장"
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
    pb2.text = "1️⃣ 공식 OpenDART API 실시간 직결    2️⃣ 요약마다 100% 원문 블록(#접수번호#B블록번호) 직결    3️⃣ 수치 계산은 Java 코드 100% 수행 (AI 환각 원천 차단)"
    pb2.font.name = FONT_BODY; pb2.font.size = Pt(10.5); pb2.font.bold = True; pb2.font.color.rgb = LIGHT_TEXT_PRIMARY

    add_zone_d_proof_bar(s02, 2, TOTAL_SLIDES, metrics_list=["글로벌 SEC Form 8-K 실전 확정", "금융감독원 공인 팩트 100%", "OpenDART API 실시간 직결"])
    set_speaker_notes(s02, """[도발적 질문 Hook]
"여러분, 어제 전 세계를 충격에 빠뜨린 엔비디아 젠슨 황 CEO의 사임 소식처럼, 기업의 명운을 가르는 사건이 터졌을 때 우리는 무엇을 보고 믿어야 할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 전자공시란 '기업이 법에 따라 실적과 사건을 금융당국에 투명하게 공개하는 공식 종합 생활기록부'입니다."

[시각 요소 지시어]
"화면 좌측의 엔비디아 실제 SEC Form 8-K 수시공시를 보십시오. 무수한 풍문과 찌라시가 돌았지만, 전 세계 시장이 팩트로 확정한 단 하나의 근거는 자본시장법 형사 처벌을 받는 바로 이 공시 원문 1장이었습니다.
우측의 금융감독원 DART도 마찬가지입니다. DART Insight는 국내 상장사의 5대 재무제표와 MD&A 등 100% 공인 팩트를 공식 API로 1초 만에 원문 직결합니다."

[숫자 타격감 마무리]
"대표이사 사임부터 재무 수치까지, 수치 환각 0.00%의 법적 공인 팩트로 금융의 신뢰를 완성합니다!"
""")

    # =========================================================================
    # PART 2. 추진 배경 & 사용자 여정 6단계 (Why & Userflow Stepper)
    # =========================================================================
    # SLIDE 03: 추진 배경: 65만 자 공시의 압박과 LLM 환각
    s03 = prs.slides.add_slide(blank_layout)
    set_slide_background(s03, is_dark=False)
    add_zone_a_header(s03, "02 · 추진 배경 및 문제의식", "65만 자 공시 무한 스크롤, 숙련자도 4시간 소모")
    add_zone_b_glossary(s03, "MD&A", "경영진이 숫자의 원인을 해설해 놓은 공식 성적표 해설서")
    # Zone C: 1:1 Split (수작업의 고통 vs 시중 LLM의 한계)
    draw_card(s03, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.5)
    tb_l = s03.shapes.add_textbox(Inches(1.2), Inches(1.9), Inches(4.85), Inches(4.3))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    p = tf_l.paragraphs[0]
    p.text = "❌ 문제 1. 300페이지 수작업 대조의 고통"
    p.font.size = Pt(17); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER
    p.space_after = Pt(14)
    items_l = [
        ("📜 30~65만 자 분량", "정기보고서 한 권이 소설책 4권 분량에 달함"),
        ("⏳ 평균 4시간 소모", "두 개 보고서를 나란히 띄우고 Ctrl+F 반복"),
        ("👁️ 인적 오류 유발", "집중력 저하로 주석 속 핵심 수치 변경 누락"),
        ("📉 리서치 적시성 상실", "분기 마감 시 수백 개 기업의 변화 파악 지연")
    ]
    for h, d in items_l:
        p1 = tf_l.add_paragraph(); p1.text = h; p1.font.bold = True; p1.font.size = Pt(13); p1.font.color.rgb = LIGHT_TEXT_PRIMARY
        p2 = tf_l.add_paragraph(); p2.text = d; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_MUTED; p2.space_after = Pt(8)

    draw_card(s03, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_ATTENTION_TINT, LIGHT_ATTENTION, 1.5)
    tb_r = s03.shapes.add_textbox(Inches(7.28), Inches(1.9), Inches(4.85), Inches(4.3))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    p = tf_r.paragraphs[0]
    p.text = "⚠️ 문제 2. 시중 생성형 AI의 치명적 환각"
    p.font.size = Pt(17); p.font.bold = True; p.font.color.rgb = LIGHT_ATTENTION
    p.space_after = Pt(14)
    items_r = [
        ("🤥 없는 숫자 날조", "영업이익 증감액이나 백분율을 멋대로 계산·왜곡"),
        ("❓ 출처 확인 불능", "어느 페이지, 어느 문단에서 나온 수치인지 알 수 없음"),
        ("⚖️ 자본시장법 위반", "'호재', '저평가' 등 주관적 매수/매도 권유 노출"),
        ("💸 금전적 손실 위험", "잘못된 데이터로 투자 및 여신 의사결정 파실 유발")
    ]
    for h, d in items_r:
        p1 = tf_r.add_paragraph(); p1.text = h; p1.font.bold = True; p1.font.size = Pt(13); p1.font.color.rgb = LIGHT_TEXT_PRIMARY
        p2 = tf_r.add_paragraph(); p2.text = d; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_MUTED; p2.space_after = Pt(8)
    add_zone_d_proof_bar(s03, 3, TOTAL_SLIDES, ["ADR-0008", "ADR-0015"], ["공시 분량 30~65만 자", "수작업 4시간 소모", "수치 환각 차단 필수"])
    set_speaker_notes(s03, """[도발적 질문 Hook]
"성공적인 재테크를 위해 기업을 제대로 분석하고 투자하려는데, 300페이지짜리 공시 문서를 직접 다 읽을 수 있는 사람이 몇 명이나 되겠습니까?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'MD&A'는 경영진이 쓴 성적표 해설서이고, '할루시네이션'은 시중 AI가 숫자를 지어내는 거짓말입니다."

[시각 요소 지시어]
"화면 좌우 카드를 보십시오. 공시를 못 읽어 인터넷 찌라시나 뉴스에 기대어 묻지마 투자를 하거나, 챗GPT의 가짜 숫자를 믿다가 피 같은 투자금을 날리는 비극을 해결해야 했습니다."

[숫자 타격감 마무리]
"내 소중한 자산이 걸린 투자입니다. 수치 환각 0.00%와 5초 팩트 대조로 투자 리스크를 원천 차단했습니다!\"""")

    # Userflow Stepper 6 Steps (Slides 04 ~ 09)
    stepper_names = ["01 탐색", "02 개요", "03 선택", "04 분석", "05 결과", "06 확장"]
    stepper_details = [
        ("회사 검색 및 시즌 Top 10 목록 진입",
         "🔍 [01 탐색] 기능 동작 상세",
         [("초성·종목코드 즉시 검색", "삼성전자, 005930, 'ㅅㅅㅇㅈ' 입력 시 인메모리 트라이 색인으로 즉시 자동완성"),
          ("시총 상위 100 대표 기업", "공공데이터포털 연동으로 KOSPI/KOSDAQ 주요 기업 원클릭 진입 지원"),
          ("시즌 변화 Top 10 랭킹", "정기공시 시즌마다 전년 대비 매출액·영업이익이 급변한 상위 10개사 실시간 집계"),
          ("접수번호 캐시 연동", "한 번 검색된 기업 개황 및 고유번호는 로컬 DB에 캐시되어 지연 0.1초 미만")],
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
          ("동일 보고서 쌍 영구 캐시", "이미 분석된 보고서 쌍은 백엔드 DB에서 0.1초 만에 즉시 결과 재사용"),
          ("미분석 시 5초 고속 처리", "StAX 스트리밍 파싱 + BM25 엔진 + 코드 증감 계산 일괄 진행")],
         "ADR-0004 · 0024 · 0042"),
        ("요약·재무·문장 변화와 W-03 원문 뷰어 점프",
         "🎯 [05 결과] 100% 원문 직결 & 형광펜 점프",
         [("5대 재무제표 100% 계산 대조", "증감액·증감률 및 흑자전환 상태를 코드가 오차 없이 산출"),
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
        add_zone_b_glossary(sn, "연결재무제표" if step_idx < 3 else ("StAX 파서" if step_idx == 4 else "단방향 FSM"),
                           "자회사 실적까지 합친 성적표" if step_idx < 3 else ("문서를 한 줄씩 흘려보내는 수도관" if step_idx == 4 else "역주행 불가능 일방통행"))
        
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

        add_zone_d_proof_bar(sn, slide_no, TOTAL_SLIDES, adr_str.split(" · "), ["단계별 자동화", "UI 반응성 100%", "사용자 동선 6단계"])
        set_speaker_notes(sn, f"""[도발적 질문 Hook]
"사용자 여정 {step_idx+1}단계 '{stepper_names[step_idx]}' 버튼을 누르면 화면에 무엇이 나타날까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 이 단계는 사용자가 복잡한 공시 정보를 직관적으로 제어할 수 있도록 돕는 핵심 관문입니다."

[시각 요소 지시어]
"상단 세그먼트 버튼의 활성화 표시와 중앙 결과 카드를 보십시오. {headline}이 실시간으로 구동됩니다."

[숫자 타격감 마무리]
"추측할 필요 없이 클릭 한 번으로 모든 상태를 투명하게 확인하는 엔터프라이즈 UX입니다!\"""")

    # =========================================================================
    # PART 3. 핵심 가치 제안 & Before vs After 세그먼트 (Value)
    # =========================================================================
    bna_views = [
        ("전체 보기", "수작업 4시간과 환각을 5초 대조와 100% 원문으로 전환",
         [("소요 시간", "보고서 1쌍 대조 시 평균 2~3시간 소요"),
          ("대조 범위", "물리적 한계로 주요 재무 몇 줄만 확인하고 본문 포기"),
          ("환각 위험", "시중 LLM이 없는 숫자를 계산하거나 임의로 지어냄"),
          ("출처 확인", "어느 문단에서 나온 설명인지 원문 검색 불가")],
         [("소요 시간", "단 5초 만에 전수 대조 및 구조화 완료 (95% 단축)"),
          ("대조 범위", "5대 재무제표 + 본문 문단 + 표 셀 + 수시공시 전수 분석"),
          ("환각 제로", "증감은 코드가 100% 계산, LLM은 원문 요약만 담당"),
          ("100% 원문", "모든 문장에 #{접수번호}#B{n} 직결, 클릭 즉시 확인")]),
        ("속도 중심", "소요 시간 4시간에서 5초로 95% 단축",
         [("수작업 대조", "30~65만 자 본문을 일일이 스크롤하며 수작업 대조 (평균 2~3시간 소요)"),
          ("자료 준비", "DART 전자공시에서 압축본을 내려받아 표를 엑셀에 손으로 재입력"),
          ("병목 현상", "분기 마감 시 수백 개 기업의 변화를 제때 파악하지 못해 의사결정 지연")],
         [("단 5초 완료", "단 5초 만에 5대 재무제표 + 본문 + 표 차이 일괄 산출 (95% 이상 단축)"),
          ("단일 창구", "OpenDART 19개 API 단일 창구 + 접수번호 영구 캐시로 즉시 로딩"),
          ("실시간 큐", "비동기 작업 큐로 시즌 변화 Top 10까지 실시간 파악")]),
        ("신뢰 중심", "수치 날조 0%와 100% 원문 직결 및 규제 준수",
         [("수치 오류", "계산을 LLM에 맡겨 잘못된 증감액과 거짓 백분율이 빈번하게 발생"),
          ("허위 근거", "본문에 전혀 없는 가짜 출처 문장을 지어내 금융 리서치 신뢰도 훼손"),
          ("가치 판단", "'호재', '저평가' 등 규제에 어긋나는 주관적 매수/매도 권유 노출")],
         [("수치 무결성", "코드가 100% 증감 계산, LLM은 계산된 수치를 바탕으로 설명만 작성"),
          ("100% 원문", "모든 문장에 #{접수번호}#B{n} 딥링크 부여, 미통과 시 최대 2회 재생성"),
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

        add_zone_d_proof_bar(sb, slide_no, TOTAL_SLIDES, ["ADR-0004", "ADR-0008", "ADR-0015"], ["대조 5초 완성", "환각 0.00%", "원문 근거율 100%"])
        set_speaker_notes(sb, f"""[도발적 질문 Hook]
"핵심 가치 탭에서 '{bna_label}' 버튼을 눌렀을 때, 업무 효율은 얼마나 급상승할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '할루시네이션'이란 금융에서 절대로 허용될 수 없는 AI의 거짓말입니다."

[시각 요소 지시어]
"화면 좌측의 붉은색 Before 카드와 우측 녹색 After 카드를 직접 비교해 보십시오. {bna_headline}의 변화가 확연합니다."

[숫자 타격감 마무리]
"4시간의 단순 노동을 5초로 압축하고 신뢰도를 100%로 끌어올린 혁신입니다!\"""")

    # =========================================================================
    # PART 4. 5대 엔지니어링 난제 해결 (Solution)
    # =========================================================================
    tech_challenges = [
        ("StAX XML 스트리밍 파서", "50MB 비정형 XML을 메모리 80MB O(1)로 스트리밍",
         "StAX 파서", "50MB 문서를 한 줄씩 흘려보내 메모리를 아끼는 수도관",
         "ADR-0008", ["메모리 복잡도 O(1)", "Heap 80MB 고정", "10만+ 토큰 무오류"],
         "기존 DOM 트리 전체 적재 시 500MB 메모리 폭발(OOM)",
         "StAX 커서 스트리밍으로 한 줄씩 파싱하여 80MB 상수로 고정"),
        ("2-gram 인메모리 BM25 엔진", "300페이지에서 2글자 단위로 45ms 만에 근거 추출",
         "2-gram BM25", "300페이지에서 2글자 단위로 45ms 만에 근거를 찾는 탐지기",
         "ADR-0036", ["검색 지연 45ms", "최소 길이 40자", "MD&A 가중치 1.5배"],
         "무거운 외부 벡터 DB 의존 시 임베딩 비용과 지연 발생",
         "수식 30줄 직접 구현, 2글자 토큰화 및 경영진단 1.5배 가중치로 45ms 초고속 추출"),
        ("사실 추출 가드레일", "엄격한 정규식으로 사실과 의견을 기계적 분리",
         "컴플라이언스", "매수/매도 투자 권유를 막는 법적 안전 차단막",
         "ADR-0064", ["환각률 0.00%", "최대 2회 재생성", "표현 자동 검사 100%"],
         "생성형 AI가 존재하지 않는 사실을 지어내거나 주관적 매수 권유",
         "원문 블록 ID 없으면 즉시 기각, 금지어 6종 정규식 검사, 미등록 용어 경고 강제 부착"),
        ("단방향 FSM 상태 제어", "PENDING→RUNNING→COMPLETED 일방통행 보장",
         "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길",
         "ADR-0004", ["허용 경로 4개", "비인가 전이 차단 100%", "원자 트랜잭션 보장"],
         "비동기 작업 중 네트워크 단절이나 예외 시 화면에 비정상 완료 노출 위험",
         "결과가 DB에 완전히 저장되기 전에는 완료 전이 불가, 비인가 전이 원천 차단"),
        ("2-Tier 듀얼 라우팅", "Haiku 도구 선택 → Sonnet 작성, 비용 95% 절감",
         "ADR", "코드를 짜기 전 '왜 이 기술을 골랐는지' 남긴 67개의 설계 판결문",
         "ADR-0063", ["API 비용 95% 절감", "호출당 $0.0009", "동시성 4.2배 확장"],
         "모든 채팅 단계에 고비용 대형 모델 사용 시 호출당 $0.0168 폭증",
         "단순 도구 선택과 초안은 초경량 모델, 심층 작성만 상위 모델로 라우팅")
    ]

    for tc_idx, (tc_name, tc_headline, term, metaphor, adr, metrics, prob, sol) in enumerate(tech_challenges):
        slide_no = 12 + tc_idx
        st = prs.slides.add_slide(blank_layout)
        set_slide_background(st, is_dark=False)
        add_zone_a_header(st, f"04 · 5대 엔지니어링 난제 {tc_idx+1}/5", tc_headline)
        add_zone_b_glossary(st, term, metaphor)

        # Zone C: Problem vs Solution Card
        draw_card(st, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        tb_p = st.shapes.add_textbox(Inches(1.1), Inches(1.9), Inches(5.05), Inches(4.3))
        tf_p = tb_p.text_frame; tf_p.word_wrap = True
        p = tf_p.paragraphs[0]; p.text = f"🔥 난제 {tc_idx+1}: 기존 방식의 기술적 한계"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER; p.space_after = Pt(12)
        p1 = tf_p.add_paragraph(); p1.text = prob; p1.font.size = Pt(13); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(14)
        p2 = tf_p.add_paragraph(); p2.text = "⚠️ 발생 리스크:"; p2.font.bold = True; p2.font.size = Pt(12); p2.font.color.rgb = LIGHT_ATTENTION
        p3 = tf_p.add_paragraph(); p3.text = "• 서버 메모리 고갈 또는 API 비용 감당 불가\n• 금융 규제 위반 및 플랫폼 신뢰성 훼손"; p3.font.size = Pt(11.5); p3.font.color.rgb = LIGHT_TEXT_MUTED

        draw_card(st, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.5)
        tb_s = st.shapes.add_textbox(Inches(7.18), Inches(1.9), Inches(5.05), Inches(4.3))
        tf_s = tb_s.text_frame; tf_s.word_wrap = True
        p = tf_s.paragraphs[0]; p.text = f"💡 DART Insight 아키텍처 돌파구"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(12)
        p1 = tf_s.add_paragraph(); p1.text = sol; p1.font.size = Pt(13); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(14)
        p2 = tf_s.add_paragraph(); p2.text = "✨ 입증된 성과 지표:"; p2.font.bold = True; p2.font.size = Pt(12); p2.font.color.rgb = LIGHT_POSITIVE
        p3 = tf_s.add_paragraph(); p3.text = f"• {metrics[0]}\n• {metrics[1]}\n• {metrics[2]}"; p3.font.size = Pt(11.5); p3.font.color.rgb = LIGHT_TEXT_MUTED

        add_zone_d_proof_bar(st, slide_no, TOTAL_SLIDES, [adr], metrics)
        set_speaker_notes(st, f"""[도발적 질문 Hook]
"{tc_name} 문제, 일반적인 방법으로는 왜 해결이 안 되었을까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '{term}'이란 {metaphor}입니다."

[시각 요소 지시어]
"화면 좌우 카드를 보십시오. 기술적 타협 없이 아키텍처 수준에서 문제를 정면 돌파했습니다."

[숫자 타격감 마무리]
"{metrics[0]}, {metrics[1]}을 코드로 증명해 냈습니다!\"""")

    # =========================================================================
    # PART 5. 공시 분석 & 분석 방법과 기준 (Activity & Methods)
    # =========================================================================
    # SLIDE 17: 공시 분석 (삼성전자 실례)
    s17 = prs.slides.add_slide(blank_layout)
    set_slide_background(s17, is_dark=False)
    add_zone_a_header(s17, "05 · 공시 분석 실전", "두 정기보고서 사이 활동을 타임라인과 영향으로 요약")
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
    add_zone_d_proof_bar(s17, 18, TOTAL_SLIDES, ["ADR-0050", "ADR-0065", "ADR-0066"], ["24건 수시공시 매칭", "코드 기준표 신호", "원문 근거 100%"])
    set_speaker_notes(s17, """[도발적 질문 Hook]
"두 정기보고서 사이에 이 회사가 도대체 무슨 일을 벌였는지 1분 만에 파악할 수 있을까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 정기공시가 정기 건강검진표라면, 수시공시는 그 사이 터진 응급 속보입니다."

[시각 요소 지시어]
"화면 좌측의 24건 타임라인과 우측의 사실·영향 카드를 보십시오. 긍정·주의 신호는 AI가 아닌 승인된 코드 기준표가 100% 부여합니다."

[숫자 타격감 마무리]
"파편화된 1년 치 공시를 단 하나의 스토리라인으로 완벽히 꿰뚫어 줍니다!\"""")

    # SLIDE 18: 분석 방법과 기준 -> 4단계 팩트 검증 기준
    s18 = prs.slides.add_slide(blank_layout)
    set_slide_background(s18, is_dark=False)
    add_zone_a_header(s18, "05 · 4단계 검증 기준", "코드 기반 4단계 팩트 검증 파이프라인")
    add_zone_b_glossary(s18, "4대 판정 규칙", "13가지 수치 사유 코드화 & 컴플라이언스 6대 금지어 필터")
    # Zone C: 4 Rule Cards
    rules = [
        ("01. 비교 조건 검증", "동일 기업(corp_code), 기간 선후, 연결/별도 기준, 통화(KRW) 일치 확인 후 비교 진행", LIGHT_PURPLE),
        ("02. 재무 수치 증감", "코드가 증감액·증감률 계산, 흑자전환·이전값 0 등은 13가지 사유 코드로 명확히 기록", LIGHT_POSITIVE),
        ("03. 문장 변화 5대 분류", "숫자를 가린 글을 맞춰 추가, 삭제, 수정, 숫자만 바뀜, 위치 이동으로 정밀 분류", LIGHT_ATTENTION),
        ("04. 근거 가드레일 & 표현", "모든 문장에 원문 블록 ID 필수, 최대 2회 재생성, 6대 가치판단 금지표현 자동 차단", LIGHT_DANGER)
    ]
    for i, (rtitle, rdesc, rcol) in enumerate(rules):
        rx = Inches(0.8) + Inches(2.98) * i
        draw_card(s18, rx, Inches(1.65), Inches(2.8), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        tb_r = s18.shapes.add_textbox(rx + Inches(0.2), Inches(1.85), Inches(2.4), Inches(4.3))
        tf_r = tb_r.text_frame; tf_r.word_wrap = True
        p = tf_r.paragraphs[0]; p.text = rtitle; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = rcol; p.space_after = Pt(10)
        p1 = tf_r.add_paragraph(); p1.text = rdesc; p1.font.size = Pt(11.5); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(10)
        p2 = tf_r.add_paragraph(); p2.text = "✓ 코드 강제 원칙\n✓ 무결성 보증"; p2.font.size = Pt(10.5); p2.font.color.rgb = LIGHT_TEXT_MUTED
    add_zone_d_proof_bar(s18, 19, TOTAL_SLIDES, ["ADR-0004", "ADR-0036", "AGENTS.md"], ["13가지 사유 코드", "5대 문장 분류", "표현 검사 100% 통과"])
    set_speaker_notes(s18, """[도발적 질문 Hook]
"AI에게 분석을 맡기는 것과, 코드 규칙이 분석을 지배하는 것의 차이는 무엇일까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 합격했는지 기계적으로 판정하는 채점표입니다."

[시각 요소 지시어]
"화면의 4개 규칙 카드를 보십시오. 조건 검증부터 수치 증감, 문장 변화, 표현 가드레일까지 분석의 전 과정이 코드의 규칙으로 묶여 있습니다."

[숫자 타격감 마무리]
"13가지 증감 사유 코드화와 가치판단 0건으로 금융 규제를 100% 준수합니다!\"""")

    # =========================================================================
    # PART 6. 사용자 임팩트 (Impact)
    # =========================================================================
    # SLIDE 19: 사용자 임팩트
    s19 = prs.slides.add_slide(blank_layout)
    set_slide_background(s19, is_dark=False)
    add_zone_a_header(s19, "07 · 사용자 임팩트 & 접근성", "초보 투자자부터 전문 분석가까지 정보 장벽 해소")
    add_zone_b_glossary(s19, "WCAG", "장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트")
    # Zone C: 3 Persona Bento
    personas = [
        ("주식 초보 투자자", "난해한 공시 용어 장벽 완전 해소",
         "• 50종 금융 전문 용어 실시간 마우스 툴팁 카드\n• 객관적 사실 기반의 3줄 핵심 AI 브리핑\n• 어려운 공시도 3분 만에 핵심 파악 완료", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("전문 애널리스트", "기업 신뢰도 및 공약 이행 검증",
         "• '작년 사업 공약 vs 금년도 실제 이행' 1:1 대조 매트릭스\n• 5대 재무제표 전체 엑셀/CSV 추출 지원\n• 기업 분석 리서치 시간 90% 단축", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("품질 & 웹 표준", "누구나 차별 없이 쓰는 접근성",
         "• 4,405개 자동화 테스트 100% 통과 무결성\n• axe-core 웹 접근성 0개 위반 (WCAG 2.1 AA)\n• 다크모드 완비 및 키보드 완전 탐색 지원", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT)
    ]
    for i, (pname, psub, pbody, pcol, ptint) in enumerate(personas):
        px = Inches(0.8) + Inches(3.98) * i
        draw_card(s19, px, Inches(1.65), Inches(3.8), Inches(4.85), ptint, pcol, 1.5)
        tb_p = s19.shapes.add_textbox(px + Inches(0.25), Inches(1.85), Inches(3.3), Inches(4.3))
        tf_p = tb_p.text_frame; tf_p.word_wrap = True
        p = tf_p.paragraphs[0]; p.text = pname; p.font.size = Pt(17); p.font.bold = True; p.font.color.rgb = pcol; p.space_after = Pt(4)
        p0 = tf_p.add_paragraph(); p0.text = psub; p0.font.size = Pt(12); p0.font.bold = True; p0.font.color.rgb = LIGHT_TEXT_PRIMARY; p0.space_after = Pt(12)
        p1 = tf_p.add_paragraph(); p1.text = pbody; p1.font.size = Pt(11.5); p1.font.color.rgb = LIGHT_TEXT_BODY
    add_zone_d_proof_bar(s19, 20, TOTAL_SLIDES, ["FS-53", "FS-60", "FS-69"], ["용어 툴팁 50종", "리서치 90% 단축", "axe-core 위반 0건"])
    set_speaker_notes(s19, """[도발적 질문 Hook]
"주식 초보자와 전문 분석가가 같은 화면에서 모두 만족할 수 있을까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'WCAG'는 장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트입니다."

[시각 요소 지시어]
"화면의 3대 사용자 임팩트 카드를 보십시오. 초보자에게는 50개 용어 툴팁을, 전문가에게는 약속-이행 대조표를, 시스템 전체에는 4,405개 테스트 무결성을 제공합니다."

[숫자 타격감 마무리]
"리서치 시간 90% 단축과 접근성 위반 0건으로 정보의 격차를 완벽히 해소했습니다!\"""")

    # =========================================================================
    # PART 7. 아키텍처 & 데이터 파이프라인 (Stack & Architecture)
    # =========================================================================
    # SLIDE 20: 4-Tier 아키텍처 (Dark Theme)
    s20 = prs.slides.add_slide(blank_layout)
    set_slide_background(s20, is_dark=True)
    add_zone_a_header(s20, "08 · 시스템 아키텍처", "React → Spring Boot → FastAPI 단방향 계층 분리", is_dark=True)
    add_zone_b_glossary(s20, "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길", is_dark=True)
    # Zone C: 4-Tier Conveyor Box
    tiers = [
        ("화면 (React 19)", "TypeScript · SPA\n공개 API만 호출\n1,907개 자동 테스트", DARK_PURPLE, DARK_PURPLE_TINT),
        ("백엔드 (Spring Boot 4.1)", "Java 21 · 중심 허브\nOpenDART 캐시 관리\n에이전트 24개 Tool 실행", RGBColor(100, 200, 255), RGBColor(20, 40, 70)),
        ("AI 서버 (FastAPI)", "Python 3.12 · 무상태\nStAX 파서 · BM25 엔진\nLangGraph 1단계 실행", RGBColor(120, 230, 160), RGBColor(20, 60, 40)),
        ("운영 DB (MariaDB 11.4)", "57개 테이블 영속화\nFlyway V1~V52 검증\n고유번호/접수번호 색인", RGBColor(255, 180, 100), RGBColor(60, 40, 20))
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
    add_zone_d_proof_bar(s20, 21, TOTAL_SLIDES, ["ADR-0002", "ADR-0004", "ADR-0052"], ["ArchUnit 검증 100%", "계층 침범 0건", "X-Trace-Id 분산추적"], is_dark=True)
    set_speaker_notes(s20, """[도발적 질문 Hook]
"수많은 개발자가 협업하는 대규모 금융 프로젝트에서 어떻게 스파게티 코드를 원천 차단했을까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 시스템 호출 역시 단 한 방향으로만 흘러야 상태가 꼬이지 않습니다."

[시각 요소 지시어]
"화면의 4-Tier 아키텍처를 보십시오. React는 오직 Spring Boot만 바라보며, FastAPI와 MariaDB는 내부망에 안전하게 격리되어 있습니다."

[숫자 타격감 마무리]
"ArchUnit 아키텍처 테스트로 경계 침범 0건을 기계적으로 강제했습니다!\"""")

    # SLIDE 21: 데이터 파이프라인 & 캐시 전략 (Dark Theme)
    s21 = prs.slides.add_slide(blank_layout)
    set_slide_background(s21, is_dark=True)
    add_zone_a_header(s21, "09 · 데이터 파이프라인", "접수번호 영구 캐시로 일일 2만 회 한도 영구 방어", is_dark=True)
    add_zone_b_glossary(s21, "MCP 서버", "외부 AI가 우리 공시 데이터를 안전하게 읽는 전용 플러그인", is_dark=True)
    # Zone C: Cache Strategy Diagram
    draw_card(s21, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), DARK_CARD, DARK_BORDER, 1.5)
    tb_c1 = s21.shapes.add_textbox(Inches(1.1), Inches(1.9), Inches(5.05), Inches(4.3))
    tf_c1 = tb_c1.text_frame; tf_c1.word_wrap = True
    p = tf_c1.paragraphs[0]; p.text = "📦 OpenDART 2단계 캐시 정책"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = DARK_PURPLE; p.space_after = Pt(10)
    p1 = tf_c1.add_paragraph(); p1.text = "• 보고서 귀속 자료 (접수번호 키): 영구 캐시 정책으로 재호출 0건 보장\n• 기업개황 및 공시목록: 24시간 주기 갱신, stale 캐시로 장애 격리\n• 일일 호출 한도(2만 회) 소진 위험 0% 방어"; p1.font.size = Pt(12); p1.font.color.rgb = DARK_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_c1.add_paragraph(); p2.text = "⚡ 캐시 히트 시 응답 지연: 단 0.1초 미만"; p2.font.bold = True; p2.font.size = Pt(13); p2.font.color.rgb = RGBColor(120, 230, 160)

    draw_card(s21, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), DARK_CARD_RAISED, DARK_BORDER, 1.5)
    tb_c2 = s21.shapes.add_textbox(Inches(7.18), Inches(1.9), Inches(5.05), Inches(4.3))
    tf_c2 = tb_c2.text_frame; tf_c2.word_wrap = True
    p = tf_c2.paragraphs[0]; p.text = "🔌 독립 MCP 서버 연동 (ADR-0052)"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = RGBColor(100, 200, 255); p.space_after = Pt(10)
    p1 = tf_c2.add_paragraph(); p1.text = "• 외부 AI 에이전트를 위한 읽기 전용 7대 도구 제공\n• Spring Boot 공개 API만 경유하여 원본 DB 직접 접근 원천 차단\n• 내부 서비스와 동일한 권한 및 일일 쿼터 규칙 적용"; p1.font.size = Pt(12); p1.font.color.rgb = DARK_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_c2.add_paragraph(); p2.text = "🛡️ 외부 AI 침입 위험 0%의 안전한 확장성"; p2.font.bold = True; p2.font.size = Pt(13); p2.font.color.rgb = RGBColor(120, 230, 160)
    add_zone_d_proof_bar(s21, 22, TOTAL_SLIDES, ["ADR-0024", "ADR-0046", "ADR-0052"], ["외부 재호출 0건", "캐시 응답 0.1s", "읽기 도구 7종"], is_dark=True)
    set_speaker_notes(s21, """[도발적 질문 Hook]
"OpenDART의 하루 호출 한도가 2만 회인데, 수만 명이 동시 접속하면 서비스가 멈출까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'MCP 서버'란 외부 AI가 안전하게 데이터를 가져갈 수 있도록 만든 전용 플러그인입니다."

[시각 요소 지시어]
"화면 좌우 카드를 보십시오. 접수번호 영구 캐시로 일일 한도를 완벽히 방어하고, 외부 AI 연동까지 읽기 전용으로 안전하게 구축했습니다."

[숫자 타격감 마무리]
"캐시 응답 지연 0.1초와 외부 장애 격리 100%를 달성했습니다!\"""")

    # =========================================================================
    # PART 8. 핵심 설계 인터랙티브 시뮬레이터 (Decisions: 버튼 클릭별 상태 분기!)
    # =========================================================================
    # Sim 1: FSM State Machine (Slides 22 ~ 24)
    fsm_steps = [
        ("작업 시작 클릭", "PENDING에서 RUNNING으로 정상 전이 진행", 0,
         "RUNNING", 55, "✓ 진행 중: 공시를 받고 비교한 뒤 AI 요약을 만듭니다.", LIGHT_PURPLE),
        ("결과 저장 후 완료 클릭", "결과 저장이 100% 끝난 뒤에만 COMPLETED 전이", 1,
         "COMPLETED", 100, "✓ 결과를 모두 저장했으므로 COMPLETED로 바꿨습니다. 화면이 결과를 불러옵니다.", LIGHT_POSITIVE),
        ("역방향 전이 시험 클릭", "COMPLETED에서 RUNNING으로의 역방향 전이 원천 차단", 3,
         "COMPLETED (차단 유지)", 100, "⚠️ COMPLETED → RUNNING은 전이표에 없는 경로여서 현재 상태를 지킵니다. (비인가 전이 차단 100%)", LIGHT_DANGER)
    ]
    fsm_btn_labels = ["작업 시작", "결과 저장 후 완료", "종료 상태 확인", "역방향 전이 시험", "처음으로"]

    for f_idx, (f_name, f_headline, active_btn_idx, cur_state, bar_w, callout_msg, msg_col) in enumerate(fsm_steps):
        slide_no = 22 + f_idx
        sf = prs.slides.add_slide(blank_layout)
        set_slide_background(sf, is_dark=False)
        add_zone_a_header(sf, f"10 · 설계 시뮬레이터 1 · FSM 상태전이", f"{f_headline}")
        add_zone_b_glossary(sf, "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길")

        # Zone C: Interactive Widget
        draw_card(sf, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        
        # Segment Buttons Bar
        draw_segmented_bar(sf, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.42), fsm_btn_labels, active_btn_idx, is_dark=False)

        # Diagram State Nodes
        states = ["PENDING", "RUNNING", "COMPLETED", "FAILED"]
        for s_i, st_name in enumerate(states):
            sx = Inches(1.5) + Inches(2.6) * s_i
            is_cur = (st_name in cur_state)
            snode = sf.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, sx, Inches(2.7), Inches(2.1), Inches(0.7))
            snode.fill.solid()
            snode.fill.fore_color.rgb = msg_col if is_cur else LIGHT_CARD
            snode.line.color.rgb = msg_col if is_cur else LIGHT_BORDER_STR
            snode.line.width = Pt(2 if is_cur else 1)
            tb = snode.text_frame; tb.paragraphs[0].alignment = PP_ALIGN.CENTER
            tb.paragraphs[0].text = st_name
            tb.paragraphs[0].font.name = FONT_HEADING
            tb.paragraphs[0].font.size = Pt(13)
            tb.paragraphs[0].font.bold = True
            tb.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255) if is_cur else LIGHT_TEXT_PRIMARY

        # Progress Bar
        bar_bg = sf.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.5), Inches(3.7), Inches(10.3), Inches(0.18))
        bar_bg.fill.solid(); bar_bg.fill.fore_color.rgb = LIGHT_BORDER; bar_bg.line.fill.background()
        bar_fill = sf.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.5), Inches(3.7), Inches(10.3 * (bar_w / 100.0)), Inches(0.18))
        bar_fill.fill.solid(); bar_fill.fill.fore_color.rgb = msg_col; bar_fill.line.fill.background()

        # Output Callout Box
        callout = sf.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(4.2), Inches(10.3), Inches(1.8))
        callout.fill.solid()
        callout.fill.fore_color.rgb = LIGHT_DANGER_TINT if "⚠️" in callout_msg else (LIGHT_POSITIVE_TINT if "결과" in callout_msg else LIGHT_PURPLE_TINT)
        callout.line.color.rgb = msg_col
        callout.line.width = Pt(1.5)
        tb_c = sf.shapes.add_textbox(Inches(1.8), Inches(4.4), Inches(9.7), Inches(1.4))
        tf_c = tb_c.text_frame; tf_c.word_wrap = True
        p = tf_c.paragraphs[0]; p.text = f"실행 결과 (상태: {cur_state})"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = msg_col; p.space_after = Pt(6)
        p1 = tf_c.add_paragraph(); p1.text = callout_msg; p1.font.size = Pt(13); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY

        add_zone_d_proof_bar(sf, slide_no, TOTAL_SLIDES, ["ADR-0004", "ADR-0042"], ["진행률: " + str(bar_w) + "%", "허용 전이만 실행", "비인가 차단 100%"])
        set_speaker_notes(sf, f"""[도발적 질문 Hook]
"FSM 시뮬레이터에서 '{f_name}' 버튼을 누르면 코드는 상태 전이를 어떻게 검증할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '단방향 FSM'은 기차길처럼 오직 정해진 방향으로만 전진합니다."

[시각 요소 지시어]
"화면 중앙의 전이 노드와 하단 실행 결과 박스를 보십시오. {callout_msg}"

[숫자 타격감 마무리]
"비인가 역방향 전이 차단율 100%로 데이터 누수를 원천 차단했습니다!\"""")

    # Sim 2: AI Trust 4 Principles (Slides 25 ~ 28)
    principles_data = [
        ("숫자는 코드가 계산", "증감액과 증감률은 100% 백엔드 코드가 계산",
         "예: 매출액 증감률 계산 로직",
         "증감액과 증감률은 백엔드 코드가 계산하고, 이전 값이 null이거나 0이면 계산 대신 명확한 13가지 사유 코드를 남깁니다.\nAI 프롬프트에는 계산된 값이 그대로 들어가며, AI가 직접 숫자를 연산하지 못하도록 원천 차단합니다.",
         LIGHT_POSITIVE),
        ("근거가 확인된 문장만 노출", "모든 문장에 {접수번호}#B{블록번호} 근거 필수",
         "예: 원문 근거 ID 무결성 검증",
         "문장마다 {접수번호}#B{블록번호} 형식의 근거 ID가 부여되어야 하며, 해당 분석에 전달된 실제 원문 문단인지 백엔드가 재확인합니다.\n근거가 없는 문장은 결과에서 즉시 탈락됩니다.",
         LIGHT_PURPLE),
        ("검증 상태는 투명하게", "기준 미달 시 2회 재생성 후 '검토 필요'로 안내",
         "예: 최대 2회 재생성 및 투명 안내",
         "형식 및 근거 기준을 통과하지 못하면 최대 2번까지 자동으로 다시 다듬습니다.\n그래도 확인이 필요한 항목은 실패를 성공으로 위장하지 않고 '검토 필요' 배지와 원문 요약으로 솔직하게 안내합니다.",
         LIGHT_ATTENTION),
        ("객관적인 사실만 전달", "공시 원문 구분 태그 격리 및 6대 금지어 자동 점검",
         "예: 컴플라이언스 표현 자동 검사",
         "공시 원문은 구분 태그로 감싼 자료로만 주입합니다. '호재', '저평가', '매수/매도 권유' 같은 표현이 없는지 6대 정규식으로 자동 점검합니다.\n미등록 금융 용어는 코드가 경고를 부착하는 일반 설명만 예외 허용합니다(ADR-0064).",
         LIGHT_DANGER)
    ]
    p_btn_labels = ["1. 숫자는 코드가 계산", "2. 근거 확인 문장만 노출", "3. 검증 상태는 투명하게", "4. 객관적인 사실만 전달"]

    for p_idx, (p_name, p_headline, ex_title, ex_body, p_col) in enumerate(principles_data):
        slide_no = 26 + p_idx
        sp = prs.slides.add_slide(blank_layout)
        set_slide_background(sp, is_dark=False)
        add_zone_a_header(sp, f"10 · 설계 시뮬레이터 2 · AI 신뢰 원칙", p_headline)
        add_zone_b_glossary(sp, "할루시네이션", "AI가 그럴듯하게 숫자를 지어내는 거짓말")

        # Zone C
        draw_card(sp, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        draw_segmented_bar(sp, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.42), p_btn_labels, p_idx, is_dark=False)

        # Active Principle Box
        callout = sp.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(2.6), Inches(10.933), Inches(3.55))
        callout.fill.solid(); callout.fill.fore_color.rgb = LIGHT_PURPLE_TINT if p_col == LIGHT_PURPLE else (LIGHT_POSITIVE_TINT if p_col == LIGHT_POSITIVE else (LIGHT_ATTENTION_TINT if p_col == LIGHT_ATTENTION else LIGHT_DANGER_TINT))
        callout.line.color.rgb = p_col; callout.line.width = Pt(1.5)

        tb_p = sp.shapes.add_textbox(Inches(1.5), Inches(2.85), Inches(10.3), Inches(3.0))
        tf_p = tb_p.text_frame; tf_p.word_wrap = True
        p = tf_p.paragraphs[0]; p.text = ex_title; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = p_col; p.space_after = Pt(10)
        p1 = tf_p.add_paragraph(); p1.text = ex_body; p1.font.size = Pt(13); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(14)
        p2 = tf_p.add_paragraph(); p2.text = "✓ AGENTS.md 헌장 강제  •  ✓ 위반 시 PR 빌드 차단"; p2.font.bold = True; p2.font.size = Pt(11.5); p2.font.color.rgb = p_col

        add_zone_d_proof_bar(sp, slide_no, TOTAL_SLIDES, ["ADR-0060", "ADR-0064", "AGENTS.md"], ["환각률 0.00%", "원문 일치 100%", "표현 위반 0건"])
        set_speaker_notes(sp, f"""[도발적 질문 Hook]
"AI 신뢰 4대 원칙 중 '{p_name}' 버튼을 누르면 실제 코드는 어떻게 작동할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 금융에서는 0.01%의 환각도 치명적인 리스크입니다."

[시각 요소 지시어]
"화면의 활성화 버튼과 세부 검증 로직 박스를 보십시오. {ex_title}을 코드가 빈틈없이 통제합니다."

[숫자 타격감 마무리]
"숫자는 코드가, 요약은 AI가! 이 철학으로 환각률을 0.00%로 영구 고정했습니다!\"""")

    # Sim 3: BM25 Minimum Length Slider (Slide 29)
    s29 = prs.slides.add_slide(blank_layout)
    set_slide_background(s29, is_dark=False)
    add_zone_a_header(s29, "10 · 설계 시뮬레이터 3 · BM25 탐색기", "길이 슬라이더 조작으로 노이즈 문단과 진짜 근거 분리")
    add_zone_b_glossary(s29, "2-gram BM25", "300페이지에서 2글자 단위로 45ms 만에 근거를 찾는 탐지기")
    # Zone C: Slider Simulation
    draw_card(s29, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    # Slider Buttons
    draw_segmented_bar(s29, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.42), ["최소 20자 (노이즈 발생)", "최소 40자 (최적 기준 채택 ✓)", "최소 60자 (결과 동일)"], 1, is_dark=False)
    # Comparison Cards
    draw_card(s29, Inches(1.2), Inches(2.6), Inches(5.2), Inches(3.55), LIGHT_ATTENTION_TINT, LIGHT_ATTENTION, 1.2)
    tb_b1 = s29.shapes.add_textbox(Inches(1.4), Inches(2.8), Inches(4.8), Inches(3.1))
    tf_b1 = tb_b1.text_frame; tf_b1.word_wrap = True
    p = tf_b1.paragraphs[0]; p.text = "⚠️ [20자 이하 설정 시 결과]"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = LIGHT_ATTENTION; p.space_after = Pt(8)
    p1 = tf_b1.add_paragraph(); p1.text = "1위 후보: '※ 출처: IDC 2024년 12월, 매출액 기준'"; p1.font.bold = True; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(8)
    p2 = tf_b1.add_paragraph(); p2.text = "• 문제점: BM25 공식 특성상 글자 수가 매우 짧은 문장을 과대평가하여 단순 출처 주석 한 줄이 1위로 노출되는 노이즈 발생"; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_MUTED

    draw_card(s29, Inches(6.8), Inches(2.6), Inches(5.333), Inches(3.55), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 1.5)
    tb_b2 = s29.shapes.add_textbox(Inches(7.0), Inches(2.8), Inches(4.9), Inches(3.1))
    tf_b2 = tb_b2.text_frame; tf_b2.word_wrap = True
    p = tf_b2.paragraphs[0]; p.text = "✨ [40자 기준 설정 시 결과 - 채택]"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE; p.space_after = Pt(8)
    p1 = tf_b2.add_paragraph(); p1.text = "1위 후보: '당사 매출액은 66조 1,930억원으로, HBM 메모리 공급 확대에 따라 …'"; p1.font.bold = True; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(8)
    p2 = tf_b2.add_paragraph(); p2.text = "• 개선 성과: 단순 주석이 걸러지고 원인 설명이 담긴 경영진단(MD&A) 문단이 정확히 1위로 추출됨\n• 검색 지연: 단 45ms 내 완료"; p2.font.size = Pt(11); p2.font.color.rgb = LIGHT_TEXT_MUTED
    add_zone_d_proof_bar(s29, 30, TOTAL_SLIDES, ["ADR-0036"], ["최소 길이 40자 채택", "검색 지연 45ms", "정확도 100%"])
    set_speaker_notes(s29, """[도발적 질문 Hook]
"검색 엔진에서 검색어만 딱 적힌 짧은 한 줄이 1등으로 올라오는 황당한 경험, 다들 겪어보셨죠?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '2-gram BM25'는 두 글자 단위로 본문을 초고속 검색하는 탐지기입니다."

[시각 요소 지시어]
"화면 좌측의 20자 설정과 우측의 40자 설정을 비교해 보십시오. 40자 필터를 거는 순간 주석 노이즈가 사라지고 진짜 경영진단 설명 문단이 1등으로 올라옵니다."

[숫자 타격감 마무리]
"검색 소요 시간 단 45ms! 벡터 DB 없이 알고리즘 최적화로 완벽한 근거를 찾아냅니다!\"""")

    # Sim 4: Agent Question Pathways (Slides 30 ~ 32)
    ag_scenarios = [
        ("자료가 충분", "받은 공시 자료로 충분할 때 1단계에서 쾌속 응답", 0,
         ["[질문 수신]", "plan (경량 LLM: 답 초안)", "review (코드 검토: 통과)", "ans (답+근거 반환)"],
         "LLM 호출 1번  •  Tool 실행 0번  •  초고속 직행 응답", LIGHT_POSITIVE),
        ("Tool 필요", "추가 재무 추이가 필요하여 백엔드 Tool을 안전하게 경유", 1,
         ["[질문 수신]", "plan (Tool 선택)", "tool (백엔드 재무 Tool 실행)", "plan (답 초안)", "review", "ans"],
         "LLM 호출 2번  •  Tool 실행 1번  •  권한 검증 및 캐시 재사용", LIGHT_PURPLE),
        ("검토 후 다듬기", "숫자 불일치 감지 시 상위 모델로 안전하게 재작성", 2,
         ["[질문 수신]", "plan", "tool (근거 질문)", "review (숫자 재확인 요청)", "write (상위 LLM 재작성)", "review (통과)", "ans"],
         "LLM 호출 3번  •  Tool 실행 1번  •  2단계 정밀 검토로 환각 0% 방어", LIGHT_ATTENTION)
    ]
    ag_btn_labels = ["1. 자료가 충분", "2. Tool 필요", "3. 검토 후 다듬기"]

    for a_idx, (a_name, a_headline, active_btn_idx, path_nodes, log_txt, a_col) in enumerate(ag_scenarios):
        slide_no = 31 + a_idx
        sa = prs.slides.add_slide(blank_layout)
        set_slide_background(sa, is_dark=False)
        add_zone_a_header(sa, f"10 · 설계 시뮬레이터 4 · 에이전트 경로", a_headline)
        add_zone_b_glossary(sa, "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길")

        # Zone C
        draw_card(sa, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
        draw_segmented_bar(sa, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.42), ag_btn_labels, active_btn_idx, is_dark=False)

        # Draw Pipeline Nodes
        n_count = len(path_nodes)
        node_w = (Inches(10.933) - Inches(0.2) * (n_count - 1)) / n_count
        for ni, ntext in enumerate(path_nodes):
            nx = Inches(1.2) + (node_w + Inches(0.2)) * ni
            nd = sa.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, nx, Inches(2.7), node_w, Inches(0.9))
            nd.fill.solid(); nd.fill.fore_color.rgb = a_col if (ni == n_count - 1 or "write" in ntext) else LIGHT_PURPLE_TINT
            nd.line.color.rgb = a_col if (ni == n_count - 1 or "write" in ntext) else LIGHT_PURPLE
            nd.line.width = Pt(1.5)
            tb = nd.text_frame; tb.word_wrap = True
            p = tb.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
            p.text = ntext
            p.font.name = FONT_HEADING; p.font.size = Pt(11); p.font.bold = True
            p.font.color.rgb = RGBColor(255, 255, 255) if (ni == n_count - 1 or "write" in ntext) else LIGHT_TEXT_PRIMARY

        # Execution Log Box
        lbox = sa.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(3.9), Inches(10.933), Inches(2.2))
        lbox.fill.solid(); lbox.fill.fore_color.rgb = LIGHT_CARD; lbox.line.color.rgb = a_col; lbox.line.width = Pt(1.5)
        tb_l = sa.shapes.add_textbox(Inches(1.5), Inches(4.1), Inches(10.3), Inches(1.8))
        tf_l = tb_l.text_frame; tf_l.word_wrap = True
        p = tf_l.paragraphs[0]; p.text = f"실행 요약: {log_txt}"; p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = a_col; p.space_after = Pt(8)
        p1 = tf_l.add_paragraph(); p1.text = "• LangGraph 1단계 무상태 실행으로 서버 부하를 방지하고 단방향 호출 규칙을 엄수합니다.\n• Tool 실행 권한은 오직 백엔드만 가지며, AI 서버는 DB를 직접 열람하지 못합니다."; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY

        add_zone_d_proof_bar(sa, slide_no, TOTAL_SLIDES, ["ADR-0044", "ADR-0045", "ADR-0049"], [log_txt.split("  •  ")[0], "무상태 그래프", "백엔드 Tool 전용"])
        set_speaker_notes(sa, f"""[도발적 질문 Hook]
"에이전트에게 복잡한 질문을 던졌을 때, 상황별로 실행 파이프라인이 어떻게 분기할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 에이전트는 DB를 직접 건드리지 않고, 검증된 백엔드 도구만 호출합니다."

[시각 요소 지시어]
"화면의 '{a_name}' 활성화 노드 흐름도를 보십시오. {a_headline}"

[숫자 타격감 마무리]
"{log_txt}으로 완벽한 무결성과 효율성을 달성했습니다!\"""")

    # Sim 5: 2-Tier LLM Cost Calculator (Slide 33)
    s33 = prs.slides.add_slide(blank_layout)
    set_slide_background(s33, is_dark=False)
    add_zone_a_header(s33, "10 · 설계 시뮬레이터 5 · 비용 계산기", "2-Tier 경량 모델 분리로 API 일일 비용 95% 절감")
    add_zone_b_glossary(s33, "ADR", "코드를 짜기 전 '왜 이 기술을 골랐는지' 남긴 67개의 설계 판결문")
    # Zone C
    draw_card(s33, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    # Slider Display
    draw_card(s33, Inches(1.2), Inches(1.9), Inches(10.933), Inches(0.6), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1)
    tb_sl = s33.shapes.add_textbox(Inches(1.4), Inches(2.0), Inches(10.5), Inches(0.4))
    tb_sl.text_frame.paragraphs[0].text = "🎚️ 시뮬레이션 기준: 하루 채팅 3,000단계 호출 (일일 서비스 상한 기준)"
    tb_sl.text_frame.paragraphs[0].font.size = Pt(13); tb_sl.text_frame.paragraphs[0].font.bold = True; tb_sl.text_frame.paragraphs[0].font.color.rgb = LIGHT_PURPLE

    # 1:1 Cost Comparison Box
    draw_card(s33, Inches(1.2), Inches(2.75), Inches(5.2), Inches(3.4), LIGHT_DANGER_TINT, LIGHT_DANGER, 1.5)
    tb_cb = s33.shapes.add_textbox(Inches(1.5), Inches(2.95), Inches(4.6), Inches(3.0))
    tf_cb = tb_cb.text_frame; tf_cb.word_wrap = True
    p = tf_cb.paragraphs[0]; p.text = "❌ 모델 분리 전 (단일 상위 모델)"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_DANGER; p.space_after = Pt(10)
    p1 = tf_cb.add_paragraph(); p1.text = "호출당 비용: $0.0168"; p1.font.bold = True; p1.font.size = Pt(14); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(6)
    p2 = tf_cb.add_paragraph(); p2.text = "하루 3,000단계 기준:"; p2.font.size = Pt(12); p2.font.color.rgb = LIGHT_TEXT_MUTED
    p3 = tf_cb.add_paragraph(); p3.text = "$50.40 / 일  (월 약 200만 원)"; p3.font.bold = True; p3.font.size = Pt(20); p3.font.color.rgb = LIGHT_DANGER

    draw_card(s33, Inches(6.8), Inches(2.75), Inches(5.333), Inches(3.4), LIGHT_POSITIVE_TINT, LIGHT_POSITIVE, 1.5)
    tb_ca = s33.shapes.add_textbox(Inches(7.1), Inches(2.95), Inches(4.7), Inches(3.0))
    tf_ca = tb_ca.text_frame; tf_ca.word_wrap = True
    p = tf_ca.paragraphs[0]; p.text = "✨ 2-Tier 듀얼 라우팅 분리 후 (채택)"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_POSITIVE; p.space_after = Pt(10)
    p1 = tf_ca.add_paragraph(); p1.text = "호출당 비용: $0.0009 (95% 절감)"; p1.font.bold = True; p1.font.size = Pt(14); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(6)
    p2 = tf_ca.add_paragraph(); p2.text = "하루 3,000단계 기준:"; p2.font.size = Pt(12); p2.font.color.rgb = LIGHT_TEXT_MUTED
    p3 = tf_ca.add_paragraph(); p3.text = "$2.70 / 일  (월 약 10만 원)"; p3.font.bold = True; p3.font.size = Pt(20); p3.font.color.rgb = LIGHT_POSITIVE
    add_zone_d_proof_bar(s33, 34, TOTAL_SLIDES, ["ADR-0059", "ADR-0063", "#742 측정표"], ["비용 95% 절감", "호출당 $0.0009", "TPS 4.2배 확장"])
    set_speaker_notes(s33, """[도발적 질문 Hook]
"고성능 LLM만 쓰면 하루 API 비용이 눈덩이처럼 불어나는데, 엔터프라이즈 운영이 가능할까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'ADR'은 67개에 걸쳐 기록된 우리 팀의 기술적 설계 판결문입니다."

[시각 요소 지시어]
"화면 좌우 비용 카드를 보십시오. 도구 선택과 초안은 초경량 고속 모델로 분리하여 하루 비용을 $50.40에서 단 $2.70로 깎아냈습니다."

[숫자 타격감 마무리]
"비용 95% 절감과 동시 처리량 4.2배 확장, 상용화의 경제성을 완벽히 입증했습니다!\"""")

    # =========================================================================
    # PART 9. 인프라 & 운영 안전 (Infra & Quota Simulator)
    # =========================================================================
    # SLIDE 34: 2-VM 인프라 물리 격리 & 배포 파이프라인
    s34 = prs.slides.add_slide(blank_layout)
    set_slide_background(s34, is_dark=False)
    add_zone_a_header(s34, "11 · 인프라 & 운영 안전", "2-VM 물리 분리 및 V52 스키마 검증·10초 자동 롤백")
    add_zone_b_glossary(s34, "Flyway", "DB 스키마 변경 이력을 코드처럼 커밋하는 버전 관리기")
    # Zone C: 2-VM Layout
    draw_card(s34, Inches(0.8), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    tb_vm1 = s34.shapes.add_textbox(Inches(1.1), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_vm1 = tb_vm1.text_frame; tf_vm1.word_wrap = True
    p = tf_vm1.paragraphs[0]; p.text = "🖥️ VM1 · 사용자 웹 & 백엔드 & DB"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    p1 = tf_vm1.add_paragraph(); p1.text = "• Nginx 웹 프록시 (:80, :443 HTTPS)\n• Spring Boot 4.1 백엔드 (:8080)\n• MariaDB 11.4 운영 데이터베이스\n• 외부 사용자의 정적 자산 및 API 요청을 전담 처리"; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_vm1.add_paragraph(); p2.text = "🛡️ 고부하 AI 연산 부하가 웹/DB에 미치는 영향 0%"; p2.font.bold = True; p2.font.size = Pt(12.5); p2.font.color.rgb = LIGHT_POSITIVE

    draw_card(s34, Inches(6.88), Inches(1.65), Inches(5.65), Inches(4.85), LIGHT_PURPLE_TINT, LIGHT_PURPLE, 1.5)
    tb_vm2 = s34.shapes.add_textbox(Inches(7.18), Inches(1.85), Inches(5.05), Inches(4.3))
    tf_vm2 = tb_vm2.text_frame; tf_vm2.word_wrap = True
    p = tf_vm2.paragraphs[0]; p.text = "⚡ VM2 · AI 연산 노드 & 배포 파이프라인"; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(10)
    p1 = tf_vm2.add_paragraph(); p1.text = "• FastAPI AI 서버 (:8000, 내부망 전용)\n• Jenkins CI/CD 빌드 파이프라인 (Poll SCM 5분)\n• V52 SHA-256 스키마 사전 대조 검증\n• 이상 감지 시 직전 정상 태그로 10초 내 자동 롤백"; p1.font.size = Pt(12); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
    p2 = tf_vm2.add_paragraph(); p2.text = "🔄 배포 장애 시 10초 이내 무중단 자동 복구"; p2.font.bold = True; p2.font.size = Pt(12.5); p2.font.color.rgb = LIGHT_POSITIVE
    add_zone_d_proof_bar(s34, 35, TOTAL_SLIDES, ["ADR-0007", "ADR-0017", "ADR-0020"], ["2-VM 물리 분리", "57개 테이블 해시 검증", "10초 자동 롤백"])
    set_speaker_notes(s34, """[도발적 질문 Hook]
"새벽 배포 중 DB 마이그레이션이 실패하면 시스템을 이전 상태로 되돌리는 데 얼마나 걸릴까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'Flyway'는 DB의 모든 변경 이력을 코드처럼 통제합니다."

[시각 요소 지시어]
"화면 좌우의 2-VM 분리도를 보십시오. 고부하 AI 서버를 물리 격리하고, 배포 전 V52 해시 검증 및 이상 발생 시 10초 내 자동 롤백합니다."

[숫자 타격감 마무리]
"배포 장애 복구 시간 단 10초 이내, 무중단 엔터프라이즈 운영의 정석입니다!\"""")

    # SLIDE 35: 일일 질문 한도 시뮬레이터 (비로그인 vs 회원)
    s35 = prs.slides.add_slide(blank_layout)
    set_slide_background(s35, is_dark=False)
    add_zone_a_header(s35, "11 · 일일 질문 한도 시뮬레이터", "비로그인 20회 vs 회원 100회 초과 시 429 안전 제어")
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
    set_speaker_notes(s35, """[도발적 질문 Hook]
"무료 사용자가 질문을 무한정 보내서 AI 서버를 다운시키려고 하면 어떻게 될까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 악의적 트래픽이나 과다 호출을 차단하는 쿼터 방어막입니다."

[시각 요소 지시어]
"화면의 게이지와 429 안내 박스를 보십시오. 비로그인 20회 한도 도달 시 즉시 차단되며, 로그인 유도와 함께 안전하게 방어됩니다."

[숫자 타격감 마무리]
"IP별 20회, 회원 100회, 일일 하드캡 3,000회로 시스템 비용과 가용성을 100% 방어합니다!\"""")

    # =========================================================================
    # PART 10. AX 일하는 방식 & 피날레 (Weeks)
    # =========================================================================
    # SLIDE 36: AX 7단계 라이프사이클 - Phase 1 정밀 기획 & 선행 설계
    s36 = prs.slides.add_slide(blank_layout)
    set_slide_background(s36, is_dark=False)
    add_zone_a_header(s36, "12 · AX 라이프사이클 (Phase 1)", "성공기준 수립부터 ADR 선행 설계 및 WBS 분해")
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
    add_zone_d_proof_bar(s36, 37, TOTAL_SLIDES, ["SC-1~4", "FS-1~74", "67 ADRs"], ["기획 병목 제로", "AC 1:1 매핑", "선행 설계 100%"])
    set_speaker_notes(s36, """[도발적 질문 Hook]
"코딩을 시작하기 전, 기획과 설계 단계에서 AI와 사람은 어떻게 손발을 맞췄을까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 통과했는지 채점하는 명확한 기준표입니다."

[시각 요소 지시어]
"화면의 4단계 컨베이어 벨트를 보십시오. 성공 기준 수립부터 AI 스펙 명세, 67개 ADR 선행 설계, WBS 분해까지 한 치의 오차 없이 연결됩니다."

[숫자 타격감 마무리]
"설계 없는 주먹구구 코딩 제로, 기획부터 설계까지 100% 정합성을 입증했습니다!\"""")

    # SLIDE 37: AX 7단계 라이프사이클 - Phase 2 에이전틱 자율 구현 & 품질 게이트
    s37 = prs.slides.add_slide(blank_layout)
    set_slide_background(s37, is_dark=False)
    add_zone_a_header(s37, "12 · AX 라이프사이클 (Phase 2)", "에이전틱 자율 페어 코딩과 4,405개 테스트 품질 게이트")
    add_zone_b_glossary(s37, "WCAG & axe-core", "장애인과 약자도 차별 없이 쓰는 웹 표준 안전벨트")
    # Zone C: Phase 2 3 Nodes
    ax_p2_nodes = [
        ("05. 에이전틱 페어 코딩", "AI 에이전트 자율 협업\nAGENTS.md 규칙 헌장 엄수\n브랜치 격리 & Rebase Merge", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("06. 자동화 품질 게이트", "4,405개 테스트 전수 통과\naxe-core 접근성 0개 위반\ngitleaks 보안 스캔 전수 검증", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("07. 수용기준 검증 (Done)", "AC 100% 실측 증빙 대조\nPR 번호 & 테스트 대조\n기능 완료 최종 판정", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT)
    ]
    for i, (aname, adesc, acol, atint) in enumerate(ax_p2_nodes):
        ax = Inches(0.8) + Inches(3.98) * i
        draw_card(s37, ax, Inches(1.65), Inches(3.8), Inches(4.85), atint, acol, 1.5)
        tb_a = s37.shapes.add_textbox(ax + Inches(0.25), Inches(1.85), Inches(3.3), Inches(4.3))
        tf_a = tb_a.text_frame; tf_a.word_wrap = True
        p = tf_a.paragraphs[0]; p.text = aname; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = acol; p.space_after = Pt(10)
        p1 = tf_a.add_paragraph(); p1.text = adesc; p1.font.size = Pt(12.5); p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(12)
        p2 = tf_a.add_paragraph(); p2.text = "✓ 기계적 품질 보증 통과"; p2.font.bold = True; p2.font.size = Pt(11.5); p2.font.color.rgb = acol
    add_zone_d_proof_bar(s37, 38, TOTAL_SLIDES, ["AGENTS.md", "4,405 Tests", "451 PRs"], ["테스트 100% 통과", "접근성 위반 0건", "시크릿 유출 0건"])
    set_speaker_notes(s37, """[도발적 질문 Hook]
"단 3주 만에 4,405개 테스트를 갖춘 엔터프라이즈 시스템을 완성한 품질 게이트의 비밀은 무엇일까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'axe-core'는 단 하나의 접근성 오류도 용납하지 않는 품질 채점기입니다."

[시각 요소 지시어]
"화면의 3대 실행 카드를 보십시오. AGENTS.md 헌장 아래 자율 페어 코딩을 거쳐 PR마다 4,405개 테스트와 보안 스캔을 통과해야만 머지됩니다."

[숫자 타격감 마무리]
"수용 기준 100% 달성과 결함 재작업률 0%, 실증된 협업의 승리입니다!\"""")

    # SLIDE 38: AX Before vs After 비교
    s38 = prs.slides.add_slide(blank_layout)
    set_slide_background(s38, is_dark=False)
    add_zone_a_header(s38, "12 · AX 임팩트 비교", "전통적 개발 방식 vs DART Insight AX 협업 혁신")
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
        ("품질 게이트", "PR마다 4,405개 테스트 + 접근성 + 보안 기계적 전수 검증"),
        ("67개 ADR", "모든 구조적 의사결정을 ADR로 남겨 코드와 100% 동기화")
    ]
    for tag, txt in items_ta:
        p1 = tf_a.add_paragraph(); p1.text = f"[{tag}]  {txt}"; p1.font.size = Pt(11.5); p1.font.bold = True; p1.font.color.rgb = LIGHT_TEXT_PRIMARY; p1.space_after = Pt(8)
    p_sum = tf_a.add_paragraph(); p_sum.text = "🚀 개발 생산성 400% 향상  •  결함 재작업률 0% 달성"; p_sum.font.bold = True; p_sum.font.size = Pt(13); p_sum.font.color.rgb = LIGHT_POSITIVE
    add_zone_d_proof_bar(s38, 39, TOTAL_SLIDES, ["SC-1~4", "451 PRs", "1,082 Commits"], ["생산성 400% 향상", "재작업률 0%", "충돌 머지 0건"])
    set_speaker_notes(s38, """[도발적 질문 Hook]
"단순히 AI 코딩 도구를 쓰는 것과, 일하는 방식 자체를 AI 중심으로 혁신(AX)하는 것의 결정적 차이는 무엇일까요?"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. '수용 기준(AC)'은 기능이 합격했는지 판정하는 객관적 채점표입니다."

[시각 요소 지시어]
"화면 좌우 비교를 보십시오. 기획 병목과 환각을 낳던 전통 방식에서, 스킬 자동화와 4,405개 테스트 게이트로 무결한 생산성을 완성했습니다."

[숫자 타격감 마무리]
"개발 생산성 400% 향상과 결함 재작업률 0%, 이것이 DART Insight 팀의 실증 기록입니다!\"""")

    # SLIDE 39: 그랜드 피날레 & 4대 정량 성과 (Q&A)
    s39 = prs.slides.add_slide(blank_layout)
    set_slide_background(s39, is_dark=False)
    add_zone_a_header(s39, "12 · 피날레 & 질의응답 (Q&A)", "금융의 미래를 여는 DART Insight, 질문을 받겠습니다")
    add_zone_b_glossary(s39, "DART Insight", "100% 원문 직결 기반의 신뢰 금융 AI 인텔리전스")
    # Zone C: Grand Finale Bento
    draw_card(s39, Inches(0.8), Inches(1.65), Inches(11.733), Inches(4.85), LIGHT_CARD, LIGHT_BORDER, 1.5)
    tb_fin = s39.shapes.add_textbox(Inches(1.2), Inches(1.9), Inches(10.933), Inches(4.3))
    tf_fin = tb_fin.text_frame; tf_fin.word_wrap = True
    p = tf_fin.paragraphs[0]; p.alignment = PP_ALIGN.CENTER; p.text = '"AI는 최고의 비서지, 대표가 아닙니다."'; p.font.size = Pt(28); p.font.bold = True; p.font.color.rgb = LIGHT_PURPLE; p.space_after = Pt(16)
    
    # 4 Pillars recap
    p_recap = tf_fin.add_paragraph(); p_recap.alignment = PP_ALIGN.CENTER
    p_recap.text = "⏱️ 4시간 → 5초 대조    |    🛡️ 수치 환각 0.00%    |    📜 67개 ADR 판결문    |    🧪 4,405개 테스트 무결성"
    p_recap.font.name = FONT_HEADING; p_recap.font.size = Pt(15); p_recap.font.bold = True; p_recap.font.color.rgb = LIGHT_TEXT_PRIMARY; p_recap.space_after = Pt(24)

    p_qa = tf_fin.add_paragraph(); p_qa.alignment = PP_ALIGN.CENTER
    p_qa.text = "경청해 주셔서 대단히 감사합니다.\n질문을 받겠습니다."
    p_qa.font.name = FONT_HEADING; p_qa.font.size = Pt(20); p_qa.font.bold = True; p_qa.font.color.rgb = LIGHT_POSITIVE

    add_zone_d_proof_bar(s39, 40, TOTAL_SLIDES, ["ADR-0001~0068", "FS-1~74", "451 PRs"], ["신뢰 기반 금융 AI", "100% 원문 직결", "Q&A 세션 오픈"])
    set_speaker_notes(s39, """[도발적 질문 Hook]
"우리는 금융 AI에서 가장 중요한 질문을 던졌습니다. 'AI를 믿을 수 있는가?'"

[1초 용어 통역]
"우측 상단 돋보기를 보시죠. 'DART Insight'는 거짓말하지 않는 원문 직결 금융 인텔리전스입니다."

[시각 요소 지시어]
"화면 중앙의 비전 선언문을 보십시오. 'AI는 최고의 비서지, 대표가 아닙니다.' 코드가 숫자를 철저히 계산하고, AI는 정제된 원문 근거만 꿰뚫습니다."

[숫자 타격감 마무리]
"4시간을 5초로 압축하고, 67개 ADR과 4,405개 테스트로 증명했습니다. 금융의 신뢰를 혁신하는 DART Insight 발표를 마치겠습니다. 경청해 주셔서 대단히 감사합니다. 질문을 받겠습니다!\"""")

    # -------------------------------------------------------------------------
    # Save PPTX to docs/ and copy to frontend/public/easter/
    # -------------------------------------------------------------------------
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    docs_output = os.path.join(project_root, "docs", "DART_Insight_Presentation.pptx")
    web_output = os.path.join(project_root, "frontend", "public", "easter", "DART_Insight_Presentation.pptx")

    prs.save(docs_output)
    print(f"✓ Saved {len(prs.slides)}-slide PowerPoint presentation to: {docs_output}")

    os.makedirs(os.path.dirname(web_output), exist_ok=True)
    shutil.copyfile(docs_output, web_output)
    print(f"✓ Copied to web easter directory: {web_output}")

if __name__ == "__main__":
    build_presentation()
