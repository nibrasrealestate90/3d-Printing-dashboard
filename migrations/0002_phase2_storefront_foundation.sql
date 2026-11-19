CREATE SEQUENCE IF NOT EXISTS public.store_rfq_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS public.store_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    product_id VARCHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'IN_REVIEW', 'RESPONDED', 'ARCHIVED')),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_enquiries_created_at ON public.store_enquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_enquiries_status ON public.store_enquiries(status);

CREATE INDEX IF NOT EXISTS idx_store_enquiries_email ON public.store_enquiries(customer_email);

CREATE TABLE IF NOT EXISTS public.store_quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_reference VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    project_title VARCHAR(200) NOT NULL,
    project_description TEXT NOT NULL,
    material_preference VARCHAR(100),
    color_preference VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    target_deadline DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (status IN ('PENDING_REVIEW', 'ESTIMATING', 'QUOTED', 'ACCEPTED', 'DECLINED', 'ARCHIVED')),
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    estimated_amount NUMERIC(10,2),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_quote_requests_rfq ON public.store_quote_requests(rfq_reference);

CREATE INDEX IF NOT EXISTS idx_store_quote_requests_created_at ON public.store_quote_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_quote_requests_status ON public.store_quote_requests(status);

CREATE INDEX IF NOT EXISTS idx_store_quote_requests_email ON public.store_quote_requests(customer_email);

CREATE TABLE IF NOT EXISTS public.store_quote_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID REFERENCES public.store_quote_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    checksum_sha256 VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_quote_files_quote_id ON public.store_quote_files(quote_request_id);

CREATE INDEX IF NOT EXISTS idx_store_quote_files_storage_key ON public.store_quote_files(storage_key);
