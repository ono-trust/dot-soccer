// ドットサッカー：お金での購入（Stripe）
//  1. ゲーム → payCheckout（ログイン中の人だけ）：Stripeの支払い画面のURLを作って返す
//  2. 払い終わると Stripe → payWebhook：本当に払われたか（署名）を確かめて、grants/{支払いID} に「渡すもの」を書く
//  3. ゲーム → payClaim：自分あての grants を受け取り済みにして、中身（コイン・パス）を返す
//  値段と中身はここで決める（ゲームの画面の数字は表示用。ここが正しい値段）
//  版712：プレミアムパスは月額の自動更新（Stripeのサブスクリプション）。毎月払われるたびに grants/{請求書ID} を書く
//    解約・カードの変更は payPortal（Stripeのお客さま用ページ）で行う。subs/{uid} に今の状態を残す
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
  prem: { name: 'プレミアムパス（月額・自動更新）', yen: 720, coins: 300, premDays: 30, sub: true },
};

// 支払いが終わったあとに開くページ（ゲームのある場所の pay-done.html）。知らない場所へは飛ばさない
const OK_ORIGIN = [/^https:\/\/ono-trust\.github\.io$/, /^https:\/\/[a-z0-9-]+\.claudeusercontent\.com$/, /^https:\/\/claude\.ai$/, /^http:\/\/localhost(:\d+)?$/];
const backTo = (base) => {
  try { const u = new URL(base); if (OK_ORIGIN.some((r) => r.test(u.origin))) return u.origin + u.pathname.replace(/[^/]*$/, ''); } catch (_) {}
  return 'https://ono-trust.github.io/dot-soccer/';
};

