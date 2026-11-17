"""Gera dist-standalone/O-Paradoxo.html: um arquivo único que abre com dois cliques.
Uso: python scripts/standalone.py
"""
import base64, json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {'.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}
def data(p):
    p = pathlib.Path(p)
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode((ROOT / p).read_bytes()).decode()
def js_data(src):
    return "data:text/javascript;base64," + base64.b64encode(src.encode()).decode()

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'src/styles.css').read_text(encoding='utf-8')
css = re.sub(r'url\(\.\./(fonts/[^)]+)\)', lambda m: f'url({data(m.group(1))})', css)

# módulos: caminhos relativos viram especificadores do importmap
mods = {'app/main.js': 'src/main.js', 'app/sound.js': 'src/sound.js', 'app/world/world.js': 'src/world/world.js'}
imports = {
    'three': js_data((ROOT / 'vendor/three/three.module.min.js').read_text(encoding='utf-8')),
    'lenis': js_data((ROOT / 'vendor/lenis/lenis.mjs').read_text(encoding='utf-8')),
}
for spec, path in mods.items():
    src = (ROOT / path).read_text(encoding='utf-8')
    base = spec.rsplit('/', 1)[0]
    src = re.sub(r"""((?:from|import)\s*\(?\s*['"])\./([^'"]+)(['"])""", lambda m: m.group(1) + base + '/' + m.group(2) + m.group(3), src)
    imports[spec] = js_data(src)

# imagens: o WebGL não lê file:// direto, então tudo vira data URL
assets = {}
for d in ['img/paint', 'img/cut']:
    for f in sorted((ROOT / d).iterdir()):
        assets[f'{d}/{f.name}'] = data(f'{d}/{f.name}')
html = re.sub(r'(src|data-img)="(img/(?:paint|cut)/[^"]+)"', lambda m: f'{m.group(1)}="{assets[m.group(2)]}"', html)

html = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>', html, flags=re.S)
html = html.replace('<link rel="stylesheet" href="src/styles.css">', '<style>' + css + '</style>')
html = re.sub(r'<link rel="preload"[^>]+>\n', '', html)
html = html.replace('href="img/favicon.svg"', f'href="{data("img/favicon.svg")}"')
html = html.replace('<script type="module" src="src/main.js"></script>',
    '<script>window.__ASSETS=' + json.dumps(assets) + ';</script>\n<script type="module">import "app/main.js";</script>')
out = ROOT / 'dist-standalone'
out.mkdir(exist_ok=True)
(out / 'O-Paradoxo.html').write_text(html, encoding='utf-8')
print('ok', round(len(html) / 1e6, 2), 'MB')
