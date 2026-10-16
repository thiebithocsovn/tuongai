-- Kết nối AI riêng của từng giáo viên (Gemini, ChatGPT, Claude).
-- Chỉ chính giáo viên đọc và sửa được khóa của mình; Quản trị hệ thống cũng không xem được.
create table if not exists public.ai_keys (
  owner uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'system' check (provider in ('system', 'gemini', 'openai', 'anthropic')),
  keys jsonb not null default '{}'::jsonb,
  models jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ai_keys enable row level security;
revoke all on public.ai_keys from anon;
grant select, insert, update, delete on public.ai_keys to authenticated;
drop policy if exists "ai_keys_owner" on public.ai_keys;
create policy "ai_keys_owner" on public.ai_keys for all
  using (owner = auth.uid())
  with check (owner = auth.uid());
