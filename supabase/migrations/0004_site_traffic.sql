-- Tường AI: đếm phiên truy cập hôm nay theo múi giờ Việt Nam.
-- Một phiên/tab chỉ tính tối đa một lượt/ngày; không lưu họ tên, email, IP hoặc bài làm.
-- Chạy bằng Supabase SQL Editor (quyền chủ dự án) sau migrations 0001-0003.

create table if not exists public.site_daily_traffic (
  visit_day date primary key,
  visit_count bigint not null default 0 check (visit_count >= 0)
);

create table if not exists public.site_visit_sessions (
  visit_day date not null,
  session_id uuid not null,
  first_seen timestamptz not null default now(),
  primary key (visit_day, session_id)
);

create index if not exists site_visit_sessions_first_seen_idx
  on public.site_visit_sessions (first_seen);

alter table public.site_daily_traffic enable row level security;
alter table public.site_visit_sessions enable row level security;

-- Không ai được đọc danh sách mã phiên; chỉ được gọi RPC trả về số tổng.
revoke all on public.site_daily_traffic from public, anon, authenticated;
revoke all on public.site_visit_sessions from public, anon, authenticated;

create or replace function public.site_record_visit(p_session_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_added integer := 0;
  v_total bigint := 0;
begin
  if p_session_id is null then
    raise exception 'Mã phiên không hợp lệ';
  end if;

  -- INSERT ... ON CONFLICT ngăn đếm trùng khi làm mới trang hoặc gọi đồng thời.
  insert into public.site_visit_sessions(visit_day, session_id)
  values (v_day, p_session_id)
  on conflict (visit_day, session_id) do nothing;

  get diagnostics v_added = row_count;
  if v_added = 1 then
    insert into public.site_daily_traffic(visit_day, visit_count)
    values (v_day, 1)
    on conflict (visit_day) do update
      set visit_count = public.site_daily_traffic.visit_count + 1
    returning visit_count into v_total;
  else
    select visit_count into v_total
    from public.site_daily_traffic
    where visit_day = v_day;
  end if;

  return coalesce(v_total, 0);
end;
$$;

create or replace function public.site_today_visits()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select t.visit_count
    from public.site_daily_traffic t
    where t.visit_day = (now() at time zone 'Asia/Ho_Chi_Minh')::date
  ), 0)::bigint;
$$;

revoke execute on function public.site_record_visit(uuid) from public;
revoke execute on function public.site_today_visits() from public;
grant execute on function public.site_record_visit(uuid) to anon, authenticated;
grant execute on function public.site_today_visits() to anon, authenticated;

comment on table public.site_daily_traffic is 'Tổng số phiên truy cập website Tường AI trong mỗi ngày tại Việt Nam.';
comment on table public.site_visit_sessions is 'Mã phiên ngẫu nhiên, chỉ dùng để tránh tính trùng một phiên trong cùng ngày.';
comment on function public.site_record_visit(uuid) is 'Tính tối đa một lượt/phiên/ngày theo Asia/Ho_Chi_Minh.';
comment on function public.site_today_visits() is 'Đọc lượt truy cập của ngày hiện tại, không tiết lộ danh sách phiên.';
