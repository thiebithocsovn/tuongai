-- Student and teacher attachments are stored privately in the existing work bucket.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD CONSTRAINT posts_attachments_array CHECK (jsonb_typeof(attachments)='array');

-- Atomic owner-and-grade gated revision for text, images and file attachments.
CREATE OR REPLACE FUNCTION public.student_update_ungraded_post_with_files(
  p_post_id uuid, p_board_id uuid, p_student_token text,
  p_body text, p_images jsonb DEFAULT NULL, p_attachments jsonb DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.posts;
BEGIN
  IF length(coalesce(p_student_token,'')) < 16
    OR length(coalesce(p_body,'')) > 8000
    OR (p_images IS NOT NULL AND (jsonb_typeof(p_images)<>'array' OR jsonb_array_length(p_images)>4))
    OR (p_attachments IS NOT NULL AND (jsonb_typeof(p_attachments)<>'array' OR jsonb_array_length(p_attachments)>5))
  THEN RETURN NULL; END IF;
  UPDATE public.posts AS p SET
    body = p_body, images = coalesce(p_images,p.images),
    attachments = coalesce(p_attachments,p.attachments)
  WHERE p.id=p_post_id AND p.board_id=p_board_id
    AND p.student_token=p_student_token AND p.by='hs'
    AND p.ai IS NULL AND p.ai_at IS NULL
    AND (p.teacher->>'score') IS NULL AND (p.teacher->>'approvedAt') IS NULL
  RETURNING p.* INTO rec;
  RETURN rec;
END;
$$;
REVOKE ALL ON FUNCTION public.student_update_ungraded_post_with_files(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_update_ungraded_post_with_files(uuid,uuid,text,text,jsonb,jsonb) TO service_role;
