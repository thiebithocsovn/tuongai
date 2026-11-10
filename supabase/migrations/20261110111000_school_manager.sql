-- SchoolManager: additive, opt-in school ownership; preserves all legacy boards/posts.
-- No existing school names are used for automatic membership or board assignment.
create table if not exists public.school_manager_schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,23}$'),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  status text not null default 'active' check (status in ('active','disabled')),
  agent_policy jsonb not null default '{"agentReview":true,"progressTracker":true,"classReport":true}'::jsonb
    check (jsonb_typeof(agent_policy) = 'object'),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.school_manager_members (
  school_id uuid not null references public.school_manager_schools(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('manager','teacher')),
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (school_id,user_id)
);
create index if not exists school_manager_members_user_idx on public.school_manager_members(user_id);
create table if not exists public.school_manager_boards (
  board_id uuid primary key references public.boards(id) on delete cascade,
  school_id uuid not null references public.school_manager_schools(id) on delete restrict,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists school_manager_boards_school_idx on public.school_manager_boards(school_id);
create table if not exists public.school_manager_audit (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.school_manager_schools(id) on delete restrict,
  actor_id uuid references public.profiles(id),
  operation text not null check (operation in ('create_school','add_member','remove_member','set_manager','link_board','unlink_board','set_agents')),
  target_id text not null default '',
  recorded_at timestamptz not null default now()
);
create index if not exists school_manager_audit_school_idx on public.school_manager_audit(school_id,recorded_at desc);

-- Direct Data API access is intentionally denied. Every manager read/write passes
-- through the existing Edge Function using a verified login and per-school checks.
alter table public.school_manager_schools enable row level security;
alter table public.school_manager_members enable row level security;
alter table public.school_manager_boards enable row level security;
alter table public.school_manager_audit enable row level security;
revoke all on public.school_manager_schools from public, anon, authenticated;
revoke all on public.school_manager_members from public, anon, authenticated;
revoke all on public.school_manager_boards from public, anon, authenticated;
revoke all on public.school_manager_audit from public, anon, authenticated;
revoke all on sequence public.school_manager_audit_id_seq from public, anon, authenticated;
grant all on public.school_manager_schools,public.school_manager_members,public.school_manager_boards,public.school_manager_audit to service_role;
grant usage,select on sequence public.school_manager_audit_id_seq to service_role;

comment on table public.school_manager_schools is
  'Opt-in SchoolManager schools. Existing boards and posts are NOT reclassified.';
comment on table public.school_manager_boards is
  'Explicitly assigned class boards only; never infer school from a free-text name.';

-- Only the authenticated, scoped Edge Function (service_role) can call this
-- aggregate; no raw student body, token, score or comment is returned.
create or replace function public.school_manager_board_metrics(p_school_ids uuid[])
returns table (
  school_id uuid, board_id uuid, submissions bigint, reviewed bigint
)
language sql stable security invoker
set search_path = public
as $$
  select l.school_id,l.board_id,
    count(p.id) filter (where p.by='hs')::bigint as submissions,
    count(p.id) filter (
      where p.by='hs' and p.teacher->>'approvedAt' is not null and
        jsonb_typeof(p.teacher->'score') = 'number'
    )::bigint as reviewed
  from public.school_manager_boards l
  left join public.posts p on p.board_id=l.board_id
  where l.school_id = any(p_school_ids)
  group by l.school_id,l.board_id;
$$;
revoke all on function public.school_manager_board_metrics(uuid[]) from public, anon, authenticated;
grant execute on function public.school_manager_board_metrics(uuid[]) to service_role;
