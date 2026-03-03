
-- Fix search_path for match_knowledge_base with extensions schema for vector
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding text,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5,
  filter_condo_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding::vector) AS similarity
  FROM public.knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_condo_id IS NULL OR kb.condo_id = filter_condo_id)
  ORDER BY kb.embedding <=> query_embedding::vector
  LIMIT match_count;
$$;
