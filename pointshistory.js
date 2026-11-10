import {
    auth, db, MAX_POINTS,
    onAuthStateChanged, ref, onValue, push, get, runTransaction,
    normalizeUid, parseWholeNumber, parseDateTime, formatDateDisplay, nowStamp, downloadCsv,
    requireAdminSession, logoutAdmin
} from "./common.js";

requireAdminSession();

function extractPointsValue(entry) {
    if (!entry || typeof entry !== 'object') return 0;
    if (entry.pointsAdded !== undefined) return Number(entry.pointsAdded) || 0;
    if (entry.pointsEarned !== undefined) return Number(entry.pointsEarned) || 0;
    if (entry.points !== undefined) return Number(entry.points) || 0;
    if (entry.pointsDeducted !== undefined) return -(Math.abs(Number(entry.pointsDeducted)) || 0);
    return 0;
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');
    const searchInput = document.getElementById('history-search');
    const exportBtn = document.getElementById('export-csv-btn');

    const logPointsForm = document.getElementById('log-points-form');
    const depositNameInput = document.getElementById('deposit-name');
    const depositUidInput = document.getElementById('deposit-uid');
    const depositPointsInput = document.getElementById('deposit-points');
    const addPointsLogBtn = document.getElementById('add-points-log-btn');
    const feedbackEl = document.getElementById('points-feedback');

    function showFeedback(msg, isError = false) {
        if (!feedbackEl) return;
        feedbackEl.textContent = msg;
        feedbackEl.className = 'points-feedback ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            if (feedbackEl.textContent === msg) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'points-feedback';
            }
        }, 4500);
    }

    if (menuButton) {
        menuButton.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutAdmin);
    }

    // --- 2. LOAD POINTS HISTORY (MERGED REAL-TIME) ---
    const historyRef = ref(db, 'pointshistory/');
    const offPointsRef = ref(db, 'offpoints/');

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
                const pts = extractPointsValue(entry);
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}-${pts}-${key}`;
                transactionMap.set(fingerprint, { id: key, ...entry, isOffline: false });
            });
        }

        if (offlineData && typeof offlineData === 'object') {
            Object.keys(offlineData).forEach((key) => {
                const entry = offlineData[key];
                if (!entry || typeof entry !== 'object') return;
                const pts = extractPointsValue(entry);
                const dupOnline = Array.from(transactionMap.values()).some(
                    (e) => !e.isOffline && e.uid === entry.uid && e.date === entry.date && e.time === entry.time && extractPointsValue(e) === pts
                );
                if (!dupOnline) {
                    const fingerprint = `off-${entry.uid}-${entry.date}-${entry.time}-${pts}-${key}`;
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
            const rawDate = String(entry.date || '').toLowerCase();
            const dispDate = formatDateDisplay(entry.date).toLowerCase();
            return name.includes(query) || uid.includes(query) || rawDate.includes(query) || dispDate.includes(query);
        });

        if (currentFiltered.length > 0) {
            currentFiltered.forEach((entry) => {
                const tr = document.createElement('tr');
                const isOffline = entry.isOffline === true;
                if (isOffline) {
                    tr.style.color = '#ff0000';
                    tr.style.fontStyle = 'italic';
                }

                const pointsValue = extractPointsValue(entry);

                const tdName = document.createElement('td');
                tdName.textContent = `${entry.name || 'Unknown'}${isOffline ? ' (Offline)' : ''}`;

                const tdUid = document.createElement('td');
                tdUid.textContent = entry.uid || 'N/A';

                const tdDate = document.createElement('td');
                tdDate.textContent = formatDateDisplay(entry.date);

                const tdTime = document.createElement('td');
                tdTime.textContent = entry.time || '-';

                const tdPts = document.createElement('td');
                tdPts.style.fontWeight = 'bold';
                if (pointsValue > 0) {
                    tdPts.style.color = '#007a3d';
                    tdPts.textContent = `+${pointsValue}`;
                } else if (pointsValue < 0) {
                    tdPts.style.color = '#dd0000';
                    tdPts.textContent = `${pointsValue}`;
                } else {
                    tdPts.textContent = '0';
                }

                tr.append(tdName, tdUid, tdDate, tdTime, tdPts);
                tableBody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.padding = '20px';
            td.textContent = 'No points history found.';
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }
    };

    onValue(historyRef, (snapshot) => {
        normalData = snapshot.val();
        updateTable();
    });

    onValue(offPointsRef, (snapshot) => {
        offlineData = snapshot.val();
        updateTable();
    });

    if (searchInput) {
        searchInput.addEventListener('input', updateTable);
    }

    async function handleRecordPoints(event) {
        if (event) event.preventDefault();
        const typedName = depositNameInput ? depositNameInput.value.trim() : '';
        const uid = normalizeUid(depositUidInput ? depositUidInput.value : '');
        const pts = parseWholeNumber(depositPointsInput ? depositPointsInput.value : '', MAX_POINTS);

        if (!uid || pts === null || pts <= 0) {
            showFeedback(`Please enter a valid RFID UID and a positive Points value (1 to ${MAX_POINTS.toLocaleString()}).`, true);
            return;
        }

        try {
            // Verify the RFID account exists before recording or crediting points
            const accRef = ref(db, 'accounts/' + uid);
            const accSnap = await get(accRef);
            if (!accSnap.exists()) {
                showFeedback(`UID "${uid}" does not exist in registered accounts. Add the user on the Accounts page first.`, true);
                return;
            }

            const accountData = accSnap.val() || {};
            const registeredName = String(accountData.name || '').trim();
            if (typedName && registeredName && typedName.toLowerCase() !== registeredName.toLowerCase()) {
                showFeedback(`Name mismatch: UID "${uid}" belongs to "${registeredName}", not "${typedName}".`, true);
                return;
            }

            const finalName = registeredName || typedName || uid;
            const { date: dateStr, time: timeStr } = nowStamp();

            // Atomically increment the user's points balance using a Firebase transaction
            const pointsRef = ref(db, `accounts/${uid}/points`);
            await runTransaction(pointsRef, (currentPoints) => {
                const cur = Number(currentPoints) || 0;
                return Math.min(MAX_POINTS, cur + pts);
            });

            await push(ref(db, 'pointshistory'), {
                name: finalName,
                uid,
                date: dateStr,
                time: timeStr,
                pointsAdded: pts
            });

            showFeedback(`✓ Recorded +${pts} pts for ${finalName} (${uid})!`, false);
            if (depositNameInput) depositNameInput.value = '';
            if (depositUidInput) depositUidInput.value = '';
            if (depositPointsInput) depositPointsInput.value = '';
        } catch (err) {
            showFeedback("Error recording points: " + err.message, true);
        }
    }

    if (logPointsForm) {
        logPointsForm.addEventListener('submit', handleRecordPoints);
    } else if (addPointsLogBtn) {
        addPointsLogBtn.addEventListener('click', handleRecordPoints);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const rows = currentFiltered.map((entry) => [
                entry.name || 'Unknown',
                entry.uid || 'N/A',
                formatDateDisplay(entry.date),
                entry.time || '-',
                extractPointsValue(entry),
                entry.isOffline ? 'Offline' : 'Online'
            ]);
            downloadCsv('supplify_points_history.csv', ['Name', 'UID', 'Date', 'Time', 'Points', 'Mode'], rows);
        });
    }
});

// --- 3. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Session Active");
    }
});
