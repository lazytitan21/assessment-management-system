// ============================================================
// dashboard.js — Examinee List & Reports
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    // ===================== EXAMINEES =====================

    App.loadExaminees = async function () {
        const { data, error } = await App.supabase
            .from('examinees')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) { App.showToast('Error loading examinees: ' + error.message, 'error'); return; }
        App.examinees = data || [];
        App.renderExaminees(App.examinees);
    };

    App.renderExaminees = function (list) {
        const wrap = document.getElementById('examinees-table');
        const countEl = document.getElementById('examinees-count');
        countEl.textContent = list.length + ' examinee(s) in your center';

        if (!list.length) {
            wrap.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No examinees found for your center.</p></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>#</th><th>Name</th><th>National ID</th><th>Session</th><th>Attendance</th><th>Card</th>' +
            '</tr></thead><tbody>';

        list.forEach(function (ex, i) {
            const attended = App.attendanceRecords.some(function (r) { return r.examinee_id === ex.id; });
            const statusBadge = attended
                ? '<span class="badge badge-success"><i class="fas fa-check"></i> Present</span>'
                : '<span class="badge badge-secondary">—</span>';

            html += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + App.esc(ex.full_name) + '</td>' +
                '<td>' + App.esc(ex.national_id || '—') + '</td>' +
                '<td>' + App.esc(ex.exam_session || '—') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td><button class="btn btn-sm btn-outline" onclick="App.viewCard(\'' + ex.id + '\')"><i class="fas fa-id-card"></i></button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;
    };

    App.filterExaminees = function (query) {
        if (!query || query.length < 1) {
            App.renderExaminees(App.examinees);
            return;
        }
        var q = query.toLowerCase();
        var filtered = App.examinees.filter(function (ex) {
            return (ex.full_name || '').toLowerCase().indexOf(q) !== -1 ||
                   (ex.national_id || '').toLowerCase().indexOf(q) !== -1;
        });
        App.renderExaminees(filtered);
    };

    // ===================== ATTENDANCE DATA =====================

    App.loadAttendanceRecords = async function () {
        const { data, error } = await App.supabase
            .from('attendance_records')
            .select('*')
            .order('scanned_at', { ascending: false });

        if (error) { App.showToast('Error loading attendance: ' + error.message, 'error'); return; }
        App.attendanceRecords = data || [];
    };

    // ===================== REPORTS =====================

    App.renderReports = function () {
        const total = App.examinees.length;
        const attendedIds = new Set(App.attendanceRecords.map(function (r) { return r.examinee_id; }));
        const attended = App.examinees.filter(function (ex) { return attendedIds.has(ex.id); }).length;
        const notAttended = total - attended;
        const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

        // Sessions breakdown
        const sessions = {};
        App.examinees.forEach(function (ex) {
            var s = ex.exam_session || 'No Session';
            if (!sessions[s]) sessions[s] = { total: 0, attended: 0 };
            sessions[s].total++;
            if (attendedIds.has(ex.id)) sessions[s].attended++;
        });

        // Stats cards
        var statsHtml =
            '<div class="stat-card"><div class="stat-icon" style="background:var(--primary-bg);color:var(--primary)"><i class="fas fa-users"></i></div>' +
            '<div class="stat-value">' + total + '</div><div class="stat-label">Total Examinees</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--success-bg);color:var(--success)"><i class="fas fa-check-circle"></i></div>' +
            '<div class="stat-value">' + attended + '</div><div class="stat-label">Attended</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--danger-bg);color:var(--danger)"><i class="fas fa-times-circle"></i></div>' +
            '<div class="stat-value">' + notAttended + '</div><div class="stat-label">Not Attended</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--info-bg);color:var(--info)"><i class="fas fa-percentage"></i></div>' +
            '<div class="stat-value">' + pct + '%</div><div class="stat-label">Attendance Rate</div></div>';

        document.getElementById('report-stats').innerHTML = statsHtml;

        // Session breakdown table
        var sessionKeys = Object.keys(sessions);
        var detailHtml = '';
        if (sessionKeys.length) {
            detailHtml = '<table class="data-table"><thead><tr>' +
                '<th>Session</th><th>Total</th><th>Attended</th><th>Remaining</th><th>Rate</th>' +
                '</tr></thead><tbody>';
            sessionKeys.forEach(function (s) {
                var row = sessions[s];
                var rem = row.total - row.attended;
                var rate = row.total > 0 ? Math.round((row.attended / row.total) * 100) : 0;
                detailHtml += '<tr>' +
                    '<td><strong>' + App.esc(s) + '</strong></td>' +
                    '<td>' + row.total + '</td>' +
                    '<td><span class="badge badge-success">' + row.attended + '</span></td>' +
                    '<td><span class="badge badge-danger">' + rem + '</span></td>' +
                    '<td>' + rate + '%</td>' +
                    '</tr>';
            });
            detailHtml += '</tbody></table>';
        } else {
            detailHtml = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No data to display</p></div>';
        }
        document.getElementById('report-content').innerHTML = detailHtml;
    };
})();
