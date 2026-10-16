import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('src/App.tsx');
const styles=read('src/auth-v3.css');
const entry=read('src/main.tsx');
test('clean academic login removes blurry background asset and retains real form',()=>{
 assert.match(src,/className="auth-page auth-page-v3"/);
 assert.match(src,/className="auth-intro" aria-hidden="true"/);
 assert.doesNotMatch(src,/Твій час\./);
 assert.doesNotMatch(styles,/auth-architecture\\.webp/);
 assert.match(styles,/linear-gradient\\(160deg,#102f52/);
 assert.match(styles,/\.auth-page-v3 \.auth-intro:after/);
 assert.ok(entry.indexOf("import './auth-v3.css'")>entry.indexOf("import './brand.css'"));
});
test('registration, login and recovery stay implemented and interactive',()=>{
 for(const token of ['supabase.auth.signInWithPassword','supabase.auth.signUp','supabase.auth.resetPasswordForEmail','mode===\'signup\'','mode===\'reset\'','type="email"','type="password"','onSubmit={submit}','setMode(\'reset\')','setMode(\'signup\')']){
  assert.ok(src.includes(token),'Missing original auth behavior: '+token);
 }
});
test('all app features remain intact; mobile form remains visible',()=>{
 for(const token of ['saveLesson','createSeries','editSeries','AttendancePanel','GroupManager','ScheduleRequests','LessonDetails','StatisticsDashboard']){
  assert.ok(src.includes(token),'Missing feature: '+token);
 }
 assert.match(styles,/@media\(max-width:720px\)/);
 assert.match(styles,/\.auth-page-v3 \.auth-intro\{display:none\}/);
 assert.match(styles,/\.auth-page-v3 \.auth-grid\{display:flex/);
});
