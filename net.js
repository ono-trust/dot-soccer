// 版613：オンライン（Firebase）：フレンド登録・ランクマッチの相手さがし
// FIREBASE_CONFIG が空のあいだは、オンラインの機能は使えない（フレンドのリンク対戦とCPUのランクマッチだけ）
(() => {
  'use strict';
  const FIREBASE_CONFIG = null;   // ← Firebase の設定をここに入れる（{ apiKey: ..., authDomain: ..., projectId: ..., ... }）
  const SDK = 'https://cdn.jsdelivr.net/npm/firebase@10.12.2/';
  let db = null, uid = null, readyP = null, lastErr = '';
  const load = (src) => new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('load ' + src)); document.head.appendChild(s); });
  function ready() {
    if (!FIREBASE_CONFIG) return Promise.resolve(false);
    if (readyP) return readyP;
    readyP = (async () => {
      try {
        await load(SDK + 'firebase-app-compat.js');
        await Promise.all([load(SDK + 'firebase-auth-compat.js'), load(SDK + 'firebase-firestore-compat.js')]);
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        const auth = app.auth();
        if (!auth.currentUser) await auth.signInAnonymously();
        uid = auth.currentUser.uid; db = app.firestore();
        return true;
      } catch (e) { lastErr = String(e && e.message || e); readyP = null; return false; }
    })();
    return readyP;
  }
  const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, ng) => setTimeout(() => ng(new Error('timeout')), ms))]);
  // フレンドID（8けたの数字）：はじめての時に作る。ほかの人と重ならないように fids/{id} を取る
  async function ensureFid(want) {
    if (want) { const d = await db.collection('fids').doc(want).get(); if (d.exists && d.data().uid === uid) return want; }
    for (let k = 0; k < 8; k++) {
      const id = String(10000000 + Math.floor(Math.random() * 90000000));
      try { await db.runTransaction(async (tx) => { const ref = db.collection('fids').doc(id); const d = await tx.get(ref); if (d.exists) throw new Error('used'); tx.set(ref, { uid }); }); return id; } catch (_) {}
    }
    throw new Error('fid');
  }
  // 自分のクラブを公開する（名前・エンブレム・ランク・チームのコード）
  async function publish(me) {
    if (!(await ready())) return null;
    return withTimeout((async () => {
      const fid = await ensureFid(me.fid);
      await db.collection('players').doc(uid).set({ fid, name: me.name, short: me.short, mgr: me.mgr || '', lg: me.lg || '', emb: me.emb || null, kit: me.kit || null, rank: me.rank, rp: me.rp, lvl: Math.round(me.lvl || 0), code: me.code, at: Date.now() });
      return fid;
    })());
  }
  async function byFid(fid) {
    if (!(await ready())) return null;
    return withTimeout((async () => {
      const f = await db.collection('fids').doc(String(fid).replace(/\D/g, '')).get(); if (!f.exists) return null;
      const p = await db.collection('players').doc(f.data().uid).get(); return p.exists ? { uid: f.data().uid, ...p.data() } : null;
    })());
  }
  async function byUid(u) { if (!(await ready())) return null; return withTimeout(db.collection('players').doc(u).get().then((p) => (p.exists ? { uid: u, ...p.data() } : null))); }
  // ランクマッチの相手：同じランクの人（いなければ近いランク）から1人
  async function rankRival(rank) {
    if (!(await ready())) return null;
    return withTimeout((async () => {
      for (const r of [rank, rank - 1, rank + 1, rank - 2, rank + 2]) {
        if (r < 0 || r > 6) continue;
        const q = await db.collection('players').where('rank', '==', r).limit(40).get();
        const list = q.docs.filter((d) => d.id !== uid).map((d) => ({ uid: d.id, ...d.data() }));
        if (list.length) return list[Math.floor(Math.random() * list.length)];
      }
      return null;
    })());
  }
  window.DotNet = { get on() { return !!FIREBASE_CONFIG; }, get uid() { return uid; }, get err() { return lastErr; }, ready, publish, byFid, byUid, rankRival };
})();
