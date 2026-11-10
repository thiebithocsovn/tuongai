-- Update only teacher data, and reject work on a stale post or teacher snapshot.
-- Authenticated callers remain subject to the existing posts RLS policies.
create or replace function public.update_post_teacher_if_unchanged(
  p_id uuid, p_board uuid, p_owner uuid, p_expected_teacher jsonb, p_teacher jsonb,
  p_expected_work jsonb default null
) returns boolean
language sql security invoker set search_path = '' as $$
  with changed as (
    update public.posts as p
    set teacher = p_teacher
    where p.id = p_id and p.board_id = p_board and p.owner = p_owner
      and p.teacher is not distinct from p_expected_teacher
      and (p_expected_work is null or jsonb_build_array(p.body, p.images, p.attachments) = p_expected_work)
    returning 1
  )
  select exists (select 1 from changed);
$$;

revoke all on function public.update_post_teacher_if_unchanged(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_post_teacher_if_unchanged(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  to authenticated, service_role;

-- A pupil can still edit an ungraded submission. Its previous draft or in-flight
-- analysis belongs to the previous version and must not be approved.
create or replace function public.reset_agent_review_on_work_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.teacher := jsonb_set(
    coalesce(new.teacher, '{}'::jsonb), '{assist}',
    (coalesce(new.teacher->'assist', '{}'::jsonb) - 'a') ||
      jsonb_build_object('agentReview', jsonb_build_object(
        'kind', 'analysis', 'status', 'pending', 'workRevision', gen_random_uuid()
      ))
  );
  return new;
end;
$$;

revoke all on function public.reset_agent_review_on_work_edit() from public, anon, authenticated;

create or replace trigger reset_agent_review_on_work_edit
before update of body, images, attachments on public.posts
for each row when (
  old.by = 'hs' and old.teacher->>'approvedAt' is null
  and old.teacher #> '{assist,agentReview}' is not null
  and (old.body is distinct from new.body or old.images is distinct from new.images
    or old.attachments is distinct from new.attachments)
)
execute function public.reset_agent_review_on_work_edit();
