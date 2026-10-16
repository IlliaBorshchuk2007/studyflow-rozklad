import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const navy=read('public/be-wave-navy.svg');
const ivory=read('public/be-wave-ivory.svg');
const css=read('src/auth-waves.css');
const auth=read('src/App.tsx');
test('refined premium design has few broad wave contours and understated paper folds',()=>{
  assert.match(navy,/<svg /);
  assert.match(ivory,/<svg /);
  assert.match(navy,/viewBox="0 0 840 1100"/);
  assert.match(ivory,/viewBox="0 0 1040 1100"/);
  assert.match(navy,/linearGradient/);
  assert.match(ivory,/goldStroke/);
  assert.equal((navy.match(/<path /g)||[]).length,5,'Avoid a forest of decorative curves');
  assert.equal((ivory.match(/<path /g)||[]).length,6,'Keep the ivory background minimal');
  assert.match(css,/\.auth-page-v3 \.auth-intro::before \{/);
  assert.match(css,/display: none;/);
  assert.match(css,/\/be-wave-navy\.svg/);
  assert.match(css,/\/be-wave-ivory\.svg/);
});
test('form and author credit remain and desktop waves are removed on mobile',()=>{
  for(const token of ['className="auth-card"','onSubmit={submit}','Designed &amp; Developed by <strong>Illia Borshchuk</strong>']){
    assert.ok(auth.includes(token),token);
  }
  assert.match(css,/@media \(max-width: 720px\)/);
  assert.match(css,/\.auth-page-v3::before \{ display: none; \}/);
});
test('auth and scheduler code are left functional; CSS contains no service operations',()=>{
  for(const token of ['supabase.auth.signInWithPassword','supabase.auth.signUp','supabase.auth.resetPasswordForEmail','saveLesson','createSeries','AttendancePanel','GroupManager']){
    assert.ok(auth.includes(token),token);
  }
  assert.doesNotMatch(css,/supabase|fetch\(|DROP TABLE/i);
});
