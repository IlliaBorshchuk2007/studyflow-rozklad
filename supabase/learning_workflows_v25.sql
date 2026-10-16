-- StudyFlow 2.5: attendance, recurring lessons, change requests, substitutions, profile extensions.
-- Non-destructive. Do not run before deploying the matching frontend build.
BEGIN;
ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS faculty text,
 ADD COLUMN IF NOT EXISTS specialization text,
 ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS faculty_specialization_limit;
ALTER TABLE public.profiles ADD CONSTRAINT faculty_specialization_limit CHECK ((faculty IS NULL OR length(faculty)<=120) AND (specialization IS NULL OR length(specialization)<=120));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS studyflow_bio_length;
ALTER TABLE public.profiles ADD CONSTRAINT studyflow_bio_length
 CHECK (bio IS NULL OR length(bio)<=1000);
CREATE TABLE IF NOT EXISTS public.attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('present','absent','late')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=300),
 marked_by uuid REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(lesson_id,student_id)
);
CREATE INDEX IF NOT EXISTS attendance_student_idx ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS attendance_lesson_idx ON public.attendance(lesson_id);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.attendance TO authenticated;
DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated USING
 (public.is_admin() OR student_id=auth.uid() OR EXISTS
  (SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.teacher_id=auth.uid()));
DROP POLICY IF EXISTS attendance_write ON public.attendance;
CREATE POLICY attendance_write ON public.attendance FOR ALL TO authenticated USING
 (public.is_admin() OR EXISTS(SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.teacher_id=auth.uid() AND public.is_teacher()))
 WITH CHECK (public.is_admin() OR EXISTS(SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.teacher_id=auth.uid() AND public.is_teacher()));
CREATE OR REPLACE FUNCTION public.studyflow_validate_attendance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rec public.lessons%ROWTYPE;
BEGIN
 SELECT * INTO rec FROM public.lessons WHERE id=NEW.lesson_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Заняття не знайдено'; END IF;
 IF rec.status='cancelled' THEN RAISE EXCEPTION 'Не можна відмічати скасований урок'; END IF;
 IF (SELECT role FROM public.profiles WHERE id=NEW.student_id) IS DISTINCT FROM 'student' THEN
  RAISE EXCEPTION 'Відвідуваність доступна лише студентам';
 END IF;
 IF NOT (rec.student_id=NEW.student_id OR
   (rec.group_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.group_members gm WHERE gm.group_id=rec.group_id
    AND gm.user_id=NEW.student_id AND gm.member_role='student'))) THEN
  RAISE EXCEPTION 'Студент не належить до цього заняття';
 END IF;
 NEW.marked_by:=auth.uid();
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS attendance_validate ON public.attendance;
CREATE TRIGGER attendance_validate BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.studyflow_validate_attendance();
CREATE TABLE IF NOT EXISTS public.attendance_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 attendance_id uuid,lesson_id uuid,student_id uuid,old_status text,new_status text,
 actor_id uuid,occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_history FROM anon,authenticated;
GRANT SELECT ON public.attendance_history TO authenticated;
DROP POLICY IF EXISTS attendance_history_read ON public.attendance_history;
CREATE POLICY attendance_history_read ON public.attendance_history FOR SELECT TO authenticated USING
 (public.is_admin() OR student_id=auth.uid() OR EXISTS
 (SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.teacher_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.studyflow_attendance_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status=NEW.status AND OLD.note=NEW.note THEN RETURN NEW; END IF;
 INSERT INTO public.attendance_history(attendance_id,lesson_id,student_id,old_status,new_status,actor_id)
 VALUES(COALESCE(NEW.id,OLD.id),COALESCE(NEW.lesson_id,OLD.lesson_id),
 COALESCE(NEW.student_id,OLD.student_id),CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
 CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.status END,auth.uid());
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS attendance_audit ON public.attendance;
CREATE TRIGGER attendance_audit AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.studyflow_attendance_audit();

CREATE TABLE IF NOT EXISTS public.lesson_series(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL,
 frequency text NOT NULL CHECK(frequency IN ('daily','weekly','custom')),
 weekdays integer[] NOT NULL DEFAULT ARRAY[]::integer[],
 teacher_id uuid REFERENCES public.profiles(id),
 student_id uuid REFERENCES public.profiles(id),
 group_id uuid REFERENCES public.study_groups(id),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on AND ends_on<=starts_on+365),
 CHECK(student_id IS NULL OR group_id IS NULL)
);
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.lesson_series(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS series_sequence integer;
CREATE INDEX IF NOT EXISTS lessons_series_idx ON public.lessons(series_id,lesson_date);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_series_occurrence_unique ON public.lessons(series_id,series_sequence)
 WHERE series_id IS NOT NULL;
ALTER TABLE public.lesson_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_series FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lesson_series TO authenticated;
DROP POLICY IF EXISTS series_read ON public.lesson_series;
CREATE POLICY series_read ON public.lesson_series FOR SELECT TO authenticated USING
 (public.is_admin() OR teacher_id=auth.uid() OR student_id=auth.uid()
  OR (group_id IS NOT NULL AND public.is_group_member(group_id)));
DROP POLICY IF EXISTS series_write ON public.lesson_series;
CREATE POLICY series_write ON public.lesson_series FOR ALL TO authenticated USING
 (public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid()))
 WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid() AND created_by=auth.uid()));

