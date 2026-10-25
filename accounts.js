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
    const newEmailInput = document.getElementById('newEmail');
    const newUIDInput = document.getElementById('newUID');
    const newPassInput = document.getElementById('newPass');
    const newPointsInput = document.getElementById('newPoints');
    const feedbackEl = document.getElementById('account-feedback');
    const searchInput = document.getElementById('account-search');
    const exportBtn = document.getElementById('export-accounts-btn');
    const syncBtn = document.getElementById('syncBtn');
    const statusCircle = document.getElementById('syncStatus');
    const syncDisplayBox = document.getElementById('sync-display-box');

    // Web Admin Login Accounts elements
    const webAdminsTableBody = document.getElementById('web-admins-table-body');
    const newAdminUsernameInput = document.getElementById('newAdminUsername');
    const newAdminEmailInput = document.getElementById('newAdminEmail');
    const newAdminPassInput = document.getElementById('newAdminPass');
    const addAdminBtn = document.getElementById('addAdminBtn');
    const adminFeedbackEl = document.getElementById('admin-account-feedback');

    let accountsCache = {};
    let filteredUIDs = [];
    let webAdminsCache = {};

    function showFeedback(msg, isError = false, targetEl = feedbackEl) {
        if (!targetEl) return;
        targetEl.textContent = msg;
        targetEl.className = 'account-feedback ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            if (targetEl.textContent === msg) {
                targetEl.textContent = '';
                targetEl.className = 'account-feedback';
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

    // --- 2. LOAD DISPENSER / RFID ACCOUNTS DATA ---
    const accountsRef = ref(db, 'accounts/');
    onValue(accountsRef, (snapshot) => {
        accountsCache = snapshot.val() || {};
        renderAccountsTable();
    }, (err) => {
        console.error("Failed to load accounts:", err);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6">Error loading accounts.</td></tr>';
        }
    });

    function renderAccountsTable() {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const uids = Object.keys(accountsCache);
        if (uids.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No accounts found.</td></tr>';
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
                String(user.name || '').toLowerCase().includes(query) ||
                String(user.email || '').toLowerCase().includes(query)
            );
        });

        if (filteredUIDs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No matching accounts found.</td></tr>';
            return;
        }

        filteredUIDs.forEach((uid) => {
            const user = accountsCache[uid] || {};
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            tdName.textContent = user.name || 'Unnamed';

            const tdEmail = document.createElement('td');
            tdEmail.textContent = user.email || '-';

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
                { label: 'Edit Email', type: 'email', cls: 'edit-action-btn' },
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

            tr.append(tdName, tdEmail, tdUid, tdPass, tdPts, tdActions);
            tableBody.appendChild(tr);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAccountsTable();
            renderWebAdminsTable();
        });
    }

    // --- 3. EVENT DELEGATION FOR DISPENSER ACCOUNTS (EDIT & DELETE) ---
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
            } else if (type === 'email') {
                const newEmail = prompt(`Enter new email for ${currentUser.name || uid}:`, String(currentUser.email ?? ''));
                if (newEmail !== null && newEmail.trim() !== "") {
                    updateAccount(uid, { email: newEmail.trim() }, `Updated email for ${currentUser.name || uid} to "${newEmail.trim()}".`);
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

    // --- 4. NEW DISPENSER ACCOUNT CREATION ---
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', () => {
            const name = newNameInput ? newNameInput.value.trim() : '';
            const email = newEmailInput ? newEmailInput.value.trim() : '';
            const uid = newUIDInput ? newUIDInput.value.trim().toLowerCase() : '';
            const pass = newPassInput ? newPassInput.value.trim() : '';
            const ptsRaw = newPointsInput ? newPointsInput.value.trim() : '0';
            const pts = Math.max(0, parseInt(ptsRaw, 10) || 0);

            if (!name || !uid || !pass) {
                showFeedback("Please fill in Name, RFID UID, and PIN/Password.", true);
                return;
            }

            const finalEmail = email || `${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || uid}@supplify.com`;

            set(ref(db, 'accounts/' + uid), {
                name: name,
                email: finalEmail,
                password: pass,
                points: pts
            })
                .then(() => {
                    showFeedback(`Added user "${name}" (${finalEmail}) with ${pts} pts!`, false);
                    if (newNameInput) newNameInput.value = '';
                    if (newEmailInput) newEmailInput.value = '';
                    if (newUIDInput) newUIDInput.value = '';
                    if (newPassInput) newPassInput.value = '';
                    if (newPointsInput) newPointsInput.value = '0';
                })
                .catch((err) => showFeedback("Error adding user: " + err.message, true));
        });
    }

    // --- 4.5. WEB ADMIN LOGIN ACCOUNTS (LOAD, ADD, EDIT, DELETE) ---
    const webAdminsRef = ref(db, 'webAdmins/');
    onValue(webAdminsRef, (snapshot) => {
        webAdminsCache = snapshot.val() || {};
        renderWebAdminsTable();
    }, (err) => {
        console.error("Failed to load webAdmins:", err);
        if (webAdminsTableBody) {
            webAdminsTableBody.innerHTML = '<tr><td colspan="4">Error loading web admin accounts.</td></tr>';
        }
    });

    function renderWebAdminsTable() {
        if (!webAdminsTableBody) return;
        webAdminsTableBody.innerHTML = '';

        const keys = Object.keys(webAdminsCache);
        if (keys.length === 0) {
            webAdminsTableBody.innerHTML = '<tr><td colspan="4">No web admin accounts found.</td></tr>';
            return;
        }

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const filteredKeys = keys.filter((k) => {
            if (!query) return true;
            const adm = webAdminsCache[k] || {};
            return (
                k.toLowerCase().includes(query) ||
                String(adm.username || '').toLowerCase().includes(query) ||
                String(adm.email || '').toLowerCase().includes(query)
            );
        });

        if (filteredKeys.length === 0) {
            webAdminsTableBody.innerHTML = '<tr><td colspan="4">No matching web admin accounts found.</td></tr>';
            return;
        }

        filteredKeys.forEach((key) => {
            const adm = webAdminsCache[key] || {};
            const tr = document.createElement('tr');

            const tdUser = document.createElement('td');
            tdUser.textContent = adm.username || key;

            const tdEmail = document.createElement('td');
            tdEmail.textContent = adm.email || '-';

            const tdPass = document.createElement('td');
            tdPass.textContent = adm.password ?? '';

            const tdActions = document.createElement('td');
            const actions = [
                { label: 'Edit Username', type: 'username', cls: 'edit-action-btn' },
                { label: 'Edit Email', type: 'email', cls: 'edit-action-btn' },
                { label: 'Edit Pass', type: 'pass', cls: 'edit-action-btn' },
                { label: 'Delete', type: 'delete', cls: 'edit-action-btn delete-btn' }
            ];
            actions.forEach((act) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = act.cls;
                btn.setAttribute('data-key', key);
                btn.setAttribute('data-type', act.type);
                btn.textContent = act.label;
                tdActions.appendChild(btn);
            });

            tr.append(tdUser, tdEmail, tdPass, tdActions);
            webAdminsTableBody.appendChild(tr);
        });
    }

    if (addAdminBtn) {
        addAdminBtn.addEventListener('click', () => {
            const usernameRaw = newAdminUsernameInput ? newAdminUsernameInput.value.trim() : '';
            const emailRaw = newAdminEmailInput ? newAdminEmailInput.value.trim() : '';
            const passwordRaw = newAdminPassInput ? newAdminPassInput.value : '';

            if ((!usernameRaw && !emailRaw) || !passwordRaw) {
                showFeedback("Please enter a Username or Email and a Password.", true, adminFeedbackEl);
                return;
            }

            const username = usernameRaw || emailRaw.split('@')[0];
            const email = emailRaw || (usernameRaw.includes('@') ? usernameRaw : `${usernameRaw}@supplify.local`);
            const key = username.replace(/[.#$/[\]\s]/g, '_').toLowerCase() || ('admin_' + Date.now());
            const now = new Date();
            const createdAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

            set(ref(db, 'webAdmins/' + key), {
                username,
                email,
                password: passwordRaw,
                createdAt
            })
                .then(() => {
                    showFeedback(`Added web admin "${username}" (${email})!`, false, adminFeedbackEl);
                    if (newAdminUsernameInput) newAdminUsernameInput.value = '';
                    if (newAdminEmailInput) newAdminEmailInput.value = '';
                    if (newAdminPassInput) newAdminPassInput.value = '';
                })
                .catch((err) => showFeedback("Error adding admin: " + err.message, true, adminFeedbackEl));
        });
    }

    if (webAdminsTableBody) {
        webAdminsTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.edit-action-btn');
            if (!btn) return;

            const key = btn.getAttribute('data-key');
            const type = btn.getAttribute('data-type');
            const currentAdmin = webAdminsCache[key] || {};

            if (type === 'username') {
                const nextUser = prompt(`Enter new username for ${currentAdmin.email || key}:`, String(currentAdmin.username || key));
                if (nextUser !== null && nextUser.trim() !== "") {
                    update(ref(db, 'webAdmins/' + key), { username: nextUser.trim() })
                        .then(() => showFeedback(`Updated username to "${nextUser.trim()}".`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Update failed: " + err.message, true, adminFeedbackEl));
                }
            } else if (type === 'email') {
                const nextEmail = prompt(`Enter new email for ${currentAdmin.username || key}:`, String(currentAdmin.email || ''));
                if (nextEmail !== null && nextEmail.trim() !== "") {
                    update(ref(db, 'webAdmins/' + key), { email: nextEmail.trim() })
                        .then(() => showFeedback(`Updated email to "${nextEmail.trim()}".`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Update failed: " + err.message, true, adminFeedbackEl));
                }
            } else if (type === 'pass') {
                const nextPass = prompt(`Enter new login password for ${currentAdmin.username || key}:`, String(currentAdmin.password || ''));
                if (nextPass !== null && nextPass.trim() !== "") {
                    update(ref(db, 'webAdmins/' + key), { password: nextPass })
                        .then(() => showFeedback(`Updated password for ${currentAdmin.username || key}.`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Update failed: " + err.message, true, adminFeedbackEl));
                }
            } else if (type === 'delete') {
                const label = currentAdmin.email || currentAdmin.username || key;
                if (confirm(`Are you sure you want to delete web admin "${label}"?`)) {
                    set(ref(db, 'webAdmins/' + key), null)
                        .then(() => showFeedback(`Deleted web admin "${label}".`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Delete failed: " + err.message, true, adminFeedbackEl));
                }
            }
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
            const lines = ['Name,Email,UID,Password,Points'];
            filteredUIDs.forEach((uid) => {
                const u = accountsCache[uid] || {};
                const name = String(u.name || '').replace(/"/g, '""');
                const email = String(u.email || '').replace(/"/g, '""');
                const pass = String(u.password ?? '').replace(/"/g, '""');
                const pts = u.points ?? 0;
                lines.push(`"${name}","${email}","${uid}","${pass}",${pts}`);
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
