-- Validate student-uploaded files from inside Postgres, avoiding unexposed storage schema in REST.
CREATE OR REPLACE FUNCTION public.work_file_uploads_verified(p_files jsonb)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT coalesce(
    jsonb_typeof(p_files) = 'array'
    AND jsonb_array_length(p_files) <= 5
    AND (
      SELECT count(*) = jsonb_array_length(p_files)
      FROM jsonb_to_recordset(p_files) AS f(path text, name text, size bigint, type text)
      JOIN storage.objects o ON o.bucket_id='work' AND o.name=f.path
      WHERE f.size BETWEEN 1 AND 26214400
        AND coalesce((o.metadata->>'size')::bigint,-1) = f.size
        AND lower(coalesce(o.metadata->>'mimetype','')) = f.type
    ), false
  )
$$;
REVOKE ALL ON FUNCTION public.work_file_uploads_verified(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_file_uploads_verified(jsonb) TO service_role;
