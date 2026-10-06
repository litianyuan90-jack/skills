"""Copy only the @fontsource unicode-range slices that the page actually uses.

Usage: python3 -I build_fonts.py <node_modules/@fontsource> <web_dir> [extra text files...]
"""
import re
import shutil
import sys
from pathlib import Path

FS = Path(sys.argv[1])
WEB = Path(sys.argv[2])
OUT = WEB / "fonts"
OUT.mkdir(exist_ok=True)

text = ""
for f in [WEB / "index.html", WEB / "main.js", WEB / "film.js", *map(Path, sys.argv[3:])]:
    if f.exists():
        text += f.read_text(encoding="utf-8")
used = {ord(c) for c in text}

FAMILIES = [
    # (fontsource package, css file, family alias)
    ("noto-serif-sc", "300.css", "ZhaoSerif"),
    ("noto-serif-sc", "500.css", "ZhaoSerif"),
    ("ma-shan-zheng", "400.css", "ZhaoBrush"),
    ("cormorant-garamond", "400-italic.css", "ZhaoLatin"),
    ("cormorant-garamond", "500.css", "ZhaoLatin"),
]


def parse_range(r):
    out = []
    for part in r.split(","):
        part = part.strip().replace("U+", "")
        if "-" in part:
            a, b = part.split("-")
            out.append((int(a, 16), int(b, 16)))
        elif "?" in part:
            out.append((int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)))
        else:
            out.append((int(part, 16), int(part, 16)))
    return out


css_out = []
copied = 0
for pkg, css, alias in FAMILIES:
    src = (FS / pkg / css).read_text()
    for block in re.findall(r"@font-face\s*{[^}]*}", src):
        m = re.search(r"unicode-range:\s*([^;]+);", block)
        if m:
            ranges = parse_range(m.group(1))
            if not any(a <= c <= b for c in used for a, b in ranges):
                continue
        url = re.search(r"url\(\.?/?files/([^)]+\.woff2)\)", block).group(1)
        shutil.copy(FS / pkg / "files" / url, OUT / url)
        copied += 1
        block = re.sub(r"font-family:\s*'[^']+'", f"font-family: '{alias}'", block)
        block = re.sub(r"src:[^;]+;", f"src: url(./{url}) format('woff2');", block)
        css_out.append(block)

(OUT / "fonts.css").write_text("\n".join(css_out) + "\n")
print(f"{copied} font slices, {sum(p.stat().st_size for p in OUT.glob('*.woff2')) // 1024} KB")
