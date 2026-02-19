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
CREATE POLICY "admins_read_own_row"
    ON admins FOR SELECT
    USING (user_id = auth.uid());

-- ================================
-- ADMIN POLICIES — Admins can read ALL centers
-- ================================
CREATE POLICY "admins_read_all_centers"
    ON centers FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can INSERT centers
-- ================================
CREATE POLICY "admins_insert_centers"
    ON centers FOR INSERT
    WITH CHECK (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can UPDATE centers
-- ================================
CREATE POLICY "admins_update_centers"
    ON centers FOR UPDATE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can DELETE centers
-- ================================
CREATE POLICY "admins_delete_centers"
    ON centers FOR DELETE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can read ALL supervisors
-- ================================
CREATE POLICY "admins_read_all_supervisors"
    ON supervisors FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can INSERT supervisors
-- ================================
CREATE POLICY "admins_insert_supervisors"
    ON supervisors FOR INSERT
    WITH CHECK (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can UPDATE supervisors
-- ================================
CREATE POLICY "admins_update_supervisors"
    ON supervisors FOR UPDATE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can DELETE supervisors
-- ================================
CREATE POLICY "admins_delete_supervisors"
    ON supervisors FOR DELETE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can read ALL examinees
-- ================================
CREATE POLICY "admins_read_all_examinees"
    ON examinees FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can INSERT examinees
-- ================================
CREATE POLICY "admins_insert_examinees"
    ON examinees FOR INSERT
    WITH CHECK (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can UPDATE examinees
-- ================================
CREATE POLICY "admins_update_examinees"
    ON examinees FOR UPDATE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can DELETE examinees
-- ================================
CREATE POLICY "admins_delete_examinees"
    ON examinees FOR DELETE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can read ALL attendance records
-- ================================
CREATE POLICY "admins_read_all_attendance"
    ON attendance_records FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ================================
-- ADMIN POLICIES — Admins can DELETE attendance records
-- ================================
CREATE POLICY "admins_delete_attendance"
    ON attendance_records FOR DELETE
    USING (
        auth.uid() IN (SELECT user_id FROM admins)
    );

-- ============================================================
-- NOTES
-- ============================================================
-- * Admins can see and manage ALL centers, supervisors, examinees
-- * Admins can create new supervisors (after creating their Auth user)
-- * Supervisors' existing policies remain unchanged — they still
--   only see their own center's data
-- * To create the first admin, run the following manually in SQL Editor
--   AFTER creating the auth user via Authentication > Users:
--
--   INSERT INTO admins (user_id, full_name, email) VALUES
--       ('PASTE-ADMIN-AUTH-UID', 'Admin Name', 'admin@example.com');
-- ============================================================
