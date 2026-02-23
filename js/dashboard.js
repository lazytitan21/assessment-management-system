// ============================================================
// dashboard.js — Examinee List, Reports & Exports
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    // ===================== HELPERS =====================

    // Build a Set of examinee IDs that have attendance records
    function getAttendedSet(examinees) {
        var filteredIds = new Set(examinees.map(function (ex) { return ex.id; }));
        return new Set(
            App.attendanceRecords
                .filter(function (r) { return filteredIds.has(r.examinee_id); })
                .map(function (r) { return r.examinee_id; })
        );
    }

    // Get scanned_at timestamp for an examinee (or null)
    function getScannedAt(examineeId) {
        var rec = App.attendanceRecords.find(function (r) { return r.examinee_id === examineeId; });
        return rec ? rec.scanned_at : null;
    }

    // ===================== EXAMINEES =====================

    App.loadExaminees = async function () {
        if (!App.center) { App.examinees = []; return; }

        const { data, error } = await App.db
            .from('examinees')
            .select('*')
            .eq('center_id', App.center.id)
            .order('full_name', { ascending: true });

        if (error) { App.showToast('Error loading examinees: ' + error.message, 'error'); return; }
        App.examinees = data || [];
        App.renderExaminees(App.getFilteredExaminees());
    };

    App.renderExaminees = function (list) {
        const wrap = document.getElementById('examinees-table');
        const countEl = document.getElementById('examinees-count');
        var assessmentLabel = App.currentAssessment ? App.currentAssessment.name : 'your center';

        // Apply attendance filter
        var filterSelect = document.getElementById('attendance-filter');
        var filterValue = filterSelect ? filterSelect.value : 'all';
        var attendedSet = getAttendedSet(list);

        var displayList = list;
        if (filterValue === 'present') {
            displayList = list.filter(function (ex) { return attendedSet.has(ex.id); });
        } else if (filterValue === 'absent') {
            displayList = list.filter(function (ex) { return !attendedSet.has(ex.id); });
        }

        var presentCount = list.filter(function (ex) { return attendedSet.has(ex.id); }).length;
        var absentCount = list.length - presentCount;
        countEl.innerHTML = list.length + ' examinee(s) in ' + App.esc(assessmentLabel) +
            ' &nbsp;<span class="badge badge-success">' + presentCount + ' Present</span>' +
            ' <span class="badge badge-danger">' + absentCount + ' Absent</span>';

        if (!displayList.length) {
            var msg = filterValue === 'present' ? 'No examinees marked as present yet.'
                    : filterValue === 'absent' ? 'All examinees are present!'
                    : 'No examinees found' + (App.currentAssessment ? ' for this exam.' : ' for your center.');
            wrap.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>' + msg + '</p></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>#</th><th>Name</th><th>National ID</th><th>Session</th><th>Status</th><th>Time</th><th>Card</th>' +
            '</tr></thead><tbody>';

        displayList.forEach(function (ex, i) {
            const attended = attendedSet.has(ex.id);
            const statusBadge = attended
                ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Present</span>'
                : '<span class="badge badge-danger"><i class="fas fa-times-circle"></i> Absent</span>';

            var scannedAt = getScannedAt(ex.id);
            var timeStr = scannedAt ? new Date(scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

            html += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + App.esc(ex.full_name) + '</td>' +
                '<td>' + App.esc(ex.national_id || '—') + '</td>' +
                '<td>' + App.esc(ex.exam_session || '—') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + timeStr + '</td>' +
                '<td><button class="btn btn-sm btn-outline" onclick="App.viewCard(\'' + ex.id + '\')"><i class="fas fa-id-card"></i></button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;
    };

    App.filterExaminees = function (query) {
        var baseList = App.getFilteredExaminees();
        if (!query || query.length < 1) {
            App.renderExaminees(baseList);
            return;
        }
        var q = query.toLowerCase();
        var filtered = baseList.filter(function (ex) {
            return (ex.full_name || '').toLowerCase().indexOf(q) !== -1 ||
                   (ex.national_id || '').toLowerCase().indexOf(q) !== -1;
        });
        App.renderExaminees(filtered);
    };

    // ===================== ATTENDANCE DATA =====================

    App.loadAttendanceRecords = async function () {
        if (!App.center) { App.attendanceRecords = []; return; }

        const { data, error } = await App.db
            .from('attendance_records')
            .select('*')
            .eq('center_id', App.center.id)
            .order('scanned_at', { ascending: false });

        if (error) { App.showToast('Error loading attendance: ' + error.message, 'error'); return; }
        App.attendanceRecords = data || [];
    };

    // ===================== REPORTS =====================

    App.renderReports = function () {
        var filteredExaminees = App.getFilteredExaminees();
        var attendedSet = getAttendedSet(filteredExaminees);

        var total = filteredExaminees.length;
        var attended = filteredExaminees.filter(function (ex) { return attendedSet.has(ex.id); }).length;
        var notAttended = total - attended;
        var pct = total > 0 ? Math.round((attended / total) * 100) : 0;

        // Sessions breakdown
        const sessions = {};
        filteredExaminees.forEach(function (ex) {
            var s = ex.exam_session || 'No Session';
            if (!sessions[s]) sessions[s] = { total: 0, attended: 0 };
            sessions[s].total++;
            if (attendedSet.has(ex.id)) sessions[s].attended++;
        });

        // Stats cards
        var examTitle = App.currentAssessment ? App.currentAssessment.name : 'All Exams';
        var statsHtml =
            '<div class="stat-card"><div class="stat-icon" style="background:var(--primary-bg);color:var(--primary)"><i class="fas fa-file-alt"></i></div>' +
            '<div class="stat-value" style="font-size:16px;word-break:break-word;">' + App.esc(examTitle) + '</div><div class="stat-label">Current Exam</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--primary-bg);color:var(--primary)"><i class="fas fa-users"></i></div>' +
            '<div class="stat-value">' + total + '</div><div class="stat-label">Total Examinees</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--success-bg);color:var(--success)"><i class="fas fa-check-circle"></i></div>' +
            '<div class="stat-value">' + attended + '</div><div class="stat-label">Present</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--danger-bg);color:var(--danger)"><i class="fas fa-times-circle"></i></div>' +
            '<div class="stat-value">' + notAttended + '</div><div class="stat-label">Absent</div></div>' +

            '<div class="stat-card"><div class="stat-icon" style="background:var(--info-bg);color:var(--info)"><i class="fas fa-percentage"></i></div>' +
            '<div class="stat-value">' + pct + '%</div><div class="stat-label">Attendance Rate</div></div>';

        document.getElementById('report-stats').innerHTML = statsHtml;

        // Session breakdown table
        var sessionKeys = Object.keys(sessions);
        var detailHtml = '';
        if (sessionKeys.length) {
            detailHtml = '<table class="data-table"><thead><tr>' +
                '<th>Session</th><th>Total</th><th>Present</th><th>Absent</th><th>Rate</th>' +
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

    // ===================== EXPORT HELPERS =====================

    function buildExportData() {
        var examinees = App.getFilteredExaminees();
        var attendedSet = getAttendedSet(examinees);
        var examTitle = App.currentAssessment ? App.currentAssessment.name : 'All Exams';
        var examDate = App.currentAssessment && App.currentAssessment.exam_date ? App.currentAssessment.exam_date : '—';
        var centerName = App.center ? App.center.name : '—';
        var supervisorName = App.supervisor ? App.supervisor.full_name : '—';

        var total = examinees.length;
        var presentCount = examinees.filter(function (ex) { return attendedSet.has(ex.id); }).length;
        var absentCount = total - presentCount;
        var rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        var rows = examinees.map(function (ex, i) {
            var isPresent = attendedSet.has(ex.id);
            var scannedAt = getScannedAt(ex.id);
            return {
                num: i + 1,
                name: ex.full_name || '',
                nationalId: ex.national_id || '—',
                session: ex.exam_session || '—',
                status: isPresent ? 'Present' : 'Absent',
                time: scannedAt ? new Date(scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
            };
        });

        return {
            examTitle: examTitle,
            examDate: examDate,
            centerName: centerName,
            supervisorName: supervisorName,
            total: total,
            presentCount: presentCount,
            absentCount: absentCount,
            rate: rate,
            rows: rows,
            generatedAt: new Date().toLocaleString()
        };
    }

    // ===================== PDF EXPORT =====================

    App.exportPDF = function () {
        if (!App.currentAssessment) {
            App.showToast('Please select an exam first', 'warning');
            return;
        }

        var d = buildExportData();
        if (!d.rows.length) {
            App.showToast('No examinees to export', 'warning');
            return;
        }

        try {
            var jsPDF = window.jspdf.jsPDF;
            var doc = new jsPDF('p', 'mm', 'a4');
            var pageW = doc.internal.pageSize.getWidth();
            var pageH = doc.internal.pageSize.getHeight();
            var margin = 15;
            var y = margin;

            // ---- Header band ----
            doc.setFillColor(79, 70, 229);  // --primary
            doc.rect(0, 0, pageW, 38, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Attendance Report', pageW / 2, 16, { align: 'center' });
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(d.examTitle, pageW / 2, 24, { align: 'center' });
            doc.setFontSize(9);
            doc.text('Generated: ' + d.generatedAt, pageW / 2, 32, { align: 'center' });

            y = 46;

            // ---- Info section ----
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Center:', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(d.centerName, margin + 25, y);

            doc.setFont('helvetica', 'bold');
            doc.text('Supervisor:', pageW / 2, y);
            doc.setFont('helvetica', 'normal');
            doc.text(d.supervisorName, pageW / 2 + 28, y);
            y += 6;

            doc.setFont('helvetica', 'bold');
            doc.text('Exam Date:', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(d.examDate, margin + 25, y);
            y += 10;

            // ---- Summary boxes ----
            var boxW = (pageW - margin * 2 - 12) / 4;
            var boxH = 18;
            var boxes = [
                { label: 'Total', value: String(d.total), color: [79, 70, 229] },
                { label: 'Present', value: String(d.presentCount), color: [16, 185, 129] },
                { label: 'Absent', value: String(d.absentCount), color: [239, 68, 68] },
                { label: 'Rate', value: d.rate + '%', color: [59, 130, 246] }
            ];

            boxes.forEach(function (box, i) {
                var bx = margin + i * (boxW + 4);
                doc.setFillColor(box.color[0], box.color[1], box.color[2]);
                doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(box.value, bx + boxW / 2, y + 8, { align: 'center' });
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(box.label, bx + boxW / 2, y + 14, { align: 'center' });
            });

            y += boxH + 10;

            // ---- Examinee table ----
            var tableBody = d.rows.map(function (r) {
                return [String(r.num), r.name, r.nationalId, r.session, r.status, r.time];
            });

            doc.autoTable({
                startY: y,
                head: [['#', 'Full Name', 'National ID', 'Session', 'Status', 'Scan Time']],
                body: tableBody,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 3,
                    lineColor: [220, 220, 220],
                    lineWidth: 0.2
                },
                headStyles: {
                    fillColor: [79, 70, 229],
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9
                },
                alternateRowStyles: { fillColor: [248, 249, 252] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    4: { halign: 'center', fontStyle: 'bold' },
                    5: { halign: 'center' }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 4) {
                        if (data.cell.raw === 'Present') {
                            data.cell.styles.textColor = [16, 185, 129];
                        } else {
                            data.cell.styles.textColor = [239, 68, 68];
                        }
                    }
                },
                didDrawPage: function (data) {
                    // Footer on every page
                    doc.setFillColor(245, 245, 245);
                    doc.rect(0, pageH - 12, pageW, 12, 'F');
                    doc.setFontSize(8);
                    doc.setTextColor(130, 130, 130);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Assessment Management System — Eng. Firas Kiftaro', margin, pageH - 5);
                    doc.text('Page ' + doc.internal.getCurrentPageInfo().pageNumber, pageW - margin, pageH - 5, { align: 'right' });
                }
            });

            // Save
            var filename = 'Attendance_' + d.examTitle.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
            doc.save(filename);
            App.showToast('PDF report downloaded', 'success');

        } catch (err) {
            console.error('PDF Export error:', err);
            App.showToast('PDF export failed: ' + err.message, 'error');
        }
    };

    // ===================== EXCEL EXPORT =====================

    App.exportExcel = function () {
        if (!App.currentAssessment) {
            App.showToast('Please select an exam first', 'warning');
            return;
        }

        var d = buildExportData();
        if (!d.rows.length) {
            App.showToast('No examinees to export', 'warning');
            return;
        }

        try {
            var wb = XLSX.utils.book_new();

            // ---- Sheet 1: Attendance List ----
            var headerRows = [
                ['Assessment Management System — Attendance Report'],
                [],
                ['Exam:', d.examTitle, '', 'Center:', d.centerName],
                ['Exam Date:', d.examDate, '', 'Supervisor:', d.supervisorName],
                ['Generated:', d.generatedAt],
                [],
                ['Total Examinees:', d.total, '', 'Present:', d.presentCount, '', 'Absent:', d.absentCount, '', 'Rate:', d.rate + '%'],
                []
            ];

            var dataRows = [['#', 'Full Name', 'National ID', 'Session', 'Status', 'Scan Time']];
            d.rows.forEach(function (r) {
                dataRows.push([r.num, r.name, r.nationalId, r.session, r.status, r.time]);
            });

            var allRows = headerRows.concat(dataRows);
            var ws = XLSX.utils.aoa_to_sheet(allRows);

            // Column widths
            ws['!cols'] = [
                { wch: 5 },   // #
                { wch: 28 },  // Full Name
                { wch: 22 },  // National ID
                { wch: 38 },  // Session
                { wch: 10 },  // Status
                { wch: 12 },  // Scan Time
                { wch: 3 },
                { wch: 10 },
                { wch: 3 },
                { wch: 10 },
                { wch: 8 }
            ];

            // Merge title row
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

            // ---- Sheet 2: Present Only ----
            var presentRows = [['#', 'Full Name', 'National ID', 'Session', 'Scan Time']];
            var pNum = 1;
            d.rows.forEach(function (r) {
                if (r.status === 'Present') {
                    presentRows.push([pNum++, r.name, r.nationalId, r.session, r.time]);
                }
            });
            var wsPresent = XLSX.utils.aoa_to_sheet(presentRows);
            wsPresent['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 22 }, { wch: 38 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(wb, wsPresent, 'Present');

            // ---- Sheet 3: Absent Only ----
            var absentRows = [['#', 'Full Name', 'National ID', 'Session']];
            var aNum = 1;
            d.rows.forEach(function (r) {
                if (r.status === 'Absent') {
                    absentRows.push([aNum++, r.name, r.nationalId, r.session]);
                }
            });
            var wsAbsent = XLSX.utils.aoa_to_sheet(absentRows);
            wsAbsent['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 22 }, { wch: 38 }];
            XLSX.utils.book_append_sheet(wb, wsAbsent, 'Absent');

            // ---- Sheet 4: Summary ----
            var summaryRows = [
                ['Attendance Summary'],
                [],
                ['Exam', d.examTitle],
                ['Exam Date', d.examDate],
                ['Center', d.centerName],
                ['Supervisor', d.supervisorName],
                [],
                ['Metric', 'Value'],
                ['Total Examinees', d.total],
                ['Present', d.presentCount],
                ['Absent', d.absentCount],
                ['Attendance Rate', d.rate + '%'],
                [],
                ['Report Generated', d.generatedAt]
            ];
            var wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
            wsSummary['!cols'] = [{ wch: 20 }, { wch: 40 }];
            wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            // Save
            var filename = 'Attendance_' + d.examTitle.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
            XLSX.writeFile(wb, filename);
            App.showToast('Excel file downloaded', 'success');

        } catch (err) {
            console.error('Excel Export error:', err);
            App.showToast('Excel export failed: ' + err.message, 'error');
        }
    };

})();
