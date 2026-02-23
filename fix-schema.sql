-- ============================================================
-- FIX: Create missing assessments table & add assessment_id to examinees
-- Run this in Supabase SQL Editor: 
--   https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

-- 1. Create the assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    exam_date   DATE,
    created_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Add assessment_id column to examinees (skip if already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'examinees' 
          AND column_name = 'assessment_id'
    ) THEN
        ALTER TABLE public.examinees 
            ADD COLUMN assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Add session_number column (optional but used by code)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'examinees' 
          AND column_name = 'session_number'
    ) THEN
        ALTER TABLE public.examinees ADD COLUMN session_number INTEGER;
    END IF;
END $$;

-- 4. Add room column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'examinees' 
          AND column_name = 'room'
    ) THEN
        ALTER TABLE public.examinees ADD COLUMN room TEXT;
    END IF;
END $$;

-- 5. Add seat_number column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'examinees' 
          AND column_name = 'seat_number'
    ) THEN
        ALTER TABLE public.examinees ADD COLUMN seat_number INTEGER;
    END IF;
END $$;

-- 6. Create index on assessment_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_examinees_assessment_id ON public.examinees(assessment_id);

-- 7. Grant access so PostgREST can see the new table
GRANT ALL ON public.assessments TO anon, authenticated, service_role;
GRANT ALL ON public.examinees TO anon, authenticated, service_role;

-- 8. Refresh PostgREST schema cache so new columns/tables are visible via REST API
NOTIFY pgrst, 'reload schema';

-- Done! You should see "Success. No rows returned." after running this.
