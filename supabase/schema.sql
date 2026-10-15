-- Виконати ОДИН РАЗ у Supabase → SQL Editor → New query → Run.
-- УВАГА: це публічний спільний розклад, без входу та без пароля.
-- Усі відвідувачі мають права читати, створювати, змінювати і видаляти ВСІ уроки.

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  duration_minutes integer not null,
  note text not null default '' check (char_length(note) <= 500),
  link text not null default '' check (char_length(link) <= 500),
  created_by uuid not null,
  created_by_name text not null default 'Гість' check (char_length(created_by_name) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_valid_time check (
    ends_at > starts_at
    and duration_minutes between 1 and 480
    and duration_minutes = extract(epoch from (ends_at - starts_at)) / 60
  )
);

create index if not exists lessons_week_order on public.lessons (day_of_week, starts_at);
create index if not exists lessons_author on public.lessons (created_by);

create or replace function public.set_lesson_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_lesson_timestamp on public.lessons;
create trigger update_lesson_timestamp
before update on public.lessons
for each row execute function public.set_lesson_updated_at();

alter table public.lessons enable row level security;

revoke all on table public.lessons from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.lessons to anon, authenticated;

drop policy if exists "Everyone can read lessons" on public.lessons;
drop policy if exists "Everyone can add lessons" on public.lessons;
drop policy if exists "Everyone can edit lessons" on public.lessons;
drop policy if exists "Everyone can delete lessons" on public.lessons;

create policy "Everyone can read lessons"
on public.lessons for select to anon, authenticated using (true);

create policy "Everyone can add lessons"
on public.lessons for insert to anon, authenticated with check (true);

create policy "Everyone can edit lessons"
on public.lessons for update to anon, authenticated using (true) with check (true);

create policy "Everyone can delete lessons"
on public.lessons for delete to anon, authenticated using (true);

-- Вмикаємо Realtime, щоб зміни було видно іншим відкритим вкладкам.
-- Ідемпотентно: повторний запуск SQL не створить помилку дублювання таблиці.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'lessons'
  ) then
    execute 'alter publication supabase_realtime add table public.lessons';
  end if;
end $$;

-- Не вставляйте secret/service_role key у код або .env для Vite.
