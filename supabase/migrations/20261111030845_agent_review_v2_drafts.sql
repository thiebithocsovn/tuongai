-- Discover new work even when a teacher enabled V2 after the first submission.
create or replace function public.agent_review_v2_due_posts(p_limit integer default 12)
returns table(post_id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id
  from public.posts p
  join public.boards b on b.id = p.board_id and b.owner = p.owner
  left join public.school_manager_boards sb on sb.board_id = b.id
  left join public.school_manager_schools s on s.id = sb.school_id
  where p.by = 'hs'
    and b.auto_grade and not b.archived and not b.trashed
    and b.assignment->'agentReviewV2' = 'true'::jsonb
    and (sb.board_id is null or (s.status = 'active' and s.agent_policy->'agentReview' is distinct from 'false'::jsonb))
    and (
      (
        p.teacher->>'approvedAt' is null and p.teacher->>'score' is null
        and p.teacher #>> '{assist,a}' is null
        and (p.body ~ '[^[:space:]]' or p.images <> '[]'::jsonb or p.attachments <> '[]'::jsonb)
        and (p.teacher #>> '{assist,agentReview,kind}' = 'analysis'
          or (p.teacher #>> '{assist,agentReview}' is null and p.ai is null and p.ai_at is null))
      )
      or (
        p.teacher #>> '{assist,agentReview,kind}' = 'practice'
        and p.teacher->>'approvedAt' is not null
        and p.teacher #>> '{assist,a,review,status}' = 'approved'
        and p.teacher #>> '{assist,a,practice}' is null
      )
    )
    and (
      p.teacher #>> '{assist,agentReview}' is null
      or p.teacher #>> '{assist,agentReview,status}' = 'pending'
      or (
        p.teacher #>> '{assist,agentReview,status}' = 'running'
        and coalesce(nullif(p.teacher #>> '{assist,agentReview,until}', '')::bigint, 0)
            <= (extract(epoch from now()) * 1000)::bigint
      )
      or (
        p.teacher #>> '{assist,agentReview,status}' = 'failed'
        and coalesce(nullif(p.teacher #>> '{assist,agentReview,attempts}', '')::integer, 0) < 3
        and nullif(p.teacher #>> '{assist,agentReview,retryAt}', '')::bigint
            between 1 and (extract(epoch from now()) * 1000)::bigint
      )
    )
  order by p.created_at asc, p.id
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

-- Lock the opt-in setting for the duration of each V2 claim and save.
create or replace function public.update_agent_review_v2_if_unchanged(
  p_id uuid, p_board uuid, p_owner uuid, p_expected_teacher jsonb, p_teacher jsonb, p_expected_work jsonb
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1
  from public.boards b
  left join public.school_manager_boards sb on sb.board_id = b.id
  left join public.school_manager_schools s on s.id = sb.school_id
  where b.id = p_board and b.owner = p_owner
    and b.auto_grade and not b.archived and not b.trashed
    and b.assignment->'agentReviewV2' = 'true'::jsonb
    and (sb.board_id is null or (s.status = 'active' and s.agent_policy->'agentReview' is distinct from 'false'::jsonb))
  for share of b;
  if not found then return false; end if;
  return public.update_post_teacher_if_unchanged(p_id, p_board, p_owner, p_expected_teacher, p_teacher, p_expected_work);
end;
$$;

revoke all on function public.update_agent_review_v2_if_unchanged(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_agent_review_v2_if_unchanged(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  to service_role;

-- A pupil edit restarts the same opt-in job with the new version of the work.
create or replace function public.reset_agent_review_on_work_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.teacher := jsonb_set(
    coalesce(new.teacher, '{}'::jsonb), '{assist}',
    (coalesce(new.teacher->'assist', '{}'::jsonb) - 'a') ||
      jsonb_build_object('agentReview', jsonb_strip_nulls(jsonb_build_object(
        'kind', 'analysis', 'status', 'pending', 'workRevision', gen_random_uuid(),
        'v2', old.teacher #> '{assist,agentReview,v2}'
      )))
  );
  return new;
end;
$$;
