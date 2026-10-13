# 選手の顔のシート（GPTが作った3列×N行の画像）を1人ずつ切り出して、ゲーム用にそろえる
#   python3 tools/process_faces.py <出力フォルダ> <シート画像>:<face_plan.jsonの番号(0始まり)> ...
# 1) 切り出し：髪の先まで1人分の形をなぞる（上の段のシャツ・横の人は混ぜない）
# 2) 大きさ：シートごとに「頭のてっぺん〜Vネックの底」の中央値をそろえる（髪が大きい人も縮まない）
# 3) 肩：シートのふちで片方が切れていたら鏡うつし。狭い肩は首の外側だけ少し広げる（最大1.2倍。首とえりはそのまま）
# 4) 320×400の透過PNG（下そろえ。頭が入らないときだけ胸の下を切る）と、シャツの部分の _m.png
import sys, os, json, statistics
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = json.load(open(os.environ.get('FACE_PLAN') or os.path.join(HERE, 'face_plan.json')))   # 古い並びのシートは FACE_PLAN=tools/face_plan_v1.json
CW, CH, TOPM, HEADV, SHOULDER = 320, 400, 6, 335, 170

def cuts(proj, n):
    # シート全体を n 等分した線の近くで、絵がいちばん少ない所で切る（空きマスがあっても位置がずれない）
    a0, a1 = 0, len(proj); res = [a0]
    for k in range(1, n):
        e = a0 + (a1 - a0) * k / n; w = int((a1 - a0) / n * 0.22); seg = proj[int(e - w):int(e + w)]
        res.append(int(e - w) + int(np.argmin(seg)))
    res.append(a1); return res

def isblue(A): return (A[..., 3] > 100) & (A[..., 2] > A[..., 0] + 45) & (A[..., 2] > A[..., 1] + 25) & (A[..., 2] > 70)

def slice_sheet(path, plan):
    a = np.array(Image.open(path).convert('RGBA')); A = a.astype(int); H, W = a.shape[:2]
    m = A[..., 3] > 40; lum = 0.3 * A[..., 0] + 0.59 * A[..., 1] + 0.11 * A[..., 2]; blue = m & isblue(A)
    C, R = plan['cols'], plan['rows']; xs = cuts(m.sum(0), C); ys = cuts(m.sum(1), R)
    ysb = []
    for r in range(R):
        lo, hi = ys[r], ys[r + 1]; cnt = blue[lo:min(H, hi + 40)].sum(1); rows = np.nonzero(cnt > W * 0.15)[0]
        ysb.append(lo + rows.max() if len(rows) else hi)
    out = []
    for k, pl in enumerate(plan['players']):
        r, c = divmod(k, C); x0, x1 = xs[c], xs[c + 1]
        top = 0 if r == 0 else ysb[r - 1] + 1
        cc = blue[ys[r]:min(H, ys[r + 1] + 40), x0:x1].sum(1); rr_ = np.nonzero(cc > (x1 - x0) * 0.3)[0]
        bot = min(ysb[r], ys[r] + rr_.max() if len(rr_) else ysb[r]) + 1   # 自分のシャツの下のふちで切る
        L = max(0, x0 - 50); Rr = min(W, x1 + 50)
        reg = m[top:bot, L:Rr].copy()
        if r > 0:
            for dy in range(6):
                y = top + dy
                if y >= bot: break
                row = m[y, L:Rr] & ((lum[y, L:Rr] < 90) | blue[y, L:Rr])
                if row.sum() > (Rr - L) * 0.25: reg[dy, :] &= ~row
        xxg = np.arange(L, Rr)[None, :]; band = (np.arange(top, bot)[:, None] > ysb[r] - 110)
        reg &= ~(band & ((xxg < x0) | (xxg >= x1)))
        lab, n = ndimage.label(reg, structure=np.ones((3, 3)))
        cy = int((max(ys[r], top) + ysb[r]) / 2) - top; cx = (x0 + x1) // 2 - L
        win = lab[max(0, cy - 60):cy + 60, max(0, cx - 60):cx + 60]; ids, cnts = np.unique(win[win > 0], return_counts=True)
        me = ids[np.argmax(cnts)]; keep = lab == me
        sizes = ndimage.sum(reg, lab, range(1, n + 1)); yy0, xx0 = np.nonzero(keep); bb = (yy0.min(), yy0.max(), xx0.min(), xx0.max())
        for i in range(1, n + 1):
            if i == me: continue
            ys_, xs_ = np.nonzero(lab == i)
            if ys_.min() >= bb[0] - 15 and ys_.max() <= bb[1] and xs_.min() >= bb[2] - 15 and xs_.max() <= bb[3] + 15 and sizes[i - 1] < 4000 and ys_.min() > 8 and ys_.max() <= bb[1] - 30: keep |= lab == i
        keep = ndimage.binary_dilation(keep, iterations=1) & (a[top:bot, L:Rr, 3] > 0)
        if r > 0: keep[:2, :] &= reg[:2, :]
        sub = a[top:bot, L:Rr].copy(); sub[~keep] = 0
        yy1, xx1 = np.nonzero(sub[..., 3] > 40); sub = sub[yy1.min():yy1.max() + 1, xx1.min():xx1.max() + 1]
        out.append((f"{pl['tid']}_{pl['no']}", sub))
    return out

