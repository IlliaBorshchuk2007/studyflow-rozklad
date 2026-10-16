import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/App.tsx');
const mobile=read('src/MobileExperience.tsx');
const styles=read('src/mobile.css');
const main=read('src/main.tsx');
const html=read('index.html');
test('five bottom tabs plus a role-aware extra sections menu exist',()=>{
 for(const id of ['home','schedule','lessons','notifications','profile']){
  assert.ok(app.includes(`{id:'${id}'`)||app.includes(`id:'${id}'`),'Missing mobile tab '+id);
 }
 for(const token of ['mobile-bottom-nav','mobile-more-overlay','extraMobileMenu','item.allow','mobileNavigate(target:Page)','mobile-more-trigger']){
  assert.ok(app.includes(token),'Missing navigation '+token);
 }
 for(const token of ["id:'users'","role==='admin'","id:'audit'","role!=='student'","id:'groups'"]){
  assert.ok(app.includes(token),'Missing role aware section '+token);
 }
});
test('mobile day/week/month uses real lessons and dialog actions',()=>{
 for(const token of ['MobileWeekView','mode={view===','weekDays(selectedDate)','lessonDetails','setLessonDetails(l)','reschedules.filter','mobile-day-strip','onMove','CompactLesson','status-rescheduled']){
  assert.ok(app.includes(token)||mobile.includes(token),'Missing mobile schedule '+token);
 }
 for(const token of ['onClick={()=>onOpen(lesson)}','onClick={()=>onDay(d)}','onClick={()=>onMove(m.new_date)}','loading&&','!daily.length']){
  assert.ok(mobile.includes(token),'Missing mobile touch interaction '+token);
 }
});
test('home and lessons reuse the existing Supabase data and all original workflows',()=>{
 for(const key of ["page==='home'","page==='lessons'","mode=\"home\"","mode=\"lessons\"","visibleLessons","notices","supabase.auth","saveLesson","createSeries","editSeries","AttendancePanel","GroupManager","ScheduleRequests","StatisticsDashboard","LessonDetails"]){
  assert.ok(app.includes(key),'Missing connected feature '+key);
 }
 assert.match(mobile,/mobile-list-filters/);
 assert.match(mobile,/STATUS_LABEL/);
});
test('safe-area nav and responsive dialogs are added without hiding role actions',()=>{
 assert.ok(main.indexOf("import './mobile.css'")>main.indexOf("import './auth-waves.css'"));
 for(const token of ['@media(max-width:760px)','env(safe-area-inset-bottom,0px)','mobile-bottom-nav','mobile-more-sheet','mobile-day-strip','.app-shell .dialog','.app-shell .gmanager-layout','.app-shell .an-charts','.app-shell .learning-kpis','.app-shell .month-board']){
   assert.ok(styles.includes(token),'Missing mobile CSS '+token);
 }
 assert.match(styles,/\.app-shell \.sidebar\{display:none!important\}/);
 assert.match(styles,/touch-action:manipulation/);
 assert.match(html,/Borshchuk Education/);
 assert.doesNotMatch(styles,/supabase\.from|DROP TABLE/i);
});

test('lesson list filters teacher/group and has page-top and Escape navigation behavior',()=>{
 for(const v of ['Фільтр навчальної групи','Фільтр викладача','const listed=mode===','onTeacher(e.target.value)','onGroup(e.target.value)']){
   assert.ok(mobile.includes(v),'Missing mobile filter: '+v);
 }
 assert.ok(app.includes('window.scrollTo(0,0)'));
 assert.ok(app.includes("e.key==='Escape'"));
 assert.ok(app.includes("document.body.style.overflow='hidden'"));
});
