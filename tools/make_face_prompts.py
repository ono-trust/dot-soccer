# 選手の顔：GPTに頼むプロンプトのページを作る（国内屈指・エース・中心選手は1人ずつ違う顔、ほかは「ふつうの顔」の素材）
# 出力：face-prompts.html（コピーボタン付き）と face_plan.json（どの画像のどのマスが誰か）
import json, hashlib, html, sys
stars = json.load(open(sys.argv[1]))
OUT_HTML, OUT_PLAN = sys.argv[2], sys.argv[3]
LGN = {'d1': 'D1', 'd2': 'D2', 'd3': 'D3', 'regE1': '地域1部東', 'regW1': '地域1部西', 'regE2': '地域2部東', 'regW2': '地域2部西'}
LGO = ['d1', 'd2', 'd3', 'regE1', 'regW1', 'regE2', 'regW2']
def h(s): return int(hashlib.md5(s.encode()).hexdigest(), 16)
isjp = lambda n: all('ぁ' <= c <= 'ゖ' or c == 'ー' for c in n)

HAIR = ['坊主に近いベリーショート', 'ソフトモヒカン', 'サイドを刈り上げた短髪', 'ツーブロック', '目にかかる長めの前髪', 'センター分けのさらさら髪', 'オールバック', '肩まで届く長髪をハーフアップ', 'ドレッドヘア', '細かい編み込み（コーンロウ）', 'くるくるのパーマ', 'ツンツンに立てた髪', 'きっちりした七三分け', '後ろで小さく結んだ長髪', 'ボリュームのあるアフロ', 'マッシュルームカット', '片側だけ刈り上げたアシンメトリー', '前髪を上げたアップバング', '襟足の長いウルフカット', '角刈り', 'ふわっとした無造作ヘア', 'ヘアバンドで前髪を上げた髪']
COLOR_STAR = ['燃えるような赤', 'あざやかな青', 'エメラルドのような緑', 'まぶしい金髪', '銀髪', 'ピンク', '紫', 'オレンジ', '真っ白', '黒髪に赤いメッシュ', '黒髪に青いメッシュ', '金髪に毛先だけ黒']
COLOR_PLAIN = ['黒', '黒', 'こげ茶', '茶色', '明るい茶色']
SHAPE = ['丸顔', '面長', 'エラの張った四角い顔', 'あごの細い逆三角の顔', '首の太いがっしりした顔', '頬骨の高いシャープな顔']
EYES = ['きりっとしたつり目', 'やさしいたれ目', '細い糸目', '大きなぱっちりした目', '鋭い三白眼', '眠そうな半分閉じた目', '二重のくっきりした目']
BROW = ['太いゲジ眉', '細く整えた眉', '薄い眉', '片方の眉に傷のある眉', '八の字の困り眉', 'まっすぐな太眉']
EXTRA = ['あごひげ', '口ひげとあごひげ', 'うっすら無精ひげ', 'そばかす', '頬に絆創膏', '鼻すじに小さな傷', '片耳にピアス', 'よく日焼けした肌', '目の下にほくろ', '八重歯が見える', '大きな耳', 'ごつい鼻', 'えくぼ', '特になし']
EXPR = ['不敵な笑み', 'まっすぐ前を見すえた真剣な顔', 'にかっと歯を見せて笑う', '表情を変えないクールな顔', '歯を食いしばった闘志むき出しの顔', '涼しげな微笑み', '自信たっぷりのドヤ顔', 'ぼーっとした顔']
SKIN = ['明るい肌', 'ふつうの肌', '褐色の肌']
FOREIGN_LOOK = ['南米系の彫りの深い顔', 'ヨーロッパ系の彫りの深い顔', 'アフリカ系の顔立ち', 'ヨーロッパ系の顔立ちで青い目', '南米系の褐色の肌']

