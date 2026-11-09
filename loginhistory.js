import {
    auth, db,
    onAuthStateChanged, signOut, ref, onValue,
    parseDateTime, formatDateDisplay, downloadCsv
} from "./common.js";

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');
    const searchInput = document.getElementById('history-search');
    const exportBtn = document.getElementById('export-csv-btn');

    if (menuButton) {
        menuButton.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('supplify_admin_session');
            signOut(auth).then(() => {
                window.location.replace("login.html");
            }).catch(() => {
                window.location.replace("login.html");
            });
        });
    }

    // --- 3. LOAD ONLY loginHistory AND offlineLogs ---
    let onlineLogs = null;
    let offlineLogs = null;
    let currentFiltered = [];

    const renderLogs = () => {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const logsMap = new Map();

        const processLogs = (logGroup, isOffline) => {
            if (!logGroup || typeof logGroup !== 'object') return;
            Object.keys(logGroup).forEach((key) => {
                const entry = logGroup[key];
                if (!entry || typeof entry !== 'object') return;
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                // Prefer online record when the same event exists in both online and offline logs
                if (!logsMap.has(fingerprint) || !isOffline) {
                    logsMap.set(fingerprint, { ...entry, isOffline });
                }
            });
        };

        processLogs(onlineLogs, false);
        processLogs(offlineLogs, true);

        const combinedLogs = Array.from(logsMap.values());
        combinedLogs.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        currentFiltered = combinedLogs.filter((entry) => {
            if (!query) return true;
            const name = String(entry.name || 'Unknown').toLowerCase();
            const uid = String(entry.uid || 'N/A').toLowerCase();
            const rawDate = String(entry.date || '').toLowerCase();
            const dispDate = formatDateDisplay(entry.date).toLowerCase();
            return name.includes(query) || uid.includes(query) || rawDate.includes(query) || dispDate.includes(query);
        });

        if (currentFiltered.length > 0) {
            currentFiltered.forEach((entry) => {
                const tr = document.createElement('tr');
                if (entry.isOffline) {
                    tr.style.color = '#ff0000';
                    tr.style.fontWeight = 'bold';
                }

                const tdName = document.createElement('td');
                tdName.textContent = `${entry.name || 'Unknown'}${entry.isOffline ? ' (Offline)' : ''}`;

                const tdUid = document.createElement('td');
                tdUid.textContent = entry.uid || 'N/A';

                const tdDate = document.createElement('td');
                tdDate.textContent = formatDateDisplay(entry.date);

                const tdTime = document.createElement('td');
                tdTime.textContent = entry.time || '-';

                tr.append(tdName, tdUid, tdDate, tdTime);
                tableBody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.style.textAlign = 'center';
            td.style.padding = '20px';
            td.textContent = 'No login history found.';
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }
    };

    onValue(ref(db, 'loginHistory'), (snapshot) => {
        onlineLogs = snapshot.val();
        renderLogs();
    });

    onValue(ref(db, 'offlineLogs'), (snapshot) => {
        offlineLogs = snapshot.val();
        renderLogs();
    });

    if (searchInput) {
        searchInput.addEventListener('input', renderLogs);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const rows = currentFiltered.map((entry) => [
                entry.name || 'Unknown',
                entry.uid || 'N/A',
                formatDateDisplay(entry.date),
                entry.time || '-',
                entry.isOffline ? 'Offline' : 'Online'
            ]);
            downloadCsv('supplify_login_history.csv', ['Name', 'UID', 'Date', 'Time', 'Mode'], rows);
        });
    }
});

// Session Check
onAuthStateChanged(auth, (user) => {
    if (user) console.log("Admin Session Active");
});
