"""Makes the web fonts of the site from the originals in assets-src/fonts (run: npm run fonts).

Each font is cut down to the characters a Russian and English page can need (so nothing is missing when the
texts change), keeps all its OpenType features (tabular digits, kerning…), and is saved as WOFF2 in
src/assets/fonts. Needs Python 3 with fonttools and brotli: pip install fonttools brotli
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "assets-src" / "fonts", ROOT / "src" / "assets" / "fonts"
FONTS = {  # original file → name on the site
    "golos-text-400.woff2": "golos-400.woff2",
    "golos-text-500.woff2": "golos-500.woff2",
    "golos-text-600.woff2": "golos-600.woff2",
    "pragmatica-ext-bold-700.woff2": "pragmatica-ext-700.woff2",
}
UNICODES = [
    *range(0x20, 0x7F),                 # Basic Latin
    *range(0xA0, 0x100),                # Latin-1: no-break space, «», ©, °, ×, accented letters…
    *range(0x400, 0x460), 0x490, 0x491, # Cyrillic
    *range(0x2010, 0x2028),             # dashes, quotes, bullets, ellipsis
    0x2030, 0x2039, 0x203A, 0x2116, 0x2122, 0x2212,   # ‰ ‹ › № ™ minus
    0x20AC, 0x20B8, 0x20BD, 0x2190, 0x2192,           # € ₸ ₽ ← →
]

OUT.mkdir(parents=True, exist_ok=True)
for src, out in FONTS.items():
    options = subset.Options()
    options.layout_features = ["*"]     # keep every feature
    options.flavor = "woff2"
    options.name_IDs = [1, 2, 4, 6]     # family and style names only
    options.notdef_outline = True
    options.hinting = True              # kept: Windows draws small text with it
    font = TTFont(SRC / src)
    sub = subset.Subsetter(options)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(OUT / out)
    print(f"{out}: {(SRC / src).stat().st_size // 1024} KB → {(OUT / out).stat().st_size // 1024} KB")

# The stand-in fonts of fonts.css (Arial sized like each font, so nothing moves when the font arrives): the numbers to
# put there, worked out from a sample of the page's text. Needs a font with Arial's metrics (Arial or Liberation Sans).
SAMPLE = "Порядок в релизах и проектах, правах и документах, роялти и платежах Весь лейбл на одной волне Flow Medium Запланировать демо"
ARIAL = {400: ["/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"],
         700: ["/Library/Fonts/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]}

def width(font):
    cmap, hmtx, upm = font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(c)]][0] for c in SAMPLE if ord(c) in cmap) / upm

for out, weight in (("golos-400.woff2", 400), ("pragmatica-ext-700.woff2", 700)):
    arial = next((p for p in ARIAL[weight] if Path(p).exists()), None)
    if not arial:
        continue
    font, ref = TTFont(OUT / out), TTFont(arial)
    k, hh, upm = width(font) / width(ref), font["hhea"], font["head"].unitsPerEm
    print(f"{out} stand-in: size-adjust: {k * 100:.1f}%; ascent-override: {hh.ascent / upm / k * 100:.1f}%; "
          f"descent-override: {-hh.descent / upm / k * 100:.1f}%; line-gap-override: {hh.lineGap / upm / k * 100:.1f}%;")
