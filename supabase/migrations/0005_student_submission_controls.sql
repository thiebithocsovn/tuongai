-- Only a matching student submission token can change an ungraded submission.
-- Guard runs inside PostgreSQL as one atomic UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.student_update_ungraded_post(
  p_post_id uuid, p_board_id uuid, p_student_token text,
  p_body text, p_images jsonb DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.posts;
BEGIN
  IF length(coalesce(p_student_token,'')) < 16
    OR length(coalesce(p_body,'')) > 8000
    OR (p_images IS NOT NULL AND (
      jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) > 4))
  THEN RETURN NULL; END IF;
  UPDATE public.posts AS p SET
    body = p_body,
    images = coalesce(p_images,p.images)
  WHERE p.id=p_post_id AND p.board_id=p_board_id
    AND p.student_token=p_student_token AND p.by='hs'
    AND p.ai IS NULL AND p.ai_at IS NULL
    AND (p.teacher->>'score') IS NULL AND (p.teacher->>'approvedAt') IS NULL
  RETURNING p.* INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_delete_ungraded_post(
  p_post_id uuid, p_board_id uuid, p_student_token text
) RETURNS public.posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.posts;
BEGIN
  IF length(coalesce(p_student_token,'')) < 16 THEN RETURN NULL; END IF;
  DELETE FROM public.posts AS p
  WHERE p.id=p_post_id AND p.board_id=p_board_id
    AND p.student_token=p_student_token AND p.by='hs'
    AND p.ai IS NULL AND p.ai_at IS NULL
    AND (p.teacher->>'score') IS NULL AND (p.teacher->>'approvedAt') IS NULL
  RETURNING p.* INTO rec;
  RETURN rec;
END;
$$;
REVOKE ALL ON FUNCTION public.student_update_ungraded_post(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_delete_ungraded_post(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_update_ungraded_post(uuid,uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.student_delete_ungraded_post(uuid,uuid,text) TO service_role;
