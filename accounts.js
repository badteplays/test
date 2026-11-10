import {
    auth, db, MAX_POINTS,
    onAuthStateChanged, ref, set, onValue, update,
    normalizeUsername, normalizeUid, isValidUid, isValidEmail, isValidPin,
    parseWholeNumber, formatDateDisplay, nowStamp, downloadCsv, getSyncState,
    requireAdminSession, logoutAdmin
} from "./common.js";

requireAdminSession();

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAdminSession()) return;

    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');
    const addAccountForm = document.getElementById('add-account-form');
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
    const addAdminForm = document.getElementById('add-admin-form');
    const newAdminUsernameInput = document.getElementById('newAdminUsername');
    const newAdminEmailInput = document.getElementById('newAdminEmail');
    const newAdminPassInput = document.getElementById('newAdminPass');
    const addAdminBtn = document.getElementById('addAdminBtn');
    const adminFeedbackEl = document.getElementById('admin-account-feedback');
    const adminSearchInput = document.getElementById('admin-account-search');
    const exportAdminsBtn = document.getElementById('export-admins-btn');

    let accountsCache = {};
    let filteredUIDs = [];
    let webAdminsCache = {};
    let filteredAdminKeys = [];

    function showFeedback(msg, isError = false, targetEl = feedbackEl) {
        if (!targetEl) return;
        targetEl.textContent = msg;
        targetEl.className = 'account-feedback ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            if (targetEl.textContent === msg) {
                targetEl.textContent = '';
                targetEl.className = 'account-feedback';
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
        searchInput.addEventListener('input', renderAccountsTable);
    }

    if (adminSearchInput) {
        adminSearchInput.addEventListener('input', renderWebAdminsTable);
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
                const newPts = prompt(
                    `Enter new points value for ${currentUser.name || uid} (Whole number 0 to ${MAX_POINTS}):`,
                    String(currentUser.points ?? 0)
                );
                if (newPts !== null) {
                    const parsedPts = parseWholeNumber(newPts, MAX_POINTS);
                    if (parsedPts === null) {
                        showFeedback(`Invalid points. Enter a whole number between 0 and ${MAX_POINTS.toLocaleString()}.`, true);
                        return;
                    }
                    updateAccount(uid, { points: parsedPts }, `Updated points for ${currentUser.name || uid} to ${parsedPts}.`);
                }
            } else if (type === 'pass') {
                const newPass = prompt(
                    `Enter new numeric keypad PIN (4 to 10 digits) for ${currentUser.name || uid}:`,
                    String(currentUser.password ?? '')
                );
                if (newPass !== null) {
                    const trimmed = newPass.trim();
                    if (!isValidPin(trimmed)) {
                        showFeedback("Invalid PIN. Dispenser keypad requires 4 to 10 numeric digits (0-9).", true);
                        return;
                    }
                    updateAccount(uid, { password: trimmed }, `Updated PIN for ${currentUser.name || uid}.`);
                }
            } else if (type === 'email') {
                const newEmail = prompt(`Enter new email for ${currentUser.name || uid}:`, String(currentUser.email ?? ''));
                if (newEmail !== null) {
                    const trimmed = newEmail.trim();
                    if (!isValidEmail(trimmed)) {
                        showFeedback("Please enter a valid email address.", true);
                        return;
                    }
                    const duplicateUid = Object.keys(accountsCache).find(
                        (k) => k !== uid && String(accountsCache[k]?.email || '').toLowerCase() === trimmed.toLowerCase()
                    );
                    if (duplicateUid) {
                        showFeedback(`That email is already assigned to UID ${duplicateUid}.`, true);
                        return;
                    }
                    updateAccount(uid, { email: trimmed }, `Updated email for ${currentUser.name || uid} to "${trimmed}".`);
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
    function handleAddRfidAccount(event) {
        if (event) event.preventDefault();
        const name = newNameInput ? newNameInput.value.trim() : '';
        const emailRaw = newEmailInput ? newEmailInput.value.trim() : '';
        const uid = normalizeUid(newUIDInput ? newUIDInput.value : '');
        const pass = newPassInput ? newPassInput.value.trim() : '';
        const pts = parseWholeNumber(newPointsInput ? newPointsInput.value : '0', MAX_POINTS);

        if (!name || !uid || !pass) {
            showFeedback("Please fill in Name, RFID UID, and PIN.", true);
            return;
        }

        if (!isValidUid(uid)) {
            showFeedback("RFID UID must be 3 to 24 alphanumeric characters.", true);
            return;
        }

        if (accountsCache[uid]) {
            showFeedback(`UID "${uid}" already exists (${accountsCache[uid].name || 'User'}). Use Edit buttons in the table instead of overwriting.`, true);
            return;
        }

        if (!isValidPin(pass)) {
            showFeedback("Dispenser PIN must be 4 to 10 numeric digits (0-9).", true);
            return;
        }

        if (pts === null) {
            showFeedback(`Initial points must be a whole number between 0 and ${MAX_POINTS.toLocaleString()}.`, true);
            return;
        }

        const finalEmail = emailRaw || `${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || uid}@supplify.com`;
        if (!isValidEmail(finalEmail)) {
            showFeedback("Please enter a valid email address.", true);
            return;
        }

        const duplicateEmailUid = Object.keys(accountsCache).find(
            (k) => String(accountsCache[k]?.email || '').toLowerCase() === finalEmail.toLowerCase()
        );
        if (duplicateEmailUid) {
            showFeedback(`Email "${finalEmail}" is already used by UID ${duplicateEmailUid}.`, true);
            return;
        }

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
    }

    if (addAccountForm) {
        addAccountForm.addEventListener('submit', handleAddRfidAccount);
    } else if (addAccountBtn) {
        addAccountBtn.addEventListener('click', handleAddRfidAccount);
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
            filteredAdminKeys = [];
            return;
        }

        const query = (adminSearchInput ? adminSearchInput.value : '').trim().toLowerCase();
        filteredAdminKeys = keys.filter((k) => {
            if (!query) return true;
            const adm = webAdminsCache[k] || {};
            return (
                k.toLowerCase().includes(query) ||
                String(adm.username || '').toLowerCase().includes(query) ||
                String(adm.email || '').toLowerCase().includes(query)
            );
        });

        if (filteredAdminKeys.length === 0) {
            webAdminsTableBody.innerHTML = '<tr><td colspan="4">No matching web admin accounts found.</td></tr>';
            return;
        }

        filteredAdminKeys.forEach((key) => {
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

    function handleAddWebAdmin(event) {
        if (event) event.preventDefault();
        const usernameRaw = newAdminUsernameInput ? newAdminUsernameInput.value.trim() : '';
        const emailRaw = newAdminEmailInput ? newAdminEmailInput.value.trim() : '';
        const passwordRaw = newAdminPassInput ? newAdminPassInput.value : '';

        if (!usernameRaw || !emailRaw || !passwordRaw) {
            showFeedback("Please enter Username, Email, and Password.", true, adminFeedbackEl);
            return;
        }

        if (!isValidEmail(emailRaw)) {
            showFeedback("Please enter a valid admin email address.", true, adminFeedbackEl);
            return;
        }

        if (passwordRaw.length < 6) {
            showFeedback("Admin password must be at least 6 characters long.", true, adminFeedbackEl);
            return;
        }

        const key = normalizeUsername(usernameRaw);
        if (!key) {
            showFeedback("Invalid username.", true, adminFeedbackEl);
            return;
        }

        const dupKey = Object.keys(webAdminsCache).find((k) => {
            const adm = webAdminsCache[k] || {};
            return (
                k.toLowerCase() === key ||
                String(adm.username || '').toLowerCase() === usernameRaw.toLowerCase() ||
                String(adm.email || '').toLowerCase() === emailRaw.toLowerCase()
            );
        });

        if (dupKey) {
            showFeedback(`Web Admin with that username or email already exists ("${webAdminsCache[dupKey]?.username || dupKey}"). Use the Edit buttons below instead.`, true, adminFeedbackEl);
            return;
        }

        const { date: createdAt } = nowStamp();

        set(ref(db, 'webAdmins/' + key), {
            username: usernameRaw,
            email: emailRaw,
            password: passwordRaw,
            createdAt
        })
            .then(() => {
                showFeedback(`Added web admin "${usernameRaw}" (${emailRaw})!`, false, adminFeedbackEl);
                if (newAdminUsernameInput) newAdminUsernameInput.value = '';
                if (newAdminEmailInput) newAdminEmailInput.value = '';
                if (newAdminPassInput) newAdminPassInput.value = '';
            })
            .catch((err) => showFeedback("Error adding admin: " + err.message, true, adminFeedbackEl));
    }

    if (addAdminForm) {
        addAdminForm.addEventListener('submit', handleAddWebAdmin);
    } else if (addAdminBtn) {
        addAdminBtn.addEventListener('click', handleAddWebAdmin);
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
                    const trimmed = nextUser.trim();
                    const newKey = normalizeUsername(trimmed);
                    if (!newKey) {
                        showFeedback("Invalid username.", true, adminFeedbackEl);
                        return;
                    }
                    const conflict = Object.keys(webAdminsCache).find(
                        (k) => k !== key && (k.toLowerCase() === newKey || String(webAdminsCache[k]?.username || '').toLowerCase() === trimmed.toLowerCase())
                    );
                    if (conflict) {
                        showFeedback(`Username "${trimmed}" is already taken.`, true, adminFeedbackEl);
                        return;
                    }
                    const updatedRecord = { ...currentAdmin, username: trimmed };
                    const updates = { [newKey]: updatedRecord };
                    if (newKey !== key) {
                        updates[key] = null;
                    }
                    update(ref(db, 'webAdmins'), updates)
                        .then(() => showFeedback(`Updated username to "${trimmed}".`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Update failed: " + err.message, true, adminFeedbackEl));
                }
            } else if (type === 'email') {
                const nextEmail = prompt(`Enter new email for ${currentAdmin.username || key}:`, String(currentAdmin.email || ''));
                if (nextEmail !== null && nextEmail.trim() !== "") {
                    const trimmed = nextEmail.trim();
                    if (!isValidEmail(trimmed)) {
                        showFeedback("Please enter a valid email address.", true, adminFeedbackEl);
                        return;
                    }
                    const conflict = Object.keys(webAdminsCache).find(
                        (k) => k !== key && String(webAdminsCache[k]?.email || '').toLowerCase() === trimmed.toLowerCase()
                    );
                    if (conflict) {
                        showFeedback(`Email "${trimmed}" is already used by another admin.`, true, adminFeedbackEl);
                        return;
                    }
                    update(ref(db, 'webAdmins/' + key), { email: trimmed })
                        .then(() => showFeedback(`Updated email to "${trimmed}".`, false, adminFeedbackEl))
                        .catch((err) => showFeedback("Update failed: " + err.message, true, adminFeedbackEl));
                }
            } else if (type === 'pass') {
                const nextPass = prompt(`Enter new login password (min 6 characters) for ${currentAdmin.username || key}:`, String(currentAdmin.password || ''));
                if (nextPass !== null && nextPass !== "") {
                    if (nextPass.length < 6) {
                        showFeedback("Admin password must be at least 6 characters long.", true, adminFeedbackEl);
                        return;
                    }
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

    // --- 6. SYNC STATUS CIRCLE & DISPLAY BOX LISTENER (SAFE DOM RENDERING) ---
    const commandsRef = ref(db, 'commands/');
    onValue(commandsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const { status, lastFail, lastSuccess, failTime, successTime } = getSyncState(data);

        if (statusCircle) {
            statusCircle.classList.remove('gray', 'green', 'red');
            statusCircle.classList.add(status);
        }

        if (!syncDisplayBox) return;

        if (failTime > successTime && lastFail) {
            syncDisplayBox.style.color = "#ff4d4d";
            const strong = document.createElement('strong');
            strong.textContent = 'FAILED: ';
            const line1 = document.createTextNode(String(lastFail.reason || 'Unknown'));
            const br1 = document.createElement('br');
            const line2 = document.createTextNode(`USER: ${String(lastFail.firstName || 'Unknown')} (${String(lastFail.uid || 'N/A')})`);
            const br2 = document.createElement('br');
            const line3 = document.createTextNode(`${formatDateDisplay(lastFail.date)} | ${String(lastFail.time || '-')}`);
            syncDisplayBox.replaceChildren(strong, line1, br1, line2, br2, line3);
        } else if (lastSuccess) {
            syncDisplayBox.style.color = "#00ff88";
            const strong = document.createElement('strong');
            strong.textContent = String(lastSuccess.status || 'Sync Complete');
            const br1 = document.createElement('br');
            const line1 = document.createTextNode(`DATE: ${formatDateDisplay(lastSuccess.date)}`);
            const br2 = document.createElement('br');
            const line2 = document.createTextNode(`TIME: ${String(lastSuccess.time || '-')}`);
            syncDisplayBox.replaceChildren(strong, br1, line1, br2, line2);
        }
    });

    // --- 7. EXPORT CSV ---
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const rows = filteredUIDs.map((uid) => {
                const u = accountsCache[uid] || {};
                return [u.name || '', u.email || '', uid, u.password ?? '', Number(u.points ?? 0)];
            });
            downloadCsv('supplify_rfid_accounts.csv', ['Name', 'Email', 'UID', 'Password', 'Points'], rows);
        });
    }

    if (exportAdminsBtn) {
        exportAdminsBtn.addEventListener('click', () => {
            const rows = filteredAdminKeys.map((key) => {
                const adm = webAdminsCache[key] || {};
                return [adm.username || key, adm.email || '', adm.password ?? '', adm.createdAt || ''];
            });
            downloadCsv('supplify_web_admins.csv', ['Username', 'Email', 'Password', 'CreatedAt'], rows);
        });
    }
});

// --- 8. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Session Active");
    }
});
