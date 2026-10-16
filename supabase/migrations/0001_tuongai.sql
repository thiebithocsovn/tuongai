-- Tường AI: cơ sở dữ liệu, phân quyền và kho ảnh
-- Giáo viên chỉ thấy dữ liệu của mình; Quản trị hệ thống thấy tất cả.
-- Học sinh không có tài khoản: mọi thao tác của học sinh đi qua hàm máy chủ "tuongai".

create extension if not exists pgcrypto;

-- Cấu hình máy chủ (email quản trị, khóa AI). Chỉ hàm máy chủ đọc được.
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- Hồ sơ thành viên
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  school text not null default '',
  subject text not null default '',
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  status text not null default 'pending' check (status in ('pending', 'active', 'locked')),
  must_change boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Thành viên thường không tự đổi vai trò, trạng thái hay email của mình.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Bảng lớp
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  school text not null default '',
  subject text not null default '',
  grade text not null default '',
  cover text not null default 'qua-dia-cau',
  layout text not null default 'cot',
  columns jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  assignment jsonb not null default '{}'::jsonb,
  auto_grade boolean not null default true,
  private boolean not null default true,
  pinned boolean not null default false,
  starred boolean not null default false,
  archived boolean not null default false,
  trashed boolean not null default false,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boards_owner_idx on public.boards(owner);
alter table public.boards enable row level security;
drop policy if exists "boards_owner" on public.boards;
create policy "boards_owner" on public.boards for all
  using (owner = auth.uid() and public.is_active())
  with check (owner = auth.uid() and public.is_active());
drop policy if exists "boards_admin" on public.boards;
create policy "boards_admin" on public.boards for all
  using (public.is_admin()) with check (public.is_admin());

-- Bài làm
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  owner uuid not null references public.profiles(id) on delete cascade,
  column_id text not null default '',
  student_name text not null default '',
  student_class text not null default '',
  student_token text,
  by text not null default 'gv' check (by in ('gv', 'hs')),
  body text not null default '',
  images jsonb not null default '[]'::jsonb,
  ai jsonb,
  ai_at timestamptz,
  teacher jsonb,
  created_at timestamptz not null default now()
);
create index if not exists posts_board_idx on public.posts(board_id);
create index if not exists posts_owner_idx on public.posts(owner);
create index if not exists posts_token_idx on public.posts(student_token);
alter table public.posts enable row level security;
drop policy if exists "posts_owner" on public.posts;
create policy "posts_owner" on public.posts for all
  using (owner = auth.uid() and public.is_active())
  with check (
    owner = auth.uid() and public.is_active()
    and exists (select 1 from public.boards b where b.id = board_id and b.owner = auth.uid())
  );
drop policy if exists "posts_admin" on public.posts;
create policy "posts_admin" on public.posts for all
  using (public.is_admin()) with check (public.is_admin());

-- Thống kê cho trang Thành viên (chỉ hàm máy chủ gọi)
create or replace function public.member_stats()
returns table (owner uuid, boards bigint, posts bigint)
language sql stable security definer set search_path = public as $$
  select p.id,
         (select count(*) from public.boards b where b.owner = p.id),
         (select count(*) from public.posts x where x.owner = p.id)
  from public.profiles p;
$$;
revoke all on function public.member_stats() from anon, authenticated;

-- Kho ảnh bài làm (riêng tư). Đường dẫn: <chủ bảng>/<bảng>/<bài>/<số>.jpg
insert into storage.buckets (id, name, public)
values ('work', 'work', false)
on conflict (id) do nothing;

drop policy if exists "work_owner" on storage.objects;
create policy "work_owner" on storage.objects for all
  using (bucket_id = 'work' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active())
  with check (bucket_id = 'work' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
drop policy if exists "work_admin" on storage.objects;
create policy "work_admin" on storage.objects for all
  using (bucket_id = 'work' and public.is_admin())
  with check (bucket_id = 'work' and public.is_admin());

-- Cập nhật trực tiếp khi học sinh nộp bài
do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.boards;
  exception when duplicate_object then null;
  end;
end $$;
