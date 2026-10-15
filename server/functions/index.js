// ドットサッカー：お金での購入（Stripe）
//  1. ゲーム → payCheckout（ログイン中の人だけ）：Stripeの支払い画面のURLを作って返す
//  2. 払い終わると Stripe → payWebhook：本当に払われたか（署名）を確かめて、grants/{支払いID} に「渡すもの」を書く
//  3. ゲーム → payClaim：自分あての grants を受け取り済みにして、中身（コイン・パス）を返す
//  値段と中身はここで決める（ゲームの画面の数字は表示用。ここが正しい値段）
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();
const STRIPE_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WH = defineSecret('STRIPE_WEBHOOK_SECRET');
const REGION = 'asia-northeast1';

const ITEMS = {
  c1: { name: 'Dコイン 160枚', yen: 120, coins: 160 },
  c2: { name: 'Dコイン 500枚', yen: 370, coins: 500 },
  c3: { name: 'Dコイン 850枚', yen: 610, coins: 850 },
  c4: { name: 'Dコイン 1,750枚', yen: 1220, coins: 1750 },
  c5: { name: 'Dコイン 4,500枚', yen: 3060, coins: 4500 },
  c6: { name: 'Dコイン 9,400枚', yen: 6100, coins: 9400 },
  prem: { name: 'プレミアムパス（30日）', yen: 720, coins: 300, premDays: 30 },
};

// 支払いが終わったあとに開くページ（ゲームのある場所の pay-done.html）。知らない場所へは飛ばさない
const OK_ORIGIN = [/^https:\/\/ono-trust\.github\.io$/, /^https:\/\/[a-z0-9-]+\.claudeusercontent\.com$/, /^https:\/\/claude\.ai$/, /^http:\/\/localhost(:\d+)?$/];
const backTo = (base) => {
  try { const u = new URL(base); if (OK_ORIGIN.some((r) => r.test(u.origin))) return u.origin + u.pathname.replace(/[^/]*$/, ''); } catch (_) {}
  return 'https://ono-trust.github.io/dot-soccer/';
};

exports.payCheckout = onCall({ region: REGION, secrets: [STRIPE_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  const it = ITEMS[req.data && req.data.item];
  if (!it) throw new HttpsError('invalid-argument', 'item');
  const stripe = new Stripe(STRIPE_KEY.value().trim());
  const base = backTo(req.data.back);
  const s = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'ja',
    line_items: [{ quantity: 1, price_data: { currency: 'jpy', unit_amount: it.yen, product_data: { name: it.name } } }],
    client_reference_id: req.auth.uid,
    metadata: { uid: req.auth.uid, item: req.data.item },
    success_url: base + 'pay-done.html?ok=1',
    cancel_url: base + 'pay-done.html?ok=0',
  });
  await db.collection('pending').doc(s.id).set({ uid: req.auth.uid, item: req.data.item, at: Date.now() });   // 受け取りの時に、Stripeへ直接たしかめる（Webhookが届かない時のため）
  return { url: s.url, id: s.id };
});

exports.payWebhook = onRequest({ region: REGION, secrets: [STRIPE_KEY, STRIPE_WH] }, async (req, res) => {
  const stripe = new Stripe(STRIPE_KEY.value().trim());
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WH.value().trim()); }
  catch (e) {   // 原因が分かるように記録する（鍵そのものは出さない。形と長さだけ）
    const k = STRIPE_WH.value().trim();
    console.error('webhook verify failed', { msg: e && e.message, keyHead: k.slice(0, 6), keyLen: k.length, hasSig: !!req.headers['stripe-signature'], hasRaw: !!req.rawBody });
    res.status(400).send('bad signature: ' + (e && e.message ? String(e.message).slice(0, 160) : '') + ' / key ' + k.slice(0, 6) + '… len ' + k.length); return; }
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    const s = ev.data.object;
    if (s.payment_status === 'paid') {
      const key = s.metadata && s.metadata.item, it = ITEMS[key], uid = (s.metadata && s.metadata.uid) || s.client_reference_id;
      if (it && uid && s.amount_total === it.yen) {
        const ref = db.collection('grants').doc(s.id);
        await db.runTransaction(async (tx) => { const d = await tx.get(ref); if (d.exists) return;
          tx.set(ref, { uid, item: key, coins: it.coins || 0, premDays: it.premDays || 0, yen: it.yen, live: !!s.livemode, at: Date.now(), claimed: false }); });
      }
    }
  }
  res.json({ received: true });
});

// 払い終わった支払いを grants に書く（Webhookと受け取りの両方から使う。同じ支払いは1回だけ）
async function grantFrom(sess) {
  if (!sess || sess.payment_status !== 'paid') return false;
  const key = sess.metadata && sess.metadata.item, it = ITEMS[key], uid = (sess.metadata && sess.metadata.uid) || sess.client_reference_id;
  if (!it || !uid || sess.amount_total !== it.yen) return false;
  const ref = db.collection('grants').doc(sess.id);
  await db.runTransaction(async (tx) => { const d = await tx.get(ref); if (d.exists) return;
    tx.set(ref, { uid, item: key, coins: it.coins || 0, premDays: it.premDays || 0, yen: it.yen, live: !!sess.livemode, at: Date.now(), claimed: false }); });
  return true;
}
exports.payClaim = onCall({ region: REGION, secrets: [STRIPE_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  // まだ確かめていない支払いを、Stripeに直接たしかめる（24時間以内）
  try {
    const stripe = new Stripe(STRIPE_KEY.value().trim());
    const pq = await db.collection('pending').where('uid', '==', req.auth.uid).limit(10).get();
    for (const d of pq.docs) {
      try { const sess = await stripe.checkout.sessions.retrieve(d.id);
        if (await grantFrom(sess) || Date.now() - (d.data().at || 0) > 86400000 || sess.status === 'expired') await d.ref.delete(); } catch (e) { console.error('pending check', d.id, e && e.message); }
    }
  } catch (e) { console.error('pending', e && e.message); }
  const q = await db.collection('grants').where('uid', '==', req.auth.uid).where('claimed', '==', false).limit(20).get();
  const out = [];
  for (const d of q.docs) {
    const ok = await db.runTransaction(async (tx) => { const x = await tx.get(d.ref); if (!x.exists || x.data().claimed) return false; tx.update(d.ref, { claimed: true, claimedAt: Date.now() }); return true; });
    if (ok) { const v = d.data(); out.push({ id: d.id, item: v.item, coins: v.coins, premDays: v.premDays, yen: v.yen, live: v.live }); }
  }
  return { items: out };
});
