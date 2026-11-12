-- Fase 2: biblioteca de documentos com status, texto por página e arquivo original.

-- Binários (documento original; depois logo/avatar/capa). Limite aplicado na API.
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid REFERENCES condos(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('document','logo','avatar','cover')),
  mime text NOT NULL,
  size integer NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX files_condo_idx ON files(condo_id);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid NOT NULL REFERENCES condos(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime text,
  size bigint,
  category text NOT NULL DEFAULT 'outros'
    CHECK (category IN ('convencao','regimento','atas','comunicados','regulamentos','manuais','outros')),
  description text,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','processing','processed','failed','needs_review')),
  active boolean NOT NULL DEFAULT true,
  page_count integer,
  chunk_count integer NOT NULL DEFAULT 0,
  error text,
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX documents_condo_idx ON documents(condo_id, created_at DESC);

-- Texto extraído por página: base da prévia e da citação "arquivo + página".
CREATE TABLE document_pages (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page integer NOT NULL,
  content text NOT NULL,
  PRIMARY KEY (document_id, page)
);

ALTER TABLE knowledge_base
  ADD COLUMN document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  ADD COLUMN page integer,
  ADD COLUMN summarized boolean NOT NULL DEFAULT false;

-- Trechos existentes já foram resumidos na ingestão antiga.
UPDATE knowledge_base SET summarized = true;

-- Backfill: um documento por arquivo já enviado (condomínio + nome do arquivo).
WITH grouped AS (
  SELECT condo_id,
         COALESCE(NULLIF(trim(metadata->>'filename'), ''), 'Documento sem nome') AS filename,
         COUNT(*)::int AS chunks,
         MIN(created_at) AS first_at,
         MAX(created_at) AS last_at
    FROM knowledge_base
   GROUP BY 1, 2
)
INSERT INTO documents (condo_id, filename, mime, category, status, chunk_count, created_at, updated_at, processed_at)
SELECT condo_id,
       filename,
       CASE WHEN lower(filename) LIKE '%.pdf' THEN 'application/pdf' ELSE 'text/plain' END,
       'outros', 'processed', chunks, first_at, last_at, last_at
  FROM grouped;

UPDATE knowledge_base kb
   SET document_id = d.id
  FROM documents d
 WHERE d.condo_id = kb.condo_id
   AND d.filename = COALESCE(NULLIF(trim(kb.metadata->>'filename'), ''), 'Documento sem nome');

ALTER TABLE knowledge_base ALTER COLUMN document_id SET NOT NULL;
CREATE INDEX knowledge_base_document_idx ON knowledge_base(document_id, page);
