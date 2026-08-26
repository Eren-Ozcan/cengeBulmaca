"""Compose the Play Store screenshots: gameplay on top, a caption band below.

Every puzzle game on the store does this — a coloured band with a short
ALL-CAPS promise and a character cut-out, never a bare screenshot. This builds
ours from the renders produced by `node scripts/showcase.mjs shots` plus the
guardian-cat portraits the game already ships, so the whole set can be rebuilt
(or re-worded) with one command:

    python scripts/make_store_shots.py              # phone, from raw/
    python scripts/make_store_shots.py --tablet     # from raw-tablet/

Inputs and outputs both live in docs/store-assets-originals/, which is
gitignored; the finished files are copied into the private pictures repo.

The captions are written already upper-cased by hand: Python's str.upper() is
locale-independent and turns "i" into "I", which is wrong in Turkish.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# The Windows console is cp1252 by default and Turkish file names break print().
sys.stdout.reconfigure(encoding="utf-8")

ASSETS = Path(__file__).resolve().parent.parent / "docs" / "store-assets-originals"
CATS = Path(__file__).resolve().parent.parent / "public" / "cats"

TABLET = "--tablet" in sys.argv
W, H = (1600, 2560) if TABLET else (1080, 1920)
BAND_H = round(H * 0.17)
# Past this the band would dwarf the screenshot; a screen shorter than that is
# cropped instead.
BAND_MAX = round(H * 0.36)
SCALE = W / 1080

# The app's own palette: the daily card's purple, its cream background and the
# amber of the streak chip.
PURPLE = (111, 90, 235)
DEEP = (46, 36, 90)
CREAM = (247, 243, 234)
AMBER = (247, 183, 49)

TITLE_FONT = r"C:\Windows\Fonts\seguibl.ttf"

# (render, caption, cat cut-out or None)
SHOTS = [
    ("01_home.png", "HER GÜN YENİ BULMACA", "duman.png"),
    ("02_grid.png", "KLASİK ÇENGEL FORMATI", None),
    ("03_word_solved.png", "200 BULMACA, 3600+ SORU", None),
    ("04_cats.png", "ANADOLU'NUN BEKÇİ KEDİLERİ", "zeytin.png"),
    ("05_map.png", "HARİTADA YOLCULUĞA ÇIK", "yayla.png"),
    ("06_puzzle_list.png", "KOLAYDAN ZORA İLERLE", None),
    ("07_newspaper_theme.png", "GAZETE TEMASI", None),
    ("08_completed.png", "SERİNİ BOZMA", "duman.png"),
]


def content_bottom(img: Image.Image) -> int:
    """The last row that still shows something, in a screen that ends in blank.

    The album and the map paint their own background all the way down, so "where
    the screen ends" is not the image height — it is the last row that differs
    from the colour filling the bottom edge. Without this the caption band sits
    under a slab of empty cream.
    """
    px = img.convert("RGB").load()
    tail = px[img.width // 2, img.height - 1]
    for y in range(img.height - 1, -1, -1):
        row = [px[x, y] for x in range(0, img.width, 8)]
        if max(abs(c - t) for p in row for c, t in zip(p, tail)) > 12:
            return min(img.height, y + round(24 * SCALE))
    return img.height


def fit(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale to the target width and keep the top, padding if it comes up short.

    Width is what must never be cut: these are screenshots of a grid, and losing
    the left or right column of cells is worse than losing the bottom row.
    """
    scale = w / img.width
    img = img.resize((w, round(img.height * scale)), Image.LANCZOS)
    if img.height >= h:
        return img.crop((0, 0, w, h))
    # A screen with little content (the map) is centred in what is left rather
    # than pinned to the top, which would leave the empty half under it.
    pad = Image.new("RGB", (w, h), img.getpixel((w // 2, img.height - 1)))
    pad.paste(img, (0, (h - img.height) // 2))
    return pad


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        probe = (cur + " " + word).strip()
        if draw.textlength(probe, font=font) <= max_w or not cur:
            cur = probe
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def cutout(name: str, height: int) -> Image.Image:
    """A cat portrait trimmed to its own ink, so it sits on the band edge."""
    cat = Image.open(CATS / name).convert("RGBA")
    cat = cat.crop(cat.getbbox())
    return cat.resize((round(cat.width * height / cat.height), height), Image.LANCZOS)


def build(source: str, caption: str, cat: str | None, index: int, out_dir: Path) -> Path:
    raw = Image.open(ASSETS / source).convert("RGB")
    bottom = content_bottom(raw)
    raw = raw.crop((0, 0, raw.width, bottom))
    # A screen that ends early gives its leftover height to the caption band
    # instead of padding the frame with empty background.
    band_h = min(BAND_MAX, max(BAND_H, H - round(bottom * W / raw.width)))
    shot = fit(raw, W, H - band_h)
    canvas = Image.new("RGB", (W, H), DEEP)
    canvas.paste(shot, (0, 0))
    draw = ImageDraw.Draw(canvas)

    # The band is the app's purple with the streak amber as a hairline, so the
    # frame reads as part of the game rather than a sticker on top of it.
    draw.rectangle([0, H - band_h, W, H], fill=PURPLE)
    draw.rectangle([0, H - band_h, W, H - band_h + round(7 * SCALE)], fill=AMBER)

    text_left = round(46 * SCALE)
    if cat:
        # Overhangs the band on purpose, but never grows with it: on a screen
        # that gave the band most of its height the cat would take over.
        cut = cutout(cat, min(band_h, BAND_H) + round(70 * SCALE))
        canvas.paste(cut, (round(28 * SCALE), H - cut.height), cut)
        text_left = round(28 * SCALE) + cut.width + round(26 * SCALE)

    max_w = W - text_left - round(46 * SCALE)
    size = round(92 * SCALE)
    while size > round(30 * SCALE):
        font = ImageFont.truetype(TITLE_FONT, size)
        lines = wrap(draw, caption, font, max_w)
        if len(lines) <= 2:
            break
        size -= 4
    line_h = size * 1.12
    y = H - band_h + (band_h - line_h * len(lines)) / 2 - round(6 * SCALE)
    for line in lines:
        draw.text((text_left, y), line, font=font, fill=CREAM)
        y += line_h

    slug = source.split("_", 1)[1].removesuffix(".png")
    path = out_dir / f"{index:02d}_{slug}.png"
    canvas.save(path)
    return path


def main() -> None:
    src = ASSETS / ("raw-tablet" if TABLET else "raw")
    out_dir = ASSETS / ("play-tablet" if TABLET else "play")
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, (source, caption, cat) in enumerate(SHOTS, start=1):
        if not (src / source).exists():
            print("atlandı (render yok):", source)
            continue
        print("wrote", build(str(Path(src.name) / source), caption, cat, i, out_dir).name)


if __name__ == "__main__":
    main()