def pick(lst, key): return lst[h(key) % len(lst)]
# 格による雰囲気：強い選手ほど「目力・自信・オーラ」。モブは目立たない普通の人
AURA_TOP = [('王者の風格。何もしなくても周りを従わせる存在感', '堂々と前を見すえる、落ち着いた表情'), ('獲物を狙う獣のような、ぎらついた野性味', '歯を見せて獰猛に笑う'), ('何を考えているか読めない、底知れないクールな天才', '一切表情を変えない冷たい顔'), ('燃えるような闘志があふれ出る熱血漢', '歯を食いしばった、闘志むき出しの顔'), ('静かだが目だけが異様に鋭い、職人のような凄み', '口を結び、目だけで圧をかける顔'), ('余裕たっぷりで相手を見下ろす、ふてぶてしい自信', '口の端だけ上げた不敵な笑み'), ('近寄りがたいほどの威圧感をまとった番人', '相手をにらみつける鋭い顔'), ('人なつこい笑顔の奥に、勝負師の怖さがある', 'にこやかだが目が笑っていない顔')]
AURA_ACE = [('チームを背負う絶対的エースの風格', '自信に満ちた、相手を見下ろす目'), ('点を取ることしか考えていない、飢えた獣', '歯を見せて獰猛に笑う'), ('氷のように冷静な、天才肌の司令塔', '一切表情を変えない冷たい目'), ('ギラギラした野心家。もっと上へ行く気しかない', 'にやりと笑う不敵な顔'), ('華があり、ピッチの空気を変えるスター', '余裕たっぷりの笑み'), ('口数は少ないが、目に宿る闘志が異様に強い', '口を結び、射抜くような目'), ('相手を挑発して楽しむ、ふてぶてしいエース', '口の端だけ上げた挑発的な笑み'), ('仲間を鼓舞する、熱いキャプテン', '大きく口を開けて吠える顔')]
AURA_CORE = [('試合を読む、冷静で鋭い頭脳派', '目を細めて相手を観察する顔'), ('泥くさく体を張る、闘志の塊', '歯を食いしばった気迫の顔'), ('口数は少ないが、目に強い意志がある', '口を結び、まっすぐ射抜くような目'), ('勝負どころで牙をむく、野心家', '片方の口角を上げた不敵な顔'), ('チームを支える、どっしりした兄貴分', '腕に自信のある、余裕の笑み'), ('負けず嫌いで、ぎらついた若き挑戦者', '眉を吊り上げた挑むような顔'), ('静かに燃える、職人肌の仕事人', '感情を見せない、冷たく鋭い目'), ('ピッチの上で人が変わる、スイッチの入った顔', '瞳孔が開いたような集中した顔')]
BROW_STAR = ['太いゲジ眉', '細く整えた眉', '鋭く吊り上がった眉', '片方の眉に傷のある眉', 'まっすぐな太眉', '薄く鋭い眉']
EYES_STAR = ['きりっとしたつり目で強い目力', '鋭い三白眼', '切れ長の鋭い目', '大きく見開いた、ぎらつく目', 'まぶたが重く、冷たく見下ろす目', '二重のくっきりした、まっすぐな目']
EXPR_TOP = ['口の端だけ上げた不敵な笑み', '相手をにらみつける鋭い顔', '自信たっぷりのドヤ顔', '歯を見せて獰猛に笑う', '一切表情を変えない冷たい顔', '静かに燃える真剣な顔']
EXPR_MOB = ['ふつうの穏やかな顔', 'ちょっと緊張した顔', 'にこっと笑う顔', '口を結んだ真面目な顔', 'ぽかんとした顔', '少し自信なさげな顔']
EXTRA_MOB = ['特になし', '特になし', '特になし', 'そばかす', '大きな耳', 'えくぼ', '目の下にほくろ', 'よく日焼けした肌']
used = set()
def star_look(p):
    k = f"{p['tid']}|{p['name']}"
    rate = 70 if p['top'] else 50 if p['role'] == 'ace' else 25
    for t in range(50):
        kk = k + '|' + str(t)
        colorful = h(kk + 'c') % 100 < rate
        hair, col = pick(HAIR, kk + 'h'), pick(COLOR_STAR if colorful else COLOR_PLAIN, kk + 'col')
        if (hair, col) not in used: used.add((hair, col)); break
    age = p['age']
    extra = pick(EXTRA, k + 'x')
    if age <= 20 and 'ひげ' in extra: extra = 'そばかす'
    look = {
        'hair': hair, 'col': col, 'shape': pick(SHAPE, k + 's'),
        'eyes': pick(EYES_STAR, k + 'e'), 'brow': pick(BROW_STAR, k + 'b'),
        'extra': extra,
        'aura': pick(AURA_TOP if p['top'] else AURA_ACE if p['role'] == 'ace' else AURA_CORE, k + 'a'), 'skin': '褐色の肌' if p['skin'] == 2 else pick(SKIN[:2], k + 'k'),
        'race': None if isjp(p['name']) else pick(FOREIGN_LOOK, k + 'r'),
        'gk': p['pos'] == 'GK',
    }
    look['expr'] = look['aura'][1]; look['aura'] = look['aura'][0]
    return look
