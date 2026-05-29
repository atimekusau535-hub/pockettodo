#!/usr/bin/env python3
"""ランディングページ用：webサイズのスクショ生成 + OG画像生成"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(ROOT)

BG = (0xF6, 0xF5, 0xF2)
INK = (0x1C, 0x1B, 0x19)
INK2 = (0x6E, 0x6A, 0x63)
INK3 = (0x9C, 0x97, 0x8C)

JA_HEAD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
JA_BODY = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"
JA_TINY = "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc"
EN_HEAD = "/System/Library/Fonts/HelveticaNeue.ttc"


def make_web_screenshots():
    """生スクショ（1320×2868）を web 表示用に縮小（660×1434）"""
    src_ja = os.path.join(WEB, "screenshots")
    src_en = os.path.join(WEB, "screenshots-en")
    out_ja = os.path.join(WEB, "web-screenshots")
    out_en = os.path.join(WEB, "web-screenshots-en")
    os.makedirs(out_ja, exist_ok=True)
    os.makedirs(out_en, exist_ok=True)

    target_w = 660  # retina 表示で十分

    for src_dir, out_dir in [(src_ja, out_ja), (src_en, out_en)]:
        for name in sorted(os.listdir(src_dir)):
            if not name.endswith(".png"):
                continue
            src = os.path.join(src_dir, name)
            img = Image.open(src).convert("RGB")
            w, h = img.size
            new_h = int(h * (target_w / w))
            img = img.resize((target_w, new_h), Image.LANCZOS)
            # JPEG で軽量化（landing 用なので透過不要）
            base = os.path.splitext(name)[0]
            out = os.path.join(out_dir, f"{base}.jpg")
            img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
            print(f"  ✓ {out}")


def make_og_image():
    """1200×630 の OG 画像。sumi 背景 + 名前 + タグライン + 小さなフォン"""
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    # フォント
    name_font = ImageFont.truetype(JA_HEAD, 78, index=0)
    tag_font = ImageFont.truetype(JA_BODY, 30, index=0)
    tiny_font = ImageFont.truetype(JA_TINY, 20, index=0)

    # 左側：アイコン + 名前 + タグライン
    left_x = 80
    icon_size = 130
    icon_path = os.path.join(WEB, "icon.png")
    icon = Image.open(icon_path).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    # 角丸
    mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, icon_size - 1, icon_size - 1), radius=28, fill=255
    )
    icon.putalpha(mask)
    canvas.paste(icon, (left_x, 130), icon)

    # 書誌的な小印
    draw.text((left_x, 100), "— pocket todo —", font=tiny_font, fill=INK3)

    # アプリ名
    draw.text((left_x, 295), "ポケットToDo", font=name_font, fill=INK)

    # タグライン（複数行可）
    tag1 = "秒で放り込む、場面で出し分ける、"
    tag2 = "小タスク専用 ToDo。"
    draw.text((left_x, 410), tag1, font=tag_font, fill=INK2)
    draw.text((left_x, 452), tag2, font=tag_font, fill=INK2)

    # 右側：フォン（フレーム + 影付き）
    shot_path = os.path.join(WEB, "screenshots", "01-home-ido.png")
    if os.path.exists(shot_path):
        shot = Image.open(shot_path).convert("RGB")
        # 小さくスケール
        target_h = 540
        sw, sh = shot.size
        scale = target_h / sh
        target_w = int(sw * scale)
        shot = shot.resize((target_w, target_h), Image.LANCZOS)

        # フレーム
        border = 8
        outer_r = 56
        inner_r = outer_r - border
        fw = target_w + border * 2
        fh = target_h + border * 2
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        fdraw = ImageDraw.Draw(frame)
        fdraw.rounded_rectangle((0, 0, fw - 1, fh - 1), radius=outer_r,
                                fill=INK + (255,))
        # スクショ角丸マスク
        m = Image.new("L", (target_w, target_h), 0)
        ImageDraw.Draw(m).rounded_rectangle(
            (0, 0, target_w - 1, target_h - 1), radius=inner_r, fill=255
        )
        shot_rgba = shot.convert("RGBA")
        shot_rgba.putalpha(m)
        frame.paste(shot_rgba, (border, border), shot_rgba)

        # 影
        shadow_pad = 60
        shadow = Image.new("RGBA", (fw + shadow_pad * 2, fh + shadow_pad * 2), (0, 0, 0, 0))
        alpha = frame.split()[-1]
        sl = Image.new("RGBA", (fw, fh), (0, 0, 0, 50))
        sl.putalpha(Image.eval(alpha, lambda v: min(v, 50)))
        shadow.paste(sl, (shadow_pad, shadow_pad + 20))
        shadow = shadow.filter(ImageFilter.GaussianBlur(30))

        # 配置（右側、中央寄せ）
        fx = W - fw - 90
        fy = (H - fh) // 2
        sw2, sh2 = shadow.size
        canvas.paste(shadow.convert("RGB"),
                     (fx - shadow_pad, fy - shadow_pad + 20),
                     shadow.split()[-1])
        # 上の paste は影 → 適切に重ねるため、convert 経由でなく直接 RGBA で
        # 再度: PIL は RGB canvas に RGBA 貼り付けでアルファ尊重するので素直に貼り直す

    # 上書きで保存（影付きで）
    out = os.path.join(WEB, "og.png")
    canvas.save(out, "PNG", optimize=True)
    print(f"  ✓ {out}")


def make_og_image_clean():
    """より正確な OG 画像（RGBA で組み立ててから合成）"""
    W, H = 1200, 630
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(canvas)

    name_font = ImageFont.truetype(JA_HEAD, 78, index=0)
    tag_font = ImageFont.truetype(JA_BODY, 30, index=0)
    tiny_font = ImageFont.truetype(JA_TINY, 20, index=0)

    left_x = 80
    # 書誌マーク
    draw.text((left_x, 110), "—  pocket todo  —", font=tiny_font, fill=INK3)

    # アイコン
    icon_size = 110
    icon = Image.open(os.path.join(WEB, "icon.png")).convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, icon_size - 1, icon_size - 1), radius=24, fill=255
    )
    icon.putalpha(mask)
    canvas.paste(icon, (left_x, 165), icon)

    # アプリ名
    draw.text((left_x, 310), "ポケットToDo", font=name_font, fill=INK)

    # タグライン
    draw.text((left_x, 420), "秒で放り込む、場面で出し分ける、", font=tag_font, fill=INK2)
    draw.text((left_x, 462), "小タスク専用 ToDo。", font=tag_font, fill=INK2)

    # 右側：フォン
    shot = Image.open(os.path.join(WEB, "screenshots", "01-home-ido.png")).convert("RGB")
    target_h = 480
    sw, sh = shot.size
    scale = target_h / sh
    target_w = int(sw * scale)
    shot = shot.resize((target_w, target_h), Image.LANCZOS)

    border = 7
    outer_r = 48
    inner_r = outer_r - border
    fw, fh = target_w + border * 2, target_h + border * 2
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        (0, 0, fw - 1, fh - 1), radius=outer_r, fill=INK + (255,)
    )
    sm = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(sm).rounded_rectangle(
        (0, 0, target_w - 1, target_h - 1), radius=inner_r, fill=255
    )
    shot_rgba = shot.convert("RGBA")
    shot_rgba.putalpha(sm)
    frame.paste(shot_rgba, (border, border), shot_rgba)

    # 影
    pad = 60
    shadow = Image.new("RGBA", (fw + pad * 2, fh + pad * 2), (0, 0, 0, 0))
    a = frame.split()[-1]
    sl = Image.new("RGBA", (fw, fh), (0, 0, 0, 55))
    sl.putalpha(Image.eval(a, lambda v: min(v, 55)))
    shadow.paste(sl, (pad, pad + 18))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))

    fx = W - fw - 100
    fy = (H - fh) // 2
    canvas.paste(shadow, (fx - pad, fy - pad), shadow)
    canvas.paste(frame, (fx, fy), frame)

    out = os.path.join(WEB, "og.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"  ✓ {out}")


def make_og_image_en():
    """英語版 OG"""
    W, H = 1200, 630
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(canvas)

    name_font = ImageFont.truetype(EN_HEAD, 88, index=0)
    tag_font = ImageFont.truetype(EN_HEAD, 30, index=0)
    tiny_font = ImageFont.truetype(EN_HEAD, 18, index=0)

    left_x = 80
    draw.text((left_x, 110), "—  POCKET TODO  —", font=tiny_font, fill=INK3)

    icon_size = 110
    icon = Image.open(os.path.join(WEB, "icon.png")).convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, icon_size - 1, icon_size - 1), radius=24, fill=255
    )
    icon.putalpha(mask)
    canvas.paste(icon, (left_x, 155), icon)

    draw.text((left_x, 300), "PocketToDo", font=name_font, fill=INK)
    draw.text((left_x, 420), "Drop in fast.", font=tag_font, fill=INK2)
    draw.text((left_x, 462), "Pull out by scene.", font=tag_font, fill=INK2)

    shot = Image.open(os.path.join(WEB, "screenshots-en", "01-home-ido.png")).convert("RGB")
    target_h = 480
    sw, sh = shot.size
    target_w = int(sw * (target_h / sh))
    shot = shot.resize((target_w, target_h), Image.LANCZOS)

    border = 7
    outer_r = 48
    inner_r = outer_r - border
    fw, fh = target_w + border * 2, target_h + border * 2
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        (0, 0, fw - 1, fh - 1), radius=outer_r, fill=INK + (255,)
    )
    sm = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(sm).rounded_rectangle(
        (0, 0, target_w - 1, target_h - 1), radius=inner_r, fill=255
    )
    shot_rgba = shot.convert("RGBA")
    shot_rgba.putalpha(sm)
    frame.paste(shot_rgba, (border, border), shot_rgba)

    pad = 60
    shadow = Image.new("RGBA", (fw + pad * 2, fh + pad * 2), (0, 0, 0, 0))
    a = frame.split()[-1]
    sl = Image.new("RGBA", (fw, fh), (0, 0, 0, 55))
    sl.putalpha(Image.eval(a, lambda v: min(v, 55)))
    shadow.paste(sl, (pad, pad + 18))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))

    fx = W - fw - 100
    fy = (H - fh) // 2
    canvas.paste(shadow, (fx - pad, fy - pad), shadow)
    canvas.paste(frame, (fx, fy), frame)

    out = os.path.join(WEB, "og-en.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"  ✓ {out}")


if __name__ == "__main__":
    print("Web screenshots:")
    make_web_screenshots()
    print("\nOG images:")
    make_og_image_clean()
    make_og_image_en()
