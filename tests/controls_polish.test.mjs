import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const entry=read('src/main.tsx');
const app=read('src/App.tsx');
const styles=read('src/controls-polish.css');
test('real application is still entrypoint and control polish is loaded last',()=>{
 assert.match(entry,/import App from '\.\/App\.tsx'/);
 assert.ok(entry.indexOf("import './controls-polish.css'")>entry.indexOf("import './functional-redesign.css'"));
 for(const functionName of ['supabase.auth','saveLesson','createSeries','editSeries','AttendancePanel','GroupManager','StatisticsDashboard','ScheduleRequests','GroupInvitations']){
   assert.ok(app.includes(functionName),'Missing functionality: '+functionName);
 }
});
test('directory search and every form receives unified, accessible control styles',()=>{
 for(const required of ['.gmanager-filters','.gmanager-search','.gmanager-search input','.filters .search','.btn.primary','.btn.light','.attendance-pill','.auth-page',':focus-visible','[data-theme=dark]','@media(max-width:480px)']){
   assert.ok(styles.includes(required),'Missing selector: '+required);
 }
 assert.match(styles,/--control-height:44px/);
 assert.match(styles,/border-radius:var\(--control-radius\)/);
 assert.match(styles,/input\[type='checkbox'\]/);
});
test('styling does not modify database or HTTP behavior',()=>{
 assert.doesNotMatch(styles,/(?:supabase\.from|create table|alter table|drop table|fetch\(|XMLHttpRequest)/i);
});
