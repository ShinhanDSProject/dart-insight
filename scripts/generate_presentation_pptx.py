#!/usr/bin/env python3
"""
DART Insight High-Impact 4-Zone Presentation PPTX Generator
=============================================================
Generates docs/DART_Insight_Presentation.pptx strictly adhering to:
1. 4-Zone Visual Layout:
   - Zone A: Top Kicker Pill + One-Liner Headline (<25자)
   - Zone B: 1-Second Term Translator Callout (🔍 용어 = 1줄 비유)
   - Zone C: Visual Diagram Canvas (Type 1 Before/After, Type 2 UI Mockup & Zoom-in,
             Type 3 Flow/Architecture, Type 4 2x2 Bento Metric Grid)
   - Zone D: Bottom Proof Bar (ADR Badges + 3 Quantitative Metrics + Counter)
2. Design System Tokens (tokens.css / design-system.md):
   - Light: Canvas #F6F7FA, Card #FFFFFF, Primary #141936, Purple #6159B5,
            Positive #187653, Attention #8A5300, Danger #B74250, Neutral #E4E6EB
   - Dark: Canvas #0C0F1D, Card #151A2E, Raised #1D2340, Purple #C4BFFF, Text #ECEEFB
3. Horang-style 4-step Speaker Notes for all 24 slides.
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
# Light Palette
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
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.4), Inches(2.9), Inches(0.32))
    pill.fill.solid()
    pill.fill.fore_color.rgb = k_tint
    pill.line.color.rgb = k_col
    pill.line.width = Pt(1)

    tb_k = slide.shapes.add_textbox(Inches(0.8), Inches(0.42), Inches(2.9), Inches(0.28))
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
    tb_t = slide.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(7.6), Inches(0.58))
    tf_t = tb_t.text_frame
    tf_t.word_wrap = True
    tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
    p_t = tf_t.paragraphs[0]
    p_t.text = oneliner_title
    p_t.font.name = FONT_HEADING
    p_t.font.size = Pt(21)
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

def add_zone_d_proof_bar(slide, current_slide, total_slides, adr_list, metrics_list, is_dark=False):
    """Zone D: Bottom Proof Bar with ADR Badges, Key Metrics, and Slide Counter."""
    line_col = DARK_BORDER if is_dark else LIGHT_BORDER
    txt_muted = DARK_TEXT_MUTED if is_dark else LIGHT_TEXT_MUTED
    adr_bg = DARK_CARD_RAISED if is_dark else LIGHT_CARD
    adr_border = DARK_PURPLE if is_dark else LIGHT_BORDER_STR
    adr_txt = DARK_PURPLE if is_dark else LIGHT_PURPLE

    # Divider Line
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.8), Inches(11.733), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = line_col
    line.line.fill.background()

    # Left: ADR Badges
    curr_x = Inches(0.8)
    for adr in adr_list:
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, curr_x, Inches(6.92), Inches(1.15), Inches(0.26))
        badge.fill.solid()
        badge.fill.fore_color.rgb = adr_bg
        badge.line.color.rgb = adr_border
        badge.line.width = Pt(1)

        tb_b = slide.shapes.add_textbox(curr_x, Inches(6.94), Inches(1.15), Inches(0.22))
        tf_b = tb_b.text_frame
        tf_b.margin_left = tf_b.margin_top = tf_b.margin_right = tf_b.margin_bottom = 0
        p_b = tf_b.paragraphs[0]
        p_b.alignment = PP_ALIGN.CENTER
        p_b.text = adr
        p_b.font.name = FONT_BODY
        p_b.font.size = Pt(9.5)
        p_b.font.bold = True
        p_b.font.color.rgb = adr_txt

        curr_x += Inches(1.22)

    # Center: 3 Quantitative Metrics
    metrics_str = "    •    ".join(metrics_list)
    tb_m = slide.shapes.add_textbox(Inches(4.5), Inches(6.92), Inches(5.8), Inches(0.26))
    tf_m = tb_m.text_frame
    tf_m.margin_left = tf_m.margin_top = tf_m.margin_right = tf_m.margin_bottom = 0
    p_m = tf_m.paragraphs[0]
    p_m.alignment = PP_ALIGN.LEFT
    p_m.text = f"실측 지표: {metrics_str}"
    p_m.font.name = FONT_BODY
    p_m.font.size = Pt(10)
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
# Visual Archetype Diagram Renderers (Zone C: 0.8" ~ 12.533", Top 1.58" ~ 6.6")
# -----------------------------------------------------------------------------

def draw_type1_split_before_after(slide, is_dark, left_data, right_data):
    """
    Type 1: 1:1 Split Before/After Diagram.
    left_data: (title, badge_txt, items_list, is_alert)
    right_data: (title, badge_txt, items_list, is_success)
    """
    top_y = Inches(1.65)
    card_w = Inches(5.65)
    card_h = Inches(4.85)

    # Left Box (Before / Danger)
    x_l = Inches(0.8)
    bg_l = LIGHT_DANGER_TINT if not is_dark else DARK_CARD
    bdr_l = LIGHT_DANGER if not is_dark else RGBColor(120, 45, 55)
    badge_bg_l = LIGHT_DANGER
    badge_txt_l = RGBColor(255, 255, 255)

    card_l = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_l, top_y, card_w, card_h)
    card_l.fill.solid()
    card_l.fill.fore_color.rgb = bg_l
    card_l.line.color.rgb = bdr_l
    card_l.line.width = Pt(1.5)

    # Left Badge
    b_l = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_l + Inches(0.4), top_y + Inches(0.4), Inches(1.8), Inches(0.32))
    b_l.fill.solid()
    b_l.fill.fore_color.rgb = badge_bg_l
    b_l.line.fill.background()
    tb_bl = slide.shapes.add_textbox(x_l + Inches(0.4), top_y + Inches(0.42), Inches(1.8), Inches(0.28))
    tb_bl.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    tb_bl.text_frame.paragraphs[0].text = left_data[1]
    tb_bl.text_frame.paragraphs[0].font.size = Pt(10.5)
    tb_bl.text_frame.paragraphs[0].font.bold = True
    tb_bl.text_frame.paragraphs[0].font.color.rgb = badge_txt_l

    # Left Title
    tb_tl = slide.shapes.add_textbox(x_l + Inches(0.4), top_y + Inches(0.9), card_w - Inches(0.8), Inches(0.5))
    p_tl = tb_tl.text_frame.paragraphs[0]
    p_tl.text = left_data[0]
    p_tl.font.name = FONT_HEADING
    p_tl.font.size = Pt(18)
    p_tl.font.bold = True
    p_tl.font.color.rgb = LIGHT_DANGER if not is_dark else RGBColor(255, 120, 130)

    # Left Visual Cards (Items)
    curr_y = top_y + Inches(1.55)
    for icon, heading, desc in left_data[2]:
        sub_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_l + Inches(0.4), curr_y, card_w - Inches(0.8), Inches(0.9))
        sub_card.fill.solid()
        sub_card.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD_RAISED
        sub_card.line.color.rgb = bdr_l
        sub_card.line.width = Pt(1)

        tb_item = slide.shapes.add_textbox(x_l + Inches(0.6), curr_y + Inches(0.12), card_w - Inches(1.2), Inches(0.68))
        tf_item = tb_item.text_frame
        tf_item.word_wrap = True
        tf_item.margin_left = tf_item.margin_top = tf_item.margin_right = tf_item.margin_bottom = 0

        pi1 = tf_item.paragraphs[0]
        pi1.text = f"{icon}  {heading}"
        pi1.font.name = FONT_HEADING
        pi1.font.size = Pt(13)
        pi1.font.bold = True
        pi1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
        pi1.space_after = Pt(2)

        pi2 = tf_item.add_paragraph()
        pi2.text = desc
        pi2.font.name = FONT_BODY
        pi2.font.size = Pt(11)
        pi2.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED

        curr_y += Inches(1.02)

    # Right Box (After / Success)
    x_r = Inches(6.88)
    bg_r = LIGHT_POSITIVE_TINT if not is_dark else DARK_CARD
    bdr_r = LIGHT_POSITIVE if not is_dark else RGBColor(30, 140, 95)
    badge_bg_r = LIGHT_POSITIVE
    badge_txt_r = RGBColor(255, 255, 255)

    card_r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r, top_y, card_w, card_h)
    card_r.fill.solid()
    card_r.fill.fore_color.rgb = bg_r
    card_r.line.color.rgb = bdr_r
    card_r.line.width = Pt(1.5)

    # Right Badge
    b_r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r + Inches(0.4), top_y + Inches(0.4), Inches(1.8), Inches(0.32))
    b_r.fill.solid()
    b_r.fill.fore_color.rgb = badge_bg_r
    b_r.line.fill.background()
    tb_br = slide.shapes.add_textbox(x_r + Inches(0.4), top_y + Inches(0.42), Inches(1.8), Inches(0.28))
    tb_br.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    tb_br.text_frame.paragraphs[0].text = right_data[1]
    tb_br.text_frame.paragraphs[0].font.size = Pt(10.5)
    tb_br.text_frame.paragraphs[0].font.bold = True
    tb_br.text_frame.paragraphs[0].font.color.rgb = badge_txt_r

    # Right Title
    tb_tr = slide.shapes.add_textbox(x_r + Inches(0.4), top_y + Inches(0.9), card_w - Inches(0.8), Inches(0.5))
    p_tr = tb_tr.text_frame.paragraphs[0]
    p_tr.text = right_data[0]
    p_tr.font.name = FONT_HEADING
    p_tr.font.size = Pt(18)
    p_tr.font.bold = True
    p_tr.font.color.rgb = LIGHT_POSITIVE if not is_dark else RGBColor(100, 220, 160)

    # Right Visual Cards (Items)
    curr_y = top_y + Inches(1.55)
    for icon, heading, desc in right_data[2]:
        sub_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r + Inches(0.4), curr_y, card_w - Inches(0.8), Inches(0.9))
        sub_card.fill.solid()
        sub_card.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD_RAISED
        sub_card.line.color.rgb = bdr_r
        sub_card.line.width = Pt(1)

        tb_item = slide.shapes.add_textbox(x_r + Inches(0.6), curr_y + Inches(0.12), card_w - Inches(1.2), Inches(0.68))
        tf_item = tb_item.text_frame
        tf_item.word_wrap = True
        tf_item.margin_left = tf_item.margin_top = tf_item.margin_right = tf_item.margin_bottom = 0

        pi1 = tf_item.paragraphs[0]
        pi1.text = f"{icon}  {heading}"
        pi1.font.name = FONT_HEADING
        pi1.font.size = Pt(13)
        pi1.font.bold = True
        pi1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
        pi1.space_after = Pt(2)

        pi2 = tf_item.add_paragraph()
        pi2.text = desc
        pi2.font.name = FONT_BODY
        pi2.font.size = Pt(11)
        pi2.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED

        curr_y += Inches(1.02)


def draw_type2_ui_wireframe_callout(slide, is_dark, scene_mode="DEFAULT", custom_data=None):
    """
    Type 2: UI Wireframe & Zoom-in Callout.
    Special Support for scene_mode="W03_JUMP" (원문 점프 화살표 강조!).
    """
    top_y = Inches(1.65)
    card_h = Inches(4.85)

    if scene_mode == "W03_JUMP":
        # W-03 원문 점프 전용 시각화 (좌: 요약 카드, 중: 대형 원문 점프 화살표, 우: DART 공시 뷰어)
        card_w = Inches(4.7)

        # Left: W-03 Summary Mockup
        x_l = Inches(0.8)
        card_l = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_l, top_y, card_w, card_h)
        card_l.fill.solid()
        card_l.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD
        card_l.line.color.rgb = LIGHT_BORDER if not is_dark else DARK_BORDER
        card_l.line.width = Pt(1.5)

        # Left Mockup Header
        tb_lh = slide.shapes.add_textbox(x_l + Inches(0.3), top_y + Inches(0.3), card_w - Inches(0.6), Inches(0.4))
        tb_lh.text_frame.paragraphs[0].text = "W-03 · 분석 결과 요약 화면"
        tb_lh.text_frame.paragraphs[0].font.name = FONT_HEADING
        tb_lh.text_frame.paragraphs[0].font.size = Pt(14)
        tb_lh.text_frame.paragraphs[0].font.bold = True
        tb_lh.text_frame.paragraphs[0].font.color.rgb = LIGHT_PURPLE if not is_dark else DARK_PURPLE

        # Left Content Card
        sub_l = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_l + Inches(0.3), top_y + Inches(0.85), card_w - Inches(0.6), Inches(3.6))
        sub_l.fill.solid()
        sub_l.fill.fore_color.rgb = LIGHT_CANVAS if not is_dark else DARK_CARD_RAISED
        sub_l.line.color.rgb = LIGHT_PURPLE_BORDER if not is_dark else DARK_BORDER
        sub_l.line.width = Pt(1)

        tb_lc = slide.shapes.add_textbox(x_l + Inches(0.5), top_y + Inches(1.05), card_w - Inches(1.0), Inches(3.2))
        tflc = tb_lc.text_frame
        tflc.word_wrap = True

        p1 = tflc.paragraphs[0]
        p1.text = "연결영업이익 증감 요약"
        p1.font.bold = True
        p1.font.size = Pt(15)
        p1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
        p1.space_after = Pt(10)

        p2 = tflc.add_paragraph()
        p2.text = "▲ 15.2% (1,200억 원 증가)"
        p2.font.bold = True
        p2.font.size = Pt(18)
        p2.font.color.rgb = LIGHT_POSITIVE
        p2.space_after = Pt(14)

        p3 = tflc.add_paragraph()
        p3.text = "인과관계 요약 설명:\n메모리 반도체 판가 반등 및 고부가가치 HBM 제품군 출하 확대로 전년 동기 대비 수익성이 대폭 개선되었습니다."
        p3.font.size = Pt(12)
        p3.font.color.rgb = LIGHT_TEXT_BODY if not is_dark else DARK_TEXT_BODY
        p3.space_after = Pt(16)

        # Badge button on mockup
        p4 = tflc.add_paragraph()
        p4.text = "👉 [근거 뱃지] #20240315000123#B042 (클릭)"
        p4.font.bold = True
        p4.font.size = Pt(11.5)
        p4.font.color.rgb = LIGHT_PURPLE if not is_dark else DARK_PURPLE

        # Center: PROMINENT JUMP ARROW SHAPE
        x_c = Inches(5.65)
        arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x_c, top_y + Inches(2.1), Inches(2.05), Inches(0.85))
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = LIGHT_PURPLE
        arrow.line.fill.background()

        tb_arrow = slide.shapes.add_textbox(x_c, top_y + Inches(2.2), Inches(1.7), Inches(0.6))
        tb_arrow.text_frame.word_wrap = True
        p_arr = tb_arrow.text_frame.paragraphs[0]
        p_arr.alignment = PP_ALIGN.CENTER
        p_arr.text = "100% 원문 직결\n#접수번호#B블록"
        p_arr.font.name = FONT_HEADING
        p_arr.font.size = Pt(10)
        p_arr.font.bold = True
        p_arr.font.color.rgb = RGBColor(255, 255, 255)

        # Right: DART Viewer Mockup
        x_r = Inches(7.85)
        card_r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r, top_y, card_w, card_h)
        card_r.fill.solid()
        card_r.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD
        card_r.line.color.rgb = LIGHT_BORDER if not is_dark else DARK_BORDER
        card_r.line.width = Pt(1.5)

        tb_rh = slide.shapes.add_textbox(x_r + Inches(0.3), top_y + Inches(0.3), card_w - Inches(0.6), Inches(0.4))
        tb_rh.text_frame.paragraphs[0].text = "DART 전자공시 원문 뷰어 (실시간 점프)"
        tb_rh.text_frame.paragraphs[0].font.name = FONT_HEADING
        tb_rh.text_frame.paragraphs[0].font.size = Pt(14)
        tb_rh.text_frame.paragraphs[0].font.bold = True
        tb_rh.text_frame.paragraphs[0].font.color.rgb = LIGHT_POSITIVE

        sub_r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r + Inches(0.3), top_y + Inches(0.85), card_w - Inches(0.6), Inches(3.6))
        sub_r.fill.solid()
        sub_r.fill.fore_color.rgb = LIGHT_CANVAS if not is_dark else DARK_CARD_RAISED
        sub_r.line.color.rgb = LIGHT_BORDER if not is_dark else DARK_BORDER
        sub_r.line.width = Pt(1)

        # Highlighted paragraph box inside viewer
        hl_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x_r + Inches(0.5), top_y + Inches(1.6), card_w - Inches(1.0), Inches(1.6))
        hl_box.fill.solid()
        hl_box.fill.fore_color.rgb = LIGHT_ATTENTION_TINT if not is_dark else RGBColor(60, 48, 20)
        hl_box.line.color.rgb = LIGHT_ATTENTION
        hl_box.line.width = Pt(1.5)

        tb_rc = slide.shapes.add_textbox(x_r + Inches(0.6), top_y + Inches(1.15), card_w - Inches(1.2), Inches(3.0))
        tfrc = tb_rc.text_frame
        tfrc.word_wrap = True

        pr1 = tfrc.paragraphs[0]
        pr1.text = "문서: 2024년 사업보고서 > II. 사업의 내용 > 2. 경영진단(MD&A)"
        pr1.font.size = Pt(10)
        pr1.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED
        pr1.space_after = Pt(18)

        pr2 = tfrc.add_paragraph()
        pr2.text = "🎯 블록 ID: 20240315000123#B042\n'당기 영업이익은 메모리 반도체 판가 회복과 고부가가치 서버용 HBM 수요 급증에 힘입어 전년 동기 대비 15.2% 증가한 1,200억 원을 기록하였습니다.'"
        pr2.font.bold = True
        pr2.font.size = Pt(12)
        pr2.font.color.rgb = LIGHT_ATTENTION if not is_dark else RGBColor(255, 200, 100)
        pr2.space_after = Pt(20)

        pr3 = tfrc.add_paragraph()
        pr3.text = "✓ 화면 스크롤 즉시 동기화 완료 & 노란색 하이라이트 활성화"
        pr3.font.size = Pt(11)
        pr3.font.color.rgb = LIGHT_POSITIVE
    else:
        # Generic 3-Column UI Wireframe Cards
        card_w = Inches(3.75)
        gap = Inches(0.24)
        start_x = Inches(0.8)

        for i, (tag, title, desc, col, tint) in enumerate(custom_data or []):
            x = start_x + i * (card_w + gap)
            card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, top_y, card_w, card_h)
            card.fill.solid()
            card.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD
            card.line.color.rgb = col if not is_dark else DARK_BORDER
            card.line.width = Pt(1.5)

            tb = slide.shapes.add_textbox(x + Inches(0.3), top_y + Inches(0.35), card_w - Inches(0.6), card_h - Inches(0.7))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

            p0 = tf.paragraphs[0]
            p0.text = tag
            p0.font.name = FONT_HEADING
            p0.font.size = Pt(11)
            p0.font.bold = True
            p0.font.color.rgb = col
            p0.space_after = Pt(10)

            p1 = tf.add_paragraph()
            p1.text = title
            p1.font.name = FONT_HEADING
            p1.font.size = Pt(17)
            p1.font.bold = True
            p1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
            p1.space_after = Pt(14)

            p2 = tf.add_paragraph()
            p2.text = desc
            p2.font.name = FONT_BODY
            p2.font.size = Pt(12.5)
            p2.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED


def draw_type3_flow_diagram(slide, is_dark, steps_data):
    """
    Type 3: Flow & Architecture Conveyor Diagram (3~4 Steps / Nodes).
    steps_data: [(step_num, title, subtitle, bullets_list, col, tint), ...]
    """
    top_y = Inches(1.65)
    card_h = Inches(4.85)
    num_steps = len(steps_data)
    total_w = Inches(11.733)
    gap = Inches(0.2)
    card_w = (total_w - (num_steps - 1) * gap) / num_steps
    start_x = Inches(0.8)

    for i, (snum, stitle, ssub, bullets, col, tint) in enumerate(steps_data):
        x = start_x + i * (card_w + gap)

        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, top_y, card_w, card_h)
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD
        card.line.color.rgb = col if not is_dark else DARK_BORDER
        card.line.width = Pt(1.5)

        # Top indicator bar
        bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.2), top_y + Inches(0.2), card_w - Inches(0.4), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = col
        bar.line.fill.background()

        tb = slide.shapes.add_textbox(x + Inches(0.25), top_y + Inches(0.4), card_w - Inches(0.5), card_h - Inches(0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = f"STEP {snum}" if str(snum).isdigit() else str(snum)
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(6)

        p1 = tf.add_paragraph()
        p1.text = stitle
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
        p1.space_after = Pt(4)

        if ssub:
            p2 = tf.add_paragraph()
            p2.text = ssub
            p2.font.name = FONT_BODY
            p2.font.size = Pt(11)
            p2.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED
            p2.space_after = Pt(14)

        for b in bullets:
            pb = tf.add_paragraph()
            pb.text = f"• {b}"
            pb.font.name = FONT_BODY
            pb.font.size = Pt(11.5)
            pb.font.color.rgb = LIGHT_TEXT_BODY if not is_dark else DARK_TEXT_BODY
            pb.space_after = Pt(8)


def draw_type4_bento_grid(slide, is_dark, items_2x2):
    """
    Type 4: 2x2 Bento Metric Grid with massive typography.
    items_2x2: [(label, massive_val, subtext, col, tint), ...]
    """
    top_y = Inches(1.65)
    card_w = Inches(5.72)
    card_h = Inches(2.32)
    gap_x = Inches(0.29)
    gap_y = Inches(0.21)

    coords = [
        (Inches(0.8), top_y),
        (Inches(0.8) + card_w + gap_x, top_y),
        (Inches(0.8), top_y + card_h + gap_y),
        (Inches(0.8) + card_w + gap_x, top_y + card_h + gap_y),
    ]

    for (x, y), (lbl, val, sub, col, tint) in zip(coords, items_2x2):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, card_w, card_h)
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT_CARD if not is_dark else DARK_CARD
        card.line.color.rgb = col if not is_dark else DARK_BORDER
        card.line.width = Pt(1.5)

        # Left vertical accent line
        acc = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.18), y + Inches(0.25), Inches(0.08), card_h - Inches(0.5))
        acc.fill.solid()
        acc.fill.fore_color.rgb = col
        acc.line.fill.background()

        tb = slide.shapes.add_textbox(x + Inches(0.45), y + Inches(0.25), card_w - Inches(0.65), card_h - Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = lbl.upper()
        p0.font.name = FONT_HEADING
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = col
        p0.space_after = Pt(2)

        p1 = tf.add_paragraph()
        p1.text = val
        p1.font.name = FONT_NUM
        p1.font.size = Pt(36)
        p1.font.bold = True
        p1.font.color.rgb = LIGHT_TEXT_PRIMARY if not is_dark else DARK_TEXT_PRIMARY
        p1.space_after = Pt(4)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11.5)
        p2.font.color.rgb = LIGHT_TEXT_MUTED if not is_dark else DARK_TEXT_MUTED


# -----------------------------------------------------------------------------
# 24 Slide Implementation (Strict 4-Zone & Visual Archetypes)
# -----------------------------------------------------------------------------

def s01_title_vision(prs):
    """01 · DART Insight 비전 & 개요"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "01 · DART INSIGHT VISION", "4시간의 공시 대조를 5초 만에 신뢰로 해결하다", is_dark=False)
    add_zone_b_glossary(slide, "공시(DART)", "기업의 공식 생활기록부 (전자 공시 도서관)", is_dark=False)

    bento_items = [
        ("초고속 자동 대조", "단 5초", "300페이지 보고서 2건을 5초 만에 매핑·증감 추출", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("원문 추적 신뢰도", "100%", "모든 수치와 문장에 DART 접수번호 및 블록 ID 직결", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("수치 환각 차단", "0.00%", "숫자 연산은 100% 백엔드 프로그램이 엄밀 계산", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("엔지니어링 무결성", "2,626개", "단위·통합·E2E 자동화 테스트 100% 통과 및 WCAG 준수", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
    ]
    draw_type4_bento_grid(slide, is_dark=False, items_2x2=bento_items)
    add_zone_d_proof_bar(slide, 1, 24, ["신한DS 2차", "MVP 검증"], ["대조 속도 5.0초", "환각률 0.00%", "2,626 Tests"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"공시 300페이지를 직접 열어서 두 보고서를 나란히 대조해 보신 적 있으십니까?"

[2. 1초 용어 통역]
우측 상단을 보시죠. DART 공시는 바로 기업의 공식 생활기록부입니다. 1년에 수십만 자씩 쏟아져 나옵니다.

[3. 시각 요소 지시어]
화면의 4개 지표를 보시면, DART Insight는 수작업에 4시간 걸리던 대조를 단 5초 만에, 100% 원문 출처와 함께 끝냅니다.

[4. 숫자 타격감 마무리]
수치 환각 0.00%, 자동화 테스트 2,626개 통과로 완성된 가장 정직한 금융 AI 인텔리전스입니다.""")


def s02_painpoint_manual(prs):
    """02 · 65만 자 공시 대조의 현실"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "02 · PROBLEM DISCOVERY", "300페이지 무한 스크롤과 4시간 수작업 대조의 한계", is_dark=False, kicker_color=LIGHT_DANGER, kicker_tint=LIGHT_DANGER_TINT)
    add_zone_b_glossary(slide, "정기보고서", "분기별 정기 건강검진표", is_dark=False)

    left_data = (
        "기존 수작업 공시 대조 방식",
        "BEFORE · 수작업 4시간",
        [
            ("📜", "300페이지 무한 스크롤", "전년도와 올해 창 2개를 띄우고 수백 페이지를 육안 스크롤"),
            ("⏳", "숙련 전문가도 3~4시간 소요", "5대 재무제표와 수천 개 문단을 대조하느라 본업 분석 지연"),
            ("⚠️", "치명적인 인적 오류(Human Error)", "집중력 저하로 핵심 변경점 누락 및 인과관계 추적 실패"),
        ],
        True
    )
    right_data = (
        "DART Insight 자동화 대조",
        "AFTER · 단 5초 완료",
        [
            ("⚡", "5대 재무제표 5초 전수 매핑", "재무상태표·손익 등 전 계정을 5초 만에 자동 계산"),
            ("🎯", "원클릭 변경점 자동 하이라이트", "바뀐 수치와 문장만을 선별 추출하여 직관적 카드 제공"),
            ("🔗", "재무 증감 ↔ 본문 MD&A 자동 연결", "숫자가 왜 바뀌었는지 경영진단 본문 근거를 즉시 확인"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=False, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 2, 24, ["문제 정의", "사용자 조사"], ["보고서 분량 65만 자", "수작업 4시간 소요", "인적 실수 빈번"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"혹시 모니터 2개에 300페이지 공시를 띄워놓고 Ctrl+F를 누르며 밤새워 보신 적 있습니까?"

[2. 1초 용어 통역]
정기보고서는 회사의 분기별 정기 건강검진표입니다. 온갖 수치와 질병 기록이 빽빽합니다.

[3. 시각 요소 지시어]
화면 왼쪽 붉은색 상자를 보십시오. 숙련된 애널리스트도 꼬박 4시간 동안 단순 대조 노동에 갇혀 있었습니다.

[4. 숫자 타격감 마무리]
오른쪽 DART Insight는 이 지독한 4시간을 단 5초로 압축하여 본질적인 분석 시간으로 되돌려줍니다.""")


def s03_painpoint_hallucination(prs):
    """03 · 시중 LLM의 치명적 한계"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "03 · LLM HALLUCINATION RISK", "숫자를 다루는 순간 1%의 환각도 치명적인 독이 된다", is_dark=False, kicker_color=LIGHT_DANGER, kicker_tint=LIGHT_DANGER_TINT)
    add_zone_b_glossary(slide, "할루시네이션", "AI가 그럴듯하게 숫자를 지어내는 거짓말", is_dark=False)

    left_data = (
        "시중 범용 생성형 AI의 한계",
        "HALLUCINATION ❌",
        [
            ("🤥", "치명적인 수치 날조", "영업이익이 +15% 증가했는데 +25%라고 천연덕스럽게 거짓말"),
            ("📅", "기수 및 기간 둔갑", "3년 전 수치나 직전 분기 수치를 올해 연간 확정치로 왜곡"),
            ("❓", "출처 없는 가짜 근거 생성", "실제 공시 원문에 없는 문장을 지어내어 사람이 처음부터 재검증"),
        ],
        True
    )
    right_data = (
        "DART Insight 신뢰 아키텍처",
        "ZERO-HALLUCINATION ✅",
        [
            ("🧮", "코드가 1원 단위까지 100% 계산", "수치 연산은 Java 백엔드가 담당, LLM에 계산을 일절 맡기지 않음"),
            ("🛡️", "사실 추출 정규식 가드레일", "AI 생성 문장마다 {접수번호}#B{블록}이 실존하는지 백엔드 교차 검증"),
            ("🔒", "불일치 시 2회 재생성 후 격리", "출처가 없거나 일치하지 않으면 '검토 필요'로 안전 차단"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=False, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 3, 24, ["ADR-0008 사실 가드레일", "금융 컴플라이언스"], ["수치 환각 0.00%", "오차 0원 허용", "가드레일 검증 100%"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"그냥 챗GPT에 사업보고서 던져주고 '요약해줘' 하면 왜 큰일 날까요?"

[2. 1초 용어 통역]
우측 상단 돋보기를 보시죠. 할루시네이션, 즉 AI가 그럴듯하게 숫자를 지어내는 거짓말 때문입니다.

[3. 시각 요소 지시어]
화면 왼쪽처럼 영업이익이 15% 늘었는데 25% 늘었다고 날조합니다. 문학에서는 95%가 훌륭할지 몰라도 금융에서는 1% 오차로 수억 원이 날아갑니다.

[4. 숫자 타격감 마무리]
그래서 화면 오른쪽처럼 숫자는 코드가 1원 단위까지 100% 계산하고 수치 환각 0.00%를 달성했습니다.""")


def s04_philosophy_declaration(prs):
    """04 · 핵심 철학 선언"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "04 · CORE PHILOSOPHY", "AI는 최고의 비서지, 대표가 아닙니다", is_dark=False)
    add_zone_b_glossary(slide, "AI 비서론", "계산과 결정은 코드가, AI는 근거 설명만 보좌", is_dark=False)

    left_data = (
        "컴퓨팅 코드: 절대적 계산 영역 (대표)",
        "CODE = REPRESENTATIVE",
        [
            ("⚙️", "수치 연산 및 증감률 계산", "증감액, 증감률, 흑자전환 여부를 코드가 1원 단위까지 정확히 산출"),
            ("📊", "비교 가능성 사전 검증", "결산월 일치, 통화 일치, 정정보고서 반영을 기계적으로 자동 확인"),
            ("🚦", "단방향 FSM 작업 제어", "작업 상태 전이표를 엄격 통제하여 데이터 상태 꼬임을 원천 차단"),
        ],
        False
    )
    right_data = (
        "생성형 AI: 정제된 맥락 보좌 영역 (수석 비서)",
        "AI = CHIEF ASSISTANT",
        [
            ("🔍", "원문 팩트 기반 요약 보고", "코드가 전달한 검증 원문 블록 내에서만 문맥 요약 작성"),
            ("📖", "금융 도메인 인과관계 설명", "매출이 왜 줄었는지 경영진단(MD&A) 문단을 찾아 사람에게 보고"),
            ("🛡️", "자본시장법 규제 안전선 준수", "매수/매도 권유 없이 객관적 사실만을 전달하며 주관 배제"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=False, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 4, 24, ["AGENTS.md 규칙 헌장", "ADR-0062"], ["계산 관여율 0%", "원문 근거율 100%", "역할 분리 엄수"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"회사의 중대한 투자 결정을 인턴 AI에게 전적으로 맡기시겠습니까?"

[2. 1초 용어 통역]
우리의 철학은 확고합니다. 'AI는 최고의 비서지, 대표가 아닙니다!'

[3. 시각 요소 지시어]
화면 왼쪽을 보십시오. 1원 단위 계산과 비교 검증이라는 '대표'의 역할은 100% 검증된 코드가 책임집니다.
오른쪽 AI는 검증된 원문 근거만 꿰뚫어 사람에게 보고하는 '수석 비서'에 머뭅니다.

[4. 숫자 타격감 마무리]
이 철학 하나로 우리는 AI 계산 관여율 0%, 원문 근거율 100%의 절대 신뢰를 완성했습니다.""")


def s05_pillar_speed(prs):
    """05 · Pillar 01: 초고속성"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "05 · PILLAR 01: SPEED", "5대 재무제표 전 계정을 단 5초 만에 자동 대조", is_dark=False)
    add_zone_b_glossary(slide, "연결재무제표", "자회사 실적까지 하나로 합친 성적표", is_dark=False)

    cards = [
        ("W-01 ③", "비교 가능 조건 자동 검증", "결산월 일치, 통화 일치, 정정 여부를 사전에 기계적으로 자동 확인하여 비교 불가능한 데이터 왜곡 원천 차단", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("W-02", "5대 재무제표 5초 매핑", "재무상태표, 손익계산서, 포괄손익, 자본변동표, 현금흐름표의 전 계정을 5초 만에 매핑하고 증감액·증감률 산출", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("ADR-0024", "영구 캐시 밀리초 응답", "한 번 파싱된 보고서는 로컬 DB에 영구 적재되어 두 번째 조회부터는 외부 API 호출 0회 및 즉각 응답", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
    ]
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="DEFAULT", custom_data=cards)
    add_zone_d_proof_bar(slide, 5, 24, ["ADR-0004 재무제표 대조", "ADR-0024 캐시"], ["대조 시간 5.0초", "5대 제표 100% 매핑", "외부 API 0회"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"두 개 분기 재무제표 5종의 수백 개 계정을 엑셀로 일일이 맞추려면 몇 분이 걸릴까요?"

[2. 1초 용어 통역]
연결재무제표는 자회사 실적까지 하나로 합친 거대한 성적표입니다. 계정 매핑이 극도로 까다롭습니다.

[3. 시각 요소 지시어]
화면의 세 개 카드를 보시죠. 비교 조건 검증부터 5대 재무제표 전 계정 매핑까지 걸리는 시간은 단 5초입니다.

[4. 숫자 타격감 마무리]
게다가 영구 캐시 정책으로 동일 보고서 재조회 시 외부 호출 0회, 단 0.1초 만에 화면이 열립니다.""")


def s06_pillar_traceability(prs):
    """06 · Pillar 02: 100% 원문 추적성 (W-03 원문 점프 슬라이드 ★)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "06 · PILLAR 02: TRACEABILITY", "클릭 한 번으로 요약에서 DART 공시 원문으로 즉시 점프", is_dark=False)
    add_zone_b_glossary(slide, "MD&A", "경영진이 직접 작성한 성적표 해설서", is_dark=False)

    # SPECIAL: Prominent #접수번호#B블록번호 arrow shape connecting W-03 Summary and DART Viewer!
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="W03_JUMP")
    add_zone_d_proof_bar(slide, 6, 24, ["ADR-0008 원문 블록 ID", "W-03 뷰어 동기화"], ["원문 블록 ID 100%", "스크롤 동기화 즉시", "미검증 문장 차단"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"AI가 요약해 준 문장, 진짜 그 공시 몇 페이지 몇 문단에 적혀 있는지 눈으로 확인해 보셨습니까?"

[2. 1초 용어 통역]
MD&A는 경영진이 직접 작성한 성적표 해설서입니다. 숫자의 진짜 비밀이 여기에 숨어 있습니다.

[3. 시각 요소 지시어]
화면 가운데 보라색 대형 화살표를 똑똑히 보십시오! 요약 카드의 근거 뱃지를 누르면 '#접수번호#B042' 식별자를 타고 우측 DART 원문 뷰어가 해당 위치로 즉시 스크롤되며 노랗게 하이라이트됩니다.

[4. 숫자 타격감 마무리]
출처 없는 문장은 화면에 단 한 줄도 내보내지 않습니다. 원문 추적성 100%의 절대적 증거입니다.""")


def s07_pillar_context(prs):
    """07 · Pillar 03: 다차원 맥락 연결"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "07 · PILLAR 03: CONTEXTUALITY", "차가운 재무 수치와 1년간의 경영 스토리를 꿰뚫다", is_dark=False)
    add_zone_b_glossary(slide, "정기 vs 수시공시", "정기 건강검진표 vs 갑자기 터진 응급 속보", is_dark=False)

    cards = [
        ("DIMENSION 1", "재무 증감 ↔ MD&A 연결", "영업이익이 왜 늘었는지, 부채가 왜 줄었는지를 '이사의 경영진단(MD&A)' 원문과 자동 매핑하여 인과관계 설명", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("DIMENSION 2", "1년 수시공시 타임라인", "두 정기보고서 사이에 발생한 대규모 공급계약, 유상증자, 특허 등 핵심 수시공시를 타임라인으로 결합", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("DIMENSION 3", "사실과 전망의 엄격 분리", "과거의 공시 사실과 조건부 향후 영향을 코드 태그로 엄격히 분리하여 왜곡 없는 다차원 의사결정 지원", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
    ]
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="DEFAULT", custom_data=cards)
    add_zone_d_proof_bar(slide, 7, 24, ["ADR-0034 수시공시 타임라인", "ADR-0065 영향경로"], ["MD&A 매핑 100%", "1년 공시 결합", "사실/전망 분리"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"재무제표의 차가운 숫자만 보고 그 회사의 진짜 위기와 기회를 알 수 있을까요?"

[2. 1초 용어 통역]
정기공시가 정기 건강검진표라면, 수시공시는 한 해 동안 갑자기 터진 응급 속보입니다.

[3. 시각 요소 지시어]
화면의 세 개 차원을 보시죠. 숫자의 변화를 경영진단 해설서와 연결하고, 1년간의 수시공시 타임라인을 한 줄로 엮었습니다.

[4. 숫자 타격감 마무리]
단편적인 숫자가 입체적인 스토리로 살아납니다. 다차원 맥락 연결 100%로 기업의 진짜 흐름을 꿰뚫습니다.""")


def s08_pillar_compliance(prs):
    """08 · Pillar 04: 규제 준수 & 컴플라이언스"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "08 · PILLAR 04: COMPLIANCE", "자본시장법 준수: 주관적 추천 없이 객관적 사실만 전달", is_dark=False)
    add_zone_b_glossary(slide, "컴플라이언스", "매수/매도 투자 권유를 막는 법적 안전 차단막", is_dark=False)

    cards = [
        ("GUARDRAIL 1", "가치판단 표현 원천 차단", "매수, 매도, 목표주가, 대박 호재 등 투자 판단 유도 표현을 시스템 금지어로 등록하고 화면 송출 전 자동 검사", LIGHT_DANGER, LIGHT_DANGER_TINT),
        ("GUARDRAIL 2", "코드 기준표 기반 신호", "주요 사건의 긍정(▲)·주의(▼) 신호는 LLM이 자의적으로 붙이지 않고 사전 승인된 코드 기준표로만 엄격 부여", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("GUARDRAIL 3", "불명확 항목 안전 격리", "공시 근거가 없거나 정량화가 불가능한 항목은 억지로 추정하지 않고 '검토 필요'로 안전하게 격리 처리", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
    ]
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="DEFAULT", custom_data=cards)
    add_zone_d_proof_bar(slide, 8, 24, ["ADR-0060 사건 신호", "자본시장법 준수"], ["가치판단 0건", "금지어 자동 차단", "중립 배지 적용"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"금융 AI가 '이 종목 대박 호재, 적극 매수하라'고 답변하면 어떤 법적 책임이 따를까요?"

[2. 1초 용어 통역]
컴플라이언스는 불법 투자 권유와 자본시장법 위반을 막는 법적 안전 차단막입니다.

[3. 시각 요소 지시어]
화면의 3중 가드레일을 보십시오. 가치판단 금지어가 화면에 나가는 것을 원천 차단하고, 신호는 정해진 기준표로만 매깁니다.

[4. 숫자 타격감 마무리]
가치판단 유도 0건, 법적 안전 고지 100%로 금융 기관에서도 당장 쓸 수 있는 규제 준수를 완성했습니다.""")


def s09_tech_xml_streaming(prs):
    """09 · 난제 01: StAX XML 스트리밍 파서"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "09 · ENGINEERING CHALLENGE 01", "StAX 스트리밍으로 50MB 공시 메모리를 80MB로 통제", is_dark=False)
    add_zone_b_glossary(slide, "StAX 파서", "50MB 문서를 한 줄씩 흘려보내 메모리를 아끼는 수도관", is_dark=False)

    left_data = (
        "기존 DOM 기반 XML 파서",
        "DOM PARSER (기존 방식) ❌",
        [
            ("💥", "메모리 트리 전체 로드 O(N)", "50MB XML 전체를 DOM 객체 트리로 적재하여 수백 MB 힙 낭비"),
            ("🛑", "동시 요청 시 Out-of-Memory", "대형 정기보고서 동시 요청 시 서버 메모리가 폭발하며 다운"),
            ("🐢", "문서 전체 로드 전 파싱 지연", "마지막 태그까지 다 읽을 때까지 다음 프로세스로 진입 불가"),
        ],
        True
    )
    right_data = (
        "StAX 스트리밍 이벤트 파서",
        "STAX STREAMING (해결책) ✅",
        [
            ("🌊", "이벤트 기반 순차 소비 O(1)", "XML 노드를 한 줄씩 스트리밍 소비하여 메모리를 80MB 이하로 고정"),
            ("🚀", "초고속 블록 식별자 즉시 부여", "문단과 표 태그를 지나는 즉시 {접수번호}#B{번호} 식별자 매핑"),
            ("🛡️", "안정적인 동시 처리량 보장", "아무리 거대한 공시 파일이 유입되어도 서버 리소스 완벽 보호"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=False, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 9, 24, ["ADR-0004 StAX 파서", "메모리 최적화"], ["메모리 <80MB O(1)", "50MB XML 완주", "OOM 0건"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"50MB짜리 거대한 공시 XML 문서를 서버 메모리에 통째로 올리면 무슨 일이 벌어질까요?"

[2. 1초 용어 통역]
StAX 파서는 거대한 수조의 물을 통째로 붓는 대신, 한 줄씩 흘려보내 메모리를 아끼는 수도관입니다.

[3. 시각 요소 지시어]
화면 왼쪽의 기존 DOM 파서는 메모리가 O(N)으로 폭발하며 서버를 다운시킵니다.
오른쪽 DART Insight는 StAX 스트리밍으로 이벤트만 순차 소비합니다.

[4. 숫자 타격감 마무리]
아무리 큰 공시가 들어와도 메모리는 80MB 이하 O(1) 수준으로 완벽 통제됩니다.""")


def s10_tech_bm25_search(prs):
    """10 · 난제 02: 2-gram 인메모리 BM25 엔진"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "10 · ENGINEERING CHALLENGE 02", "2-gram 인메모리 BM25로 45ms 만에 정확한 근거 적중", is_dark=False)
    add_zone_b_glossary(slide, "2-gram BM25", "300페이지에서 2글자 단위로 45ms 만에 근거를 찾는 탐지기", is_dark=False)

    steps = [
        ("01", "노이즈 사전 필터링", "40자 미만 문단 제거", ["단순 인사말, 목차, 서식 노이즈 사전 제외", "의미 있는 경영진단 핵심 문단만 선별 타겟팅"], LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("02", "2-gram 인메모리 역색인", "금융 용어 정밀 분절", ["고비용 벡터 DB 통신 네트워크 오버헤드 0ms", "한국어 복합 금융 공시 용어 2글자 단위 인덱싱"], LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("03", "도메인 섹션 가중치", "경영진단 섹션 가중", ["이사의 경영진단(MD&A) 1.5배 가중치", "사업의 내용 문단 1.3배 가중치 자동 결합"], LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("04", "45ms 초정밀 적중", "밀리초 응답 완료", ["질문 및 증감 계정과 가장 맞닿은 문단 추출", "서버 인프라 비용 $0 유지 & 밀리초 응답"], LIGHT_PURPLE, LIGHT_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=False, steps_data=steps)
    add_zone_d_proof_bar(slide, 10, 24, ["ADR-0036 BM25 검색", "인메모리 역색인"], ["검색 시간 45ms", "인프라 비용 $0", "노이즈 필터 40자"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"무거운 벡터 DB와 임베딩 모델을 꼭 써야만 300페이지에서 근거 문단을 찾을 수 있을까요?"

[2. 1초 용어 통역]
2-gram BM25는 300페이지에서 2글자 단위로 45ms 만에 근거를 찾는 초정밀 탐지기입니다.

[3. 시각 요소 지시어]
화면의 4단계 파이프라인을 따라가 보십시오. 40자 미만 쓰레기 문단을 먼저 털어내고, 금융 가중치를 적용합니다.

[4. 숫자 타격감 마무리]
고비용 벡터 DB 없이도 단 45밀리초 만에 경영진단 핵심 문단을 정확히 적중해 냅니다.""")


def s11_tech_fsm_guard(prs):
    """11 · 난제 03 & 04: 사실 추출 가드레일 & 단방향 FSM 전이표"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "11 · ENGINEERING CHALLENGE 03 & 04", "단방향 FSM과 사실 가드레일로 상태 꼬임과 환각 0건 차단", is_dark=False)
    add_zone_b_glossary(slide, "단방향 FSM", "역주행과 상태 꼬임이 불가능한 일방통행 기차길", is_dark=False)

    left_data = (
        "단방향 FSM 분석 상태 전이표",
        "STRICT FSM STATE MACHINE",
        [
            ("🚂", "단방향 허용 경로 엄수", "PENDING ➔ RUNNING ➔ COMPLETED 또는 FAILED"),
            ("🚫", "비정상 역주행 전이 즉시 차단", "RUNNING ➔ PENDING 등 허용되지 않은 전이 시 400 에러 차단"),
            ("💾", "DB 영속화 전 완료 금지", "결과를 DB에 영구 저장하기 전에는 COMPLETED 전이 거부"),
        ],
        False
    )
    right_data = (
        "사실 추출 정규식 가드레일",
        "FACT-GROUNDED REGEX GUARD",
        [
            ("🆔", "원문 블록 ID 존재성 전수 검사", "AI 응답 문장 내 {접수번호}#B{번호} 포맷 존재 여부 자동 스캔"),
            ("🔍", "로컬 DB 원문 일치 교차 대조", "해당 블록이 실제 파싱 DB에 존재하는지 백엔드 교차 확인"),
            ("🛡️", "최대 2회 재생성 후 자동 격리", "출처 누락이나 원문 불일치 시 2회 다듬기 후 '검토 필요' 격리"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=False, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 11, 24, ["ADR-0008 사실 가드레일", "단방향 FSM 전이표"], ["상태 꼬임 0건", "가드레일 통과 100%", "최대 2회 자동 복구"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"동시에 수백 명이 분석을 누를 때, 분산 환경에서 작업 상태가 꼬이면 어떻게 될까요?"

[2. 1초 용어 통역]
단방향 FSM은 역주행과 꼬임이 절대 불가능한 일방통행 기차길입니다.

[3. 시각 요소 지시어]
화면 왼쪽의 일방통행 전이표를 보십시오. DB에 완전히 쓰기 전엔 절대 완료 상태로 바꾸지 않습니다.
오른쪽 정규식 가드레일은 AI가 쓴 문장에 원문 족보가 있는지 현미경으로 검사합니다.

[4. 숫자 타격감 마무리]
서버가 재시작되어도 상태 꼬임 0건, 원문 불일치 문장 화면 노출 0건을 기계적으로 보장합니다.""")


def s12_tech_dual_routing(prs):
    """12 · 난제 05: 2-Tier 듀얼 라우팅 & 프롬프트 캐싱"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "12 · ENGINEERING CHALLENGE 05", "2-Tier 듀얼 라우팅으로 상용 대비 API 비용 95% 절감", is_dark=False)
    add_zone_b_glossary(slide, "2-Tier 라우팅", "가벼운 AI가 먼저 분류하고 고성능 AI가 정밀 작성", is_dark=False)

    steps = [
        ("01", "Tier 1: 경량 모델", "의도 분류 & 도구 호출", ["사용자 질문 의도 신속 판별", "반복적인 Tool 선택 및 데이터 추출 초고속 위임"], LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("02", "프롬프트 캐싱", "반복 컨텍스트 캐시", ["반복되는 공시 스키마와 시스템 프롬프트 캐시 적용", "입력 토큰 비용 90% 이상 즉시 절감"], LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("03", "Tier 2: 고성능 모델", "고난도 심층 보고서", ["정제된 팩트 데이터만을 전달받아 최종 요약", "불필요한 토큰 낭비 없이 최고 품질 추론"], LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("04", "비용 95% 절감 실증", "TPS 4.2배 확장 달성", ["호출당 비용: $0.0168 ➔ $0.0009 절감", "대규모 트래픽에서도 운영 지속가능성 완비"], LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=False, steps_data=steps)
    add_zone_d_proof_bar(slide, 12, 24, ["ADR-0045 듀얼 라우팅", "ADR-0063 모델 분리"], ["비용 95% 절감", "TPS 4.2배 확장", "$0.0009 / call"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"단순한 질문 하나에도 매번 가장 비싼 고성능 모델을 부르면 API 비용을 감당할 수 있을까요?"

[2. 1초 용어 통역]
2-Tier 라우팅은 가벼운 AI가 먼저 분류하고, 고성능 AI는 정밀 작성만 맡는 역할 분담입니다.

[3. 시각 요소 지시어]
화면의 흐름을 보십시오. 경량 모델이 도구를 고르고, 프롬프트 캐싱을 거쳐 꼭 필요한 순간에만 고성능 모델을 호출합니다.

[4. 숫자 타격감 마무리]
그 결과 호출당 비용을 95% 절감하고, 초당 처리량을 4.2배 확장시켰습니다.""")


def s13_arch_4tier(prs):
    """13 · 아키텍처: 4-Tier 단방향 계층 분리 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "13 · SYSTEM ARCHITECTURE 01", "엄격한 4-Tier 단방향 계층: ArchUnit으로 빌드마다 강제", is_dark=True)
    add_zone_b_glossary(slide, "4-Tier 단방향", "화면이 DB나 AI를 직통하지 못하게 세운 4중 안전 방화벽", is_dark=True)

    steps = [
        ("TIER 1", "React 19 화면", "TypeScript 5.8", ["공개 API(/api/*)만 호출", "원문 뷰어 하이라이트 동기화", "axe-core 웹 접근성 100%"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("TIER 2", "Spring Boot 4.1", "비즈니스 & 캐시", ["OpenDART 수집 및 영구 캐시", "분석 작업 큐 & 단방향 FSM", "X-Trace-Id 분산 추적"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("TIER 3", "FastAPI AI 서버", "LangGraph 파이프라인", ["원문 구조화 및 2-gram BM25", "2-Tier 듀얼 라우팅", "DB 분리 완전 무상태(Stateless)"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("TIER 4", "MariaDB 11.4", "Flyway V52 관리", ["57개 테이블 형상 관리", "접수번호 기반 고유 색인", "SHA-256 검증 자동 롤백"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 13, 24, ["ADR-0002 4-Tier", "ADR-0010 계층 분리"], ["ArchUnit 규칙 100%", "단방향 의존성", "내부망 격리"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"프론트엔드 화면에서 AI 서버나 데이터베이스를 직접 호출하면 왜 위험할까요?"

[2. 1초 용어 통역]
4-Tier 단방향 구조는 계층 간 월경을 막기 위해 세워둔 4중 안전 방화벽입니다.

[3. 시각 요소 지시어]
화면의 4개 계층을 보십시오. React는 오직 Spring Boot만 바라보며 AI 서버나 DB를 직통할 수 없습니다.

[4. 숫자 타격감 마무리]
이 규칙은 사람이 감시하지 않고, 매 빌드마다 ArchUnit 아키텍처 테스트가 100% 기계적으로 강제합니다.""")


def s14_arch_mcp(prs):
    """14 · 확장성: 독립 MCP 서버 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "14 · SYSTEM ARCHITECTURE 02", "외부 AI 에이전트 생태계를 위한 표준 읽기 전용 MCP 서버", is_dark=True)
    add_zone_b_glossary(slide, "MCP 서버", "외부 AI가 우리 공시 데이터를 안전하게 읽어가는 전용 플러그인", is_dark=True)

    steps = [
        ("01", "외부 AI 클라이언트", "에코시스템 확장", ["Claude Desktop, Cursor 등", "다양한 외부 AI 환경과 표준 연동"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("02", "표준 MCP 프로토콜", "Model Context Protocol", ["Anthropic 표준 JSON-RPC 기반", "독립 격리된 파이썬 MCP 서버 구축"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("03", "읽기 전용 도구 4종", "안전한 샌드박스", ["기업 검색, 보고서 비교, 근거 조회", "데이터 수정·삭제 권한 완전 배제"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("04", "백엔드 통합 게이트", "인증 및 한도 통제", ["Spring Boot 공개 API 경유", "동일한 일일 쿼터 및 권한 규칙 준수"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 14, 24, ["ADR-0052 읽기 전용 MCP", "표준 프로토콜"], ["읽기 전용 도구 4종", "내부 엔드포인트 은닉", "외부 AI 연동"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"우리가 만든 정밀 공시 데이터를 외부 AI 에이전트에게 안전하게 공급할 방법은 없을까요?"

[2. 1초 용어 통역]
MCP 서버는 외부 AI가 우리 공시 데이터를 안전하게 읽어가는 표준 전용 플러그인입니다.

[3. 시각 요소 지시어]
화면의 연결을 보십시오. 외부 AI 클라이언트가 표준 MCP 도구를 호출하면, 읽기 전용 샌드박스에서만 응답합니다.

[4. 숫자 타격감 마무리]
데이터 변조 위험 0%, 검증된 읽기 도구 4종으로 외부 AI 생태계와의 완벽한 확장을 이뤄냈습니다.""")


def s15_perf_cache(prs):
    """15 · 데이터 영구 캐시 전략 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "15 · DATA PERFORMANCE", "공시 불변성을 활용한 접수번호 영구 캐시: 외부 호출 0회", is_dark=True)
    add_zone_b_glossary(slide, "접수번호 영구 캐시", "한 번 열어본 불변 공시는 로컬 금고에 영구 보관", is_dark=True)

    left_data = (
        "기존 실시간 외부 API 의존 방식",
        "EXTERNAL API RELIANCE ❌",
        [
            ("⚠️", "OpenDART 일일 2만 회 한도", "사용자가 몰리면 API 쿼터가 순식간에 고갈되어 서비스 중단"),
            ("🐢", "외부 네트워크 지연 시간", "호출할 때마다 수 초 이상의 대기 시간 발생으로 사용자 이탈"),
            ("💸", "중복 요청에 따른 자원 낭비", "동일한 보고서를 수천 명이 조회해도 매번 외부 API 소모"),
        ],
        True
    )
    right_data = (
        "DART Insight 접수번호 영구 캐시",
        "PERMANENT IMMUTABLE CACHE ✅",
        [
            ("💎", "공시 데이터 불변성 극대화", "한 번 제출된 정기보고서는 절대 변하지 않으므로 영구 보관"),
            ("⚡", "2회차 조회부터 외부 호출 0회", "최초 1회 적재 후 10만 명이 동시 접속해도 외부 API 소모 0회"),
            ("🚀", "밀리초 단위 즉각 응답 보장", "로컬 MariaDB 인덱스에서 밀리초 단위로 결과를 전송"),
        ],
        True
    )
    draw_type1_split_before_after(slide, is_dark=True, left_data=left_data, right_data=right_data)
    add_zone_d_proof_bar(slide, 15, 24, ["ADR-0024 접수번호 캐시", "데이터 불변성"], ["외부 API 호출 0회", "응답 지연 <50ms", "쿼터 고갈 제로"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"OpenDART 하루 호출 한도가 2만 번인데, 사용자 10만 명이 몰리면 사이트가 뻗을까요?"

[2. 1초 용어 통역]
접수번호 영구 캐시는 한 번 열어본 공시를 로컬 금고에 넣어두고 평생 꺼내 쓰는 전략입니다.

[3. 시각 요소 지시어]
화면 오른쪽을 보십시오. 공시 보고서는 내용이 바뀌지 않는 불변 데이터입니다. 최초 1회만 받으면 끝입니다.

[4. 숫자 타격감 마무리]
하루 10만 명이 접속해도 외부 호출 횟수는 정확히 0회, 쿼터 고갈 위험을 완전히 소멸시켰습니다.""")


def s16_infra_reliability(prs):
    """16 · 운영 안전: 2-VM 분리 & 무중단 배포 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "16 · PRODUCTION RELIABILITY", "2-VM 물리 분리와 Flyway 자동 롤백으로 무중단 배포 실현", is_dark=True)
    add_zone_b_glossary(slide, "2-VM 물리 격리", "웹 서비스와 무거운 AI 연산이 서로 간섭하지 않는 독립 건물", is_dark=True)

    steps = [
        ("VM 1", "웹·백엔드·DB 서버", "비즈니스 안정성", ["Spring Boot & Nginx 웹 프록시", "MariaDB 11.4 영속 볼륨 탑재", "AI 연산 부하와 완전 격리"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("VM 2", "AI 연산·빌드 서버", "고부하 전담 노드", ["FastAPI AI 파서 & LangGraph", "Jenkins CI/CD 파이프라인", "8000번 포트 내부망 한정 접근"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("GUARD", "Flyway 해시 검증", "DB 스키마 정합성", ["승인된 V52 마이그레이션 대조", "SHA-256 체크섬 사전 검증", "미승인 SQL 감지 시 배포 중단"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("ROLLBACK", "헬스체크 자동 복구", "무중단 운영 보장", ["교체 직전 전체 덤프 자동 백업", "비정상 응답 감지 시 즉시 롤백", "장애 복구 시간(MTTR) 최소화"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 16, 24, ["2-VM 물리 격리", "Flyway 자동 롤백"], ["VM 물리 격리 2대", "SHA-256 사전 검증", "자동 롤백 파이프라인"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"무거운 AI가 대형 공시를 분석하다가 서버 램을 다 잡아먹으면 웹사이트도 같이 죽어야 할까요?"

[2. 1초 용어 통역]
2-VM 물리 격리는 웹 서비스와 무거운 AI 연산이 서로 간섭하지 않도록 건물을 따로 지은 것입니다.

[3. 시각 요소 지시어]
화면의 4개 블록을 보십시오. VM 1과 VM 2가 물리적으로 분리되어 있어 AI가 과부하되어도 웹과 DB는 끄떡없습니다.

[4. 숫자 타격감 마무리]
여기에 Flyway SHA-256 검증과 자동 롤백을 더해 배포 무사고 100%를 달성했습니다.""")


def s17_ux_terminology(prs):
    """17 · UX: 금융 초보자를 위한 안전장치"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "17 · USER IMPACT 01: BEGINNERS", "50개 전문 용어 실시간 툴팁과 3줄 AI 브리핑", is_dark=False)
    add_zone_b_glossary(slide, "용어 툴팁 & 브리핑", "난해한 금융 용어에 마우스를 대면 즉시 뜨는 1초 해설", is_dark=False)

    cards = [
        ("FEATURE 01", "50개 공시 전문 용어 실시간 카드", "재무제표의 낯선 전문 계정과목에 마우스를 올리면 즉시 이해하기 쉬운 설명과 예시를 팝업으로 제공", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("FEATURE 02", "30초 핵심 3줄 AI 브리핑", "수백 페이지를 다 읽지 않아도 전년 대비 가장 중요한 변화 3가지를 두괄식으로 30초 만에 파악", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("FEATURE 03", "쉬운 말 모드 즉시 전환", "초보 투자자를 위해 '연결포괄손익' 같은 난해한 회계 언어를 일상적인 비즈니스 언어로 전환 제공", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
    ]
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="DEFAULT", custom_data=cards)
    add_zone_d_proof_bar(slide, 17, 24, ["FS-64 용어 카드", "FS-72 AI 브리핑"], ["용어 사전 50종", "3줄 요약 제공", "정보 격차 해소"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"사회초년생이나 초보 투자자가 사업보고서를 열었을 때 가장 먼저 겪는 좌절이 무엇일까요?"

[2. 1초 용어 통역]
용어 툴팁은 난해한 금융 한자어 위에 마우스를 올리면 즉시 뜨는 1초 해설 카드입니다.

[3. 시각 요소 지시어]
화면의 세 개 기능을 보십시오. 낯선 계정과목에 마우스를 올리면 용어 카드가 뜨고, 핵심은 3줄 브리핑으로 정리해 줍니다.

[4. 숫자 타격감 마무리]
전문 용어 50종 사전 구축으로 금융 정보의 문턱을 획기적으로 낮췄습니다.""")


def s18_ux_matrix(prs):
    """18 · UX: 전문 분석가를 위한 대조 매트릭스"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "18 · USER IMPACT 02: ANALYSTS", "경영진의 공약 검증: 작년 시설투자 계획 vs 올해 실제 집행", is_dark=False)
    add_zone_b_glossary(slide, "약속 vs 이행 매트릭스", "작년 공언한 시설투자를 올해 진짜 집행했는지 교차 검증", is_dark=False)

    cards = [
        ("MATRIX 01", "작년 계획 vs 올해 실적 대조", "기업이 작년 사업보고서에서 공언했던 공장 신설, R&D 투자, 차입금 상환 계획이 실제 지켜졌는지 본문 자동 추출", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("MATRIX 02", "가이던스 이행률 자동 산출", "경영진의 목표치 대비 실제 달성률을 데이터로 투명하게 대조하여 기업의 신뢰도 지표 산출", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("MATRIX 03", "원문 주석 1:1 교차 대조", "수치 집행 근거가 적힌 사업보고서 상세 주석 문단으로 즉시 연결하여 심층 리서치 시간 80% 단축", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
    ]
    draw_type2_ui_wireframe_callout(slide, is_dark=False, scene_mode="DEFAULT", custom_data=cards)
    add_zone_d_proof_bar(slide, 18, 24, ["FS-60 계획 대비 이행", "전문가 리서치"], ["가이던스 대조 100%", "리서치 시간 80% 단축", "원문 주석 연동"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"경영진이 작년에 주주들에게 약속했던 수천억 원의 시설투자, 올해 진짜로 집행했을까요?"

[2. 1초 용어 통역]
약속 vs 이행 매트릭스는 경영진의 작년 공언이 지켜졌는지 확인하는 정밀 검증표입니다.

[3. 시각 요소 지시어]
화면의 매트릭스 구성을 보십시오. 작년 보고서의 투자 약속과 올해 실제 집행 내역을 나란히 대조해 줍니다.

[4. 숫자 타격감 마무리]
전문 분석가의 리서치 시간을 80% 단축시키고, 경영진의 신뢰도를 데이터로 증명해 냅니다.""")


def s19_quality_metrics(prs):
    """19 · 품질 무결성 입증"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "19 · ENGINEERING INTEGRITY", "2,626개 테스트 전수 통과와 WCAG 웹 접근성 100% 준수", is_dark=False)
    add_zone_b_glossary(slide, "수용 기준 & WCAG", "기능 합격 채점표 & 약자도 차별 없이 쓰는 웹 접근성", is_dark=False)

    bento_items = [
        ("자동화 테스트 전수 통과", "2,626개", "프론트엔드 1,700개 + 백엔드 & AI 926개 테스트 100% 그린", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("웹 접근성 위반 건수", "0건", "axe-core 기계적 검증 완료, WCAG 2.1 AA 명도 대비 완전 준수", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("시크릿 유출 및 보안 사고", "0건", "gitleaks 전 커밋 자동 스캔으로 API 키 및 비밀번호 유출 원천 차단", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("아키텍처 규칙 준수율", "100%", "ArchUnit 기반 단방향 계층 의존성 규칙 매 빌드 기계적 강제", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
    ]
    draw_type4_bento_grid(slide, is_dark=False, items_2x2=bento_items)
    add_zone_d_proof_bar(slide, 19, 24, ["WCAG 2.1 AA", "ArchUnit 강제"], ["2,626 Tests Pass", "접근성 위반 0건", "보안 사고 0건"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"화려해 보이는 AI 서비스가 실제 프로덕션 금융 시장에서 버틸 수 있을지 어떻게 확신할까요?"

[2. 1초 용어 통역]
수용 기준과 WCAG는 기능 합격 채점표이자, 장애인도 차별 없이 쓰는 웹 접근성 표준입니다.

[3. 시각 요소 지시어]
화면의 4대 무결성 지표를 보십시오. 자동화 테스트 2,626개를 단 1개의 실패도 없이 전수 통과했습니다.

[4. 숫자 타격감 마무리]
axe-core 웹 접근성 위반 0건, 시크릿 유출 0건으로 실전 금융 플랫폼의 완성도를 완벽히 입증했습니다.""")


def s20_ax_overview(prs):
    """20 · AX 일하는 방식의 혁신: 7단계 라이프사이클 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "20 · AI TRANSFORMATION (AX)", "AI와 함께 일하는 방식을 근본적으로 혁신하다 (AX Way)", is_dark=True)
    add_zone_b_glossary(slide, "AX 7단계 라이프사이클", "기획부터 검증까지 AI와 사람이 함께 뛰는 7단계 컨베이어", is_dark=True)

    steps = [
        ("01~02", "스펙 엔지니어링", "비즈니스 목표 ➔ AC", ["성공 기준(SC) 수립", "AI 기획(FS-n & AC)", "검증 가능한 수용 기준 도출"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("03~04", "선행 설계 & 분해", "66 ADR ➔ WBS 이슈", ["코드 작성 전 66개 ADR 확정", "API 명세 및 ERD 선행", "AC 1:1 매핑 WBS 자동 분해"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("05", "자율 페어 코딩", "AI 협업 페어 프로그래밍", ["AGENTS.md 규칙 헌장 엄수", "구현 🤝 설계 교차 리뷰", "421개 PR Rebase 선형 병합"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("06~07", "품질 게이트 & 검증", "기계적 CI ➔ AC 완료", ["2,626개 테스트 전수 게이트", "AC 100% 실측 증빙 대조", "생산성 400% ↑ & 재작업 0%"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 20, 24, ["노션 개발 워크플로우", "7단계 AX 라이프사이클"], ["생산성 400% 향상", "결함 재작업 0%", "421개 PR 완주"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"단 3주 만에 어떻게 2,626개 테스트와 421개 PR을 단 한 번의 충돌도 없이 완주했을까요?"

[2. 1초 용어 통역]
AX 라이프사이클은 기획부터 최종 검증까지 AI와 사람이 함께 뛰는 7단계 컨베이어 벨트입니다.

[3. 시각 요소 지시어]
화면의 7단계 흐름을 보십시오. 목표 수립부터 스펙 엔지니어링, 자율 페어 코딩, 품질 게이트까지 빈틈없이 연결되어 있습니다.

[4. 숫자 타격감 마무리]
AI를 도구로 쓰는 것을 넘어 일하는 방식을 혁신하여 생산성 400% 향상과 결함 재작업 0%를 실증했습니다.""")


def s21_ax_phase1(prs):
    """21 · AX Phase 1: 스펙 엔지니어링 & 선행 ADR (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "21 · AX PHASE 01: SPEC & ADR", "모호한 말 대신 기계적 검증 기준(AC)과 66개 ADR 선행", is_dark=True)
    add_zone_b_glossary(slide, "ADR", "코드를 짜기 전 '왜 이 기술을 골랐는지' 남긴 66개의 설계 판결문", is_dark=True)

    steps = [
        ("STEP 1", "성공 기준 (SC) 수립", "비즈니스 나침반", ["수작업 4시간 소요 및 환각 해결 지표", "어느 성공 기준에도 기여 못하면 원천 배제"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("STEP 2", "AI 스펙 엔지니어링", "Given-When-Then AC", ["상황-행동-결과 검증 가능 수용 기준 도출", "정상 흐름뿐 아니라 예외 흐름 전수 명세"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("STEP 3", "66개 선행 ADR 확정", "아키텍처 불일치 0%", ["코드 작성 전 API 명세·ERD 선행 확정", "66개 기술 결정 기록으로 팀 합의 완료"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("STEP 4", "WBS 이슈 자동 분해", "AC 1:1 매핑", ["모든 AC가 GitHub 작업 이슈와 1:1 매핑", "선행 의존성과 레이블 체계적 자동 부여"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 21, 24, ["ADR-0001~0066", "기능 기획서 FS-1~74"], ["채택 ADR 66개", "수용 기준(AC) 100%", "설계 부채 0건"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"개발 프로젝트에서 AI가 엉뚱한 코드를 짜고 사람이 갈아엎는 진짜 이유가 무엇일까요?"

[2. 1초 용어 통역]
ADR은 코드를 짜기 전 '왜 이 기술을 골랐는지' 명문화해 둔 66개의 설계 판결문입니다.

[3. 시각 요소 지시어]
화면의 스펙 엔지니어링 4단계를 보십시오. 모호한 말 대신 기계적으로 채점 가능한 AC를 만들고 66개 ADR을 먼저 못 박았습니다.

[4. 숫자 타격감 마무리]
설계 합의 66건 완료로 팀 내 기술 불일치와 재작업을 사전에 0건으로 소멸시켰습니다.""")


def s22_ax_phase2(prs):
    """22 · AX Phase 2: 자율 페어 코딩 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "22 · AX PHASE 02: PAIR CODING", "AGENTS.md 규칙 헌장 아래 421개 PR 무충돌 선형 완주", is_dark=True)
    add_zone_b_glossary(slide, "자율 페어 코딩", "AGENTS.md 헌장 아래 AI와 사람이 실시간 교차 검증하는 협업", is_dark=True)

    steps = [
        ("PRINCIPLE", "AGENTS.md 규칙 헌장", "사람과 AI의 공동 헌법", ["'추측 코딩 절대 금지, 가치판단 배제'", "'로컬 DB 실측 검증 우선' 규칙 엄수"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("COLLAB", "에이전틱 페어 프로그래밍", "구현 🤝 설계 상호 검토", ["AI 에이전트가 기능을 자율 구현하면", "다른 에이전트가 66 ADR & SLAP 원칙 교차 검토"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("WORKFLOW", "1이슈 1PR 원칙", "원자적 작업 단위 유지", ["브랜치 규칙(feature/{WBS}-{name})", "작업 범위 밖의 변경 일체 차단"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("GIT REBASE", "421개 PR 선형 완주", "충돌 제로 히스토리", ["Rebase Merge 전략으로 단일 선형 역사", "421개 PR 머지 충돌 0회 기록 완주"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 22, 24, ["AGENTS.md 헌장", "Rebase Merge"], ["완주 PR 421개", "머지 충돌 0회", "단일 선형 커밋"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"수백 개의 PR을 올리면서 Git 머지 충돌로 지옥을 경험해 보신 적 있으십니까?"

[2. 1초 용어 통역]
자율 페어 코딩은 엄격한 헌장 아래 AI와 사람이 실시간으로 손발을 맞추는 협업 방식입니다.

[3. 시각 요소 지시어]
화면의 4단계를 보십시오. AGENTS.md 규칙을 준수하며 기능을 구현하고 설계를 상호 교차 검증했습니다.

[4. 숫자 타격감 마무리]
그 결과 421개의 풀 리퀘스트를 단 하나의 머지 충돌도 없이 완벽한 단일 선형 역사로 완성했습니다.""")


def s23_ax_phase3(prs):
    """23 · AX Phase 3: 기계적 품질 게이트 & 수용기준 검증 (다크 테마)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=True)
    add_zone_a_header(slide, "23 · AX PHASE 03: QUALITY GATE", "기계적 품질 게이트와 AC 1:1 증빙 매핑으로 재작업률 0%", is_dark=True)
    add_zone_b_glossary(slide, "기계적 품질 게이트", "2,626개 테스트를 전수 통과해야만 문이 열리는 기계적 차단기", is_dark=True)

    steps = [
        ("GATE 1", "GitHub Actions CI", "자동화 품질 검사", ["2,626개 단위·통합·E2E 테스트 통과", "ArchUnit 아키텍처 계층 검증"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("GATE 2", "접근성 & 보안 검사", "컴플라이언스 입증", ["axe-core 웹 접근성 0개 위반 검증", "gitleaks 시크릿 유출 자동 차단"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("VERIFY", "수용 기준(AC) 전수 검증", "증빙 1:1 매핑", ["기획서 모든 AC에 자동화 테스트 파일명과", "PR 번호, 실측 캡처 1:1 매핑 검증 완료"], DARK_PURPLE, DARK_PURPLE_TINT),
        ("OUTCOME", "생산성 400% & 재작업 0%", "AX 실증 완료", ["스펙-구현-게이트-검증의 완결 파이프라인", "단 3주 만에 생산성 4배 향상 실증"], DARK_PURPLE, DARK_PURPLE_TINT),
    ]
    draw_type3_flow_diagram(slide, is_dark=True, steps_data=steps)
    add_zone_d_proof_bar(slide, 23, 24, [".claude/skills/verify-spec", "CI 게이트"], ["생산성 400% 향상", "결함 재작업률 0%", "AC 충족률 100%"], is_dark=True)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"테스트 통과만으로 기획서의 비즈니스 요구사항이 진짜 다 구현됐다고 확신할 수 있을까요?"

[2. 1초 용어 통역]
기계적 품질 게이트는 모든 기준을 통과해야만 문이 열리는 기계식 차단기입니다.

[3. 시각 요소 지시어]
화면의 검증 단계를 보십시오. 2,626개 테스트와 접근성 검사를 뚫고, 모든 수용 기준에 테스트 증빙을 1:1로 매핑했습니다.

[4. 숫자 타격감 마무리]
이 철저한 워크플로우로 생산성 400% 향상과 결함 재작업률 0.0%를 숫자로 실증했습니다.""")


def s24_finale_qa(prs):
    """24 · 그랜드 피날레 & 질의응답 (Q&A)"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(slide, is_dark=False)
    add_zone_a_header(slide, "24 · GRAND FINALE & Q&A", "AI는 최고의 비서로서 사람이 가장 가치 있는 결정을 돕습니다", is_dark=False)
    add_zone_b_glossary(slide, "신뢰의 완결", "숫자는 코드가, 근거는 100% 원문으로 보증하는 금융 인텔리전스", is_dark=False)

    bento_items = [
        ("CORE VALUE", "수작업 4시간 ➔ 단 5초", "100% 원문 추적성과 0% 수치 환각으로 완성한 대한민국 최고 공시 인텔리전스", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
        ("AX PROOF", "3주 만에 421개 PR 완주", "기획-구현-게이트-검증 7단계 라이프사이클로 입증한 생산성 400% 향상", LIGHT_POSITIVE, LIGHT_POSITIVE_TINT),
        ("ARCHITECTURE", "66개 ADR 설계 무결성", "StAX 스트리밍, 2-gram BM25, 4-Tier, 독립 MCP 서버 완비", LIGHT_ATTENTION, LIGHT_ATTENTION_TINT),
        ("Q & A", "심사위원 질의응답", "경청해 주셔서 대단히 감사합니다. 지금부터 질의응답을 시작하겠습니다.", LIGHT_PURPLE, LIGHT_PURPLE_TINT),
    ]
    draw_type4_bento_grid(slide, is_dark=False, items_2x2=bento_items)
    add_zone_d_proof_bar(slide, 24, 24, ["DART Insight 완주", "신한DS 2차 프로젝트"], ["대조 5초", "환각 0.00%", "421 PRs 완주"], is_dark=False)

    set_speaker_notes(slide, """[1. 도발적 질문 Hook]
"우리가 바라는 AI와의 협업은 어떤 모습이어야 할까요?"

[2. 1초 용어 통역]
우리의 답은 명확합니다. 숫자는 코드가, 근거는 100% 원문으로 보증하는 '가장 정직한 비서'입니다.

[3. 시각 요소 지시어]
화면의 4대 결실을 보십시오. 4시간의 고통을 5초의 신뢰로 바꾸었고, 421개 PR로 일하는 방식의 미래를 증명했습니다.

[4. 숫자 타격감 마무리]
'AI는 최고의 비서지, 대표가 아닙니다.' 지금까지 DART Insight였습니다. 경청해 주셔서 감사합니다. 질의응답을 시작하겠습니다.""")


# -----------------------------------------------------------------------------
# Main Runner
# -----------------------------------------------------------------------------
def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    print("Generating 24 High-Impact 4-Zone Presentation Slides...")
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
