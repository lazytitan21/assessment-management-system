// ============================================================
// app.js — Main Application Orchestration
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    // --------------- State ---------------
    App.currentUser = null;
    App.supervisor = null;
    App.center = null;
    App.examinees = [];
    App.attendanceRecords = [];
    App.assessments = [];
    App.currentAssessment = null;  // null = all exams

    // --------------- Initialize Supabase ---------------
    // Anon client — used for auth and attendance inserts (needs user identity)
    App.supabase = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );

    // Service-role client — used for data reads, bypasses RLS
    // Data isolation is enforced in code by filtering on App.center.id
    App.db = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_SERVICE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // --------------- Utility: HTML-escape ---------------
    App.esc = function (text) {
        var d = document.createElement('div');
        d.textContent = text || '';
        return d.innerHTML;
    };

    // --------------- Toast notifications ---------------
    App.showToast = function (msg, type) {
        type = type || 'info';
        var icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
        var container = document.getElementById('toast-container');
        var t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.innerHTML = '<i class="fas fa-' + (icons[type] || 'info-circle') + '"></i> ' + msg;
        container.appendChild(t);
        setTimeout(function () {
            t.style.opacity = '0';
            t.style.transform = 'translateX(50px)';
            setTimeout(function () { t.remove(); }, 300);
        }, 3500);
    };

    // --------------- Tab switching ---------------
    App.switchTab = function (tabName) {
        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.tab-panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'panel-' + tabName);
        });

        // Stop scanner when leaving attendance tab
        if (tabName !== 'attendance' && typeof App.stopScanner === 'function') {
            App.stopScanner();
        }

        // Refresh data when switching tabs
        if (tabName === 'examinees') App.renderExaminees(App.getFilteredExaminees());
        if (tabName === 'reports') App.renderReports();
        if (tabName === 'cards') App.renderCardsList();
    };

    // --------------- Get filtered examinees based on current assessment ---------------
    App.getFilteredExaminees = function () {
        if (!App.currentAssessment) return App.examinees;
        return App.examinees.filter(function (ex) {
            return ex.assessment_id === App.currentAssessment.id;
        });
    };

    // --------------- Handle assessment selection ---------------
    App.onAssessmentChange = function () {
        var select = document.getElementById('assessment-select');
        var selectedId = select.value;
        var infoEl = document.getElementById('selector-info');
        var prompt = document.getElementById('select-exam-prompt');
        var tabNav = document.getElementById('tab-nav');
        var mainContent = document.getElementById('main-content');

        if (!selectedId) {
            App.currentAssessment = null;
            infoEl.innerHTML = '';
            // Hide tabs/content, show prompt
            if (prompt) prompt.style.display = '';
            if (tabNav) tabNav.style.display = 'none';
            if (mainContent) mainContent.style.display = 'none';
            return;
        }

        App.currentAssessment = App.assessments.find(function (a) { return a.id === selectedId; }) || null;
        var filtered = App.getFilteredExaminees();
        infoEl.innerHTML = '<span class="badge badge-primary">' + filtered.length + ' examinee(s)</span>' +
            (App.currentAssessment && App.currentAssessment.exam_date
                ? ' <span class="badge badge-info">' + App.esc(App.currentAssessment.exam_date) + '</span>'
                : '');

        // Show tabs/content, hide prompt
        if (prompt) prompt.style.display = 'none';
        if (tabNav) tabNav.style.display = '';
        if (mainContent) mainContent.style.display = '';

        // Re-render all views for the selected assessment
        App.renderExaminees(App.getFilteredExaminees());
        App.renderReports();
        App.renderCardsList();
    };

    // --------------- Populate assessment dropdown ---------------
    App.populateAssessmentSelector = function () {
        var select = document.getElementById('assessment-select');
        var selectorDiv = document.getElementById('assessment-selector');
        var infoEl = document.getElementById('selector-info');
        select.innerHTML = '<option value="" disabled selected>— Select Exam —</option>';

        if (!App.assessments.length) {
            selectorDiv.style.display = 'none';
            // Show a "no exams" message in the prompt
            var prompt = document.getElementById('select-exam-prompt');
            if (prompt) {
                prompt.innerHTML =
                    '<div class="prompt-card">' +
                    '<div class="prompt-icon" style="background:var(--warning-bg);color:var(--warning);">' +
                    '<i class="fas fa-exclamation-triangle"></i></div>' +
                    '<h2>No Exams Available</h2>' +
                    '<p>No assessments have been synced to your center yet.<br>' +
                    'Please ask the administrator to run the <strong>Sync to Database</strong> from the Distribution Tool.</p>' +
                    '</div>';
                prompt.style.display = '';
            }
            return;
        }

        App.assessments.forEach(function (a) {
            var opt = document.createElement('option');
            opt.value = a.id;
            var label = a.name;
            if (a.exam_date) label += ' (' + a.exam_date + ')';
            opt.textContent = label;
            select.appendChild(opt);
        });

        selectorDiv.style.display = '';

        // Auto-select if there's only one assessment
        if (App.assessments.length === 1) {
            select.value = App.assessments[0].id;
            App.onAssessmentChange();
        } else {
            // Show prompt — supervisor must pick an exam
            infoEl.innerHTML = '<span class="badge badge-secondary">Choose an exam to begin</span>';
        }
    };

    // --------------- Show login, hide app ---------------
    function showLogin() {
        document.getElementById('login-screen').style.display = '';
        document.getElementById('app-screen').style.display = 'none';
    }

    // --------------- Show app, hide login ---------------
    function showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = '';
    }

    // --------------- Handle login form ---------------
    App.handleLogin = async function (e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;
        var errorEl = document.getElementById('login-error');
        var btn = document.getElementById('login-btn');

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

        try {
            var authData = await App.signIn(email, password);
            App.currentUser = authData.user;
            await App.loadSupervisorProfile(App.currentUser.id);
            await initDashboard();
            showApp();
            App.showToast('Welcome, ' + App.supervisor.full_name + '!', 'success');
        } catch (err) {
            errorEl.textContent = err.message || 'Sign-in failed.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    };

    // --------------- Handle sign out ---------------
    App.handleSignOut = async function () {
        if (typeof App.stopScanner === 'function') App.stopScanner();
        await App.signOut();
        showLogin();
    };

    // --------------- Initialize dashboard data ---------------
    async function initDashboard() {
        // Update header
        document.getElementById('header-user-name').textContent = App.supervisor.full_name;
        document.getElementById('header-center-name').textContent = App.center.name + (App.center.location ? ' — ' + App.center.location : '');

        // Set default exam session to today
        var today = new Date().toISOString().slice(0, 10);
        var sessionInput = document.getElementById('exam-session-input');
        if (sessionInput && !sessionInput.value) sessionInput.value = today;

        // Load data (examinees, attendance, assessments in parallel)
        await Promise.all([App.loadExaminees(), App.loadAttendanceRecords(), App.loadAssessments()]);

        // Populate assessment selector (auto-selects if only 1 exam)
        App.populateAssessmentSelector();

        // Only render views if an assessment was auto-selected
        // Otherwise the prompt screen is shown, waiting for user to pick an exam
        if (App.currentAssessment) {
            App.renderExaminees(App.getFilteredExaminees());
            App.renderReports();
            App.renderCardsList();
        }
    }

    // --------------- Boot ---------------
    async function boot() {
        // Bind events
        document.getElementById('login-form').addEventListener('submit', App.handleLogin);

        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                App.switchTab(btn.getAttribute('data-tab'));
            });
        });

        var searchInput = document.getElementById('examinees-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                App.filterExaminees(this.value);
            });
        }

        // Bind assessment selector
        var assessmentSelect = document.getElementById('assessment-select');
        if (assessmentSelect) {
            assessmentSelect.addEventListener('change', App.onAssessmentChange);
        }

        // Check existing session
        try {
            var session = await App.getSession();
            if (session && session.user) {
                App.currentUser = session.user;
                await App.loadSupervisorProfile(session.user.id);
                await initDashboard();
                showApp();
            } else {
                showLogin();
                return;
            }
        } catch (err) {
            console.warn('Session restore failed:', err);
            await App.supabase.auth.signOut();
            showLogin();
            return;
        }

        // Listen for auth state changes
        App.supabase.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_OUT') {
                showLogin();
            }
        });
    }

    // --------------- DOM ready ---------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
