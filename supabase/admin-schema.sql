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

-- ================================
-- RPC FUNCTION: admin_sync_examinees
-- Called from the frontend via supabase.rpc()
-- SECURITY DEFINER = runs as db owner, bypasses ALL RLS
-- Validates admin status internally before doing anything
-- ================================
CREATE OR REPLACE FUNCTION public.admin_sync_examinees(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id        uuid;
    v_center_name    text;
    v_center_loc     text;
    v_center_id      uuid;
    v_assessment_id  uuid;
    v_inserted       int := 0;
    v_center_count   int := 0;
    v_center_ids     uuid[] := '{}';
    v_center_map     jsonb := '{}'::jsonb;
BEGIN
    -- 1. Verify the caller is an admin
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'Access denied: you are not registered as an admin.';
    END IF;

    -- 2. Find or create centers
    FOR v_center_name, v_center_loc IN
        SELECT c->>'name', c->>'location'
        FROM jsonb_array_elements(p_data->'centers') AS c
    LOOP
        SELECT id INTO v_center_id FROM centers WHERE name = v_center_name LIMIT 1;
        IF v_center_id IS NULL THEN
            INSERT INTO centers (name, location)
            VALUES (v_center_name, v_center_loc)
            RETURNING id INTO v_center_id;
        END IF;
        v_center_map := v_center_map || jsonb_build_object(v_center_name, v_center_id::text);
        v_center_ids := array_append(v_center_ids, v_center_id);
        v_center_count := v_center_count + 1;
    END LOOP;

    -- 3. Delete existing examinees for these centers (clean re-sync)
    DELETE FROM examinees WHERE center_id = ANY(v_center_ids);

    -- 4. Create or find assessment
    IF (p_data->>'assessment_name') IS NOT NULL AND (p_data->>'assessment_name') != '' THEN
        SELECT id INTO v_assessment_id
        FROM assessments WHERE name = (p_data->>'assessment_name') LIMIT 1;

        IF v_assessment_id IS NULL THEN
            INSERT INTO assessments (name, description, exam_date, created_by)
            VALUES (
                p_data->>'assessment_name',
                p_data->>'assessment_desc',
                CASE
                    WHEN (p_data->>'exam_date') IS NOT NULL AND (p_data->>'exam_date') != ''
                    THEN (p_data->>'exam_date')::date
                    ELSE NULL
                END,
                v_user_id
            )
            RETURNING id INTO v_assessment_id;
        END IF;
    END IF;

    -- 5. Bulk-insert all examinees
    INSERT INTO examinees (center_id, assessment_id, full_name, national_id, exam_session, attendance_code)
    SELECT
        (v_center_map->>(e->>'center_name'))::uuid,
        v_assessment_id,
        e->>'full_name',
        NULLIF(e->>'national_id', ''),
        NULLIF(e->>'exam_session', ''),
        e->>'attendance_code'
    FROM jsonb_array_elements(p_data->'examinees') AS e;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'inserted', v_inserted,
        'centers', v_center_count,
        'assessment_id', v_assessment_id::text
    );
END;
$$;

COMMENT ON FUNCTION public.admin_sync_examinees(jsonb) IS
    'Bulk-sync examinees from the distribution tool. SECURITY DEFINER bypasses RLS. Validates admin status internally.';

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
