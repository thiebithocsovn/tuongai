-- Chỉ quản trị hệ thống được chuyển quyền lớp. Bài làm và lịch sử chấm giữ nguyên.
-- Tệp cũ giữ đường dẫn vật lý; phân quyền kho tệp dựa trên chủ sở hữu bài/lớp hiện tại.
create table if not exists public.board_owner_transfers (
  id uuid primary key default gen_random_uuid(),
  board_id uuid,
  board_name text not null,
  old_owner uuid not null,
  new_owner uuid not null,
  performed_by uuid not null,
  posts_transferred integer not null default 0,
  transferred_at timestamptz not null default now()
);
create index if not exists board_owner_transfers_board_idx on public.board_owner_transfers(board_id, transferred_at desc);
alter table public.board_owner_transfers enable row level security;
revoke all on public.board_owner_transfers from public, anon, authenticated;
grant select on public.board_owner_transfers to authenticated;
drop policy if exists board_owner_transfers_admin on public.board_owner_transfers;
create policy board_owner_transfers_admin on public.board_owner_transfers
  for select to authenticated using (public.is_admin());

create or replace function public.admin_transfer_board(
  p_board_id uuid, p_new_owner uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_board public.boards%rowtype;
  v_target public.profiles%rowtype;
  v_posts integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Chỉ quản trị hệ thống mới được chuyển quyền quản trị lớp.'
      using errcode='42501';
  end if;
  if p_board_id is null or p_new_owner is null then
    raise exception 'Cần chọn lớp và giáo viên nhận lớp.' using errcode='22023';
  end if;
  select * into v_board from public.boards where id=p_board_id for update;
  if not found then raise exception 'Lớp không tồn tại.' using errcode='P0002'; end if;
  select * into v_target from public.profiles where id=p_new_owner;
  if not found or v_target.status <> 'active' or v_target.role <> 'teacher' then
    raise exception 'Chỉ được chuyển cho giáo viên đang hoạt động và đã đăng ký trong hệ thống.'
      using errcode='22023';
  end if;
  if v_board.owner = p_new_owner then
    raise exception 'Giáo viên này đang quản trị lớp.' using errcode='22023';
  end if;
  update public.boards
  set owner=p_new_owner, updated_at=now()
  where id=p_board_id;
  update public.posts set owner=p_new_owner where board_id=p_board_id;
  get diagnostics v_posts = row_count;
  insert into public.board_owner_transfers(board_id,board_name,old_owner,new_owner,performed_by,posts_transferred)
  values(v_board.id,v_board.name,v_board.owner,p_new_owner,auth.uid(),v_posts);
  return jsonb_build_object('board_id',v_board.id,'old_owner',v_board.owner,
     'new_owner',p_new_owner,'posts_transferred',v_posts);
end;
$$;
revoke all on function public.admin_transfer_board(uuid,uuid) from public, anon;
grant execute on function public.admin_transfer_board(uuid,uuid) to authenticated;

-- Trả về true chỉ khi đường dẫn không còn gắn với bài của người khác.
-- SECURITY DEFINER cần thiết để kiểm tra cả bài thuộc chủ mới (RLS che khỏi chủ cũ).
create or replace function public.work_file_not_transferred(p_path text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
 select auth.uid() is not null and not exists (
    select 1 from public.posts p
    where p.owner is distinct from auth.uid()
      and (
        coalesce(p.images,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path',p_path))
        or coalesce(p.attachments,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path',p_path))
      )
 );
$$;
create or replace function public.work_file_belongs_to_current_board(p_path text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
 select auth.uid() is not null and exists (
    select 1 from public.posts p join public.boards b on b.id=p.board_id
    where p.owner=auth.uid() and b.owner=auth.uid()
      and (
        coalesce(p.images,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path',p_path))
        or coalesce(p.attachments,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path',p_path))
      )
 );
$$;
revoke all on function public.work_file_not_transferred(text) from public,anon;
revoke all on function public.work_file_belongs_to_current_board(text) from public,anon;
grant execute on function public.work_file_not_transferred(text) to authenticated;
grant execute on function public.work_file_belongs_to_current_board(text) to authenticated;

drop policy if exists work_owner on storage.objects;
create policy work_owner on storage.objects
  for all to authenticated
  using (bucket_id='work' and (storage.foldername(name))[1] = auth.uid()::text
         and public.is_active() and public.work_file_not_transferred(name))
  with check (bucket_id='work' and (storage.foldername(name))[1] = auth.uid()::text
         and public.is_active() and public.work_file_not_transferred(name));

drop policy if exists work_transferred_board_read on storage.objects;
create policy work_transferred_board_read on storage.objects
  for select to authenticated
  using (bucket_id='work' and public.is_active()
         and public.work_file_belongs_to_current_board(name));

drop policy if exists work_transferred_board_delete on storage.objects;
create policy work_transferred_board_delete on storage.objects
  for delete to authenticated
  using (bucket_id='work' and public.is_active()
         and public.work_file_belongs_to_current_board(name));

comment on function public.admin_transfer_board(uuid,uuid) is
 'Only an active admin may atomically transfer one board and its posts to an active teacher, recording an audit event.';
