import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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

// Helper to parse DD/MM/YYYY or YYYY-MM-DD + HH:mm:ss properly
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

function safeSetHTML(el, html) {
    if ('setHTML' in Element.prototype) {
        el.setHTML(html);
    } else {
        el.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');
    const addAccountBtn = document.getElementById('addAccountBtn');
    const newNameInput = document.getElementById('newName');
    const newUIDInput = document.getElementById('newUID');
    const newPassInput = document.getElementById('newPass');
    const newPointsInput = document.getElementById('newPoints');
    const feedbackEl = document.getElementById('account-feedback');
    const searchInput = document.getElementById('account-search');
    const exportBtn = document.getElementById('export-accounts-btn');
    const syncBtn = document.getElementById('syncBtn');
    const statusCircle = document.getElementById('syncStatus');
    const syncDisplayBox = document.getElementById('sync-display-box');

    let accountsCache = {};
    let filteredUIDs = [];

    function showFeedback(msg, isError = false) {
        if (!feedbackEl) return;
        feedbackEl.textContent = msg;
        feedbackEl.className = 'account-feedback ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            if (feedbackEl.textContent === msg) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'account-feedback';
            }
        }, 4000);
    }

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

    // --- 2. LOAD ACCOUNTS DATA (SORTED ALPHABETICALLY + SEARCHABLE) ---
    const accountsRef = ref(db, 'accounts/');
    onValue(accountsRef, (snapshot) => {
        accountsCache = snapshot.val() || {};
        renderAccountsTable();
    }, (err) => {
        console.error("Failed to load accounts:", err);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5">Error loading accounts.</td></tr>';
        }
    });

    function renderAccountsTable() {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const uids = Object.keys(accountsCache);
        if (uids.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No accounts found.</td></tr>';
            filteredUIDs = [];
            return;
        }

        const sortedUids = uids.sort((a, b) => {
            const nameA = String(accountsCache[a]?.name || '').toUpperCase();
            const nameB = String(accountsCache[b]?.name || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        filteredUIDs = sortedUids.filter((uid) => {
            if (!query) return true;
            const user = accountsCache[uid] || {};
            return (
                uid.toLowerCase().includes(query) ||
                String(user.name || '').toLowerCase().includes(query)
            );
        });

        if (filteredUIDs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No matching accounts found.</td></tr>';
            return;
        }

        filteredUIDs.forEach((uid) => {
            const user = accountsCache[uid] || {};
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            tdName.textContent = user.name || 'Unnamed';

            const tdUid = document.createElement('td');
            tdUid.textContent = uid;

            const tdPass = document.createElement('td');
            tdPass.textContent = user.password ?? '0000';

            const tdPts = document.createElement('td');
            const strongPts = document.createElement('strong');
            strongPts.textContent = String(user.points ?? 0);
            tdPts.appendChild(strongPts);

            const tdActions = document.createElement('td');
            const actions = [
                { label: 'Edit Name', type: 'name', cls: 'edit-action-btn' },
                { label: 'Edit Pass', type: 'pass', cls: 'edit-action-btn' },
                { label: 'Edit Pts', type: 'points', cls: 'edit-action-btn' },
                { label: 'Delete', type: 'delete', cls: 'edit-action-btn delete-btn' }
            ];
            actions.forEach((act) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = act.cls;
                btn.setAttribute('data-uid', uid);
                btn.setAttribute('data-type', act.type);
                btn.textContent = act.label;
                tdActions.appendChild(btn);
            });

            tr.append(tdName, tdUid, tdPass, tdPts, tdActions);
            tableBody.appendChild(tr);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderAccountsTable);
    }

    // --- 3. EVENT DELEGATION (EDIT & DELETE) ---
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.edit-action-btn');
            if (!btn) return;

            const uid = btn.getAttribute('data-uid');
            const type = btn.getAttribute('data-type');
            const currentUser = accountsCache[uid] || {};

            if (type === 'points') {
                const newPts = prompt(`Enter new points value for ${currentUser.name || uid} (Whole numbers only, max 10 digits):`, String(currentUser.points ?? 0));
                if (newPts !== null && newPts.trim() !== "") {
                    let cleanPts = newPts.replace(/\D/g, '');
                    if (cleanPts.length > 10) {
                        cleanPts = cleanPts.substring(0, 10);
                    }
                    if (cleanPts !== "") {
                        const finalPts = parseInt(cleanPts, 10);
                        updateAccount(uid, { points: finalPts }, `Updated points for ${currentUser.name || uid} to ${finalPts}.`);
                    } else {
                        showFeedback("Invalid input. Please enter a valid whole number.", true);
                    }
                }
            } else if (type === 'pass') {
                const newPass = prompt(`Enter new password/PIN for ${currentUser.name || uid}:`, String(currentUser.password ?? ''));
                if (newPass !== null && newPass.trim() !== "") {
                    updateAccount(uid, { password: newPass.trim() }, `Updated PIN/password for ${currentUser.name || uid}.`);
                }
            } else if (type === 'name') {
                const newName = prompt(`Enter new name for UID ${uid}:`, String(currentUser.name ?? ''));
                if (newName !== null && newName.trim() !== "") {
                    updateAccount(uid, { name: newName.trim() }, `Updated name for ${uid} to "${newName.trim()}".`);
                }
            } else if (type === 'delete') {
                const userName = currentUser.name || uid;
                if (confirm(`Are you sure you want to delete ${userName} (${uid})?`)) {
                    set(ref(db, 'accounts/' + uid), null)
                        .then(() => showFeedback(`Deleted user ${userName} (${uid}).`, false))
                        .catch((err) => showFeedback("Delete failed: " + err.message, true));
                }
            }
        });
    }

    function updateAccount(uid, updateData, successMsg) {
        const userRef = ref(db, 'accounts/' + uid);
        update(userRef, updateData)
            .then(() => showFeedback(successMsg || "Account updated!", false))
            .catch((err) => showFeedback("Update failed: " + err.message, true));
    }

    // --- 4. NEW ACCOUNT CREATION ---
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', () => {
            const name = newNameInput ? newNameInput.value.trim() : '';
            const uid = newUIDInput ? newUIDInput.value.trim().toLowerCase() : '';
            const pass = newPassInput ? newPassInput.value.trim() : '';
            const ptsRaw = newPointsInput ? newPointsInput.value.trim() : '0';
            const pts = Math.max(0, parseInt(ptsRaw, 10) || 0);

            if (!name || !uid || !pass) {
                showFeedback("Please fill in Name, RFID UID, and PIN/Password.", true);
                return;
            }

            set(ref(db, 'accounts/' + uid), {
                name: name,
                password: pass,
                points: pts
            })
                .then(() => {
                    showFeedback(`Added user "${name}" (${uid}) with ${pts} pts!`, false);
                    if (newNameInput) newNameInput.value = '';
                    if (newUIDInput) newUIDInput.value = '';
                    if (newPassInput) newPassInput.value = '';
                    if (newPointsInput) newPointsInput.value = '0';
                })
                .catch((err) => showFeedback("Error adding user: " + err.message, true));
        });
    }

    // --- 5. SYNC TRIGGER ACTION ---
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            const syncRef = ref(db, 'commands/syncTrigger');
            if (statusCircle) {
                statusCircle.className = 'status-circle gray';
            }
            syncBtn.disabled = true;
            syncBtn.textContent = 'SYNCING...';

            set(syncRef, 1).then(() => {
                showFeedback("Sync command sent to Arduino Mega!", false);
                setTimeout(() => {
                    set(syncRef, 0)
                        .then(() => {
                            syncBtn.disabled = false;
                            syncBtn.textContent = 'SYNC TO MEGA';
                        })
                        .catch((err) => {
                            console.error("Reset failed:", err);
                            syncBtn.disabled = false;
                            syncBtn.textContent = 'SYNC TO MEGA';
                        });
                }, 2000);
            }).catch((error) => {
                console.error("Sync Error:", error);
                showFeedback("Sync failed: " + error.message, true);
                syncBtn.disabled = false;
                syncBtn.textContent = 'SYNC TO MEGA';
            });
        });
    }

    // --- 6. SYNC STATUS CIRCLE & DISPLAY BOX LISTENER ---
    const commandsRef = ref(db, 'commands/');
    onValue(commandsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const getLatestFromNode = (nodeData) => {
            if (!nodeData) return null;
            const keys = Object.keys(nodeData);
            const lastKey = keys[keys.length - 1];
            return nodeData[lastKey];
        };

        const lastFail = getLatestFromNode(data.syncfail);
        const lastSuccess = getLatestFromNode(data.syncsuccess);

        const failStamp = lastFail ? parseDateTime(lastFail.date, lastFail.time) : 0;
        const successStamp = lastSuccess ? parseDateTime(lastSuccess.date, lastSuccess.time) : 0;

        if (statusCircle) {
            statusCircle.classList.remove('gray', 'green', 'red');
            if (data.syncStatus === "sync_success" || (successStamp >= failStamp && successStamp > 0)) {
                statusCircle.classList.add('green');
            } else if (data.syncStatus === "sync_fail" || (failStamp > successStamp && failStamp > 0)) {
                statusCircle.classList.add('red');
            } else {
                statusCircle.classList.add('gray');
            }
        }

        if (!syncDisplayBox) return;

        if (failStamp > successStamp && lastFail) {
            syncDisplayBox.style.color = "#ff4d4d";
            const html = `<strong>FAILED:</strong> ${String(lastFail.reason || 'Unknown')}<br>USER: ${String(lastFail.firstName || 'Unknown')} (${String(lastFail.uid || 'N/A')})<br>${String(lastFail.date || '-')} | ${String(lastFail.time || '-')}`;
            safeSetHTML(syncDisplayBox, html);
        } else if (lastSuccess) {
            syncDisplayBox.style.color = "#00ff88";
            const html = `<strong>${String(lastSuccess.status || 'Sync Complete')}</strong><br>DATE: ${String(lastSuccess.date || '-')}<br>TIME: ${String(lastSuccess.time || '-')}`;
            safeSetHTML(syncDisplayBox, html);
        }
    });

    // --- 7. EXPORT CSV ---
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const lines = ['Name,UID,Password,Points'];
            filteredUIDs.forEach((uid) => {
                const u = accountsCache[uid] || {};
                const name = String(u.name || '').replace(/"/g, '""');
                const pass = String(u.password ?? '').replace(/"/g, '""');
                const pts = u.points ?? 0;
                lines.push(`"${name}","${uid}","${pass}",${pts}`);
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'supplify_accounts.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
});

// --- 8. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Session Active");
    }
});
