"""Build the 1024x500 Play feature graphic.

Drawn here rather than by an image model, which garbles Turkish letters: the
art is a crossword grid in the app's own purple, the title sits left of centre
and Duman comes in from the right, with Play's safe margins kept clear.

    python scripts/make_feature_graphic.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# The Windows console is cp1252 by default and Turkish file names break print().
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "store-assets-originals"
CATS = ROOT / "public" / "cats"

W, H = 1024, 500
PURPLE = (111, 90, 235)
PURPLE_DEEP = (72, 52, 190)
CREAM = (247, 243, 234)
AMBER = (247, 183, 49)
INK = (46, 36, 90)

TITLE = "Çengel Bulmaca"
SUB = "200 bulmaca · her gün yeni"
TITLE_FONT = r"C:\Windows\Fonts\seguibl.ttf"
SUB_FONT = r"C:\Windows\Fonts\seguisb.ttf"

# A slice of a real grid: filled cells spell the game's own subject.
CELLS = [
    "ÇENGEL##",
    "#O#K#O#B",
    "#BULMACA",
    "#U#S#T#Ş",
    "KEDİ##DÜ",
]


def background() -> Image.Image:
    """Vertical purple wash, so the title has a calm field to sit on."""
    bg = Image.new("RGB", (W, H), PURPLE)
    top = Image.new("RGB", (W, H), PURPLE_DEEP)
    mask = Image.linear_gradient("L").resize((W, H))
    return Image.composite(bg, top, mask)


def grid(img: Image.Image) -> None:
    """Draws the crossword slice on the right half, tilted away from the text."""
    cell = 74
    layer = Image.new("RGBA", (cell * 8 + 8, cell * len(CELLS) + 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = ImageFont.truetype(TITLE_FONT, 42)
    for r, row in enumerate(CELLS):
        for c, ch in enumerate(row):
            box = [c * cell + 4, r * cell + 4, (c + 1) * cell, (r + 1) * cell]
            if ch == "#":
                draw.rounded_rectangle(box, 10, fill=(255, 255, 255, 28))
                continue
            draw.rounded_rectangle(box, 10, fill=(253, 251, 245, 235))
            w = draw.textlength(ch, font=font)
            draw.text(
                (box[0] + (cell - 4 - w) / 2, box[1] + 8),
                ch,
                font=font,
                fill=INK,
            )
    layer = layer.rotate(-8, resample=Image.BICUBIC, expand=True)
    img.paste(layer, (W - layer.width + 150, (H - layer.height) // 2), layer)

    # The left third is dimmed back down so the title never has to compete with
    # the grid letters running under it.
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = scrim.load()
    for x in range(W):
        a = max(0, round(150 * (1 - x / 640)))
        for y in range(H):
            px[x, y] = (52, 36, 128, a)
    img.paste(Image.alpha_composite(img.convert("RGBA"), scrim).convert("RGB"), (0, 0))


def cat(img: Image.Image) -> None:
    duman = Image.open(CATS / "duman.png").convert("RGBA")
    duman = duman.crop(duman.getbbox())
    h = 330
    duman = duman.resize((round(duman.width * h / duman.height), h), Image.LANCZOS)
    shadow = Image.new("RGBA", duman.size, (0, 0, 0, 0))
    shadow.paste((20, 12, 60, 120), (0, 0), duman)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    pos = (W - duman.width - 26, H - h - 10)
    img.paste(shadow, (pos[0], pos[1] + 10), shadow)
    img.paste(duman, pos, duman)


def title(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    size = 84
    font = ImageFont.truetype(TITLE_FONT, size)
    while draw.textlength(TITLE, font=font) > 560 and size > 40:
        size -= 2
        font = ImageFont.truetype(TITLE_FONT, size)
    sub_font = ImageFont.truetype(SUB_FONT, 30)

    x, y = 62, H / 2 - size
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), TITLE, font=font, fill=(255, 240, 200, 190))
    img.paste(
        Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(16))).convert("RGB"),
        (0, 0),
    )

    draw = ImageDraw.Draw(img)
    draw.text((x, y), TITLE, font=font, fill=CREAM, stroke_width=5, stroke_fill=(40, 28, 96))
    draw.rectangle([x + 4, y + size * 1.35, x + 150, y + size * 1.35 + 8], fill=AMBER)
    draw.text((x, y + size * 1.55), SUB, font=sub_font, fill=(226, 219, 255))


def main() -> None:
    img = background()
    grid(img)
    title(img)
    cat(img)
    ASSETS.mkdir(parents=True, exist_ok=True)
    out = ASSETS / "feature_graphic_1024x500.png"
    img.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
