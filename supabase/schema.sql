-- ============================================================
-- Assessment Management System — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================
-- 1. CENTERS
-- ================================
CREATE TABLE IF NOT EXISTS centers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    location    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE centers IS 'Assessment / exam centers';

-- ================================
-- 2. SUPERVISORS
-- ================================
CREATE TABLE IF NOT EXISTS supervisors (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    center_id   UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE supervisors IS 'Maps each Supabase Auth user to an assessment center';

-- ================================
-- 3. EXAMINEES
-- ================================
CREATE TABLE IF NOT EXISTS examinees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id       UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    national_id     TEXT,
    exam_session    TEXT,                                          -- e.g. "2026-02-19", "Round 1", etc.
    attendance_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE examinees IS 'Examinees assigned to a center';
COMMENT ON COLUMN examinees.attendance_code IS 'Unique code encoded in the QR on admission cards';

-- Index for fast QR lookups
CREATE INDEX IF NOT EXISTS idx_examinees_attendance_code ON examinees (attendance_code);

-- ================================
-- 4. ATTENDANCE RECORDS
-- ================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examinee_id UUID NOT NULL REFERENCES examinees(id) ON DELETE CASCADE,
    center_id   UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    scanned_by  UUID NOT NULL REFERENCES auth.users(id),
    scanned_at  TIMESTAMPTZ DEFAULT now(),
    exam_session TEXT
);

COMMENT ON TABLE attendance_records IS 'Attendance scanned via QR code by supervisors';

-- Duplicate prevention: one attendance per examinee per session.
-- COALESCE handles NULL exam_session by treating it as empty string,
-- so even NULLs are treated as duplicates of each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_attendance_per_session
    ON attendance_records (examinee_id, COALESCE(exam_session, ''));

COMMENT ON INDEX idx_unique_attendance_per_session IS
    'Prevents duplicate attendance for the same examinee + session';