def star_line(i, p, L):
    who = ('国内屈指の' + p['top']) if p['top'] else ('エース・' + p['type']) if p['role'] == 'ace' else ('中心選手・' + p['type'])
    face = f"{L['race']}、" if L['race'] else ''
    age = f"{p['age']}歳" + ('（若手らしい幼さ）' if p['age'] <= 20 else '（ベテランらしい渋さ）' if p['age'] >= 31 else '')
    gk = '・ゴールキーパー（ユニフォームは同じでよい）' if L['gk'] else ''
    return f"{i}. {p['name']}（{p['team']}／{who}{gk}）{age}：【雰囲気】{L['aura']}。{face}{L['shape']}、{'' if (L['race'] and '肌' in L['race']) else L['skin'] + '、'}髪は「{L['col']}の{L['hair']}」、{L['eyes']}、{L['brow']}、{L['expr']}" + ('' if L['extra'] == '特になし' else f"、{L['extra']}")

STYLE = """【絵のタッチ（全員共通・とても大事）】
・熱いサッカー漫画・スポーツアニメのような、迫力のある絵。くっきりした黒い線と、強いコントラストの影（あご下・首・髪の下にしっかり濃い影）
・目に強い光（ハイライト）を入れ、目つきで「この選手は強い」と伝わるようにする。眉・目・口元の表情を大げさなくらいはっきり描く
・かわいい・ゆるい・ほのぼのした絵柄にはしない。全員が「勝負の顔」をしている
・1人1人の顔は「明らかに別人」と分かるように描き分ける。顔の形・骨格・目・眉・鼻・口・髪型・髪の色・表情をすべて変える。全員が同じ顔に髪だけ違う、は絶対にだめ
・カラフルな髪色（赤・青・緑・ピンクなど）の選手は、その色をはっきり鮮やかに塗る
・ユニフォームは全員同じ：無地の青いサッカーシャツに、白いV字の襟（あとでゲーム側でチームの色に塗り替えるので、柄やロゴやマークは入れない）
・実在の人物・実在のサッカー選手・既存の漫画やアニメのキャラクターに似せない（完全オリジナル）

【構図（全員まったく同じにする・とても大事）】
・1マスは正方形。その中に1人だけ。正面を向いたバストアップ（顔・首・両肩・胸の上まで）
・頭の大きさを全員同じにする（顔の横幅がマスの横幅の約3分の1）
・髪のいちばん上は、マスの上のふちから少し下（マスの高さの1割くらいの余白を空ける）。髪の大きい選手は、頭を小さくせず余白で調整する
・あごは、マスのまん中より少し下
・両肩はマスの横幅の8割くらいまで広げ、がっしりした広い肩にする。肩がマスの外にはみ出さない
・シャツはマスのいちばん下のふちで、まっすぐ横に切れる（胸の上まで）
・となりのマスの人と、髪・肩がくっつかないようにする"""

def sheet_prompt(title, lines, cols, rows, intro):
    n = len(lines); empty = cols * rows - n
    emp = f"\n・最後の{empty}マスは何も描かずに空けておく" if empty else ''
    return f"""サッカーゲームの選手の顔イラストを、{n}人分まとめて1枚の画像に作ってください。
{intro}

【並べ方】
・横{cols}列×縦{rows}行の、同じ大きさの正方形のマス目に、下の番号の順で1人ずつ並べる（左上から右へ、上の段→下の段）{emp}
・マス目の線・番号・名前などの文字は描かない

{STYLE}

【形式】
・横長 1536×1024（正方形のマスが横3つ×縦2つ）
・背景は完全に透明（透過PNG）。影やふちどりの光もなし

【選手の一覧（この順番で並べる）】
""" + '\n'.join(lines)

# 並び：国内屈指 → エース（リーグ順） → 中心選手（リーグ順）
tops = [p for p in stars if p['top']]
aces = [p for p in stars if not p['top'] and p['role'] == 'ace']
cores = [p for p in stars if not p['top'] and p['role'] != 'ace']
key = lambda p: (LGO.index(p['lg']), p['team'], p['no'])
aces.sort(key=key); cores.sort(key=key)
TYPE_ORDER = ['ストライカー', 'アタッカー', 'ゲームメイカー', 'パサー', 'レジスタ', 'ダイナモ', 'スイーパー', 'ストッパー', 'マンマーカー', 'ラインコントローラー', 'ゴールキーパー']
tops.sort(key=lambda p: TYPE_ORDER.index(p['top']))
sheets, plan = [], []
def add(group, title, ps, cols, rows, intro):
    for s in range(0, len(ps), cols * rows):
        chunk = ps[s:s + cols * rows]; no = len(sheets) + 1
        fname = f'face_{no:02d}.png'
        lines = [star_line(i + 1, p, star_look(p)) for i, p in enumerate(chunk)]
        sheets.append((fname, f'{title}（{len(chunk)}人）', group, sheet_prompt(title, lines, cols, rows, intro)))
        plan.append({'file': fname, 'cols': cols, 'rows': rows, 'players': [{'tid': p['tid'], 'no': p['no'], 'name': p['name']} for p in chunk]})
