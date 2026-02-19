-- ============================================================
-- Assessment Management System — Sample Seed Data
-- Run this AFTER schema.sql and rls.sql
-- ============================================================
-- This file contains EXAMPLE data. Replace with your real data.
-- ============================================================

-- ================================
-- 1. Create sample centers
-- ================================
INSERT INTO centers (id, name, location) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Engineering Building - Abu Dhabi', 'Abu Dhabi, UAE'),
    ('b2222222-2222-2222-2222-222222222222', 'Science Campus - Dubai',          'Dubai, UAE')
ON CONFLICT (id) DO NOTHING;

-- ================================
-- 2. Create supervisor Auth users
-- ================================
-- You MUST create supervisor users via the Supabase Auth dashboard:
--   Dashboard > Authentication > Users > Add User
--   e.g. supervisor1@example.com / StrongPassword123
--
-- After creating the user, note the user's UUID from the dashboard,
-- then insert the mapping row below.

-- EXAMPLE (replace UUIDs with actual auth.users IDs):
-- INSERT INTO supervisors (user_id, center_id, full_name, email) VALUES
--     ('REPLACE-WITH-AUTH-USER-UUID-1', 'a1111111-1111-1111-1111-111111111111', 'Ahmed Al Supervisor', 'supervisor1@example.com'),
--     ('REPLACE-WITH-AUTH-USER-UUID-2', 'b2222222-2222-2222-2222-222222222222', 'Sara Al Manager',     'supervisor2@example.com');

-- ================================
-- 3. Insert sample examinees
-- ================================
-- attendance_code is auto-generated (gen_random_uuid()::text)
-- You can also import via CSV (see README for template)

INSERT INTO examinees (center_id, full_name, national_id, exam_session) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Ali Mohammed',     '784-1990-1234567-1', '2026-02-19'),
    ('a1111111-1111-1111-1111-111111111111', 'Fatima Hassan',    '784-1992-7654321-2', '2026-02-19'),
    ('a1111111-1111-1111-1111-111111111111', 'Omar Abdullah',    '784-1988-1112233-3', '2026-02-19'),
    ('a1111111-1111-1111-1111-111111111111', 'Mariam Khalid',    '784-1995-4455667-4', '2026-02-19'),
    ('a1111111-1111-1111-1111-111111111111', 'Khalid Nasser',    '784-1991-9988776-5', '2026-02-20'),
    ('b2222222-2222-2222-2222-222222222222', 'Sara Ibrahim',     '784-1993-1122334-6', '2026-02-19'),
    ('b2222222-2222-2222-2222-222222222222', 'Mohammed Ahmed',   '784-1989-5566778-7', '2026-02-19'),
    ('b2222222-2222-2222-2222-222222222222', 'Noura Saeed',      '784-1994-8899001-8', '2026-02-20')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CSV TEMPLATE FOR BULK IMPORT
-- ============================================================
-- You can import examinees via Supabase Dashboard > Table Editor > Import CSV
-- CSV columns (header row):
--
--   center_id,full_name,national_id,exam_session
--   a1111111-1111-1111-1111-111111111111,Ali Mohammed,784-1990-1234567-1,2026-02-19
--   a1111111-1111-1111-1111-111111111111,Fatima Hassan,784-1992-7654321-2,2026-02-19
--
-- The 'id' and 'attendance_code' columns will be auto-generated.
-- ============================================================
