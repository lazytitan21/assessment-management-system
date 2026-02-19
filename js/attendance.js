// ============================================================
// attendance.js — QR Code Scanning & Attendance Registration
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    var html5QrCode = null;
    var isScanning = false;
    var recentScans = [];  // most-recent first

    // --------------- Get current exam session value ---------------
    function getExamSession() {
        var input = document.getElementById('exam-session-input');
        return (input && input.value.trim()) || '';
    }

    // --------------- Start QR Scanner ---------------
    App.startScanner = function () {
        if (isScanning) return;
        var readerEl = document.getElementById('qr-reader');
        readerEl.style.display = 'block';
        document.getElementById('start-scan-btn').style.display = 'none';
        document.getElementById('stop-scan-btn').style.display = '';

        html5QrCode = new Html5Qrcode('qr-reader');
        isScanning = true;

        html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            function onScanSuccess(decodedText) {
                // Pause scanning while we process
                if (html5QrCode && isScanning) {
                    html5QrCode.pause(true);
                }
                App.processScannedCode(decodedText);
            },
            function onScanFailure() { /* ignore continuous scan misses */ }
        ).catch(function (err) {
            App.showToast('Camera error: ' + err, 'error');
            App.stopScanner();
        });
    };

    // --------------- Stop QR Scanner ---------------
    App.stopScanner = function () {
        if (html5QrCode) {
            try { html5QrCode.stop(); } catch (e) { /* ignore */ }
            html5QrCode = null;
        }
        isScanning = false;
        document.getElementById('qr-reader').style.display = 'none';
        document.getElementById('qr-reader').innerHTML = '';
        document.getElementById('start-scan-btn').style.display = '';
        document.getElementById('stop-scan-btn').style.display = 'none';
    };

    // --------------- Resume scanner after result ---------------
    function resumeScanner() {
        if (html5QrCode && isScanning) {
            try { html5QrCode.resume(); } catch (e) { /* ignore */ }
        }
    }

    // --------------- Process scanned QR code ---------------
    App.processScannedCode = async function (code) {
        var resultEl = document.getElementById('scan-result');
        resultEl.innerHTML = '<div class="scan-processing"><i class="fas fa-spinner fa-spin"></i> Processing…</div>';

        var attendanceCode = code.trim();

        try {
            // 1. Look up examinee by attendance_code (RLS restricts to own center)
            var resp = await App.supabase
                .from('examinees')
                .select('*')
                .eq('attendance_code', attendanceCode)
                .maybeSingle();

            if (resp.error) throw resp.error;

            var examinee = resp.data;
            if (!examinee) {
                showResult('error', 'Invalid Code', 'This QR code does not match any examinee in your center.', null);
                setTimeout(resumeScanner, 2000);
                return;
            }

            // 2. Insert attendance record
            var session = getExamSession() || examinee.exam_session || '';
            var insertResp = await App.supabase
                .from('attendance_records')
                .insert({
                    examinee_id: examinee.id,
                    center_id: examinee.center_id,
                    scanned_by: App.currentUser.id,
                    exam_session: session || null
                })
                .select()
                .single();

            if (insertResp.error) {
                // Check for unique constraint violation (duplicate)
                if (insertResp.error.code === '23505' ||
                    (insertResp.error.message && insertResp.error.message.indexOf('duplicate') !== -1) ||
                    (insertResp.error.message && insertResp.error.message.indexOf('unique') !== -1)) {
                    showResult('warning', 'Already Registered',
                        examinee.full_name + ' has already been marked as present' +
                        (session ? ' for session "' + App.esc(session) + '"' : '') + '.',
                        examinee);
                    setTimeout(resumeScanner, 2000);
                    return;
                }
                throw insertResp.error;
            }

            // 3. Success!
            var record = insertResp.data;
            var ts = new Date(record.scanned_at).toLocaleString();
            showResult('success', 'Attendance Registered',
                examinee.full_name + ' — registered at ' + ts,
                examinee);

            // Add to recent scans
            recentScans.unshift({
                name: examinee.full_name,
                time: ts,
                session: session
            });
            if (recentScans.length > 20) recentScans.length = 20;
            renderRecentScans();

            // Refresh attendance data
            await App.loadAttendanceRecords();
            App.renderExaminees(App.examinees);
            App.renderReports();

            setTimeout(resumeScanner, 2500);

        } catch (err) {
            showResult('error', 'Error', err.message || 'An unexpected error occurred.', null);
            setTimeout(resumeScanner, 2000);
        }
    };

    // --------------- Show scan result ---------------
    function showResult(type, title, message, examinee) {
        var el = document.getElementById('scan-result');
        var iconMap = { success: 'check-circle', warning: 'exclamation-triangle', error: 'times-circle' };
        var colorMap = { success: 'var(--success)', warning: 'var(--warning)', error: 'var(--danger)' };
        var bgMap = { success: 'var(--success-bg)', warning: 'var(--warning-bg)', error: 'var(--danger-bg)' };

        el.innerHTML =
            '<div class="scan-result-card" style="border-left:4px solid ' + colorMap[type] + ';background:' + bgMap[type] + ';">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
            '<i class="fas fa-' + iconMap[type] + '" style="font-size:28px;color:' + colorMap[type] + ';"></i>' +
            '<div>' +
            '<div style="font-weight:700;font-size:16px;color:' + colorMap[type] + ';">' + App.esc(title) + '</div>' +
            '<div style="font-size:14px;color:var(--text-primary);margin-top:2px;">' + message + '</div>' +
            (examinee && examinee.national_id ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">ID: ' + App.esc(examinee.national_id) + '</div>' : '') +
            '</div></div></div>';
    }

    // --------------- Render recent scans list ---------------
    function renderRecentScans() {
        var el = document.getElementById('recent-scans');
        if (!recentScans.length) { el.innerHTML = ''; return; }

        var html = '<h3 style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--text-primary);">' +
            '<i class="fas fa-history" style="color:var(--primary);margin-right:6px;"></i>Recent Scans (' + recentScans.length + ')</h3>' +
            '<div class="recent-scans-list">';

        recentScans.forEach(function (s) {
            html += '<div class="recent-scan-item">' +
                '<i class="fas fa-check-circle" style="color:var(--success);"></i>' +
                '<span class="recent-scan-name">' + App.esc(s.name) + '</span>' +
                '<span class="recent-scan-time">' + App.esc(s.time) + '</span>' +
                '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
    }
})();
