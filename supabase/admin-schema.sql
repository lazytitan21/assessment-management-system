-- ============================================================
-- Assessment Management System — Admin Schema
-- Run this AFTER schema.sql and rls.sql in the Supabase SQL Editor
-- ============================================================

-- ================================
-- ADMINS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS admins (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE admins IS 'Admin users who can manage supervisors, centers, and examinees';

-- ================================
-- Enable RLS on admins table
-- ================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Admins can read their own row
DROP POLICY IF EXISTS "admins_read_own_row" ON admins;
CREATE POLICY "admins_read_own_row"
    ON admins FOR SELECT
    USING (user_id = auth.uid());

-- ================================
-- SECURITY DEFINER FUNCTION — bypasses RLS on admins table
-- This avoids nested-RLS issues where subquery on admins
-- is itself blocked by RLS during INSERT/UPDATE/DELETE
-- ================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admins WHERE user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.is_admin() IS
    'Returns true if the current auth user is an admin. SECURITY DEFINER bypasses RLS.';

-- ================================
-- ADMIN POLICIES — Centers (full CRUD)
-- ================================
DROP POLICY IF EXISTS "admins_read_all_centers" ON centers;
CREATE POLICY "admins_read_all_centers"
    ON centers FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_centers" ON centers;
CREATE POLICY "admins_insert_centers"
    ON centers FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_centers" ON centers;
CREATE POLICY "admins_update_centers"
    ON centers FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_centers" ON centers;
CREATE POLICY "admins_delete_centers"
    ON centers FOR DELETE
    USING (public.is_admin());

-- ================================
-- ADMIN POLICIES — Assessments (full CRUD)
-- ================================
DROP POLICY IF EXISTS "admins_read_all_assessments" ON assessments;
CREATE POLICY "admins_read_all_assessments"
    ON assessments FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_assessments" ON assessments;
CREATE POLICY "admins_insert_assessments"
    ON assessments FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_assessments" ON assessments;
CREATE POLICY "admins_update_assessments"
    ON assessments FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_assessments" ON assessments;
CREATE POLICY "admins_delete_assessments"
    ON assessments FOR DELETE
    USING (public.is_admin());

-- ================================
-- ADMIN POLICIES — Supervisors (full CRUD)
-- ================================
DROP POLICY IF EXISTS "admins_read_all_supervisors" ON supervisors;
CREATE POLICY "admins_read_all_supervisors"
    ON supervisors FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_supervisors" ON supervisors;
CREATE POLICY "admins_insert_supervisors"
    ON supervisors FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_supervisors" ON supervisors;
CREATE POLICY "admins_update_supervisors"
    ON supervisors FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_supervisors" ON supervisors;
CREATE POLICY "admins_delete_supervisors"
    ON supervisors FOR DELETE
    USING (public.is_admin());

-- ================================
-- ADMIN POLICIES — Examinees (full CRUD)
-- ================================
DROP POLICY IF EXISTS "admins_read_all_examinees" ON examinees;
CREATE POLICY "admins_read_all_examinees"
    ON examinees FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_examinees" ON examinees;
CREATE POLICY "admins_insert_examinees"
    ON examinees FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_examinees" ON examinees;
CREATE POLICY "admins_update_examinees"
    ON examinees FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_examinees" ON examinees;
CREATE POLICY "admins_delete_examinees"
    ON examinees FOR DELETE
    USING (public.is_admin());

-- ================================
-- ADMIN POLICIES — Attendance Records (read + delete)
-- ================================
DROP POLICY IF EXISTS "admins_read_all_attendance" ON attendance_records;
CREATE POLICY "admins_read_all_attendance"
    ON attendance_records FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_attendance" ON attendance_records;
CREATE POLICY "admins_delete_attendance"
    ON attendance_records FOR DELETE
    USING (public.is_admin());

-- ================================
-- Reload PostgREST schema cache
-- ================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- NOTES
-- ============================================================
-- * The is_admin() function uses SECURITY DEFINER so it can
--   read the admins table without being blocked by RLS.
--   This is the standard Supabase pattern for nested RLS checks.
-- * All admin policies now use is_admin() instead of subqueries.
-- * Supervisors' existing policies remain unchanged.
-- * To create the first admin, run manually in SQL Editor
--   AFTER creating the auth user via Authentication > Users:
--
--   INSERT INTO admins (user_id, full_name, email) VALUES
--       ('PASTE-ADMIN-AUTH-UID', 'Admin Name', 'admin@example.com');
-- ============================================================