add('国内屈指', '国内屈指の11人', tops, 3, 2, '国内でいちばんの選手たちです。ゲームの看板になる選手なので、一目で覚えられる、とびきり個性的でかっこいい顔にしてください。\n髪型や髪の色だけでなく、表情・目つき・顔つきから「この人は只者じゃない」という強者のオーラが伝わるようにしてください。各選手の【雰囲気】を、いちばん大事にしてください。')
add('エース', 'チームのエース', aces, 3, 2, 'それぞれのチームのエースです。そのチームの顔になる、覚えやすい個性的な顔にしてください。\n目力と表情で「チームでいちばん上手い選手」の自信や存在感が伝わるようにしてください。各選手の【雰囲気】を大事にしてください。')
add('中心選手', 'チームの中心選手', cores, 3, 2, 'それぞれのチームの中心選手です。主役級の存在感がある、熱い勝負の顔にしてください。目つき・表情から、それぞれの【雰囲気】がはっきり伝わるようにしてください。')
# ふつうの選手（その他おおぜい用）：髪は黒・茶（ゲームで色を塗り替える）
gen = []
for i in range(54):
    k = f'gen|{i}'
    L = {'hair': pick(['短髪', 'ふつうの短髪', 'スポーツ刈り', '坊主', '少し長めの髪', '前髪をおろした髪', 'ゆるいくせ毛', '横分けの髪'], k + 'h'), 'shape': pick(SHAPE, k + 's'), 'eyes': pick(['ふつうの目', '小さめの目', 'やさしいたれ目', '細い目', '丸い目'], k + 'e'), 'brow': pick(['ふつうの眉', '薄い眉', '細い眉', '八の字の眉'], k + 'b'), 'expr': pick(EXPR_MOB, k + 'p'), 'extra': pick(EXTRA_MOB, k + 'x'), 'race': pick(FOREIGN_LOOK, k + 'r') if i % 9 == 8 else None}
    gen.append(f"{(i % 6) + 1}. {L['race'] + '、' if L['race'] else ''}{L['shape']}、黒か濃い茶色の「{L['hair']}」、{L['eyes']}、{L['brow']}、{L['expr']}" + ('' if L['extra'] == '特になし' else f"、{L['extra']}"))
for s in range(0, 54, 6):
    no = len(sheets) + 1; fname = f'face_{no:02d}.png'
    sheets.append((fname, f'ふつうの選手（6人）', 'ふつうの選手', sheet_prompt('ふつうの選手', gen[s:s + 6], 3, 2, 'その他おおぜいの選手（モブ）用の顔です。※このシートだけは、線・塗り・構図は同じにして、表情はふつうにする（勝負の顔・強い目の光・濃い影はいらない）。どこにでもいそうな、ふつうの選手にしてください。オーラ・鋭い目つき・派手な髪型・傷などの目立つ特徴は入れない。ただし、全員はっきり別人に見えるように、顔の形・目・鼻・口・髪型は描き分けてください。髪は黒か濃い茶色にしてください（あとでゲーム側で髪の色を変えます）。')))
    plan.append({'file': fname, 'cols': 3, 'rows': 2, 'generic': 6})
json.dump(plan, open(OUT_PLAN, 'w'), ensure_ascii=False, indent=1)

FIRST = """これから、サッカー育成ゲームの「選手の顔イラスト」を、何枚かに分けてたくさんお願いします。
添付した画像は「絵のタッチ」の見本です（くっきりした線・強い影・目の光・青いシャツに白い襟・透明の背景）。この見本と同じ人が描いたように、タッチをそろえてください。
ただし、顔は見本に似せず、1人ずつ「明らかに別人」に描き分けてください。構図（頭の大きさ・位置・肩幅）は、毎回のプロンプトの【構図】の指示に正確に合わせてください。
このメッセージでは画像は作らず、「了解」とだけ返してください。"""

