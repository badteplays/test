// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// Your web app's Firebase configuration
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

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('current-password') || document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const feedbackEl = document.getElementById('login-feedback');

function showFeedback(message, isError = true) {
    if (!feedbackEl) {
        if (isError) alert(message);
        return;
    }
    feedbackEl.textContent = message;
    feedbackEl.className = 'form-feedback ' + (isError ? 'error' : 'success');
}

if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordBtn.textContent = isPassword ? 'HIDE' : 'SHOW';
        togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
}

async function handleLogin(event) {
    if (event) event.preventDefault();

    const rawUsername = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!rawUsername || !password) {
        showFeedback("Please enter both username/email and password.", true);
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "SIGNING IN...";
    }
    showFeedback("Signing in...", false);

    const lowerIdentifier = rawUsername.toLowerCase();

    try {
        // 1. Check editable webAdmins & accounts tables in Firebase Realtime Database first
        const [webAdminsSnap, accountsSnap] = await Promise.all([
            get(ref(db, 'webAdmins')),
            get(ref(db, 'accounts'))
        ]);

        const webAdmins = webAdminsSnap.val();
        const rfidAccounts = accountsSnap.val();

        if (webAdmins && typeof webAdmins === 'object') {
            const matchedAdminKey = Object.keys(webAdmins).find((k) => {
                const adm = webAdmins[k] || {};
                return (
                    k.toLowerCase() === lowerIdentifier ||
                    String(adm.username || '').toLowerCase() === lowerIdentifier ||
                    String(adm.email || '').toLowerCase() === lowerIdentifier
                );
            });

            if (matchedAdminKey) {
                const matchedAdmin = webAdmins[matchedAdminKey];
                if (String(matchedAdmin.password) === password) {
                    localStorage.setItem('supplify_admin_session', matchedAdmin.username || matchedAdmin.email || matchedAdminKey);
                    // Best-effort Firebase Auth sign-in in the background
                    const authEmail = matchedAdmin.email || `${matchedAdminKey}@supplify.local`;
                    signInWithEmailAndPassword(auth, authEmail, password).catch(() => {});
                    showFeedback("Login successful! Redirecting...", false);
                    window.location.href = "menu.html";
                    return;
                } else {
                    throw new Error("Invalid password for web admin account.");
                }
            }
        }

        // 2. Also allow logging in with an account from accounts/ (by email, name, or UID)
        if (rfidAccounts && typeof rfidAccounts === 'object') {
            const matchedUid = Object.keys(rfidAccounts).find((uid) => {
                const acc = rfidAccounts[uid] || {};
                return (
                    uid.toLowerCase() === lowerIdentifier ||
                    String(acc.email || '').toLowerCase() === lowerIdentifier ||
                    String(acc.name || '').toLowerCase() === lowerIdentifier
                );
            });

            if (matchedUid) {
                const matchedAcc = rfidAccounts[matchedUid];
                if (String(matchedAcc.password) === password) {
                    localStorage.setItem('supplify_admin_session', matchedAcc.email || matchedAcc.name || matchedUid);
                    showFeedback("Login successful! Redirecting...", false);
                    window.location.href = "menu.html";
                    return;
                } else {
                    throw new Error("Invalid password for account.");
                }
            }
        }

        // 3. If webAdmins is populated and user was not found in either table, reject deleted/unknown user
        if (webAdmins && Object.keys(webAdmins).length > 0) {
            throw new Error("Account not found in database.");
        }

        // 4. Fallback to Firebase Auth if RTDB nodes are empty
        const emailToUse = rawUsername.includes('@')
            ? rawUsername
            : (lowerIdentifier === 'admin' ? 'admin@supplify.local' : `${rawUsername}@supplify.local`);
        await signInWithEmailAndPassword(auth, emailToUse, password);
        localStorage.setItem('supplify_admin_session', rawUsername);
        showFeedback("Login successful! Redirecting...", false);
        window.location.href = "menu.html";
    } catch (error) {
        console.error("Access denied:", error.message || error);
        showFeedback("Access denied. Wrong username/email or password.", true);
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "SIGN IN";
        }
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
} else if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
}
