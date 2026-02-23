// ============================================================
// admin.js — Admin Portal Logic
// ============================================================
(function () {
    'use strict';
    var Admin = window.Admin = {};

    // --------------- State ---------------
    Admin.currentUser = null;
    Admin.adminProfile = null;
    Admin.centers = [];
    Admin.supervisors = [];
    Admin.examinees = [];
    Admin.assessments = [];
    Admin.attendanceRecords = [];

    // --------------- Supabase Clients ---------------
    // Main client — admin session
    Admin.supabase = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );

    // Service-role client — bypasses RLS for data operations
    Admin.serviceClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_SERVICE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Throwaway client for creating new auth users (does NOT persist session)
    Admin.signupClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // --------------- Utility: HTML-escape ---------------
    function esc(text) {
        var d = document.createElement('div');
        d.textContent = text || '';
        return d.innerHTML;
    }

    // --------------- Toast notifications ---------------
    Admin.showToast = function (msg, type) {
        type = type || 'info';
        var icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
        var container = document.getElementById('toast-container');
        var t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.innerHTML = '<i class="fas fa-' + (icons[type] || 'info-circle') + '"></i> ' + esc(msg);
        container.appendChild(t);
        setTimeout(function () {
            t.style.opacity = '0';
            t.style.transform = 'translateX(50px)';
            setTimeout(function () { t.remove(); }, 300);
        }, 3500);
    };

    // --------------- Tab switching ---------------
    Admin.switchTab = function (tabName) {
        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.tab-panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'panel-' + tabName);
        });
        if (tabName === 'overview') Admin.renderOverview();
        if (tabName === 'assessments') renderAssessments();
        if (tabName === 'examinees') renderExaminees();
        if (tabName === 'cards') renderCardsFilters();
    };

    // --------------- Show/Hide screens ---------------
    function showLogin() {
        document.getElementById('login-screen').style.display = '';
        document.getElementById('app-screen').style.display = 'none';
    }

    function showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = '';
    }

    // --------------- Modal helpers ---------------
    Admin.openModal = function (id) {
        document.getElementById(id).classList.remove('hidden');
    };

    Admin.closeModal = function (id) {
        document.getElementById(id).classList.add('hidden');
    };

    Admin.togglePassword = function (inputId, btn) {
        var input = document.getElementById(inputId);
        var icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    };

    // ===================== AUTHENTICATION =====================

    Admin.handleLogin = async function (e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;
        var errorEl = document.getElementById('login-error');
        var btn = document.getElementById('login-btn');

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

        try {
            var result = await Admin.supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });
            if (result.error) throw result.error;

            Admin.currentUser = result.data.user;

            // Verify this user is an admin
            var adminCheck = await Admin.serviceClient
                .from('admins')
                .select('*')
                .eq('user_id', Admin.currentUser.id)
                .single();

            if (adminCheck.error || !adminCheck.data) {
                await Admin.supabase.auth.signOut();
                throw new Error('Access denied. This account is not an admin.');
            }

            Admin.adminProfile = adminCheck.data;
            await initDashboard();
            showApp();
            Admin.showToast('Welcome, ' + Admin.adminProfile.full_name + '!', 'success');
        } catch (err) {
            errorEl.textContent = err.message || 'Sign-in failed.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    };

    Admin.handleSignOut = async function () {
        await Admin.supabase.auth.signOut();
        Admin.currentUser = null;
        Admin.adminProfile = null;
        Admin.centers = [];
        Admin.supervisors = [];
        Admin.assessments = [];
        Admin.examinees = [];
        Admin.attendanceRecords = [];
        showLogin();
        Admin.showToast('Signed out.', 'info');
    };

    // ===================== DASHBOARD INIT =====================

    async function initDashboard() {
        document.getElementById('header-user-name').textContent = Admin.adminProfile.full_name;

        // Load all data in parallel
        await Promise.all([
            loadCenters(),
            loadSupervisors(),
            loadExaminees(),
            loadAttendance(),
            loadAssessments()
        ]);

        populateFilterDropdowns();
        renderSupervisors();
        renderCenters();
        Admin.renderOverview();
    }

    // Populate filter dropdowns for examinees & cards tabs
    function populateFilterDropdowns() {
        var centerFilters = ['examinees-center-filter', 'cards-center-filter'];
        centerFilters.forEach(function (filterId) {
            var sel = document.getElementById(filterId);
            if (!sel) return;
            var val = sel.value;
            sel.innerHTML = '<option value="">All Centers</option>';
            Admin.centers.forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
            if (val) sel.value = val;
        });

        var assessmentFilters = ['examinees-assessment-filter', 'cards-assessment-filter'];
        assessmentFilters.forEach(function (filterId) {
            var sel = document.getElementById(filterId);
            if (!sel) return;
            var val = sel.value;
            sel.innerHTML = '<option value="">All Assessments</option>';
            Admin.assessments.forEach(function (a) {
                var opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.name;
                sel.appendChild(opt);
            });
            if (val) sel.value = val;
        });
    }

    // ===================== DATA LOADING =====================

    async function loadCenters() {
        var result = await Admin.serviceClient
            .from('centers')
            .select('*')
            .order('name', { ascending: true });

        if (result.error) {
            Admin.showToast('Error loading centers: ' + result.error.message, 'error');
            return;
        }
        Admin.centers = result.data || [];
    }

    async function loadSupervisors() {
        var result = await Admin.serviceClient
            .from('supervisors')
            .select('*, centers(name, location)')
            .order('full_name', { ascending: true });

        if (result.error) {
            Admin.showToast('Error loading supervisors: ' + result.error.message, 'error');
            return;
        }
        Admin.supervisors = result.data || [];
    }

    async function loadExaminees() {
        var result = await Admin.serviceClient
            .from('examinees')
            .select('*, centers(name), assessments(name)')
            .order('full_name', { ascending: true });

        if (result.error) {
            Admin.showToast('Error loading examinees: ' + result.error.message, 'error');
            return;
        }
        Admin.examinees = result.data || [];
    }

    async function loadAttendance() {
        var result = await Admin.serviceClient
            .from('attendance_records')
            .select('id, center_id')
            .order('scanned_at', { ascending: false });

        if (result.error) return;
        Admin.attendanceRecords = result.data || [];
    }

    async function loadAssessments() {
        var result = await Admin.serviceClient
            .from('assessments')
            .select('*')
            .order('exam_date', { ascending: false });

        if (result.error) {
            Admin.showToast('Error loading assessments: ' + result.error.message, 'error');
            return;
        }
        Admin.assessments = result.data || [];
    }

    // ===================== RENDER SUPERVISORS =====================

    function renderSupervisors(filterQuery) {
        var list = Admin.supervisors;
        if (filterQuery && filterQuery.length > 0) {
            var q = filterQuery.toLowerCase();
            list = list.filter(function (s) {
                return (s.full_name || '').toLowerCase().indexOf(q) !== -1 ||
                       (s.email || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        var countEl = document.getElementById('supervisors-count');
        countEl.textContent = list.length + ' supervisor(s)';

        var container = document.getElementById('supervisors-list');
        if (!list.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-user-shield"></i><p>No supervisors found.</p></div>';
            return;
        }

        var html = '';
        list.forEach(function (sup) {
            var initials = (sup.full_name || '?').split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
            var centerName = sup.centers ? sup.centers.name : 'Unknown Center';
            var centerLocation = sup.centers && sup.centers.location ? ' — ' + sup.centers.location : '';

            html += '<div class="supervisor-item">' +
                '<div class="supervisor-avatar">' + esc(initials) + '</div>' +
                '<div class="supervisor-info">' +
                '<div class="supervisor-name">' + esc(sup.full_name) + '</div>' +
                '<div class="supervisor-email">' + esc(sup.email) + '</div>' +
                '<div class="supervisor-center"><i class="fas fa-building"></i> ' + esc(centerName + centerLocation) + '</div>' +
                '</div>' +
                '<div class="supervisor-actions">' +
                '<button class="btn btn-sm btn-danger" onclick="Admin.confirmDeleteSupervisor(\'' + sup.user_id + '\', \'' + esc(sup.full_name) + '\')" title="Remove supervisor">' +
                '<i class="fas fa-trash"></i></button>' +
                '</div>' +
                '</div>';
        });

        container.innerHTML = html;
    }

    // ===================== RENDER CENTERS =====================

    function renderCenters() {
        var list = Admin.centers;
        var countEl = document.getElementById('centers-count');
        countEl.textContent = list.length + ' center(s)';

        var container = document.getElementById('centers-list');
        if (!list.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><p>No centers found. Add your first center.</p></div>';
            return;
        }

        var html = '';
        list.forEach(function (c) {
            // Count supervisors & examinees for this center
            var supCount = Admin.supervisors.filter(function (s) { return s.center_id === c.id; }).length;
            var exCount = Admin.examinees.filter(function (e) { return e.center_id === c.id; }).length;

            html += '<div class="center-item">' +
                '<div class="center-icon"><i class="fas fa-building"></i></div>' +
                '<div class="center-info">' +
                '<div class="center-name">' + esc(c.name) + '</div>' +
                '<div class="center-location">' + esc(c.location || 'No location') + '</div>' +
                '<div style="margin-top:4px;font-size:12px;color:var(--text-muted);">' +
                '<span><i class="fas fa-user-shield"></i> ' + supCount + ' supervisor(s)</span> &nbsp;|&nbsp; ' +
                '<span><i class="fas fa-users"></i> ' + exCount + ' examinee(s)</span>' +
                '</div>' +
                '</div>' +
                '<div class="center-actions">' +
                '<button class="btn btn-sm btn-danger" onclick="Admin.confirmDeleteCenter(\'' + c.id + '\', \'' + esc(c.name) + '\')" title="Delete center">' +
                '<i class="fas fa-trash"></i></button>' +
                '</div>' +
                '</div>';
        });

        container.innerHTML = html;
    }

    // ===================== RENDER OVERVIEW =====================

    Admin.renderOverview = function () {
        var totalCenters = Admin.centers.length;
        var totalSupervisors = Admin.supervisors.length;
        var totalExaminees = Admin.examinees.length;
        var totalAttendance = Admin.attendanceRecords.length;
        var totalAssessments = Admin.assessments.length;

        var statsHtml =
            '<div class="stat-card"><div class="stat-icon" style="background:var(--info-bg);color:var(--info)"><i class="fas fa-building"></i></div>' +
            '<div class="stat-value">' + totalCenters + '</div><div class="stat-label">Centers</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:#e8f5e9;color:#388e3c"><i class="fas fa-file-alt"></i></div>' +
            '<div class="stat-value">' + totalAssessments + '</div><div class="stat-label">Assessments</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--primary-bg);color:var(--primary)"><i class="fas fa-user-shield"></i></div>' +
            '<div class="stat-value">' + totalSupervisors + '</div><div class="stat-label">Supervisors</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--warning-bg);color:var(--warning)"><i class="fas fa-users"></i></div>' +
            '<div class="stat-value">' + totalExaminees + '</div><div class="stat-label">Total Examinees</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--success-bg);color:var(--success)"><i class="fas fa-check-circle"></i></div>' +
            '<div class="stat-value">' + totalAttendance + '</div><div class="stat-label">Attendance Records</div></div>';

        document.getElementById('overview-stats').innerHTML = statsHtml;

        // Per-center breakdown
        var contentHtml = '<table class="data-table"><thead><tr>' +
            '<th>Center</th><th>Location</th><th>Supervisors</th><th>Examinees</th><th>Attendance</th>' +
            '</tr></thead><tbody>';

        Admin.centers.forEach(function (c) {
            var sups = Admin.supervisors.filter(function (s) { return s.center_id === c.id; }).length;
            var exams = Admin.examinees.filter(function (e) { return e.center_id === c.id; }).length;
            var att = Admin.attendanceRecords.filter(function (a) { return a.center_id === c.id; }).length;

            contentHtml += '<tr>' +
                '<td><strong>' + esc(c.name) + '</strong></td>' +
                '<td>' + esc(c.location || '—') + '</td>' +
                '<td>' + sups + '</td>' +
                '<td>' + exams + '</td>' +
                '<td>' + att + '</td>' +
                '</tr>';
        });

        if (!Admin.centers.length) {
            contentHtml += '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No centers yet.</td></tr>';
        }

        contentHtml += '</tbody></table>';
        document.getElementById('overview-content').innerHTML = contentHtml;
    };

    // ===================== RENDER ASSESSMENTS =====================

    function renderAssessments() {
        var list = Admin.assessments;
        var countEl = document.getElementById('assessments-count');
        if (countEl) countEl.textContent = list.length + ' assessment(s)';

        var container = document.getElementById('assessments-list');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>No assessments found. Create your first assessment.</p></div>';
            return;
        }

        var html = '';
        list.forEach(function (a) {
            var exCount = Admin.examinees.filter(function (e) { return e.assessment_id === a.id; }).length;
            var dateStr = a.exam_date ? new Date(a.exam_date).toLocaleDateString('en-GB') : 'No date set';

            html += '<div class="assessment-item">' +
                '<div class="assessment-info">' +
                '<div class="assessment-name">' + esc(a.name) + '</div>' +
                '<div class="assessment-desc">' + esc(a.description || 'No description') + '</div>' +
                '<div style="margin-top:6px;font-size:12px;color:var(--text-muted);">' +
                '<span><i class="fas fa-calendar"></i> ' + esc(dateStr) + '</span> &nbsp;|&nbsp; ' +
                '<span><i class="fas fa-users"></i> ' + exCount + ' examinee(s)</span>' +
                '</div>' +
                '</div>' +
                '<div class="assessment-actions">' +
                '<button class="btn btn-sm btn-danger" onclick="Admin.confirmDeleteAssessment(\'' + a.id + '\', \'' + esc(a.name) + '\')" title="Delete assessment">' +
                '<i class="fas fa-trash"></i></button>' +
                '</div>' +
                '</div>';
        });

        container.innerHTML = html;
    }

    // ===================== RENDER EXAMINEES =====================

    function getFilteredExaminees() {
        var list = Admin.examinees;

        var centerFilter = document.getElementById('examinees-center-filter');
        var assessmentFilter = document.getElementById('examinees-assessment-filter');
        var searchInput = document.getElementById('examinees-search');

        if (centerFilter && centerFilter.value) {
            var cid = centerFilter.value;
            list = list.filter(function (e) { return e.center_id === cid; });
        }
        if (assessmentFilter && assessmentFilter.value) {
            var aid = assessmentFilter.value;
            list = list.filter(function (e) { return e.assessment_id === aid; });
        }
        if (searchInput && searchInput.value.trim()) {
            var q = searchInput.value.trim().toLowerCase();
            list = list.filter(function (e) {
                return (e.full_name || '').toLowerCase().indexOf(q) !== -1 ||
                       (e.national_id || '').toLowerCase().indexOf(q) !== -1 ||
                       (e.attendance_code || '').toLowerCase().indexOf(q) !== -1;
            });
        }
        return list;
    }

    function renderExaminees() {
        var list = getFilteredExaminees();

        var countEl = document.getElementById('examinees-count');
        if (countEl) countEl.textContent = list.length + ' examinee(s)';

        var container = document.getElementById('examinees-table-body');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No examinees found.</td></tr>';
            return;
        }

        var html = '';
        list.forEach(function (e) {
            var centerName = e.centers ? e.centers.name : '—';
            var assessmentName = e.assessments ? e.assessments.name : '—';
            var sessionBadge = e.session_number ? '<span class="badge badge-info">Session ' + e.session_number + '</span>' : '—';

            html += '<tr>' +
                '<td><strong>' + esc(e.full_name || '—') + '</strong></td>' +
                '<td>' + esc(e.national_id || '—') + '</td>' +
                '<td>' + esc(centerName) + '</td>' +
                '<td>' + esc(assessmentName) + '</td>' +
                '<td>' + sessionBadge + '</td>' +
                '<td><code>' + esc(e.attendance_code || '—') + '</code></td>' +
                '<td>' +
                '<button class="btn btn-sm btn-danger" onclick="Admin.confirmDeleteExaminee(\'' + e.id + '\', \'' + esc(e.full_name || '') + '\')" title="Delete">' +
                '<i class="fas fa-trash"></i></button>' +
                '</td>' +
                '</tr>';
        });

        container.innerHTML = html;
    }

    // ===================== RENDER CARDS FILTERS =====================

    function renderCardsFilters() {
        // Just ensure the dropdowns are populated — cards are generated on demand
        populateFilterDropdowns();
    }

    // ===================== GENERATE ADMISSION CARDS =====================

    function getCardsFilteredExaminees() {
        var list = Admin.examinees;

        var centerFilter = document.getElementById('cards-center-filter');
        var assessmentFilter = document.getElementById('cards-assessment-filter');

        if (centerFilter && centerFilter.value) {
            var cid = centerFilter.value;
            list = list.filter(function (e) { return e.center_id === cid; });
        }
        if (assessmentFilter && assessmentFilter.value) {
            var aid = assessmentFilter.value;
            list = list.filter(function (e) { return e.assessment_id === aid; });
        }
        return list;
    }

    Admin.generateCards = function () {
        var list = getCardsFilteredExaminees();
        var container = document.getElementById('cards-grid');
        var countEl = document.getElementById('cards-count');

        if (!container) return;

        if (!list.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-id-card"></i><p>No examinees match the current filters.</p></div>';
            if (countEl) countEl.textContent = '0 card(s)';
            return;
        }

        if (countEl) countEl.textContent = list.length + ' card(s)';

        var html = '';
        list.forEach(function (e) {
            var centerName = e.centers ? e.centers.name : 'Unknown Center';
            var assessmentName = e.assessments ? e.assessments.name : '—';
            var sessionLabel = e.session_number ? 'Session ' + e.session_number : '—';
            var seatLabel = e.seat_number ? 'Seat ' + e.seat_number : '—';
            var roomLabel = e.room || '—';

            // Generate QR code
            var qrHtml = '';
            if (typeof qrcode !== 'undefined' && e.attendance_code) {
                try {
                    var qr = qrcode(0, 'M');
                    qr.addData(e.attendance_code);
                    qr.make();
                    qrHtml = qr.createSvgTag({ cellSize: 3, margin: 2 });
                } catch (err) {
                    qrHtml = '<div style="width:80px;height:80px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">QR Error</div>';
                }
            } else {
                qrHtml = '<div style="width:80px;height:80px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">No Code</div>';
            }

            html += '<div class="admission-card">' +
                '<div class="admission-card-header">' +
                '<div class="admission-card-title">Admission Card</div>' +
                '<div class="admission-card-subtitle">' + esc(assessmentName) + '</div>' +
                '</div>' +
                '<div class="admission-card-body">' +
                '<div class="admission-card-details">' +
                '<div class="admission-card-row"><span class="admission-card-label">Name</span><span class="admission-card-value">' + esc(e.full_name || '—') + '</span></div>' +
                '<div class="admission-card-row"><span class="admission-card-label">National ID</span><span class="admission-card-value">' + esc(e.national_id || '—') + '</span></div>' +
                '<div class="admission-card-row"><span class="admission-card-label">Center</span><span class="admission-card-value">' + esc(centerName) + '</span></div>' +
                '<div class="admission-card-row"><span class="admission-card-label">Room</span><span class="admission-card-value">' + esc(roomLabel) + '</span></div>' +
                '<div class="admission-card-row"><span class="admission-card-label">Seat</span><span class="admission-card-value">' + esc(seatLabel) + '</span></div>' +
                '<div class="admission-card-row"><span class="admission-card-label">Session</span><span class="admission-card-value">' + esc(sessionLabel) + '</span></div>' +
                '</div>' +
                '<div class="admission-card-qr">' + qrHtml + '</div>' +
                '</div>' +
                '<div class="admission-card-footer">' +
                '<span>' + esc(e.attendance_code || '') + '</span>' +
                '</div>' +
                '</div>';
        });

        container.innerHTML = html;
    };

    Admin.printCards = function () {
        window.print();
    };

    // ===================== ADD ASSESSMENT =====================

    Admin.openAddAssessmentModal = function () {
        document.getElementById('add-assessment-form').reset();
        document.getElementById('add-assessment-error').style.display = 'none';
        document.getElementById('add-assessment-success').style.display = 'none';
        Admin.openModal('add-assessment-modal');
    };

    Admin.handleAddAssessment = async function (e) {
        e.preventDefault();

        var name = document.getElementById('assessment-name').value.trim();
        var description = document.getElementById('assessment-description').value.trim();
        var examDate = document.getElementById('assessment-date').value;
        var errorEl = document.getElementById('add-assessment-error');
        var successEl = document.getElementById('add-assessment-success');
        var btn = document.getElementById('add-assessment-btn');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!name) {
            errorEl.textContent = 'Assessment name is required.';
            errorEl.style.display = '';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';

        try {
            var payload = { name: name, description: description || null, created_by: Admin.currentUser.id };
            if (examDate) payload.exam_date = examDate;

            var result = await Admin.serviceClient.from('assessments').insert(payload);
            if (result.error) throw result.error;

            successEl.textContent = 'Assessment "' + name + '" created!';
            successEl.style.display = '';

            await loadAssessments();
            populateFilterDropdowns();
            renderAssessments();
            Admin.renderOverview();

            setTimeout(function () {
                document.getElementById('add-assessment-form').reset();
                successEl.style.display = 'none';
            }, 2000);

            Admin.showToast('Assessment created: ' + name, 'success');
        } catch (err) {
            errorEl.textContent = err.message || 'Failed to create assessment.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Create Assessment';
        }
    };

    Admin.confirmDeleteAssessment = function (assessmentId, name) {
        document.getElementById('delete-confirm-text').textContent =
            'Are you sure you want to delete assessment "' + name + '"? Examinees linked to this assessment will be unlinked (not deleted).';

        pendingDeleteAction = async function () {
            try {
                var result = await Admin.serviceClient.from('assessments').delete().eq('id', assessmentId);
                if (result.error) throw result.error;

                Admin.showToast('Assessment deleted: ' + name, 'success');
                await Promise.all([loadAssessments(), loadExaminees()]);
                populateFilterDropdowns();
                renderAssessments();
                renderExaminees();
                Admin.renderOverview();
            } catch (err) {
                Admin.showToast('Error: ' + err.message, 'error');
            }
            Admin.closeModal('delete-confirm-modal');
        };

        Admin.openModal('delete-confirm-modal');
    };

    // ===================== ADD EXAMINEE =====================

    Admin.openAddExamineeModal = function () {
        document.getElementById('add-examinee-form').reset();
        document.getElementById('add-examinee-error').style.display = 'none';
        document.getElementById('add-examinee-success').style.display = 'none';

        // Populate center dropdown
        var centerSel = document.getElementById('examinee-center');
        centerSel.innerHTML = '<option value="">— Select a center —</option>';
        Admin.centers.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.location ? ' (' + c.location + ')' : '');
            centerSel.appendChild(opt);
        });

        // Populate assessment dropdown
        var assessmentSel = document.getElementById('examinee-assessment');
        assessmentSel.innerHTML = '<option value="">— None —</option>';
        Admin.assessments.forEach(function (a) {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.name;
            assessmentSel.appendChild(opt);
        });

        Admin.openModal('add-examinee-modal');
    };

    Admin.handleAddExaminee = async function (e) {
        e.preventDefault();

        var fullName = document.getElementById('examinee-fullname').value.trim();
        var nationalId = document.getElementById('examinee-nationalid').value.trim();
        var centerId = document.getElementById('examinee-center').value;
        var assessmentId = document.getElementById('examinee-assessment').value;
        var session = document.getElementById('examinee-session').value.trim();
        var errorEl = document.getElementById('add-examinee-error');
        var successEl = document.getElementById('add-examinee-success');
        var btn = document.getElementById('add-examinee-btn');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!fullName || !centerId) {
            errorEl.textContent = 'Name and center are required.';
            errorEl.style.display = '';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding…';

        try {
            // Generate a unique attendance code
            var code = 'EX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

            var payload = {
                full_name: fullName,
                center_id: centerId,
                attendance_code: code
            };
            if (nationalId) payload.national_id = nationalId;
            if (assessmentId) payload.assessment_id = assessmentId;
            if (session) payload.exam_session = session;

            var result = await Admin.serviceClient.from('examinees').insert(payload);
            if (result.error) throw result.error;

            successEl.textContent = 'Examinee "' + fullName + '" added!';
            successEl.style.display = '';

            await loadExaminees();
            renderExaminees();
            Admin.renderOverview();

            setTimeout(function () {
                document.getElementById('add-examinee-form').reset();
                successEl.style.display = 'none';
            }, 2000);

            Admin.showToast('Examinee added: ' + fullName, 'success');
        } catch (err) {
            errorEl.textContent = err.message || 'Failed to add examinee.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Examinee';
        }
    };

    Admin.confirmDeleteExaminee = function (examineeId, name) {
        document.getElementById('delete-confirm-text').textContent =
            'Are you sure you want to delete examinee "' + (name || 'this examinee') + '"? This will also remove their attendance records.';

        pendingDeleteAction = async function () {
            try {
                var result = await Admin.serviceClient.from('examinees').delete().eq('id', examineeId);
                if (result.error) throw result.error;

                Admin.showToast('Examinee deleted.', 'success');
                await Promise.all([loadExaminees(), loadAttendance()]);
                renderExaminees();
                Admin.renderOverview();
            } catch (err) {
                Admin.showToast('Error: ' + err.message, 'error');
            }
            Admin.closeModal('delete-confirm-modal');
        };

        Admin.openModal('delete-confirm-modal');
    };

    // ===================== ADD SUPERVISOR =====================

    Admin.openAddSupervisorModal = function () {
        // Reset form
        document.getElementById('add-supervisor-form').reset();
        document.getElementById('add-sup-error').style.display = 'none';
        document.getElementById('add-sup-success').style.display = 'none';

        // Populate center dropdown
        var select = document.getElementById('sup-center');
        select.innerHTML = '<option value="">— Select a center —</option>';
        Admin.centers.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.location ? ' (' + c.location + ')' : '');
            select.appendChild(opt);
        });

        Admin.openModal('add-supervisor-modal');
    };

    Admin.handleAddSupervisor = async function (e) {
        e.preventDefault();

        var fullName = document.getElementById('sup-fullname').value.trim();
        var email = document.getElementById('sup-email').value.trim();
        var password = document.getElementById('sup-password').value;
        var centerId = document.getElementById('sup-center').value;
        var errorEl = document.getElementById('add-sup-error');
        var successEl = document.getElementById('add-sup-success');
        var btn = document.getElementById('add-sup-btn');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!fullName || !email || !password || !centerId) {
            errorEl.textContent = 'All fields are required.';
            errorEl.style.display = '';
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters.';
            errorEl.style.display = '';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';

        try {
            // Step 1: Create the auth user via the throwaway client
            var signupResult = await Admin.signupClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (signupResult.error) {
                throw signupResult.error;
            }

            var newUser = signupResult.data.user;
            if (!newUser || !newUser.id) {
                throw new Error('User creation failed. Check Supabase Auth settings (email confirmation must be OFF).');
            }

            // Step 2: Insert the supervisor record
            var insertResult = await Admin.serviceClient
                .from('supervisors')
                .insert({
                    user_id: newUser.id,
                    center_id: centerId,
                    full_name: fullName,
                    email: email
                });

            if (insertResult.error) {
                throw new Error('Auth user created but supervisor record failed: ' + insertResult.error.message);
            }

            // Success
            successEl.textContent = 'Supervisor "' + fullName + '" created successfully!';
            successEl.style.display = '';

            // Refresh list
            await loadSupervisors();
            renderSupervisors();
            Admin.renderOverview();

            // Reset form after short delay
            setTimeout(function () {
                document.getElementById('add-supervisor-form').reset();
                successEl.style.display = 'none';
            }, 2000);

            Admin.showToast('Supervisor created: ' + fullName, 'success');

        } catch (err) {
            errorEl.textContent = err.message || 'Failed to create supervisor.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Supervisor';
        }
    };

    // ===================== ADD CENTER =====================

    Admin.openAddCenterModal = function () {
        document.getElementById('add-center-form').reset();
        document.getElementById('add-center-error').style.display = 'none';
        document.getElementById('add-center-success').style.display = 'none';
        Admin.openModal('add-center-modal');
    };

    Admin.handleAddCenter = async function (e) {
        e.preventDefault();

        var name = document.getElementById('center-name').value.trim();
        var location = document.getElementById('center-location').value.trim();
        var errorEl = document.getElementById('add-center-error');
        var successEl = document.getElementById('add-center-success');
        var btn = document.getElementById('add-center-btn');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!name) {
            errorEl.textContent = 'Center name is required.';
            errorEl.style.display = '';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';

        try {
            var result = await Admin.serviceClient
                .from('centers')
                .insert({ name: name, location: location || null });

            if (result.error) throw result.error;

            successEl.textContent = 'Center "' + name + '" created!';
            successEl.style.display = '';

            await loadCenters();
            renderCenters();
            Admin.renderOverview();

            setTimeout(function () {
                document.getElementById('add-center-form').reset();
                successEl.style.display = 'none';
            }, 2000);

            Admin.showToast('Center created: ' + name, 'success');

        } catch (err) {
            errorEl.textContent = err.message || 'Failed to create center.';
            errorEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Create Center';
        }
    };

    // ===================== DELETE SUPERVISOR =====================

    var pendingDeleteAction = null;

    Admin.confirmDeleteSupervisor = function (userId, name) {
        document.getElementById('delete-confirm-text').textContent =
            'Are you sure you want to remove supervisor "' + name + '"? This will remove their access to the system.';

        pendingDeleteAction = async function () {
            try {
                var result = await Admin.serviceClient
                    .from('supervisors')
                    .delete()
                    .eq('user_id', userId);

                if (result.error) throw result.error;

                Admin.showToast('Supervisor removed: ' + name, 'success');
                await loadSupervisors();
                renderSupervisors();
                Admin.renderOverview();
            } catch (err) {
                Admin.showToast('Error: ' + err.message, 'error');
            }
            Admin.closeModal('delete-confirm-modal');
        };

        Admin.openModal('delete-confirm-modal');
    };

    Admin.confirmDeleteCenter = function (centerId, name) {
        document.getElementById('delete-confirm-text').textContent =
            'Are you sure you want to delete center "' + name + '"? This will also remove all associated supervisors, examinees, and attendance records.';

        pendingDeleteAction = async function () {
            try {
                var result = await Admin.serviceClient
                    .from('centers')
                    .delete()
                    .eq('id', centerId);

                if (result.error) throw result.error;

                Admin.showToast('Center deleted: ' + name, 'success');
                await Promise.all([loadCenters(), loadSupervisors(), loadExaminees(), loadAttendance()]);
                renderCenters();
                renderSupervisors();
                Admin.renderOverview();
            } catch (err) {
                Admin.showToast('Error: ' + err.message, 'error');
            }
            Admin.closeModal('delete-confirm-modal');
        };

        Admin.openModal('delete-confirm-modal');
    };

    // ===================== BOOT =====================

    async function boot() {
        // Bind login form
        document.getElementById('login-form').addEventListener('submit', Admin.handleLogin);

        // Bind tab switching
        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                Admin.switchTab(btn.getAttribute('data-tab'));
            });
        });

        // Bind supervisor search
        var searchInput = document.getElementById('supervisors-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                renderSupervisors(this.value);
            });
        }

        // Bind examinees filters & search
        var exCenterFilter = document.getElementById('examinees-center-filter');
        var exAssessmentFilter = document.getElementById('examinees-assessment-filter');
        var exSearch = document.getElementById('examinees-search');
        if (exCenterFilter) exCenterFilter.addEventListener('change', function () { renderExaminees(); });
        if (exAssessmentFilter) exAssessmentFilter.addEventListener('change', function () { renderExaminees(); });
        if (exSearch) exSearch.addEventListener('input', function () { renderExaminees(); });

        // Bind cards filters
        var cardsCenterFilter = document.getElementById('cards-center-filter');
        var cardsAssessmentFilter = document.getElementById('cards-assessment-filter');
        if (cardsCenterFilter) cardsCenterFilter.addEventListener('change', function () { /* cards regenerate on button click */ });
        if (cardsAssessmentFilter) cardsAssessmentFilter.addEventListener('change', function () { /* cards regenerate on button click */ });

        // Bind forms
        document.getElementById('add-supervisor-form').addEventListener('submit', Admin.handleAddSupervisor);
        document.getElementById('add-center-form').addEventListener('submit', Admin.handleAddCenter);

        var assessmentForm = document.getElementById('add-assessment-form');
        if (assessmentForm) assessmentForm.addEventListener('submit', Admin.handleAddAssessment);

        var examineeForm = document.getElementById('add-examinee-form');
        if (examineeForm) examineeForm.addEventListener('submit', Admin.handleAddExaminee);

        // Bind delete confirm
        document.getElementById('delete-confirm-btn').addEventListener('click', function () {
            if (pendingDeleteAction) pendingDeleteAction();
        });

        // Check existing session
        try {
            var sessionResult = await Admin.supabase.auth.getSession();
            var session = sessionResult.data.session;

            if (session && session.user) {
                Admin.currentUser = session.user;

                // Verify admin
                var adminCheck = await Admin.serviceClient
                    .from('admins')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .single();

                if (adminCheck.data) {
                    Admin.adminProfile = adminCheck.data;
                    await initDashboard();
                    showApp();
                } else {
                    // Not an admin — sign out
                    await Admin.supabase.auth.signOut();
                    showLogin();
                }
            } else {
                showLogin();
            }
        } catch (err) {
            console.warn('Session restore failed:', err);
            showLogin();
        }

        // Listen for auth changes
        Admin.supabase.auth.onAuthStateChange(function (event) {
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
