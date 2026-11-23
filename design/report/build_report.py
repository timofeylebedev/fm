#!/usr/bin/env python3
"""Builds a design report page: report-template.html + engine.js + data.json (+ pictures) → one self-contained HTML.

  python3 build_report.py data.json out.html [--template report-template.html] [--engine engine.js]

Pictures: any "src" in the data that is a relative path (shots/hero.jpg) is read next to data.json and embedded as a
data: URI, so the page works as one file (an artifact) and the pictures stay separate files in the repository.
Run it with python3 -I when the folder holds files you did not write."""
import base64, json, mimetypes, os, sys

def main():
    args = sys.argv[1:]
    if len(args) < 2: sys.exit(__doc__)
    data_path, out = args[0], args[1]
    here = os.path.dirname(os.path.abspath(__file__))
    opt = lambda name, default: args[args.index(name) + 1] if name in args else default
    tpl = open(opt('--template', os.path.join(here, 'report-template.html')), encoding='utf-8').read()
    eng = open(opt('--engine', os.path.join(here, 'engine.js')), encoding='utf-8').read()
    data = json.load(open(data_path, encoding='utf-8'))
    base = os.path.dirname(os.path.abspath(data_path))
    def embed(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == 'src' and isinstance(v, str) and not v.startswith(('data:', 'http')):
                    p = os.path.join(base, v); mt = mimetypes.guess_type(p)[0] or 'image/jpeg'
                    o[k] = f'data:{mt};base64,' + base64.b64encode(open(p, 'rb').read()).decode()
                else: embed(v)
        elif isinstance(o, list):
            for v in o: embed(v)
    embed(data)
    title = data.get('meta', {}).get('title_tag', 'Design Report')
    html = (tpl.replace('__TITLE__', title.replace('<', '&lt;'))
               .replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
               .replace('__ENGINE__', eng))
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{out}: {len(html) // 1024} KB')

if __name__ == '__main__': main()