const LIVE_SUB = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];
exports.payCheckout = onCall({ region: REGION, secrets: [STRIPE_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  const it = ITEMS[req.data && req.data.item];
  if (!it) throw new HttpsError('invalid-argument', 'item');
  const stripe = new Stripe(STRIPE_KEY.value().trim());
  const base = backTo(req.data.back);
  const uid = req.auth.uid, meta = { uid, item: req.data.item };
  const common = { locale: 'ja', client_reference_id: uid, metadata: meta, success_url: base + 'pay-done.html?ok=1', cancel_url: base + 'pay-done.html?ok=0' };
  let s;
  if (it.sub) {
    // 二重に申し込まないように：もう続いているパスがあれば、ことわる
    const cur = await db.collection('subs').doc(uid).get();
    if (cur.exists && LIVE_SUB.includes(cur.data().status)) {
      try { const sb = await stripe.subscriptions.retrieve(cur.data().sub); await saveSub(sb); if (LIVE_SUB.includes(sb.status)) throw new HttpsError('already-exists', 'sub'); }
      catch (e) { if (e instanceof HttpsError) throw e; }
    }
    s = await stripe.checkout.sessions.create({ ...common, mode: 'subscription',
      line_items: [{ quantity: 1, price_data: { currency: 'jpy', unit_amount: it.yen, recurring: { interval: 'month' }, product_data: { name: it.name } } }],
      subscription_data: { metadata: meta } });
  } else {
    s = await stripe.checkout.sessions.create({ ...common, mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'jpy', unit_amount: it.yen, product_data: { name: it.name } } }] });
  }
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
  try {
    const o = ev.data.object;
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      if (o.mode === 'subscription') { if (o.subscription) await saveSub(await stripe.subscriptions.retrieve(o.subscription)); if (o.invoice) await grantInvoice(stripe, await stripe.invoices.retrieve(o.invoice)); }
      else await grantFrom(o);
    } else if (ev.type === 'invoice.paid' || ev.type === 'invoice.payment_succeeded') {
      await grantInvoice(stripe, o);
    } else if (ev.type === 'customer.subscription.created' || ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
      await saveSub(await stripe.subscriptions.retrieve(o.id).catch(() => o));
    }
  } catch (e) { console.error('webhook handle', ev.type, e && e.message); res.status(500).send('error'); return; }
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
// サブスクリプションの情報（Stripeの版によって、置き場所がちがうので両方見る）
const subIdOf = (inv) => (inv && (inv.subscription || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription))) || null;
const subIdStr = (x) => (x && typeof x === 'object' ? x.id : x) || null;
const periodEnd = (sb) => (sb.current_period_end || (sb.items && sb.items.data && sb.items.data[0] && sb.items.data[0].current_period_end) || 0) * 1000;
async function saveSub(sb) {
  if (!sb || !sb.metadata || !sb.metadata.uid) return null;
  const v = { uid: sb.metadata.uid, sub: sb.id, customer: subIdStr(sb.customer), status: sb.status, until: periodEnd(sb), cancelAtEnd: !!sb.cancel_at_period_end, live: !!sb.livemode, at: Date.now() };
  const ref = db.collection('subs').doc(v.uid);
  await db.runTransaction(async (tx) => { const d = await tx.get(ref);   // 古いサブスクの知らせで、新しいものを上書きしない
    if (d.exists && d.data().sub !== v.sub && LIVE_SUB.includes(d.data().status) && !LIVE_SUB.includes(v.status)) return; tx.set(ref, v); });
  return v;
}
// 毎月の支払い（請求書）が払われた → パスの30日とコインを渡す。同じ請求書は1回だけ
async function grantInvoice(stripe, inv) {
  if (!inv || inv.status !== 'paid' || !(inv.amount_paid > 0)) return false;
  const subId = subIdStr(subIdOf(inv)); if (!subId) return false;
  const sb = await stripe.subscriptions.retrieve(subId); await saveSub(sb);
  const key = sb.metadata && sb.metadata.item, it = ITEMS[key], uid = sb.metadata && sb.metadata.uid;
  if (!it || !it.sub || !uid || inv.amount_paid !== it.yen) return false;
  const line = inv.lines && inv.lines.data && inv.lines.data[0], until = ((line && line.period && line.period.end) || 0) * 1000 || periodEnd(sb);
  const ref = db.collection('grants').doc(inv.id);
  await db.runTransaction(async (tx) => { const d = await tx.get(ref); if (d.exists) return;
    tx.set(ref, { uid, item: key, coins: it.coins || 0, premDays: it.premDays || 0, premUntil: until, renew: inv.billing_reason === 'subscription_cycle', yen: it.yen, live: !!inv.livemode, at: Date.now(), claimed: false }); });
  return true;
}
// 解約・カードの変更のページ（Stripeが用意しているお客さま用ページ）を開く
exports.payPortal = onCall({ region: REGION, secrets: [STRIPE_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  const d = await db.collection('subs').doc(req.auth.uid).get();
  if (!d.exists || !d.data().customer) throw new HttpsError('not-found', 'nosub');
  const stripe = new Stripe(STRIPE_KEY.value().trim());
  const p = await stripe.billingPortal.sessions.create({ customer: d.data().customer, locale: 'ja', return_url: backTo(req.data && req.data.back) + 'pay-done.html?ok=3' });
  return { url: p.url };
});
exports.payClaim = onCall({ region: REGION, secrets: [STRIPE_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  // まだ確かめていない支払いを、Stripeに直接たしかめる（24時間以内）
  try {
    const stripe = new Stripe(STRIPE_KEY.value().trim());
    const pq = await db.collection('pending').where('uid', '==', req.auth.uid).limit(10).get();
    for (const d of pq.docs) {
      try { const sess = await stripe.checkout.sessions.retrieve(d.id);
        let ok = false;
        if (sess.mode === 'subscription') { if (sess.status === 'complete' && sess.subscription) { await saveSub(await stripe.subscriptions.retrieve(subIdStr(sess.subscription))); if (sess.invoice) ok = await grantInvoice(stripe, await stripe.invoices.retrieve(subIdStr(sess.invoice))); } }
        else ok = await grantFrom(sess);
        if (ok || Date.now() - (d.data().at || 0) > 86400000 || sess.status === 'expired') await d.ref.delete(); } catch (e) { console.error('pending check', d.id, e && e.message); }
    }
    // 毎月の更新：Webhookが届いていなくても、最新の請求書が払われていれば渡す
    const sd = await db.collection('subs').doc(req.auth.uid).get();
    if (sd.exists && sd.data().sub) {
      try { const sb = await stripe.subscriptions.retrieve(sd.data().sub); await saveSub(sb);
        if (sb.latest_invoice) await grantInvoice(stripe, await stripe.invoices.retrieve(subIdStr(sb.latest_invoice))); } catch (e) { console.error('sub check', e && e.message); }
    }
  } catch (e) { console.error('pending', e && e.message); }
  const q = await db.collection('grants').where('uid', '==', req.auth.uid).where('claimed', '==', false).limit(20).get();
  const out = [];
  for (const d of q.docs) {
    const ok = await db.runTransaction(async (tx) => { const x = await tx.get(d.ref); if (!x.exists || x.data().claimed) return false; tx.update(d.ref, { claimed: true, claimedAt: Date.now() }); return true; });
    if (ok) { const v = d.data(); out.push({ id: d.id, item: v.item, coins: v.coins, premDays: v.premDays, premUntil: v.premUntil || 0, renew: !!v.renew, yen: v.yen, live: v.live }); }
  }
  const sd2 = await db.collection('subs').doc(req.auth.uid).get(), sv = sd2.exists ? sd2.data() : null;
  return { items: out, sub: sv ? { status: sv.status, until: sv.until, cancelAtEnd: sv.cancelAtEnd, live: sv.live } : null };
});
