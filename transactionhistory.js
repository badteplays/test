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
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}-${entry.item || ''}-${entry.pointsDeducted || 0}`;
                transactionMap.set(fingerprint, { id: key, ...entry, isOffline: false });
            });
        }

        if (offlineData && typeof offlineData === 'object') {
            Object.keys(offlineData).forEach((key) => {
                const entry = offlineData[key];
                if (!entry || typeof entry !== 'object') return;
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}-${entry.item || ''}-${entry.pointsDeducted || 0}`;
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
            const rows = currentFiltered.map((entry) => [
                entry.name || 'Unknown',
                entry.uid || 'N/A',
                formatDateDisplay(entry.date),
                entry.time || '-',
                entry.item || '-',
                -(Math.abs(Number(entry.pointsDeducted)) || 0),
                entry.isOffline ? 'Offline' : 'Online'
            ]);
            downloadCsv(
                'supplify_transaction_history.csv',
                ['Name', 'UID', 'Date', 'Time', 'Item', 'PointsDeducted', 'Mode'],
                rows
            );
        });
    }
});

// --- 3. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Session Active");
    }
});
