-- Web Push subscriptions for Finance OS.
-- Creates new objects only; does not alter business tables.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  platform text not null default 'web',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_project_active_idx
  on public.push_subscriptions(project_id, is_active);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions select own" on public.push_subscriptions;
create policy "push subscriptions select own"
on public.push_subscriptions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
create policy "push subscriptions insert own"
on public.push_subscriptions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = push_subscriptions.project_id
      and (
        p.owner_user_id = auth.uid()
        or p.created_by = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "push subscriptions update own" on public.push_subscriptions;
create policy "push subscriptions update own"
on public.push_subscriptions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "push subscriptions delete own" on public.push_subscriptions;
create policy "push subscriptions delete own"
on public.push_subscriptions for delete to authenticated
using (user_id = auth.uid());