CREATE OR REPLACE FUNCTION public.create_recurring_lessons(
 p_title text,p_start date,p_until date,p_frequency text,p_weekdays integer[],
 p_start_time time,p_end_time time,p_teacher uuid,p_student uuid,p_group uuid,
 p_room text DEFAULT '',p_note text DEFAULT '',p_link text DEFAULT '',
 p_homework text DEFAULT '',p_materials text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE sid uuid; d date; count_occ integer:=0; dow integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Потрібна авторизація'; END IF;
 IF p_start IS NULL OR p_until IS NULL OR p_start>p_until OR p_until>p_start+365 THEN
  RAISE EXCEPTION 'Серія має тривати не більше 366 днів';
 END IF;
 IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 120 OR
    p_start_time>=p_end_time OR p_end_time-p_start_time>interval '8 hours' THEN
  RAISE EXCEPTION 'Некоректна назва або час занять';
 END IF;
 IF p_frequency NOT IN ('daily','weekly','custom') THEN RAISE EXCEPTION 'Невідомий тип повторення'; END IF;
 IF p_frequency='custom' AND (coalesce(array_length(p_weekdays,1),0)=0 OR
    EXISTS (SELECT 1 FROM unnest(p_weekdays) w WHERE w NOT BETWEEN 1 AND 7)) THEN
  RAISE EXCEPTION 'Обери коректні дні тижня';
 END IF;
 IF NOT public.is_admin() AND NOT (public.is_teacher() AND auth.uid()=p_teacher AND
   (p_group IS NULL OR public.is_group_teacher(p_group))) THEN
  RAISE EXCEPTION 'Недостатньо прав для створення серії';
 END IF;
 INSERT INTO public.lesson_series(title,starts_on,ends_on,frequency,weekdays,teacher_id,student_id,group_id,created_by)
 VALUES(trim(p_title),p_start,p_until,p_frequency,coalesce(p_weekdays,ARRAY[]::int[]),
 p_teacher,p_student,p_group,auth.uid()) RETURNING id INTO sid;
 FOR d IN SELECT generate_series(p_start,p_until,interval '1 day')::date LOOP
   dow:=extract(isodow from d)::int;
   IF p_frequency='daily' OR (p_frequency='weekly' AND dow=extract(isodow from p_start)::int)
       OR (p_frequency='custom' AND dow=ANY(p_weekdays)) THEN
      count_occ:=count_occ+1;
      IF count_occ>150 THEN RAISE EXCEPTION 'Не більше 150 занять в одній серії'; END IF;
      INSERT INTO public.lessons(title,lesson_date,day_of_week,starts_at,ends_at,duration_minutes,
       teacher_id,student_id,group_id,room,note,link,homework,materials_url,status,created_by,series_id,series_sequence)
      VALUES(trim(p_title),d,dow,p_start_time,p_end_time,
       (extract(epoch from p_end_time-p_start_time)/60)::integer,
       p_teacher,p_student,p_group,coalesce(p_room,''),coalesce(p_note,''),coalesce(p_link,''),
       coalesce(p_homework,''),coalesce(p_materials,''),'scheduled',auth.uid(),sid,count_occ);
   END IF;
 END LOOP;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_recurring_lessons(text,date,date,text,integer[],time,time,uuid,uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_lessons(text,date,date,text,integer[],time,time,uuid,uuid,uuid,text,text,text,text,text) TO authenticated;
-- Series changes: protects previously individually moved/cancelled lessons in bulk edits.
CREATE OR REPLACE FUNCTION public.edit_recurring_lessons(p_lesson uuid,p_scope text,p_patch jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE base public.lessons%ROWTYPE; rowv public.lessons%ROWTYPE;
 delta integer:=0; affected integer:=0; apply_date date;
BEGIN
 SELECT * INTO base FROM public.lessons WHERE id=p_lesson;
 IF NOT FOUND THEN RAISE EXCEPTION 'Урок не знайдено'; END IF;
 IF NOT public.is_admin() AND NOT (public.is_teacher() AND base.teacher_id=auth.uid()) THEN
  RAISE EXCEPTION 'Недостатньо прав'; END IF;
 IF p_scope NOT IN ('this','future','all') THEN RAISE EXCEPTION 'Некоректна область змін'; END IF;
 IF p_scope<>'this' AND base.series_id IS NULL THEN RAISE EXCEPTION 'Цей урок не входить до серії'; END IF;
 IF p_patch ? 'lesson_date' THEN delta:=(p_patch->>'lesson_date')::date-base.lesson_date; END IF;
 FOR rowv IN SELECT * FROM public.lessons WHERE
   (p_scope='this' AND id=p_lesson) OR
   (p_scope='all' AND series_id=base.series_id AND base.series_id IS NOT NULL) OR
   (p_scope='future' AND series_id=base.series_id AND
    (lesson_date>base.lesson_date OR (lesson_date=base.lesson_date AND series_sequence>=base.series_sequence)))
   ORDER BY lesson_date,starts_at FOR UPDATE
 LOOP
   IF p_scope<>'this' AND rowv.id<>base.id AND rowv.status IN ('cancelled','rescheduled') THEN CONTINUE; END IF;
   apply_date:=rowv.lesson_date+delta;
   UPDATE public.lessons SET
     lesson_date=apply_date,
     title=coalesce(p_patch->>'title',rowv.title),
     starts_at=coalesce((p_patch->>'starts_at')::time,rowv.starts_at),
     ends_at=coalesce((p_patch->>'ends_at')::time,rowv.ends_at),
     room=coalesce(p_patch->>'room',rowv.room),
     note=coalesce(p_patch->>'note',rowv.note),
     status=coalesce(p_patch->>'status',rowv.status)
   WHERE id=rowv.id;
   affected:=affected+1;
 END LOOP;
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.edit_recurring_lessons(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_recurring_lessons(uuid,text,jsonb) TO authenticated;

-- Requests are not themselves edits to the schedule.
CREATE TABLE IF NOT EXISTS public.schedule_change_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000),
 proposed_date date NOT NULL,
 proposed_starts_at time NOT NULL, proposed_ends_at time NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 admin_comment text NOT NULL DEFAULT '' CHECK(length(admin_comment)<=1000),
 decided_by uuid REFERENCES public.profiles(id),
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(proposed_ends_at>proposed_starts_at)
);
CREATE INDEX IF NOT EXISTS requests_state_idx ON public.schedule_change_requests(status,created_at DESC);
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_change_requests FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.schedule_change_requests TO authenticated;
DROP POLICY IF EXISTS schedule_requests_view ON public.schedule_change_requests;
CREATE POLICY schedule_requests_view ON public.schedule_change_requests FOR SELECT TO authenticated USING
 (public.is_admin() OR requested_by=auth.uid() OR EXISTS
  (SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.teacher_id=auth.uid()));
DROP POLICY IF EXISTS schedule_requests_insert ON public.schedule_change_requests;
CREATE POLICY schedule_requests_insert ON public.schedule_change_requests FOR INSERT TO authenticated WITH CHECK
 (requested_by=auth.uid() AND status='pending' AND decided_by IS NULL AND EXISTS(
  SELECT 1 FROM public.lessons l WHERE l.id=lesson_id
  AND (l.teacher_id=auth.uid() OR l.student_id=auth.uid() OR
   (l.group_id IS NOT NULL AND public.is_group_member(l.group_id)))));
DROP POLICY IF EXISTS schedule_requests_admin ON public.schedule_change_requests;
CREATE POLICY schedule_requests_admin ON public.schedule_change_requests FOR UPDATE TO authenticated
 USING(public.is_admin()) WITH CHECK(public.is_admin());

CREATE OR REPLACE FUNCTION public.decide_schedule_change(p_request uuid,p_approve boolean,p_comment text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.schedule_change_requests%ROWTYPE;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Лише адміністратор може ухвалити заявку'; END IF;
 SELECT * INTO req FROM public.schedule_change_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR req.status<>'pending' THEN RAISE EXCEPTION 'Заявка вже розглянута або не існує'; END IF;
 IF p_approve THEN
  UPDATE public.lessons SET lesson_date=req.proposed_date,starts_at=req.proposed_starts_at,
   ends_at=req.proposed_ends_at,status='rescheduled' WHERE id=req.lesson_id;
 END IF;
 UPDATE public.schedule_change_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 admin_comment=left(coalesce(p_comment,''),1000),decided_by=auth.uid(),decided_at=now() WHERE id=req.id;
 INSERT INTO public.notifications(user_id,lesson_id,message) VALUES
 (req.requested_by,req.lesson_id,
  CASE WHEN p_approve THEN 'Заявку на перенесення підтверджено. ' ELSE 'Заявку на перенесення відхилено. ' END ||
  coalesce(p_comment,''));
END $$;
REVOKE ALL ON FUNCTION public.decide_schedule_change(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_schedule_change(uuid,boolean,text) TO authenticated;

-- A substitute changes only this lesson, preserving its original teacher.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS original_teacher_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS substitution_reason text;
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS substitution_reason_limit;
ALTER TABLE public.lessons ADD CONSTRAINT substitution_reason_limit CHECK(substitution_reason IS NULL OR length(substitution_reason)<=500);
CREATE OR REPLACE FUNCTION public.studyflow_track_substitution() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
  IF OLD.teacher_id IS NOT NULL AND NEW.original_teacher_id IS NULL THEN
   NEW.original_teacher_id:=OLD.teacher_id;
  END IF;
  IF NEW.teacher_id IS NOT NULL AND
   (SELECT role FROM public.profiles WHERE id=NEW.teacher_id) IS DISTINCT FROM 'teacher' THEN
   RAISE EXCEPTION 'Заміна має мати роль викладача';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_substitution ON public.lessons;
CREATE TRIGGER studyflow_substitution BEFORE UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.studyflow_track_substitution();
COMMIT;