# 版701：起動した時に先に読みこむ絵の一覧（assets-list.js）を作る。絵を足したら、これを実行し直す：python3 tools_preload_list.py
import os, json
order = []
def add(d, exts=('.png', '.jpg', '.webp'), rec=True):
    for root, dirs, files in sorted(os.walk(d)):
        for f in sorted(files):
            if f.lower().endswith(exts): order.append(os.path.join(root, f).replace(os.sep, '/'))
        if not rec: break
add('icons'); add('cards'); add('img', rec=False); add('img/trophy'); add('img/venue'); add('img/title')
open('assets-list.js', 'w').write('// 版701：起動時に先に読みこむ絵（tools_preload_list.py で作る）\nwindow.DOT_PRELOAD = ' + json.dumps(order, ensure_ascii=False) + ';\n')
print(len(order))
