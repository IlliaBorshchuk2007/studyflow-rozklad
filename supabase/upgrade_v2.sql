-- STUDYFLOW 2.0 — виконувати ЛИШЕ після резервної копії та перед публікацією v2.
-- Міграція зберігає уроки v1: переводить їх у календарні дати поточного тижня.
-- ПІСЛЯ запуску анонімне читання і редагування більше НЕ дозволені.
-- Запускати у Supabase SQL Editor під власником проєкту (postgres), НЕ у браузері сайту.
BEGIN;

-- Резервна копія таблиці v1 (окрема закрита схема).
CREATE SCHEMA IF NOT EXISTS studyflow_backup;
REVOKE ALL ON SCHEMA studyflow_backup FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS studyflow_backup.lessons_v1 AS TABLE public.lessons;
REVOKE ALL ON studyflow_backup.lessons_v1 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Користувач' CHECK (char_length(full_name) BETWEEN 1 AND 100),
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.new_user_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'),''),'Користувач'),100))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_studyflow ON auth.users;
CREATE TRIGGER on_auth_user_created_studyflow AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.new_user_profile();
INSERT INTO public.profiles (id,full_name)
SELECT id,left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),split_part(email,'@',1),'Користувач'),100)
FROM auth.users ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin');
$$;
CREATE OR REPLACE FUNCTION public.is_teacher() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='teacher');
$$;

-- RLS контролює редагування профілю; тригер додатково блокує підвищення ролі.
CREATE OR REPLACE FUNCTION public.protect_profile_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Profile identity cannot be changed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change roles';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_profile_role ON public.profiles;
CREATE TRIGGER guard_profile_role BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

