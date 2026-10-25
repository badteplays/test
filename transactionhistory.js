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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
        }
    }
    return dateStr;
}

function parseDateTime(dateStr, timeStr) {
    if (!dateStr) return 0;
    let day = 1, month = 1, year = 1970;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/').map(Number);
        if (parts.length === 3) {
            [day, month, year] = parts;
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
            [year, month, day] = parts;
        }
    }
    const timeParts = (timeStr || '00:00:00').split(':').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0).getTime();
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

    // --- 2. LOAD TRANSACTION HISTORY (MERGED REAL-TIME) ---
    const historyRef = ref(db, 'transactions/');
    const offTransRef = ref(db, 'offTrans/');

    let normalData = null;
    let offlineData = null;
    let currentFiltered = [];

    const updateTable = () => {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const transactionMap = new Map();

        if (normalData && typeof normalData === 'object') {
            Object.keys(normalData).forEach((key) => {
                const entry = normalData[key];
                if (!entry || typeof entry !== 'object') return;
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                transactionMap.set(fingerprint, { id: key, ...entry, isOffline: false });
            });
        }

        if (offlineData && typeof offlineData === 'object') {
            Object.keys(offlineData).forEach((key) => {
                const entry = offlineData[key];
                if (!entry || typeof entry !== 'object') return;
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                if (!transactionMap.has(fingerprint)) {
                    transactionMap.set(fingerprint, { id: key, ...entry, isOffline: true });
                }
            });
        }

        const historyEntries = Array.from(transactionMap.values());
        historyEntries.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        currentFiltered = historyEntries.filter((entry) => {
            if (!query) return true;
            const name = String(entry.name || 'Unknown').toLowerCase();
            const uid = String(entry.uid || 'N/A').toLowerCase();
            const item = String(entry.item || '-').toLowerCase();
            const rawDate = String(entry.date || '').toLowerCase();
            const dispDate = formatDateDisplay(entry.date).toLowerCase();
            return (
                name.includes(query) ||
                uid.includes(query) ||
                item.includes(query) ||
                rawDate.includes(query) ||
                dispDate.includes(query)
            );
        });

        if (currentFiltered.length > 0) {
            currentFiltered.forEach((entry) => {
                const tr = document.createElement('tr');
                const isOffline = entry.isOffline === true;
                if (isOffline) {
                    tr.style.color = '#ff0000';
                    tr.style.fontStyle = 'italic';
                }

                const pointsValue = Number(entry.pointsDeducted) || 0;
                const displayPrefix = pointsValue > 0 ? '-' : '';

                const tdName = document.createElement('td');
                tdName.textContent = `${entry.name || 'Unknown'}${isOffline ? ' (Offline)' : ''}`;

                const tdUid = document.createElement('td');
                tdUid.textContent = entry.uid || 'N/A';

                const tdDate = document.createElement('td');
                tdDate.textContent = formatDateDisplay(entry.date);

                const tdTime = document.createElement('td');
                tdTime.textContent = entry.time || '-';

                const tdItem = document.createElement('td');
                tdItem.textContent = entry.item || '-';

                const tdPts = document.createElement('td');
                if (pointsValue > 0) {
                    tdPts.style.color = '#dd0000';
                    tdPts.style.fontWeight = 'bold';
                }
                tdPts.textContent = `${displayPrefix}${pointsValue}`;

                tr.append(tdName, tdUid, tdDate, tdTime, tdItem, tdPts);
                tableBody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.textAlign = 'center';
            td.style.padding = '20px';
            td.textContent = 'No transaction history found.';
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }
    };

    onValue(historyRef, (snapshot) => {
        normalData = snapshot.val();
        updateTable();
    });

    onValue(offTransRef, (snapshot) => {
        offlineData = snapshot.val();
        updateTable();
    });

    if (searchInput) {
        searchInput.addEventListener('input', updateTable);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const lines = ['Name,UID,Date,Time,Item,PointsDeducted,Mode'];
            currentFiltered.forEach((entry) => {
                const name = String(entry.name || 'Unknown').replace(/"/g, '""');
                const uid = String(entry.uid || 'N/A').replace(/"/g, '""');
                const date = formatDateDisplay(entry.date);
                const time = entry.time || '-';
                const item = String(entry.item || '-').replace(/"/g, '""');
                const pts = Number(entry.pointsDeducted) || 0;
                const mode = entry.isOffline ? 'Offline' : 'Online';
                lines.push(`"${name}","${uid}","${date}","${time}","${item}",-${pts},"${mode}"`);
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'supplify_transaction_history.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
});

// --- 3. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Session Active");
    }
});
