import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(f)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('src/App.tsx'),html=read('index.html'),entry=read('src/main.tsx'),css=read('src/brand.css');
test('Borshchuk Education names all visible brand areas',()=>{
  assert.match(app,/Borshchuk<\/strong>/);
  assert.match(app,/EDUCATION/);
  assert.match(app,/Завантажуємо Borshchuk Education/);
  assert.match(app,/Borshchuk <strong>Education<\/strong>/);
  assert.match(html,/<title>Borshchuk Education/);
  assert.doesNotMatch(html,/<title>StudyFlow/);
  assert.match(html,/og:title.*Borshchuk Education/);
});
test('selected BE crest is used on auth, sidebar and favicon',()=>{
  assert.match(app,/className="brand-crest auth-crest" src="\/be-crest.webp"/);
  assert.match(app,/className="brand-crest sidebar-crest" src="\/be-crest.webp"/);
  assert.match(app,/className="auth-card-crest" src="\/be-crest.webp"/);
  assert.match(html,/rel="icon".*\/be-crest.webp/);
  assert.match(entry,/import '\.\/brand.css'/);
  assert.match(css,/\.sidebar-crest/);
  const p=new URL('../public/be-crest.webp',import.meta.url);
  assert.ok(existsSync(p));
  const bytes=readFileSync(p);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
});
test('all real data-backed workflows are preserved after branding',()=>{
  for(const fn of ['saveLesson','createSeries','editSeries','AttendancePanel','GroupManager','StatisticsDashboard','ScheduleRequests','LessonDetails','supabase.auth']){
    assert.ok(app.includes(fn),'Missing '+fn);
  }
  assert.doesNotMatch(css,/supabase\.from|fetch\(|DROP TABLE/i);
});
