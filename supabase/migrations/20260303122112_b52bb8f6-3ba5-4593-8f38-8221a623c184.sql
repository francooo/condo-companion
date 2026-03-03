
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Knowledge base table for RAG (rules/regulations)
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

-- Financial records table
CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- Public read policies (condo app - all residents can read)
CREATE POLICY "Anyone can read knowledge_base" ON public.knowledge_base FOR SELECT USING (true);
CREATE POLICY "Anyone can insert knowledge_base" ON public.knowledge_base FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete knowledge_base" ON public.knowledge_base FOR DELETE USING (true);

CREATE POLICY "Anyone can read financial_records" ON public.financial_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert financial_records" ON public.financial_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete financial_records" ON public.financial_records FOR DELETE USING (true);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
