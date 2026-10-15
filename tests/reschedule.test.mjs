import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/reschedule_history_v23.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/LessonDetails.tsx',import.meta.url),'utf8');
test('reschedule keeps one lesson and records history',()=>{
 assert.match(sql,/AFTER UPDATE ON public.lessons/);
 assert.match(sql,/INSERT INTO public.lesson_reschedule_history/);
 assert.doesNotMatch(sql,/INSERT INTO public.lessons/);
});
test('history is read-only from clients',()=>{
 assert.match(sql,/REVOKE ALL ON public.lesson_reschedule_history FROM anon, authenticated/);
 assert.match(sql,/GRANT SELECT ON public.lesson_reschedule_history TO authenticated/);
});
test('notification links, back navigation and prior date',()=>{
 assert.match(app,/notice-back/);
 assert.match(app,/openNoticeLesson/);
 assert.match(app,/moved-ghost/);
 assert.match(detail,/Історія перенесень/);
});
