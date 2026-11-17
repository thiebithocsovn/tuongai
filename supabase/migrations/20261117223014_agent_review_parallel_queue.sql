-- Three globally shared model-call slots. Only the existing service-role backend can use them.
create table if not exists public.agent_review_parallel_control (
  id boolean primary key default true check (id),
  parallelism smallint not null default 3 check (parallelism between 1 and 6),
  paused_until timestamptz not null default '-infinity',
  last_tick_at timestamptz,
  last_processed integer not null default 0
);
create table if not exists public.agent_review_parallel_slots (
  slot smallint primary key check (slot between 1 and 6),
  token uuid,
  expires_at timestamptz not null default '-infinity'
);
insert into public.agent_review_parallel_control(id) values(true) on conflict do nothing;
insert into public.agent_review_parallel_slots(slot) select generate_series(1,6) on conflict do nothing;
alter table public.agent_review_parallel_control enable row level security;
alter table public.agent_review_parallel_slots enable row level security;
revoke all on public.agent_review_parallel_control,public.agent_review_parallel_slots from public,anon,authenticated;
grant select,update on public.agent_review_parallel_control,public.agent_review_parallel_slots to service_role;

create or replace function public.claim_agent_review_slot(p_token uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare cfg public.agent_review_parallel_control; chosen integer;
begin
  if p_token is null then return 0; end if;
  select * into cfg from public.agent_review_parallel_control where id for update;
  if cfg.paused_until>now() then return 0; end if;
  select slot into chosen from public.agent_review_parallel_slots
    where slot<=cfg.parallelism and expires_at<=now()
    order by slot for update skip locked limit 1;
  if chosen is null then return 0; end if;
  update public.agent_review_parallel_slots set token=p_token,expires_at=now()+interval '180 seconds' where slot=chosen;
  return chosen;
end;
$$;
create or replace function public.release_agent_review_slot(p_token uuid) returns void
language sql security invoker set search_path='' as $$
  update public.agent_review_parallel_slots set token=null,expires_at='-infinity' where token=p_token;
$$;
create or replace function public.pause_agent_review_parallel(p_seconds integer default 60) returns void
language sql security invoker set search_path='' as $$
  update public.agent_review_parallel_control set paused_until=greatest(paused_until,now()+make_interval(secs=>least(300,greatest(30,p_seconds)))) where id;
$$;
create or replace function public.agent_review_parallel_state() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('parallelism',c.parallelism,
    'active',(select count(*) from public.agent_review_parallel_slots where token is not null and expires_at>now()),
    'pausedUntil',case when c.paused_until>now() then (extract(epoch from c.paused_until)*1000)::bigint else 0 end,
    'lastTickAt',c.last_tick_at,'lastProcessed',c.last_processed)
  from public.agent_review_parallel_control c where c.id;
$$;

-- User-requested recovery changes only private queue metadata, never work, AI output or grades.
create or replace function public.requeue_agent_review_failed(p_owner uuid default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  with candidates as (
    select p.id from public.posts p join public.boards b on b.id=p.board_id and b.owner=p.owner
    left join public.school_manager_boards sb on sb.board_id=b.id
    left join public.school_manager_schools s on s.id=sb.school_id
    where (p_owner is null or p.owner=p_owner) and p.by='hs'
      and b.auto_grade and not b.archived and not b.trashed and b.assignment->'agentReviewV2'='true'::jsonb
      and (sb.board_id is null or (s.status='active' and s.agent_policy->'agentReview' is distinct from 'false'::jsonb))
      and p.teacher#>>'{assist,agentReview,status}'='failed'
      and p.teacher#>>'{assist,agentReview,kind}'='analysis'
      and p.teacher->>'approvedAt' is null and p.teacher->>'score' is null and p.teacher#>>'{assist,a}' is null
    order by p.created_at,p.id limit 100 for update of p skip locked
  )
  update public.posts p set teacher=jsonb_set(p.teacher,'{assist}',
    (p.teacher->'assist') || jsonb_build_object(
      'agentReview',(p.teacher#>'{assist,agentReview}') || jsonb_build_object(
        'status','pending','cycleAttempts',0,'retryAt',0,'retryRequestedAt',(extract(epoch from now())*1000)::bigint),
      'agentAudit',coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(coalesce(p.teacher#>'{assist,agentAudit}','[]'::jsonb)) with ordinality as a(x,ord)
        where ord>jsonb_array_length(coalesce(p.teacher#>'{assist,agentAudit}','[]'::jsonb))-39),'[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,
          'event','retry_requested','kind','analysis','actor',coalesce(p_owner::text,'system-maintenance'),'code',''))))
  from candidates c where p.id=c.id;
  get diagnostics n=row_count;
  return n;
end;
$$;

-- Continue normal V2 opt-in and school policy checks. Saved grades do not need model quota.
create or replace function public.agent_review_v2_due_posts(p_limit integer default 12)
returns table(post_id uuid)
language sql stable security invoker set search_path='' as $$
  select p.id from public.posts p join public.boards b on b.id=p.board_id and b.owner=p.owner
  left join public.school_manager_boards sb on sb.board_id=b.id
  left join public.school_manager_schools s on s.id=sb.school_id
  where p.by='hs' and b.auto_grade and not b.archived and not b.trashed and b.assignment->'agentReviewV2'='true'::jsonb
    and (sb.board_id is null or (s.status='active' and s.agent_policy->'agentReview' is distinct from 'false'::jsonb))
    and ((p.teacher->>'approvedAt' is null and p.teacher->>'score' is null and p.teacher#>>'{assist,a}' is null
      and (p.body ~ '[^[:space:]]' or p.images<>'[]'::jsonb or p.attachments<>'[]'::jsonb)
      and (p.teacher#>>'{assist,agentReview,kind}'='analysis'
        or (p.teacher#>>'{assist,agentReview}' is null and p.ai is null and p.ai_at is null)))
      or (p.teacher#>>'{assist,agentReview,kind}'='practice' and p.teacher->>'approvedAt' is not null
        and p.teacher#>>'{assist,a,review,status}'='approved' and p.teacher#>>'{assist,a,practice}' is null))
    and (p.teacher#>>'{assist,agentReview}' is null or p.teacher#>>'{assist,agentReview,status}'='pending'
      or (p.teacher#>>'{assist,agentReview,status}'='running'
        and coalesce(nullif(p.teacher#>>'{assist,agentReview,until}','')::bigint,0)<=(extract(epoch from now())*1000)::bigint)
      or (p.teacher#>>'{assist,agentReview,status}'='failed' and
        ((p.ai is not null and p.ai_at is not null and p.teacher#>>'{assist,agentReview,kind}'='analysis')
          or (coalesce(nullif(p.teacher#>>'{assist,agentReview,cycleAttempts}','')::integer,
              nullif(p.teacher#>>'{assist,agentReview,attempts}','')::integer,0)<3
            and nullif(p.teacher#>>'{assist,agentReview,retryAt}','')::bigint between 1 and (extract(epoch from now())*1000)::bigint))))
  order by (p.ai is null),p.created_at,p.id limit least(greatest(coalesce(p_limit,12),1),30);
$$;

revoke all on function public.claim_agent_review_slot(uuid),public.release_agent_review_slot(uuid),
  public.pause_agent_review_parallel(integer),public.agent_review_parallel_state(),public.requeue_agent_review_failed(uuid)
  from public,anon,authenticated;
grant execute on function public.claim_agent_review_slot(uuid),public.release_agent_review_slot(uuid),
  public.pause_agent_review_parallel(integer),public.agent_review_parallel_state(),public.requeue_agent_review_failed(uuid)
  to service_role;
revoke all on function public.agent_review_v2_due_posts(integer) from public,anon,authenticated;
grant execute on function public.agent_review_v2_due_posts(integer) to service_role;
