import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const entry=read('src/main.tsx');
const app=read('src/App.tsx');
const css=read('src/auth-waves.css');
const previous=read('src/auth-v3.css');
const navy=read('public/be-wave-navy.svg');
const ivory=read('public/be-wave-ivory.svg');
test('scalable decorative SVG wave layers are used and loaded after base auth styles',()=>{
  assert.match(navy,/<svg /);
  assert.match(ivory,/<svg /);
  assert.match(navy,/viewBox="0 0 840 1100"/);
  assert.match(ivory,/viewBox="0 0 1040 1100"/);
  assert.match(navy,/linearGradient/);
  assert.match(ivory,/goldStroke/);
  assert.match(css,/be-wave-navy\.svg/);
  assert.match(css,/be-wave-ivory\.svg/);
  assert.ok(entry.indexOf("import './auth-waves.css'")>entry.indexOf("import './auth-v3.css'"));
  assert.ok(previous.includes('.auth-page-v3 .auth-creator-credit'),'Creator credit remains active');
  assert.ok(app.includes('Designed &amp; Developed by <strong>Illia Borshchuk</strong>'));
});
test('mobile login preserves a readable form without decorative panels',()=>{
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/\.auth-page-v3::before\{display:none\}/);
  assert.ok(previous.includes('.auth-page-v3 .auth-intro{display:none}'));
  assert.ok(app.includes('className="auth-card"'));
  assert.ok(app.includes('onSubmit={submit}'));
});
test('authentication and all timetable workflows untouched',()=>{
  for(const value of ['supabase.auth.signUp','supabase.auth.signInWithPassword','supabase.auth.resetPasswordForEmail','saveLesson','createSeries','editSeries','AttendancePanel','GroupManager','ScheduleRequests']){
    assert.ok(app.includes(value),'Missing original feature: '+value);
  }
  assert.doesNotMatch(css,/supabase|fetch\(|drop table/i);
});
