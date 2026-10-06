"""Bundle web/ into a hosted-page build (dist/).

- three.js comes from the jsDelivr CDN via the import map
- main.js is inlined as a module script
- fonts come from Google Fonts (same families as the local slices)
- textures stay as files next to the page
Usage: python3 -I build_artifact.py <web_dir> <dist_dir>
"""
import re
import shutil
import sys
from pathlib import Path

WEB, DIST = Path(sys.argv[1]), Path(sys.argv[2])
DIST.mkdir(parents=True, exist_ok=True)

html = (WEB / "index.html").read_text(encoding="utf-8")
js = (WEB / "main.js").read_text(encoding="utf-8")

# the publishing skeleton supplies doctype/html/head/body
html = re.sub(r"<!doctype html>\s*<html[^>]*>\s*<head>\s*", "", html, flags=re.I)
html = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', "", html)
html = html.replace("</head>\n<body>\n", "").replace("</body>\n</html>\n", "")

fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,400'
         '&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@300;500&display=swap">')
html = html.replace('<link rel="stylesheet" href="fonts/fonts.css">', fonts)
html = html.replace('{ "imports": { "three": "./three.module.min.js" } }',
                    '{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js" } }')
html = html.replace('<script type="module" src="main.js"></script>', f'<script type="module">\n{js}\n</script>')

(DIST / "index.html").write_text(html, encoding="utf-8")
if (DIST / "tex").exists():
    shutil.rmtree(DIST / "tex")
shutil.copytree(WEB / "tex", DIST / "tex")
print("dist ready:", sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file()) // 1024, "KB")
