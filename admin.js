import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDD3uJlu_rT4DA4jnjyzixRRYc_69r8SL0",
    authDomain: "stationery-dispenser.firebaseapp.com",
    projectId: "stationery-dispenser",
    storageBucket: "stationery-dispenser.firebasestorage.app",
    messagingSenderId: "57000519693",
    appId: "1:57000519693:web:748481665644e9c5124d44",
    databaseURL: "https://stationery-dispenser-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- 1. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Welcome, Admin:", user.email);
    }
});

// Helper: parse DD/MM/YYYY or YYYY-MM-DD + HH:mm:ss into a sortable timestamp
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

function formatDateDisplay(dateStr) {
    if (!dateStr) return 'N/A';
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
        }
    }
    return dateStr;
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const menuButton = document.getElementById('menu-button');
    const uidTableBody = document.getElementById('uid-table-body');
    const notifsTableBody = document.getElementById('notifs-table-body');
    const searchInput = document.getElementById('admin-search');
    const newNotifInput = document.getElementById('new-notif-input');
    const addNotifBtn = document.getElementById('add-notif-btn');
    const exportBtn = document.getElementById('export-admin-btn');
    const syncStatusCircle = document.getElementById('syncStatus');

    const statAccounts = document.getElementById('stat-accounts');
    const statPrices = document.getElementById('stat-prices');
    const statTransactions = document.getElementById('stat-transactions');
    const statBottles = document.getElementById('stat-bottles');

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

    if (menuButton) {
        menuButton.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    let loginHistoryData = null;
    let offlineLogsData = null;
    let commandsData = null;
    let transactionsData = null;
    let offTransData = null;
    let customNotifsData = null;
    let currentUidRows = [];
    let currentNotifRows = [];

    function updateTransactionsCount() {
        if (!statTransactions) return;
        const map = new Set();
        const addGroup = (group) => {
            if (!group || typeof group !== 'object') return;
            Object.keys(group).forEach((k) => {
                const t = group[k];
                if (t) map.add(`${t.uid}-${t.date}-${t.time}-${t.item}`);
            });
        };
        addGroup(transactionsData);
        addGroup(offTransData);
        statTransactions.textContent = String(map.size);
    }

    // Summary listeners
    onValue(ref(db, 'accounts'), (snap) => {
        const val = snap.val();
        const count = val ? Object.keys(val).length : 0;
        if (statAccounts) statAccounts.textContent = String(count);
    });

    onValue(ref(db, 'inventory'), (snap) => {
        const val = snap.val();
        if (val && statPrices) {
            statPrices.textContent = `${val.pen ?? 0} / ${val.marker ?? 0} / ${val.yellowpaper ?? 0} / ${val.shortbondpaper ?? 0}`;
        }
    });

    onValue(ref(db, 'transactions'), (snap) => {
        transactionsData = snap.val();
        updateTransactionsCount();
    });

    onValue(ref(db, 'bottlevalue'), (snap) => {
        const val = snap.val();
        if (val && statBottles) {
            statBottles.textContent = `${val.ml1000 ?? 0} / ${val.ml500 ?? 0} / ${val.ml350 ?? 0}`;
        }
    });

    // Activity & Notification listeners
    onValue(ref(db, 'loginHistory'), (snap) => {
        loginHistoryData = snap.val();
        renderUidActivity();
    });

    onValue(ref(db, 'offlineLogs'), (snap) => {
        offlineLogsData = snap.val();
        renderUidActivity();
        renderNotifications();
    });

    onValue(ref(db, 'commands'), (snap) => {
        commandsData = snap.val();
        updateSyncCircle();
        renderNotifications();
    });

    onValue(ref(db, 'offTrans'), (snap) => {
        offTransData = snap.val();
        updateTransactionsCount();
        renderNotifications();
    });

    onValue(ref(db, 'notifications'), (snap) => {
        customNotifsData = snap.val();
        renderNotifications();
    });

    function updateSyncCircle() {
        if (!syncStatusCircle || !commandsData) return;
        syncStatusCircle.classList.remove('gray', 'green', 'red');

        const getLast = (obj) => {
            if (!obj) return null;
            const keys = Object.keys(obj);
            return keys.length ? obj[keys[keys.length - 1]] : null;
        };

        const lastFail = getLast(commandsData.syncfail);
        const lastSuccess = getLast(commandsData.syncsuccess);
        const failTime = lastFail ? parseDateTime(lastFail.date, lastFail.time) : 0;
        const successTime = lastSuccess ? parseDateTime(lastSuccess.date, lastSuccess.time) : 0;

        if (commandsData.syncStatus === 'sync_fail' || (failTime > successTime && failTime > 0)) {
            syncStatusCircle.classList.add('red');
            syncStatusCircle.title = `Last Sync Failed (${lastFail?.reason || 'Error'})`;
        } else if (commandsData.syncStatus === 'sync_success' || successTime > 0) {
            syncStatusCircle.classList.add('green');
            syncStatusCircle.title = `Last Sync Successful (${lastSuccess?.date || ''} ${lastSuccess?.time || ''})`;
        } else {
            syncStatusCircle.classList.add('gray');
        }
    }

    function renderUidActivity() {
        if (!uidTableBody) return;
        const map = new Map();

        const collect = (group, isOffline) => {
            if (!group) return;
            Object.keys(group).forEach((k) => {
                const entry = group[k];
                if (!entry) return;
                const fp = `${entry.uid}-${entry.date}-${entry.time}`;
                map.set(fp, {
                    uid: entry.uid || 'N/A',
                    name: entry.name || 'Unknown',
                    date: entry.date || '',
                    time: entry.time || '-',
                    isOffline
                });
            });
        };

        collect(loginHistoryData, false);
        collect(offlineLogsData, true);

        const all = Array.from(map.values()).sort((a, b) => {
            return parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time);
        });

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        currentUidRows = all.filter((row) => {
            if (!query) return true;
            return (
                row.uid.toLowerCase().includes(query) ||
                row.name.toLowerCase().includes(query) ||
                formatDateDisplay(row.date).toLowerCase().includes(query) ||
                row.date.toLowerCase().includes(query)
            );
        });

        uidTableBody.innerHTML = '';
        if (currentUidRows.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 3;
            td.textContent = 'No matching UID activity found.';
            tr.appendChild(td);
            uidTableBody.appendChild(tr);
            return;
        }

        currentUidRows.slice(0, 100).forEach((entry) => {
            const tr = document.createElement('tr');
            if (entry.isOffline) {
                tr.style.color = '#b30000';
                tr.style.fontWeight = 'bold';
            }

            const tdUid = document.createElement('td');
            tdUid.textContent = `${entry.uid} (${entry.name}${entry.isOffline ? ' - Offline' : ''})`;

            const tdDate = document.createElement('td');
            tdDate.textContent = formatDateDisplay(entry.date);

            const tdTime = document.createElement('td');
            tdTime.textContent = entry.time;

            tr.append(tdUid, tdDate, tdTime);
            uidTableBody.appendChild(tr);
        });
    }

    function renderNotifications() {
        if (!notifsTableBody) return;
        const notifs = [];

        // 1. Custom admin notifications
        if (customNotifsData) {
            Object.keys(customNotifsData).forEach((k) => {
                const n = customNotifsData[k];
                if (n && n.message) {
                    notifs.push({
                        message: n.message,
                        date: n.date || '',
                        time: n.time || '-',
                        severity: n.severity || 'info'
                    });
                }
            });
        }

        // 2. Sync failure alerts from commands/syncfail
        if (commandsData && commandsData.syncfail) {
            Object.keys(commandsData.syncfail).forEach((k) => {
                const entry = commandsData.syncfail[k];
                if (entry) {
                    notifs.push({
                        message: `Sync Failed: ${entry.reason || 'Error'} (${entry.firstName || 'User'} - ${entry.uid || 'N/A'})`,
                        date: entry.date || '',
                        time: entry.time || '-',
                        severity: 'error'
                    });
                }
            });
        }

        // 3. Sync success alerts from commands/syncsuccess
        if (commandsData && commandsData.syncsuccess) {
            Object.keys(commandsData.syncsuccess).forEach((k) => {
                const entry = commandsData.syncsuccess[k];
                if (entry) {
                    notifs.push({
                        message: `Mega Sync Complete`,
                        date: entry.date || '',
                        time: entry.time || '-',
                        severity: 'success'
                    });
                }
            });
        }

        // 4. Offline transactions synced
        if (offTransData) {
            Object.keys(offTransData).forEach((k) => {
                const entry = offTransData[k];
                if (entry) {
                    notifs.push({
                        message: `Offline Dispense: ${entry.item || 'Item'} by ${entry.name || entry.uid || 'User'} (-${entry.pointsDeducted || 0} pts)`,
                        date: entry.date || '',
                        time: entry.time || '-',
                        severity: 'warn'
                    });
                }
            });
        }

        notifs.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        currentNotifRows = notifs.filter((n) => {
            if (!query) return true;
            return (
                n.message.toLowerCase().includes(query) ||
                formatDateDisplay(n.date).toLowerCase().includes(query) ||
                n.date.toLowerCase().includes(query)
            );
        });

        notifsTableBody.innerHTML = '';
        if (currentNotifRows.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 3;
            td.textContent = 'No notifications found.';
            tr.appendChild(td);
            notifsTableBody.appendChild(tr);
            return;
        }

        currentNotifRows.slice(0, 100).forEach((n) => {
            const tr = document.createElement('tr');
            if (n.severity === 'error') {
                tr.style.color = '#b30000';
                tr.style.fontWeight = 'bold';
            }

            const tdMsg = document.createElement('td');
            tdMsg.textContent = n.message;

            const tdDate = document.createElement('td');
            tdDate.textContent = formatDateDisplay(n.date);

            const tdTime = document.createElement('td');
            tdTime.textContent = n.time;

            tr.append(tdMsg, tdDate, tdTime);
            notifsTableBody.appendChild(tr);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderUidActivity();
            renderNotifications();
        });
    }

    if (addNotifBtn && newNotifInput) {
        addNotifBtn.addEventListener('click', () => {
            const msg = newNotifInput.value.trim();
            if (!msg) return;
            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const timeStr = now.toTimeString().slice(0, 8);

            push(ref(db, 'notifications'), {
                message: msg,
                date: dateStr,
                time: timeStr,
                severity: 'info'
            }).then(() => {
                newNotifInput.value = '';
            });
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const lines = ['Type,Detail,Date,Time'];
            currentUidRows.forEach((r) => {
                lines.push(`"UID Activity","${(r.uid + ' - ' + r.name).replace(/"/g, '""')}","${formatDateDisplay(r.date)}","${r.time}"`);
            });
            currentNotifRows.forEach((n) => {
                lines.push(`"Notification","${n.message.replace(/"/g, '""')}","${formatDateDisplay(n.date)}","${n.time}"`);
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'admin_activity_notifications.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
});
