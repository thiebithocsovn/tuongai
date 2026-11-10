-- Only the service-role worker can discover V2 jobs; never return pupil work through this RPC.
create or replace function public.agent_review_v2_due_posts(p_limit integer default 12)
returns table(post_id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id
  from public.posts as p
  join public.boards as b on b.id = p.board_id and b.owner = p.owner
  where p.by = 'hs'
    and b.auto_grade is true
    and b.trashed is not true
    and b.archived is not true
    and b.assignment->>'agentReviewV2' = 'true'
    and (
      ((p.teacher #>> '{assist,agentReview,kind}') = 'analysis'
       and p.teacher->>'approvedAt' is null
       and p.teacher #> '{assist,a}' is null)
      or
      ((p.teacher #>> '{assist,agentReview,kind}') = 'practice'
       and p.teacher->>'approvedAt' is not null
       and coalesce(p.teacher #> '{assist,a,practice}', 'null'::jsonb) = 'null'::jsonb)
    )
    and (
      p.teacher #>> '{assist,agentReview,status}' = 'pending'
      or
      (p.teacher #>> '{assist,agentReview,status}' = 'running'
       and coalesce(nullif(p.teacher #>> '{assist,agentReview,until}', '')::bigint, 0)
           < (extract(epoch from now()) * 1000)::bigint)
      or
      (p.teacher #>> '{assist,agentReview,status}' = 'failed'
       and coalesce(nullif(p.teacher #>> '{assist,agentReview,attempts}', '')::integer, 0) < 3
       and coalesce(nullif(p.teacher #>> '{assist,agentReview,retryAt}', '')::bigint, 0) > 0
       and coalesce(nullif(p.teacher #>> '{assist,agentReview,retryAt}', '')::bigint, 0)
           <= (extract(epoch from now()) * 1000)::bigint)
    )
  order by p.created_at asc, p.id
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke all on function public.agent_review_v2_due_posts(integer) from public, anon, authenticated;
grant execute on function public.agent_review_v2_due_posts(integer) to service_role;

create index if not exists posts_agent_review_v2_queue_idx
on public.posts(created_at, id)
where by = 'hs' and teacher #>> '{assist,agentReview,status}'
  in ('pending', 'running', 'failed');

-- Token never reaches a browser or a function response; app_config is service-role only.
insert into public.app_config (key, value)
values ('agent_review_cron_token', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;
