-- StudyFlow 2.3: safe, additive migration for reschedule history and notifications.
-- One lesson remains one row. Moving it writes an audit event, never a duplicate lesson.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lesson_reschedule_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid NOT NULL,
 lesson_title text NOT NULL,
 teacher_id uuid,
 student_id uuid,
 group_id uuid,
 old_date date NOT NULL,
 old_starts_at time without time zone NOT NULL,
 old_ends_at time without time zone NOT NULL,
 new_date date NOT NULL,
 new_starts_at time without time zone NOT NULL,
 new_ends_at time without time zone NOT NULL,
 actor_id uuid,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_reschedules_old_date_idx
 ON public.lesson_reschedule_history(old_date, changed_at DESC);
CREATE INDEX IF NOT EXISTS lesson_reschedules_lesson_idx
 ON public.lesson_reschedule_history(lesson_id, changed_at DESC);
ALTER TABLE public.lesson_reschedule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_reschedule_history FROM anon, authenticated;
GRANT SELECT ON public.lesson_reschedule_history TO authenticated;
DROP POLICY IF EXISTS lesson_reschedule_reader ON public.lesson_reschedule_history;
CREATE POLICY lesson_reschedule_reader ON public.lesson_reschedule_history
 FOR SELECT TO authenticated USING (
   public.is_admin() OR EXISTS(
     SELECT 1 FROM public.lessons l WHERE l.id=lesson_id
       AND (
         l.teacher_id=auth.uid()
         OR l.student_id=auth.uid()
         OR (l.group_id IS NOT NULL AND public.is_group_member(l.group_id))
       )
   )
 );

-- If the calendar date/time changes, set the status in the database, not just the UI.
CREATE OR REPLACE FUNCTION public.studyflow_mark_rescheduled() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (NEW.lesson_date,NEW.starts_at,NEW.ends_at)
    IS DISTINCT FROM (OLD.lesson_date,OLD.starts_at,OLD.ends_at)
    AND NEW.status NOT IN ('cancelled','completed') THEN
   NEW.status:='rescheduled';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_mark_rescheduled_trigger ON public.lessons;
CREATE TRIGGER studyflow_mark_rescheduled_trigger
 BEFORE UPDATE ON public.lessons FOR EACH ROW
 EXECUTE FUNCTION public.studyflow_mark_rescheduled();

CREATE OR REPLACE FUNCTION public.studyflow_record_reschedule() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.lesson_date,NEW.starts_at,NEW.ends_at)
    IS DISTINCT FROM (OLD.lesson_date,OLD.starts_at,OLD.ends_at) THEN
   INSERT INTO public.lesson_reschedule_history
    (lesson_id,lesson_title,teacher_id,student_id,group_id,old_date,old_starts_at,old_ends_at,
     new_date,new_starts_at,new_ends_at,actor_id)
   VALUES (NEW.id, NEW.title, NEW.teacher_id,NEW.student_id,NEW.group_id, OLD.lesson_date, OLD.starts_at, OLD.ends_at,
      NEW.lesson_date, NEW.starts_at, NEW.ends_at, auth.uid());
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studyflow_reschedule_history_trigger ON public.lessons;
CREATE TRIGGER studyflow_reschedule_history_trigger
 AFTER UPDATE ON public.lessons FOR EACH ROW
 EXECUTE FUNCTION public.studyflow_record_reschedule();

-- Update the already-installed audit trigger function. No second notification trigger:
-- each recipient receives ONE message with the new date and time for reschedules.
CREATE OR REPLACE FUNCTION public.audit_lesson_change() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_action text; v_title text; v_actor text; v_role text;
        v_id uuid; v_group uuid; v_old_group uuid; v_teacher uuid; v_student uuid;
        v_old_student uuid; v_old_teacher uuid; v_message text;
BEGIN
 SELECT full_name,role INTO v_actor,v_role FROM public.profiles WHERE id=auth.uid();
 v_actor:=coalesce(v_actor,'Система');v_role:=coalesce(v_role,'system');
 IF TG_OP='INSERT' THEN
  v_action:='created';v_title:=NEW.title;
  v_id:=NEW.id;v_group:=NEW.group_id;v_teacher:=NEW.teacher_id;v_student:=NEW.student_id;
  v_message:='Нове заняття: '||v_title||' — '||to_char(NEW.lesson_date,'DD.MM.YYYY')||
    ' о '||to_char(NEW.starts_at,'HH24:MI');
 ELSIF TG_OP='DELETE' THEN
  v_action:='deleted';v_title:=OLD.title;
  v_id:=OLD.id;v_group:=OLD.group_id;v_teacher:=OLD.teacher_id;v_student:=OLD.student_id;
  v_message:='Видалено заняття: '||v_title;
 ELSE
  IF (to_jsonb(OLD)-'updated_at')=(to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
  v_title:=NEW.title;v_id:=NEW.id;v_group:=NEW.group_id;v_old_group:=OLD.group_id;
  v_teacher:=NEW.teacher_id;v_student:=NEW.student_id;
  v_old_student:=OLD.student_id;v_old_teacher:=OLD.teacher_id;
  IF (NEW.lesson_date,NEW.starts_at,NEW.ends_at)
     IS DISTINCT FROM (OLD.lesson_date,OLD.starts_at,OLD.ends_at) THEN
    v_action:='rescheduled';
    v_message:='Перенесено «'||v_title||'» з '||to_char(OLD.lesson_date,'DD.MM.YYYY')||
      ' '||to_char(OLD.starts_at,'HH24:MI')||' на '||
      to_char(NEW.lesson_date,'DD.MM.YYYY')||' '||
      to_char(NEW.starts_at,'HH24:MI')||'–'||to_char(NEW.ends_at,'HH24:MI');
  ELSIF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action:='updated';v_message:='Скасовано заняття: '||v_title||
      ' ('||to_char(NEW.lesson_date,'DD.MM.YYYY')||')';
  ELSIF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action:='updated';v_message:='Проведено заняття: '||v_title;
  ELSE
    v_action:='updated';v_message:='Оновлено заняття: '||v_title;
  END IF;
 END IF;
 INSERT INTO public.lesson_audit(lesson_id,lesson_title,actor_id,actor_name,
   actor_role,action,old_data,new_data)
 VALUES(v_id,v_title,auth.uid(),v_actor,v_role,v_action,
   CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
   CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
 INSERT INTO public.notifications(user_id,lesson_id,message)
 SELECT DISTINCT recipients.user_id,
   CASE WHEN TG_OP='DELETE' THEN NULL ELSE v_id END,v_message
 FROM (
   SELECT gm.user_id FROM public.group_members gm
   WHERE gm.member_role='student'
     AND (gm.group_id=v_group OR gm.group_id=v_old_group)
   UNION SELECT v_student
   UNION SELECT v_teacher
   UNION SELECT v_old_student
   UNION SELECT v_old_teacher
 ) recipients
 WHERE recipients.user_id IS NOT NULL AND recipients.user_id IS DISTINCT FROM auth.uid();
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public'
       AND tablename='lesson_reschedule_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_reschedule_history;
 END IF;
END $$;
COMMIT;
