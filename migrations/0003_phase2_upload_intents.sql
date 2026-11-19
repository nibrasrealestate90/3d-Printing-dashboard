-- Migration: 0003_phase2_upload_intents.sql
-- Description: Additive schema for server-controlled CAD upload intents, token-binding, and quarantine tracking.
-- Guarantees: ZERO modifications to public.ledger_collections.

CREATE TABLE IF NOT EXISTS public.store_upload_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(500) UNIQUE NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'UPLOADED', 'CONSUMED', 'EXPIRED', 'REJECTED')),
    quote_id UUID REFERENCES public.store_quote_requests(id) ON DELETE SET NULL,
    client_ip VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_upload_intents_token_hash ON public.store_upload_intents(token_hash);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_status ON public.store_upload_intents(status);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_expires_at ON public.store_upload_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_quote_id ON public.store_upload_intents(quote_id);

-- Additive columns to store_quote_files for intent linkage and quarantine safety
ALTER TABLE public.store_quote_files
    ADD COLUMN IF NOT EXISTS upload_intent_id UUID REFERENCES public.store_upload_intents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scan_status VARCHAR(30) NOT NULL DEFAULT 'UNSCANNED';
