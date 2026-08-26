"""Cut the Play promo video from the showcase capture.

Play plays the promo video in a landscape player, so the raw 9:16 capture would
sit between two black bars. This composes it into a 1920x1080 frame instead:
the phone on the left, a caption that changes with the scene on the right, a
title card, an end card, and the game's own background music under it.

    node scripts/showcase.mjs video      # first: capture docs/store-assets-originals/frames
    python scripts/make_promo_video.py   # then: promo-1920x1080.mp4

The source frames are sparse (the screencast only emits on change), so
frames.txt carries each frame's duration and playback is rebuilt from that.
"""

import json
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

# 1080p: YouTube's promo player is 16:9 and the phone capture is 1080x1920, so
# a 1080-tall canvas shows the screen with no upscaling at all.
W, H = 1920, 1080
S = W / 1280  # the layout below was drawn at 720p
FPS = 30
INTRO, OUTRO = 2.0, 2.6

# The game's own background music: CC0, "Feel Good Island Loop" by Brandon
# Morris (OpenGameArt), the same file the app ships in public/music.
MUSIC = ROOT / "public" / "music" / "anadolu-loop.ogg"

PURPLE = (111, 90, 235)
PURPLE_DEEP = (72, 52, 190)
CREAM = (247, 243, 234)
AMBER = (247, 183, 49)
INK = (46, 36, 90)

TITLE_FONT = r"C:\Windows\Fonts\seguibl.ttf"
BODY_FONT = r"C:\Windows\Fonts\seguisb.ttf"

# One caption per scene of the capture. Which scene a caption belongs to is
# named, not guessed from a percentage of the running time: showcase.mjs writes
# scenes.json with the second each screen appeared at.
BEATS = [
    ("home", "Her gün\nyeni bulmaca", "Günün bulmacası ve günlük seri"),
    ("grid", "Klasik çengel\nformatı", "Hücre içi sorular, dört yön oku"),
    ("cats", "Bekçi kedilerini\ntopla", "Çözdükçe Anadolu'da yol al"),
    ("map", "Haritada\nilerle", "On beş şehir, on beş kedi"),
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


def scene_beats(body_len: float) -> list[tuple[float, str, str]]:
    """Each caption paired with the second the scene it describes starts at."""
    marks = {}
    path = FRAMES / "scenes.json"
    if path.exists():
        marks = {m["name"]: m["at"] for m in json.loads(path.read_text(encoding="utf8"))}
    # Without scenes.json the captions fall back to an even split, which is what
    # the cut did before the capture started recording its scene marks.
    return [
        (marks.get(scene, i * body_len / len(BEATS)), title, sub)
        for i, (scene, title, sub) in enumerate(BEATS)
    ]


def phone_frame(shot: Image.Image, height: int) -> Image.Image:
    """The screen in a rounded dark bezel, so it reads as a phone, not a crop."""
    bezel = round(12 * S)
    screen_h = height - bezel * 2
    screen_w = round(shot.width * screen_h / shot.height)
    shot = shot.resize((screen_w, screen_h), Image.LANCZOS)

    body = Image.new("RGBA", (screen_w + bezel * 2, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    draw.rounded_rectangle([0, 0, body.width - 1, body.height - 1], round(34 * S), fill=(24, 18, 48, 255))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], round(24 * S), fill=255)
    body.paste(shot, (bezel, bezel), mask)
    return body


def draw_beat(canvas: Image.Image, title: str, subtitle: str, x: int, alpha: float) -> None:
    if alpha <= 0.01:
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    title_font = ImageFont.truetype(TITLE_FONT, round(62 * S))
    body_font = ImageFont.truetype(BODY_FONT, round(27 * S))
    lines = title.split("\n")
    step = round(70 * S)
    y = H / 2 - (len(lines) * step + round(60 * S)) / 2
    for line in lines:
        draw.text((x, y), line, font=title_font, fill=(*CREAM, round(255 * alpha)))
        y += step
    # The rule sits under the whole title block, with enough clearance that it
    # cannot strike through the last line.
    rule_y = y + round(22 * S)
    draw.rectangle(
        [x + round(3 * S), rule_y, x + round(96 * S), rule_y + round(7 * S)],
        fill=(*AMBER, round(255 * alpha)),
    )
    draw.text((x, rule_y + round(26 * S)), subtitle, font=body_font,
              fill=(226, 219, 255, round(235 * alpha)))
    canvas.alpha_composite(layer)


def card(text: str, sub: str) -> Image.Image:
    """Title/end card: the wordmark centred on the same purple field."""
    canvas = gradient().convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(TITLE_FONT, round(86 * S))
    body = ImageFont.truetype(BODY_FONT, round(32 * S))

    duman = Image.open(CATS / "duman.png").convert("RGBA")
    duman = duman.crop(duman.getbbox())
    h = round(300 * S)
    duman = duman.resize((round(duman.width * h / duman.height), h), Image.LANCZOS)
    canvas.alpha_composite(duman, (W - duman.width - round(90 * S), H - h - round(60 * S)))

    tw = draw.textlength(text, font=font)
    x, y = round(110 * S), H / 2 - 96 * S
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), text, font=font, fill=(255, 240, 200, 190))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(round(18 * S))))
    draw = ImageDraw.Draw(canvas)
    draw.text((x, y), text, font=font, fill=CREAM, stroke_width=round(5 * S), stroke_fill=(38, 26, 92))
    draw.rectangle([x + 4 * S, y + 116 * S, x + 4 * S + min(tw, 150 * S), y + 124 * S], fill=AMBER)
    draw.text((x, y + 148 * S), sub, font=body, fill=(226, 219, 255))
    return canvas


def main() -> None:
    frames = timeline()
    if not frames:
        sys.exit("frames/frames.txt yok — önce `node scripts/showcase.mjs video`")

    body_len = sum(d for _, d in frames)
    beats = scene_beats(body_len)
    OUT_FRAMES.mkdir(parents=True, exist_ok=True)
    for old in OUT_FRAMES.glob("*.png"):
        old.unlink()

    base = gradient().convert("RGBA")
    intro = card("Çengel Bulmaca", "Türkçe çengel bulmaca · 200+ bulmaca")
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
            phone = phone_frame(shot, round(660 * S))
            px = round(96 * S)
            shadow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
            shadow.paste((16, 10, 42, 150), (px + round(8 * S), (H - phone.height) // 2 + round(14 * S)), phone)
            frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(round(18 * S))))
            frame.alpha_composite(phone, (px, (H - phone.height) // 2))

            for j, (start, title, sub) in enumerate(beats):
                end = beats[j + 1][0] if j + 1 < len(beats) else body_len + 1
                if start <= bt < end:
                    alpha = min(1.0, (bt - start) / 0.4, (end - bt) / 0.4)
                    draw_beat(frame, title, sub, px + phone.width + round(70 * S), alpha)
        frame.convert("RGB").save(OUT_FRAMES / f"promo-{n:05d}.png")
        n += 1

    out = ASSETS / "promo-1920x1080.mp4"
    # The music is faded in and out and cut to the picture; the track is longer
    # than the clip, so -shortest ends the file on the last frame.
    fade_out = max(0.0, total - 1.6)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-framerate", str(FPS), "-i", str(OUT_FRAMES / "promo-%05d.png"),
            "-i", str(MUSIC),
            "-af", f"afade=t=in:st=0:d=0.8,afade=t=out:st={fade_out:.2f}:d=1.6,volume=0.9",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            "-movflags", "+faststart", str(out),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"wrote {out} ({n} kare, {total:.1f} sn)")


if __name__ == "__main__":
    main()
