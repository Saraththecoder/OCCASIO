-- Occasio Supabase Schema SQL
-- Run this in the Supabase SQL Editor

-- 1. Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create `shops` table
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_chat_id TEXT UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., restaurant, cafe, retail, salon, other
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create `occasions` table
CREATE TABLE IF NOT EXISTS public.occasions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date TEXT NOT NULL, -- e.g. "2026-10-12" or festival date description
    category_tags JSONB DEFAULT '[]'::jsonb, -- e.g. ["restaurant", "cafe", "all"]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create `posts` table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    occasion_id UUID REFERENCES public.occasions(id) ON DELETE SET NULL,
    discount_product TEXT,
    discount_amount TEXT,
    product_photo_url TEXT,
    caption_text TEXT,
    poster_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Seed 5 hardcoded occasions
INSERT INTO public.occasions (name, date, category_tags)
VALUES 
    ('Dasara', '2026-10-12', '["restaurant", "cafe", "retail", "salon", "other"]'::jsonb),
    ('Diwali', '2026-11-01', '["restaurant", "cafe", "retail", "salon", "other"]'::jsonb),
    ('New Year', '2027-01-01', '["restaurant", "cafe", "retail", "salon", "other"]'::jsonb),
    ('Independence Day', '2026-08-15', '["restaurant", "cafe", "retail", "salon", "other"]'::jsonb),
    ('Weekend Special', 'Weekly', '["restaurant", "cafe", "retail", "salon", "other"]'::jsonb)
ON CONFLICT DO NOTHING;

-- 6. Storage Bucket setup instruction:
-- Create a public bucket in Supabase Storage named `posters` with public read access enabled.
