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
        // Fetch supervisor row (RLS restricts to own row)
        const { data: sup, error: supErr } = await App.supabase
            .from('supervisors')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (supErr || !sup) {
            throw new Error('Supervisor profile not found. Please contact the administrator.');
        }
        App.supervisor = sup;

        // Fetch center row (RLS restricts to own center)
        const { data: center, error: centerErr } = await App.supabase
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
        // RLS policy "supervisors_read_assessments" restricts this to assessments
        // linked to the supervisor's center via examinees
        const { data, error } = await App.supabase
            .from('assessments')
            .select('*')
            .order('exam_date', { ascending: false });

        if (error) {
            App.showToast('Error loading assessments: ' + error.message, 'error');
            App.assessments = [];
            return;
        }
        App.assessments = data || [];
    };

    // --------------- Get current session ---------------
    App.getSession = async function () {
        const { data: { session } } = await App.supabase.auth.getSession();
        return session;
    };
})();
