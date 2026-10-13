import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));

test('file URL用画面は通常スクリプトだけを読み込む',async()=>{
  const html=await readFile(resolve(here,'../index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b([^>]*)>/gi)].map(match=>match[1]);
  assert.equal(scripts.length,7);
  assert.match(scripts[0],/src=["']engine\/engine\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[1],/src=["']sprites\/gpt\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[2],/src=["']sprites\/dotman\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[3],/src=["']app\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[4],/src=["']career\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[5],/src=["']faces\/faces\.js(?:\?[^"']*)?["']/i);
  assert.match(scripts[6],/src=["']career-ui\.js(?:\?[^"']*)?["']/i);
  for(const s of scripts)assert.doesNotMatch(s,/type\s*=\s*["']module["']/i);
});

test('file URLで実行するapp.jsは外部読込APIを使わない',async()=>{
  const source=await readFile(resolve(here,'../app.js'),'utf8');
  assert.doesNotMatch(source,/\bimport\s*(?:\(|[{'"*])/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/\b(?:Shared)?Worker\s*\(/);
});

test('キックオフ時のエラー表示領域が用意されている',async()=>{
  const [html,source]=await Promise.all([
    readFile(resolve(here,'../index.html'),'utf8'),
    readFile(resolve(here,'../app.js'),'utf8'),
  ]);
  assert.match(html,/id="startupError"/);
  assert.match(source,/function safeStart\(\)/);
  assert.match(source,/showStartupError/);
});

test('画面切替は一つの関数で管理しhiddenをCSSでも強制する',async()=>{
  const [css,source]=await Promise.all([
    readFile(resolve(here,'../style.css'),'utf8'),
    readFile(resolve(here,'../app.js'),'utf8'),
  ]);
  assert.match(css,/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
  assert.match(source,/function showScreen\(name\)/);
  assert.match(source,/showScreen\('match'\)/);
  assert.match(source,/showScreen\('result'\)/);
  assert.match(source,/showScreen\('setup'\)/);
});
