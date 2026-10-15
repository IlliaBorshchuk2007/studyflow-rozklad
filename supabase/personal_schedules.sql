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
 OR (group_id IS NOT NULL AND NOT public.is_teacher() AND public.is_group_member(group_id))
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
-- Журнал змін, приватні сповіщення тільки викладачу, призначеному студенту і групі.
CREATE OR REPLACE FUNCTION public.audit_lesson_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_action text; v_title text; v_actor text; v_role text;
DECLARE v_id uuid; v_group uuid; v_teacher uuid; v_student uuid; v_old_student uuid; v_old_teacher uuid;
BEGIN
  SELECT full_name,role INTO v_actor,v_role FROM public.profiles WHERE id=auth.uid();
  v_actor:=coalesce(v_actor,'Система');
  v_role:=coalesce(v_role,'system');
  IF TG_OP='INSERT' THEN
    v_action:='created';v_title:=NEW.title;
    v_id:=NEW.id;v_group:=NEW.group_id;v_teacher:=NEW.teacher_id;v_student:=NEW.student_id;
  ELSIF TG_OP='DELETE' THEN
    v_action:='deleted';v_title:=OLD.title;
    v_id:=OLD.id;v_group:=OLD.group_id;v_teacher:=OLD.teacher_id;v_student:=OLD.student_id;
  ELSE
    IF to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
    v_action:=CASE WHEN OLD.lesson_date IS DISTINCT FROM NEW.lesson_date
      OR OLD.starts_at IS DISTINCT FROM NEW.starts_at OR OLD.ends_at IS DISTINCT FROM NEW.ends_at
      THEN 'rescheduled' ELSE 'updated' END;
    v_title:=NEW.title;v_id:=NEW.id;v_group:=NEW.group_id;v_teacher:=NEW.teacher_id;
    v_student:=NEW.student_id;v_old_student:=OLD.student_id;v_old_teacher:=OLD.teacher_id;
  END IF;
  INSERT INTO public.lesson_audit(lesson_id,lesson_title,actor_id,actor_name,actor_role,action,old_data,new_data)
  VALUES(v_id,v_title,auth.uid(),v_actor,v_role,v_action,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  INSERT INTO public.notifications(user_id,lesson_id,message)
    SELECT DISTINCT recipients.user_id,
      CASE WHEN TG_OP='DELETE' THEN NULL ELSE v_id END,
      (CASE v_action WHEN 'created' THEN 'Нове заняття: '
        WHEN 'rescheduled' THEN 'Перенесено заняття: '
        WHEN 'deleted' THEN 'Видалено заняття: '
        ELSE 'Оновлено заняття: ' END || v_title)
    FROM (
      SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id=v_group AND gm.member_role='student'
      UNION SELECT v_student
      UNION SELECT v_teacher
      UNION SELECT v_old_student
      UNION SELECT v_old_teacher
    ) recipients
    WHERE recipients.user_id IS NOT NULL AND recipients.user_id IS DISTINCT FROM auth.uid();
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Перевірка конфліктів також при новому записі студента до групи.
CREATE OR REPLACE FUNCTION public.studyflow_check_group_member_overlap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l record;
BEGIN
  IF NEW.member_role<>'student' THEN RETURN NEW; END IF;
  FOR l IN SELECT lesson_date,starts_at,ends_at,id,title FROM public.lessons
    WHERE group_id=NEW.group_id AND status<>'cancelled'
    ORDER BY lesson_date,starts_at
  LOOP
    PERFORM pg_advisory_xact_lock(2718,(l.lesson_date-DATE '2000-01-01')::integer);
    IF EXISTS (
      SELECT 1 FROM public.lessons other WHERE other.id<>l.id
        AND other.lesson_date=l.lesson_date AND other.status<>'cancelled'
        AND l.starts_at<other.ends_at AND other.starts_at<l.ends_at
        AND (
          other.student_id=NEW.user_id
          OR EXISTS(SELECT 1 FROM public.group_members gm
            WHERE gm.group_id=other.group_id AND gm.user_id=NEW.user_id AND gm.member_role='student')
        )
    ) THEN
      RAISE EXCEPTION 'Конфлікт: студент має інше заняття під час %',l.title;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_group_member_overlap ON public.group_members;
CREATE TRIGGER studyflow_group_member_overlap
  BEFORE INSERT OR UPDATE OF user_id,group_id,member_role ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.studyflow_check_group_member_overlap();

-- Позначити зміну закріплення для синхронізації відкритих вкладок.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
    AND tablename='teacher_student_assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_student_assignments;
  END IF;
END $$;

COMMIT;
