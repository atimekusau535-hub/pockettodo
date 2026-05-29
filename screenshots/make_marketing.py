#!/usr/bin/env python3
"""
App Store マーケティング画像生成 v2 — Pocket Quiet 哲学に基づく。

レイアウト：
  - 上端：小さなプロヴェナンスマーク（「— 01 —」みたいな書誌的小印）
  - 大見出し：1行、重みのある書体（ヒラギノW7 / SF Bold）
  - サブ見出し：薄く、書物の傍注のように
  - スクショ：濃いインクのデバイスフレーム＋紙が紙に置かれたような薄影
  - 下に十分な余白

色は sumi（紙）と ink（墨）の2色のみ。中間色はそこから派生。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(ROOT)

CANVAS_W, CANVAS_H = 1320, 2868

# Palette — sumi 紙と ink 墨のみ。残りはそこから派生
INK = (0x1C, 0x1B, 0x19)
BG = (0xF6, 0xF5, 0xF2)
INK2 = (0x6E, 0x6A, 0x63)   # 墨と紙の中間
INK3 = (0x9C, 0x97, 0x8C)   # さらに薄い

# Fonts ―― 重みと静けさで階調をつくる
JA_HEAD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"   # 強い宣言
JA_BODY = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"   # 静かな声
JA_TINY = "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc"   # 書誌的な小印
EN_HEAD = "/System/Library/Fonts/HelveticaNeue.ttc"           # index 0 (default — bold-ish)
EN_BODY = "/System/Library/Fonts/HelveticaNeue.ttc"
EN_TINY = "/System/Library/Fonts/HelveticaNeue.ttc"


# 5枚分：(basename, ja_head, ja_sub, en_head, en_sub)
HEADLINES = [
    ("01-home-ido",
     "場面で出し分ける",
     "移動中、寝る前。場面ごとに、出せるものだけが出る。",
     "Pick by scene.",
     "On the go. Before bed. Only what fits the moment."),
    ("02-add-open",
     "2タップで放り込む",
     "忘れる前に。1行で、3秒で、片付ける場所へ。",
     "Two taps. Captured.",
     "Drop it in before you forget. Three seconds, done."),
    ("03-settings-themes",
     "6色のきせかえ",
     "気分にあわせて、アプリもアイコンも、ぜんぶ。",
     "Six themes for your day.",
     "Reskin the app and the home-screen icon, together."),
    ("04-history-full",
     "全部、ちゃんと残る",
     "7日より前に片付けたものも、ぜんぶ残っています。",
     "Everything stays.",
     "Look back beyond seven days. Full history, with Pro."),
    ("05-weight-rename",
     "自分の言葉で",
     "4つの重さを、呼び名も意味も、自分仕様に。",
     "In your own words.",
     "Rename the four weights — both names and meanings."),
]


# ─────────────────────────────────────────────
# 文字列の幅測定・折り返し
# ─────────────────────────────────────────────

def measure(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0], b[3] - b[1]


def wrap_ja(text, font, draw, max_w):
    """日本語：句読点や全角空白を優先して折り返し。1行で収まればそのまま。"""
    tw, _ = measure(draw, text, font)
    if tw <= max_w:
        return [text]
    # 句読点で分割
    cuts = [i for i, c in enumerate(text) if c in "、。"]
    if not cuts:
        # 中央で割る
        mid = len(text) // 2
        return [text[:mid], text[mid:]]
    # 真ん中に最も近い句読点で割る
    target = len(text) // 2
    best = min(cuts, key=lambda i: abs(i - target))
    return [text[:best + 1], text[best + 1:].lstrip()]


def wrap_en(text, font, draw, max_w):
    """英語：単語境界で折り返し"""
    tw, _ = measure(draw, text, font)
    if tw <= max_w:
        return [text]
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if measure(draw, trial, font)[0] <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ─────────────────────────────────────────────
# デバイスフレーム（インク色の縁取り）
# ─────────────────────────────────────────────

def make_framed_shot(shot_resized, border=16, corner_outer=120, frame_color=INK):
    """スクショを濃いインクのフレームで囲み、内側のスクショ角も丸めて切り抜く。"""
    sw, sh = shot_resized.size
    corner_inner = corner_outer - border

    fw, fh = sw + border * 2, sh + border * 2
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(frame)

    # 外側：ink色の丸長方形
    fdraw.rounded_rectangle(
        (0, 0, fw - 1, fh - 1),
        radius=corner_outer,
        fill=frame_color + (255,)
    )

    # スクショ：角を丸めてマスク
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, sw - 1, sh - 1),
        radius=corner_inner,
        fill=255
    )
    shot_rgba = shot_resized.convert("RGBA")
    shot_rgba.putalpha(mask)

    frame.paste(shot_rgba, (border, border), shot_rgba)
    return frame


def make_paper_shadow(image, offset=(0, 28), blur=42, opacity=42):
    """紙が紙に置かれた時の、柔らかく拡散した影。
       offset 控えめ、blur 大きめ、opacity 低め。"""
    iw, ih = image.size
    pad = blur * 2

    # 影レイヤを少し大きめに作る
    canvas = Image.new("RGBA", (iw + pad * 2, ih + pad * 2), (0, 0, 0, 0))

    # 入力画像のアルファをマスクに使う
    alpha = image.split()[-1]
    shadow_solid = Image.new("RGBA", (iw, ih), (0, 0, 0, opacity))
    shadow_solid.putalpha(Image.eval(alpha, lambda v: min(v, opacity)))

    canvas.paste(shadow_solid, (pad + offset[0], pad + offset[1]))
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    return canvas


# ─────────────────────────────────────────────
# 1枚生成
# ─────────────────────────────────────────────

def make_marketing(screenshot_path, headline, subheadline, lang, index, out_path):
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), BG + (255,))
    draw = ImageDraw.Draw(canvas)

    # フォント選択
    if lang == "ja":
        head_font = ImageFont.truetype(JA_HEAD, 132, index=0)
        sub_font  = ImageFont.truetype(JA_BODY, 42, index=0)
        tiny_font = ImageFont.truetype(JA_TINY, 24, index=0)
    else:
        # HelveticaNeue.ttc: index 0=Bold/Regular depending on version
        # Use larger size; PIL will pick default face
        head_font = ImageFont.truetype(EN_HEAD, 152, index=0)
        sub_font  = ImageFont.truetype(EN_BODY, 46, index=0)
        tiny_font = ImageFont.truetype(EN_TINY, 24, index=0)

    # ── 書誌的な小印（プロヴェナンス）：上から少し下に
    mark_y = 200
    mark_text = f"—  {index:02d}  —"
    mw, mh = measure(draw, mark_text, tiny_font)
    draw.text(((CANVAS_W - mw) // 2, mark_y), mark_text,
              font=tiny_font, fill=INK3)

    # ── 大見出し
    head_y = mark_y + mh + 90
    head_w, head_h = measure(draw, headline, head_font)
    head_x = (CANVAS_W - head_w) // 2
    draw.text((head_x, head_y), headline, font=head_font, fill=INK)

    # ── サブ見出し（折り返し対応）
    sub_y = head_y + head_h + 50
    max_w = CANVAS_W - 200
    sub_lines = wrap_ja(subheadline, sub_font, draw, max_w) if lang == "ja" \
                else wrap_en(subheadline, sub_font, draw, max_w)
    for line in sub_lines:
        lw, lh = measure(draw, line, sub_font)
        lx = (CANVAS_W - lw) // 2
        draw.text((lx, sub_y), line, font=sub_font, fill=INK2)
        sub_y += lh + 18

    # ── デバイスフレーム付きスクショ
    shot = Image.open(screenshot_path).convert("RGB")
    sw, sh = shot.size

    # スクショは控えめサイズ（紙の上の小さなプリント感）
    target_w = int(CANVAS_W * 0.74)
    target_h = int(sh * (target_w / sw))
    shot_resized = shot.resize((target_w, target_h), Image.LANCZOS)

    framed = make_framed_shot(shot_resized, border=14, corner_outer=110)
    shadow = make_paper_shadow(framed, offset=(0, 30), blur=48, opacity=55)

    fw, fh = framed.size
    device_y = sub_y + 110
    # 下が画面に収まらないなら、見出しを少し詰める／スクショ縮める
    bottom_margin = 160
    if device_y + fh > CANVAS_H - bottom_margin:
        new_h = CANVAS_H - bottom_margin - device_y
        scale = new_h / fh
        new_w = int(fw * scale)
        framed = framed.resize((new_w, new_h), Image.LANCZOS)
        shadow = make_paper_shadow(framed, offset=(0, 30), blur=48, opacity=55)
        fw, fh = framed.size

    device_x = (CANVAS_W - fw) // 2

    # 影 → フレームの順に重ねる
    sw2, sh2 = shadow.size
    canvas.paste(shadow,
                 (device_x - (sw2 - fw) // 2,
                  device_y - (sh2 - fh) // 2),
                 shadow)
    canvas.paste(framed, (device_x, device_y), framed)

    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  ✓ {out_path}")


def main():
    out_ja = os.path.join(WEB, "screenshots-marketing")
    out_en = os.path.join(WEB, "screenshots-marketing-en")
    os.makedirs(out_ja, exist_ok=True)
    os.makedirs(out_en, exist_ok=True)

    only = sys.argv[1] if len(sys.argv) > 1 else None

    for i, (basename, ja_h, ja_s, en_h, en_s) in enumerate(HEADLINES, 1):
        if only and str(i) != only:
            continue
        ja_src = os.path.join(WEB, "screenshots", f"{basename}.png")
        en_src = os.path.join(WEB, "screenshots-en", f"{basename}.png")
        if os.path.exists(ja_src):
            make_marketing(ja_src, ja_h, ja_s, "ja", i,
                           os.path.join(out_ja, f"{basename}-mk.png"))
        if os.path.exists(en_src):
            make_marketing(en_src, en_h, en_s, "en", i,
                           os.path.join(out_en, f"{basename}-mk.png"))


if __name__ == "__main__":
    main()
