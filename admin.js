import {
    auth, db,
    onAuthStateChanged, signOut, ref, onValue, push, set,
    parseDateTime, formatDateDisplay, nowStamp, downloadCsv, getSyncState
} from "./common.js";

// --- 1. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Welcome, Admin:", user.email);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const menuButton = document.getElementById('menu-button');
    const uidTableBody = document.getElementById('uid-table-body');
    const notifsTableBody = document.getElementById('notifs-table-body');
    const uidHeading = document.getElementById('uid-table-heading');
    const notifsHeading = document.getElementById('notifs-table-heading');
    const searchInput = document.getElementById('admin-search');
    const addNotifForm = document.getElementById('add-notif-form');
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
                if (t && typeof t === 'object') {
                    map.add(`${t.uid}-${t.date}-${t.time}-${t.item || ''}-${t.pointsDeducted || 0}`);
                }
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

        const { status, lastFail, lastSuccess } = getSyncState(commandsData);
        syncStatusCircle.classList.add(status);

        if (status === 'red') {
            syncStatusCircle.title = `Last Sync Failed (${lastFail?.reason || 'Error'})`;
        } else if (status === 'green') {
            syncStatusCircle.title = `Last Sync Successful (${formatDateDisplay(lastSuccess?.date)} ${lastSuccess?.time || ''})`;
        } else {
            syncStatusCircle.title = 'Dispenser Sync Status';
        }
    }

    function renderUidActivity() {
        if (!uidTableBody) return;
        const map = new Map();

        const collect = (group, isOffline) => {
            if (!group || typeof group !== 'object') return;
            Object.keys(group).forEach((k) => {
                const entry = group[k];
                if (!entry || typeof entry !== 'object') return;
                const fp = `${entry.uid}-${entry.date}-${entry.time}`;
                // Prefer online log when both exist
                if (!map.has(fp) || !isOffline) {
                    map.set(fp, {
                        uid: String(entry.uid ?? 'N/A'),
                        name: String(entry.name ?? 'Unknown'),
                        date: String(entry.date ?? ''),
                        time: String(entry.time ?? '-'),
                        isOffline
                    });
                }
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
                String(row.uid).toLowerCase().includes(query) ||
                String(row.name).toLowerCase().includes(query) ||
                formatDateDisplay(row.date).toLowerCase().includes(query) ||
                String(row.date).toLowerCase().includes(query)
            );
        });

        if (uidHeading) {
            uidHeading.textContent = currentUidRows.length > 100
                ? `RECENT RFID / USER ACTIVITY (LATEST 100 OF ${currentUidRows.length})`
                : 'RECENT RFID / USER ACTIVITY';
        }

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
        if (customNotifsData && typeof customNotifsData === 'object') {
            Object.keys(customNotifsData).forEach((k) => {
                const n = customNotifsData[k];
                if (n && n.message) {
                    notifs.push({
                        id: k,
                        isCustom: true,
                        message: String(n.message),
                        date: String(n.date ?? ''),
                        time: String(n.time ?? '-'),
                        severity: n.severity || 'info'
                    });
                }
            });
        }

        // 2. Sync failure alerts from commands/syncfail
        if (commandsData && commandsData.syncfail && typeof commandsData.syncfail === 'object') {
            Object.keys(commandsData.syncfail).forEach((k) => {
                const entry = commandsData.syncfail[k];
                if (entry) {
                    notifs.push({
                        message: `Sync Failed: ${entry.reason || 'Error'} (${entry.firstName || 'User'} - ${entry.uid || 'N/A'})`,
                        date: String(entry.date ?? ''),
                        time: String(entry.time ?? '-'),
                        severity: 'error'
                    });
                }
            });
        }

        // 3. Sync success alerts from commands/syncsuccess
        if (commandsData && commandsData.syncsuccess && typeof commandsData.syncsuccess === 'object') {
            Object.keys(commandsData.syncsuccess).forEach((k) => {
                const entry = commandsData.syncsuccess[k];
                if (entry) {
                    notifs.push({
                        message: `Mega Sync Complete`,
                        date: String(entry.date ?? ''),
                        time: String(entry.time ?? '-'),
                        severity: 'success'
                    });
                }
            });
        }

        // 4. Offline transactions synced
        if (offTransData && typeof offTransData === 'object') {
            Object.keys(offTransData).forEach((k) => {
                const entry = offTransData[k];
                if (entry) {
                    notifs.push({
                        message: `Offline Dispense: ${entry.item || 'Item'} by ${entry.name || entry.uid || 'User'} (-${entry.pointsDeducted || 0} pts)`,
                        date: String(entry.date ?? ''),
                        time: String(entry.time ?? '-'),
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
                String(n.message).toLowerCase().includes(query) ||
                formatDateDisplay(n.date).toLowerCase().includes(query) ||
                String(n.date).toLowerCase().includes(query)
            );
        });

        if (notifsHeading) {
            notifsHeading.textContent = currentNotifRows.length > 100
                ? `SYSTEM NOTIFICATIONS & ALERTS (LATEST 100 OF ${currentNotifRows.length})`
                : 'SYSTEM NOTIFICATIONS & ALERTS';
        }

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

            if (n.isCustom && n.id) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '✕';
                delBtn.title = 'Delete notice';
                delBtn.style.marginLeft = '8px';
                delBtn.style.background = '#ff4d4d';
                delBtn.style.color = 'white';
                delBtn.style.border = '1px solid #800';
                delBtn.style.borderRadius = '3px';
                delBtn.style.cursor = 'pointer';
                delBtn.style.fontSize = '0.7rem';
                delBtn.style.padding = '1px 5px';
                delBtn.addEventListener('click', () => {
                    set(ref(db, 'notifications/' + n.id), null).catch((err) => {
                        console.error('Failed to delete notification:', err);
                    });
                });
                tdMsg.appendChild(delBtn);
            }

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

    function handlePostNotification(event) {
        if (event) event.preventDefault();
        if (!newNotifInput) return;
        const msg = newNotifInput.value.trim();
        if (!msg) return;
        const { date: dateStr, time: timeStr } = nowStamp();

        if (addNotifBtn) addNotifBtn.disabled = true;
        push(ref(db, 'notifications'), {
            message: msg,
            date: dateStr,
            time: timeStr,
            severity: 'info'
        }).then(() => {
            newNotifInput.value = '';
        }).catch((err) => {
            console.error("Failed to post notification:", err);
            alert("Failed to post notification: " + err.message);
        }).finally(() => {
            if (addNotifBtn) addNotifBtn.disabled = false;
        });
    }

    if (addNotifForm) {
        addNotifForm.addEventListener('submit', handlePostNotification);
    } else if (addNotifBtn) {
        addNotifBtn.addEventListener('click', handlePostNotification);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const rows = [
                ...currentUidRows.map((r) => ['UID Activity', `${r.uid} - ${r.name}`, formatDateDisplay(r.date), r.time]),
                ...currentNotifRows.map((n) => ['Notification', n.message, formatDateDisplay(n.date), n.time])
            ];
            downloadCsv('admin_activity_notifications.csv', ['Type', 'Detail', 'Date', 'Time'], rows);
        });
    }
});