def measure(sub):
    A = sub.astype(int); h, w = sub.shape[:2]
    white = (A[..., 3] > 100) & (A[..., 0] > 200) & (A[..., 1] > 200) & (A[..., 2] > 200); white[:int(h * 0.5)] = False
    lab, n = ndimage.label(white, structure=np.ones((3, 3)))
    if n:
        # えり：白い部品のうち、いちばん下にあって、まん中に近いもの（白い髪をえりと間違えない）
        best, bsc = None, -1e9
        for i in range(1, n + 1):
            yy, xx = np.nonzero(lab == i)
            if len(yy) < 30: continue
            sc = yy.max() - 0.6 * abs((xx.min() + xx.max()) / 2 - w / 2)
            if sc > bsc: best, bsc = i, sc
        ys, xs = np.nonzero(lab == best)
        vy = int(ys.max()); vx = int(np.median(xs[ys >= ys.max() - 3])); ctop = int(ys.min())
    else:
        vy, vx, ctop = h - 1, w // 2, int(h * 0.8)
    bl = np.nonzero(isblue(A)[h - 6:h - 1].any(0))[0]
    dl, dr = (vx - int(bl.min()), int(bl.max()) - vx) if len(bl) else (w // 2, w // 2)
    return dict(vy=vy, vx=vx, ctop=ctop, dl=dl, dr=dr)

def normalize(sub, d, medV):
    a = sub; h, w = a.shape[:2]
    s = HEADV / medV
    a = np.array(Image.fromarray(a).resize((round(w * s), round(h * s)), Image.LANCZOS)); h, w = a.shape[:2]
    vx = round(d['vx'] * s); ctop = round(d['ctop'] * s); dl, dr = d['dl'] * s, d['dr'] * s; half = max(dl, dr)
    cutL = dr - dl > 20; cutR = dl - dr > 20
    pad = int(max(SHOULDER * 1.6, half) + 20); a = np.pad(a, ((0, 0), (pad, pad), (0, 0))); vx += pad; w = a.shape[1]
    blue = isblue(a.astype(int))
    if cutL or cutR:
        long = int(half); ystart = h
        for y in range(h - 1, -1, -1):
            xs = np.nonzero(blue[y])[0]
            if not len(xs): break
            ext = (vx - xs.min()) if cutR else (xs.max() - vx)
            if ext >= long * 0.8: ystart = y
            else: break
        for y in range(ystart, h):
            for dist in range(1, long + 1):
                src = vx + dist if cutL else vx - dist; dst = vx - dist if cutL else vx + dist
                if a[y, dst, 3] < 40 and blue[y, src]: a[y, dst] = a[y, src]
    target = min(SHOULDER, half * 1.2); inner = half * 0.42
    f = (target - inner) / (half - inner) if half < target else 1.0
    if f > 1.0:
        b = a.copy(); y0 = ctop + int((h - ctop) * 0.15); xs = np.arange(w); dd = xs - vx; ad = np.abs(dd)
        for y in range(y0, h):
            t = min(1.0, (y - y0) / max(1, (h - y0))); fy = 1 + (f - 1) * (t ** 0.5)
            src_ad = np.where(ad <= inner, ad, inner + (ad - inner) / fy)
            b[y] = a[y, np.clip(np.round(vx + np.sign(dd) * src_ad).astype(int), 0, w - 1)]
        a = b
    im = Image.fromarray(a); W2, H2 = im.size
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); oy = CH - H2
    if oy < TOPM: oy = TOPM
    cv.paste(im, (CW // 2 - vx, oy), im)
    Ar = np.array(cv).astype(int); r_, g_, b_, al = Ar[..., 0], Ar[..., 1], Ar[..., 2], Ar[..., 3]
    bl = isblue(Ar) & (b_ > 70); bl[:int(CH * 0.5)] = False
    lab2, _ = ndimage.label(bl); seeds = set(lab2[-3:, :].ravel()) - {0}
    shirt = ndimage.binary_closing(np.isin(lab2, list(seeds)), iterations=2) & (al > 0) & ~((r_ > 200) & (g_ > 200) & (b_ > 200))
    L2 = (0.3 * r_ + 0.59 * g_ + 0.11 * b_)[shirt]
    return cv, shirt, (round(float(L2.mean()), 1) if L2.size else 80.0)

def main():
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True); res = {}
    for arg in sys.argv[2:]:
        path, idx = arg.rsplit(':', 1); plan = dict(PLAN[int(idx)])
        if 'players' not in plan:   # モブのシート：mob_1, mob_2 … と番号をふる
            first = sum(q.get('generic', 0) for q in PLAN[:int(idx)] if 'players' not in q) + 1
            plan['players'] = [{'tid': 'mob', 'no': first + k} for k in range(plan['generic'])]
        subs = slice_sheet(path, plan); ms = [measure(s) for _, s in subs]
        medV = statistics.median([m['vy'] for m in ms])
        for (key, sub), d in zip(subs, ms):
            cv, shirt, L = normalize(sub, d, medV)
            cv.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(outdir, key + '.png'), optimize=True)
            Image.fromarray((shirt * 255).astype('uint8'), 'L').save(os.path.join(outdir, key + '_m.png'), optimize=True)
            res[key] = L
        print(path, len(subs))
    json.dump(res, open(os.path.join(outdir, '_shirtL.json'), 'w'))

if __name__ == '__main__':
    main()
