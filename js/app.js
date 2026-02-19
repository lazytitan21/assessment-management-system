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

    // --------------- Initialize Supabase ---------------
    App.supabase = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
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
        if (tabName === 'reports') App.renderReports();
        if (tabName === 'cards') App.renderCardsList();
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
        App.showToast('Signed out.', 'info');
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

        // Load data
        await Promise.all([App.loadExaminees(), App.loadAttendanceRecords()]);

        // Render
        App.renderExaminees(App.examinees);
        App.renderReports();
        App.renderCardsList();
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
            }
        } catch (err) {
            console.warn('Session restore failed:', err);
            showLogin();
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
