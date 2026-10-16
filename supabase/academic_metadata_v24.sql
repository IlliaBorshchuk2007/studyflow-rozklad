-- StudyFlow 2.4: optional academic metadata, no fabricated values.
BEGIN;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS course smallint;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS studyflow_course_bounds;
ALTER TABLE public.profiles
  ADD CONSTRAINT studyflow_course_bounds
  CHECK (course IS NULL OR course BETWEEN 1 AND 8);
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS studyflow_specialty_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT studyflow_specialty_length
  CHECK (specialty IS NULL OR length(trim(specialty)) BETWEEN 1 AND 120);
CREATE INDEX IF NOT EXISTS group_members_group_role_idx
  ON public.group_members(group_id,member_role);
CREATE INDEX IF NOT EXISTS studyflow_lessons_date_idx
  ON public.lessons(lesson_date);
CREATE INDEX IF NOT EXISTS studyflow_audit_time_idx
  ON public.lesson_audit(occurred_at);
COMMIT;
