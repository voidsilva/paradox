"""Gera em dist-standalone/ um arquivo único por página, que abre com dois cliques:
  Paradoxo.html (as portas) · Paradoxo-O-Idiota.html · Paradoxo-Montaigne.html
Os links entre eles apontam para os arquivos irmãos, então mantenha os três na mesma pasta.
Uso: python scripts/standalone.py
"""
import base64, json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist-standalone'
MIME = {'.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png'}
NAMES = {'index.html': 'Paradoxo.html', 'idiota.html': 'Paradoxo-O-Idiota.html', 'montaigne.html': 'Paradoxo-Montaigne.html'}
IMG = r'(?:montaigne/)?img/(?:paint|cut)/[\w.-]+'

def data(p):
    p = pathlib.Path(p)
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode((ROOT / p).read_bytes()).decode()
def js_data(src):
    return "data:text/javascript;base64," + base64.b64encode(src.encode()).decode()
def css_inline(path):
    css = (ROOT / path).read_text(encoding='utf-8')
    base = (ROOT / path).parent
    return re.sub(r'url\((\.\./[^)"\']+)\)', lambda m: f'url({data((base / m.group(1)).resolve().relative_to(ROOT))})', css)

def build(page, mods=None, img_dirs=(), entry=None, extra=()):
    html = (ROOT / page).read_text(encoding='utf-8')
    # estilos
    for href in re.findall(r'<link rel="stylesheet" href="([^"]+)">', html):
        html = html.replace(f'<link rel="stylesheet" href="{href}">', '<style>' + css_inline(href) + '</style>')
    html = re.sub(r'<link rel="preload"[^>]+>\n', '', html)
    html = re.sub(r'(<link rel="icon" href=")([^"]+)(")', lambda m: m.group(1) + data(m.group(2)) + m.group(3), html)
    # imagens: o WebGL não lê file:// direto, então tudo vira data URL
    assets = {}
    for p in extra: assets[p] = data(p)
    for d in img_dirs:
        for f in sorted((ROOT / d).iterdir()):
            assets[f'{d}/{f.name}'] = data(f'{d}/{f.name}')
    def img(m):
        p = m.group(2)
        if p not in assets: assets[p] = data(p)
        return f'{m.group(1)}="{assets[p]}"'
    html = re.sub(rf'(src|data-img)="({IMG})"', img, html)
    # links entre as páginas
    html = re.sub(r'href="(index|idiota|montaigne)\.html"', lambda m: f'href="{NAMES[m.group(1) + ".html"]}"', html)
    # módulos: caminhos relativos viram especificadores do importmap
    if mods:
        imports = {
            'three': js_data((ROOT / 'vendor/three/three.module.min.js').read_text(encoding='utf-8')),
            'lenis': js_data((ROOT / 'vendor/lenis/lenis.mjs').read_text(encoding='utf-8')),
        }
        for spec, path in mods.items():
            src = (ROOT / path).read_text(encoding='utf-8')
            base = spec.rsplit('/', 1)[0]
            src = re.sub(r"""((?:from|import)\s*\(?\s*['"])\./([^'"]+)(['"])""", lambda m: m.group(1) + base + '/' + m.group(2) + m.group(3), src)
            imports[spec] = js_data(src)
        html = re.sub(r'<script type="importmap">.*?</script>', lambda m: '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>', html, flags=re.S)
    script = re.search(r'<script type="module" src="([^"]+)"></script>', html)
    body = f'import "{entry}";' if entry else (ROOT / script.group(1)).read_text(encoding='utf-8')
    html = html.replace(script.group(0), '<script>window.__ASSETS=' + json.dumps(assets) + ';</script>\n<script type="module">' + body + '</script>')
    OUT.mkdir(exist_ok=True)
    (OUT / NAMES[page]).write_text(html, encoding='utf-8')
    print(NAMES[page], round(len(html) / 1e6, 2), 'MB')

build('index.html', {'lobby/lobby.js': 'lobby/lobby.js', 'lobby/world.js': 'lobby/world.js', 'lobby/sound.js': 'lobby/sound.js'}, ['lobby/img'], 'lobby/lobby.js',
      ['img/paint/p15-rua.jpg', 'img/cut/p01-retrato.webp', 'montaigne/img/paint/m15-praia.jpg', 'montaigne/img/cut/m09-horizonte.webp'])
build('idiota.html', {'app/main.js': 'src/main.js', 'app/sound.js': 'src/sound.js', 'app/world/world.js': 'src/world/world.js', 'app/core/core.js': 'src/core/core.js'},
      ['img/paint', 'img/cut'], 'app/main.js')
build('montaigne.html', {'app/main.js': 'montaigne/src/main.js', 'app/hold.js': 'montaigne/src/hold.js', 'app/dust.js': 'montaigne/src/dust.js', 'shared/sound.js': 'src/sound.js'},
      ['montaigne/img/paint', 'montaigne/img/cut'], 'app/main.js')
