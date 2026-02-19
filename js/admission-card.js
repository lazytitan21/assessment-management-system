// ============================================================
// admission-card.js — QR Code Generation & Admission Cards
// ============================================================
(function () {
    'use strict';
    const App = window.App = window.App || {};

    // --------------- Build a single card HTML ---------------
    App.buildCardHtml = function (examinee, centerName) {
        var qrDataUrl = '';
        try {
            var qr = qrcode(0, 'M');
            qr.addData(examinee.attendance_code);
            qr.make();
            qrDataUrl = qr.createDataURL(5, 0);
        } catch (e) {
            console.warn('QR generation failed for', examinee.id, e);
        }

        return '<div class="admission-card">' +
            '<div class="admission-card-header">' +
            '<div class="admission-card-title">ADMISSION CARD</div>' +
            '<div class="admission-card-subtitle">' + App.esc(centerName || '') + '</div>' +
            '</div>' +
            '<div class="admission-card-body">' +
            '<div class="admission-card-info">' +
            '<div class="admission-card-row"><span class="label">Name:</span> <strong>' + App.esc(examinee.full_name) + '</strong></div>' +
            (examinee.national_id ? '<div class="admission-card-row"><span class="label">National ID:</span> ' + App.esc(examinee.national_id) + '</div>' : '') +
            (examinee.exam_session ? '<div class="admission-card-row"><span class="label">Session:</span> ' + App.esc(examinee.exam_session) + '</div>' : '') +
            '<div class="admission-card-row"><span class="label">Center:</span> ' + App.esc(centerName || '') + '</div>' +
            '</div>' +
            (qrDataUrl
                ? '<div class="admission-card-qr">' +
                  '<img src="' + qrDataUrl + '" alt="QR Code" width="120" height="120">' +
                  '<div class="qr-label">Scan for attendance</div>' +
                  '</div>'
                : '') +
            '</div>' +
            '<div class="admission-card-footer">' +
            'Please arrive 15 minutes before the exam. Present this card at the entrance.' +
            '</div>' +
            '</div>';
    };

    // --------------- Render cards list in the Cards tab ---------------
    App.renderCardsList = function () {
        var el = document.getElementById('cards-list');
        if (!App.examinees.length) {
            el.innerHTML = '<div class="empty-state"><i class="fas fa-id-card"></i><p>No examinees found.</p></div>';
            return;
        }

        var centerName = App.center ? App.center.name : '';
        var html = '<div class="cards-grid">';
        App.examinees.forEach(function (ex) {
            html += '<div class="card-preview-wrap">' +
                App.buildCardHtml(ex, centerName) +
                '<div class="card-actions">' +
                '<button class="btn btn-sm btn-outline" onclick="App.viewCard(\'' + ex.id + '\')">' +
                '<i class="fas fa-external-link-alt"></i> View / Print</button>' +
                '</div></div>';
        });
        html += '</div>';
        el.innerHTML = html;
    };

    // --------------- View single card (open in new tab) ---------------
    App.viewCard = function (examineeId) {
        window.open('admission-card.html?id=' + examineeId, '_blank');
    };

    // --------------- Print all cards (open in new tab) ---------------
    App.printAllCards = function () {
        window.open('admission-card.html', '_blank');
    };
})();
