import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDD3uJlu_rT4DA4jnjyzixRRYc_69r8SL0",
    authDomain: "stationery-dispenser.firebaseapp.com",
    projectId: "stationery-dispenser",
    storageBucket: "stationery-dispenser.firebasestorage.app",
    messagingSenderId: "57000519693",
    appId: "1:57000519693:web:748481665644e9c5124d44",
    databaseURL: "https://stationery-dispenser-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// --- 2. INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function formatDateDisplay(dateStr) {
    if (!dateStr) return 'N/A';
    const dateParts = dateStr.split('/');
    if (dateParts.length === 3) {
        return `${dateParts[1].padStart(2, '0')}/${dateParts[0].padStart(2, '0')}/${dateParts[2]}`;
    }
    return dateStr;
}

function normalizeForSort(dateStr, timeStr) {
    if (!dateStr) return "0000-00-00T00:00:00";
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length < 3) return "0000-00-00T00:00:00";
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        const time = (timeStr || '00:00:00').padStart(8, '0');
        return `${year}-${month}-${day}T${time}`;
    }
    return `${dateStr}T${timeStr || '00:00:00'}`;
}

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

    // --- 3. LOAD ONLY loginHistory AND offlineLogs (NOT FULL DB ROOT) ---
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
                logsMap.set(fingerprint, { ...entry, isOffline });
            });
        };

        processLogs(onlineLogs, false);
        processLogs(offlineLogs, true);

        const combinedLogs = Array.from(logsMap.values());
        combinedLogs.sort((a, b) => {
            const isoA = normalizeForSort(a.date, a.time);
            const isoB = normalizeForSort(b.date, b.time);
            return isoB.localeCompare(isoA);
        });

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
            const lines = ['Name,UID,Date,Time,Mode'];
            currentFiltered.forEach((entry) => {
                const name = String(entry.name || 'Unknown').replace(/"/g, '""');
                const uid = String(entry.uid || 'N/A').replace(/"/g, '""');
                const date = formatDateDisplay(entry.date);
                const time = entry.time || '-';
                const mode = entry.isOffline ? 'Offline' : 'Online';
                lines.push(`"${name}","${uid}","${date}","${time}","${mode}"`);
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'supplify_login_history.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
});

// Session Check
onAuthStateChanged(auth, (user) => {
    if (user) console.log("Admin Session Active");
});
