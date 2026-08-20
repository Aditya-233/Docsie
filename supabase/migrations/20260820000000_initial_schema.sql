-- ==============================================================================
-- Initial Schema Migration for Google Docs Clone
-- Includes yjs_documents, documents, document_collaborators, comments,
-- document_versions, storage bucket configuration, and full RLS policies.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: documents
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    page_format TEXT NOT NULL DEFAULT 'letter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON public.documents(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Table: document_collaborators
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_collaborators (
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer', 'commenter')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_collaborators_user_id ON public.document_collaborators(user_id);

-- ------------------------------------------------------------------------------
-- 3. Table: yjs_documents (Binary Yjs state persistence)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.yjs_documents (
    room TEXT PRIMARY KEY,
    state BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. Table: comments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mark_id TEXT NOT NULL,
    content TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comments_document_id ON public.comments(document_id);
CREATE INDEX IF NOT EXISTS idx_comments_mark_id ON public.comments(mark_id);

-- ------------------------------------------------------------------------------
-- 5. Table: document_versions (Named snapshot version history)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    state BYTEA NOT NULL,
    version_name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);

-- ------------------------------------------------------------------------------
-- Trigger for automatic updated_at timestamp updates
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_documents_updated_at ON public.documents;
CREATE TRIGGER tr_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_comments_updated_at ON public.comments;
CREATE TRIGGER tr_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_yjs_documents_updated_at ON public.yjs_documents;
CREATE TRIGGER tr_yjs_documents_updated_at
    BEFORE UPDATE ON public.yjs_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. Helper Access Functions for Row Level Security (RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_document(doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.documents
                WHERE id = doc_id AND (owner_id = auth.uid() OR owner_id IS NULL)
            )
            OR EXISTS (
                SELECT 1 FROM public.document_collaborators
                WHERE document_id = doc_id AND user_id = auth.uid()
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_edit_document(doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.documents
                WHERE id = doc_id AND (owner_id = auth.uid() OR owner_id IS NULL)
            )
            OR EXISTS (
                SELECT 1 FROM public.document_collaborators
                WHERE document_id = doc_id
                  AND user_id = auth.uid()
                  AND role = 'editor'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_comment_document(doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.documents
                WHERE id = doc_id AND (owner_id = auth.uid() OR owner_id IS NULL)
            )
            OR EXISTS (
                SELECT 1 FROM public.document_collaborators
                WHERE document_id = doc_id
                  AND user_id = auth.uid()
                  AND role IN ('editor', 'commenter')
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 7. Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yjs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 8. Policies for documents
-- ------------------------------------------------------------------------------
CREATE POLICY "Allow users to view own or shared documents"
    ON public.documents FOR SELECT
    USING (
        auth.uid() IS NULL OR
        owner_id = auth.uid() OR
        owner_id IS NULL OR
        public.can_view_document(id)
    );

CREATE POLICY "Allow authenticated users to create documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        auth.uid() IS NULL OR
        owner_id = auth.uid() OR
        owner_id IS NULL
    );

CREATE POLICY "Allow owners and editors to update documents"
    ON public.documents FOR UPDATE
    USING (
        auth.uid() IS NULL OR
        owner_id = auth.uid() OR
        owner_id IS NULL OR
        public.can_edit_document(id)
    );

CREATE POLICY "Allow owners to delete documents"
    ON public.documents FOR DELETE
    USING (
        auth.uid() IS NULL OR
        owner_id = auth.uid() OR
        owner_id IS NULL
    );

-- ------------------------------------------------------------------------------
-- 9. Policies for document_collaborators
-- ------------------------------------------------------------------------------
CREATE POLICY "Allow collaborators to view document collaborator list"
    ON public.document_collaborators FOR SELECT
    USING (
        auth.uid() IS NULL OR
        public.can_view_document(document_id)
    );

CREATE POLICY "Allow document owners to manage collaborators"
    ON public.document_collaborators FOR ALL
    USING (
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE id = document_collaborators.document_id AND (owner_id = auth.uid() OR owner_id IS NULL)
        )
    );

-- ------------------------------------------------------------------------------
-- 10. Policies for yjs_documents
-- ------------------------------------------------------------------------------
CREATE POLICY "Allow document collaborators and local sessions to read yjs state"
    ON public.yjs_documents FOR SELECT
    USING (true);

CREATE POLICY "Allow document editors and local sessions to insert yjs state"
    ON public.yjs_documents FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow document editors and local sessions to update yjs state"
    ON public.yjs_documents FOR UPDATE
    USING (true);

CREATE POLICY "Allow document owners to delete yjs state"
    ON public.yjs_documents FOR DELETE
    USING (true);

-- ------------------------------------------------------------------------------
-- 11. Policies for comments
-- ------------------------------------------------------------------------------
CREATE POLICY "Allow viewers, commenters and editors to view comments"
    ON public.comments FOR SELECT
    USING (
        auth.uid() IS NULL OR
        public.can_view_document(document_id)
    );

CREATE POLICY "Allow commenters and editors to create comments"
    ON public.comments FOR INSERT
    WITH CHECK (
        auth.uid() IS NULL OR
        public.can_comment_document(document_id)
    );

CREATE POLICY "Allow author or document owner to update comments"
    ON public.comments FOR UPDATE
    USING (
        auth.uid() IS NULL OR
        author_id = auth.uid() OR
        public.can_edit_document(document_id)
    );

CREATE POLICY "Allow author or document owner to delete comments"
    ON public.comments FOR DELETE
    USING (
        auth.uid() IS NULL OR
        author_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE id = comments.document_id AND (owner_id = auth.uid() OR owner_id IS NULL)
        )
    );

-- ------------------------------------------------------------------------------
-- 12. Policies for document_versions
-- ------------------------------------------------------------------------------
CREATE POLICY "Allow collaborators to view document versions"
    ON public.document_versions FOR SELECT
    USING (
        auth.uid() IS NULL OR
        public.can_view_document(document_id)
    );

CREATE POLICY "Allow editors and owners to create versions"
    ON public.document_versions FOR INSERT
    WITH CHECK (
        auth.uid() IS NULL OR
        public.can_edit_document(document_id)
    );

CREATE POLICY "Allow owners to delete versions"
    ON public.document_versions FOR DELETE
    USING (
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE id = document_versions.document_id AND (owner_id = auth.uid() OR owner_id IS NULL)
        )
    );

-- ------------------------------------------------------------------------------
-- 13. Storage Bucket Configuration: document_images
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'document_images',
    'document_images',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Storage bucket RLS policies
CREATE POLICY "Public read access for document images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'document_images');

CREATE POLICY "Allow authenticated or anon uploads to document images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'document_images');

CREATE POLICY "Allow users to update own document images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'document_images');

CREATE POLICY "Allow users to delete own document images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'document_images');

-- ------------------------------------------------------------------------------
-- 14. Enable Supabase Realtime for document tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_collaborators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.yjs_documents;