CREATE TABLE IF NOT EXISTS public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'student' CHECK(member_role IN ('student','teacher')),
  UNIQUE(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS group_members_by_user ON public.group_members(user_id);

CREATE OR REPLACE FUNCTION public.is_group_member(p_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id=p_group AND user_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_group_teacher(p_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id=p_group AND user_id=auth.uid() AND member_role='teacher');
$$;

-- Уроки v1: зберігаємо всі існуючі поля та записи.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS lesson_date date;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.study_groups(id) ON DELETE RESTRICT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS materials_url text NOT NULL DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS homework text NOT NULL DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';
UPDATE public.lessons SET lesson_date = (date_trunc('week', (now() AT TIME ZONE 'Europe/Kyiv'))::date + (day_of_week - 1))
WHERE lesson_date IS NULL;
ALTER TABLE public.lessons ALTER COLUMN lesson_date SET NOT NULL;
ALTER TABLE public.lessons ADD CONSTRAINT studyflow_lesson_status CHECK (status IN ('scheduled','rescheduled','cancelled','completed'));
ALTER TABLE public.lessons ADD CONSTRAINT studyflow_lesson_fields CHECK
  (char_length(room)<=120 AND char_length(materials_url)<=500 AND char_length(homework)<=3000);
CREATE INDEX IF NOT EXISTS lessons_by_date ON public.lessons (lesson_date,starts_at);
CREATE INDEX IF NOT EXISTS lessons_by_group ON public.lessons (group_id,lesson_date);

-- Фіксуємо реального автора дій і похідний день тижня у самій БД.
CREATE OR REPLACE FUNCTION public.normalize_lesson() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_name text;
BEGIN
  NEW.day_of_week := extract(isodow from NEW.lesson_date)::smallint;
  NEW.duration_minutes := (extract(epoch from (NEW.ends_at - NEW.starts_at))/60)::integer;
  IF TG_OP='INSERT' THEN
    NEW.created_by := coalesce(auth.uid(),NEW.created_by);
    SELECT full_name INTO actor_name FROM public.profiles WHERE id=auth.uid();
    NEW.created_by_name := left(coalesce(actor_name,'Користувач'),32);
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS normalize_studyflow_lesson ON public.lessons;
CREATE TRIGGER normalize_studyflow_lesson BEFORE INSERT OR UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.normalize_lesson();

CREATE TABLE IF NOT EXISTS public.lesson_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid,  -- навмисно без FK: історія зберігається після видалення уроку
  lesson_title text NOT NULL,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'Невідомо',
  actor_role text NOT NULL DEFAULT 'unknown',
  action text NOT NULL CHECK (action IN ('created','updated','rescheduled','deleted')),
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_date_idx ON public.lesson_audit(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON public.lesson_audit(actor_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_date ON public.notifications(user_id,created_at DESC);

-- SECURITY DEFINER: журнал створюється тригером, без клієнтського запису.
CREATE OR REPLACE FUNCTION public.audit_lesson_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_action text; v_title text; v_group uuid; v_teacher uuid; v_actor text; v_role text;
BEGIN
  SELECT full_name,role INTO v_actor,v_role FROM public.profiles WHERE id=auth.uid();
  v_actor := coalesce(v_actor,'Система'); v_role := coalesce(v_role,'system');
  IF TG_OP='INSERT' THEN
    v_action:='created'; v_title:=NEW.title; v_group:=NEW.group_id; v_teacher:=NEW.teacher_id;
  ELSIF TG_OP='DELETE' THEN
    v_action:='deleted'; v_title:=OLD.title; v_group:=OLD.group_id; v_teacher:=OLD.teacher_id;
  ELSE
    IF (to_jsonb(OLD)-'updated_at') = (to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
    v_action:=CASE WHEN OLD.lesson_date IS DISTINCT FROM NEW.lesson_date
       OR OLD.starts_at IS DISTINCT FROM NEW.starts_at OR OLD.ends_at IS DISTINCT FROM NEW.ends_at
       THEN 'rescheduled' ELSE 'updated' END;
    v_title:=NEW.title; v_group:=NEW.group_id; v_teacher:=NEW.teacher_id;
  END IF;
  INSERT INTO public.lesson_audit(lesson_id,lesson_title,actor_id,actor_name,actor_role,action,old_data,new_data)
  VALUES (CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,v_title,auth.uid(),v_actor,v_role,v_action,
    CASE WHEN TG_OP='INSERT' THEN null ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN null ELSE to_jsonb(NEW) END);
  INSERT INTO public.notifications(user_id,lesson_id,message)
    SELECT DISTINCT recipients.user_id,
      CASE WHEN TG_OP='DELETE' THEN null ELSE NEW.id END,
      CASE v_action WHEN 'created' THEN 'Нове заняття: ' WHEN 'rescheduled' THEN 'Перенесено заняття: '
       WHEN 'deleted' THEN 'Скасовано/видалено: ' ELSE 'Оновлено заняття: ' END || v_title
    FROM (
      SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id=v_group
      UNION
      SELECT p.id FROM public.profiles p WHERE v_group IS NULL
      UNION
      SELECT v_teacher WHERE v_teacher IS NOT NULL
    ) recipients
    WHERE recipients.user_id IS DISTINCT FROM auth.uid();
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS audit_studyflow_lessons ON public.lessons;
CREATE TRIGGER audit_studyflow_lessons AFTER INSERT OR UPDATE OR DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.audit_lesson_change();

-- Політики профілів
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON public.profiles TO authenticated;
REVOKE ALL ON public.profiles FROM anon;
DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id=auth.uid() OR public.is_admin()) WITH CHECK(id=auth.uid() OR public.is_admin());

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.study_groups TO authenticated;
REVOKE ALL ON public.study_groups FROM anon;
DROP POLICY IF EXISTS groups_read ON public.study_groups;
DROP POLICY IF EXISTS groups_admin_all ON public.study_groups;
CREATE POLICY groups_read ON public.study_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY groups_admin_all ON public.study_groups FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.group_members TO authenticated;
REVOKE ALL ON public.group_members FROM anon;
DROP POLICY IF EXISTS group_members_read ON public.group_members;
DROP POLICY IF EXISTS group_members_admin_all ON public.group_members;
CREATE POLICY group_members_read ON public.group_members FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id=auth.uid() OR public.is_group_teacher(group_id));
CREATE POLICY group_members_admin_all ON public.group_members FOR ALL TO authenticated
  USING(public.is_admin()) WITH CHECK(public.is_admin());

-- Зняти ВСІ старі публічні права v1. Нові політики НЕ дозволяють anon.
DROP POLICY IF EXISTS "Everyone can read lessons" ON public.lessons;
DROP POLICY IF EXISTS "Everyone can add lessons" ON public.lessons;
DROP POLICY IF EXISTS "Everyone can edit lessons" ON public.lessons;
DROP POLICY IF EXISTS "Everyone can delete lessons" ON public.lessons;
REVOKE ALL ON public.lessons FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lessons TO authenticated;
DROP POLICY IF EXISTS lessons_v2_read ON public.lessons;
DROP POLICY IF EXISTS lessons_v2_insert ON public.lessons;
DROP POLICY IF EXISTS lessons_v2_update ON public.lessons;
DROP POLICY IF EXISTS lessons_v2_delete ON public.lessons;
CREATE POLICY lessons_v2_read ON public.lessons FOR SELECT TO authenticated USING (
  public.is_admin() OR group_id IS NULL OR public.is_group_member(group_id) OR teacher_id=auth.uid()
);
CREATE POLICY lessons_v2_insert ON public.lessons FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid()
    AND (group_id IS NULL OR public.is_group_teacher(group_id)))
);
CREATE POLICY lessons_v2_update ON public.lessons FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid()))
  WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid()
    AND (group_id IS NULL OR public.is_group_teacher(group_id))));
CREATE POLICY lessons_v2_delete ON public.lessons FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id=auth.uid()));

ALTER TABLE public.lesson_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_audit FROM anon,authenticated;
GRANT SELECT ON public.lesson_audit TO authenticated;
DROP POLICY IF EXISTS audit_view ON public.lesson_audit;
CREATE POLICY audit_view ON public.lesson_audit FOR SELECT TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND actor_id=auth.uid()));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon,authenticated;
GRANT SELECT ON public.notifications TO authenticated;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  UPDATE public.notifications SET read_at=now() WHERE id=p_id AND user_id=auth.uid() AND read_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- Список email тільки для адміністраторів (не відкриваємо auth.users клієнту).
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid,email text,full_name text,role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 RETURN QUERY SELECT p.id,u.email::text,p.full_name,p.role FROM public.profiles p
 JOIN auth.users u ON u.id=p.id ORDER BY p.full_name;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Переконатися, що realtime-таблиці у публікації (може вже бути зі старої версії).
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['lessons','notifications'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename=tab) THEN
     EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tab);
   END IF;
 END LOOP;
END $$;
COMMIT;

-- ПЕРШИЙ АДМІНІСТРАТОР (виконати ОКРЕМО, ПІСЛЯ реєстрації власної пошти):
-- UPDATE public.profiles SET role='admin' WHERE id=(SELECT id FROM auth.users WHERE email='YOU@EMAIL.COM');
-- SELECT id,full_name,role FROM public.profiles WHERE role='admin';
-- Не запускати цей UPDATE без заміни YOU@EMAIL.COM на свою адресу!
