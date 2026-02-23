// ============================================================
// auth.js — Supabase Authentication
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    // --------------- Sign In ---------------
    App.signIn = async function (email, password) {
        const { data, error } = await App.supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        if (error) throw error;
        return data;
    };

    // --------------- Sign Out ---------------
    App.signOut = async function () {
        await App.supabase.auth.signOut();
        App.currentUser = null;
        App.supervisor = null;
        App.center = null;
        App.examinees = [];
        App.attendanceRecords = [];
        App.assessments = [];
        App.currentAssessment = null;
    };

    // --------------- Load supervisor profile + center ---------------
    App.loadSupervisorProfile = async function (userId) {
        // Fetch supervisor row using service client (bypasses RLS issues)
        const { data: sup, error: supErr } = await App.db
            .from('supervisors')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (supErr || !sup) {
            throw new Error('Supervisor profile not found. Please contact the administrator.');
        }
        App.supervisor = sup;

        // Fetch center row
        const { data: center, error: centerErr } = await App.db
            .from('centers')
            .select('*')
            .eq('id', sup.center_id)
            .single();

        if (centerErr || !center) {
            throw new Error('Assessment center not found.');
        }
        App.center = center;

        return { supervisor: sup, center: center };
    };

    // --------------- Load assessments for this supervisor's center ---------------
    App.loadAssessments = async function () {
        try {
            if (!App.center) {
                console.warn('loadAssessments: No center loaded yet');
                App.assessments = [];
                return;
            }

            console.log('loadAssessments: center_id =', App.center.id, 'center =', App.center.name);

            // First get the assessment IDs linked to this center's examinees
            const { data: examRows, error: exErr } = await App.db
                .from('examinees')
                .select('assessment_id')
                .eq('center_id', App.center.id)
                .not('assessment_id', 'is', null);

            console.log('loadAssessments: examinees with assessment_id:', examRows ? examRows.length : 0, exErr ? 'ERROR: ' + exErr.message : '');

            if (exErr) {
                console.warn('Error fetching examinee assessment links:', exErr.message);
                App.assessments = [];
                return;
            }

            // Get unique assessment IDs
            const assessmentIds = [...new Set((examRows || []).map(function (r) { return r.assessment_id; }))];
            console.log('loadAssessments: unique assessment IDs:', assessmentIds);
            if (!assessmentIds.length) {
                console.warn('loadAssessments: No assessments linked to examinees in this center');
                App.assessments = [];
                return;
            }

            // Fetch the actual assessment records
            const { data, error } = await App.db
                .from('assessments')
                .select('*')
                .in('id', assessmentIds)
                .order('exam_date', { ascending: false });

            console.log('loadAssessments: fetched', data ? data.length : 0, 'assessment(s)', error ? 'ERROR: ' + error.message : '');

            if (error) {
                console.warn('Error loading assessments:', error.message);
                App.assessments = [];
                return;
            }
            App.assessments = data || [];
        } catch (e) {
            console.warn('loadAssessments failed:', e);
            App.assessments = [];
        }
    };

    // --------------- Get current session ---------------
    App.getSession = async function () {
        const { data: { session } } = await App.supabase.auth.getSession();
        return session;
    };
})();
