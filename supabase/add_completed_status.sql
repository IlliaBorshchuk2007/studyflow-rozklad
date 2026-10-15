-- StudyFlow 2.1: додати до статусів занять "Проведено".
-- Запустіть в Supabase → SQL Editor → New query → Run.
-- Чинні уроки зберігаються. Права RLS не змінюються.
BEGIN;
ALTER TABLE public.lessons
  DROP CONSTRAINT IF EXISTS studyflow_lesson_status;
ALTER TABLE public.lessons
  ADD CONSTRAINT studyflow_lesson_status
  CHECK (status IN ('scheduled','rescheduled','cancelled','completed'));
COMMIT;
