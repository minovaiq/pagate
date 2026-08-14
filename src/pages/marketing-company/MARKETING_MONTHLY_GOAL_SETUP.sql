-- الهدف الشهري الموحد لكل مستخدمي المشروع
create table if not exists public.marketing_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  month_key text not null,
  goal_amount numeric not null default 0 check (goal_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_monthly_goals_project_month_key unique (project_id, month_key)
);

create index if not exists idx_marketing_monthly_goals_project_id
  on public.marketing_monthly_goals(project_id);

alter table public.marketing_monthly_goals enable row level security;

-- نفس سياسة المشروع الحالية: المستخدم المسجل يستطيع قراءة الهدف الموحد وحفظه.
-- إذا عندك سياسات صلاحيات أدق لاحقاً نقدر نقيد التعديل للمدير فقط.
drop policy if exists "marketing_monthly_goals_select_authenticated"
  on public.marketing_monthly_goals;
create policy "marketing_monthly_goals_select_authenticated"
  on public.marketing_monthly_goals
  for select
  to authenticated
  using (true);

drop policy if exists "marketing_monthly_goals_insert_authenticated"
  on public.marketing_monthly_goals;
create policy "marketing_monthly_goals_insert_authenticated"
  on public.marketing_monthly_goals
  for insert
  to authenticated
  with check (true);

drop policy if exists "marketing_monthly_goals_update_authenticated"
  on public.marketing_monthly_goals;
create policy "marketing_monthly_goals_update_authenticated"
  on public.marketing_monthly_goals
  for update
  to authenticated
  using (true)
  with check (true);

-- اختياري لتحديث الهدف فوراً عند المستخدمين الآخرين عبر Realtime.
do $$
begin
  alter publication supabase_realtime add table public.marketing_monthly_goals;
exception
  when duplicate_object then null;
end $$;
