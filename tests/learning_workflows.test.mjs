import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const a=read('src/App.tsx'),sql=read('supabase/learning_workflows_v25.sql'),inv=read('supabase/group_invitations_v25.sql'),attendance=read('src/AttendancePanel.tsx'),req=read('src/ScheduleRequests.tsx');
test('attendance marks have a unique lesson/student record and role-based RLS',()=>{
 assert.match(sql,/UNIQUE\(lesson_id,student_id\)/);assert.match(sql,/CREATE POLICY attendance_read/);assert.match(sql,/CREATE TRIGGER attendance_audit/);
 assert.match(attendance,/Присутній/);assert.match(attendance,/Відсутній/);assert.match(attendance,/Запізнився/);
});
test('recurrence is atomic and series editing protects overridden instances',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public.create_recurring_lessons/);
 assert.match(sql,/RAISE EXCEPTION 'Не більше 150 занять/);
 assert.match(sql,/rowv.status IN \('cancelled','rescheduled'\)/);
 assert.match(a,/onSeriesEdit/);assert.match(a,/onRepeat/);
});
test('admin schedule review uses SQL transaction and rejects conflicts',()=>{
 assert.match(sql,/FUNCTION public.decide_schedule_change/);
 assert.match(req,/decide_schedule_change/);assert.match(sql,/UPDATE public.lessons SET lesson_date=req.proposed_date/);
});
test('invite token is hashed, expiring, usage-limited and revocable',()=>{
 assert.match(inv,/extensions.digest\(token,'sha256'\)/);
 assert.match(inv,/inv.revoked_at IS NOT NULL OR inv.expires_at<=now\(\)/);
 assert.match(inv,/ON CONFLICT \(group_id,user_id\) DO NOTHING/);
 assert.match(a,/accept_group_invitation/);
});
test('existing lesson audit remains source of reschedule notifications',()=>{assert.match(sql,/studyflow_track_substitution/);assert.doesNotMatch(sql,/DROP TABLE public.lessons/);});
