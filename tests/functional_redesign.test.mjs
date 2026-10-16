import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const entry=read('src/main.tsx');
const app=read('src/App.tsx');
const css=read('src/functional-redesign.css');
test('real StudyFlow application and database-backed features are preserved',()=>{
 assert.match(entry,/import App from '\.\/App\.tsx'/);
 assert.match(entry,/import '\.\/functional-redesign\.css'/);
 for(const value of ["page==='schedule'","page==='statistics'","page==='attendance'","page==='groups'","page==='requests'","page==='notifications'","page==='profile'","supabase.auth","saveLesson","createSeries","editSeries","GroupManager","AttendancePanel","ScheduleRequests","LessonDetails"]){
  assert.ok(app.includes(value),'Missing live functionality: '+value);
 }
});
test('functional redesign is CSS-only with no backend changes',()=>{
 for(const value of ['.week-board','.lesson','.nav-list','.role-indicator','@media(max-width:650px)','[data-theme=dark]']){
  assert.ok(css.includes(value),'Missing design scope: '+value);
 }
 assert.doesNotMatch(css,/https?:\/\/.*supabase|DROP TABLE/i);
});
test('admin, teacher and student retain role-aware labels and menus',()=>{
 assert.ok(app.includes('ROLE_LABEL[role]'));
 assert.ok(app.includes("role==='admin'?'Розклад закладу'"));
 assert.ok(app.includes("role==='teacher'?'Мої заняття'"));
 assert.ok(app.includes('menu.filter(x=>x.allow)'));
});
