"""Cut the Play promo video from the showcase capture.

Play plays the promo video in a landscape player, so the raw 9:16 capture would
sit between two black bars. This composes it into a 1280x720 frame instead: the
phone on the left, a caption that changes with the scene on the right, plus a
title card and an end card.

    node scripts/showcase.mjs video      # first: capture docs/store-assets-originals/frames
    python scripts/make_promo_video.py   # then: promo_1280x720.mp4

The source frames are sparse (the screencast only emits on change), so
frames.txt carries each frame's duration and playback is rebuilt from that.
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# The Windows console is cp1252 by default and Turkish file names break print().
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "store-assets-originals"
FRAMES = ASSETS / "frames"
OUT_FRAMES = ASSETS / "promo-frames"
CATS = ROOT / "public" / "cats"

W, H = 1280, 720
FPS = 30
INTRO, OUTRO = 2.0, 2.6

PURPLE = (111, 90, 235)
PURPLE_DEEP = (72, 52, 190)
CREAM = (247, 243, 234)
AMBER = (247, 183, 49)
INK = (46, 36, 90)

TITLE_FONT = r"C:\Windows\Fonts\seguibl.ttf"
BODY_FONT = r"C:\Windows\Fonts\seguisb.ttf"

# (share of the body timeline where it starts, title, subtitle)
BEATS = [
    (0.00, "Her gün\nyeni bulmaca", "Günün bulmacası ve günlük seri"),
    (0.22, "Klasik çengel\nformatı", "Hücre içi sorular, dört yön oku"),
    (0.55, "Bekçi kedilerini\ntopla", "Çözdükçe Anadolu'da yol al"),
    (0.80, "Haritada\nilerle", "On beş şehir, on beş kedi"),
]


def gradient() -> Image.Image:
    bg = Image.new("RGB", (W, H), PURPLE)
    top = Image.new("RGB", (W, H), PURPLE_DEEP)
    return Image.composite(bg, top, Image.linear_gradient("L").rotate(90, expand=True).resize((W, H)))


def timeline() -> list[tuple[Path, float]]:
    """(frame, duration) pairs read from the ffconcat list the capture wrote."""
    lines = (FRAMES / "frames.txt").read_text(encoding="utf8").splitlines()
    out, current = [], None
    for line in lines:
        if line.startswith("file "):
            current = FRAMES / line.split("'")[1]
        elif line.startswith("duration ") and current is not None:
            out.append((current, float(line.split()[1])))
            current = None
    return out


def phone_frame(shot: Image.Image, height: int) -> Image.Image:
    """The screen in a rounded dark bezel, so it reads as a phone, not a crop."""
    screen_h = height - 24
    screen_w = round(shot.width * screen_h / shot.height)
    shot = shot.resize((screen_w, screen_h), Image.LANCZOS)

    body = Image.new("RGBA", (screen_w + 24, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    draw.rounded_rectangle([0, 0, body.width - 1, body.height - 1], 34, fill=(24, 18, 48, 255))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], 24, fill=255)
    body.paste(shot, (12, 12), mask)
    return body


def draw_beat(canvas: Image.Image, title: str, subtitle: str, x: int, alpha: float) -> None:
    if alpha <= 0.01:
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    title_font = ImageFont.truetype(TITLE_FONT, 62)
    body_font = ImageFont.truetype(BODY_FONT, 27)
    lines = title.split("\n")
    y = H / 2 - (len(lines) * 70 + 60) / 2
    for line in lines:
        draw.text((x, y), line, font=title_font, fill=(*CREAM, round(255 * alpha)))
        y += 70
    draw.rectangle([x + 3, y + 12, x + 96, y + 19], fill=(*AMBER, round(255 * alpha)))
    draw.text((x, y + 40), subtitle, font=body_font, fill=(226, 219, 255, round(235 * alpha)))
    canvas.alpha_composite(layer)


def card(text: str, sub: str) -> Image.Image:
    """Title/end card: the wordmark centred on the same purple field."""
    canvas = gradient().convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(TITLE_FONT, 86)
    body = ImageFont.truetype(BODY_FONT, 32)

    duman = Image.open(CATS / "duman.png").convert("RGBA")
    duman = duman.crop(duman.getbbox())
    h = 300
    duman = duman.resize((round(duman.width * h / duman.height), h), Image.LANCZOS)
    canvas.alpha_composite(duman, (W - duman.width - 90, H - h - 60))

    tw = draw.textlength(text, font=font)
    x, y = 110, H / 2 - 96
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), text, font=font, fill=(255, 240, 200, 190))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(canvas)
    draw.text((x, y), text, font=font, fill=CREAM, stroke_width=5, stroke_fill=(38, 26, 92))
    draw.rectangle([x + 4, y + 116, x + 4 + min(tw, 150), y + 124], fill=AMBER)
    draw.text((x, y + 148), sub, font=body, fill=(226, 219, 255))
    return canvas


def main() -> None:
    frames = timeline()
    if not frames:
        sys.exit("frames/frames.txt yok — önce `node scripts/showcase.mjs video`")

    body_len = sum(d for _, d in frames)
    OUT_FRAMES.mkdir(parents=True, exist_ok=True)
    for old in OUT_FRAMES.glob("*.png"):
        old.unlink()

    base = gradient().convert("RGBA")
    intro = card("Çengel Bulmaca", "Türkçe çengel bulmaca · 200 bulmaca")
    outro = card("Hemen oyna", "Google Play'de ücretsiz")

    total = INTRO + body_len + OUTRO
    n = 0
    # Walking the source timeline once keeps the frame lookup O(1) per output
    # frame; the capture can be thousands of frames long.
    cursor, cursor_end = 0, frames[0][1]
    for i in range(round(total * FPS)):
        t = i / FPS
        if t < INTRO:
            frame = intro.copy()
            fade = min(1.0, (INTRO - t) / 0.5)
            if fade < 1:
                frame = Image.blend(base, frame, fade)
        elif t >= INTRO + body_len:
            frame = outro.copy()
            rise = min(1.0, (t - INTRO - body_len) / 0.5)
            if rise < 1:
                frame = Image.blend(base, frame, rise)
        else:
            bt = t - INTRO
            while bt > cursor_end and cursor < len(frames) - 1:
                cursor += 1
                cursor_end += frames[cursor][1]
            shot = Image.open(frames[cursor][0]).convert("RGB")
            frame = base.copy()
            phone = phone_frame(shot, 660)
            px = 96
            shadow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
            shadow.paste((16, 10, 42, 150), (px + 8, (H - phone.height) // 2 + 14), phone)
            frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
            frame.alpha_composite(phone, (px, (H - phone.height) // 2))

            share = bt / body_len
            for j, (start, title, sub) in enumerate(BEATS):
                end = BEATS[j + 1][0] if j + 1 < len(BEATS) else 1.01
                if start <= share < end:
                    alpha = min(1.0, (share - start) * body_len / 0.4, (end - share) * body_len / 0.4)
                    draw_beat(frame, title, sub, px + phone.width + 70, alpha)
        frame.convert("RGB").save(OUT_FRAMES / f"promo-{n:05d}.png")
        n += 1

    out = ASSETS / "promo-1280x720.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", str(OUT_FRAMES / "promo-%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
            "-movflags", "+faststart", str(out),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"wrote {out} ({n} kare, {total:.1f} sn)")


if __name__ == "__main__":
    main()
