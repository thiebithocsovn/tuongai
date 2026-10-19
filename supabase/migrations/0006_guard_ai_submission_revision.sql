-- Reject an obsolete AI result if a student changes the work during grading.
-- Keeps teacher regrading possible while ensuring the snapshot is the same.
CREATE OR REPLACE FUNCTION public.grade_post_if_unchanged(
  p_post_id uuid, p_expected_body text, p_expected_images jsonb,
  p_ai jsonb, p_ai_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.posts AS p SET ai=p_ai, ai_at=p_ai_at
    WHERE p.id=p_post_id AND p.body=p_expected_body
      AND p.images=p_expected_images;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected=1;
END;
$$;
REVOKE ALL ON FUNCTION public.grade_post_if_unchanged(uuid,text,jsonb,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grade_post_if_unchanged(uuid,text,jsonb,jsonb,timestamptz) TO service_role;
