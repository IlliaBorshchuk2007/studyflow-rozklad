-- StudyFlow 2.2: виконайте після upgrade_v2.sql та add_completed_status.sql
BEGIN;
CREATE TABLE IF NOT EXISTS public.teacher_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id,student_id,subject)
);
CREATE INDEX IF NOT EXISTS assignment_teacher_idx ON public.teacher_student_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS assignment_student_idx ON public.teacher_student_assignments(student_id);
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lesson_audience_check;
ALTER TABLE public.lessons ADD CONSTRAINT lesson_audience_check CHECK(student_id IS NULL OR group_id IS NULL);
CREATE OR REPLACE FUNCTION public.validate_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id=NEW.teacher_id) IS DISTINCT FROM 'teacher'
     OR (SELECT role FROM public.profiles WHERE id=NEW.student_id) IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Потрібно обрати користувачів із ролями викладач та студент';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_assignment_trigger ON public.teacher_student_assignments;
CREATE TRIGGER validate_assignment_trigger BEFORE INSERT OR UPDATE ON public.teacher_student_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_assignment();
ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_student_assignments FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.teacher_student_assignments TO authenticated;
DROP POLICY IF EXISTS assignment_select ON public.teacher_student_assignments;
DROP POLICY IF EXISTS assignment_admin ON public.teacher_student_assignments;
CREATE POLICY assignment_select ON public.teacher_student_assignments FOR SELECT TO authenticated
 USING(public.is_admin() OR teacher_id=auth.uid() OR student_id=auth.uid());
CREATE POLICY assignment_admin ON public.teacher_student_assignments FOR ALL TO authenticated
 USING(public.is_admin()) WITH CHECK(public.is_admin());
DROP POLICY IF EXISTS lessons_v2_read ON public.lessons;
CREATE POLICY lessons_v2_read ON public.lessons FOR SELECT TO authenticated USING(
 public.is_admin() OR teacher_id=auth.uid() OR student_id=auth.uid()
 OR (group_id IS NOT NULL AND public.is_group_member(group_id))
);
CREATE OR REPLACE FUNCTION public.studyflow_no_conflicts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conflict_title text;
BEGIN
 IF NEW.student_id IS NOT NULL AND (
   NEW.teacher_id IS NULL
   OR NOT EXISTS(SELECT 1 FROM public.teacher_student_assignments a
      WHERE a.student_id=NEW.student_id AND a.teacher_id=NEW.teacher_id)
 ) THEN RAISE EXCEPTION 'Студент має бути закріплений за цим викладачем'; END IF;
 IF NEW.status='cancelled' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(2718,(NEW.lesson_date-DATE '2000-01-01')::integer);
 SELECT l.title INTO conflict_title FROM public.lessons l
 WHERE l.id IS DISTINCT FROM NEW.id
  AND l.lesson_date=NEW.lesson_date AND l.status<>'cancelled'
  AND NEW.starts_at<l.ends_at AND l.starts_at<NEW.ends_at
  AND (
    (NEW.teacher_id IS NOT NULL AND NEW.teacher_id=l.teacher_id)
    OR (NEW.student_id IS NOT NULL AND (NEW.student_id=l.student_id
      OR EXISTS(SELECT 1 FROM public.group_members g WHERE g.group_id=l.group_id AND g.user_id=NEW.student_id AND g.member_role='student')))
    OR (NEW.group_id IS NOT NULL AND (
      NEW.group_id=l.group_id
      OR EXISTS(SELECT 1 FROM public.group_members g WHERE g.group_id=NEW.group_id AND g.user_id=l.student_id AND g.member_role='student')
      OR EXISTS(SELECT 1 FROM public.group_members g JOIN public.group_members other ON g.user_id=other.user_id
                 WHERE g.group_id=NEW.group_id AND other.group_id=l.group_id AND g.member_role='student' AND other.member_role='student')
    ))
  ) LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'Конфлікт часу із заняттям «%»',conflict_title; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_no_conflicts_trigger ON public.lessons;
CREATE TRIGGER studyflow_no_conflicts_trigger BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.studyflow_no_conflicts();
-- Сповіщення для призначених студентів; аудит v2 продовжує діяти.
CREATE OR REPLACE FUNCTION public.studyflow_notify_student() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.student_id IS NOT NULL AND (TG_OP='INSERT' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)) THEN
  INSERT INTO public.notifications(user_id,lesson_id,message)
  VALUES (NEW.student_id,NEW.id,'Оновлення особистого заняття: '||NEW.title);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_notify_student_trigger ON public.lessons;
CREATE TRIGGER studyflow_notify_student_trigger AFTER INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.studyflow_notify_student();
COMMIT;