esc = lambda x: html.escape(x, quote=True)
def card(fname, title, sub, prompt):
    return f'''<article class="card"><header><div class="ttl"><h3>{esc(title)}</h3><p>{esc(sub)}</p></div><div class="fn"><span>保存するファイル名</span><code>{esc(fname)}</code></div></header><details><summary>プロンプトを見る</summary><pre>{esc(prompt)}</pre></details><button class="cp" type="button" data-p="{esc(prompt)}">プロンプトをコピー</button></article>'''
secs = f'<section class="lg"><div class="lgh"><h2>0. 最初に1回だけ</h2><p>新しいチャットで、絵のタッチの見本（face-sample.png）を添付して送る</p></div><div class="grid">{card("（画像は作らない）", "最初のあいさつ", "見本の画像を添付して送る", FIRST)}</div></section>'
for g in ['国内屈指', 'エース', '中心選手', 'ふつうの選手']:
    cs = [c for c in sheets if c[2] == g]
    secs += f'<section class="lg"><div class="lgh"><h2>{esc(g)}</h2><p>{len(cs)}枚</p></div><div class="grid">' + ''.join(card(f, t, '同じチャットで1枚ずつ送る', p) for f, t, _, p in cs) + '</div></section>'
page = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>選手の顔 依頼表</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap">
<style>
:root{{--bg:#f4f1ea;--card:#fff;--ink:#1d1d1d;--sub:#666;--line:#ddd6c8;--acc:#1f5fd0}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#16181c;--card:#20242a;--ink:#eee;--sub:#aaa;--line:#333a44;--acc:#6aa0ff}}}}
:root[data-theme="dark"]{{--bg:#16181c;--card:#20242a;--ink:#eee;--sub:#aaa;--line:#333a44;--acc:#6aa0ff}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Zen Kaku Gothic New",sans-serif}}
.wrap{{max-width:1100px;margin:0 auto;padding:20px 16px 60px}}h1{{font-size:26px;margin:0 0 6px}}.lead{{color:var(--sub);line-height:1.7;margin:0 0 18px}}
.steps{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 18px;line-height:1.8;margin-bottom:20px}}
.lg{{margin-top:26px}}.lgh h2{{font-size:20px;margin:0}}.lgh p{{margin:2px 0 10px;color:var(--sub)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}}
.card header{{display:flex;justify-content:space-between;gap:8px}}.ttl h3{{margin:0;font-size:16px}}.ttl p{{margin:2px 0 0;font-size:13px;color:var(--sub)}}
.fn{{text-align:right;font-size:11px;color:var(--sub)}}.fn code{{display:block;font-size:13px;color:var(--ink)}}
details pre{{white-space:pre-wrap;font-size:12px;line-height:1.6;max-height:320px;overflow:auto;background:rgba(127,127,127,.08);padding:8px;border-radius:8px}}
.cp{{border:0;border-radius:8px;padding:10px;background:var(--acc);color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit}}.cp.ok{{background:#2f9e44}}
</style></head><body><div class="wrap"><h1>選手の顔 依頼表</h1>
<p class="lead">国内屈指11人・エース・中心選手の158人は1人ずつ違う顔、その他おおぜいの選手用に「ふつうの顔」54人。全部で{len(sheets)}枚（1枚に6人）。</p>
<div class="steps">① GPTで新しいチャットを開き、見本画像（face-sample.png）を添付して「最初のあいさつ」を送る<br>② 同じチャットで、上から順に1枚ずつ送る（1枚できるのを待ってから次へ）<br>③ できた画像は、カードに書いてあるファイル名で保存する（face_01.png〜）<br>④ 顔が似てきたら「さっきより、もっと1人ずつ別人に描き分けて」と言って作り直してもらう<br>⑤ 何枚かたまったら、まとめて送ってください。ゲームに組み込みます</div>
{secs}</div>
<script>document.querySelectorAll('.cp').forEach(b=>b.addEventListener('click',async()=>{{const t=b.dataset.p;try{{await navigator.clipboard.writeText(t)}}catch(e){{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{{document.execCommand('copy')}}catch(_){{}}a.remove()}}b.textContent='コピーしました';b.classList.add('ok');setTimeout(()=>{{b.textContent='プロンプトをコピー';b.classList.remove('ok')}},1500)}}))</script></body></html>'''
open(OUT_HTML, 'w').write(page)
print(len(sheets), 'sheets')
