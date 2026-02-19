-- ============================================================
-- Assessment Management System — Row Level Security Policies
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- ================================
-- Enable RLS on all tables
-- ================================
ALTER TABLE centers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE examinees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;

-- ================================
-- CENTERS — Supervisors can read only their own center
-- ================================
CREATE POLICY "supervisors_read_own_center"
    ON centers FOR SELECT
    USING (
        id IN (
            SELECT center_id FROM supervisors WHERE user_id = auth.uid()
        )
    );

-- ================================
-- SUPERVISORS — Can read only their own row
-- ================================
CREATE POLICY "supervisors_read_own_row"
    ON supervisors FOR SELECT
    USING (user_id = auth.uid());

-- ================================
-- EXAMINEES — Supervisors can read examinees in their center
-- ================================
CREATE POLICY "supervisors_read_center_examinees"
    ON examinees FOR SELECT
    USING (
        center_id IN (
            SELECT center_id FROM supervisors WHERE user_id = auth.uid()
        )
    );

-- ================================
-- ATTENDANCE RECORDS — Insert only for own center
-- ================================
CREATE POLICY "supervisors_insert_attendance_own_center"
    ON attendance_records FOR INSERT
    WITH CHECK (
        -- Must be the logged-in user
        scanned_by = auth.uid()
        -- Must be for a center the supervisor belongs to
        AND center_id IN (
            SELECT center_id FROM supervisors WHERE user_id = auth.uid()
        )
    );

-- ================================
-- ATTENDANCE RECORDS — Read only for own center
-- ================================
CREATE POLICY "supervisors_read_attendance_own_center"
    ON attendance_records FOR SELECT
    USING (
        center_id IN (
            SELECT center_id FROM supervisors WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- NOTES
-- ============================================================
-- * No supervisor can see another center's examinees or attendance.
-- * The anon key is safe to use in the frontend because RLS
--   restricts every query to the authenticated user's center.
-- * The service_role key must NEVER be in the frontend.
-- * To allow admin operations (insert centers, examinees, etc.),
--   use the Supabase Dashboard or a service_role-backed script.
-- ============================================================
